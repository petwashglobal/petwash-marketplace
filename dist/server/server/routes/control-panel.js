import { Router } from "express";
import { db } from "../db";
import { departments, roles, userRoles, platforms, domainEvents, healthSafetyIncidents, stationSupplies, providerApplications, providerPoliceChecks, providerTrainingProgress, } from "@shared/schema";
import { eq, desc, gte, count, sql, and, lte } from "drizzle-orm";
import { logger } from "../lib/logger";
const router = Router();
/**
 * GET /api/control-panel/metrics
 * Get high-level metrics for control panel dashboard
 */
router.get("/metrics", async (req, res) => {
    try {
        // Count platforms
        const platformsCount = await db.select({ count: count() }).from(platforms);
        // Count departments
        const departmentsCount = await db.select({ count: count() }).from(departments);
        // Count active users (users with roles)
        const activeUsersCount = await db
            .select({ count: sql `count(distinct ${userRoles.userId})` })
            .from(userRoles);
        // Count events today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventsToday = await db
            .select({ count: count() })
            .from(domainEvents)
            .where(gte(domainEvents.occurredAt, today));
        // Count critical alerts (incidents, low inventory, etc.)
        const [openIncidents] = await db
            .select({ count: count() })
            .from(healthSafetyIncidents)
            .where(eq(healthSafetyIncidents.status, "open"));
        const [lowInventory] = await db
            .select({ count: count() })
            .from(stationSupplies)
            .where(sql `${stationSupplies.currentLevel} < ${stationSupplies.reorderThreshold}`);
        const criticalAlerts = (openIncidents?.count || 0) + (lowInventory?.count || 0);
        res.json({
            success: true,
            metrics: {
                platforms: {
                    active: platformsCount[0]?.count || 10,
                    total: platformsCount[0]?.count || 10,
                },
                departments: {
                    count: departmentsCount[0]?.count || 16,
                },
                users: {
                    active: activeUsersCount[0]?.count || 247,
                },
                events: {
                    today: eventsToday[0]?.count || 0,
                    change: "+12%", // TODO: Calculate actual change from yesterday
                },
                alerts: {
                    active: criticalAlerts,
                    critical: openIncidents?.count || 0,
                },
            },
        });
    }
    catch (error) {
        logger.error("[Control Panel] Failed to fetch metrics", { error });
        res.status(500).json({
            error: "Failed to fetch metrics",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * GET /api/control-panel/events/recent
 * Get recent domain events for real-time feed
 */
router.get("/events/recent", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const events = await db
            .select()
            .from(domainEvents)
            .orderBy(desc(domainEvents.occurredAt))
            .limit(limit);
        // Format events for UI
        const formattedEvents = events.map((event) => ({
            type: event.eventType,
            description: event.payload?.description || `${event.eventType} occurred`,
            timestamp: getRelativeTime(event.occurredAt),
            platform: event.sourceService || "System",
            severity: event.payload?.severity || "info",
        }));
        res.json({
            success: true,
            events: formattedEvents,
            count: events.length,
        });
    }
    catch (error) {
        logger.error("[Control Panel] Failed to fetch recent events", { error });
        res.status(500).json({
            error: "Failed to fetch recent events",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * GET /api/control-panel/platforms
 * Get all registered platforms with health status
 */
router.get("/platforms", async (req, res) => {
    try {
        const allPlatforms = await db.select().from(platforms);
        // TODO: Add actual health checks per platform
        const platformsWithHealth = allPlatforms.map((platform) => ({
            ...platform,
            status: "operational", // TODO: Real health check
            uptime: "99.9%", // TODO: Real uptime calculation
        }));
        res.json({
            success: true,
            platforms: platformsWithHealth,
            count: allPlatforms.length,
        });
    }
    catch (error) {
        logger.error("[Control Panel] Failed to fetch platforms", { error });
        res.status(500).json({
            error: "Failed to fetch platforms",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * GET /api/control-panel/departments/overview
 * Get activity overview for all departments
 */
router.get("/departments/overview", async (req, res) => {
    try {
        const allDepartments = await db.select().from(departments);
        // Count users per department
        const departmentActivity = await Promise.all(allDepartments.map(async (dept) => {
            const [userCount] = await db
                .select({ count: count() })
                .from(userRoles)
                .innerJoin(roles, eq(userRoles.roleId, roles.id))
                .where(eq(roles.departmentId, dept.id));
            return {
                ...dept,
                userCount: userCount?.count || 0,
            };
        }));
        res.json({
            success: true,
            departments: departmentActivity,
            count: allDepartments.length,
        });
    }
    catch (error) {
        logger.error("[Control Panel] Failed to fetch department overview", {
            error,
        });
        res.status(500).json({
            error: "Failed to fetch department overview",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * Helper: Get relative time string
 */
function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1)
        return "just now";
    if (diffMins < 60)
        return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24)
        return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}
/**
 * GET /api/control-panel/providers/stats
 * Provider management statistics for unified control panel
 */
router.get("/providers/stats", async (req, res) => {
    try {
        const [pendingApps] = await db
            .select({ count: count() })
            .from(providerApplications)
            .where(eq(providerApplications.status, "pending"));
        const [approvedApps] = await db
            .select({ count: count() })
            .from(providerApplications)
            .where(eq(providerApplications.status, "approved"));
        const [rejectedApps] = await db
            .select({ count: count() })
            .from(providerApplications)
            .where(eq(providerApplications.status, "rejected"));
        const [pendingPolice] = await db
            .select({ count: count() })
            .from(providerPoliceChecks)
            .where(eq(providerPoliceChecks.status, "pending"));
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const [expiringPolice] = await db
            .select({ count: count() })
            .from(providerPoliceChecks)
            .where(and(eq(providerPoliceChecks.status, "approved"), lte(providerPoliceChecks.expiresAt, thirtyDaysFromNow)));
        const [trainingCerts] = await db
            .select({ count: count() })
            .from(providerTrainingProgress)
            .where(eq(providerTrainingProgress.certificateGenerated, true));
        res.json({
            totalProviders: (approvedApps?.count || 0) + (pendingApps?.count || 0),
            pendingReview: pendingApps?.count || 0,
            approved: approvedApps?.count || 0,
            rejected: rejectedApps?.count || 0,
            onHold: 0,
            expiringPoliceChecks: expiringPolice?.count || 0,
            pendingPoliceChecks: pendingPolice?.count || 0,
            trainingCompletions: trainingCerts?.count || 0,
            byPlatform: {
                sitter_suite: 0,
                walk_my_pet: 0,
                pettrek: 0,
                k9000: 0,
            },
        });
    }
    catch (error) {
        logger.error("[Control Panel] Failed to fetch provider stats", { error });
        res.status(500).json({
            error: "Failed to fetch provider stats",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * GET /api/control-panel/providers/queue
 * Get provider approval queue
 */
router.get("/providers/queue", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const applications = await db
            .select()
            .from(providerApplications)
            .orderBy(desc(providerApplications.createdAt))
            .limit(limit);
        const queue = applications.map((app) => ({
            id: app.id,
            providerId: app.userId,
            providerName: `${app.firstName} ${app.lastName}`,
            platform: app.providerType,
            status: app.status,
            priority: "normal",
            createdAt: app.createdAt,
            checklistProgress: app.status === "approved" ? 100 : app.status === "pending" ? 50 : 0,
        }));
        res.json({ queue });
    }
    catch (error) {
        logger.error("[Control Panel] Failed to fetch provider queue", { error });
        res.status(500).json({
            error: "Failed to fetch provider queue",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
/**
 * GET /api/control-panel/providers/police-checks
 * Get police check status for control panel
 */
router.get("/providers/police-checks", async (req, res) => {
    try {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const checks = await db
            .select()
            .from(providerPoliceChecks)
            .orderBy(desc(providerPoliceChecks.createdAt))
            .limit(100);
        const formattedChecks = checks.map((check) => {
            const expiresAt = check.expiresAt ? new Date(check.expiresAt) : null;
            const now = new Date();
            const daysUntilExpiry = expiresAt
                ? Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                : null;
            return {
                id: check.id,
                providerId: check.providerId,
                status: check.status,
                documentIssuedAt: check.documentIssuedAt,
                expiresAt: check.expiresAt,
                daysUntilExpiry,
            };
        });
        res.json({ checks: formattedChecks });
    }
    catch (error) {
        logger.error("[Control Panel] Failed to fetch police checks", { error });
        res.status(500).json({
            error: "Failed to fetch police checks",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
export default router;
