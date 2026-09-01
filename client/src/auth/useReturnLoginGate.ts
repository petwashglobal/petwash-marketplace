/**
 * useReturnLoginGate — decide which /signin door to render.
 *
 * Auth-rebuild Phase 11 (CEO D7 "/signin door flip"). The returning-
 * user door (client/src/auth/ReturnLogin.tsx) is fronted here so the
 * cutover is a controlled rollout, not a big-bang flip.
 *
 * ─── DECISION MATRIX ─────────────────────────────────────────────────
 *
 *   1. Explicit URL override — `?door=new` or `?door=legacy`
 *      Wins over everything. This is the staff preview knob and the
 *      Playwright test hook (we hit /signin?door=new in the Phase 11
 *      passkey-cycle spec).
 *
 *   2. Local override — localStorage['pw_ff_new_door'] = '1'
 *      Internal-user opt-in that survives across visits. Set once
 *      by staff, forgotten. `= '0'` opts back out.
 *
 *   3. Hint + platform authenticator — auto-eligible
 *      When the browser reports `isUserVerifyingPlatformAuthenticator
 *      Available()` AND localStorage carries a `petwash_passkey_email`
 *      hint (written by the real signup / login paths), the new door
 *      is technically appropriate. The rollout cohort still gates
 *      whether we USE it — see #4.
 *
 *   4. Cohort rollout (future) — server-set
 *      When the server flag `ff.returning_user.new_door.enabled` is
 *      ON AND the visitor falls inside `ff.returning_user.new_door
 *      .percent`, the new door renders. Until the server flag is
 *      threaded to the client (Phase 11.b), this hook treats the
 *      server-side rollout as OFF and only opens the door under #1
 *      and #2.
 *
 * ─── WHAT THE HOOK NEVER DOES ────────────────────────────────────────
 *
 *   - No render-time navigation (no setLocation, no history.replace).
 *     The hook returns a value; the caller renders one of two
 *     components. Wouter's router sees no route change.
 *   - No auto-attempt Face ID prompt. That's ReturnLogin's job.
 *   - Never inspects auth state. If the visitor is already signed in,
 *     /signin's own already-signed-in guard sends them home.
 */

import { useEffect, useState } from 'react';

const RETURN_HINT_KEY = 'petwash_passkey_email';
const OPT_IN_KEY = 'pw_ff_new_door';

export type DoorDecision = 'new' | 'legacy' | 'pending';

export interface ServerDoorCohort {
  /** Whether the server flag is ON. */
  enabled: boolean;
  /** Percentage cohort (0..100). */
  percent: number;
}

interface DecisionInputs {
  /** URL search string, e.g. window.location.search. Optional for SSR safety. */
  search?: string;
  /** Injectable for tests. Reads localStorage in production. */
  readLocalOverride?: () => string | null;
  /** Injectable for tests. Reads the returning-user email hint. */
  readHint?: () => string | null;
  /**
   * Server-driven cohort. When present AND `enabled: true`, we take
   * the hint email, hash it deterministically, and place the visitor
   * in the door if their hash falls in the percentage cohort. When
   * absent (fetch pending / failed / server hasn't been asked yet),
   * this branch is skipped and the function falls through to 'legacy'.
   */
  serverCohort?: ServerDoorCohort;
}

/**
 * Deterministic per-visitor hash → integer [0, 100). Used to place a
 * viewer inside/outside the percent cohort so they don't flip doors
 * between visits. Stable across page loads for the same hint.
 * SHA-256 → first 4 bytes → mod 100. This is NOT cryptographic — just
 * a stable-bucket function; collisions are fine.
 */
function bucketFor(input: string): number {
  // Small FNV-1a for a synchronous no-dep hash. subtle.digest would
  // be async and force the hook to be async too.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash % 100;
}

function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Pure decision function — call from a component OR a test.
 * Returns 'new' or 'legacy'. 'pending' is reserved for the future
 * server-side cohort path where we need to wait on a fetch; not
 * emitted by the current implementation.
 */
export function decideDoor(inputs: DecisionInputs = {}): DoorDecision {
  const search = inputs.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(search);
  const explicit = params.get('door');
  if (explicit === 'new') return 'new';
  if (explicit === 'legacy') return 'legacy';

  const localOverride = inputs.readLocalOverride
    ? inputs.readLocalOverride()
    : safeLocalStorageGet(OPT_IN_KEY);
  if (localOverride === '1') return 'new';
  if (localOverride === '0') return 'legacy';

  // Server-driven cohort — Phase 11.b. Requires a hint to bucket by
  // (deterministic per-visitor). If we don't have a hint, we can't
  // stably bucket, so fall through to 'legacy' — a viewer without a
  // stored passkey email wouldn't benefit from the new door anyway.
  const cohort = inputs.serverCohort;
  if (cohort?.enabled && cohort.percent > 0) {
    const hint = inputs.readHint ? inputs.readHint() : safeLocalStorageGet(RETURN_HINT_KEY);
    if (hint) {
      const bucket = bucketFor(hint);
      if (bucket < Math.max(0, Math.min(100, cohort.percent))) return 'new';
    }
  }

  return 'legacy';
}

// Module-scope cache: one fetch per page load. React 18 double-invoke
// (StrictMode) is fine — the cache dedupes.
let _cohortCache: ServerDoorCohort | null = null;
let _cohortInflight: Promise<ServerDoorCohort> | null = null;

async function fetchServerCohort(): Promise<ServerDoorCohort> {
  if (_cohortCache) return _cohortCache;
  if (_cohortInflight) return _cohortInflight;
  _cohortInflight = (async () => {
    try {
      // Relative URL — the same origin serves /api and the client. If
      // the request fails, we fail-safe to legacy (enabled: false).
      const res = await fetch('/api/config/public', { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const cohort: ServerDoorCohort = {
        enabled: body?.returningUser?.newDoor?.enabled === true,
        percent: Math.max(0, Math.min(100, Number(body?.returningUser?.newDoor?.percent) || 0)),
      };
      _cohortCache = cohort;
      return cohort;
    } catch {
      // Fail-safe: legacy door until config is reachable.
      _cohortCache = { enabled: false, percent: 0 };
      return _cohortCache;
    }
  })();
  return _cohortInflight;
}

/**
 * React hook flavour. Runs the pure decideDoor() on every render, so
 * URL / localStorage overrides take effect immediately. The server
 * cohort is fetched ONCE per page load (module-cached) and folded in
 * as soon as it lands — the initial render is 'legacy' until then
 * (fail-safe; no flicker to the new door for cohort-eligible users
 * costs less than falsely flashing it for ineligible ones).
 */
export function useReturnLoginGate(): DoorDecision {
  const [cohort, setCohort] = useState<ServerDoorCohort | null>(_cohortCache);
  useEffect(() => {
    if (cohort) return;
    let cancelled = false;
    fetchServerCohort().then((c) => {
      if (!cancelled) setCohort(c);
    });
    return () => {
      cancelled = true;
    };
  }, [cohort]);
  return decideDoor({ serverCohort: cohort ?? undefined });
}
