# Stackure JavaScript SDK

Authentication for your app. One line.

## Install

```bash
npm install stackure
```

## Protect a Route

```js
import { auth } from 'stackure';

app.get('/admin', auth({ appId: 'my-app-id', roles: ['admin'] }), (req, res) => {
  res.json({ user: req.user });
});
```

- API requests get JSON errors
- Browser requests get redirected to sign-in

## Verify Manually

```js
import { verify } from 'stackure';

const result = await verify({ appId: 'my-app-id', request: req });

if (!result.authenticated) {
  return res.status(result.error.code).json({ error: result.error.message });
}

res.json({ user: result.user });
```

## Client Functions

```js
import { sendMagicLink, validateSession, signIn, logout } from 'stackure';

await sendMagicLink({ email: 'user@example.com', appId: 'my-app-id' });
await signIn('my-app-id');

const session = await validateSession('my-app-id');
// session.authenticated, session.user, session.sign_in_url

await logout();
```

## Custom Client

```js
import { StackureClient } from 'stackure';

const client = new StackureClient({
  baseUrl: 'https://staging.stackure.com',
  timeout: 5000,
});
```

## Errors

`ValidationError` | `NetworkError` | `AuthenticationError` | `TimeoutError`

```js
import { ValidationError, NetworkError, AuthenticationError, TimeoutError } from 'stackure';
```

## License

MIT
