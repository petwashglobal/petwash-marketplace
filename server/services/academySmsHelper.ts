/**
 * Academy SMS Copy Builder + Fire-and-Forget Dispatcher
 *
 * Single source of truth for all Academy SMS wording — used by:
 *   - POST /api/academy/bookings/:id/confirm  (trainer self-confirm)
 *   - POST /api/academy/bookings/:id/cancel   (trainer/user self-cancel)
 *   - POST /admin/wallet/academy/:id/force-confirm
 *   - POST /admin/wallet/academy/:id/force-cancel
 *
 * Rules:
 *   - fire-and-forget: never await, never block HTTP response
 *   - Twilio failure → warn log, no rollback
 *   - raw source preserved in logs for audit
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

export type AcademySmsEvent =
  | 'confirmed'
  | 'cancelled_release'
  | 'cancelled_refund';

export type AcademySmsAudience = 'trainer' | 'customer';

// ──────────────────────────────────────────────────────────────────────────────
// Copy builder — canonical Hebrew wording per spec (2.7D)
// ──────────────────────────────────────────────────────────────────────────────
export function buildAcademySmsCopy({
  bookingId,
  trainerName,
  amountCents,
  event,
  audience,
}: {
  bookingId: string;
  trainerName: string;
  amountCents: number;
  event: AcademySmsEvent;
  audience: AcademySmsAudience;
}): string {
  const amountILS = (amountCents / 100).toFixed(2);
  const shortId   = bookingId.slice(-10);

  if (audience === 'trainer') {
    if (event === 'confirmed') {
      return `הזמנה #${shortId} אושרה. החיוב בוצע. סכום: ₪${amountILS}.`;
    }
    return `הזמנה #${shortId} בוטלה. ההחזר יועבר לארנק תוך 24 שעות.`;
  }

  // Customer copy
  if (event === 'confirmed') {
    return `שיעורך עם ${trainerName} אושר! ₪${amountILS} נוכה מהארנק.`;
  }
  if (event === 'cancelled_release') {
    return `שיעורך בוטל. ₪${amountILS} שוחררו חזרה לארנק.`;
  }
  return `שיעורך בוטל. ₪${amountILS} הוחזרו לארנק.`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Phone resolver — trainer: trainers.phone; customer: users.phone
// ──────────────────────────────────────────────────────────────────────────────
async function resolvePhones(trainerUserId: string, customerUserId: string): Promise<{
  trainerPhone: string | null;
  customerPhone: string | null;
  trainerName: string;
}> {
  try {
    const trainerRow: any = await db.execute(sql`
      SELECT first_name, last_name, phone FROM trainers
      WHERE user_id = ${trainerUserId} LIMIT 1
    `);
    const trainer = (trainerRow?.rows ?? trainerRow ?? [])[0] ?? null;

    const customerRow: any = await db.execute(sql`
      SELECT phone FROM users WHERE id = ${customerUserId} LIMIT 1
    `);
    const customer = (customerRow?.rows ?? customerRow ?? [])[0] ?? null;

    return {
      trainerPhone:  trainer?.phone    ?? null,
      customerPhone: customer?.phone   ?? null,
      trainerName:   trainer ? `${trainer.first_name ?? ''} ${trainer.last_name ?? ''}`.trim() : 'המאמן',
    };
  } catch (err: any) {
    logger.warn('[AcademySMS] Phone resolve error (non-blocking)', { error: err.message });
    return { trainerPhone: null, customerPhone: null, trainerName: 'המאמן' };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main dispatcher — called fire-and-forget from every route
// ──────────────────────────────────────────────────────────────────────────────
export function dispatchAcademySms({
  bookingId,
  amountCents,
  event,
  trainerUserId,
  customerUserId,
}: {
  bookingId:      string;
  amountCents:    number;
  event:          AcademySmsEvent;
  trainerUserId:  string;
  customerUserId: string;
}): void {
  // Intentionally not awaited — fire-and-forget
  (async () => {
    try {
      const { twilioSMSService } = await import('./TwilioSMSService');
      const { trainerPhone, customerPhone, trainerName } = await resolvePhones(trainerUserId, customerUserId);

      const sends: Array<{ phone: string; audience: AcademySmsAudience; uid: string }> = [];
      if (trainerPhone)  sends.push({ phone: trainerPhone,  audience: 'trainer',  uid: trainerUserId  });
      if (customerPhone) sends.push({ phone: customerPhone, audience: 'customer', uid: customerUserId });

      for (const { phone, audience, uid } of sends) {
        const body = buildAcademySmsCopy({ bookingId, trainerName, amountCents, event, audience });
        try {
          await twilioSMSService.sendSMS(phone, body, { userId: uid });
          logger.info('[AcademySMS] Sent', {
            bookingId,
            audience,
            event,
            smsType:    `academy_${event}`,
            division:   'academy',
            trainerId:  trainerUserId,
            userId:     customerUserId,
          });
        } catch (err: any) {
          logger.warn('[AcademySMS] Send failed (non-blocking)', {
            bookingId,
            audience,
            smsType:   `academy_${event}`,
            division:  'academy',
            trainerId: trainerUserId,
            userId:    customerUserId,
            error:     err.message,
          });
        }
      }
    } catch (outer: any) {
      logger.warn('[AcademySMS] Dispatcher error (non-blocking)', { bookingId, error: outer.message });
    }
  })();
}
