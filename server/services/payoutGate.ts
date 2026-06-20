/**
 * Pre-release payout gate chain — fail-CLOSED.
 *
 * Before ANY money moves toward a provider (escrow release on either rail), every
 * gate below must pass. If a gate's required data is genuinely unavailable, we
 * HOLD (return ok:false) rather than pay — money is fail-closed.
 *
 * Gates (legal/ops spec):
 *   (a) booking/service status == completed
 *   (b) refund window cleared (serviceCompletedAt + REFUND_WINDOW_HOURS, default 48)
 *   (c) provider tax verificationStatus == 'verified'
 *   (d) no OPEN dispute for the booking
 *   (e) assertServiceApproved(provider UID, serviceType, 'payout') ok
 *
 * The pre-existing INSURANCE gate is intentionally NOT duplicated here — it stays
 * enforced in-place in both releaseEscrow paths. This helper is additive on top.
 *
 * IDENTITY: providerUid MUST be the provider's Firebase UID. Callers on the
 * numeric-providers.id rail resolve it via providers.userId before calling.
 */
import { db } from '../db';
import { and, eq, sql } from 'drizzle-orm';
import { bookings, bookingRequests, providers } from '@shared/schema';
import { bookingDisputes } from '@shared/schema';
import { assertServiceApproved } from './providerServiceApproval';
import { logger } from '../lib/logger';

export const REFUND_WINDOW_HOURS = Number(process.env.PAYOUT_REFUND_WINDOW_HOURS || 48);

export interface PayoutGateResult {
  ok: boolean;
  /** machine code for the first failing gate (or 'OK') */
  reason: string;
  /** human-readable hold reason for status/audit */
  message: string;
}

export interface PayoutGateInput {
  /** Provider Firebase UID (NOT numeric providers.id). */
  providerUid: string;
  /** Service type (any vocabulary — normalised inside the approval gate). */
  serviceType?: string | null;
  /** Booking reference — may be bookings.id (uuid) or bookingRequests.requestId. */
  bookingId?: string | null;
  /** Optional contractor type fallback for service mapping (sitter|walker|driver). */
  contractorType?: string | null;
}

const CONTRACTOR_TYPE_TO_SERVICE: Record<string, string> = {
  sitter: 'pet_sitting',
  walker: 'dog_walking',
  driver: 'pet_transport',
};

/**
 * Resolve the booking row for status/completion/refund checks, trying both the
 * unified `bookings` table (uuid id) and the marketplace `booking_requests`
 * table (requestId). Returns a normalised view, or null if not found.
 */
async function resolveBooking(bookingId: string): Promise<
  | { status: string; serviceType: string | null; completedAt: Date | null }
  | null
> {
  // Unified bookings (uuid PK)
  const [b] = await db
    .select({ status: bookings.status, serviceType: bookings.serviceType, completedAt: bookings.completedAt })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (b) return { status: b.status, serviceType: b.serviceType, completedAt: b.completedAt ?? null };

  // Marketplace booking_requests (requestId)
  const [r] = await db
    .select({
      status: bookingRequests.status,
      serviceType: bookingRequests.serviceType,
      completedAt: bookingRequests.serviceCompletedAt,
      ownerConfirmedAt: bookingRequests.ownerConfirmedAt,
    })
    .from(bookingRequests)
    .where(eq(bookingRequests.requestId, bookingId))
    .limit(1);
  if (r) {
    return {
      status: r.status as string,
      serviceType: r.serviceType,
      // prefer explicit service-completion, else owner-confirmation timestamp
      completedAt: (r.completedAt as Date | null) ?? (r.ownerConfirmedAt as Date | null) ?? null,
    };
  }
  return null;
}

const COMPLETED_STATUSES = new Set(['completed', 'service_completed', 'confirmed_complete']);
const OPEN_DISPUTE_STATUSES = new Set(['open', 'under_review', 'pending', 'escalated']);

/**
 * Run the full fail-CLOSED gate chain. Returns ok:false (HOLD) on ANY failure
 * or any genuinely-unavailable input. Never throws — a thrown error inside is
 * caught and converted to a HOLD.
 */
export async function checkPayoutGates(input: PayoutGateInput): Promise<PayoutGateResult> {
  try {
    const { providerUid, bookingId } = input;

    if (!providerUid) {
      return { ok: false, reason: 'NO_PROVIDER_UID', message: 'Provider identity unavailable — payout held.' };
    }

    // ── Resolve the booking (needed for completion + refund window + dispute) ──
    let booking: Awaited<ReturnType<typeof resolveBooking>> = null;
    if (bookingId) {
      booking = await resolveBooking(bookingId);
    }
    // Gate (a): completion. If we cannot prove completion, HOLD.
    if (!booking) {
      return {
        ok: false,
        reason: 'BOOKING_NOT_FOUND',
        message: `Booking ${bookingId ?? '(none)'} not found — cannot confirm completion; payout held.`,
      };
    }
    if (!COMPLETED_STATUSES.has(String(booking.status))) {
      return {
        ok: false,
        reason: 'NOT_COMPLETED',
        message: `Booking status is "${booking.status}", not completed — payout held.`,
      };
    }

    // Gate (b): refund window cleared.
    if (!booking.completedAt) {
      return { ok: false, reason: 'NO_COMPLETION_TIMESTAMP', message: 'No service-completion timestamp — refund window cannot be verified; payout held.' };
    }
    const releaseAfter = new Date(booking.completedAt.getTime() + REFUND_WINDOW_HOURS * 60 * 60 * 1000);
    if (Date.now() < releaseAfter.getTime()) {
      return {
        ok: false,
        reason: 'REFUND_WINDOW_OPEN',
        message: `Refund window not cleared (releases ${releaseAfter.toISOString()}) — payout held.`,
      };
    }

    // Gate (d): no OPEN dispute for the booking.
    if (bookingId) {
      const [dispute] = await db
        .select({ status: bookingDisputes.status })
        .from(bookingDisputes)
        .where(eq(bookingDisputes.bookingId, bookingId))
        .limit(1);
      if (dispute && OPEN_DISPUTE_STATUSES.has(String(dispute.status))) {
        return { ok: false, reason: 'OPEN_DISPUTE', message: `An open dispute (${dispute.status}) exists for this booking — payout held.` };
      }
    }

    // Gate (c): provider tax verificationStatus == 'verified'.
    // providers.verificationStatus is keyed by the numeric row; look up by UID.
    const [provider] = await db
      .select({ verificationStatus: providers.verificationStatus })
      .from(providers)
      .where(eq(providers.userId, providerUid))
      .limit(1);
    if (!provider) {
      return { ok: false, reason: 'PROVIDER_NOT_FOUND', message: 'Provider record not found — cannot verify tax status; payout held.' };
    }
    if (String(provider.verificationStatus) !== 'verified') {
      return {
        ok: false,
        reason: 'TAX_NOT_VERIFIED',
        message: `Provider tax verificationStatus is "${provider.verificationStatus}", not verified — payout held.`,
      };
    }

    // Gate (e): per-service payout approval.
    const serviceType =
      input.serviceType ||
      booking.serviceType ||
      (input.contractorType ? CONTRACTOR_TYPE_TO_SERVICE[input.contractorType] : undefined);
    if (!serviceType) {
      return { ok: false, reason: 'NO_SERVICE_TYPE', message: 'Could not determine service type for payout-approval check — payout held.' };
    }
    const svcGate = await assertServiceApproved(providerUid, serviceType, 'payout');
    if (!svcGate.ok) {
      return {
        ok: false,
        reason: `SERVICE_NOT_APPROVED_FOR_PAYOUT:${svcGate.reason ?? 'UNKNOWN'}`,
        message: `Service "${serviceType}" is not approved for payout (${svcGate.reason}) — payout held.`,
      };
    }

    // Gate (f): manual identity verification ("PENDING PETWASH REVIEW").
    // Flag-gated (PROVIDER_PAYOUT_STRICT, default off) so it can't freeze existing
    // payouts before the manual-verification flow is in routine use. When armed,
    // require an admin-approved provider_verification_review for this provider UID,
    // and that the provider's bank account is verified. Fail-closed within the flag.
    if ((process.env.PROVIDER_PAYOUT_STRICT || 'off').toLowerCase() === 'on') {
      const idRes: any = await db.execute(sql`
        SELECT 1 FROM provider_verification_reviews
        WHERE provider_id = ${providerUid} AND review_status = 'approved'
        ORDER BY created_at DESC LIMIT 1
      `);
      const idOk = (idRes?.rows ?? idRes ?? []).length > 0;
      if (!idOk) {
        return { ok: false, reason: 'IDENTITY_NOT_VERIFIED', message: 'Provider identity not yet accepted by PetWash review — payout held.' };
      }

      // Bank-verified check is best-effort: the bank flag lives on a payout-details
      // table whose shape varies, so this is fail-OPEN (a lookup error skips it
      // rather than freezing the identity-verified gate). Wire the exact table here
      // once confirmed to make it a hard gate too.
      try {
        const bankRes: any = await db.execute(sql`
          SELECT bank_account_verified
          FROM provider_payout_details WHERE user_id = ${providerUid} LIMIT 1
        `);
        const bankRow = (bankRes?.rows ?? bankRes ?? [])[0];
        if (bankRow && bankRow.bank_account_verified === false) {
          return { ok: false, reason: 'BANK_NOT_VERIFIED', message: 'Provider bank account not verified — payout held.' };
        }
      } catch {
        // fail-open — identity gate above is the hard requirement.
      }
    }

    return { ok: true, reason: 'OK', message: 'All payout gates passed.' };
  } catch (err: any) {
    // Fail-CLOSED: any unexpected error means we cannot prove the money is safe.
    logger.error('[PayoutGate] Gate chain error — failing CLOSED (hold)', { error: err?.message, input });
    return { ok: false, reason: 'GATE_ERROR', message: 'Payout gate check failed unexpectedly — payout held (fail-closed).' };
  }
}
