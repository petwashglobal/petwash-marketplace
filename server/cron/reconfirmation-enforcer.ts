/**
 * Provider 6-month re-confirmation cron (CEO spec §7).
 *
 * Daily sweep that:
 *   1. Sends a re-confirmation REMINDER to providers entering a reminder window
 *      (60 / 30 / 14 / 7 / 1 days before due) — best-effort, fires once per bucket.
 *   2. AUDITS providers who are OVERDUE so there is a forensic trail and the admin
 *      reconfirmation queue (which already lists them) has telemetry.
 *
 * ENFORCEMENT itself is NOT done by mutating provider_services here — that would
 * risk clobbering admin-set statuses and lose the provider's prior approval level
 * on restore. Instead enforcement is DYNAMIC and self-healing: payoutGate (gate g)
 * and the booking-accept path both consult isReconfirmationOverdue() live, behind
 * RECONFIRMATION_ENFORCE. The moment a provider re-confirms, the clock advances and
 * they are unblocked automatically — no restore step, nothing to clobber.
 *
 * This cron writes nothing destructive; it only sends reminders + audits.
 */
import { getProvidersNeedingReconfirmation } from '../services/reconfirmationService';
import NotificationService from '../services/NotificationService';
import { logAuditEvent } from '../middleware/auditLog';
import { logger } from '../lib/logger';

const REMINDER_DAYS = new Set([60, 30, 14, 7, 1]);

export async function runReconfirmationCron(): Promise<{
  scanned: number;
  reminded: number;
  overdue: number;
}> {
  let reminded = 0;
  let overdue = 0;

  // Only due/overdue providers (skip everyone who is fine).
  const rows = await getProvidersNeedingReconfirmation({ includeOk: false });

  for (const r of rows) {
    try {
      if (r.overdue) {
        overdue++;
        // Forensic audit row — admin queue already lists overdue providers; this
        // gives a dated trail and feeds any alerting.
        await logAuditEvent({
          actorUserId: 'system',
          actorRole: 'system',
          actionType: 'PROVIDER_RECONFIRMATION_OVERDUE',
          targetType: 'provider',
          targetId: r.providerId,
          metadata: { dueAt: r.dueAt, daysUntil: r.daysUntil, providerType: r.providerType },
          severity: 'warn',
        });
      } else if (typeof r.reminderBucket === 'number' && REMINDER_DAYS.has(r.daysUntil)) {
        // Fire a reminder once when daysUntil lands exactly on a bucket boundary
        // (prevents daily spam while inside a window). Best-effort: a missing
        // template must never break the sweep.
        try {
          await NotificationService.sendNotification({
            templateKey: 'provider_reconfirmation_reminder',
            userId: r.providerId,
            data: { daysUntil: r.daysUntil, dueAt: r.dueAt },
          } as any);
          reminded++;
        } catch (notifyErr: any) {
          logger.info('[ReconfirmationCron] reminder not sent (template/notify unavailable)', {
            providerId: r.providerId, err: notifyErr?.message,
          });
        }
      }
    } catch (err: any) {
      logger.error('[ReconfirmationCron] row failed', { providerId: r.providerId, err: err?.message });
    }
  }

  logger.info('[ReconfirmationCron] sweep complete', { scanned: rows.length, reminded, overdue });
  return { scanned: rows.length, reminded, overdue };
}
