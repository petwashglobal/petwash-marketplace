/**
 * requestedProviderService — CEO 2026-08-29 AUTH MASTER §P0-1.
 *
 * ONE canonical parameter carries "which provider service did the
 * customer tap Become a…?" from the CTA on Sitter / Walk My Pet /
 * Academy / PetTrek / K9000 through authentication, through the
 * /become-provider resume, into the ProviderOnboarding wizard, and
 * survives an auth redirect and a page refresh.
 *
 * BEFORE:
 *   * /become-provider?type=sitter        (accepted, forwarded)
 *   * /provider-onboarding?type=sitter    (NEVER READ)
 *   * /provider-onboarding?role=sitter    (NEVER READ)
 *   * ProviderOnboarding initialised providerTypes = [] and only
 *     restored from a saved draft — the URL intent silently died.
 *
 * AFTER:
 *   * ProviderOnboarding calls initialRequestedServices() and
 *     preselects providerTypes.
 *   * setRequestedProviderServices() writes to sessionStorage so a
 *     mid-flow refresh restores the selection.
 *   * Legacy `type=` and `role=` are normalised at the edge; the
 *     canonical key `requestedService` is preferred.
 *   * Additive: existing selections are UNIONED — pressing Sitter
 *     then Walker never demotes to a single role.
 *
 * Vocabulary is intentionally the LEGACY 5-string set the wizard
 * already uses (walker / sitter / driver / trainer / station_operator)
 * because ProviderOnboarding and provider_services rows still speak
 * that alphabet. A later migration can promote to the canonical
 * pet_sitting / dog_walking / training / pet_transport /
 * station_operator quintet — the alias map below is the single choke
 * point that translation lives in.
 */

/** The 5 legacy service labels ProviderOnboarding + backend already speak. */
export const CANONICAL_SERVICES = [
  'walker',
  'sitter',
  'trainer',
  'driver',
  'station_operator',
] as const;
export type CanonicalService = (typeof CANONICAL_SERVICES)[number];

/**
 * Edge-normalisation: accept legacy `type=` and `role=` aliases and
 * every marketing shorthand a CTA might send. NEVER return a value
 * outside CANONICAL_SERVICES. Unknown → null (silently dropped —
 * matches becomeProviderHref's whitelist discipline).
 */
export function normaliseServiceAlias(raw: unknown): CanonicalService | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  switch (v) {
    // Direct canonical hits.
    case 'walker':           return 'walker';
    case 'sitter':           return 'sitter';
    case 'trainer':          return 'trainer';
    case 'driver':           return 'driver';
    case 'station_operator': return 'station_operator';
    // CEO-directed canonical vocab (map to legacy labels).
    case 'dog_walking':      return 'walker';
    case 'pet_sitting':      return 'sitter';
    case 'training':         return 'trainer';
    case 'pet_transport':    return 'driver';
    case 'pet_trek':         return 'driver';
    case 'trek':             return 'driver';
    // Marketing shorthand seen in /join/* redirect map.
    case 'walk':             return 'walker';
    case 'sit':              return 'sitter';
    case 'train':            return 'trainer';
    default:                 return null;
  }
}

/** Storage key for the mid-flow preserved intent. */
export const REQUESTED_SERVICE_SS_KEY = 'petwash_requested_provider_services';

/** Read from URL search params — accepts requestedService, type, role. */
export function readRequestedServiceFromSearch(search: string | URLSearchParams | null | undefined): CanonicalService | null {
  if (!search) return null;
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of ['requestedService', 'type', 'role']) {
    const v = params.get(key);
    const norm = normaliseServiceAlias(v);
    if (norm) return norm;
  }
  return null;
}

/** Read every preserved service label from sessionStorage. */
export function readPreservedRequestedServices(): CanonicalService[] {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return [];
    const raw = window.sessionStorage.getItem(REQUESTED_SERVICE_SS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CanonicalService[] = [];
    for (const v of parsed) {
      const norm = normaliseServiceAlias(v);
      if (norm && !out.includes(norm)) out.push(norm);
    }
    return out;
  } catch {
    return [];
  }
}

/** Persist the union of the current preservation with `next`. Additive by design. */
export function setRequestedProviderServices(next: readonly CanonicalService[] | CanonicalService): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const arr = Array.isArray(next) ? next : [next];
    const merged = readPreservedRequestedServices();
    for (const v of arr) {
      const norm = normaliseServiceAlias(v);
      if (norm && !merged.includes(norm)) merged.push(norm);
    }
    window.sessionStorage.setItem(REQUESTED_SERVICE_SS_KEY, JSON.stringify(merged));
  } catch {
    /* non-fatal */
  }
}

/** Drop the preservation once the wizard has consumed it. */
export function clearRequestedProviderServices(): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(REQUESTED_SERVICE_SS_KEY);
  } catch {
    /* non-fatal */
  }
}

/**
 * The one function ProviderOnboarding calls on mount.
 *
 *   1. Read the URL for `requestedService` / `type` / `role`.
 *   2. Union with the sessionStorage preservation.
 *   3. Return de-duplicated CanonicalService[]. Never returns
 *      duplicates. Never returns values outside CANONICAL_SERVICES.
 *
 * The wizard should immediately call setRequestedProviderServices()
 * on its selection so a refresh keeps the choice.
 */
export function initialRequestedServices(search?: string | URLSearchParams | null): CanonicalService[] {
  const out: CanonicalService[] = [];
  // URL first — that's the user's LATEST intent.
  const urlHit = readRequestedServiceFromSearch(
    search ?? (typeof window !== 'undefined' ? window.location.search : ''),
  );
  if (urlHit) out.push(urlHit);
  // Then sessionStorage — earlier taps that got redirected through auth.
  for (const v of readPreservedRequestedServices()) {
    if (!out.includes(v)) out.push(v);
  }
  return out;
}
