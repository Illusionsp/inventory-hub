import { Request, Response, NextFunction } from "express";
import { db, auditLogsTable } from "@workspace/db";

export function auditLogger(req: Request, res: Response, next: NextFunction) {
    // Only monitor mutative methods
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
        return next();
    }

    // Determine entity from the basic route URL (e.g., "/api/sales" -> "sales")
    const pathParts = req.baseUrl.split("/").concat(req.path.split("/")).filter(Boolean);
    let entityType = "system";
    // The first segment after "api" is often the entity type
    const apiIndex = pathParts.indexOf("api");
    if (apiIndex !== -1 && pathParts.length > apiIndex + 1) {
        entityType = pathParts[apiIndex + 1];
    } else if (pathParts.length > 0) {
        entityType = pathParts[0];
    }

    // Intercept the final response explicitly
    const originalSend = res.send;
    res.send = function (body) {
        res.send = originalSend;

        // Call original send
        const result = res.send(body);

        // After success, save audit log asynchronously
        if (res.statusCode >= 200 && res.statusCode < 300) {
            let action = "update";
            if (req.method === "POST") action = "create";
            if (req.method === "DELETE") action = "delete";

            // If there's an approval action in the URL
            if (req.path.includes("approve")) action = "approve";
            if (req.path.includes("reject")) action = "reject";

            // Best effort grab of user and entity ID
            const userId = (req.session as any)?.userId ?? 1; // Fallback to system admin
            const ipAddress = req.ip || req.socket.remoteAddress || "0.0.0.0";

            let entityId = null;
            let changes = null;

            try {
                if (body) {
                    const parsed = typeof body === "string" ? JSON.parse(body) : body;
                    entityId = parsed?.id ?? parsed?.data?.id ?? null;
                    // For creation/updates, maybe record basic changes summary
                    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
                        const safeBody = { ...req.body };
                        if (safeBody.password) safeBody.password = "***";
                        changes = JSON.stringify(safeBody);
                    }
                }
            } catch (e) {
                // body may not be JSON, skip parsing
            }

            // If we couldn't parse the ID from response, try URL param
            if (!entityId && req.params.id) {
                const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
                entityId = parseInt(paramId, 10) || null;
            }

            // Fire and forget
            db.insert(auditLogsTable).values({
                userId,
                action,
                entityType,
                entityId,
                changes,
                ipAddress,
            }).catch(err => {
                console.error("Audit logger failed to save:", err.message);
            });
        }

        return result;
    };

    next();
}
