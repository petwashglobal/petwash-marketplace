/**
 * An INDEPENDENT switch for the shared verification EXPERIENCE.
 *
 * The UNIFIED_VERIFICATION_* server flags enable backend PURPOSES. They say
 * nothing about which UI a customer sees, and login/signup have been ON in
 * production for a while — so treating "the flag is on" as a rollout plan
 * would swap the live signup screen for every customer at once, on a deploy,
 * with no real-browser production test behind it.
 *
 * This switch controls only the client experience, so the two decisions can be
 * made separately:
 *
 *   ?pwverify=new / ?pwverify=old   one-off override, for a real-browser test
 *                                   against production without exposing anyone
 *                                   else. Persisted so the redirect-heavy auth
 *                                   flow keeps it across navigations.
 *   VITE_UNIFIED_VERIFICATION_UI    build-time default, per environment.
 *
 * TEMPORARY BY CONSTRUCTION. Two permanent implementations of the same screen
 * is the exact sprawl this whole effort exists to remove. Once the migrated
 * flow is proven in a real browser, the shared flow becomes unconditional and
 * this file and the legacy branch are deleted together. The pin in
 * verificationFlow.contract.test.ts records that intent.
 */

const STORAGE_KEY = 'pw_verify_ui';

type Choice = 'new' | 'old' | null;

function readOverride(): Choice {
  if (typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search).get('pwverify');
    if (q === 'new' || q === 'old') {
      // Auth bounces through Firebase redirects and back; a query param does
      // not survive that, so the choice is remembered for the session.
      try { window.sessionStorage.setItem(STORAGE_KEY, q); } catch { /* private mode */ }
      return q;
    }
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === 'new' || stored === 'old') return stored;
  } catch {
    // Storage can throw outright in some privacy modes. A switch that cannot
    // be read is simply absent — never a crash on the signup page.
  }
  return null;
}

function buildDefault(): boolean {
  try {
    const v = (import.meta as any)?.env?.VITE_UNIFIED_VERIFICATION_UI;
    return String(v ?? '').toLowerCase().trim() === 'true';
  } catch {
    return false;
  }
}

/** True when this session should render the shared VerificationFlow. */
export function useSharedVerificationUi(): boolean {
  const override = readOverride();
  if (override === 'new') return true;
  if (override === 'old') return false;
  return buildDefault();
}

/** Exposed for tests and for an explicit reset during QA. */
export function clearVerificationUiOverride(): void {
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
