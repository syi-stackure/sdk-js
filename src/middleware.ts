import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TLSSocket } from 'node:tls';
import {
  SESSION_COOKIE,
  TOKEN_PARAM,
  baseUrl,
  reqUrl,
  validateSession,
  validateToken,
  origin,
} from './stackure.js';
import type { Session, User, VerifyResult } from './stackure.js';

/** Request shape the middleware reads from and attaches the user to. */
export interface StackureRequest extends IncomingMessage {
  user?: User | undefined;
  body?: unknown;
  originalUrl?: string;
}

type Next = (err?: unknown) => void;

/** The user attached by `auth()`, or undefined if the request was not authenticated. */
export function userFromRequest(req: StackureRequest): User | undefined {
  return req.user;
}

function isHttps(req: IncomingMessage): boolean {
  return (
    (req.socket as TLSSocket)?.encrypted === true ||
    String(req.headers['x-forwarded-proto'] ?? '').toLowerCase() === 'https'
  );
}

/**
 * Verify a request without throwing. Callers inspect `authenticated` and
 * decide how to respond.
 *
 * @example
 * ```typescript
 * const result = await verify(appId, req, 'can_approve_invoice');
 * if (!result.authenticated) return res.status(result.error!.code).json(result.error);
 * ```
 */
export async function verify(
  appId: string,
  req: IncomingMessage,
  ...permissions: string[]
): Promise<VerifyResult> {
  let session: Session;
  try {
    session = await validateSession(appId, req);
  } catch (e) {
    console.error('stackure: verification error:', e instanceof Error ? e.message : String(e));
    return { authenticated: false, error: { code: 500, message: 'Authentication verification failed' } };
  }

  const user = session.user;
  if (!session.authenticated || !user) {
    return {
      authenticated: false,
      error: {
        code: 401,
        message: 'Valid authentication required',
        sign_in_url: session.sign_in_url,
      },
    };
  }

  const have = user.user_permissions ?? [];
  if (permissions.length > 0 && !permissions.some((p) => have.includes(p))) {
    return {
      authenticated: false,
      user,
      error: { code: 403, message: `Requires one of: ${permissions.join(', ')}` },
    };
  }

  return { authenticated: true, user };
}

const MAX_HANDOFF_BODY = 4096;
const SESSION_MAX_AGE = 7 * 24 * 3600;

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size <= MAX_HANDOFF_BODY) chunks.push(c as Buffer);
  }
  return size > MAX_HANDOFF_BODY ? '' : Buffer.concat(chunks).toString();
}

async function handoffToken(req: StackureRequest): Promise<string> {
  if (req.method !== 'POST') return '';
  if ((req.headers['origin'] ?? '') !== origin()) return '';
  if (!String(req.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded')) {
    return '';
  }

  const b = req.body;
  if (b && typeof b === 'object') return String((b as Record<string, unknown>)[TOKEN_PARAM] ?? '');
  const raw = typeof b === 'string' ? (b.length > MAX_HANDOFF_BODY ? '' : b) : await readBody(req);
  return new URLSearchParams(raw).get(TOKEN_PARAM) ?? '';
}

function setSessionCookie(res: ServerResponse, value: string, secure: boolean, maxAge?: number) {
  const parts = [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (secure) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);

  const prev = res.getHeader('Set-Cookie');
  const list = prev === undefined ? [] : Array.isArray(prev) ? prev.map(String) : [String(prev)];
  res.setHeader('Set-Cookie', [...list, parts.join('; ')]);
}

function redirect(res: ServerResponse, status: number, url: string) {
  res.setHeader('Location', url);
  res.writeHead(status);
  res.end();
}

async function adoptToken(appId: string, req: StackureRequest, res: ServerResponse): Promise<boolean> {
  const token = await handoffToken(req);
  if (!token) return false;
  const session = await validateToken(appId, token, req).catch(() => undefined);
  if (!session?.authenticated) return false;

  setSessionCookie(res, token, isHttps(req), SESSION_MAX_AGE);

  const u = reqUrl(req);
  redirect(res, 303, /^\/(?![\/\\])/.test(u) ? u : '/');
  return true;
}

/**
 * Middleware that enforces authentication, and completes Stackure's sign-in
 * handoff by validating the POSTed `session_token` (an app-scoped session
 * token valid only for this app) and storing it as a cookie on your domain.
 *
 * On success the user is attached to `req.user` (see `userFromRequest`).
 * Browser requests (Accept: text/html) redirect to sign-in on 401; API
 * requests get JSON.
 *
 * @example
 * ```typescript
 * app.get('/admin', auth(appId, 'can_approve_invoice'), (req, res) => {
 *   res.json({ user: userFromRequest(req) });
 * });
 * ```
 */
export function auth(appId: string, ...permissions: string[]) {
  return async (req: StackureRequest, res: ServerResponse, next: Next): Promise<void> => {
    if (await adoptToken(appId, req, res)) return;

    const result = await verify(appId, req, ...permissions);
    const err = result.error;

    if (!result.authenticated && err) {
      const accept = String(req.headers['accept'] ?? '');
      if (
        err.code === 401 &&
        accept.includes('text/html') &&
        !accept.includes('application/json') &&
        err.sign_in_url
      ) {
        redirect(res, 302, err.sign_in_url);
        return;
      }

      const label = err.code === 401 ? 'Unauthorized' : err.code === 403 ? 'Forbidden' : 'Error';
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(err.code);
      res.end(
        JSON.stringify({
          error: label,
          message: err.message,
          sign_in_url: err.sign_in_url ?? '',
        }),
      );
      return;
    }

    req.user = result.user;
    next();
  };
}

/**
 * Clear the app's session cookie and redirect to Stackure's sign-out, which
 * revokes the session.
 *
 * @example
 * ```typescript
 * app.get('/logout', (req, res) => logout(req, res));
 * ```
 */
export function logout(req: IncomingMessage, res: ServerResponse): void {
  setSessionCookie(res, '', isHttps(req), 0);
  redirect(res, 303, baseUrl() + '/signout');
}
