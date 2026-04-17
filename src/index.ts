import { logoutRequest, sendMagicLinkRequest } from './_http.js';
import type { MagicLinkResponse } from './types.js';

/**
 * Send a passwordless sign-in email to a user.
 *
 * @example
 * ```typescript
 * await sendMagicLink({ email: 'user@example.com', appId: 'my-app-id' });
 * ```
 */
export function sendMagicLink(options: {
  email: string;
  appId?: string;
}): Promise<MagicLinkResponse> {
  return sendMagicLinkRequest(options.email, options.appId);
}

/**
 * Revoke the session identified by the given cookie header.
 *
 * @param cookieHeader - Raw Cookie header from the request, or omit to rely
 *   on browser cookies (client-side calls only).
 *
 * @example
 * ```typescript
 * await logout(req.headers.cookie);
 * ```
 */
export function logout(cookieHeader?: string): Promise<void> {
  return logoutRequest(cookieHeader);
}

export { auth, verify } from './middleware.js';
export { StackureError } from './errors.js';
export type { StackureErrorCode } from './errors.js';
export type { User, VerifyResult, MagicLinkResponse } from './types.js';
export type { VerifyOptions } from './middleware.js';
