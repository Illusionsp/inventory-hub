import { Request, Response, NextFunction } from "express";

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
  req.sessionStore.get(sessionId, (err, session) => {
    if (err || !session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    // Inject the stored session data so downstream handlers can read it
    // the same way they read cookie-session data.
    req.session.userId = session.userId as number;
    req.session.userRole = session.userRole as string;
    next();
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Tab-isolated path: client sends its own session ID as a bearer token
  // (stored in sessionStorage, which is scoped to a single tab).
  // This takes priority over the shared cookie so multiple tabs can be
  // logged in as different users simultaneously.
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const sessionId = authHeader.slice(7).trim();
    if (sessionId) {
      loadSessionById(req, res, next, sessionId);
      return;
    }
  }

  // Cookie-session fallback (single-tab or unauthenticated clients).
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const sessionId = authHeader.slice(7).trim();
      if (sessionId) {
        loadSessionById(req, res, (err) => {
          // next() was called — check role now
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
    if (!roles.includes(req.session.userRole as string)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
