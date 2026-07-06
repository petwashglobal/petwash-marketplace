/**
 * Cloud-Scheduler Host Stay reminders (CEO 2026-07-02/03) — the automation that
 * makes a Pet Sitter booking a safety journey: it nudges the owner (and, once
 * accepted, the provider) to complete the care details BEFORE the stay starts,
 * and opens a CARE case if a critical item is still missing 24h out.
 *
 * Reference case: the founder's Kenzo booking. Payment confirmation is not the
 * end — this is what keeps the pet safe on the day.
 *
 * Tiers (per confirmed booking, based on host_stay_details completeness):
 *   T-48h  — if the safety checklist is INCOMPLETE → remind the owner.
 *   T-24h  — ALWAYS remind (owner + provider) for host-stay/overnight; if a
 *            CRITICAL item is missing → open a CARE case + admin alert + push both.
 *   T-0    — day-of: if pickup/drop-off still missing → remind both.
 *
 * De-dup: each tier is sent at most once per booking, tracked in
 * host_stay_details.extra.remindersSent (jsonb) — no double pings.
 *
 * Auth: x-cron-secret (timing-safe vs CRON_SECRET) OR super-admin — same pattern
 * as cron-backup.ts. Writes notifications + (maybe) a CARE case; NO money moved.
 *
 * Cloud Scheduler (ops): hourly is ideal so each window fires close to its mark.
 *   gcloud scheduler jobs create http petwash-host-stay-reminders \
 *     --location=me-west1 --schedule="0 * * * *" --time-zone="Asia/Jerusalem" \
 *     --uri="https://<run-url>/api/cron/host-stay-reminders" --http-method=POST \
 *     --headers="x-cron-secret=<CRON_SECRET>"
 */
import { Router, type Request, type Response } from 'express';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { apiLimiter } from '../middleware/rateLimiter';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { db } from '../db';
import { bookingRequests, hostStayDetails, superAppNotifications } from '@shared/schema';
import { openIncident } from '../services/incidentService';
import { alertManager } from '../lib/alerts';

const router = Router();

async function authorized(req: Request): Promise<boolean> {
  const provided = (req.headers['x-cron-secret'] as string) || '';
  const expected = process.env.CRON_SECRET || '';
  const { timingSafeEqual } = await import('crypto');
  const secretOk =
    expected.length > 0 &&
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (secretOk) return true;
  const email = (req as any).firebaseUser?.email || (req as any).user?.email || '';
  return isSuperAdmin(email);
}

const HOST_STAY_SERVICES = ['pet_sitting', 'sitter', 'PETSITTER', 'boarding', 'daycare'];
const has = (v: any) => v !== null && v !== undefined && String(v).trim().length > 0;

/** Critical missing fields — mirrors the computeChecklist logic in
 *  booking-requests.ts (vet + med-dosage required for overnight/with-meds). */
function missingCritical(booking: any, d: any | null): string[] {
  const start = booking.startDate ? new Date(booking.startDate).getTime() : 0;
  const end = booking.endDate ? new Date(booking.endDate).getTime() : 0;
  const overnight = end - start >= 20 * 60 * 60 * 1000;
  const meds = has(d?.medication);
  const miss: string[] = [];
  if (!(has(d?.pickupAt) || has(d?.dropoffAt))) miss.push('pickup/drop-off');
  if (!has(d?.meetingLocation)) miss.push('meeting location');
  if (!(has(d?.emergencyContactName) && has(d?.emergencyContactPhone))) miss.push('emergency contact');
  if (overnight && !(has(d?.vetName) && has(d?.vetPhone))) miss.push('vet contact');
  if (!has(d?.foodInstructions)) miss.push('food instructions');
  if (meds && !has(d?.medicationDosage)) miss.push('medication dosage');
  if (!has(d?.behaviourNotes)) miss.push('behaviour notes');
  return miss;
}

async function notify(userId: string, title: string, titleHe: string, body: string, requestId: string) {
  if (!userId) return;
  await db.insert(superAppNotifications).values({
    userId, type: 'host_stay_reminder', title, titleHe, body, bodyHe: body,
    actionUrl: `/booking/confirmation/${requestId}`, actionType: 'open_booking',
    channels: ['in_app'], isRead: false, createdAt: new Date(),
  } as any).catch((e: any) => logger.warn('[HostStayReminders] notify failed', { error: e?.message, userId }));
}

async function markSent(details: any | null, bookingId: number, requestId: string, ownerId: string, tier: string) {
  const extra = (details?.extra && typeof details.extra === 'object') ? details.extra : {};
  const sent: string[] = Array.isArray(extra.remindersSent) ? extra.remindersSent : [];
  if (sent.includes(tier)) return false;         // already sent this tier
  sent.push(tier);
  const nextExtra = { ...extra, remindersSent: sent };
  if (details?.id) {
    await db.update(hostStayDetails).set({ extra: nextExtra, updatedAt: new Date() }).where(eq(hostStayDetails.id, details.id));
  } else {
    // No details row yet — create a minimal one just to hold the dedup marker.
    await db.insert(hostStayDetails).values({ bookingRequestId: bookingId, requestId, ownerId, extra: nextExtra } as any)
      .catch(() => { /* unique race — another tick created it */ });
  }
  return true;
}

// POST /api/cron/host-stay-reminders
router.post('/host-stay-reminders', apiLimiter, async (req: Request, res: Response) => {
  if (!(await authorized(req))) {
    logger.warn('[HostStayReminders] Unauthorized', { ip: req.ip });
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const now = Date.now();
    const in48h = new Date(now + 48 * 3600_000);
    const nowD = new Date(now);

    // Confirmed host-stay bookings starting within the next 48h (upcoming only).
    const upcoming = await db.select().from(bookingRequests).where(and(
      eq(bookingRequests.status, 'confirmed' as any),
      gte(bookingRequests.startDate, nowD),
      lte(bookingRequests.startDate, in48h),
    )).catch(() => [] as any[]);

    let reminders = 0, cases = 0;
    for (const b of upcoming) {
      const svc = String(b.serviceType ?? '').toLowerCase();
      const isHostStay = HOST_STAY_SERVICES.some(s => svc.includes(s.toLowerCase()));
      if (!isHostStay) continue;

      const [details] = await db.select().from(hostStayDetails)
        .where(eq(hostStayDetails.bookingRequestId, b.id)).limit(1);
      const missing = missingCritical(b, details ?? null);
      const hoursToStart = (new Date(b.startDate).getTime() - now) / 3600_000;

      // ── T-24h (and inside 24h) — always remind; escalate if critical missing ──
      if (hoursToStart <= 24) {
        if (await markSent(details ?? null, b.id, b.requestId, b.ownerId, 'T24')) {
          reminders++;
          await notify(b.ownerId, '⏰ Your booking starts soon — confirm care details',
            '⏰ ההזמנה מתחילה בקרוב — אנא השלימו פרטי טיפול',
            `Booking ${b.requestId} starts within 24h. Confirm pickup/drop-off, emergency contact, vet, food and any medication.`, b.requestId);
          if (b.providerId) await notify(b.providerId, '⏰ Booking starts soon — confirm readiness',
            '⏰ ההזמנה מתחילה בקרוב — אשרו מוכנות',
            `Booking ${b.requestId} starts within 24h. Review the care pack and confirm you're ready.`, b.requestId);

          if (missing.length > 0) {
            // Open a CARE case (NON payout-freezing type) + admin alert.
            try {
              const inc = await openIncident({
                type: 'care_details_incomplete', severity: 'medium',
                description: `Critical care details missing 24h before start: ${missing.join(', ')}`,
                memberId: b.ownerId, providerId: b.providerId || undefined, bookingId: b.requestId,
                reportedBy: 'system:host-stay-reminders',
              });
              cases++;
              await alertManager.triggerAlert({
                name: 'HOST_STAY_CARE_DETAILS_MISSING',
                message: `Booking ${b.requestId} starts in <24h with missing: ${missing.join(', ')} (case ${inc.incidentId})`,
                severity: 'warning', timestamp: new Date(),
                metadata: { requestId: b.requestId, missing, caseId: inc.incidentId, ownerId: b.ownerId, providerId: b.providerId },
              }).catch(() => {});
            } catch (e: any) {
              logger.warn('[HostStayReminders] CARE case open failed', { requestId: b.requestId, error: e?.message });
            }
          }
        }
        // ── T-0 day-of — pickup/drop-off still missing ──
        if (hoursToStart <= 6 && !(has(details?.pickupAt) || has(details?.dropoffAt))) {
          if (await markSent(details ?? null, b.id, b.requestId, b.ownerId, 'T0')) {
            reminders++;
            await notify(b.ownerId, '📍 Today: confirm pickup/drop-off time & place',
              '📍 היום: אשרו שעה ומקום למסירה/איסוף',
              `Your booking ${b.requestId} is today — please confirm the pickup/drop-off details.`, b.requestId);
          }
        }
        continue;
      }

      // ── T-48h — remind only if the checklist is incomplete ──
      if (missing.length > 0) {
        if (await markSent(details ?? null, b.id, b.requestId, b.ownerId, 'T48')) {
          reminders++;
          await notify(b.ownerId, '📋 Complete your pet\'s care details',
            '📋 השלימו את פרטי הטיפול של החיה',
            `Booking ${b.requestId} starts in ~2 days. Add the missing details so your provider is fully prepared: ${missing.join(', ')}.`, b.requestId);
        }
      }
    }

    logger.info('[HostStayReminders] Run complete', { scanned: upcoming.length, reminders, cases });
    return res.json({ success: true, scanned: upcoming.length, reminders, casesOpened: cases });
  } catch (err: any) {
    logger.error('[HostStayReminders] Run failed', { error: err?.message });
    return res.status(500).json({ success: false, error: err?.message || 'run_failed' });
  }
});

export default router;
