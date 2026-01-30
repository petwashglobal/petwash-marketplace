import { db } from "../db";
import { domainEvents } from "@shared/schema";
import { sql } from "drizzle-orm";
import crypto from "crypto";
export async function logAuditEvent(req, action, target, metadata) {
    const eventId = crypto.randomUUID();
    const platformId = req.platformCtx?.platform?.id || "unknown";
    const actorUserId = req.user?.id || req.session?.userId;
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0];
    const userAgent = req.headers["user-agent"];
    try {
        await db.insert(domainEvents).values({
            eventId,
            eventType: `audit.${action}`,
            aggregateType: target?.type || "system",
            aggregateId: target?.id || platformId,
            payload: {
                action,
                target,
                ...metadata,
            },
            metadata: {
                actorUserId,
                ip,
                userAgent,
                requestId: req.platformCtx?.requestId,
                platformId,
                timestamp: new Date().toISOString(),
            },
            occurredAt: sql `NOW()`,
        });
    }
    catch (error) {
        console.error("[AuditLogger] Failed to log event:", error);
    }
}
export function auditAction(action) {
    return async (req, res, next) => {
        const originalSend = res.send;
        res.send = function (body) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                logAuditEvent(req, action, undefined, {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                }).catch(() => { });
            }
            return originalSend.call(this, body);
        };
        next();
    };
}
export function auditMiddleware(req, res, next) {
    const startTime = Date.now();
    const originalSend = res.send;
    res.send = function (body) {
        const duration = Date.now() - startTime;
        if (req.method !== "GET" && req.method !== "OPTIONS" && req.method !== "HEAD") {
            logAuditEvent(req, `${req.method.toLowerCase()}.${req.path.replace(/\//g, "_").replace(/^_/, "")}`, undefined, {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration,
                success: res.statusCode >= 200 && res.statusCode < 300,
            }).catch(() => { });
        }
        return originalSend.call(this, body);
    };
    next();
}
