/**
 * Legacy booking bridge — makes Sitter Suite + Walk My Pet bookings VISIBLE to
 * providers (CEO 2026-07-24 "fix wtf").
 *
 * THE BUG IT FIXES (4-world booking audit):
 *   sitter-suite/BookingFlow → POST /api/sitter-suite/bookings → sitter_bookings
 *   walk-my-pet/BookingFlow  → POST /api/walk-my-pet/walks/book → walk_bookings
 * …but the ONLY live provider job inbox (/provider-os →
 * /api/provider-dashboard/v2/bookings) reads `booking_requests` and nothing
 * else. So the customer saw "waiting for provider approval" while the provider
 * had no screen that could ever show — let alone accept — the job. Every such
 * booking hung at pending_provider forever.
 *
 * THE BRIDGE: on create, mirror the legacy booking into `booking_requests`
 * (the canonical provider-visible table) and notify the provider exactly like
 * the healthy chain does. The legacy row stays the customer-side record; the
 * mirror carries `legacyRef` so a provider accept/decline can be written back
 * (see applyBridgeDecision).
 *
 * Deliberately additive: no legacy behaviour is removed, so nothing that works
 * today can break. Fail-soft — a bridge failure must never fail the booking.
 */
import { db, pool } from '../db';
import { bookingRequests, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../lib/logger';
import { dispatchNotification } from '../lib/notificationDispatcher';
import { createOrUpdateAlert } from './AlertEngine';

export interface BridgeInput {
  ownerId: string;
  providerUserId: string;          // provider's Firebase UID (booking_requests.provider_id)
  providerProfileId?: number | null;
  providerType: 'sitter' | 'walker' | 'trainer';
  serviceType: 'pet_sitting' | 'dog_walking' | 'training';
  startDate: Date;
  endDate: Date;
  petCount?: number;
  subtotalCents: number;
  serviceFeeCents: number;
  totalCents: number;
  providerPayoutCents?: number;
  ownerMessage?: string | null;
  /** The legacy row this mirrors: e.g. { table: 'sitter_bookings', id: 'SIT-…' } */
  legacyRef: { table: string; id: string | number };
}

/** Mirror a legacy booking into booking_requests so providers can see + accept it. */
export async function bridgeLegacyBooking(input: BridgeInput): Promise<{ requestId: string } | null> {
  try {
    if (!input.ownerId || !input.providerUserId) {
      logger.warn('[BookingBridge] missing owner or provider uid — skipping mirror', {
        legacyRef: input.legacyRef,
      });
      return null;
    }

    const requestId = `BR-${new Date().getFullYear()}-${nanoid(8)}`;

    await db.insert(bookingRequests).values({
      requestId,
      ownerId: input.ownerId,
      providerId: input.providerUserId,
      providerProfileId: input.providerProfileId ?? null,
      providerType: input.providerType,
      serviceType: input.serviceType,
      startDate: input.startDate,
      endDate: input.endDate,
      petCount: input.petCount ?? 1,
      subtotalCents: input.subtotalCents,
      serviceFeeCents: input.serviceFeeCents,
      totalCents: input.totalCents,
      providerPayoutCents: input.providerPayoutCents ?? Math.max(0, input.totalCents - input.serviceFeeCents),
      currency: 'ILS',
      status: 'pending',
      ownerMessage: input.ownerMessage ?? null,
      // The back-link: how a provider decision finds the customer's record.
      statusHistory: [
        { status: 'pending', timestamp: new Date().toISOString(), note: `bridged from ${input.legacyRef.table}#${input.legacyRef.id}` },
      ] as any,
      quoteBreakdown: { legacyRef: input.legacyRef, bridged: true } as any,
    } as any);

    // Same notification the healthy chain sends — inbox + email + SMS + push.
    const [providerUser] = await db
      .select({ email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.id, input.providerUserId))
      .limit(1)
      .catch(() => [] as any);

    const label = input.serviceType.replace(/_/g, ' ');
    const base = process.env.APP_URL || 'https://petwash.co.il';
    dispatchNotification({
      uid: input.providerUserId,
      email: providerUser?.email ?? undefined,
      phone: providerUser?.phone ?? undefined,
      type: 'booking_request',
      title: '📅 New Booking Request',
      bodyHtml: `<p>You have a new <strong>${label}</strong> booking request.</p><p><a href="${base}/provider/jobs/${requestId}">Review and respond</a>.</p>`,
      bodyText: `You have a new ${label} booking request. Open your dashboard to accept or decline.`,
      ctaText: 'View Booking',
      ctaUrl: `${base}/provider/jobs/${requestId}`,
      channels: ['inbox', 'email', 'sms', 'push'],
      priority: 10,
      meta: { bookingId: requestId, bridged: true },
    }).catch((err: any) =>
      logger.warn('[BookingBridge] provider notification failed (non-blocking)', { err: err?.message, requestId }),
    );

    logger.info('[BookingBridge] legacy booking mirrored — provider can now see it', {
      requestId, legacyRef: input.legacyRef, providerId: input.providerUserId,
    });
    return { requestId };
  } catch (err: any) {
    // NEVER fail the customer's booking because the mirror failed.
    logger.error('[BookingBridge] mirror failed (booking itself unaffected)', {
      err: err?.message, legacyRef: input.legacyRef,
    });
    // Reliability (invariants §6): a silent mirror failure = an INVISIBLE
    // booking — the customer waits on a provider who has no screen to see it,
    // exactly the "hung forever" bug the bridge exists to fix. Raise a critical,
    // deduped alert keyed on the legacy row so ops can manually bridge/refund
    // instead of the booking disappearing without a trace. Fail-soft.
    createOrUpdateAlert({
      dedupeKey: `bridge_failed:${input.legacyRef.table}:${input.legacyRef.id}`,
      category: 'support',
      severity: 'critical',
      title: 'Booking bridge FAILED — provider cannot see this booking',
      message: `Legacy ${input.legacyRef.table}#${input.legacyRef.id} was NOT mirrored into booking_requests: ${err?.message ?? String(err)}. The customer is waiting on a provider who has no screen to accept it. Manual bridge or refund needed.`,
      linkedEntityType: 'booking',
      linkedEntityId: String(input.legacyRef.id),
      source: 'booking_bridge',
      metadata: {
        legacyRef: input.legacyRef,
        ownerId: input.ownerId,
        providerUserId: input.providerUserId,
        serviceType: input.serviceType,
        error: err?.message ?? String(err),
      },
    }).catch((alertErr: any) =>
      logger.warn('[BookingBridge] failed to raise bridge-failure alert', { err: alertErr?.message }),
    );
    return null;
  }
}

/**
 * Write a provider's accept/decline back to the legacy customer-side row, so
 * the customer stops seeing "waiting for provider" after the provider answers.
 * Fail-soft: the canonical booking_requests row is already updated by the
 * caller; this only syncs the mirror's origin.
 */
export async function applyBridgeDecision(
  quoteBreakdown: any,
  action: 'accept' | 'decline',
): Promise<void> {
  try {
    const ref = quoteBreakdown?.legacyRef;
    if (!ref?.table || ref?.id == null) return;

    // Only the two known legacy tables — never interpolate an arbitrary name.
    const TABLE_STATUS: Record<string, { accept: string; decline: string; idCol: string }> = {
      sitter_bookings: { accept: 'confirmed', decline: 'declined', idCol: 'booking_id' },
      walk_bookings:   { accept: 'confirmed', decline: 'declined', idCol: 'booking_id' },
    };
    const cfg = TABLE_STATUS[ref.table];
    if (!cfg) return;

    const newStatus = action === 'accept' ? cfg.accept : cfg.decline;
    const sqlText = ref.table === 'sitter_bookings'
      ? `UPDATE sitter_bookings SET status = $1, updated_at = NOW() WHERE ${cfg.idCol} = $2`
      : `UPDATE walk_bookings   SET status = $1, updated_at = NOW() WHERE ${cfg.idCol} = $2`;

    await pool.query(sqlText, [newStatus, String(ref.id)]);
    logger.info('[BookingBridge] legacy row synced with provider decision', { ref, action, newStatus });
  } catch (err: any) {
    logger.warn('[BookingBridge] legacy sync failed (canonical row already updated)', { err: err?.message });
  }
}
