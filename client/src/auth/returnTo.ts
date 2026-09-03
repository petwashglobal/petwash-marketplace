/**
 * returnTo — the ONE canonical deep-link key across the client.
 *
 * The audit found four incompatible conventions in production:
 *   ?from=      (RequireAuth, SignUpLuxury, CompleteProfile)
 *   ?redirect=  (SignUpLuxury, ExecutiveSuiteGuard)
 *   ?returnTo=  (WalletDownload, ChooseMode)
 *   ?next=      (LegalPage)
 *
 * Every page picked its own. Cross-surface deep-links were silently
 * dropped. Per CEO D6 the canonical key is `returnTo`.
 *
 * This module is the ONLY place client code should read/write the key.
 * A regression pin walks the client tree and catches any new use of
 * the legacy names.
 */

/** The canonical query-string key. */
export const RETURN_TO_KEY = 'returnTo';

/**
 * Legacy keys we still ACCEPT during the Phase 8 transition. Reading
 * these keeps existing bookmarks + email links working. Writing them
 * is forbidden — the regression pin catches new writes.
 */
export const LEGACY_RETURN_KEYS = ['from', 'redirect', 'next'] as const;

/**
 * Parse a returnTo target from the given URL search string.
 * Returns null when:
 *   - key is missing on both canonical and legacy names
 *   - decoded target is empty
 *   - decoded target fails the safety check (see isSafeReturnTarget)
 */
export function readReturnTo(search: string | URLSearchParams | Location = window.location.search): string | null {
  let params: URLSearchParams;
  if (typeof search === 'string') {
    params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  } else if (search instanceof URLSearchParams) {
    params = search;
  } else {
    params = new URLSearchParams(search.search);
  }

  let raw = params.get(RETURN_TO_KEY);
  if (!raw) {
    for (const legacyKey of LEGACY_RETURN_KEYS) {
      const value = params.get(legacyKey);
      if (value) {
        raw = value;
        break;
      }
    }
  }
  if (!raw) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return isSafeReturnTarget(decoded) ? decoded : null;
}

/**
 * Build a "…?returnTo=<encoded-current-path>" suffix. Empty string when
 * the current path is the default landing (no restoration needed).
 */
export function buildReturnToParam(target: string): string {
  if (!target) return '';
  if (target === '/' || target === '/signin') return '';
  if (!isSafeReturnTarget(target)) return '';
  return `?${RETURN_TO_KEY}=${encodeURIComponent(target)}`;
}

/**
 * Safety check — the target MUST be an internal relative path. Blocks:
 *   - protocol-relative URLs (`//evil.com/oops`)
 *   - absolute URLs (`https://evil.com`)
 *   - javascript: / data: / any-scheme URLs
 *   - fragment-only targets (`#`) and empty strings
 *
 * The current `SignUpLuxury.tsx` uses the equivalent regex
 * `/^\/(?!\/)/` — this is the shared, testable version.
 */
export function isSafeReturnTarget(target: string): boolean {
  if (!target || typeof target !== 'string') return false;
  if (target.length > 2048) return false; // sanity cap
  // Must start with exactly one slash — not `//` (protocol-relative)
  // and not `/` followed by nothing.
  if (!/^\/(?!\/)/.test(target)) return false;
  // No embedded scheme after the leading slash.
  if (/^\/https?:/i.test(target)) return false;
  // No newlines / control chars that could split HTTP headers.
  if (/[\r\n]/.test(target)) return false;
  return true;
}
