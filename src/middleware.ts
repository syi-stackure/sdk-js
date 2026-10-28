import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TLSSocket } from 'node:tls';
import { StackureError } from './errors.js';
import {
  CODE_COOKIE,
  CODE_PARAM,
  SESSION_COOKIE,
  TOKEN_PARAM,
  VERIFIER_COOKIE,
  baseUrl,
  bearerToken,
  cookie,
  exchangeCode,
  isLoopback,
  reqUrl,
  sessionToken,
  signOut,
  validateMcp,
  validateToken,
  origin,
} from './stackure.js';
import type { DevSignIn, Session, User, VerifyResult } from './stackure.js';
import { isUUID } from './validation.js';

/** Request shape the middleware reads from and attaches the user to. */
export interface StackureRequest extends IncomingMessage {
  user?: User | undefined;
  body?: unknown;
  originalUrl?: string;
}

type Next = (err?: unknown) => void;

/** The user attached by `auth()` or `mcp()`, or undefined if the request was not authenticated. */
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
 * const result = await verify(req);
 * if (!result.authenticated) return res.status(result.error!.code).json(result.error);
 * ```
 */
export async function verify(req: IncomingMessage): Promise<VerifyResult> {
  return check(req);
}

async function check(req: IncomingMessage, dev?: DevSignIn): Promise<VerifyResult> {
  let session: Session;
  try {
    session = await validateToken(sessionToken(req), req, dev);
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

  return { authenticated: true, user };
}

function headerLines(req: IncomingMessage, name: string): number {
  return req.rawHeaders.filter((h, i) => i % 2 === 0 && h.toLowerCase() === name).length;
}

function sameOriginPost(req: IncomingMessage): boolean {
  if (req.method !== 'POST') return false;
  if (['sec-fetch-site', 'origin', 'host'].some((h) => headerLines(req, h) > 1)) return false;
  const site = req.headers['sec-fetch-site'];
  if (site !== undefined) return site === 'same-origin';
  const m = /^([a-z][a-z\d+.-]*):\/\/([^/]+)$/i.exec(req.headers.origin ?? '');
  if (!m || (isHttps(req) && m[1]!.toLowerCase() !== 'https')) return false;
  return m[2]!.toLowerCase() === (req.headers.host ?? '').toLowerCase();
}

const MAX_HANDOFF_BODY = 4096;
const SESSION_MAX_AGE = 7 * 24 * 3600;
const CODE_MAX_AGE = 60;
const VERIFIER_MAX_AGE = 15 * 60;

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size <= MAX_HANDOFF_BODY) chunks.push(c as Buffer);
  }
  return size > MAX_HANDOFF_BODY ? '' : Buffer.concat(chunks).toString();
}

async function formField(req: StackureRequest, field: string, origins: string[]): Promise<string> {
  if (req.method !== 'POST') return '';
  if (!origins.includes(String(req.headers['origin'] ?? ''))) return '';
  if (!String(req.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded')) {
    return '';
  }

  const b = req.body;
  if (b && typeof b === 'object') return String((b as Record<string, unknown>)[field] ?? '');
  if (typeof b !== 'string') req.body = await readBody(req);
  const raw = String(req.body);
  return raw.length > MAX_HANDOFF_BODY ? '' : (new URLSearchParams(raw).get(field) ?? '');
}

function setCookie(res: ServerResponse, name: string, value: string, secure: boolean, maxAge?: number) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
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

function here(req: IncomingMessage): string {
  const u = reqUrl(req);
  return /^\/(?![\/\\])/.test(u) ? u : '/';
}

async function adoptToken(req: StackureRequest, res: ServerResponse): Promise<boolean> {
  const token = await formField(req, TOKEN_PARAM, [origin()]);
  if (!token) return false;
  const session = await validateToken(token, req).catch(() => undefined);
  if (!session?.authenticated) return false;

  setCookie(res, SESSION_COOKIE, token, isHttps(req), SESSION_MAX_AGE);
  redirect(res, 303, here(req));
  return true;
}

function devSignIn(req: IncomingMessage, verifier: string): DevSignIn {
  return {
    url: `${isHttps(req) ? 'https' : 'http'}://${req.headers.host}${here(req)}`,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
}

async function stashCode(req: StackureRequest, res: ServerResponse): Promise<boolean> {
  const code = await formField(req, CODE_PARAM, ['null', origin()]);
  if (!/^[0-9a-f]{64}$/.test(code)) return false;

  setCookie(res, CODE_COOKIE, code, isHttps(req), CODE_MAX_AGE);
  redirect(res, 303, here(req));
  return true;
}

async function redeemCode(req: StackureRequest, res: ServerResponse): Promise<boolean> {
  const code = cookie(req, CODE_COOKIE);
  if (!code) return false;
  const secure = isHttps(req);
  setCookie(res, CODE_COOKIE, '', secure, 0);
  setCookie(res, VERIFIER_COOKIE, '', secure, 0);

  const token = await exchangeCode(code, cookie(req, VERIFIER_COOKIE), req).catch((e: unknown) => {
    console.error('stackure: localhost sign-in failed:', e instanceof Error ? e.message : String(e));
    return '';
  });
  if (!token) {
    deny(res, 401, 'localhost sign-in failed, reload to try again');
    return true;
  }

  setCookie(res, SESSION_COOKIE, token, secure, SESSION_MAX_AGE);
  redirect(res, 303, here(req));
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
 * On localhost or 127.0.0.1 with the app's development secret, sign-in
 * returns to the page that asked for it: Stackure posts a one-time code
 * there, and the middleware swaps it for a session using the secret and a
 * check value it keeps in a cookie. Only app admins of the organization that
 * added the app can sign in this way.
 *
 * @example
 * ```typescript
 * app.get('/admin', auth(), (req, res) => {
 *   res.json({ user: userFromRequest(req) });
 * });
 * ```
 */
export function auth() {
  return async (req: StackureRequest, res: ServerResponse, next: Next): Promise<void> => {
    if (await adoptToken(req, res)) return;

    const local = isLoopback(req);
    if (local && ((await stashCode(req, res)) || (await redeemCode(req, res)))) return;

    const verifier = local ? randomBytes(32).toString('base64url') : '';
    const result = await check(req, local ? devSignIn(req, verifier) : undefined);
    const err = result.error;

    if (!result.authenticated && err) {
      const accept = String(req.headers['accept'] ?? '');
      if (
        err.code === 401 &&
        accept.includes('text/html') &&
        !accept.includes('application/json') &&
        err.sign_in_url
      ) {
        if (local) setCookie(res, VERIFIER_COOKIE, verifier, isHttps(req), VERIFIER_MAX_AGE);
        redirect(res, 302, err.sign_in_url);
        return;
      }

      const label = err.code === 401 ? 'Unauthorized' : 'Error';
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

function deny(res: ServerResponse, status: number, error: string) {
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(status);
  res.end(JSON.stringify({ error }));
}

/**
 * Middleware that protects an MCP endpoint. AI clients (Claude, Claude Code,
 * VS Code, Cursor) sign users in through Stackure and send the credential as
 * `Authorization: Bearer`. Every MCP request is checked against Stackure in
 * real time with the same app secret; cookies are ignored.
 *
 * On success the user is attached to `req.user` (see `userFromRequest`).
 * A request that is not signed in gets a 401 whose `WWW-Authenticate` header
 * tells the AI client where to sign in and a failed check gets a 503, both
 * as JSON.
 *
 * The MCP endpoint must be served from the same site as the app's registered
 * URL unless an MCP URL is set for the app in Stackure.
 *
 * @example
 * ```typescript
 * app.all('/mcp', mcp(), (req, res) => {
 *   const user = userFromRequest(req);
 * });
 * ```
 */
export function mcp() {
  return async (req: StackureRequest, res: ServerResponse, next: Next): Promise<void> => {
    const path = reqUrl(req).split(/[?#]/)[0];
    const url = `${isHttps(req) ? 'https' : 'http'}://${req.headers.host ?? ''}${path}`;
    const session = await validateMcp(bearerToken(req), url, req).catch((e: unknown) => {
      const why = e instanceof StackureError ? `${e.code} ${e.statusCode ?? ''}`.trim() : 'unknown';
      console.error('stackure: mcp verification error:', why);
    });
    if (!session) return deny(res, 503, 'unavailable');

    const user = session.user;
    if (!session.authenticated || !user) {
      res.setHeader('WWW-Authenticate', session.www_authenticate || 'Bearer');
      return deny(res, 401, 'unauthorized');
    }

    req.user = user;
    next();
  };
}

/**
 * Sign the user out everywhere. Returns a promise (`Promise<void>`) that
 * resolves once the response is handled.
 *
 * Mount it for every method on the sign-out path. Trigger it with a form or
 * button that POSTs from the app's own page; a link or any other request is
 * sent to Stackure's sign-out page, where the user confirms.
 *
 * A same-origin POST signs the user out through Stackure's API, clears the
 * app's session cookie and redirects to Stackure. If the API call fails, the
 * redirect goes to Stackure's sign-out page, where the user can finish
 * signing out.
 *
 * @example
 * ```typescript
 * app.all('/logout', (req, res) => logout(req, res));
 * ```
 */
export async function logout(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (res.headersSent) return;
  if (!sameOriginPost(req)) {
    redirect(res, 303, baseUrl() + '/signout');
    return;
  }

  const token = sessionToken(req);
  const ok = !isUUID(token) || (await signOut(token, req).then(() => true, () => false));
  if (res.headersSent) return;

  setCookie(res, SESSION_COOKIE, '', isHttps(req), 0);
  redirect(res, 303, baseUrl() + (ok ? '/' : '/signout'));
}
