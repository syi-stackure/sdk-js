/**
 * An authenticated Stackure user.
 */
export interface User {
  /** Unique user identifier */
  user_id: string;
  /** User's email address */
  user_email: string;
  /** User's first name */
  user_first_name: string;
  /** User's last name */
  user_last_name: string;
  /** Roles assigned to the user for the current app */
  user_roles: string[];
}

/**
 * Outcome of a `verify()` call. Exactly one of `user` or `error` is populated
 * depending on `authenticated`.
 */
export interface VerifyResult {
  /** Whether the request is authenticated */
  authenticated: boolean;
  /** Authenticated user (only when `authenticated` is true) */
  user?: User;
  /** Error details (only when `authenticated` is false) */
  error?: {
    /** HTTP status code — 401, 403, or 500 */
    code: number;
    /** Human-readable message */
    message: string;
    /** URL to redirect an unauthenticated user for sign-in */
    sign_in_url?: string;
  };
}

/**
 * Successful `sendMagicLink()` response.
 */
export interface MagicLinkResponse {
  /** Human-readable confirmation (e.g. "Magic link sent") */
  message: string;
}
