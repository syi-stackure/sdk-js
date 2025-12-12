/**
 * User information returned from Stackure authentication
 */
export interface StackureUser {
  /** Unique user identifier */
  user_id: string;
  /** User's email address */
  user_email: string;
  /** User's first name */
  user_first_name: string;
  /** User's last name */
  user_last_name: string;
  /** List of permissions/roles assigned to the user */
  user_roles: string[];
}

/**
 * Response from session validation request
 */
export interface SessionValidationResponse {
  /** Whether the session is authenticated */
  authenticated: boolean;
  /** User information (only present if authenticated) */
  user?: StackureUser;
  /** Sign-in URL to redirect unauthenticated users */
  sign_in_url?: string;
}

/**
 * Response from magic link request
 */
export interface MagicLinkResponse {
  /** Human-readable message about the request */
  message: string;
  /** Token returned only in local environments for testing */
  token?: string;
}

/**
 * Configuration options for the Stackure SDK
 */
export interface StackureConfig {
  /**
   * Base URL of the Stackure API
   * @default "https://stackure.com"
   */
  baseUrl?: string;
  
  /**
   * Request timeout in milliseconds
   * @default 10000
   */
  timeout?: number;
}

/**
 * Options for sending a magic link to a user
 */
export interface SendMagicLinkOptions {
  /** User's email address */
  email: string;
  /** Your application ID from Stackure (optional per API spec) */
  appId?: string;
}
