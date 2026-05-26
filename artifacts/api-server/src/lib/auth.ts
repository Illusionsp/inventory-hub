import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

/**
 * Refresh the user's role from the DB so that role changes made by an admin
 * take effect on the next request without requiring a re-login.
 */
async function refreshUserRole(req: Request): Promise<void> {
  if (!req.session?.userId) return;
  try {
    const [user] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId));
    if (user) req.session.userRole = user.role;
  } catch {
    // Non-fatal — keep stale role rather than breaking the request
  }
}

/**
 * Load session data by a bare session ID (used when the client sends
 * Authorization: Bearer <sessionId> for tab-isolated authentication).
 */
function loadSessionById(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionId: string,
): void {
  req.sessionStore.get(sessionId, async (err, session) => {
    if (err || !session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    // Inject stored session data so downstream handlers can read it
    req.session.userId = session.userId as number;
    req.session.userRole = session.userRole as string;

    // Always re-read role from DB so admin role changes take effect immediately
    await refreshUserRole(req);
    next();
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Tab-isolated path: client sends its own session ID as a bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const sessionId = authHeader.slice(7).trim();
    if (sessionId) {
      loadSessionById(req, res, next, sessionId);
      return;
    }
  }

  // Cookie-session fallback
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Also refresh role for cookie-session path
  refreshUserRole(req).then(() => next()).catch(() => next());
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const sessionId = authHeader.slice(7).trim();
      if (sessionId) {
        loadSessionById(req, res, (err) => {
          if (!roles.includes(req.session.userRole as string)) {
            res.status(403).json({ error: "Insufficient permissions" });
            return;
          }
          next();
        }, sessionId);
        return;
      }
    }

    if (!req.session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    refreshUserRole(req).then(() => {
      if (!roles.includes(req.session.userRole as string)) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }
      next();
    }).catch(() => next());
  };
}
