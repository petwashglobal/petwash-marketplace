/**
 * Sends the "please confirm end of stay" email to the owner immediately
 * after the provider transitions a booking to 'provider_marked_complete'.
 * Mirrors the sendServiceCompletedReview pattern (direct sender, fail-soft,
 * fire-and-forget) — but for the STEP BEFORE the customer's confirmation,
 * not after.
 *
 * The generic dispatchNotification path also fires from the /complete
 * route to cover SMS + rate-limiting + inbox. This sender is additive:
 * it sends the branded, Rover/MadPaws-parity email so the owner gets a
 * clear one-CTA experience instead of a plaintext blob.
 *
 * Idempotence: safe to call more than once — worst case duplicate email
 * (no money, no state).
 */

import { db } from '../db';
import { users } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { EmailService } from '../emailService';
import { buildConfirmEndOfStayEmail } from './templates/confirm-end-of-stay-2026';

const SERVICE_LABELS_HE: Record<string, string> = {
  sitting: 'שמרטפות', pet_sitting: 'שמרטפות', daycare: 'מעון יומי',
  walking: 'טיול כלבים', dog_walking: 'טיול כלבים',
  training: 'אילוף', grooming: 'טיפוח', k9000_wash: 'שטיפת K9000',
  pet_taxi: 'מונית לחיות',
};
const SERVICE_LABELS_EN: Record<string, string> = {
  sitting: 'Pet Sitting', pet_sitting: 'Pet Sitting', daycare: 'Daycare',
  walking: 'Dog Walking', dog_walking: 'Dog Walking',
  training: 'Training', grooming: 'Grooming', k9000_wash: 'K9000 Wash',
  pet_taxi: 'Pet Taxi',
};

export async function sendConfirmEndOfStay(booking: {
  requestId: string;
  ownerId: string;
  providerId: string;
  serviceType?: string | null;
  petDetails?: unknown;
  endDate?: Date | string | null;
  serviceCompletedAt?: Date | string | null;
}): Promise<void> {
  try {
    const [owner] = await db
      .select({ email: users.email, first: users.firstName })
      .from(users)
      .where(or(eq(users.id, booking.ownerId), eq(users.firebaseUid, booking.ownerId)))
      .limit(1);
    if (!owner?.email) return;

    const [provider] = await db
      .select({ first: users.firstName, last: users.lastName })
      .from(users)
      .where(or(eq(users.id, booking.providerId), eq(users.firebaseUid, booking.providerId)))
      .limit(1);

    const pets = Array.isArray(booking.petDetails) ? (booking.petDetails as any[]) : [];
    const petName = pets[0]?.name || pets[0]?.petName || undefined;
    const serviceKey = String(booking.serviceType || '');
    const serviceLabelHe = SERVICE_LABELS_HE[serviceKey] || 'השירות';
    const serviceLabelEn = SERVICE_LABELS_EN[serviceKey] || 'the service';

    const end = booking.endDate
      ? new Date(booking.endDate)
      : booking.serviceCompletedAt
        ? new Date(booking.serviceCompletedAt)
        : new Date();

    const providerName =
      [provider?.first, provider?.last].filter(Boolean).join(' ') || (
        // If we can't resolve a name, avoid using the raw UID — fall back to
        // a generic role so the email doesn't say "with UID abc123".
        'your provider'
      );

    const html = buildConfirmEndOfStayEmail({
      language: 'he',
      bookingRef: booking.requestId,
      firstName: owner.first || '',
      providerName,
      serviceLabelHe,
      serviceLabelEn,
      petName,
      endDateHe: end.toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' }),
      endDateEn: end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      confirmUrl: `https://petwash.co.il/booking/confirmation/${booking.requestId}`,
      autoApproveHours: 24,
    });

    await EmailService.send({
      to: owner.email,
      subject: `PetWash™ — ההזמנה עם ${providerName} הסתיימה? / Confirm end of stay`,
      html,
    });
    logger.info('[ConfirmEndOfStay] Email sent', { requestId: booking.requestId });
  } catch (err: any) {
    logger.warn('[ConfirmEndOfStay] Send failed (non-blocking)', {
      requestId: booking.requestId, error: err?.message,
    });
  }
}
