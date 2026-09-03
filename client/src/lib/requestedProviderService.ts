/**
 * Post-release 2026-09-03 (backlog P1): provider requestedService
 * preservation from CTA → auth → onboarding.
 *
 * Bug it fixes: tapping "Become a Pet Sitter" (or Walker / Trainer /
 * Driver / Station Operator) sent the browser to
 *   /provider-onboarding?type=sitter
 *   /provider-onboarding?role=sitter
 *   /provider-onboarding?requestedService=pet_sitting
 * but ProviderOnboarding.tsx initialized `providerTypes = useState([])`
 * and never consulted the URL. Result: the intent was silently
 * dropped and the user landed on an empty service picker.
 *
 * This lib normalizes every legacy/canonical/marketing spelling into
 * the 5-string vocabulary the wizard + `provider_services` rows
 * speak. Additive-UNION into sessionStorage so a refresh doesn't
 * demote a previously-picked selection.
 *
 * Zero external deps. Safe to import from any client bundle.
 */

export type CanonicalProviderService =
  | 'walker'
  | 'sitter'
  | 'station_operator'
  | 'driver'
  | 'trainer';

export const CANONICAL_PROVIDER_SERVICES: CanonicalProviderService[] = [
  'walker',
  'sitter',
  'station_operator',
  'driver',
  'trainer',
];

/**
 * Every alias we've seen in the wild (legacy CTAs, deeplinks, marketing
 * copy, CEO canonical vocabulary from §A7). Maps to the 5-string
 * canonical set. Keys are lowercased at match time.
 */
const ALIAS_MAP: Readonly<Record<string, CanonicalProviderService>> = Object.freeze({
  // Canonical (already correct)
  walker: 'walker',
  sitter: 'sitter',
  station_operator: 'station_operator',
  driver: 'driver',
  trainer: 'trainer',

  // CEO §A7 canonical vocabulary
  dog_walking: 'walker',
  pet_sitting: 'sitter',
  pet_transport: 'driver',
  training: 'trainer',

  // Marketing shorthand + legacy pluralisation
  walk: 'walker',
  walking: 'walker',
  walkers: 'walker',
  dogwalker: 'walker',
  petwalker: 'walker',

  sit: 'sitter',
  sitting: 'sitter',
  sitters: 'sitter',
  petsitter: 'sitter',
  petsitting: 'sitter',
  boarder: 'sitter',
  boarding: 'sitter',

  transport: 'driver',
  drivers: 'driver',
  transporter: 'driver',
  pettransport: 'driver',
  drive: 'driver',

  train: 'trainer',
  trainers: 'trainer',
  training_service: 'trainer',
  dog_trainer: 'trainer',

  station: 'station_operator',
  stations: 'station_operator',
  operator: 'station_operator',
  k9000: 'station_operator',
  k9000_operator: 'station_operator',
  franchisee: 'station_operator',
});

/** sessionStorage key we UNION into. Same string across all callers. */
const SESSION_KEY = 'pw_requested_provider_services_v1';

/** Normalize one raw string to a canonical service, or null. */
export function normaliseServiceAlias(raw: unknown): CanonicalProviderService | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return ALIAS_MAP[key] ?? null;
}

/**
 * Read every URL-borne intent (canonical first, then legacy). Returns
 * the deduped canonical list in the order seen. Safe when window is
 * absent (SSR / prerender).
 */
export function readRequestedServiceFromSearch(
  search: string | URLSearchParams | undefined = typeof window !== 'undefined'
    ? window.location.search
    : '',
): CanonicalProviderService[] {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(typeof search === 'string' ? search : '');
  const seen = new Set<CanonicalProviderService>();
  const collect = (values: string[]) => {
    for (const v of values) {
      // Accept comma-separated lists in a single param too.
      for (const piece of v.split(',')) {
        const c = normaliseServiceAlias(piece);
        if (c) seen.add(c);
      }
    }
  };
  collect(params.getAll('requestedService'));
  collect(params.getAll('type'));
  collect(params.getAll('role'));
  return Array.from(seen);
}

function readSession(): CanonicalProviderService[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CanonicalProviderService[] = [];
    for (const v of parsed) {
      const c = normaliseServiceAlias(v);
      if (c && !out.includes(c)) out.push(c);
    }
    return out;
  } catch {
    return [];
  }
}

function writeSession(values: CanonicalProviderService[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(values));
  } catch {
    /* private browsing / storage disabled — silently no-op */
  }
}

/**
 * Union the given services with what's already in sessionStorage.
 * Never demotes — a previously-picked selection survives a refresh
 * that arrived without URL params.
 */
export function setRequestedProviderServices(
  values: CanonicalProviderService[],
): CanonicalProviderService[] {
  const current = readSession();
  const merged: CanonicalProviderService[] = [...current];
  for (const v of values) {
    if (!merged.includes(v)) merged.push(v);
  }
  writeSession(merged);
  return merged;
}

/**
 * The intent-hydrator ProviderOnboarding.tsx calls at mount. URL
 * (this-tab intent) UNION session (previous-tab intent) — never
 * empty when either source has data.
 */
export function initialRequestedServices(
  search?: string | URLSearchParams,
): CanonicalProviderService[] {
  const url = readRequestedServiceFromSearch(search);
  const session = readSession();
  const merged: CanonicalProviderService[] = [];
  for (const v of [...url, ...session]) {
    if (!merged.includes(v)) merged.push(v);
  }
  // Persist the URL-borne intent so the next refresh doesn't lose it.
  if (url.length) writeSession(merged);
  return merged;
}

/** Called after a successful submit so a return visit isn't re-injected. */
export function clearRequestedProviderServices(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* no-op */
  }
}
