/**
 * PetWash ID namespace map — CEO 2026-08-27 §3, §13, §34.
 *
 * PetWash's backend has grown up with different id shapes per surface
 * (Firebase UIDs, walker UUIDs, sitter serial ids, booking numbers).
 * The JobPassport read model needs one place that names them all and
 * explains what each one is safe to be used for.
 *
 * TWO CRITICAL RULES this file encodes:
 *
 *  1. §13 — the human-readable jobRef (e.g. PW-W7H4K2) is NEVER an
 *     authentication secret. Support may search it, customers may
 *     read it in a receipt, a provider screen may display it. It
 *     unlocks NOTHING on its own.
 *
 *  2. §34 — Firebase UID is the ONLY thing the server ever authorises
 *     with. providerPublicId / walkerId / sitter.id are for display
 *     and cross-reference; they must never gate an action.
 */

import { PLATFORMS, type PlatformCode, type PlatformDefinition, getPlatform } from './platformRegistry';

/** What each ID type represents + what authority owns it. */
export const ID_KINDS = [
  'FIREBASE_UID',     // users.id — authorisation authority
  'CORRELATION_ID',   // §3 spine that links payment/ledger/SUMIT/Nayax/job
  'JOB_REF',          // §2 human-readable code (PW-W7H4K2). Display only.
  'BOOKING_ID',       // canonical booking_requests.request_id (BR-...)
  'LEGACY_BOOKING_ID', // sitter_bookings.bookingId / walk_bookings.bookingId / trainer_bookings.bookingId
  'PROVIDER_PUBLIC_ID', // walkerId (WALKER-uuid) / sitterId / trainerId. Display only.
  'PROVIDER_SERVICE_ID', // provider_services row id — proves service approval
  'CUSTOMER_ID',       // users.id (Firebase UID) when acting as customer
  'ORDER_ID',          // shop_orders.id
  'REDEMPTION_ID',     // k9000_redemptions.id
  'NAYAX_TX_ID',       // Nayax provider txn id
  'SUMIT_DOC_ID',      // SUMIT invoice/receipt id
  'PAYOUT_ID',         // contractor_earnings.id
  'STATION_ID',        // K9000 station
  'BAY_ID',            // K9000 bay
  'PET_ID',            // pets.id (canonical, immutable)
  'LOCATION_ID',       // locations.id
  'CALENDAR_EVENT_ID', // Google Calendar event id
] as const;
export type IdKind = (typeof ID_KINDS)[number];

/** Metadata for each ID kind so composer / admin explorer can label consistently. */
export interface IdDescriptor {
  kind: IdKind;
  /** Human label. */
  label: string;
  /**
   * TRUE only when the ID is safe to authenticate against. The ONLY
   * true value in this table is FIREBASE_UID. Every other id is
   * display / lookup / cross-reference — never a gate.
   */
  isAuthAuthority: boolean;
  /**
   * TRUE when this id may appear in customer-facing UI / notifications.
   * PROVIDER_PUBLIC_ID / JOB_REF / ORDER_ID = yes. FIREBASE_UID / SUMIT
   * doc id = no.
   */
  publiclyDisplayable: boolean;
}

export const ID_DESCRIPTORS: readonly IdDescriptor[] = [
  { kind: 'FIREBASE_UID',       label: 'Firebase UID',        isAuthAuthority: true,  publiclyDisplayable: false },
  { kind: 'CORRELATION_ID',     label: 'Correlation ID',      isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'JOB_REF',            label: 'PetWash job ref',     isAuthAuthority: false, publiclyDisplayable: true  },
  { kind: 'BOOKING_ID',         label: 'Booking request id',  isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'LEGACY_BOOKING_ID',  label: 'Legacy booking id',   isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'PROVIDER_PUBLIC_ID', label: 'Provider public id',  isAuthAuthority: false, publiclyDisplayable: true  },
  { kind: 'PROVIDER_SERVICE_ID',label: 'Provider service id', isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'CUSTOMER_ID',        label: 'Customer id',         isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'ORDER_ID',           label: 'Shop order id',       isAuthAuthority: false, publiclyDisplayable: true  },
  { kind: 'REDEMPTION_ID',      label: 'K9000 redemption id', isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'NAYAX_TX_ID',        label: 'Nayax transaction',   isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'SUMIT_DOC_ID',       label: 'SUMIT document',      isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'PAYOUT_ID',          label: 'Provider payout id',  isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'STATION_ID',         label: 'K9000 station id',    isAuthAuthority: false, publiclyDisplayable: true  },
  { kind: 'BAY_ID',             label: 'K9000 bay id',        isAuthAuthority: false, publiclyDisplayable: true  },
  { kind: 'PET_ID',             label: 'Pet id',              isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'LOCATION_ID',        label: 'Location id',         isAuthAuthority: false, publiclyDisplayable: false },
  { kind: 'CALENDAR_EVENT_ID',  label: 'Calendar event id',   isAuthAuthority: false, publiclyDisplayable: false },
] as const;

// ─── JobRef generation / parsing ────────────────────────────────────

const JOBREF_PREFIX = 'PW';
// 5 chars from an unambiguous alphabet (no 0/O, 1/I, U/V) — 24 chars.
const JOBREF_ALPHABET = 'ABCDEFGHJKLMNPQRSTWXYZ23456789';

/**
 * Human-readable jobRef, e.g. PW-W7H4K2. The first char after PW- is
 * a platform hint from platformRegistry.jobRefLetter (§2). Remaining
 * chars are derived from a stable input (correlationId or bookingId)
 * so the SAME booking always renders the SAME jobRef — this matters
 * for support: a customer reads a jobRef from a receipt weeks later
 * and it must still resolve.
 *
 * §13 safety: this function is DETERMINISTIC and PUBLIC. jobRef ≠
 * handoff code. Never grant an action because someone knows a jobRef.
 */
export function generateJobRef(input: {
  platform: PlatformCode;
  /** Stable identity used to derive the code. Use correlationId if
   *  available, else fall back to the canonical booking id. */
  stableId: string;
}): string {
  const platform = getPlatform(input.platform);
  const letter = platform?.jobRefLetter ?? 'B';
  const suffix = deterministicSuffix(input.stableId, 5);
  return `${JOBREF_PREFIX}-${letter}${suffix}`;
}

/**
 * Parse a jobRef back to its platform hint. Returns null if the
 * shape is invalid or the platform hint is unknown — NEVER throws,
 * because jobRefs are user-typed input in support searches.
 *
 * The returned platform is a HINT — the caller must still resolve
 * the actual canonical booking to authorise anything.
 */
export function parseJobRef(raw: string): { platform: PlatformDefinition; suffix: string } | null {
  const match = /^PW-([A-Z])([A-Z0-9]{5})$/i.exec(raw.trim());
  if (!match) return null;
  const letter = match[1].toUpperCase();
  const suffix = match[2].toUpperCase();
  const platform = PLATFORMS.find((p) => p.jobRefLetter === letter) ?? null;
  if (!platform) return null;
  return { platform, suffix };
}

/**
 * Deterministic per-input suffix — same input → same suffix. Uses a
 * lightweight hash so the code is short + human-readable, not
 * cryptographically strong. That's fine — §13 says jobRef must not
 * be an auth token. When we later need collision resistance for
 * search-by-jobRef we can rebuild against a stored jobRef column.
 */
function deterministicSuffix(input: string, length: number): string {
  // Simple xor-fold hash — deterministic + collision-tolerant for the
  // ~short lifetime of an active PetWash job. Cross-platform (works
  // on server AND browser); no Node crypto dep.
  let h1 = 0x811c9dc5, h2 = 0xc9dc5811 | 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x00000193);
  }
  let acc = ((h1 ^ h2) >>> 0);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += JOBREF_ALPHABET[acc % JOBREF_ALPHABET.length];
    acc = Math.floor(acc / JOBREF_ALPHABET.length) + Math.imul(acc, 0x0000193 + i);
    acc = acc >>> 0;
  }
  return out;
}

/**
 * Truncate any UID for log / display use (§46 / §71). Never PII, never
 * a full uid in a client-visible field.
 */
export function truncateUid(uid: string | null | undefined): string {
  if (!uid) return '';
  return uid.slice(-6);
}
