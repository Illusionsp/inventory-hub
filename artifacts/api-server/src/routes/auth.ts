import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, getEffectivePermissions } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.userPermissions = getEffectivePermissions(user);

  // Save the session before reading req.sessionID so the ID is stable.
  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );

  const { passwordHash: _, ...safeUser } = user;
  // Return the real session ID as the token. The frontend stores it in
  // sessionStorage (tab-scoped) and sends it as Authorization: Bearer on
  // every request, giving each tab its own independent identity.
  res.json({ user: safeUser, token: req.sessionID });
});

/**
 * Fork the current session so this tab gets its own independent session ID.
 * Called by tabs that loaded via the shared cookie (no Bearer token in
 * sessionStorage).  Without this, every such tab shares the same session, so
 * logging out one tab destroys the session for all of them.
 *
 * IMPORTANT: we must NOT use session.regenerate() here.  regenerate() destroys
 * the old session AND sets a new Set-Cookie header, which updates the shared
 * browser cookie for ALL open tabs.  The next tab to call /auth/fork then sees
 * a new cookie, forks that new session, destroys it in turn, and so on —
 * causing a cascade of session invalidations (the alternating 401/304 pattern).
 *
 * Instead, we write a brand-new entry directly to the session store with a
 * fresh random ID and return that ID as the Bearer token.  The original shared
 * cookie session is left completely intact so other unisolated tabs can still
 * authenticate via the cookie while they initialise.
 */
router.post("/auth/fork", requireAuth, async (req, res): Promise<void> => {
  const { randomBytes } = await import("node:crypto");
  const newSessionId = randomBytes(32).toString("hex");

  // Match the 7-day TTL configured in app.ts for regular sessions.
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  const expires = new Date(Date.now() + maxAge);

  // connect-pg-simple reads sess.cookie.expires to calculate the DB row TTL.
  const sessionData = {
    userId: req.session.userId!,
    userRole: req.session.userRole!,
    userPermissions: req.session.userPermissions ?? [],
    cookie: {
      originalMaxAge: maxAge,
      expires: expires.toISOString(),
      httpOnly: true,
      path: "/",
    },
  };

  req.sessionStore.set(newSessionId, sessionData as any, (err) => {
    if (err) {
      req.log.error({ err }, "Session fork failed");
      res.status(500).json({ error: "Session fork failed" });
      return;
    }
    res.json({ sessionId: newSessionId });
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  // Destroy whichever session this tab owns (bearer token takes priority
  // over the shared cookie so the right session is always destroyed).
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const sessionId = authHeader.slice(7).trim();
    if (sessionId) {
      req.sessionStore.destroy(sessionId, () => {});
      res.json({ success: true });
      return;
    }
  }
  req.session.destroy(() => {});
  res.json({ success: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { passwordHash: _, ...safeUser } = user;
  // Return effective permissions (already computed by requireAuth → refreshUserData)
  // so the frontend always gets a non-null string[] regardless of role defaults.
  // sessionId lets a tab that loaded via the shared cookie "adopt" its own bearer
  // token so it becomes isolated from future cookie changes by other tabs.
  res.json({
    ...safeUser,
    permissions: req.session.userPermissions ?? [],
    sessionId: req.sessionID,
  });
});

export default router;
