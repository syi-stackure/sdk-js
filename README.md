# Stackure JavaScript SDK

[![Check build](https://github.com/syi-stackure/sdk-js/actions/workflows/check-build.yml/badge.svg)](https://github.com/syi-stackure/sdk-js/actions/workflows/check-build.yml)
[![npm version](https://img.shields.io/npm/v/stackure.svg)](https://www.npmjs.com/package/stackure)
[![npm downloads](https://img.shields.io/npm/dm/stackure.svg)](https://www.npmjs.com/package/stackure)
[![Node.js version](https://img.shields.io/node/v/stackure.svg)](https://nodejs.org)
[![npm provenance](https://img.shields.io/badge/npm-provenance-blue)](https://docs.npmjs.com/generating-provenance-statements)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Passwordless magic-link authentication SDK for JavaScript and TypeScript — drop-in Express/Connect middleware, zero dependencies.

Protect a route with one line, or verify sessions and send magic links directly against the [Stackure](https://stackure.com) auth API.

## Install

```bash
npm install stackure
```

Requires Node.js 22+. ESM only.

## Configure

```bash
export STACKURE_APP_ID=...       # the app's UUID, shown on the app page in Stackure
export STACKURE_APP_SECRET=...   # from the app page in Stackure, shown once
```

Both are read at call time, never cached. If `STACKURE_APP_ID` is missing or not a UUID, `sendMagicLink` and `validateSession` throw `StackureError` with code `validation`, `verify` returns a 500 result, `auth` responds 500 and `mcp` 503; sign-out never needs it. The secret is sent as `X-App-Secret` on every call except sign-out; the first call that actually reaches Stackure throws the same error if it is missing. `STACKURE_BASE_URL` optionally overrides the API host.

A newly registered app is not usable by anyone, even its creator, until it is shared with the organization or assigned to a team in Stackure. Do that before testing sign-in.

## Protect a route

```js
import { auth, userFromRequest } from 'stackure';

app.get('/admin', auth(), (req, res) => {
  const user = userFromRequest(req);
  res.json({ email: user.user_email, account: user.account_id });
});
```

- API requests get JSON errors
- Browser requests get redirected to sign-in
- The sign-in handoff is automatic: Stackure POSTs a `session_token` (an app-scoped session token valid only for this app) back to your app, the middleware validates it and stores it as a cookie on your domain. Handoff bodies over 4 KB are ignored

The middleware writes with `res.setHeader` / `res.writeHead`, so it works on
Express, Connect, and a bare `http.createServer`. On Fastify, pass `request.raw`
and `reply.raw`.

## MCP

```js
import { mcp, userFromRequest } from 'stackure';

app.all('/mcp', mcp(), (req, res) => {
  const user = userFromRequest(req);
  // serve the MCP request
});
```

AI clients such as Claude, Claude Code, VS Code and Cursor sign users in through Stackure. This one line checks every MCP request in real time with the same app secret. There is no extra setup.

A request that is not signed in gets a 401 with the `WWW-Authenticate` header that tells the AI client where to sign in, and a failed check gets a 503. It reads only `Authorization: Bearer`, never a cookie, and never redirects.

The MCP endpoint must be served from the same site as the app's registered URL unless an MCP URL is set for the app in Stackure.

## Requirements

Sessions are not bound to the browser's user agent or IP. The SDK still
forwards the original `User-Agent` and `X-Forwarded-For` when validating from
your server, but they are informational only.

Every request with a session token is validated against Stackure, so revocation
is immediate. Requests without a well-formed token get the sign-in URL without a
Stackure call.

Each call has a 2-second deadline covering connect, headers, body and the
single retry. Calls retry once after 500ms on a 5xx or a connection failure,
never on a timeout.

## Verify manually

```js
import { verify } from 'stackure';

const result = await verify(req);

if (!result.authenticated) {
  // result.error.code, result.error.message, result.error.sign_in_url
  return res.status(result.error.code).json(result.error);
}

// result.user
```

`verify` never throws — transport and API failures come back as a 500 result.

## Send a magic link

```js
import { sendMagicLink } from 'stackure';

const resp = await sendMagicLink('user@example.com');
// resp.message
```

## Log out

```js
import { logout } from 'stackure';

app.all('/logout', (req, res) => logout(req, res));
```

```html
<form method="post" action="/logout"><button>Sign out</button></form>
```

Mount it for every method on the logout path, as above. Trigger it with a form or button that POSTs from the app's own page; a link or any other request is sent to Stackure's sign-out page, where the user confirms.

`logout` returns a promise (`Promise<void>`). A same-origin POST signs the user out everywhere through Stackure's API, clears the app's cookie and redirects to Stackure. If the API call fails, the redirect goes to Stackure's sign-out page, where the user can finish signing out.

## Errors

Everything except `verify` and `logout` throws `StackureError`. Switch on `.code`:

```js
import { StackureError } from 'stackure';

try {
  await sendMagicLink(email);
} catch (err) {
  if (err instanceof StackureError) {
    switch (err.code) {
      case 'validation': // bad input, or STACKURE_APP_ID or STACKURE_APP_SECRET not set
      case 'auth':       // 401 from the API
      case 'forbidden':  // 403 from the API
      case 'timeout':    // request exceeded the 2s timeout
      case 'network':    // everything else
    }
  }
}
```

## Contributing

Open a PR.

## Security

Report vulnerabilities via [GitHub Security Advisories](https://github.com/syi-stackure/sdk-js/security/advisories/new). Releases ship with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) (Sigstore-backed SLSA L3).

## License

MIT
