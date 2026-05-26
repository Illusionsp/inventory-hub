import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
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
  res.json(safeUser);
});

export default router;
