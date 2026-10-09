import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { afterEach, beforeEach, test } from 'node:test';
import { StackureError, directory, mcp, validateSession } from '../dist/index.js';

const APP = '7f3c1a2e-9b4d-4e6f-8a1b-2c3d4e5f6071';
const TOKEN = '3b241101-e2bb-4255-8caf-4136c566a962';
const SECRET = 'test-app-secret-0f6d2c';
const ADA = {
  user_id: '0d9f8e7c-6b5a-4c3d-9e2f-1a0b9c8d7e6f',
  user_email: 'ada@example.com',
  user_first_name: 'Ada',
  user_last_name: 'Lovelace',
};
const USER = { ...ADA, account_id: '5e4d3c2b-1a0f-4e9d-8c7b-6a5f4e3d2c1b' };
const OPS = { team_id: '4b5c6d7e-8f9a-4b1c-8d2e-3f4a5b6c7d8e', team_name: 'Ops' };
const DIRECTORY = { users: [ADA], teams: [OPS] };

const json = (status, body) => (res) =>
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));

let api, calls, reply;

beforeEach(async () => {
  calls = [];
  api = await new Promise((resolve) => {
    const s = createServer((req, res) => {
      calls.push({ method: req.method, url: req.url, headers: req.headers });
      reply(res);
    }).listen(0, '127.0.0.1', () => resolve(s));
  });
  process.env.STACKURE_BASE_URL = `http://127.0.0.1:${api.address().port}`;
  process.env.STACKURE_APP_ID = APP;
  process.env.STACKURE_APP_SECRET = SECRET;
});

afterEach(
  () =>
    new Promise((resolve) => {
      api.closeAllConnections();
      api.close(resolve);
    }),
);

const browser = (headers = { cookie: `session=${TOKEN}` }) => ({
  headers: { 'user-agent': 'test-browser', 'x-forwarded-for': '203.0.113.7', ...headers },
  socket: {},
});

function sent(c) {
  assert.equal(c.method, 'GET');
  assert.equal(c.url, `/api/public/directory?app_id=${APP}`);
  assert.equal(c.headers['x-app-secret'], SECRET);
  assert.equal(c.headers.cookie, `session=${TOKEN}`);
  assert.equal(c.headers.authorization, undefined);
  assert.equal(c.headers['user-agent'], 'test-browser');
  assert.equal(c.headers['x-forwarded-for'], '203.0.113.7');
}

for (const [name, user, want] of [
  ['app admin in a team', { ...USER, user_is_app_admin: true, user_teams: [OPS] }, { ...USER, user_is_app_admin: true, user_teams: [OPS] }],
  ['no teams', { ...USER, user_is_app_admin: false, user_teams: [] }, { ...USER, user_is_app_admin: false, user_teams: [] }],
  ['older server', USER, { ...USER, user_is_app_admin: false, user_teams: [] }],
]) {
  test(`identity facts (${name}): decoded for session and MCP users`, async () => {
    reply = json(200, { authenticated: true, user });
    assert.deepEqual(await validateSession(browser()), { authenticated: true, user: want });
    const req = { headers: { authorization: `Bearer ${TOKEN}`, host: 'app.example.com' }, url: '/mcp', socket: {} };
    await mcp()(req, {}, () => {});
    assert.deepEqual(req.user, want);
  });
}

test('directory: users and teams who can open the app', async () => {
  reply = json(200, DIRECTORY);
  assert.deepEqual(await directory(browser()), DIRECTORY);
  assert.equal(calls.length, 1);
  sent(calls[0]);
});

for (const [name, status, body, code, sends] of [
  ['invalid session', 401, { error: 'invalid session' }, 'auth', 1],
  ['invalid app secret', 401, { error: 'invalid app secret' }, 'auth', 1],
  ['bad app id', 400, { error: 'invalid app_id format' }, 'network', 1],
  ['rate limited', 429, { error: 'rate limited' }, 'network', 1],
  ['server error', 500, { error: 'internal' }, 'network', 2],
]) {
  test(`directory ${name}: ${code} error with status ${status}`, async () => {
    reply = json(status, body);
    await assert.rejects(directory(browser()), (e) => {
      assert.ok(e instanceof StackureError);
      assert.equal(e.code, code);
      assert.equal(e.statusCode, status);
      if (status === 401) assert.equal(e.message, JSON.stringify(body));
      return true;
    });
    assert.equal(calls.length, sends);
    calls.forEach(sent);
  });
}

for (const [name, headers] of [
  ['no session cookie', {}],
  ['a malformed session cookie', { cookie: 'session=not-a-token' }],
  ['an MCP bearer token only', { authorization: `Bearer ${TOKEN}` }],
]) {
  test(`directory with ${name}: auth error, no request`, async () => {
    await assert.rejects(directory(browser(headers)), { code: 'auth', message: 'invalid session', statusCode: undefined });
    assert.equal(calls.length, 0);
  });
}

test('directory with no app secret: validation error, no request', async () => {
  delete process.env.STACKURE_APP_SECRET;
  await assert.rejects(directory(browser()), { code: 'validation', message: 'STACKURE_APP_SECRET is not set' });
  assert.equal(calls.length, 0);
});
