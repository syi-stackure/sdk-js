# Stackure JavaScript SDK

Official Stackure authentication SDK for JavaScript and TypeScript.

**Authentication that adapts to your app.** Smart defaults with full control when you need it.

[![npm version](https://badge.fury.io/js/stackure.svg)](https://www.npmjs.com/package/stackure)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npm install stackure
```

Or via CDN for browser usage:

```html
<script src="https://cdn.stackure.com/auth.js"></script>
```

**Requirements:**
- Node.js 16+ (for server-side)
- Modern browser with fetch API support (for client-side)

## Quick Start

### Client-Side Authentication

```typescript
import { sendMagicLink, validateSession, logout, signIn } from 'stackure';

// Send magic link email
await sendMagicLink({
  email: 'user@example.com',
  appId: 'your-app-id'
});

// Or redirect to Stackure sign-in page
await signIn('your-app-id');

// Check if user is authenticated
const session = await validateSession('your-app-id');
if (session.authenticated) {
  console.log('Welcome:', session.user.user_email);
  console.log('User ID:', session.user.user_id);
  console.log('Name:', session.user.user_first_name, session.user.user_last_name);
  console.log('Roles:', session.user.user_roles);
}

// Sign out from all Stackure apps
await logout();
```

### Server-Side Protection (Express/Node.js)

**Smart Middleware** - Automatically handles JSON APIs and browser requests:

```typescript
import express from 'express';
import { auth } from 'stackure';

const app = express();

// Protect routes with automatic error handling
app.get('/dashboard', 
  auth({ appId: 'your-app-id' }), 
  (req, res) => {
    res.json({ 
      message: `Welcome ${req.user.user_email}`,
      user: req.user 
    });
  }
);

// Role-based access control
app.get('/admin', 
  auth({ appId: 'your-app-id', roles: ['admin'] }), 
  (req, res) => {
    res.json({ admin: true, user: req.user });
  }
);
```

**Manual Verification** - Full control over error handling:

```typescript
import { verify } from 'stackure';

app.get('/api/data', async (req, res) => {
  const result = await verify({ 
    appId: 'your-app-id',
    request: req 
  });

  if (!result.authenticated) {
    // Custom error handling
    return res.status(result.error.code).json({
      error: 'Authentication required',
      sign_in_url: result.error.sign_in_url
    });
  }

  res.json({ data: 'secret', user: result.user });
});
```

### Browser Usage (CDN)

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.stackure.com/auth.js"></script>
</head>
<body>
  <button onclick="handleSignIn()">Sign in with Stackure</button>
  <button onclick="handleSignOut()">Sign out</button>
  <div id="user-info"></div>

  <script>
    const APP_ID = 'your-app-id';

    // Check authentication on page load
    async function checkAuth() {
      const session = await Stackure.validateSession(APP_ID);
      if (session.authenticated) {
        document.getElementById('user-info').textContent = 
          `Logged in as ${session.user.user_email}`;
      }
    }

    async function handleSignIn() {
      await Stackure.signIn(APP_ID);
    }

    async function handleSignOut() {
      await Stackure.logout();
      location.reload();
    }

    checkAuth();
  </script>
</body>
</html>
```

## API Reference

### Client Functions

#### `sendMagicLink(options)`

Send a magic link email for passwordless authentication.

```typescript
await sendMagicLink({
  email: 'user@example.com',
  appId: 'your-app-id',
  redirectUrl: 'https://yourapp.com/dashboard' // optional
});
```

**Options:**
- `email` (string, required) - User's email address
- `appId` (string, required) - Your Stackure app ID
- `redirectUrl` (string, optional) - Where to redirect after successful authentication

**Throws:**
- `ValidationError` - Invalid email or app ID
- `NetworkError` - Network request failed
- `TimeoutError` - Request took longer than 10 seconds

---

#### `validateSession(appId)`

Check if the current user has a valid session.

```typescript
const result = await validateSession('your-app-id');

if (result.authenticated) {
  console.log(result.user.user_id);        // Unique user ID
  console.log(result.user.user_email);     // User email
  console.log(result.user.user_first_name, result.user.user_last_name); // User name
  console.log(result.user.user_roles);     // Array of role names
} else {
  console.log(result.sign_in_url);    // URL to sign-in page
}
```

**Returns:**
```typescript
{
  authenticated: boolean;
  user?: StackureUser;
  sign_in_url?: string;
}
```

**Throws:**
- `ValidationError` - Invalid app ID format
- `NetworkError` - Network request failed
- `TimeoutError` - Request took longer than 10 seconds

---

#### `logout()`

Sign out the current user from all Stackure-powered apps.

```typescript
await logout();
```

**Throws:**
- `NetworkError` - Network request failed
- `TimeoutError` - Request took longer than 10 seconds

---

#### `signIn(appId, email?)`

Initiate authentication flow.

```typescript
// Redirect to Stackure sign-in page
await signIn('your-app-id');

// Send magic link directly
await signIn('your-app-id', 'user@example.com');
```

**Parameters:**
- `appId` (string, required) - Your Stackure app ID
- `email` (string, optional) - If provided, sends magic link instead of redirecting

**Throws:**
- `ValidationError` - Invalid email or app ID
- `NetworkError` - Network request failed (when email provided)
- `TimeoutError` - Request took longer than 10 seconds (when email provided)

### Server Middleware

#### `auth(options)` - Smart Middleware (Recommended)

Express/Connect middleware that automatically handles authentication errors based on request type.

```typescript
import { auth } from 'stackure';

app.get('/protected', 
  auth({ appId: 'your-app-id' }), 
  (req, res) => {
    // req.user is available here
    res.json({ user: req.user });
  }
);

// With role-based access control
app.delete('/admin/users/:id',
  auth({ appId: 'your-app-id', roles: ['admin', 'superadmin'] }),
  (req, res) => {
    res.json({ deleted: true });
  }
);
```

**Options:**
- `appId` (string, required) - Your Stackure app ID
- `roles` (string[], optional) - Required roles. User must have at least one.
- `request` (Request, optional) - Pass explicitly if not using Express

**Automatic Error Handling:**
- **JSON API requests** (`Accept: application/json`) → Returns JSON error:
  ```json
  {
    "error": "Unauthorized",
    "message": "Authentication required",
    "sign_in_url": "https://stackure.com/auth/signin?app_id=..."
  }
  ```
- **Browser requests** (`Accept: text/html`) → Redirects to Stackure sign-in page
- **Ambiguous/missing Accept header** → Defaults to JSON (safe for APIs)

**On Success:**
- Injects `req.user` with user information
- Calls `next()` to continue to your route handler

**Compatible with:**
- Express
- Connect
- Any Express-compatible framework

---

#### `verify(options)` - Manual Verification

Verify authentication without middleware. Gives you full control over error handling.

```typescript
import { verify } from 'stackure';

app.get('/api/data', async (req, res) => {
  const result = await verify({ 
    appId: 'your-app-id',
    request: req,
    roles: ['user']
  });

  if (!result.authenticated) {
    // Handle errors your way
    console.error('Auth failed:', result.error);
    
    return res.status(result.error.code).json({
      error: 'Custom error message',
      redirect: result.error.sign_in_url
    });
  }

  // result.user is available
  res.json({ 
    message: 'Success', 
    user: result.user 
  });
});
```

**Options:**
- `appId` (string, required) - Your Stackure app ID
- `request` (Request, required) - Express request object
- `roles` (string[], optional) - Required roles. User must have at least one.

**Returns:**
```typescript
{
  authenticated: boolean;
  user?: StackureUser;
  error?: {
    code: number;           // HTTP status code
    message: string;        // Error description
    sign_in_url: string;    // Where to redirect for sign-in
  };
}
```

**Use `verify()` when you need:**
- Custom error response format
- Logging or analytics on auth failures
- Different handling per route
- Non-Express frameworks (Fastify, Koa, etc.)

## Configuration

### Custom Configuration

Create a custom client instance for non-production environments or custom timeouts:

```typescript
import { StackureClient } from 'stackure';

const client = new StackureClient({
  baseUrl: 'https://staging.stackure.com',  // Default: https://stackure.com
  timeout: 5000                              // Default: 10000ms
});

// Use custom client
await client.sendMagicLink({
  email: 'user@example.com',
  appId: 'your-app-id'
});
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions.

```typescript
import type { 
  StackureUser,
  VerifyResult,
  VerifyOptions,
  SessionValidationResponse,
  StackureConfig
} from 'stackure';

// Type-safe user object
const user: StackureUser = {
  user_id: '123e4567-e89b-12d3-a456-426614174000',
  account_id: '456e7890-f12b-34c5-d678-901234567890',
  user_email: 'user@example.com',
  user_first_name: 'John',
  user_last_name: 'Doe',
  user_roles: ['user', 'admin']
};

// Type-safe verification
const result: VerifyResult = await verify({
  appId: 'your-app-id',
  request: req
});
```

## Error Handling

The SDK throws typed errors for different failure scenarios:

```typescript
import { 
  ValidationError, 
  NetworkError, 
  AuthenticationError,
  TimeoutError 
} from 'stackure';

try {
  await sendMagicLink({
    email: 'invalid-email',
    appId: 'your-app-id'
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid input:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network failed:', error.message);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof AuthenticationError) {
    console.error('Auth failed:', error.message);
  }
}
```

**Error Types:**

- `ValidationError` - Invalid input (email, app ID, URL format)
- `NetworkError` - Network request failed (no internet, DNS issues)
- `AuthenticationError` - Authentication failed (invalid session, missing roles)
- `TimeoutError` - Request exceeded timeout (default 10s)
- `StackureError` - Base error class for all Stackure errors

## Role-Based Access Control

Stackure supports role-based access control (RBAC). Roles are defined in your Stackure dashboard.

```typescript
// Require specific roles
app.get('/admin',
  auth({ appId: 'your-app-id', roles: ['admin', 'superadmin'] }),
  (req, res) => {
    // User has at least one of the required roles
    res.json({ user: req.user });
  }
);

// Check roles in user object
const session = await validateSession('your-app-id');
if (session.authenticated && session.user.user_roles.includes('admin')) {
  console.log('User is an admin');
}
```

**How it works:**
- User must have **at least one** of the specified roles
- Roles are checked against the user's Stackure profile
- Failed role checks return 403 Forbidden

## Framework Examples

### Express

```typescript
import express from 'express';
import { auth, verify } from 'stackure';

const app = express();

// Using middleware
app.get('/dashboard', 
  auth({ appId: 'your-app-id' }), 
  (req, res) => {
    res.json({ user: req.user });
  }
);

// Manual verification
app.post('/api/action', async (req, res) => {
  const result = await verify({ appId: 'your-app-id', request: req });
  if (!result.authenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ success: true });
});
```

### Fastify

```typescript
import Fastify from 'fastify';
import { verify } from 'stackure';

const fastify = Fastify();

fastify.get('/protected', async (request, reply) => {
  const result = await verify({ 
    appId: 'your-app-id', 
    request: request.raw  // Pass raw Node.js request
  });

  if (!result.authenticated) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  return { user: result.user };
});
```

### Next.js (App Router)

```typescript
// app/api/protected/route.ts
import { verify } from 'stackure';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const result = await verify({
    appId: 'your-app-id',
    request: request as any
  });

  if (!result.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({ user: result.user });
}
```

## Frequently Asked Questions

### How do I get an app ID?

Sign up at [stackure.com](https://stackure.com) and create an app. Your app ID will be in the dashboard.

### Can I use this in production?

Yes. Stackure handles millions of authentications. The SDK is production-ready.

### Does this work with TypeScript?

Yes. Full TypeScript support with comprehensive type definitions included.

### What about CSRF protection?

Stackure uses SameSite cookies and secure token validation. CSRF protection is built-in.

### Can I customize the sign-in page?

Yes. Configure your sign-in page design in the Stackure dashboard. The SDK redirects users to your customized page.

### How do sessions work?

Stackure sets a secure, HTTP-only cookie after successful authentication. The SDK reads this cookie to validate sessions.

### Can I test locally?

Yes. The SDK works on localhost. No special configuration needed for local development.

### What if Stackure is down?

The SDK throws a `NetworkError` if Stackure is unreachable. Implement fallback logic in your error handlers.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `npm test`
5. Submit a pull request

## Support

- **Documentation**: [docs.stackure.com](https://docs.stackure.com)
- **Issues**: [github.com/Mappstack/stackure-js/issues](https://github.com/Mappstack/stackure-js/issues)

## License

MIT License - see [LICENSE](LICENSE) file for details
