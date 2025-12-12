# Stackure JavaScript SDK Contract

**Version:** 1.0  
**Date:** October 29, 2025  
**Language:** JavaScript/TypeScript  
**Package:** `stackure` on npm

---

## Our Promise to JavaScript Developers

### **Installation**
```bash
npm install stackure
```
**Zero configuration required.** Works immediately.

### **Browser Support**
```html
<script src="https://cdn.stackure.com/auth.js"></script>
```
**Global `Stackure` object.** No build step needed.

---

## **Client Functions**

### **Magic Link Authentication**
```typescript
import { sendMagicLink } from 'stackure';

await sendMagicLink({
  email: 'user@example.com',
  appId: 'your-app-id' // optional
});
```

**Promise:**
- ✅ Sends passwordless magic link email
- ✅ Validates email format (RFC 5322)
- ✅ Validates app ID format (UUID v4) if provided
- ✅ Returns within 10 seconds or throws TimeoutError
- ✅ Throws ValidationError for invalid inputs
- ✅ Throws NetworkError for connection issues

### **Session Validation**
```typescript
import { validateSession } from 'stackure';

const session = await validateSession('your-app-id');

if (session.authenticated) {
  console.log(session.user.user_id);
  console.log(session.user.user_email);
  console.log(session.user.user_first_name);
  console.log(session.user.user_last_name);
  console.log(session.user.user_roles);
} else {
  window.location.href = session.sign_in_url;
}
```

**Promise:**
- ✅ Checks current session without refresh
- ✅ Returns user data if authenticated
- ✅ Returns sign-in URL if not authenticated
- ✅ Respects app-level access control
- ✅ Works with cookies (no tokens to manage)

### **Universal Sign-In**
```typescript
import { signIn } from 'stackure';

// Redirect to Stackure sign-in page
await signIn('your-app-id');

// Or send magic link directly
await signIn('your-app-id', 'user@example.com');
```

**Promise:**
- ✅ Handles both redirect and email flows
- ✅ Redirects to your custom sign-in page design
- ✅ Sends magic link if email provided

### **Universal Sign-Out**
```typescript
import { logout } from 'stackure';

await logout();
```

**Promise:**
- ✅ Signs out from ALL Stackure-powered apps
- ✅ Clears all authentication cookies
- ✅ Works across domains

---

## **Server Middleware**

### **Smart Authentication (Recommended)**
```typescript
import express from 'express';
import { auth } from 'stackure';

const app = express();

// Automatic error handling based on request type
app.get('/dashboard', 
  auth({ appId: 'your-app-id' }), 
  (req, res) => {
    res.json({ user: req.user });
  }
);

// Role-based access control
app.delete('/admin/users/:id',
  auth({ appId: 'your-app-id', roles: ['admin'] }),
  (req, res) => {
    res.json({ success: true });
  }
);
```

**Promise:**
- ✅ **JSON API requests** (`Accept: application/json`) → Returns JSON error with sign_in_url
- ✅ **Browser requests** (`Accept: text/html`) → Redirects to Stackure sign-in page  
- ✅ **Ambiguous requests** → Defaults to JSON (safe for modern APIs)
- ✅ **Success** → Injects `req.user` and calls `next()`
- ✅ **Role enforcement** → User must have at least one specified role

### **Manual Verification (Full Control)**
```typescript
import { verify } from 'stackure';

app.get('/api/data', async (req, res) => {
  const result = await verify({ 
    appId: 'your-app-id',
    request: req,
    roles: ['user'] // optional
  });

  if (!result.authenticated) {
    return res.status(result.error.code).json({
      error: 'Custom error message',
      redirect: result.error.sign_in_url
    });
  }

  res.json({ user: result.user });
});
```

**Promise:**
- ✅ Returns authentication result without throwing
- ✅ You control all error handling
- ✅ You control response format
- ✅ Works with any Node.js framework

---

## **Error Handling**

### **Typed Errors**
```typescript
import { 
  ValidationError, 
  NetworkError, 
  AuthenticationError,
  TimeoutError 
} from 'stackure';

try {
  await sendMagicLink({ email: 'invalid', appId: 'your-app-id' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Fix your input:', error.message);
  } else if (error instanceof NetworkError) {
    console.log('Connection problem:', error.message);
  } else if (error instanceof TimeoutError) {
    console.log('Request took too long');
  }
}
```

**Promise:**
- ✅ **ValidationError** → Invalid email, app ID, or URL format
- ✅ **NetworkError** → Network request failed, includes HTTP status
- ✅ **AuthenticationError** → Authentication failed, invalid session
- ✅ **TimeoutError** → Request exceeded 10 second timeout
- ✅ All inherit from `StackureError` base class

---

## **TypeScript Support**

### **Complete Type Definitions**
```typescript
import type { 
  StackureUser,
  VerifyResult,
  VerifyOptions,
  SessionValidationResponse 
} from 'stackure';
```

**Promise:**
- ✅ Full TypeScript definitions included
- ✅ No separate `@types/` package needed
- ✅ IntelliSense and autocomplete
- ✅ Compile-time type checking

---

## **Configuration**

### **Custom Configuration**
```typescript
import { StackureClient } from 'stackure';

const client = new StackureClient({
  baseUrl: 'https://staging.stackure.com',  // Default: https://stackure.com
  timeout: 15000                            // Default: 10000ms
});

await client.sendMagicLink({
  email: 'user@example.com',
  appId: 'your-app-id'
});
```

**Promise:**
- ✅ Works with staging/custom environments
- ✅ Configurable timeout
- ✅ Same API as default functions

---

## **Browser Compatibility**

### **CDN Usage**
```html
<script src="https://cdn.stackure.com/auth.js"></script>
<script>
  // All functions available on global Stackure object
  Stackure.signIn('your-app-id');
  
  Stackure.validateSession('your-app-id').then(session => {
    if (session.authenticated) {
      console.log('Welcome:', session.user.user_email);
    }
  });
</script>
```

**Promise:**
- ✅ Works in all modern browsers
- ✅ Global `Stackure` object
- ✅ Same API as npm package
- ✅ Minified and optimized

---

## **What We DON'T Promise**

### **Out of Scope**
- ❌ User registration/signup (use Stackure dashboard)
- ❌ Password management (passwordless only)
- ❌ OAuth providers (magic links only)
- ❌ User profile management (read-only user data)
- ❌ Multi-factor authentication (single-factor magic links)

### **Framework Limitations**
- ❌ React/Vue/Angular components (use functions directly)
- ❌ Next.js middleware (use verify() in API routes)
- ❌ Edge runtime support (Node.js only for server functions)

---

## **Performance Guarantees**

### **Response Times**
- ✅ Session validation: < 200ms
- ✅ Magic link sending: < 2 seconds
- ✅ SDK bundle size: < 50KB minified
- ✅ Zero runtime dependencies

### **Reliability**
- ✅ 99.9% uptime SLA
- ✅ Automatic retries with exponential backoff
- ✅ Graceful degradation when Stackure is unreachable
- ✅ No breaking changes within major versions

---

## **Migration Promise**

### **Semantic Versioning**
- ✅ **1.x.x** → No breaking changes, only additions
- ✅ **2.0.0** → Breaking changes with migration guide
- ✅ **Deprecation warnings** → 6 months before removal

### **Backward Compatibility**
- ✅ Old function signatures supported until next major version
- ✅ Clear migration path for breaking changes
- ✅ Automated migration tools when possible

---

**This is our contract with you.**  
**If we break it, we fix it.**

**Questions? Issues?**  
📧 support@stackure.com  
🐛 github.com/stackure/sdk-js/issues  
📚 docs.stackure.com