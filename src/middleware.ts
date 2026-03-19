import { StackureClient } from './client';
import type { StackureUser } from './types';

const client = new StackureClient();

/**
 * Options for authentication verification
 */
export interface VerifyOptions {
  /** Your Stackure application ID */
  appId: string;
  /** Optional list of required roles (user must have at least one) */
  roles?: string[];
  /** Optional incoming HTTP request for forwarding authentication cookies in server-side environments */
  request?: { headers?: Record<string, string | string[] | undefined> };
}

/**
 * Result of authentication verification
 */
export interface VerifyResult {
  /** Whether the request is authenticated */
  authenticated: boolean;
  /** Authenticated user information (only present if authenticated) */
  user?: StackureUser;
  /** Error details (only present if not authenticated) */
  error?: {
    /** HTTP status code (401, 403, or 500) */
    code: number;
    /** Human-readable error message */
    message: string;
    /** URL to redirect unauthenticated users for sign-in */
    sign_in_url?: string;
  };
}

/**
 * Verify authentication for a request
 * 
 * Pure verification function - returns result without automatic error handling.
 * You control what happens next based on the result.
 * 
 * @param options - Verification options including app ID and optional roles
 * @returns Promise resolving to verification result with user data or error details
 * 
 * @example
 * ```typescript
 * const result = await verify({ 
 *   appId: 'your-app-id',
 *   roles: ['admin'] 
 * });
 * 
 * if (!result.authenticated) {
 *   return res.status(result.error.code).json(result.error);
 * }
 * 
 * // Use result.user
 * res.json({ user: result.user });
 * ```
 */
export async function verify(options: VerifyOptions): Promise<VerifyResult> {
  try {
    const cookieHeader = options.request?.headers?.['cookie'];
    const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
    const session = await client.validateSession(options.appId, cookieStr);

    if (!session.authenticated || !session.user) {
      return {
        authenticated: false,
        error: {
          code: 401,
          message: 'Valid authentication required',
          sign_in_url: session.sign_in_url,
        },
      };
    }

    if (options.roles && options.roles.length > 0) {
      const userRoles = session.user.user_roles || [];
      const hasRequiredRole = options.roles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        return {
          authenticated: false,
          user: session.user,
          error: {
            code: 403,
            message: `Requires one of: ${options.roles.join(', ')}`,
          },
        };
      }
    }

    return {
      authenticated: true,
      user: session.user,
    };
  } catch (error) {
    console.error('Stackure verification error:', error);
    return {
      authenticated: false,
      error: {
        code: 500,
        message: 'Authentication verification failed',
      },
    };
  }
}

/**
 * Smart authentication middleware for Express-style frameworks
 * 
 * Automatically handles authentication and adapts response based on request type:
 * - API requests (Accept: application/json) → Returns JSON error response
 * - Browser requests (Accept: text/html) → Redirects to Stackure sign-in page
 * - Ambiguous/missing Accept header → Defaults to JSON (safe for modern APIs)
 * 
 * On successful authentication, injects user into `req.user` and calls `next()`.
 * 
 * @param options - Authentication options including app ID and optional roles
 * @returns Express-style middleware function
 * 
 * @example
 * ```typescript
 * import { auth } from 'stackure';
 * 
 * app.get('/admin', auth({ appId: 'your-app-id', roles: ['admin'] }), (req, res) => {
 *   res.json({ user: req.user });
 * });
 * ```
 */
export function auth(options: VerifyOptions) {
  return async (req: any, res: any, next: any): Promise<void> => {
    const result = await verify({ ...options, request: req });

    if (!result.authenticated && result.error) {
      const acceptHeader = req.headers?.accept || '';
      const acceptsHtml = acceptHeader.includes('text/html');
      const acceptsJson = acceptHeader.includes('application/json');

      if (acceptsHtml && !acceptsJson && result.error.sign_in_url) {
        return res.redirect(302, result.error.sign_in_url);
      }

      return res.status(result.error.code).json({
        error: result.error.code === 401 ? 'Unauthorized' : result.error.code === 403 ? 'Forbidden' : 'Error',
        message: result.error.message,
        sign_in_url: result.error.sign_in_url,
      });
    }

    req.user = result.user;
    next();
  };
}

