import type { IncomingMessage } from 'node:http';
import { StackureError } from './errors.js';
import { isUUID, validateEmail, validateUUID } from './validation.js';

const DEFAULT_BASE_URL = 'https://stackure.com';
const REQUEST_TIMEOUT_MS = 2000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 500;

export const SESSION_COOKIE = 'session';
export const TOKEN_PARAM = 'session_token';

export function baseUrl(): string {
  const v = process.env['STACKURE_BASE_URL'];
  return v ? v.replace(/\/+$/, '') : DEFAULT_BASE_URL;
}

/** An authenticated Stackure user. */
export interface User {
  user_id: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  user_permissions: string[];
}

/** Successful `sendMagicLink()` response. */
export interface MagicLinkResponse {
  message: string;
}

/** Why a `verify()` call did not authenticate. */
export interface VerifyError {
  /** HTTP status code: 401, 403, or 500 */
  code: number;
  message: string;
  /** Where to send an unauthenticated browser to sign in */
  sign_in_url?: string | undefined;
}

/** Outcome of a `verify()` call. */
export interface VerifyResult {
  authenticated: boolean;
  user?: User;
  error?: VerifyError;
}

/** Raw `validateSession()` response. */
export interface Session {
  authenticated: boolean;
  user?: User;
  sign_in_url?: string;
}

interface CallOpts {
  body?: unknown;
  query?: Record<string, string>;
  token?: string;
  ua?: string;
  ip?: string;
}

async function request<T>(method: string, path: string, o: CallOpts = {}): Promise<T> {
  const url = baseUrl() + path + (o.query ? '?' + new URLSearchParams(o.query) : '');
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  if (o.ua) headers['User-Agent'] = o.ua;
  if (o.ip) headers['X-Forwarded-For'] = o.ip;
  if (o.token) headers['Cookie'] = `${SESSION_COOKIE}=${o.token}`;
  const body = o.body === undefined ? undefined : JSON.stringify(o.body);

  let last: StackureError | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        ...(body !== undefined && { body }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      if ((e as { name?: string }).name === 'TimeoutError') {
        throw new StackureError('timeout', `request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      last = new StackureError(
        'network',
        `network request failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    if (res.status >= 500 && attempt < MAX_RETRIES) {
      last = new StackureError('network', `server error (${res.status})`, res.status);
      continue;
    }
    return handleResponse<T>(res);
  }

  throw last ?? new StackureError('network', 'request failed after retries');
}

async function handleResponse<T>(res: Response): Promise<T> {
  let text: string;
  try {
    text = await res.text();
  } catch {
    throw new StackureError('network', 'failed to read response body', res.status);
  }

  if (!res.ok) {
    const t = text || 'unknown error';
    if (res.status === 401) throw new StackureError('auth', t, 401);
    if (res.status === 403) throw new StackureError('forbidden', t, 403);
    throw new StackureError('network', `api error (${res.status}): ${t}`, res.status);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new StackureError('network', 'invalid JSON response from server', res.status);
  }
}

export function reqUrl(req: IncomingMessage): string {
  return (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '/';
}

export function queryParam(req: IncomingMessage, name: string): string {
  const url = reqUrl(req);
  const i = url.indexOf('?');
  return i < 0 ? '' : (new URLSearchParams(url.slice(i + 1)).get(name) ?? '');
}

export function cookie(req: IncomingMessage, name: string): string {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd;
  if (first) return first.split(',')[0]!.trim();
  return req.socket?.remoteAddress ?? '';
}

export function sessionToken(req: IncomingMessage): string {
  return queryParam(req, TOKEN_PARAM) || cookie(req, SESSION_COOKIE);
}

/**
 * Send a passwordless sign-in email.
 *
 * @example
 * ```typescript
 * const { message } = await sendMagicLink('user@example.com', appId);
 * ```
 */
export async function sendMagicLink(email: string, appId?: string): Promise<MagicLinkResponse> {
  validateEmail(email);

  const body: Record<string, string> = { user_email: email };
  if (appId) {
    validateUUID(appId, 'App ID');
    body['app_id'] = appId;
  }

  return request<MagicLinkResponse>('POST', '/api/public/auth/magic-link/send', { body });
}

/**
 * Validate the request's session against Stackure. Throws `StackureError`.
 * A request without a well-formed session token gets the sign-in URL
 * without a Stackure call.
 *
 * Most callers want `verify()` or `auth()` instead.
 */
export async function validateSession(appId: string, req: IncomingMessage): Promise<Session> {
  validateUUID(appId, 'App ID');

  const token = sessionToken(req);
  if (!isUUID(token)) {
    return { authenticated: false, sign_in_url: `${baseUrl()}/sign-in/magic-link?app_id=${appId}` };
  }

  return request<Session>('GET', '/api/public/auth/session/validate', {
    query: { app_id: appId },
    ua: req.headers['user-agent'] ?? '',
    ip: clientIp(req),
    token,
  });
}
