import { StackureClient } from './client';
import type {
  StackureUser,
  StackureConfig,
  SendMagicLinkOptions,
  MagicLinkResponse,
  SessionValidationResponse,
} from './types';

const defaultClient = new StackureClient();

/**
 * Send a magic link to a user's email address
 * 
 * @param options - Magic link options including email, app ID, and optional redirect URL
 * @returns Promise resolving to response with success status and message
 * 
 * @example
 * ```typescript
 * await sendMagicLink({
 *   email: 'user@example.com',
 *   appId: 'your-app-id',
 *   redirectUrl: 'https://yourapp.com/dashboard'
 * });
 * ```
 */
export const sendMagicLink = (options: SendMagicLinkOptions): Promise<MagicLinkResponse> => {
  return defaultClient.sendMagicLink(options);
};

/**
 * Validate the current session for a specific application
 * 
 * Checks if the user has a valid authenticated session for your app.
 * Automatically includes session cookies in the request.
 * 
 * @param appId - Your Stackure application ID
 * @returns Promise resolving to session validation result with user data if authenticated
 * 
 * @example
 * ```typescript
 * const session = await validateSession('your-app-id');
 * 
 * if (session.authenticated) {
 *   console.log('User:', session.user);
 * } else {
 *   console.log('Sign in at:', session.sign_in_url);
 * }
 * ```
 */
export const validateSession = (appId: string): Promise<SessionValidationResponse> => {
  return defaultClient.validateSession(appId);
};

/**
 * Sign out the current user from all Stackure applications
 * 
 * Invalidates the user's session across all apps using Stackure authentication.
 * 
 * @returns Promise that resolves when sign out is complete
 * 
 * @example
 * ```typescript
 * await logout();
 * // User is now signed out from all apps
 * ```
 */
export const logout = (): Promise<void> => {
  return defaultClient.logout();
};

/**
 * Initiate sign-in flow for a user
 * 
 * If email is provided, sends a magic link directly.
 * If no email, redirects to Stackure sign-in page (browser only).
 * 
 * @param appId - Your Stackure application ID
 * @param email - Optional email address to send magic link to
 * @returns Promise resolving to magic link response (if email provided) or void (if redirecting)
 * 
 * @example
 * ```typescript
 * // Send magic link to specific email
 * await signIn('your-app-id', 'user@example.com');
 * 
 * // Redirect to sign-in page (browser only)
 * await signIn('your-app-id');
 * ```
 */
export const signIn = (appId: string, email?: string): Promise<MagicLinkResponse | void> => {
  return defaultClient.signIn(appId, email);
};

export type {
  StackureUser,
  StackureConfig,
  SendMagicLinkOptions,
  MagicLinkResponse,
  SessionValidationResponse,
} from './types';

export {
  StackureError,
  ValidationError,
  NetworkError,
  AuthenticationError,
  TimeoutError,
} from './errors';

export { verify, auth } from './middleware';
export type { VerifyOptions, VerifyResult } from './middleware';

export { StackureClient } from './client';
