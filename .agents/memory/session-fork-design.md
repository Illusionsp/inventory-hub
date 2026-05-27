---
name: Session fork design
description: Why /auth/fork must write directly to the session store and never call session.regenerate()
---

## Rule
`/auth/fork` must create a new session by calling `req.sessionStore.set(newId, data, cb)` with a `crypto.randomBytes(32).toString("hex")` ID. It must **never** call `session.regenerate()`.

## Why
`session.regenerate()` does two things:
1. Destroys the old session in the store
2. Issues a new `Set-Cookie` header — updating the **shared browser cookie for all tabs**

When multiple tabs open and each calls `/auth/fork` via the shared cookie:
- Tab A forks → regenerate destroys session `ABC`, cookie becomes `XYZ`
- Tab B (which loaded via `ABC`) now has an invalid cookie AND Tab B's fork regenerates `XYZ` → cookie becomes `PQR`
- Cascade: every fork invalidates the previous one → alternating 401/304 pattern in the API logs

## How to apply
Write the fork session data directly to the store. The original cookie session stays alive for unisolated tabs that haven't forked yet.

```typescript
const { randomBytes } = await import("node:crypto");
const newSessionId = randomBytes(32).toString("hex");
const maxAge = 7 * 24 * 60 * 60 * 1000;
const sessionData = {
  userId: req.session.userId!,
  userRole: req.session.userRole!,
  userPermissions: req.session.userPermissions ?? [],
  cookie: {
    originalMaxAge: maxAge,
    expires: new Date(Date.now() + maxAge).toISOString(),
    httpOnly: true,
    path: "/",
  },
};
req.sessionStore.set(newSessionId, sessionData as any, (err) => {
  if (err) { res.status(500).json({ error: "Session fork failed" }); return; }
  res.json({ sessionId: newSessionId });
});
```

connect-pg-simple reads `sess.cookie.expires` to set the DB row TTL, so the `cookie` field is required.
