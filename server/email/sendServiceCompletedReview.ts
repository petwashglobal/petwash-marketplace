/**
 * Sends the service-completed + review-request email for a completed
 * booking_requests row. 2026-07-30: buildServiceCompletedEmail existed with
 * ZERO callers and the event-driven path needed DB templates that were never
 * seeded — so no customer was ever asked for a review. This is the ONE direct
 * sender, called from BOTH completion paths (customer /confirm + the 24h
 * auto-approve cron). Fail-soft: a review email must never affect the
 * completion transaction. Idempotence: callers fire it once per completion
 * transition; a duplicate send is harmless (no money, no state).
 */
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { buildServiceCompletedEmail } from './templates/service-completed-review-2026';
import { EmailService } from '../emailService';

const SERVICE_LABELS_HE: Record<string, string> = {
  sitting: 'שמרטפות', pet_sitting: 'שמרטפות', daycare: 'מעון יומי',
  walking: 'טיול כלבים', dog_walking: 'טיול כלבים',
  training: 'אילוף', grooming: 'טיפוח',
};

export async function sendServiceCompletedReview(booking: {
  requestId: string;
  ownerId: string;
  providerId: string;
  serviceType?: string | null;
  totalCents?: number | null;
  petDetails?: unknown;
  endDate?: Date | string | null;
}): Promise<void> {
  try {
    const [owner] = await db
      .select({ email: users.email, first: users.firstName, tier: users.loyaltyTier })
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
    const petName = pets[0]?.name || pets[0]?.petName || 'חבר על ארבע';
    const serviceLabel = SERVICE_LABELS_HE[String(booking.serviceType || '')] || 'השירות';
    const end = booking.endDate ? new Date(booking.endDate) : new Date();
    const confirmationUrl = `https://petwash.co.il/booking/confirmation/${booking.requestId}`;

    const html = buildServiceCompletedEmail({
      language: 'he',
      bookingRef: booking.requestId,
      customerName: owner.first || '',
      firstName: owner.first || '',
      providerName: [provider?.first, provider?.last].filter(Boolean).join(' ') || 'הספק שלך',
      serviceLabel,
      serviceIcon: '🐾',
      petName,
      dateFormatted: end.toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' }),
      priceFormatted: `₪${(((booking.totalCents ?? 0)) / 100).toFixed(2)}`,
      // Loyalty summary is best-effort display — 0 is honest when the earn
      // engine hasn't posted yet; the template still renders the tier.
      loyaltyPointsEarned: 0,
      loyaltyTotalPoints: 0,
      loyaltyTier: owner.tier || 'Member',
      reviewUrl: `${confirmationUrl}?review=1`,
      bookAgainUrl: 'https://petwash.co.il/marketplace',
      dashboardUrl: 'https://petwash.co.il/my-bookings',
    });

    await EmailService.send({
      to: owner.email,
      subject: `🐾 ${serviceLabel} הושלם — נשמח לחוות דעתך | PetWash™`,
      html,
    });
    logger.info('[ServiceCompletedReview] review email sent', { requestId: booking.requestId });
  } catch (err: any) {
    logger.warn('[ServiceCompletedReview] send failed (non-blocking)', {
      requestId: booking.requestId, error: err?.message,
    });
  }
}
