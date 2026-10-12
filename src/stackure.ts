import type { IncomingMessage } from 'node:http';
import { StackureError } from './errors.js';
import { isUUID, validateEmail } from './validation.js';

const DEFAULT_BASE_URL = 'https://stackure.com';
const REQUEST_TIMEOUT_MS = 2000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 500;

export const SESSION_COOKIE = 'session';
export const TOKEN_PARAM = 'session_token';

export function origin(): string {
  return new URL(baseUrl()).origin;
}

export function baseUrl(): string {
  const v = process.env['STACKURE_BASE_URL'];
  return v ? v.replace(/\/+$/, '') : DEFAULT_BASE_URL;
}

export function appSecret(): string {
  const v = process.env['STACKURE_APP_SECRET'];
  if (!v) throw new StackureError('validation', 'STACKURE_APP_SECRET is not set');
  return v;
}

export function appId(): string {
  const v = process.env['STACKURE_APP_ID'];
  if (!v) throw new StackureError('validation', 'STACKURE_APP_ID is not set');
  if (!isUUID(v)) throw new StackureError('validation', 'invalid STACKURE_APP_ID format (must be a valid UUID)');
  return v;
}

/** An authenticated Stackure user. */
export interface User {
  user_id: string;
  account_id: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  /** Whether the user is an app admin or owner in their Stackure org, in charge of its apps */
  user_is_app_admin: boolean;
  /** The Stackure teams the user belongs to in their org, empty when none */
  user_teams: Team[];
}

/** A Stackure team. */
export interface Team {
  team_id: string;
  team_name: string;
}

/** A user listed by `directoryUsers()`. */
export interface DirectoryUser {
  user_id: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
}

/** Options for `directoryUsers()` and `directoryTeams()`. */
export interface DirectoryOptions {
  /** Search text, matching a user's name, email and job title, or a team's name */
  query?: string;
  /** `nextCursor` from the previous page */
  cursor?: string;
  /** Page size: 100 by default, 200 at most */
  limit?: number;
  /** Only these IDs that can open the app, up to 200, to check or name people and teams you already store */
  ids?: string[];
}

/** One page from `directoryUsers()` or `directoryTeams()`, sorted by name. */
export interface DirectoryPage<T> {
  items: T[];
  /** Pass as `cursor` to get the next page; absent on the last one */
  nextCursor?: string;
  /** Total matches, on the first page when there are 10,000 or fewer */
  total?: number;
}

/** Successful `sendMagicLink()` response. */
export interface MagicLinkResponse {
  message: string;
}

/** Why a `verify()` call did not authenticate. */
export interface VerifyError {
  /** HTTP status code: 401 or 500 */
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
  query?: Record<string, string> | string[][];
  token?: string;
  bearer?: string;
  credential?: string;
  ignoreBody?: boolean;
  redirect?: 'manual';
  ua?: string;
  ip?: string;
  seen?: (h: Headers) => void;
}

async function request<T>(method: string, path: string, o: CallOpts = {}): Promise<T> {
  const url = baseUrl() + path + (o.query ? '?' + new URLSearchParams(o.query) : '');
  const headers: Record<string, string> = o.bearer
    ? { Authorization: `Bearer ${o.bearer}` }
    : { 'X-App-Secret': appSecret() };
  if (o.credential) headers['Authorization'] = `Bearer ${o.credential}`;
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  if (o.ua) headers['User-Agent'] = o.ua;
  if (o.ip) headers['X-Forwarded-For'] = o.ip;
  if (o.token) headers['Cookie'] = `${SESSION_COOKIE}=${o.token}`;
  const body = o.body === undefined ? undefined : JSON.stringify(o.body);

  const start = Date.now();
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const timeout = () => new StackureError('timeout', `request timed out after ${REQUEST_TIMEOUT_MS}ms`);
  const canRetry = (attempt: number) =>
    attempt < MAX_RETRIES && Date.now() - start + RETRY_DELAY_MS < REQUEST_TIMEOUT_MS;

  let last: StackureError | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        ...(body !== undefined && { body }),
        redirect: o.redirect ?? 'follow',
        signal,
      });
    } catch (e) {
      if (signal.aborted) throw timeout();
      last = new StackureError(
        'network',
        `network request failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      if (canRetry(attempt)) continue;
      throw last;
    }

    o.seen?.(res.headers);
    if (res.status >= 500 && canRetry(attempt)) {
      last = new StackureError('network', `server error (${res.status})`, res.status);
      continue;
    }
    if (o.ignoreBody) {
      res.body?.cancel().catch(() => {});
      return (res.ok ? undefined : handleResponse(res, '')) as T;
    }
    let text: string;
    try {
      text = await res.text();
    } catch {
      if (signal.aborted) throw timeout();
      last = new StackureError('network', 'failed to read response body', res.status);
      if (canRetry(attempt)) continue;
      throw last;
    }
    return handleResponse<T>(res, text);
  }

  throw last ?? new StackureError('network', 'request failed after retries');
}

function handleResponse<T>(res: Response, text: string): T {
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

export function cookie(req: IncomingMessage, name: string): string {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      const v = part.slice(i + 1).trim();
      return v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v;
    }
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
  return cookie(req, SESSION_COOKIE);
}

export function bearerToken(req: IncomingMessage): string {
  return /^Bearer +(.+)$/i.exec(req.headers.authorization ?? '')?.[1] ?? '';
}

/**
 * Send a passwordless sign-in email.
 *
 * @example
 * ```typescript
 * const { message } = await sendMagicLink('user@example.com');
 * ```
 */
export async function sendMagicLink(email: string): Promise<MagicLinkResponse> {
  validateEmail(email);
  return request<MagicLinkResponse>('POST', '/api/public/auth/magic-link/send', {
    body: { user_email: email, app_id: appId() },
  });
}

/**
 * Validate the request's session against Stackure. Throws `StackureError`.
 * A request without a well-formed session token gets the sign-in URL
 * without a Stackure call.
 *
 * Most callers want `verify()` or `auth()` instead.
 */
export async function validateSession(req: IncomingMessage): Promise<Session> {
  return validateToken(sessionToken(req), req);
}

export async function validateToken(token: string, req: IncomingMessage): Promise<Session> {
  const id = appId();

  if (!isUUID(token)) {
    return { authenticated: false, sign_in_url: `${baseUrl()}/sign-in/magic-link?app_id=${id}` };
  }

  return withFacts(await getWithSession<Session>('/api/public/auth/session/validate', { app_id: id }, token, req));
}

/**
 * List the users in the caller's Stackure org who can open the app, one page
 * at a time, for pickers and sharing. Authenticated by the request's session
 * cookie, so call it from a route behind `auth()`; MCP bearer tokens are not
 * accepted. Throws `StackureError`, with code `auth` when there is no valid
 * session.
 *
 * @example
 * ```typescript
 * const { items, nextCursor, total } = await directoryUsers(req, { query: 'ada' });
 * const next = nextCursor && (await directoryUsers(req, { query: 'ada', cursor: nextCursor }));
 * ```
 */
export function directoryUsers(req: IncomingMessage, opts: DirectoryOptions = {}): Promise<DirectoryPage<DirectoryUser>> {
  return directory('/api/public/directory/users', req, opts);
}

/**
 * List the teams in the caller's Stackure org that have the app, one page at a
 * time: every team when the app is available to everyone, otherwise the teams
 * it's shared with. Authenticated like `directoryUsers()`.
 *
 * @example
 * ```typescript
 * const { items } = await directoryTeams(req, { limit: 50 });
 * ```
 */
export function directoryTeams(req: IncomingMessage, opts: DirectoryOptions = {}): Promise<DirectoryPage<Team>> {
  return directory('/api/public/directory/teams', req, opts);
}

async function directory<T>(path: string, req: IncomingMessage, o: DirectoryOptions): Promise<DirectoryPage<T>> {
  const query = [['app_id', appId()]];
  const token = sessionToken(req);
  if (!isUUID(token)) throw new StackureError('auth', 'invalid session');
  if (o.query) query.push(['q', o.query]);
  if (o.cursor) query.push(['cursor', o.cursor]);
  if (o.limit !== undefined) query.push(['limit', String(o.limit)]);
  for (const id of o.ids ?? []) query.push(['id', id]);
  const h = new Headers();
  const page: DirectoryPage<T> = {
    items: await getWithSession<T[]>(path, query, token, req, (r) => r.forEach((v, k) => h.set(k, v))),
  };
  const next = h.get('X-Next-Cursor');
  const total = h.get('X-Total-Count');
  if (next) page.nextCursor = next;
  if (total && /^\d+$/.test(total)) page.total = Number(total);
  return page;
}

function getWithSession<T>(
  path: string,
  query: Record<string, string> | string[][],
  token: string,
  req: IncomingMessage,
  seen?: (h: Headers) => void,
): Promise<T> {
  return request<T>('GET', path, {
    query,
    ua: req.headers['user-agent'] ?? '',
    ip: clientIp(req),
    token,
    ...(seen && { seen }),
  });
}

function withFacts<T extends Session>(s: T): T {
  if (s.user) {
    s.user.user_is_app_admin ??= false;
    s.user.user_teams ??= [];
  }
  return s;
}

export interface McpSession extends Session {
  www_authenticate?: string;
}

export async function validateMcp(token: string, mcp: string, req: IncomingMessage): Promise<McpSession> {
  return withFacts(
    await request<McpSession>('GET', '/api/public/auth/session/validate', {
      query: { app_id: appId(), mcp },
      ua: req.headers['user-agent'] ?? '',
      ip: clientIp(req),
      credential: isUUID(token) ? token : '',
    }),
  );
}

export async function signOut(token: string, req: IncomingMessage): Promise<void> {
  return request<void>('POST', '/api/public/auth/sign-out', {
    bearer: token,
    ignoreBody: true,
    redirect: 'manual',
    ua: req.headers['user-agent'] ?? '',
    ip: clientIp(req),
  });
}
