import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { mcp, userFromRequest, validateSession, verify } from '../dist/index.js';

const APP = '7f3c1a2e-9b4d-4e6f-8a1b-2c3d4e5f6071';
const TOKEN = '3b241101-e2bb-4255-8caf-4136c566a962';
const SECRET = 'test-app-secret-0f6d2c';
const VALIDATE = '/api/public/auth/session/validate';
const CHALLENGE = 'Bearer resource_metadata="https://stackure.example/.well-known/oauth-protected-resource/mcp"';
const SIGN_IN = `https://stackure.example/sign-in/magic-link?app_id=${APP}`;
const USER = {
  user_id: '0d9f8e7c-6b5a-4c3d-9e2f-1a0b9c8d7e6f',
  account_id: '5e4d3c2b-1a0f-4e9d-8c7b-6a5f4e3d2c1b',
  user_email: 'ada@example.com',
  user_first_name: 'Ada',
  user_last_name: 'Lovelace',
  user_permissions: ['can_read', 'can_comment'],
};
const BEARER = { Authorization: `Bearer ${TOKEN}` };
const HTTPS = { 'X-Forwarded-Proto': 'https' };
const UNAUTHORIZED = '{"error":"unauthorized"}';
const FORBIDDEN = '{"error":"forbidden"}';
const UNAVAILABLE = '{"error":"unavailable"}';

const listen = (handler) =>
  new Promise((resolve) => {
    const s = createServer(handler).listen(0, '127.0.0.1', () => resolve(s));
  });
const hostOf = (s) => `127.0.0.1:${s.address().port}`;
const urlOf = (s) => `http://${hostOf(s)}`;
const close = (s) =>
  new Promise((resolve) => {
    s.closeAllConnections();
    s.close(resolve);
  });
const json = (status, body) => (res) =>
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));

let api, app, calls, reply, guard, mount, passed, logged, rejected;

beforeEach(async () => {
  calls = [];
  logged = [];
  passed = [];
  rejected = undefined;
  reply = (res, req) =>
    req.headers.authorization === `Bearer ${TOKEN}`
      ? json(200, { authenticated: true, user: USER })(res)
      : json(200, { authenticated: false, sign_in_url: SIGN_IN, www_authenticate: CHALLENGE })(res);
  guard = mcp();
  mount = () => {};
  for (const m of ['log', 'info', 'warn', 'error', 'debug']) mock.method(console, m, (...a) => logged.push(a.join(' ')));
  api = await listen((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      calls.push({ method: req.method, url: req.url, headers: req.headers, body });
      reply(res, req);
    });
  });
  app = await listen(async (req, res) => {
    try {
      mount(req);
      await guard(req, res, (...a) => {
        passed.push(a);
        json(200, { user: userFromRequest(req) ?? null })(res);
      });
    } catch (e) {
      rejected = e;
      res.destroy();
    }
  });
  process.env.STACKURE_BASE_URL = urlOf(api);
  process.env.STACKURE_APP_ID = APP;
  process.env.STACKURE_APP_SECRET = SECRET;
});

afterEach(async () => {
  mock.restoreAll();
  await close(app);
  await close(api);
});

function send(path, headers = {}, method = 'GET', body = '') {
  return new Promise((resolve, reject) => {
    const fail = (e) => reject(rejected ?? e);
    const opts = { method, agent: false, headers: { Host: hostOf(app), 'User-Agent': 'test-client', ...headers } };
    const r = request(urlOf(app) + path, opts, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('error', fail);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text }));
    });
    r.on('error', fail);
    r.setTimeout(5000, () => r.destroy(new Error('mcp did not respond')));
    r.end(body);
  });
}

async function run(path, headers, method, body) {
  const out = await send(path, headers, method, body);
  for (const s of [TOKEN, SECRET]) assert.ok(!JSON.stringify([out, logged]).includes(s));
  assert.equal(out.headers['set-cookie'], undefined);
  assert.equal(out.headers.location, undefined);
  return out;
}

function validated(c, url, bearer) {
  assert.equal(c.method, 'GET');
  assert.equal(c.url, `${VALIDATE}?app_id=${APP}&mcp=${encodeURIComponent(url)}`);
  assert.deepEqual([...new URL(c.url, urlOf(api)).searchParams], [['app_id', APP], ['mcp', url]]);
  assert.equal(c.headers['x-app-secret'], SECRET);
  assert.equal(c.headers.authorization, bearer ? `Bearer ${TOKEN}` : undefined);
  assert.equal(c.headers.cookie, undefined);
  assert.equal(c.headers['user-agent'], 'test-client');
  assert.equal(c.body, '');
}

function once(url, bearer) {
  assert.equal(calls.length, 1);
  validated(calls[0], url, bearer);
}

function attached(out) {
  assert.equal(out.status, 200);
  assert.deepEqual(JSON.parse(out.body), { user: USER });
  assert.deepEqual(passed, [[]]);
  assert.equal(out.headers['www-authenticate'], undefined);
  assert.deepEqual(logged, []);
}

function denied(out, status, body, challenge) {
  assert.equal(out.status, status);
  assert.equal(out.headers['content-type'], 'application/json');
  assert.equal(out.body, body);
  assert.equal(out.headers['www-authenticate'], challenge);
  assert.deepEqual(passed, []);
}

const here = (path = '/mcp', scheme = 'http') => `${scheme}://${hostOf(app)}${path}`;

test('valid bearer: validates with the mcp URL, the app secret and the bearer, no cookie, attaches the user', async () => {
  const out = await run('/mcp', { ...BEARER, Cookie: 'other=1; session=9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f' });
  once(here(), true);
  assert.equal(calls[0].url, `${VALIDATE}?app_id=${APP}&mcp=http%3A%2F%2F127.0.0.1%3A${app.address().port}%2Fmcp`);
  attached(out);
});

for (const scheme of ['bearer', 'BEARER', 'bEaReR']) {
  test(`valid bearer with the scheme written ${scheme}: sent, attaches the user`, async () => {
    const out = await run('/mcp', { Authorization: `${scheme} ${TOKEN}` });
    once(here(), true);
    attached(out);
  });
}

for (const [name, headers] of [
  ['no Authorization header', {}],
  ['a malformed token', { Authorization: 'Bearer not-a-token' }],
  ['a token that is not a v4 UUID', { Authorization: 'Bearer 3b241101-e2bb-1255-8caf-4136c566a962' }],
  ['a token followed by more text', { Authorization: `Bearer ${TOKEN} extra` }],
  ['a token with no space after the scheme', { Authorization: `Bearer${TOKEN}` }],
  ['a scheme and no token', { Authorization: 'Bearer' }],
  ['a token and no scheme', { Authorization: TOKEN }],
  ['a token under the Basic scheme', { Authorization: `Basic ${TOKEN}` }],
  ['a session cookie and no bearer', { Cookie: `session=${TOKEN}` }],
  ['a session cookie and a malformed token', { Cookie: `session=${TOKEN}`, Authorization: 'Bearer not-a-token' }],
  ['no bearer on a browser request', { Accept: 'text/html', Cookie: `session=${TOKEN}` }],
]) {
  test(`${name}: validates without Authorization or cookie, 401 with the www_authenticate value`, async () => {
    const out = await run('/mcp', headers);
    once(here(), false);
    denied(out, 401, UNAUTHORIZED, CHALLENGE);
    assert.deepEqual(logged, []);
  });
}

test('sign-in handoff POST with a session_token: body ignored, no cookie set, 401', async () => {
  const form = { Origin: urlOf(api), 'Content-Type': 'application/x-www-form-urlencoded' };
  const out = await run('/mcp', form, 'POST', `session_token=${TOKEN}`);
  once(here(), false);
  denied(out, 401, UNAUTHORIZED, CHALLENGE);
});

for (const [name, body, challenge] of [
  ['without www_authenticate', { authenticated: false, sign_in_url: SIGN_IN }, 'Bearer'],
  ['with an empty www_authenticate', { authenticated: false, sign_in_url: SIGN_IN, www_authenticate: '' }, 'Bearer'],
  ['authenticated without a user', { authenticated: true }, 'Bearer'],
  ['not authenticated with a user', { authenticated: false, user: USER, www_authenticate: CHALLENGE }, CHALLENGE],
]) {
  test(`validate response ${name}: 401 with WWW-Authenticate ${challenge === CHALLENGE ? 'as sent' : challenge}`, async () => {
    reply = json(200, body);
    const out = await run('/mcp', BEARER);
    once(here(), true);
    denied(out, 401, UNAUTHORIZED, challenge);
  });
}

for (const [name, perms, user] of [
  ['without the required permission', ['can_approve_invoice'], USER],
  ['without any of the required permissions', ['can_approve_invoice', 'can_delete'], USER],
  ['with no permissions at all', ['can_read'], { ...USER, user_permissions: undefined }],
]) {
  test(`authenticated ${name}: 403, user not attached`, async () => {
    reply = json(200, { authenticated: true, user });
    guard = mcp(...perms);
    const out = await run('/mcp', BEARER);
    once(here(), true);
    denied(out, 403, FORBIDDEN, undefined);
    assert.deepEqual(logged, []);
  });
}

for (const [name, perms] of [
  ['the required permission', ['can_comment']],
  ['one of the required permissions', ['can_approve_invoice', 'can_read']],
]) {
  test(`authenticated with ${name}: attaches the user`, async () => {
    guard = mcp(...perms);
    const out = await run('/mcp', BEARER);
    once(here(), true);
    attached(out);
  });
}

test('not authenticated on a route with a required permission: 401, not 403', async () => {
  guard = mcp('can_read');
  const out = await run('/mcp');
  once(here(), false);
  denied(out, 401, UNAUTHORIZED, CHALLENGE);
});

for (const [name, fail, sent, why] of [
  ['400', () => (reply = json(400, { error: 'bad request' })), 1, 'network 400'],
  ['401 invalid app secret', () => (reply = json(401, { error: 'invalid app secret' })), 1, 'auth 401'],
  ['403', () => (reply = json(403, { error: 'forbidden' })), 1, 'forbidden 403'],
  ['429', () => (reply = json(429, { error: 'rate limited' })), 1, 'network 429'],
  ['500', () => (reply = json(500, { error: 'internal' })), 2, 'network 500'],
  ['200 with a non-JSON body', () => (reply = (res) => res.writeHead(200).end('ok')), 1, 'network 200'],
  ['timeout', () => (reply = () => {}), 1, 'timeout'],
  ['network error', () => close(api), 0, 'network'],
  ['no app secret configured', () => delete process.env.STACKURE_APP_SECRET, 0, 'validation'],
  ['no app id configured', () => delete process.env.STACKURE_APP_ID, 0, 'validation'],
  ['app id that is not a UUID', () => (process.env.STACKURE_APP_ID = 'not-an-app-id'), 0, 'validation'],
]) {
  test(`validate failure (${name}): 503, user not attached`, async () => {
    const url = here();
    await fail();
    const out = await run('/mcp', BEARER);
    denied(out, 503, UNAVAILABLE, undefined);
    assert.equal(calls.length, sent);
    calls.forEach((c) => validated(c, url, true));
    assert.deepEqual(logged, [`stackure: mcp verification error: ${why}`]);
  });
}

test('verify and validateSession with no app id configured: 500 result and validation error, no request', async () => {
  delete process.env.STACKURE_APP_ID;
  const req = { headers: { cookie: `session=${TOKEN}` } };
  assert.deepEqual(await verify(req, 'can_read'), {
    authenticated: false,
    error: { code: 500, message: 'Authentication verification failed' },
  });
  await assert.rejects(validateSession(req), { code: 'validation', message: 'STACKURE_APP_ID is not set' });
  assert.equal(calls.length, 0);
  assert.deepEqual(logged, ['stackure: verification error: STACKURE_APP_ID is not set']);
});

test('validate failure without a bearer: 503, not 401', async () => {
  reply = json(500, { error: 'internal', www_authenticate: CHALLENGE });
  const out = await run('/mcp');
  denied(out, 503, UNAVAILABLE, undefined);
  assert.equal(calls.length, 2);
  calls.forEach((c) => validated(c, here(), false));
});

for (const [name, headers, scheme] of [
  ['X-Forwarded-Proto https', HTTPS, 'https'],
  ['X-Forwarded-Proto HTTPS', { 'X-Forwarded-Proto': 'HTTPS' }, 'https'],
  ['X-Forwarded-Proto http', { 'X-Forwarded-Proto': 'http' }, 'http'],
  ['no X-Forwarded-Proto', {}, 'http'],
]) {
  test(`${name}: the mcp URL is ${scheme}`, async () => {
    attached(await run('/mcp', { ...BEARER, ...headers }));
    once(here('/mcp', scheme), true);
    await run('/mcp', headers);
    assert.equal(calls.length, 2);
    validated(calls[1], here('/mcp', scheme), false);
  });
}

for (const [name, path, want] of [
  ['a nested path', '/mcp/v1/messages', '/mcp/v1/messages'],
  ['the root path', '/', '/'],
  ['a trailing slash', '/mcp/', '/mcp/'],
  ['a query string', '/mcp?session=abc&x=1', '/mcp'],
  ['a nested path and a query string', '/mcp/v1/messages?session=abc', '/mcp/v1/messages'],
  ['an empty query string', '/mcp?', '/mcp'],
  ['a query string holding a URL', '/mcp?next=http://evil.example/x?y', '/mcp'],
  ['an encoded path and a query string', '/mcp%20x/a%2Fb%3Fc?q=1', '/mcp%20x/a%2Fb%3Fc'],
]) {
  test(`request to ${name}: the mcp URL holds the path and no query string`, async () => {
    attached(await run(path, BEARER));
    once(here(want), true);
  });
}

test('request with another Host header: the mcp URL uses it', async () => {
  attached(await run('/mcp?x=1', { ...BEARER, ...HTTPS, Host: 'app.example.com:8443' }));
  assert.equal(calls.length, 1);
  validated(calls[0], 'https://app.example.com:8443/mcp', true);
});

test('mounted under a prefix: the mcp URL uses the original path', async () => {
  mount = (req) => {
    req.originalUrl = req.url;
    req.url = req.url.slice('/mcp'.length);
  };
  attached(await run('/mcp/messages?x=1', BEARER));
  once(here('/mcp/messages'), true);
});
