# The Stackure Auth Manifesto

Authentication should be secure, not complicated.  
It should be effortless, elegant, and absolute.  
It should never distract from building.

## Our Vision

- For the independent developer: ship in a weekend.
- For the enterprise: govern with confidence.
- For everyone: authentication that disappears, leaving only trust.

## Our Promise

**Sign in at stackure.com.**  
Launch all your apps.

**Or sign in at your app.**  
Embed auth directly.

```js
import { sendMagicLink } from 'stackure';

await sendMagicLink({
  email: 'user@example.com',
  appId: 'my-app-id'
});
```

**Sign out everywhere.**
```js
import { logout } from 'stackure';

logout();
```

**One line to protect.**  
Zero config. Just works.

Node.js
```js
import { auth } from 'stackure';

app.get('/admin', auth({ appId: 'my-app-id', roles: ['admin'] }), (req, res) => {
  res.json({ user: req.user });
});
```

Adapts automatically:
- API requests → returns JSON error
- Browser requests → redirects to sign-in

Need control? Use `verify()` instead.

Go
```go
import "github.com/stackure/stackure-go"

r.GET("/user", stackure.Auth(stackure.Roles("admin")), func(c *gin.Context) {
    user := c.MustGet("user")
    c.JSON(200, gin.H{"user": user})
})
```

Python
```python
from stackure import auth

@app.get("/user")
@auth(roles=["admin"])
def get_user(request):
    return {"user": request.user}
```

Rust
```rust
use stackure::auth;

#[get("/user")]
async fn get_user(user: Auth<Admin>) -> Json<User> {
    Json(user.into())
}
```

---

**Security that just works.**  
One identity. Every app.