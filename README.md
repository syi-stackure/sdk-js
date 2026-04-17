# Stackure JavaScript SDK

[![Check build](https://github.com/syi-stackure/sdk-js/actions/workflows/check-build.yml/badge.svg)](https://github.com/syi-stackure/sdk-js/actions/workflows/check-build.yml)
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

Requires Node.js 18+. ESM only.

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
  return res.status(result.error.code).json(result.error);
}

res.json({ user: result.user });
```

## Send a magic link

```js
import { sendMagicLink } from 'stackure';

await sendMagicLink({ email: 'user@example.com', appId: 'my-app-id' });
```

## Log out

```js
import { logout } from 'stackure';

await logout(req.headers.cookie);
```

## Configuration

Set `STACKURE_BASE_URL` to point at a non-production environment:

```bash
STACKURE_BASE_URL=https://stage.stackure.com node app.js
```

## Errors

All thrown errors are `StackureError`. Switch on `.code`:

```js
import { StackureError } from 'stackure';

try {
  await sendMagicLink({ email });
} catch (err) {
  if (err instanceof StackureError) {
    // err.code is one of: "validation" | "auth" | "forbidden" | "timeout" | "network"
  }
}
```

## Contributing

Open a PR. Tag a release when ready: `git tag vX.Y.Z && git push --tags` — the release workflow builds, signs, and publishes.

## Security

Report vulnerabilities via [GitHub Security Advisories](https://github.com/syi-stackure/sdk-js/security/advisories/new). Releases ship with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) (Sigstore-backed SLSA L3).

## License

MIT
