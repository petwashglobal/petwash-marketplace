/**
 * Admin Alerts Center routes — mounted at /api/admin/alerts (under the
 * /api/admin/ middleware stack). Powers the "מרכז התראות" triage queue.
 *
 *   GET  /                      — filtered/paged list + summary counts
 *   POST /:id/acknowledge       — mark an alert seen
 *   POST /:id/assign            — assign to an admin uid
 *   POST /:id/snooze            — defer until a timestamp (auto re-opens after)
 *   POST /:id/resolve           — close with a note
 *   POST /:id/dismiss           — close as not-actionable with a reason
 *   POST /sweep                 — re-scan detection points now (AlertEngine)
 *
 * requireAdmin (isSuperAdmin) guards the whole router; every mutation is
 * audit-logged. The table + engine are additive — see schema-admin-alerts.ts.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq, desc, ilike, or, sql } from "drizzle-orm";
import { db } from "../db";
import { adminAlerts, ALERT_STATUSES, ALERT_SEVERITIES, ALERT_CATEGORIES } from "@shared/schema-admin-alerts";
import { isSuperAdmin, isSuperAdminVerified } from "../middleware/rbac";
import { logAuditEvent } from "../middleware/auditLog";
import { runAlertSweep } from "../services/AlertEngine";
import { logger } from "../lib/logger";

const router = Router();

function adminUid(req: any): string {
  return req.firebaseUser?.uid || req.userId || req.user?.id || "unknown";
}

function requireAdmin(req: any, res: any, next: any) {
  // Canonical super-admin gate: SUPER_ADMIN_EMAILS allowlist AND
  // Firebase-verified email. isSuperAdminVerified enforces both;
  // the plain isSuperAdmin(email) primitive is deprecated for gates.
  if (!isSuperAdminVerified(req)) {
return res.status(403).json({ error: "Full admin access required" });
  
  }
  next();
}
router.use(requireAdmin);

const TERMINAL = ["resolved", "dismissed"] as const;

/** Reopen any snoozed alert whose snooze window has elapsed. Cheap, idempotent. */
async function reopenExpiredSnoozes(): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE admin_alerts
      SET status = 'open', snoozed_until = NULL, updated_at = NOW()
      WHERE status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= NOW()
    `);
  } catch (e) {
    logger.error("[AdminAlerts] reopenExpiredSnoozes failed", { error: e instanceof Error ? e.message : String(e) });
  }
}

const listQuerySchema = z.object({
  status: z.enum(["all", ...ALERT_STATUSES] as [string, ...string[]]).optional(),
  severity: z.enum(ALERT_SEVERITIES as unknown as [string, ...string[]]).optional(),
  category: z.enum(ALERT_CATEGORIES as unknown as [string, ...string[]]).optional(),
  assignedTo: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

router.get("/", async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query", detail: parsed.error.flatten() });
  const { status, severity, category, assignedTo, q, page, pageSize } = parsed.data;

  await reopenExpiredSnoozes();

  const conds: any[] = [];
  if (!status || status === "open") conds.push(eq(adminAlerts.status, "open"));
  else if (status !== "all") conds.push(eq(adminAlerts.status, status));
  if (severity) conds.push(eq(adminAlerts.severity, severity));
  if (category) conds.push(eq(adminAlerts.category, category));
  if (assignedTo) conds.push(eq(adminAlerts.assignedTo, assignedTo));
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    conds.push(or(ilike(adminAlerts.title, like), ilike(adminAlerts.message, like), ilike(adminAlerts.linkedEntityId, like)));
  }
  const where = conds.length ? and(...conds) : undefined;

  try {
    // Severity rank so critical floats to the top, then newest first.
    const sevRank = sql`CASE ${adminAlerts.severity} WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`;
    const rows = await db.select().from(adminAlerts)
      .where(where as any)
      .orderBy(sevRank, desc(adminAlerts.createdAt))
      .limit(pageSize).offset((page - 1) * pageSize);

    const totalRes: any = await db.execute(
      where
        ? sql`SELECT COUNT(*)::int AS n FROM admin_alerts WHERE ${where}`
        : sql`SELECT COUNT(*)::int AS n FROM admin_alerts`
    );
    const total = Number((totalRes?.rows ?? totalRes ?? [])[0]?.n ?? 0);

    const countsRes: any = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'snoozed')::int AS snoozed,
        COUNT(*) FILTER (WHERE severity = 'critical' AND status NOT IN ('resolved','dismissed'))::int AS critical,
        COUNT(*) FILTER (WHERE severity = 'warning'  AND status NOT IN ('resolved','dismissed'))::int AS warning
      FROM admin_alerts
    `);
    const c = (countsRes?.rows ?? countsRes ?? [])[0] ?? {};
    const counts = { open: Number(c.open ?? 0), critical: Number(c.critical ?? 0), warning: Number(c.warning ?? 0), snoozed: Number(c.snoozed ?? 0) };

    return res.json({ rows, total, page, pageSize, counts });
  } catch (e: any) {
    logger.error("[AdminAlerts] list failed", { error: e?.message });
    return res.status(500).json({ error: "Failed to list alerts" });
  }
});

async function loadAlert(id: number) {
  const [row] = await db.select().from(adminAlerts).where(eq(adminAlerts.id, id)).limit(1);
  return row ?? null;
}

const idParam = z.coerce.number().int().positive();

router.post("/:id/acknowledge", async (req: Request, res: Response) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Bad id" });
  const note = z.string().optional().parse(req.body?.note);
  const uid = adminUid(req);
  const alert = await loadAlert(id.data);
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  if ((TERMINAL as readonly string[]).includes(alert.status)) return res.status(409).json({ error: `Alert is ${alert.status}` });

  await db.update(adminAlerts).set({
    status: "acknowledged", acknowledgedAt: new Date(), acknowledgedBy: uid, updatedAt: new Date(),
    ...(note ? { metadata: { ...(alert.metadata as object), ackNote: note } } : {}),
  }).where(eq(adminAlerts.id, id.data));
  await logAuditEvent({ actorUserId: uid, actorRole: "admin", actionType: "ALERT_ACKNOWLEDGE", targetType: "alert", targetId: String(id.data), ip: req.ip, userAgent: req.headers["user-agent"], metadata: { dedupeKey: alert.dedupeKey, note } });
  return res.json({ ok: true });
});

router.post("/:id/assign", async (req: Request, res: Response) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Bad id" });
  const assigneeUid = z.string().min(1).safeParse(req.body?.assigneeUid);
  if (!assigneeUid.success) return res.status(400).json({ error: "assigneeUid required" });
  const uid = adminUid(req);
  const alert = await loadAlert(id.data);
  if (!alert) return res.status(404).json({ error: "Alert not found" });

  await db.update(adminAlerts).set({ assignedTo: assigneeUid.data, assignedAt: new Date(), updatedAt: new Date() }).where(eq(adminAlerts.id, id.data));
  await logAuditEvent({ actorUserId: uid, actorRole: "admin", actionType: "ALERT_ASSIGN", targetType: "alert", targetId: String(id.data), ip: req.ip, userAgent: req.headers["user-agent"], metadata: { dedupeKey: alert.dedupeKey, assigneeUid: assigneeUid.data } });
  return res.json({ ok: true });
});

router.post("/:id/snooze", async (req: Request, res: Response) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Bad id" });
  const until = z.coerce.date().safeParse(req.body?.until);
  if (!until.success || until.data.getTime() <= Date.now()) return res.status(400).json({ error: "until must be a future timestamp" });
  const uid = adminUid(req);
  const alert = await loadAlert(id.data);
  if (!alert) return res.status(404).json({ error: "Alert not found" });
  if ((TERMINAL as readonly string[]).includes(alert.status)) return res.status(409).json({ error: `Alert is ${alert.status}` });

  await db.update(adminAlerts).set({ status: "snoozed", snoozedUntil: until.data, updatedAt: new Date() }).where(eq(adminAlerts.id, id.data));
  await logAuditEvent({ actorUserId: uid, actorRole: "admin", actionType: "ALERT_SNOOZE", targetType: "alert", targetId: String(id.data), ip: req.ip, userAgent: req.headers["user-agent"], metadata: { dedupeKey: alert.dedupeKey, until: until.data.toISOString() } });
  return res.json({ ok: true });
});

router.post("/:id/resolve", async (req: Request, res: Response) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Bad id" });
  const note = z.string().min(1).safeParse(req.body?.note);
  if (!note.success) return res.status(400).json({ error: "resolution note required" });
  const uid = adminUid(req);
  const alert = await loadAlert(id.data);
  if (!alert) return res.status(404).json({ error: "Alert not found" });

  await db.update(adminAlerts).set({
    status: "resolved", resolvedAt: new Date(), resolvedBy: uid, resolutionNote: note.data, source: "manual", updatedAt: new Date(),
  }).where(eq(adminAlerts.id, id.data));
  await logAuditEvent({ actorUserId: uid, actorRole: "admin", actionType: "ALERT_RESOLVE", targetType: "alert", targetId: String(id.data), ip: req.ip, userAgent: req.headers["user-agent"], severity: "warning", metadata: { dedupeKey: alert.dedupeKey, note: note.data } });
  return res.json({ ok: true });
});

router.post("/:id/dismiss", async (req: Request, res: Response) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Bad id" });
  const reason = z.string().min(1).safeParse(req.body?.reason);
  if (!reason.success) return res.status(400).json({ error: "dismiss reason required" });
  const uid = adminUid(req);
  const alert = await loadAlert(id.data);
  if (!alert) return res.status(404).json({ error: "Alert not found" });

  await db.update(adminAlerts).set({
    status: "dismissed", resolvedAt: new Date(), resolvedBy: uid, resolutionNote: reason.data, source: "manual", updatedAt: new Date(),
  }).where(eq(adminAlerts.id, id.data));
  await logAuditEvent({ actorUserId: uid, actorRole: "admin", actionType: "ALERT_DISMISS", targetType: "alert", targetId: String(id.data), ip: req.ip, userAgent: req.headers["user-agent"], metadata: { dedupeKey: alert.dedupeKey, reason: reason.data } });
  return res.json({ ok: true });
});

router.post("/sweep", async (req: Request, res: Response) => {
  const uid = adminUid(req);
  try {
    const result = await runAlertSweep();
    await logAuditEvent({ actorUserId: uid, actorRole: "admin", actionType: "ALERT_SWEEP_MANUAL", targetType: "alert", ip: req.ip, userAgent: req.headers["user-agent"], metadata: { totalActive: result.totalActive } });
    return res.json({ ok: true, ...result });
  } catch (e: any) {
    logger.error("[AdminAlerts] manual sweep failed", { error: e?.message });
    return res.status(500).json({ error: "Sweep failed" });
  }
});

export default router;
