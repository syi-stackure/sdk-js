import { StackureError } from './errors.js';
import { isLoopbackHost, isUUID } from './validation.js';

export const REQUEST_TIMEOUT_MS = 2000;
export const MAX_RETRIES = 1;
export const RETRY_DELAY_MS = 500;
export const MAX_EVENTS = 100;
export const MAX_HANDOFF_BODY = 4096;

export const SESSION_COOKIE = 'stackure_session';
export const PLATFORM_COOKIE = 'session';
export const CODE_COOKIE = 'stackure_code';
export const VERIFIER_COOKIE = 'stackure_verifier';
export const TOKEN_PARAM = 'session_token';
export const CODE_PARAM = 'stackure_code';
export const SESSION_MAX_AGE = 7 * 24 * 3600;
export const CODE_MAX_AGE = 60;
export const VERIFIER_MAX_AGE = 15 * 60;
export const VERIFIER_BYTES = 32;

export const MAGIC_LINK_PATH = '/api/public/auth/magic-link/send';
export const VALIDATE_PATH = '/api/public/auth/session/validate';
export const EXCHANGE_PATH = '/api/public/auth/session/exchange';
export const DIRECTORY_USERS_PATH = '/api/public/directory/users';
export const DIRECTORY_TEAMS_PATH = '/api/public/directory/teams';
export const EVENTS_PATH = '/api/public/events';
export const SIGN_OUT_PATH = '/api/public/auth/sign-out';
export const SIGN_IN_PAGE = '/sign-in/magic-link';
export const SIGN_OUT_PAGE = '/signout';
export const HOME_PAGE = '/';

const INVALID_BASE_URL = 'invalid STACKURE_BASE_URL format (must be an https URL, or http on localhost or 127.0.0.1)';

interface Env {
  readonly baseUrl: string;
  readonly baseUrlError: string;
  readonly origin: string;
  readonly appId: string;
  readonly appIdError: string;
  readonly appSecret: string;
  readonly appSecretError: string;
}

let loaded: Env | undefined;

function parsed(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function readBaseUrl(): { baseUrl: string; baseUrlError: string; origin: string } {
  const raw = (process.env['STACKURE_BASE_URL'] ?? '').replace(/\/+$/, '');
  if (!raw) return { baseUrl: '', baseUrlError: 'STACKURE_BASE_URL is not set', origin: '' };
  const u = /^https?:\/\//i.test(raw) && !/[?#]/.test(raw) ? parsed(raw) : undefined;
  const ok =
    u !== undefined &&
    u.hostname !== '' &&
    (u.protocol === 'https:' || (u.protocol === 'http:' && isLoopbackHost(u.host)));
  if (!ok) return { baseUrl: '', baseUrlError: INVALID_BASE_URL, origin: '' };
  return { baseUrl: raw, baseUrlError: '', origin: u.origin };
}

function readEnv(): Env {
  const appId = process.env['STACKURE_APP_ID'] ?? '';
  const appSecret = process.env['STACKURE_APP_SECRET'] ?? '';
  return Object.freeze({
    ...readBaseUrl(),
    appId,
    appIdError: !appId
      ? 'STACKURE_APP_ID is not set'
      : isUUID(appId)
        ? ''
        : 'invalid STACKURE_APP_ID format (must be a valid UUID)',
    appSecret,
    appSecretError: appSecret ? '' : 'STACKURE_APP_SECRET is not set',
  });
}

function env(): Env {
  return (loaded ??= readEnv());
}

export function baseUrl(): string {
  return env().baseUrl;
}

export function requiredBaseUrl(): string {
  const e = env();
  if (e.baseUrlError) throw new StackureError('validation', e.baseUrlError);
  return e.baseUrl;
}

export function origin(): string {
  return env().origin;
}

export function appId(): string {
  const e = env();
  if (e.appIdError) throw new StackureError('validation', e.appIdError);
  return e.appId;
}

export function appSecret(): string {
  const e = env();
  if (e.appSecretError) throw new StackureError('validation', e.appSecretError);
  return e.appSecret;
}

export function configuredAppSecret(): string {
  return env().appSecret;
}
