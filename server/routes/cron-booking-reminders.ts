/**
 * Cloud-Scheduler booking reminders — the engine the 2026-07-05 360 audit found
 * missing: the luxury booking-reminder-2026 email template and the
 * `booking_reminder` SMS key were BUILT but nothing ever fired them. This route
 * is the missing trigger.
 *
 * Tiers (per confirmed booking, all service types — complements the host-stay
 * care-details cron, which nudges about the SAFETY checklist; this one reminds
 * about the APPOINTMENT itself):
 *   T-24h — customer: email (luxury template) + SMS + inbox; provider: email + inbox.
 *   T-2h  — customer: SMS + inbox only (no second email).
 *
 * De-dup: one superapp_notifications row per (user, tier, booking) acts as both
 * the in-app inbox entry AND the sent-marker — inserted BEFORE email/SMS so a
 * mid-run crash can never double-send.
 *
 * Guards: EmailService.checkEmailConsent(email,'reminder') gates every email;
 * emailSpendGuard.check/record wraps every send; SMS uses the transactional
 * `booking_reminder` registry key (smsTemplates.ts).
 *
 * Auth: x-cron-secret (timing-safe vs CRON_SECRET) OR super-admin — same
 * pattern as cron-backup.ts / cron-host-stay-reminders.ts. NO money moved.
 *
 * Cloud Scheduler (ops): hourly.
 *   gcloud scheduler jobs create http petwash-booking-reminders \
 *     --location=me-west1 --schedule="0 * * * *" --time-zone="Asia/Jerusalem" \
 *     --uri="https://<run-url>/api/cron/booking-reminders" --http-method=POST \
 *     --headers="x-cron-secret=<CRON_SECRET>"
 */
import { Router, type Request, type Response } from 'express';
import { and, eq, gte, lte } from 'drizzle-orm';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { db } from '../db';
import { bookingRequests, superAppNotifications, users } from '@shared/schema';
import { buildBookingReminderEmail, type ReminderWindow } from '../email/templates/booking-reminder-2026';
import { sendSmsTemplate } from '../services/smsTemplates';
import { EmailService } from '../emailService';
import { emailSpendGuard } from '../services/EmailSpendGuard';
import { recordCronExecution } from '../monitoring';

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

/** Per-service presentation for the email template (icon = template's own contract). */
const SERVICE_META: Record<string, { en: string; he: string; icon: string; accent: string }> = {
  pet_sitting: { en: 'Pet Sitting', he: 'פנסיון ביתי', icon: '🏠', accent: '#1a7a4a' },
  dog_walking: { en: 'Dog Walking', he: 'הולכת כלבים', icon: '🐕', accent: '#2553d6' },
  grooming:    { en: 'Grooming', he: 'טיפוח', icon: '✂️', accent: '#d6457e' },
  training:    { en: 'Training', he: 'אילוף', icon: '🎓', accent: '#d97706' },
  k9000:       { en: 'Self-Service Wash', he: 'שטיפה בשירות עצמי', icon: '🛁', accent: '#0C7A50' },
};
function serviceMeta(serviceType: string) {
  const key = String(serviceType || '').toLowerCase();
  return SERVICE_META[key] || { en: 'Pet Care', he: 'טיפול בחיית המחמד', icon: '🐾', accent: '#D4AF37' };
}

type Tier = 'BR_T24' | 'BR_T2';
const TIER_TYPE: Record<Tier, string> = { BR_T24: 'booking_reminder_t24', BR_T2: 'booking_reminder_t2' };

/** Insert the in-app notification that doubles as the sent-marker.
 *  Returns false when this (user, tier, booking) was already reminded. */
async function markAndNotify(opts: {
  userId: string; tier: Tier; requestId: string;
  title: string; titleHe: string; body: string;
}): Promise<boolean> {
  const { userId, tier, requestId, title, titleHe, body } = opts;
  if (!userId) return false;
  const actionUrl = `/booking/confirmation/${requestId}`;
  const type = TIER_TYPE[tier];
  const existing = await db.select({ id: superAppNotifications.id }).from(superAppNotifications)
    .where(and(
      eq(superAppNotifications.userId, userId),
      eq(superAppNotifications.type, type),
      eq(superAppNotifications.actionUrl, actionUrl),
    )).limit(1).catch(() => [] as any[]);
  if (existing.length > 0) return false;
  await db.insert(superAppNotifications).values({
    userId, type, title, titleHe, body, bodyHe: body,
    actionUrl, actionType: 'open_booking',
    channels: ['in_app'], isRead: false, createdAt: new Date(),
  } as any);
  return true;
}

async function contact(uid: string): Promise<{ email: string | null; phone: string | null; firstName: string; lang: 'he' | 'en' }> {
  const [u] = await db.select({
    email: users.email, phone: users.phone, firstName: users.firstName, language: users.language,
  }).from(users).where(eq(users.id, uid)).limit(1).catch(() => [] as any[]);
  return {
    email: u?.email ?? null,
    phone: u?.phone ?? null,
    firstName: u?.firstName || '',
    lang: u?.language === 'en' ? 'en' : 'he',
  };
}

/** Consent + spend-guarded email send. Fail-soft: a false return never aborts the run. */
async function guardedEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const allowed = await EmailService.checkEmailConsent(to, 'reminder');
    if (!allowed) { logger.info('[BookingReminders] email skipped (consent)', { to: to.slice(0, 3) + '…' }); return false; }
    const gate = emailSpendGuard.check('booking-reminders', to);
    if (!gate.allowed) { logger.warn('[BookingReminders] email blocked (spend guard)', { reason: gate.reason }); return false; }
    const sent = await EmailService.sendEmail(to, subject, html);
    if (sent) emailSpendGuard.record('booking-reminders', to, subject);
    return sent;
  } catch (e: any) {
    logger.warn('[BookingReminders] email failed', { error: e?.message });
    return false;
  }
}

function fmtDateTime(d: Date, lang: 'he' | 'en'): { date: string; time: string } {
  const locale = lang === 'he' ? 'he-IL' : 'en-IL';
  return {
    date: new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long' }).format(d),
    time: new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
  };
}

function petName(b: any, lang: 'he' | 'en'): string {
  const pd = b.petDetails;
  const first = Array.isArray(pd) ? pd[0] : (pd && typeof pd === 'object' ? (pd.pets?.[0] ?? pd) : null);
  return (first && typeof first === 'object' && typeof first.name === 'string' && first.name.trim())
    ? first.name.trim()
    : (lang === 'he' ? 'חיית המחמד שלכם' : 'your pet');
}

// POST /api/cron/booking-reminders
router.post('/booking-reminders', async (req: Request, res: Response) => {
  if (!(await authorized(req))) {
    logger.warn('[BookingReminders] Unauthorized', { ip: req.ip });
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }
  const startedAt = Date.now();
  try {
    const now = Date.now();
    // 25h horizon so the hourly tick can never skip past the T-24 mark.
    const upcoming = await db.select().from(bookingRequests).where(and(
      eq(bookingRequests.status, 'confirmed' as any),
      gte(bookingRequests.startDate, new Date(now)),
      lte(bookingRequests.startDate, new Date(now + 25 * 3600_000)),
    )).catch(() => [] as any[]);

    let emails = 0, smses = 0, inApp = 0;
    for (const b of upcoming) {
      const start = new Date(b.startDate);
      const hoursToStart = (start.getTime() - now) / 3600_000;
      const meta = serviceMeta(b.serviceType);
      const dashboardUrl = `https://petwash.co.il/booking/confirmation/${b.requestId}`;
      // A booking confirmed late (already <2h out) must not get T-24 AND T-2
      // SMSes in the same minute — T-2 waits for the next hourly tick.
      let t24SentThisRun = false;

      // ── T-24h — full reminder: customer email+SMS, provider email ─────────
      if (hoursToStart <= 24) {
        const owner = await contact(b.ownerId);
        const { date, time } = fmtDateTime(start, owner.lang);
        const svcLabel = owner.lang === 'he' ? meta.he : meta.en;
        const fresh = await markAndNotify({
          userId: b.ownerId, tier: 'BR_T24', requestId: b.requestId,
          title: `⏰ Reminder: ${svcLabel} tomorrow at ${time}`,
          titleHe: `⏰ תזכורת: ${meta.he} מחר בשעה ${time}`,
          body: `Your PetWash booking ${b.requestId} starts ${date} at ${time}.`,
        });
        if (fresh) {
          inApp++;
          t24SentThisRun = true;
          if (owner.email) {
            const html = buildBookingReminderEmail({
              recipientType: 'customer', language: owner.lang, window: '24h' as ReminderWindow,
              bookingRef: b.requestId, customerName: owner.firstName || (owner.lang === 'he' ? 'לקוח יקר' : 'Valued customer'),
              serviceLabel: svcLabel, serviceIcon: meta.icon, accentColor: meta.accent,
              petName: petName(b, owner.lang),
              dateFormatted: date, timeFormatted: time,
              locationName: owner.lang === 'he' ? 'לפי פרטי ההזמנה' : 'As arranged in your booking',
              priceFormatted: `₪${(Number(b.totalCents || 0) / 100).toFixed(2)}`,
              dashboardUrl,
            });
            if (await guardedEmail(owner.email,
              owner.lang === 'he' ? `תזכורת: ${meta.he} מחר בשעה ${time} — PetWash™` : `Reminder: ${svcLabel} tomorrow at ${time} — PetWash™`,
              html)) emails++;
          }
          if (owner.phone) {
            const r = await sendSmsTemplate('booking_reminder', owner.phone,
              { time, link: dashboardUrl }, { lang: owner.lang, userId: b.ownerId });
            if (r.success) smses++;
          }
        }

        if (b.providerId) {
          const prov = await contact(b.providerId);
          const pf = fmtDateTime(start, prov.lang);
          const provSvc = prov.lang === 'he' ? meta.he : meta.en;
          const freshProv = await markAndNotify({
            userId: b.providerId, tier: 'BR_T24', requestId: b.requestId,
            title: `⏰ Job tomorrow at ${pf.time}: ${provSvc}`,
            titleHe: `⏰ עבודה מחר בשעה ${pf.time}: ${meta.he}`,
            body: `Booking ${b.requestId} starts ${pf.date} at ${pf.time}. Review the details and confirm readiness.`,
          });
          if (freshProv) {
            inApp++;
            if (prov.email) {
              const html = buildBookingReminderEmail({
                recipientType: 'provider', language: prov.lang, window: '24h' as ReminderWindow,
                bookingRef: b.requestId, customerName: prov.firstName || 'Provider',
                serviceLabel: provSvc, serviceIcon: meta.icon, accentColor: meta.accent,
                petName: petName(b, prov.lang),
                dateFormatted: pf.date, timeFormatted: pf.time,
                locationName: prov.lang === 'he' ? 'לפי פרטי ההזמנה' : 'As arranged in the booking',
                priceFormatted: `₪${(Number(b.totalCents || 0) / 100).toFixed(2)}`,
                dashboardUrl: `https://petwash.co.il/provider/bookings/${b.requestId}`,
              });
              if (await guardedEmail(prov.email,
                prov.lang === 'he' ? `תזכורת: עבודה מחר בשעה ${pf.time} — PetWash™` : `Reminder: job tomorrow at ${pf.time} — PetWash™`,
                html)) emails++;
            }
          }
        }
      }

      // ── T-2h — customer SMS nudge only ────────────────────────────────────
      if (hoursToStart <= 2 && !t24SentThisRun) {
        const owner = await contact(b.ownerId);
        const { time } = fmtDateTime(start, owner.lang);
        const fresh = await markAndNotify({
          userId: b.ownerId, tier: 'BR_T2', requestId: b.requestId,
          title: `🐾 Starting soon: ${owner.lang === 'he' ? meta.he : meta.en} at ${time}`,
          titleHe: `🐾 מתחיל בקרוב: ${meta.he} בשעה ${time}`,
          body: `Your PetWash booking ${b.requestId} starts at ${time} today.`,
        });
        if (fresh) {
          inApp++;
          if (owner.phone) {
            const r = await sendSmsTemplate('booking_reminder_today', owner.phone,
              { time, link: dashboardUrl }, { lang: owner.lang, userId: b.ownerId });
            if (r.success) smses++;
          }
        }
      }
    }

    await recordCronExecution('booking-reminders', true).catch(() => {});
    logger.info('[BookingReminders] Run complete', {
      scanned: upcoming.length, emails, smses, inApp, ms: Date.now() - startedAt,
    });
    return res.json({ success: true, scanned: upcoming.length, emails, smses, inApp });
  } catch (err: any) {
    await recordCronExecution('booking-reminders', false, err?.message).catch(() => {});
    logger.error('[BookingReminders] Run failed', { error: err?.message });
    return res.status(500).json({ success: false, error: err?.message || 'run_failed' });
  }
});

export default router;
