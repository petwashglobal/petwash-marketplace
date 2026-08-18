/**
 * PublicWalkerProfileDTO — the explicit allowlist of walker fields that
 * may be exposed via unauthenticated / marketplace-scoped endpoints.
 *
 * Per CEO 2026-08-18 §P0-2: the walker profile table (walker_profiles,
 * shared/schema.ts:4735-4842) mixes marketing display with KYC status,
 * banking, commission, biometric and admin ops fields. Any endpoint
 * that does `.select().from(walkerProfiles)` and returns the row is a
 * PII / financial / security leak — a new sensitive column added later
 * would silently ship to the public. Explicit allowlist + `projectPublicWalker`
 * make that impossible: unknown fields simply cannot be projected.
 *
 * Categories per the 2026-08-18 audit (agent 2):
 *
 *   PUBLIC (in this DTO):
 *     display info (name, photo, bio), city + service area, experience,
 *     specialisations, approved certifications, aggregate rating,
 *     pricing headline, feature flags a customer needs to see, activity
 *     booleans. All the fields the marketplace + walker-detail page
 *     legitimately consume today (agent 2 cross-referenced client uses).
 *
 *   NOT PUBLIC (never projected here — must NOT be added to this shape):
 *     userId (Firebase UID), currentLatitude, currentLongitude,
 *     kycCompleted, backgroundCheckStatus, backgroundCheckDate,
 *     selfiePhotoUrl, governmentIdUrl, biometricMatchScore,
 *     biometricVerifiedAt, bankAccountVerified, nayaxPayoutAccountId,
 *     commissionRate, suspensionReason, suspendedUntil,
 *     instantBookMinTrust, acceptanceRate, maxDailyWalks, updatedAt,
 *     raw verificationStatus enum, session/audit records.
 *
 * `verificationStatus` is DERIVED to a boolean `isVerified` — never
 * expose the raw enum (which may reveal "suspended" or "rejected"
 * states to the public).
 */

export interface PublicWalkerProfileDTO {
  id: number;
  walkerId: string;

  displayName: string;
  profilePhotoUrl: string | null;
  bio: string | null;

  city: string | null;
  citySymbol: string | null;
  country: string | null;
  serviceRadiusKm: number | null;

  yearsOfExperience: number | null;
  specializations: unknown | null;
  certifications: unknown | null;

  averageRating: number | null;
  totalReviews: number;
  totalWalks: number;
  responseTimeMinutes: number | null;

  hasBodyCamera: boolean;
  hasDroneAccess: boolean;
  hasFirstAidKit: boolean;
  hasCarTransport: boolean;

  baseHourlyRate: number | null;
  minimumMinutes: number | null;
  currency: string;

  walkPackages: unknown | null;
  extraServices: unknown | null;

  isVerified: boolean;       // derived from verificationStatus
  isAvailable: boolean;
  isActive: boolean;
  instantBookEnabled: boolean;

  memberSince: number | null; // year only, from createdAt
}

/**
 * Project a raw walker_profiles row into the safe public shape. Callers
 * MUST invoke this at every public endpoint — never `res.json({ walker })`
 * with the raw row.
 *
 * `row` is typed loosely because different Drizzle select shapes and
 * hand-written SQL results reach this projector; the projector only
 * reads via property access and always coerces to a safe default.
 */
export function projectPublicWalker(row: any): PublicWalkerProfileDTO | null {
  if (!row || typeof row !== 'object') return null;

  const num = (v: unknown): number | null => {
    if (v == null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const bool = (v: unknown, dflt = false): boolean =>
    v == null ? dflt : v === true || v === 't' || v === 'true' || v === 1;
  const memberYear = (): number | null => {
    const raw = row.createdAt ?? row.created_at;
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
  };

  const displayName: string =
    (row.displayName as string | undefined)?.toString().trim()
    || [row.firstName, row.lastName].filter(Boolean).join(' ').trim()
    || 'PetWash walker';

  const rawVerification = (row.verificationStatus ?? row.verification_status ?? '').toString().toLowerCase();

  return {
    id: typeof row.id === 'number' ? row.id : Number(row.id),
    walkerId: (row.walkerId ?? row.walker_id ?? '').toString(),

    displayName,
    profilePhotoUrl: (row.profilePhotoUrl ?? row.profile_photo_url ?? null) as string | null,
    bio: (row.bio ?? null) as string | null,

    city: (row.city ?? null) as string | null,
    citySymbol: (row.citySymbol ?? row.city_symbol ?? null) as string | null,
    country: (row.country ?? null) as string | null,
    serviceRadiusKm: num(row.serviceRadiusKm ?? row.service_radius_km),

    yearsOfExperience: num(row.yearsOfExperience ?? row.years_of_experience),
    specializations: row.specializations ?? null,
    certifications: row.certifications ?? null,

    averageRating: num(row.averageRating ?? row.average_rating),
    totalReviews: num(row.totalReviews ?? row.total_reviews) ?? 0,
    totalWalks: num(row.totalWalks ?? row.total_walks) ?? 0,
    responseTimeMinutes: num(row.responseTimeMinutes ?? row.response_time_minutes),

    hasBodyCamera: bool(row.hasBodyCamera ?? row.has_body_camera),
    hasDroneAccess: bool(row.hasDroneAccess ?? row.has_drone_access),
    hasFirstAidKit: bool(row.hasFirstAidKit ?? row.has_first_aid_kit),
    hasCarTransport: bool(row.hasCarTransport ?? row.has_car_transport),

    baseHourlyRate: num(row.baseHourlyRate ?? row.base_hourly_rate),
    minimumMinutes: num(row.minimumMinutes ?? row.minimum_minutes),
    currency: (row.currency ?? 'ILS').toString(),

    walkPackages: row.walkPackages ?? row.walk_packages ?? null,
    extraServices: row.extraServices ?? row.extra_services ?? null,

    isVerified: rawVerification === 'verified' || rawVerification === 'approved',
    isAvailable: bool(row.isAvailable ?? row.is_available, true),
    isActive: bool(row.isActive ?? row.is_active, true),
    instantBookEnabled: bool(row.instantBookEnabled ?? row.instant_book_enabled),

    memberSince: memberYear(),
  };
}
