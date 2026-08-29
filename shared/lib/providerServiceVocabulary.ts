/**
 * providerServiceVocabulary — CEO MASTER §7 §A7 (2026-08-29) — the ONE
 * shared definition of every provider service label, canonical AND
 * legacy, so no future file has to invent a "canonical" alphabet.
 *
 * This module is the AUTHORITY. Every provider-service consumer —
 * ctaActions, requestedProviderService, provider-onboarding wizard,
 * provider search, admin approval — imports FROM here. If a new
 * service is added it is added HERE and every consumer picks it up
 * or fails at type-check.
 *
 * TWO KINDS OF STRINGS — never merge them:
 *
 *   * ProviderServiceCode         — the CEO canonical vocabulary.
 *     This is what URLs, telemetry, action-ids, and API payloads
 *     should speak. Example: 'pet_sitting'.
 *
 *   * LegacyProviderServiceAlias  — the old 5-string alphabet the
 *     ProviderOnboarding wizard, provider_services DB rows, and
 *     legacy CTAs (`?type=sitter`, `/join/walker`) still emit.
 *     Accepted ONLY at boundaries; normalised to ProviderServiceCode
 *     as early as possible. Example: 'sitter'.
 *
 * There is NO "canonical" that means both. The word "canonical" in
 * this codebase refers ONLY to ProviderServiceCode.
 */

/** CEO §A7 canonical vocabulary — five service codes. Frozen literal set. */
export const PROVIDER_SERVICE_CODES = [
  'pet_sitting',
  'dog_walking',
  'training',
  'pet_transport',
  'station_operator',
] as const;
export type ProviderServiceCode = (typeof PROVIDER_SERVICE_CODES)[number];

/**
 * The legacy 5-string alphabet still emitted by:
 *   * ProviderOnboarding wizard state (providerTypes[])
 *   * provider_services DB rows
 *   * legacy CTAs (?type=sitter, ?role=trainer, /join/walker)
 *
 * Kept explicit so a legacy alias never leaks into the canonical
 * type by accident.
 */
export const LEGACY_PROVIDER_SERVICE_ALIASES = [
  'walker',
  'sitter',
  'trainer',
  'driver',
  'station_operator',
] as const;
export type LegacyProviderServiceAlias =
  (typeof LEGACY_PROVIDER_SERVICE_ALIASES)[number];

/** Canonical code → legacy alias. The wizard + DB still speak legacy. */
export const CODE_TO_LEGACY: Record<ProviderServiceCode, LegacyProviderServiceAlias> = {
  pet_sitting: 'sitter',
  dog_walking: 'walker',
  training: 'trainer',
  pet_transport: 'driver',
  station_operator: 'station_operator',
};

/** Legacy alias → canonical code. Same table, inverted. */
export const LEGACY_TO_CODE: Record<LegacyProviderServiceAlias, ProviderServiceCode> = {
  sitter: 'pet_sitting',
  walker: 'dog_walking',
  trainer: 'training',
  driver: 'pet_transport',
  station_operator: 'station_operator',
};

/**
 * Accept every alias a CTA / URL / marketing shorthand might emit and
 * return the CEO canonical code. Unknown → null (silently dropped —
 * matches becomeProviderHref's whitelist discipline).
 */
export function normaliseToProviderServiceCode(raw: unknown): ProviderServiceCode | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  switch (v) {
    // Canonical hits.
    case 'pet_sitting':
    case 'dog_walking':
    case 'training':
    case 'pet_transport':
    case 'station_operator':
      return v;
    // Legacy alphabet.
    case 'sitter': return 'pet_sitting';
    case 'walker': return 'dog_walking';
    case 'trainer': return 'training';
    case 'driver': return 'pet_transport';
    // Marketing shorthand.
    case 'sit': return 'pet_sitting';
    case 'walk': return 'dog_walking';
    case 'train': return 'training';
    case 'pet_trek':
    case 'trek': return 'pet_transport';
    default: return null;
  }
}

/**
 * Accept every alias and return the LEGACY alias — the alphabet the
 * ProviderOnboarding wizard + provider_services DB rows still speak.
 * Use only at the boundary between the canonical world and legacy
 * consumers. New consumers should speak ProviderServiceCode.
 */
export function normaliseToLegacyAlias(raw: unknown): LegacyProviderServiceAlias | null {
  const code = normaliseToProviderServiceCode(raw);
  return code ? CODE_TO_LEGACY[code] : null;
}
