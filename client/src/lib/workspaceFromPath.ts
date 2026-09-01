/**
 * workspaceFromPath — infer which workspace a URL belongs to.
 *
 * CEO 2026-08-26 §41: deep links override the workspace picker. When a
 * multi-role user taps a provider notification URL, they must land in
 * the Provider workspace automatically — never forced through /mode
 * with the original destination lost.
 *
 * Rules (in order — first match wins):
 *   /provider*, /octopus            → provider
 *   /admin*, /octopus              → provider (admins pass through
 *                                    the provider workspace here — the
 *                                    server post-login handles the
 *                                    admin-specific /admin/dashboard
 *                                    landing separately)
 *   /prestige*, /pet-passport*,
 *   /pets*, /my-account*, /shop*,
 *   /paw-finder*, /wallet, /egift  → petParent
 *   anything else                  → null (no hint — let the picker
 *                                    or server decide)
 *
 * Pure function. No React, no side effects.
 */

export type WorkspaceHint = 'petParent' | 'provider' | null;

/** The intent string the server post-login decider understands. */
export function intentForWorkspace(w: WorkspaceHint): string | null {
  if (w === 'provider') return 'provider';
  if (w === 'petParent') return 'customer';
  return null;
}

const PROVIDER_PREFIXES = [
  '/provider',
  '/octopus',
  '/admin',       // admin surfaces live on the provider-side workspace
] as const;

const PET_PARENT_PREFIXES = [
  '/prestige',
  '/pet-passport',
  '/pets',
  '/my-account',
  '/shop',
  '/paw-finder',
  '/loyalty',
  '/wallet',
  '/egift',
  '/home',        // marketing / signed-in home
  '/bookings',
  '/my-bookings',
] as const;

function normalise(p: string): string {
  if (!p) return '';
  const [pathOnly] = p.split('?');
  const stripped = pathOnly.startsWith('http://') || pathOnly.startsWith('https://')
    ? new URL(pathOnly).pathname
    : pathOnly;
  return stripped.replace(/\/+$/, '') || '/';
}

function startsWithAny(p: string, prefixes: readonly string[]): boolean {
  return prefixes.some((pref) => p === pref || p.startsWith(pref + '/'));
}

export function workspaceFromPath(pathname: string | null | undefined): WorkspaceHint {
  if (!pathname) return null;
  const p = normalise(pathname);
  if (startsWithAny(p, PROVIDER_PREFIXES)) return 'provider';
  if (startsWithAny(p, PET_PARENT_PREFIXES)) return 'petParent';
  return null;
}

/**
 * Pull a `returnTo` from the current URL (SSR-safe). Callers pass the
 * result to `workspaceFromPath` to know if the deep-link already knows
 * which workspace it belongs to.
 *
 * Phase 8.b migration (2026-09-01): delegates to the canonical
 * `readReturnTo` helper so `?redirect=` fallback + open-redirect
 * validation live in one place. Behaviour unchanged: accepts
 * ?returnTo (canonical) or ?redirect (legacy), returns null on unsafe
 * targets.
 */
import { readReturnTo } from '../auth/returnTo';
export function readReturnToFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return readReturnTo(window.location.search);
}
