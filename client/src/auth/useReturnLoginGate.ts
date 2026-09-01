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

const RETURN_HINT_KEY = 'petwash_passkey_email';
const OPT_IN_KEY = 'pw_ff_new_door';

export type DoorDecision = 'new' | 'legacy' | 'pending';

interface DecisionInputs {
  /** URL search string, e.g. window.location.search. Optional for SSR safety. */
  search?: string;
  /** Injectable for tests. Reads localStorage in production. */
  readLocalOverride?: () => string | null;
  /** Injectable for tests. Reads the returning-user email hint. */
  readHint?: () => string | null;
  /**
   * Injectable for tests. In production this hook does NOT call the
   * browser's `isUserVerifyingPlatformAuthenticatorAvailable()` — that's
   * async and would introduce flicker. ReturnLogin itself does the
   * real capability check and silently falls back to /signin if the
   * platform can't authenticate. This hook returns 'new' as soon as
   * the hint is present + local/URL overrides align; ReturnLogin's
   * fallback handles the unhappy path with no visible transition.
   */
  hasHint?: boolean;
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

  // No override, no server cohort wired yet → legacy.
  // (When the server cohort lands in Phase 11.b, this branch checks it.)
  return 'legacy';
}

/**
 * React hook flavour. Deliberately does not use useEffect — the
 * decision is synchronous, deterministic on the URL + localStorage
 * snapshot at render time. Storage events across tabs are not
 * subscribed to here: a viewer sees the door for the tab they're in;
 * no cross-tab re-render is expected on /signin.
 */
export function useReturnLoginGate(): DoorDecision {
  return decideDoor();
}
