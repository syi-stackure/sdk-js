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

## Protect a route

```js
import { auth, userFromRequest } from 'stackure';

const appId = '7f3c1a2e-9b4d-4e6f-8a1b-2c3d4e5f6071'; // your app's UUID in Stackure

app.get('/admin', auth(appId, 'can_approve_invoice'), (req, res) => {
  const user = userFromRequest(req);
  res.json({ email: user.user_email, permissions: user.user_permissions });
});
```

- API requests get JSON errors
- Browser requests get redirected to sign-in
- The sign-in handoff is automatic: Stackure hands the browser back to your app with a `session_token`, the middleware stores it as a cookie on your domain and strips it from the URL

The middleware writes with `res.setHeader` / `res.writeHead`, so it works on
Express, Connect, and a bare `http.createServer`. On Fastify, pass `request.raw`
and `reply.raw`.

## Requirements

Stackure binds sessions to the browser's user agent and IP. The SDK validates
from your server, so it forwards the original `User-Agent` and
`X-Forwarded-For`. Your app must see the real client IP — if it runs behind a
proxy or CDN, make sure that layer sets `X-Forwarded-For`.

Every request with a session token is validated against Stackure, so revocation
is immediate. Requests without a well-formed token get the sign-in URL without a
Stackure call.

## Verify manually

```js
import { verify } from 'stackure';

const result = await verify(appId, req, 'can_approve_invoice');

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

const resp = await sendMagicLink('user@example.com', appId);
// resp.message
```

## Log out

```js
import { logout } from 'stackure';

app.get('/logout', (req, res) => logout(req, res));
```

Clears the app's cookie and redirects to Stackure's sign-out.

## Configuration

Set `STACKURE_BASE_URL` to point at a non-production environment:

```bash
STACKURE_BASE_URL=https://stage.stackure.com node app.js
```

Retry-on-5xx (one retry after 500ms) and the 2-second request timeout are
hard-coded. Timeouts are never retried.

## Errors

Everything except `verify` throws `StackureError`. Switch on `.code`:

```js
import { StackureError } from 'stackure';

try {
  await sendMagicLink(email);
} catch (err) {
  if (err instanceof StackureError) {
    switch (err.code) {
      case 'validation': // bad input
      case 'auth':       // 401 from the API
      case 'forbidden':  // 403 from the API
      case 'timeout':    // request exceeded the 2s timeout
      case 'network':    // everything else
    }
  }
}
```

## Contributing

Open a PR. Tag a release when ready: `git tag vX.Y.Z && git push --tags` — the release workflow builds, signs, and publishes.

## Security

Report vulnerabilities via [GitHub Security Advisories](https://github.com/syi-stackure/sdk-js/security/advisories/new). Releases ship with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) (Sigstore-backed SLSA L3).

## License

MIT
