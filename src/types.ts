/**
 * User information returned from Stackure authentication
 */
export interface StackureUser {
  /** Unique user identifier */
  user_id: string;
  /** Account identifier the user belongs to */
  account_id: string;
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
  /** Whether the magic link was sent successfully */
  success: boolean;
  /** Human-readable message about the request */
  message: string;
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
  /** Your application ID from Stackure */
  appId: string;
  /** Optional URL to redirect to after authentication */
  redirectUrl?: string;
}
