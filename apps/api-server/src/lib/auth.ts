import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, getEffectivePermissions } from "@workspace/db";

/**
 * Re-fetch the user's role AND effective permissions from the DB on every
 * request so that changes made by an admin take effect immediately.
 */
async function refreshUserData(req: Request): Promise<void> {
  if (!req.session?.userId) return;
  try {
    const [user] = await db
      .select({ role: usersTable.role, permissions: usersTable.permissions })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId));
    if (user) {
      req.session.userRole = user.role;
      req.session.userPermissions = getEffectivePermissions(user);
    }
  } catch {
    // Non-fatal — keep stale data rather than breaking the request
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
    req.session.userId = session.userId as number;
    req.session.userRole = session.userRole as string;
    req.session.userPermissions = (session.userPermissions as string[]) ?? [];

    // Always re-read from DB so admin changes take effect immediately
    await refreshUserData(req);
    next();
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const sessionId = authHeader.slice(7).trim();
    if (sessionId) {
      loadSessionById(req, res, next, sessionId);
      return;
    }
  }

  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  refreshUserData(req).then(() => next()).catch(() => next());
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const sessionId = authHeader.slice(7).trim();
      if (sessionId) {
        loadSessionById(req, res, () => {
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

    refreshUserData(req).then(() => {
      if (!roles.includes(req.session.userRole as string)) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }
      next();
    }).catch(() => next());
  };
}

/**
 * Middleware that enforces a specific permission.
 * Must be placed AFTER requireAuth (which populates req.session.userPermissions).
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const perms: string[] = req.session.userPermissions ?? [];
    if (!perms.includes(permission)) {
      res.status(403).json({ error: "Permission denied", required: permission });
      return;
    }
    next();
  };
}
