/**
 * Per-service provider approval gate (DB-backed wrapper around the pure ladder
 * in shared/provider-service-levels.ts).
 *
 * `assertServiceApproved(providerId, serviceType, level)` is the single check
 * booking / payout paths call before letting a provider act. Safe by default:
 * no row, paused, suspended, rejected, expired, or needs-reconfirmation → BLOCKED.
 *
 * IDENTITY: provider_services.provider_id is keyed by the provider's Firebase UID
 * (the stable identity used by provider applications and contractor_earnings).
 * Callers on the numeric-providers.id rail (super_app_payouts) MUST resolve the
 * UID via providers.userId before calling these functions.
 */
import { db } from '../db';
import { and, eq } from 'drizzle-orm';
import { providerServices } from '@shared/schema-provider-services';
import {
  isServiceApprovedFor,
  normalizeServiceType,
  type ServiceLevel,
  type ServiceApprovalResult,
  type ServiceRowLike,
} from '@shared/provider-service-levels';

export type { ServiceLevel, ServiceApprovalResult };
export { isServiceApprovedFor, normalizeServiceType };

/** Map a target level to the (serviceStatus, flags) it should set. */
const LEVEL_TO_STATE: Record<
  ServiceLevel,
  { serviceStatus: string; profileVisible: boolean; bookingEnabled: boolean; payoutEnabled: boolean }
> = {
  waitlist: { serviceStatus: 'approved_for_waitlist', profileVisible: false, bookingEnabled: false, payoutEnabled: false },
  profile:  { serviceStatus: 'approved_for_profile_display', profileVisible: true, bookingEnabled: false, payoutEnabled: false },
  booking:  { serviceStatus: 'approved_for_booking', profileVisible: true, bookingEnabled: true, payoutEnabled: false },
  payout:   { serviceStatus: 'approved_for_payout', profileVisible: true, bookingEnabled: true, payoutEnabled: true },
};

/** DB-backed check used by booking + payout paths. serviceType is normalised. */
export async function assertServiceApproved(
  providerId: string,
  serviceType: string,
  level: ServiceLevel,
): Promise<ServiceApprovalResult> {
  const svc = normalizeServiceType(serviceType);
  const [row] = await db
    .select()
    .from(providerServices)
    .where(and(eq(providerServices.providerId, providerId), eq(providerServices.serviceType, svc)))
    .limit(1);
  return isServiceApprovedFor(row as ServiceRowLike | undefined, level);
}

/**
 * Does this provider have ANY provider_services rows at all?
 *
 * Used by the BOOKING gate to distinguish a LEGACY provider (approved before this
 * per-service system existed — has zero rows → fail-OPEN so we don't break a live
 * provider) from a provider who IS in the system but explicitly not approved for
 * a given service (has rows → the absence/denial of the specific service BLOCKS).
 *
 * NOTE: deliberately NOT used by the payout gate — payout is fail-CLOSED, so a
 * provider with no rows is still held, not paid.
 */
export async function providerHasAnyServiceRows(providerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: providerServices.id })
    .from(providerServices)
    .where(eq(providerServices.providerId, providerId))
    .limit(1);
  return !!row;
}

/**
 * Resolve the FULL set of service types an applicant selected (#136-3 fix).
 *
 * Multi-service selection is captured in the onboarding UI and sent as the
 * `providerTypes` array — but the provider_applications table has only the
 * singular `provider_type` column, so the full array is persisted inside
 * internalNotes JSON at apply time. Both approval paths used to read a
 * non-existent `application.providerTypes` / `serviceTypes` column and therefore
 * silently seeded only the primary service (or, on one path, none) — so a
 * provider who applied as sitter + walker + trainer got approved for sitter only.
 *
 * This reads every real location, in priority order:
 *   1. a real array column, if one is ever added (providerTypes / serviceTypes)
 *   2. the `providerTypes` array persisted inside internalNotes JSON
 *   3. the singular `provider_type` column (the primary — never returns empty
 *      when the applicant has at least a primary service)
 */
export function resolveApplicationServiceTypes(application: any): string[] {
  const direct = application?.providerTypes ?? application?.serviceTypes;
  if (Array.isArray(direct) && direct.length > 0) return direct.map(String);

  try {
    const notes = application?.internalNotes;
    if (notes) {
      const parsed = typeof notes === 'string' ? JSON.parse(notes) : notes;
      const fromNotes = parsed?.providerTypes;
      if (Array.isArray(fromNotes) && fromNotes.length > 0) return fromNotes.map(String);
    }
  } catch { /* malformed internalNotes → fall through to the primary column */ }

  return application?.providerType ? [String(application.providerType)] : [];
}

/**
 * Idempotently seed provider_services rows at the waitlist level for each of the
 * applicant's service types. Called from admin application approval. Existing
 * rows are left untouched (so a re-approval never downgrades an advanced
 * service). Returns the canonical service types that now have a row.
 */
export async function seedProviderServicesOnApproval(
  providerId: string,
  serviceTypes: string[] | null | undefined,
): Promise<Array<{ serviceType: string; serviceStatus: string; bookingEnabled: boolean; payoutEnabled: boolean }>> {
  const canonical = Array.from(
    new Set((serviceTypes ?? []).map((s) => normalizeServiceType(s)).filter(Boolean)),
  );
  const result: Array<{ serviceType: string; serviceStatus: string; bookingEnabled: boolean; payoutEnabled: boolean }> = [];
  for (const svc of canonical) {
    // INSERT ... ON CONFLICT DO NOTHING via the unique(provider_id, service_type).
    await db
      .insert(providerServices)
      .values({
        providerId,
        serviceType: svc,
        serviceStatus: 'approved_for_waitlist',
        profileVisible: false,
        bookingEnabled: false,
        payoutEnabled: false,
      })
      .onConflictDoNothing({ target: [providerServices.providerId, providerServices.serviceType] });

    const [row] = await db
      .select()
      .from(providerServices)
      .where(and(eq(providerServices.providerId, providerId), eq(providerServices.serviceType, svc)))
      .limit(1);
    if (row) {
      result.push({
        serviceType: row.serviceType,
        serviceStatus: row.serviceStatus,
        bookingEnabled: row.bookingEnabled,
        payoutEnabled: row.payoutEnabled,
      });
    }
  }
  return result;
}

/**
 * Advance ONE service to a target level (waitlist→profile→booking→payout).
 * Creates the row if missing. Returns the updated row state.
 */
export async function setProviderServiceLevel(
  providerId: string,
  serviceType: string,
  level: ServiceLevel,
): Promise<{ serviceType: string; serviceStatus: string; profileVisible: boolean; bookingEnabled: boolean; payoutEnabled: boolean }> {
  const svc = normalizeServiceType(serviceType);
  const state = LEVEL_TO_STATE[level];
  const now = new Date();

  await db
    .insert(providerServices)
    .values({
      providerId,
      serviceType: svc,
      serviceStatus: state.serviceStatus,
      profileVisible: state.profileVisible,
      bookingEnabled: state.bookingEnabled,
      payoutEnabled: state.payoutEnabled,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [providerServices.providerId, providerServices.serviceType],
      set: {
        serviceStatus: state.serviceStatus,
        profileVisible: state.profileVisible,
        bookingEnabled: state.bookingEnabled,
        payoutEnabled: state.payoutEnabled,
        updatedAt: now,
      },
    });

  const [row] = await db
    .select()
    .from(providerServices)
    .where(and(eq(providerServices.providerId, providerId), eq(providerServices.serviceType, svc)))
    .limit(1);

  return {
    serviceType: row.serviceType,
    serviceStatus: row.serviceStatus,
    profileVisible: row.profileVisible,
    bookingEnabled: row.bookingEnabled,
    payoutEnabled: row.payoutEnabled,
  };
}
