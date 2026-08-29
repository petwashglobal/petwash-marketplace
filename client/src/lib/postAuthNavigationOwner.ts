/**
 * postAuthNavigationOwner — CEO MASTER §1.10 §F3 (2026-08-29).
 *
 * The F3 audit named at least 12 different call sites that navigate
 * the browser after a successful authentication. On /signup +
 * /signin surfaces where more than one of them is mounted at once
 * (Google One Tap on the signup page; PrivilegeSignup + SignUpLuxury;
 * AdminLoginV2 popup + its own onAuthStateChanged listener), two of
 * them compete for the same user's next-step and the winner depends
 * on network + microtask ordering.
 *
 * This module gives us a tiny COOPERATIVE ownership token — one
 * navigator wins per short window and every other post-auth
 * navigator opts out.
 *
 *   const canNav = claimPostAuthNavigation('one-tap');
 *   if (!canNav) return;             // someone else is driving
 *   navigate(nextUrl);
 *   releasePostAuthNavigation();     // done — freshly cleared for the next attempt
 *
 * A default TTL guards against a stuck claim (network hang, thrown
 * error) — if the terminal navigate never fires, the token
 * auto-clears after WINDOW_MS so the next auth attempt is not
 * blocked forever.
 *
 * DISCIPLINE
 *   * NEVER a security mechanism. Whichever site holds the token is
 *     STILL responsible for its own capability checks; the token
 *     just decides who navigates.
 *   * A caller may inspect but SHOULD NOT trust `currentOwner()` for
 *     anything beyond logging.
 *   * All the state is in a module-scoped closure. Not persisted;
 *     survives only the current SPA session.
 */

/** How long a claim stays "owned" before it auto-clears (§F3 stuck-claim guard). */
export const NAV_OWNER_TTL_MS = 5_000;

let currentOwnerName: string | null = null;
let claimedAt = 0;

/**
 * Attempt to claim navigation ownership for `name`. Returns TRUE if
 * this call is now the owner (the caller MUST navigate + release);
 * FALSE if someone else already owns the window. Automatically
 * expires stale claims older than NAV_OWNER_TTL_MS.
 */
export function claimPostAuthNavigation(name: string): boolean {
  const now = Date.now();
  if (currentOwnerName && now - claimedAt < NAV_OWNER_TTL_MS) {
    return currentOwnerName === name; // idempotent for same owner
  }
  currentOwnerName = name;
  claimedAt = now;
  return true;
}

/** Release the claim so the next auth attempt starts clean. */
export function releasePostAuthNavigation(): void {
  currentOwnerName = null;
  claimedAt = 0;
}

/** Debug/telemetry only — never use for capability decisions. */
export function currentOwner(): string | null {
  if (!currentOwnerName) return null;
  if (Date.now() - claimedAt >= NAV_OWNER_TTL_MS) return null;
  return currentOwnerName;
}
