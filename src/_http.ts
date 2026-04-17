/**
 * Internal HTTP helpers for the Stackure SDK. Not part of the public API —
 * consumers should use the free functions in index.ts.
 */

import { StackureError } from './errors.js';
import type { MagicLinkResponse, User, VerifyResult } from './types.js';
import { validateEmail, validateUUID } from './validation.js';

const DEFAULT_BASE_URL = 'https://stackure.com';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

/**
 * Resolve the base URL from the STACKURE_BASE_URL environment variable,
 * falling back to production. Read on each call so tests + runtime overrides
 * take effect without restart.
 */
function baseUrl(): string {
  const env = typeof process !== 'undefined' ? process.env?.['STACKURE_BASE_URL'] : undefined;
  return (env ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

/**
 * Internal session-validation response shape. Mapped into `VerifyResult`
 * before returning to callers.
 */
interface SessionValidationResponse {
  authenticated: boolean;
  user?: User;
  sign_in_url?: string;
}

/**
 * Fetch wrapper that enforces the 10s timeout and maps HTTP errors to
 * StackureError. Retries 5xx twice with exponential backoff; never retries
 * timeouts.
 */
async function request<T>(path: string, init: RequestInit = {}, cookieHeader?: string): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {};
    if (init.body != null) headers['Content-Type'] = 'application/json';
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    try {
      const response = await fetch(baseUrl() + path, {
        ...init,
        headers: { ...headers, ...init.headers },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        lastError = new StackureError(
          'network',
          `Server error (${response.status})`,
          response.status,
        );
        continue;
      }

      return await handleResponse<T>(response);
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof StackureError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new StackureError('timeout', `Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      const message = error instanceof Error ? error.message : String(error);
      lastError = new StackureError('network', `Network request failed: ${message}`);
    }
  }

  throw lastError ?? new StackureError('network', 'Request failed after retries');
}

/**
 * Read response body and map non-2xx to StackureError.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    if (response.status === 401) throw new StackureError('auth', text, 401);
    if (response.status === 403) throw new StackureError('forbidden', text, 403);
    throw new StackureError('network', `API error (${response.status}): ${text}`, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new StackureError('network', 'Invalid JSON response from server', response.status);
  }
}

/**
 * POST /api/public/auth/magic-link/send
 */
export async function sendMagicLinkRequest(
  email: string,
  appId?: string,
): Promise<MagicLinkResponse> {
  validateEmail(email);
  if (appId !== undefined) validateUUID(appId, 'App ID');

  return request<MagicLinkResponse>('/api/public/auth/magic-link/send', {
    method: 'POST',
    body: JSON.stringify({
      user_email: email,
      ...(appId && { app_id: appId }),
    }),
  });
}

/**
 * GET /api/public/auth/session/validate
 */
export async function validateSessionRequest(
  appId: string,
  cookieHeader?: string,
): Promise<SessionValidationResponse> {
  validateUUID(appId, 'App ID');
  return request<SessionValidationResponse>(
    `/api/public/auth/session/validate?app_id=${encodeURIComponent(appId)}`,
    { method: 'GET' },
    cookieHeader,
  );
}

/**
 * POST /api/public/auth/sign-out
 */
export async function logoutRequest(cookieHeader?: string): Promise<void> {
  await request<unknown>('/api/public/auth/sign-out', { method: 'POST' }, cookieHeader);
}

export type { VerifyResult, User, MagicLinkResponse };
