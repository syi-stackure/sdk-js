import type {
  StackureConfig,
  SendMagicLinkOptions,
  MagicLinkResponse,
  SessionValidationResponse,
} from './types';
import { NetworkError, TimeoutError, AuthenticationError } from './errors';
import { validateEmail, validateUUID } from './validation';

const DEFAULT_BASE_URL = 'https://stackure.com';
const DEFAULT_TIMEOUT = 10000;

/**
 * Stackure authentication client
 * 
 * Main client for interacting with Stackure authentication API.
 * Handles magic links, session validation, and sign out.
 * 
 * @example
 * ```typescript
 * const client = new StackureClient({
 *   baseUrl: 'https://custom.stackure.com',
 *   timeout: 15000
 * });
 * ```
 */
export class StackureClient {
  private baseUrl: string;
  private timeout: number;

  /**
   * Create a new Stackure client
   * 
   * @param config - Optional configuration for base URL and timeout
   */
  constructor(config: StackureConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new TimeoutError(`Request timed out after ${this.timeout}ms`);
      }
      
      throw new NetworkError(`Network request failed: ${error.message}`, error.status);
    }
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const maxRetries = 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
      }

      try {
        const response = await this.fetchWithTimeout(url, options);

        // Retry 5xx errors unless this is the last attempt.
        if (response.status >= 500 && attempt < maxRetries) {
          lastError = new NetworkError(`Server error (${response.status})`, response.status);
          continue;
        }

        return await this.handleResponse<T>(response);
      } catch (error: any) {
        // Timeouts are not retried — a second attempt would obscure latency.
        if (error instanceof TimeoutError) {
          throw error;
        }
        lastError = error;
      }
    }

    throw lastError!;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      
      if (response.status === 401) {
        throw new AuthenticationError(errorText || 'Authentication failed');
      }
      
      throw new NetworkError(`API error (${response.status}): ${errorText}`, response.status);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new NetworkError('Invalid JSON response from server');
    }
  }

  /**
   * Send a magic link to a user's email
   * 
   * @param options - Email and optional app ID
   * @returns Promise resolving to response with success status
   * @throws {ValidationError} If email or app ID format is invalid
   * @throws {NetworkError} If request fails
   * @throws {TimeoutError} If request times out
   * 
   * @example
   * ```typescript
   * const response = await client.sendMagicLink({
   *   email: 'user@example.com',
   *   appId: 'your-app-id'
   * });
   * ```
   */
  async sendMagicLink(options: SendMagicLinkOptions): Promise<MagicLinkResponse> {
    const { email, appId } = options;

    validateEmail(email);
    if (appId) {
      validateUUID(appId, 'App ID');
    }

    return this.request<MagicLinkResponse>(
      `${this.baseUrl}/api/public/auth/magic-link/send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: email,
          ...(appId && { app_id: appId }),
        }),
      }
    );
  }

  /**
   * Validate current session for an application
   * 
   * @param appId - Your Stackure application ID
   * @returns Promise resolving to session validation result
   * @throws {ValidationError} If app ID format is invalid
   * @throws {NetworkError} If request fails
   * @throws {TimeoutError} If request times out
   * 
   * @example
   * ```typescript
   * const session = await client.validateSession('your-app-id');
   * if (session.authenticated) {
   *   console.log(session.user);
   * }
   * ```
   */
  async validateSession(appId: string, cookieHeader?: string): Promise<SessionValidationResponse> {
    validateUUID(appId, 'App ID');

    const requestInit: RequestInit = { method: 'GET' };
    if (cookieHeader) {
      requestInit.headers = { Cookie: cookieHeader };
    } else {
      requestInit.credentials = 'include';
    }

    return this.request<SessionValidationResponse>(
      `${this.baseUrl}/api/public/auth/session/validate?app_id=${appId}`,
      requestInit
    );
  }

  /**
   * Sign out the current user
   * 
   * @returns Promise that resolves when sign out is complete
   * @throws {NetworkError} If request fails
   * @throws {TimeoutError} If request times out
   * 
   * @example
   * ```typescript
   * await client.logout();
   * ```
   */
  async logout(): Promise<void> {
    await this.request<void>(
      `${this.baseUrl}/api/public/auth/sign-out`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );
  }

  /**
   * Initiate sign-in flow
   * 
   * If email is provided, sends magic link. Otherwise redirects to sign-in page (browser only).
   * 
   * @param appId - Your Stackure application ID
   * @param email - Optional email address
   * @returns Promise resolving to magic link response or void (if redirecting)
   * @throws {ValidationError} If app ID or email format is invalid
   * @throws {NetworkError} If not in browser environment and no email provided
   * 
   * @example
   * ```typescript
   * // Send magic link
   * await client.signIn('your-app-id', 'user@example.com');
   * 
   * // Redirect to sign-in (browser only)
   * await client.signIn('your-app-id');
   * ```
   */
  async signIn(appId: string, email?: string): Promise<MagicLinkResponse | void> {
    validateUUID(appId, 'App ID');

    if (email) {
      return this.sendMagicLink({ email, appId });
    }

    if (typeof window === 'undefined' || !window.location) {
      throw new NetworkError('signIn() requires a browser environment when email is not provided');
    }

    window.location.href = `${this.baseUrl}/sign-in/magic-link?app_id=${appId}`;
  }
}
