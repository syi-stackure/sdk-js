# Stackure JavaScript SDK

[![CI](https://github.com/syi-stackure/sdk-js/actions/workflows/ci.yml/badge.svg)](https://github.com/syi-stackure/sdk-js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/stackure.svg)](https://www.npmjs.com/package/stackure)
[![npm downloads](https://img.shields.io/npm/dm/stackure.svg)](https://www.npmjs.com/package/stackure)
[![Node.js version](https://img.shields.io/node/v/stackure.svg)](https://nodejs.org)
[![npm provenance](https://img.shields.io/badge/npm-provenance-blue)](https://docs.npmjs.com/generating-provenance-statements)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Authentication for your app. One line.

## Install

```bash
npm install stackure
```

Requires Node.js 18+.

## Protect a route

```js
import { auth } from 'stackure';

app.get('/admin', auth({ appId: 'my-app-id', roles: ['admin'] }), (req, res) => {
  res.json({ user: req.user });
});
```

- API requests get JSON errors
- Browser requests get redirected to sign-in

## Verify manually

```js
import { verify } from 'stackure';

const result = await verify({ appId: 'my-app-id', request: req });

if (!result.authenticated) {
  return res.status(result.error.code).json({ error: result.error.message });
}

res.json({ user: result.user });
```

## Client functions

```js
import { sendMagicLink, validateSession, signIn, logout } from 'stackure';

await sendMagicLink({ email: 'user@example.com', appId: 'my-app-id' });
await signIn('my-app-id');

const session = await validateSession('my-app-id');
// session.authenticated, session.user, session.sign_in_url

await logout();
```

## Custom client

```js
import { StackureClient } from 'stackure';

const client = new StackureClient({
  baseUrl: 'https://staging.stackure.com',
  timeout: 5000,
});
```

## Errors

`ValidationError` | `NetworkError` | `AuthenticationError` | `ForbiddenError` | `TimeoutError`

```js
import {
  ValidationError,
  NetworkError,
  AuthenticationError,
  ForbiddenError,
  TimeoutError,
} from 'stackure';
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) — release-please depends on this.

## Security

See [SECURITY.md](./SECURITY.md). Releases are published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) (Sigstore-backed SLSA L3).

## License

MIT
