import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { logout } from '../dist/index.js';

const APP = '7f3c1a2e-9b4d-4e6f-8a1b-2c3d4e5f6071';
const TOKEN = '3b241101-e2bb-4255-8caf-4136c566a962';
const SECRET = 'test-app-secret-0f6d2c';
const CLEARED = 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
const CLEARED_SECURE = 'session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0';
const SAME = { 'Sec-Fetch-Site': 'same-origin' };
const HTTPS = { 'X-Forwarded-Proto': 'https' };
const HOST = 'app.example.com:8443';

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

let api, app, calls, reply, handle, logged, seen, rejected;

beforeEach(async () => {
  calls = [];
  logged = [];
  seen = rejected = undefined;
  reply = (res) => res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"message":"ok"}');
  handle = (req, res) => logout(req, res);
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
    seen = req;
    try {
      await handle(req, res);
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

function send(method, headers) {
  const lines = Object.entries({ Host: hostOf(app), 'User-Agent': 'test-browser', ...headers }).flatMap(([k, v]) =>
    [v].flat().flatMap((x) => [k, x]),
  );
  return new Promise((resolve, reject) => {
    const fail = (e) => reject(rejected ?? e);
    const r = request(urlOf(app) + '/logout', { method, agent: false, headers: lines }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('error', fail);
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          location: res.headers.location,
          cookies: res.headers['set-cookie'] ?? [],
          body,
        }),
      );
    });
    r.on('error', fail);
    r.setTimeout(5000, () => r.destroy(new Error('logout did not respond')));
    r.end();
  });
}

async function run(method, headers = {}, cookie = `session=${TOKEN}`) {
  const out = await send(method, { ...headers, ...(cookie && { Cookie: cookie }) });
  assert.equal(out.status, 303);
  assert.equal(out.body, '');
  for (const s of [TOKEN, SECRET]) assert.ok(!JSON.stringify([out, logged]).includes(s));
  return out;
}

function bearerOnly(c) {
  assert.equal(process.env.STACKURE_APP_SECRET, SECRET);
  assert.equal(c.method, 'POST');
  assert.equal(c.url, '/api/public/auth/sign-out');
  assert.equal(c.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(c.headers['user-agent'], 'test-browser');
  assert.equal(c.headers['x-app-secret'], undefined);
  assert.ok(!JSON.stringify(c).includes(SECRET));
  assert.equal(c.headers.cookie, undefined);
  assert.equal(c.body, '');
}

function signedOut() {
  assert.equal(calls.length, 1);
  bearerOnly(calls[0]);
}

function acted(out, cleared = CLEARED) {
  signedOut();
  assert.deepEqual(out.cookies, [cleared]);
  assert.equal(out.location, urlOf(api) + '/');
}

function ignored(out) {
  assert.equal(calls.length, 0);
  assert.deepEqual(out.cookies, []);
  assert.equal(out.location, urlOf(api) + '/signout');
}

const twice = (name) => () =>
  assert.equal(seen.rawHeaders.filter((h, i) => i % 2 === 0 && h.toLowerCase() === name).length, 2);

const cut = (status) => (res) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': 16 });
  res.write('{"mess', () => res.socket.destroy());
};

test('same-origin POST with a valid token: signs out with the bearer, clears the cookie, redirects to base /', async () => {
  acted(await run('POST', SAME, `other=1; session=${TOKEN}`));
});

test('same-origin POST with a non-matching Origin: Sec-Fetch-Site decides alone, signs out, clears the cookie, redirects to base /', async () => {
  acted(await run('POST', { ...SAME, Origin: 'https://evil.example' }));
});

test('same-origin POST with no app id or secret configured: signs out, clears the cookie, redirects to base /', async () => {
  delete process.env.STACKURE_APP_ID;
  delete process.env.STACKURE_APP_SECRET;
  const out = await run('POST', SAME);
  assert.deepEqual(
    calls.map((c) => [c.url, c.headers.authorization]),
    [['/api/public/auth/sign-out', `Bearer ${TOKEN}`]],
  );
  assert.deepEqual(out.cookies, [CLEARED]);
  assert.equal(out.location, urlOf(api) + '/');
});

for (const [name, ok] of [
  ['204 with an empty body', (res) => res.writeHead(204).end()],
  ['200 with an empty body', (res) => res.writeHead(200).end()],
  ['200 with a non-JSON body', (res) => res.writeHead(200).end('ok')],
  ['200 with a body that never arrives', (res) => res.writeHead(200, { 'Content-Length': 9 }).flushHeaders()],
  ['200 with a body that is cut short', cut(200)],
]) {
  test(`same-origin POST, API ${name}: counts as success, one call, redirects to base /`, async () => {
    reply = ok;
    acted(await run('POST', SAME));
  });
}

for (const [name, cookie] of [
  ['without a token', ''],
  ['with a malformed token', 'session=not-a-token'],
  ['with a token that is not a v4 UUID', 'session=3b241101-e2bb-1255-8caf-4136c566a962'],
]) {
  test(`same-origin POST ${name}: no request, clears the cookie, redirects to base /`, async () => {
    const out = await run('POST', SAME, cookie);
    assert.equal(calls.length, 0);
    assert.deepEqual(out.cookies, [CLEARED]);
    assert.equal(out.location, urlOf(api) + '/');
  });
}

const redirected = (res, req) =>
  req.url === '/ok' ? res.writeHead(200).end() : res.writeHead(302, { Location: '/ok' }).end();

for (const [name, fail, sent] of [
  ['401', () => (reply = (res) => res.writeHead(401).end('{"error":"unauthorized"}')), 1],
  ['401 with a body that is cut short', () => (reply = cut(401)), 1],
  ['500', () => (reply = (res) => res.writeHead(500).end('{"error":"internal"}')), 2],
  ['redirect to a 200', () => (reply = redirected), 1],
  ['timeout', () => (reply = () => {}), 1],
  ['network error', () => close(api), 0],
]) {
  test(`same-origin POST, API failure (${name}): clears the cookie, redirects to base /signout`, async () => {
    const base = urlOf(api);
    await fail();
    const out = await run('POST', SAME);
    assert.deepEqual(out.cookies, [CLEARED]);
    assert.equal(out.location, base + '/signout');
    assert.equal(calls.length, sent);
    calls.forEach(bearerOnly);
  });
}

for (const [name, headers, cleared] of [
  ['matching Origin', (h) => ({ Origin: `http://${h}` })],
  ['matching https Origin on an http request', (h) => ({ Origin: `https://${h}` })],
  ['matching https Origin on an https request', (h) => ({ ...HTTPS, Origin: `https://${h}` }), CLEARED_SECURE],
  ['matching Origin in another case', () => ({ Origin: 'https://APP.example.com:8443', Host: 'app.EXAMPLE.com:8443' })],
]) {
  test(`POST with no Sec-Fetch-Site and a ${name}: signs out, clears the cookie, redirects to base /`, async () => {
    acted(await run('POST', headers(hostOf(app))), cleared);
  });
}

for (const [name, method, headers, check] of [
  ['GET', 'GET', () => ({})],
  ['same-origin GET', 'GET', (h) => ({ ...SAME, Origin: `http://${h}` })],
  ['same-origin HEAD', 'HEAD', () => SAME],
  ['same-origin PUT', 'PUT', () => SAME],
  ['same-origin DELETE', 'DELETE', () => SAME],
  ['cross-site POST', 'POST', () => ({ 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' })],
  ['cross-site POST with a matching Origin', 'POST', (h) => ({ 'Sec-Fetch-Site': 'cross-site', Origin: `http://${h}` })],
  ['same-site POST with a matching Origin', 'POST', (h) => ({ 'Sec-Fetch-Site': 'same-site', Origin: `http://${h}` })],
  ['POST with Sec-Fetch-Site none and a matching Origin', 'POST', (h) => ({ 'Sec-Fetch-Site': 'none', Origin: `http://${h}` })],
  ['POST with Sec-Fetch-Site Same-Origin and a matching Origin', 'POST', (h) => ({ 'Sec-Fetch-Site': 'Same-Origin', Origin: `http://${h}` })],
  [
    'POST with an empty Sec-Fetch-Site and a matching Origin',
    'POST',
    (h) => ({ 'Sec-Fetch-Site': '', Origin: `http://${h}` }),
    () => assert.equal(seen.headers['sec-fetch-site'], ''),
  ],
  [
    'POST with a repeated Sec-Fetch-Site and a matching Origin',
    'POST',
    (h) => ({ 'Sec-Fetch-Site': ['same-origin', 'same-origin'], Origin: `http://${h}` }),
    twice('sec-fetch-site'),
  ],
  ['same-origin POST with a repeated Origin', 'POST', (h) => ({ ...SAME, Origin: [`http://${h}`, `http://${h}`] }), twice('origin')],
  ['same-origin POST with a repeated Host', 'POST', (h) => ({ ...SAME, Host: [h, h] }), twice('host')],
  ['POST with a matching Origin and a repeated Host', 'POST', (h) => ({ Origin: `http://${h}`, Host: [h, h] }), twice('host')],
  ['POST with neither Sec-Fetch-Site nor Origin', 'POST', () => ({})],
  ['POST with a non-matching Origin', 'POST', () => ({ Origin: 'https://evil.example' })],
  ['POST with an Origin on another port', 'POST', () => ({ Origin: 'http://127.0.0.1:1' })],
  ['POST with a null Origin', 'POST', () => ({ Origin: 'null' })],
  ['https POST with a matching http Origin', 'POST', (h) => ({ ...HTTPS, Origin: `http://${h}` })],
  ...[
    ['that starts with the host', `https://${HOST}.evil.example`],
    ['whose host name starts with the host name', 'https://app.example.com.evil.example:8443'],
    ['whose port starts with the port', `https://${HOST}0`],
    ['that ends with the host', `https://evil${HOST}`],
    ['on a subdomain of the host', `https://evil.${HOST}`],
    ['on the parent domain of the host', 'https://example.com:8443'],
    ['that is the host without its port', 'https://app.example.com'],
  ].map(([name, origin]) => [`POST with an Origin ${name}`, 'POST', () => ({ Origin: origin, Host: HOST })]),
]) {
  test(`${name}: no request, cookie untouched, redirects to base /signout`, async () => {
    const out = await run(method, headers(hostOf(app)));
    check?.();
    ignored(out);
  });
}

for (const [name, method, before, sent] of [
  ['before logout is called on a GET', 'GET', true, 0],
  ['before logout is called on a same-origin POST', 'POST', true, 0],
  ['by other middleware during the sign-out call', 'POST', false, 1],
]) {
  test(`response written ${name}: the returned promise resolves, response untouched`, async () => {
    let returned;
    const settled = new Promise((resolve) => {
      handle = (req, res) => {
        if (before) res.writeHead(200).end('sent');
        returned = logout(req, res);
        if (!before) res.writeHead(200).end('sent');
        returned.then(() => resolve('resolved'), resolve);
      };
    });
    const out = await send(method, { ...SAME, Cookie: `session=${TOKEN}` });
    assert.ok(returned instanceof Promise);
    assert.equal(await settled, 'resolved');
    assert.equal(calls.length, sent);
    calls.forEach(bearerOnly);
    assert.deepEqual(out, { status: 200, location: undefined, cookies: [], body: 'sent' });
  });
}
