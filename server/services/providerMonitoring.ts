import { pool } from "../db";
import { logger } from "../lib/logger";

export async function emitProviderEvent(input: {
  applicationId?: number | null;
  eventName: string;
  severity?: "info" | "warning" | "critical";
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO provider_workflow_events
         (application_id, event_name, severity, payload)
       VALUES ($1, $2, $3, $4)`,
      [
        input.applicationId ?? null,
        input.eventName,
        input.severity ?? "info",
        input.payload ? JSON.stringify(input.payload) : null,
      ]
    );
  } catch (err) {
    logger.error("[ProviderMonitoring] Failed to emit event", { error: (err as Error)?.message });
  }
}

export async function getRecentEvents(options?: {
  severity?: string;
  limit?: number;
}): Promise<unknown[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (options?.severity) {
    conditions.push(`severity = $${idx++}`);
    params.push(options.severity);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options?.limit ?? 100;
  params.push(limit);

  const res = await pool.query(
    `SELECT id, application_id, event_name, severity, payload, created_at
       FROM provider_workflow_events
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
    params
  );
  return res.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// MONITORING THRESHOLDS
// Each threshold is checked on every watchdog tick.
// Violations emit a provider_workflow_events record with the appropriate severity.
// ─────────────────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  // Application stuck in `processing` for more than 15 minutes
  processing_stuck_minutes: 15,
  // Application in `pending_review` for more than 48 hours
  pending_review_overdue_hours: 48,
  // Application in `pending_resubmission` for more than 14 days → expires
  pending_resubmission_expire_days: 14,
};

export async function runMonitoringThresholds(): Promise<void> {
  try {
    // 1. Applications stuck in processing > 15 min
    const stuckProcessing = await pool.query(
      `SELECT id, application_id, first_name, last_name
         FROM provider_applications
        WHERE status = 'processing'
          AND updated_at < NOW() - INTERVAL '${THRESHOLDS.processing_stuck_minutes} minutes'
          AND NOT EXISTS (
            SELECT 1 FROM provider_workflow_events
             WHERE application_id = provider_applications.id
               AND event_name = 'threshold_processing_stuck'
               AND created_at > NOW() - INTERVAL '1 hour'
          )`
    );
    for (const row of stuckProcessing.rows) {
      logger.warn("[MonitoringWatchdog] Application stuck in processing", { id: row.id, applicationId: row.application_id });
      await emitProviderEvent({
        applicationId: row.id,
        eventName: "threshold_processing_stuck",
        severity: "critical",
        payload: { applicationId: row.application_id, stuckMinutes: THRESHOLDS.processing_stuck_minutes },
      });
      // Attempt rescue: move to pending_review so support can see it
      await pool.query(
        `UPDATE provider_applications
            SET status = 'pending_review',
                sub_status = 'stuck_in_processing_rescued'
          WHERE id = $1 AND status = 'processing'`,
        [row.id]
      );
      await pool.query(
        `INSERT INTO provider_review_queue
           (application_id, status, priority, review_reasons, created_at)
         VALUES ($1, 'open', 'urgent', $2::jsonb, NOW())
         ON CONFLICT (application_id) DO NOTHING`,
        [row.id, JSON.stringify(["stuck_in_processing"])]
      );
    }

    // 2. Applications in pending_review > 48 hours
    const overdueReview = await pool.query(
      `SELECT id, application_id
         FROM provider_applications
        WHERE status = 'pending_review'
          AND updated_at < NOW() - INTERVAL '${THRESHOLDS.pending_review_overdue_hours} hours'
          AND NOT EXISTS (
            SELECT 1 FROM provider_workflow_events
             WHERE application_id = provider_applications.id
               AND event_name = 'threshold_review_overdue'
               AND created_at > NOW() - INTERVAL '4 hours'
          )`
    );
    for (const row of overdueReview.rows) {
      logger.warn("[MonitoringWatchdog] Application review overdue", { id: row.id, applicationId: row.application_id });
      await emitProviderEvent({
        applicationId: row.id,
        eventName: "threshold_review_overdue",
        severity: "warning",
        payload: { applicationId: row.application_id, overdueHours: THRESHOLDS.pending_review_overdue_hours },
      });
      // Escalate queue priority to urgent
      await pool.query(
        `UPDATE provider_review_queue SET priority = 'urgent'
          WHERE application_id = $1 AND status = 'open' AND priority != 'urgent'`,
        [row.id]
      );
    }

    // 3. Applications in pending_resubmission > 14 days → expire
    const expiredResubmission = await pool.query(
      `SELECT id, application_id, email, first_name, last_name
         FROM provider_applications
        WHERE status = 'pending_resubmission'
          AND last_requested_resubmission_at < NOW() - INTERVAL '${THRESHOLDS.pending_resubmission_expire_days} days'`
    );
    for (const row of expiredResubmission.rows) {
      const updated = await pool.query(
        `UPDATE provider_applications
            SET status = 'expired',
                sub_status = 'resubmission_window_elapsed'
          WHERE id = $1
            AND status = 'pending_resubmission'
          RETURNING id`,
        [row.id]
      );
      if ((updated.rowCount ?? 0) > 0) {
        logger.info("[MonitoringWatchdog] Application expired — resubmission window elapsed", { id: row.id, applicationId: row.application_id });
        await emitProviderEvent({
          applicationId: row.id,
          eventName: "application_expired",
          severity: "warning",
          payload: { applicationId: row.application_id, expiredAfterDays: THRESHOLDS.pending_resubmission_expire_days },
        });
        // Write audit trail
        const { writeProviderAudit } = await import("./providerAudit");
        await writeProviderAudit({
          applicationId: row.id,
          eventType: "application_expired",
          actorUserId: "system-watchdog",
          actorRole: "system",
          payload: { reason: "resubmission_window_elapsed", days: THRESHOLDS.pending_resubmission_expire_days },
        });
        // Mark any open resubmission tokens as expired
        await pool.query(
          `UPDATE provider_application_resubmissions
              SET fulfilled_at = NOW()
            WHERE application_id = $1 AND fulfilled_at IS NULL`,
          [row.id]
        );
      }
    }

    if (stuckProcessing.rows.length + overdueReview.rows.length + expiredResubmission.rows.length > 0) {
      logger.info("[MonitoringWatchdog] Threshold sweep complete", {
        stuckProcessing: stuckProcessing.rows.length,
        overdueReview: overdueReview.rows.length,
        expired: expiredResubmission.rows.length,
      });
    }
  } catch (err: any) {
    logger.error("[MonitoringWatchdog] Threshold check failed", { error: err?.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WATCHDOG SCHEDULER
// Called once at server boot. Runs every 5 minutes.
// ─────────────────────────────────────────────────────────────────────────────
let watchdogStarted = false;

export function startProviderMonitoringWatchdog(): void {
  if (watchdogStarted) return;
  watchdogStarted = true;

  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // Run immediately on first tick (10s after boot to let DB settle)
  setTimeout(async () => {
    await runMonitoringThresholds();
    setInterval(runMonitoringThresholds, INTERVAL_MS);
  }, 10_000);

  logger.info("[MonitoringWatchdog] Started — checking thresholds every 5 min", {
    thresholds: THRESHOLDS,
  });
}
