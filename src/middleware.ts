import { StackureError } from './errors.js';
import { validateSessionRequest } from './_http.js';
import type { User, VerifyResult } from './types.js';

/**
 * Options for `verify()`.
 */
export interface VerifyOptions {
  /** Your Stackure application ID */
  appId: string;
  /** Optional required roles (user must hold at least one) */
  roles?: string[];
  /**
   * Optional incoming request whose cookies should be forwarded for
   * server-side verification. Any object exposing a Node-style `headers`
   * bag works (Express, Fastify, bare http.IncomingMessage).
   */
  request?: { headers?: Record<string, string | string[] | undefined> };
}

/**
 * Verify an incoming request without throwing.
 *
 * Returns a `VerifyResult` — callers inspect `authenticated` and decide how
 * to respond (redirect, JSON 401, render an error page, etc.).
 *
 * @example
 * ```typescript
 * const result = await verify({ appId: 'my-app-id', request: req });
 * if (!result.authenticated) {
 *   return res.status(result.error!.code).json(result.error);
 * }
 * // result.user
 * ```
 */
export async function verify(options: VerifyOptions): Promise<VerifyResult> {
  try {
    const cookieHeader = options.request?.headers?.['cookie'];
    const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
    const session = await validateSessionRequest(options.appId, cookieStr);

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
      const have = session.user.user_roles ?? [];
      const ok = options.roles.some((r) => have.includes(r));
      if (!ok) {
        return {
          authenticated: false,
          user: session.user,
          error: { code: 403, message: `Requires one of: ${options.roles.join(', ')}` },
        };
      }
    }

    return { authenticated: true, user: session.user };
  } catch (error) {
    const message =
      error instanceof StackureError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Authentication verification failed';
    console.error('stackure: verification error:', message);
    return {
      authenticated: false,
      error: { code: 500, message: 'Authentication verification failed' },
    };
  }
}

/**
 * Minimal Express-style middleware request shape the `auth` middleware reads
 * from. Compatible with Express, Connect, Fastify (adapted), and anything
 * exposing Node's IncomingMessage-style `headers` bag.
 */
interface MiddlewareRequest {
  headers?: Record<string, string | string[] | undefined>;
  user?: User;
}

/** Minimal response shape the `auth` middleware writes to. */
interface MiddlewareResponse {
  redirect: (status: number, url: string) => void;
  status: (code: number) => { json: (body: unknown) => unknown };
}

/** Express-style `next` callback. */
type MiddlewareNext = (err?: unknown) => void;

/**
 * HTTP middleware that enforces authentication.
 *
 * On success, the user is attached to `req.user` (retrieve it there or via
 * the request reference you captured).
 *
 * On 401 with a browser client (Accept: text/html), redirects to the
 * sign-in URL. On 401 for API clients, or on 403, returns JSON.
 *
 * @example
 * ```typescript
 * app.get('/admin', auth({ appId: 'my-app-id', roles: ['admin'] }), (req, res) => {
 *   res.json({ user: req.user });
 * });
 * ```
 */
export function auth(options: VerifyOptions) {
  return async (
    req: MiddlewareRequest,
    res: MiddlewareResponse,
    next: MiddlewareNext,
  ): Promise<void> => {
    const result = await verify({ ...options, request: req });

    if (!result.authenticated && result.error) {
      const acceptHeader = req.headers?.['accept'];
      const acceptStr = Array.isArray(acceptHeader) ? acceptHeader.join(',') : (acceptHeader ?? '');
      const acceptsHtml = acceptStr.includes('text/html');
      const acceptsJson = acceptStr.includes('application/json');

      if (acceptsHtml && !acceptsJson && result.error.sign_in_url) {
        res.redirect(302, result.error.sign_in_url);
        return;
      }

      const label =
        result.error.code === 401
          ? 'Unauthorized'
          : result.error.code === 403
            ? 'Forbidden'
            : 'Error';
      res.status(result.error.code).json({
        error: label,
        message: result.error.message,
        sign_in_url: result.error.sign_in_url,
      });
      return;
    }

    req.user = result.user;
    next();
  };
}
