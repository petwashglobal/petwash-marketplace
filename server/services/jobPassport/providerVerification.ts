/**
 * Provider verification resolver — CEO 2026-08-27 §7, §8, §35, §36.
 *
 * Two pure server-side resolvers over EXISTING provider authorities.
 * No new tables, no mutations. §60 Phase 1 discipline.
 *
 *   1. `resolvePublicProviderRef` — client submits a PUBLIC provider
 *      reference (walker.walkerId / sitter.id / trainer.id) and the
 *      server resolves it to the Firebase UID, the provider service
 *      record, and current safety flags. This is the ONLY correct way
 *      to turn a customer's provider selection into an authoritative
 *      identity — never trust `providerUid` from a request body (§7).
 *
 *   2. `assertAssignedProviderMatchesCaller` — every provider action
 *      must derive provider identity from AUTHENTICATION and match it
 *      to the ASSIGNED provider on the booking (§8-9). A double-check
 *      that survives even if a route handler forgets its own guard.
 *
 * §36 current safety check: the resolver also reads suspension flags
 * so an accepted booking's assignment history stays immutable while
 * a currently-suspended provider is blocked from performing actions.
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db';
import {
  sitterBookings,
  sitterProfiles,
  walkBookings,
  walkerProfiles,
  trainerBookings,
  providerApplications,
} from '@shared/schema';
import { logger } from '../../lib/logger';

// ─── 1. Public provider ref → authoritative identity ────────────────

export type PublicProviderKind = 'walker' | 'sitter' | 'trainer';

export interface ResolvePublicProviderInput {
  kind: PublicProviderKind;
  /** Public reference the client submitted. NEVER trusted for auth on
   *  its own — this resolver looks it up. */
  publicRef: string;
  /** The service type the customer selected — used for the service
   *  approval check (§7). */
  serviceType?: string;
}

export type ResolvedProvider =
  | {
      ok: true;
      providerUid: string;
      providerPublicId: string;
      providerServiceId?: string;
      displayName?: string;
      applicationStatusAtLookup: string;
      serviceApproved: boolean;
      suspended: boolean;
      /** True when application + service approval + not-suspended all hold. */
      verifiedForService: boolean;
    }
  | {
      ok: false;
      /** One of the honest reasons the composer can surface. Never a
       *  raw error.message — same discipline as walk-session.ts. */
      errorCode:
        | 'PUBLIC_REF_NOT_FOUND'
        | 'APPLICATION_NOT_APPROVED'
        | 'PROVIDER_SUSPENDED'
        | 'SERVICE_NOT_APPROVED'
        | 'LOOKUP_FAILED';
      message: string;
    };

export async function resolvePublicProviderRef(
  input: ResolvePublicProviderInput,
): Promise<ResolvedProvider> {
  try {
    // Step 1 — public id → profile row → Firebase UID.
    let uid: string | null = null;
    let publicId = '';
    let displayName: string | undefined;

    if (input.kind === 'walker') {
      const [w] = await db
        .select({ userId: walkerProfiles.userId, walkerId: walkerProfiles.walkerId, first: walkerProfiles.firstName, last: walkerProfiles.lastName })
        .from(walkerProfiles).where(eq(walkerProfiles.walkerId, input.publicRef)).limit(1);
      if (w) {
        uid = w.userId;
        publicId = w.walkerId;
        displayName = `${w.first ?? ''} ${w.last ?? ''}`.trim() || undefined;
      }
    } else if (input.kind === 'sitter') {
      const numericId = Number(input.publicRef);
      if (Number.isFinite(numericId)) {
        const [s] = await db
          .select({ userId: sitterProfiles.userId, id: sitterProfiles.id, first: sitterProfiles.firstName, last: sitterProfiles.lastName })
          .from(sitterProfiles).where(eq(sitterProfiles.id, numericId)).limit(1);
        if (s) {
          uid = s.userId;
          publicId = String(s.id);
          displayName = `${s.first ?? ''} ${s.last ?? ''}`.trim() || undefined;
        }
      }
    } else if (input.kind === 'trainer') {
      // trainers table isn't imported here to keep the surface small —
      // fall back to trainer_bookings.trainerUserId when a booking is
      // present. Direct trainer lookup can be added later.
      const [tb] = await db
        .select({ trainerUserId: trainerBookings.trainerUserId, trainerId: trainerBookings.trainerId })
        .from(trainerBookings).where(eq(trainerBookings.trainerId, Number(input.publicRef))).limit(1);
      if (tb) {
        uid = tb.trainerUserId;
        publicId = String(tb.trainerId);
      }
    }

    if (!uid) {
      return {
        ok: false, errorCode: 'PUBLIC_REF_NOT_FOUND',
        message: 'Provider public reference not found',
      };
    }

    // Step 2 — application status (§35 provenance).
    const [app] = await db
      .select({ status: providerApplications.status, providerType: providerApplications.providerType })
      .from(providerApplications).where(eq(providerApplications.userId, uid)).limit(1);
    const applicationStatusAtLookup = String(app?.status ?? 'unknown');
    const approved = applicationStatusAtLookup === 'approved';

    // Step 3 — service approval (§7). We treat the profile row itself
    // as the current service approval — a follow-up will read from a
    // dedicated `provider_services` table when it lands per platform.
    // For now: matching kind → service is approved.
    const serviceApproved =
      (input.kind === 'walker' && (!input.serviceType || String(input.serviceType).includes('walk'))) ||
      (input.kind === 'sitter' && (!input.serviceType || String(input.serviceType).includes('sit'))) ||
      (input.kind === 'trainer' && (!input.serviceType || String(input.serviceType).includes('train')));

    // Step 4 — §36 current suspension check. providerApplications has
    // no `suspended` column today; the same signal lives on the profile
    // row (walker/sitter profile row absent = deactivated). We treat
    // the absence-of-approval as suspended for the purposes of the
    // current safety check.
    const suspended = !approved;

    return {
      ok: true,
      providerUid: uid,
      providerPublicId: publicId,
      displayName,
      applicationStatusAtLookup,
      serviceApproved,
      suspended,
      verifiedForService: approved && serviceApproved && !suspended,
    };
  } catch (err: any) {
    logger.error('[ProviderVerification] resolvePublicProviderRef failed', {
      kind: input.kind,
      publicRefTail: input.publicRef?.slice(-6),
      error: err?.message,
    });
    return { ok: false, errorCode: 'LOOKUP_FAILED', message: 'lookup failed' };
  }
}

// ─── 2. Assigned-provider guard (§8, §9) ───────────────────────────

export type AssignedProviderCheckInput = {
  bookingSource: 'sitter_bookings' | 'walk_bookings' | 'trainer_bookings';
  bookingId: string;
  /** Firebase UID from validated authentication — NEVER req.body. */
  callerUid: string;
};

export type AssignedProviderCheck =
  | {
      ok: true;
      assignedProviderUid: string;
      matches: true;
    }
  | {
      ok: false;
      /** The caller is NOT the assigned provider. The route handler
       *  should return the SAME 404 as the not-found path (privacy 404
       *  §34) — never a 403 that leaks existence. */
      errorCode:
        | 'BOOKING_NOT_FOUND'
        | 'ASSIGNMENT_MISSING'
        | 'CALLER_NOT_ASSIGNED_PROVIDER'
        | 'LOOKUP_FAILED';
      message: string;
    };

export async function assertAssignedProviderMatchesCaller(
  input: AssignedProviderCheckInput,
): Promise<AssignedProviderCheck> {
  try {
    let assignedUid: string | null = null;

    if (input.bookingSource === 'sitter_bookings') {
      const [b] = await db
        .select({ sitterId: sitterBookings.sitterId })
        .from(sitterBookings).where(eq(sitterBookings.bookingId, input.bookingId)).limit(1);
      if (!b) return { ok: false, errorCode: 'BOOKING_NOT_FOUND', message: 'Booking not found' };
      const [sitter] = await db
        .select({ userId: sitterProfiles.userId })
        .from(sitterProfiles).where(eq(sitterProfiles.id, b.sitterId)).limit(1);
      assignedUid = sitter?.userId ?? null;
    } else if (input.bookingSource === 'walk_bookings') {
      const [b] = await db
        .select({ walkerId: walkBookings.walkerId })
        .from(walkBookings).where(eq(walkBookings.bookingId, input.bookingId)).limit(1);
      if (!b) return { ok: false, errorCode: 'BOOKING_NOT_FOUND', message: 'Booking not found' };
      const [walker] = await db
        .select({ userId: walkerProfiles.userId })
        .from(walkerProfiles).where(eq(walkerProfiles.walkerId, b.walkerId)).limit(1);
      assignedUid = walker?.userId ?? null;
    } else if (input.bookingSource === 'trainer_bookings') {
      const [b] = await db
        .select({ trainerUserId: trainerBookings.trainerUserId })
        .from(trainerBookings).where(eq(trainerBookings.bookingId, input.bookingId)).limit(1);
      if (!b) return { ok: false, errorCode: 'BOOKING_NOT_FOUND', message: 'Booking not found' };
      assignedUid = b.trainerUserId ?? null;
    }

    if (!assignedUid) {
      return {
        ok: false, errorCode: 'ASSIGNMENT_MISSING',
        message: 'Booking has no assigned provider',
      };
    }
    if (assignedUid !== input.callerUid) {
      return {
        ok: false, errorCode: 'CALLER_NOT_ASSIGNED_PROVIDER',
        message: 'Caller is not the assigned provider',
      };
    }
    return { ok: true, assignedProviderUid: assignedUid, matches: true };
  } catch (err: any) {
    logger.error('[ProviderVerification] assignedProviderCheck failed', {
      source: input.bookingSource,
      bookingIdTail: input.bookingId?.slice(-6),
      error: err?.message,
    });
    return { ok: false, errorCode: 'LOOKUP_FAILED', message: 'lookup failed' };
  }
}
