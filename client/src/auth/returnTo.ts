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
 * Safety check — the target MUST be an internal, same-origin relative path.
 *
 * An open redirect on the post-login return is a credential-phishing vector:
 * the victim sees a genuine petwash.co.il sign-in URL, authenticates, and is
 * then handed to the attacker's look-alike page. So this guard is deliberately
 * an ALLOWlist of "one slash then a normal path", not a denylist of bad hosts.
 *
 * Blocks:
 *   - absolute URLs (`https://evil.com`) and any scheme (`javascript:`, `data:`)
 *   - protocol-relative URLs (`//evil.com`, `///evil.com`)
 *   - BACKSLASH variants (`/\evil.com`, `\\evil.com`, `/\/evil.com`) — the
 *     WHATWG URL parser treats `\` as `/` for special schemes, so browsers
 *     read `/\evil.com` as `//evil.com` → https://evil.com. This was the
 *     first live bypass of the previous `/^\/(?!\/)/`-only guard.
 *   - TAB/CR/LF and every other C0 control char, DEL, and Unicode line/para
 *     separators — the URL parser STRIPS U+0009/U+000A/U+000D before parsing,
 *     so `/<TAB>/evil.com` also collapses to `//evil.com`. This was the second
 *     live bypass. Control chars are additionally a header-splitting risk.
 *   - fragment-only targets (`#`) and empty strings
 *
 * Callers must pass the DECODED target (readReturnTo percent-decodes first),
 * so `%2F%5Cevil.com` is validated as `/\evil.com` and rejected.
 */
export function isSafeReturnTarget(target: string): boolean {
  if (!target || typeof target !== 'string') return false;
  if (target.length > 2048) return false; // sanity cap

  // 1. No C0 controls, DEL, or Unicode line/paragraph separators anywhere.
  //    TAB/LF/CR are stripped by the URL parser and would re-form `//evil.com`;
  //    the rest are header-splitting / homograph noise with no legitimate use
  //    in an internal path.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F\u2028\u2029]/.test(target)) return false;

  // 2. Treat backslash exactly as the URL parser does — as a slash. Normalise
  //    then re-check, so `/\evil.com` is judged as `//evil.com`.
  const normalised = target.replace(/\\/g, '/');

  // 3. Must start with exactly one slash — not `//` (protocol-relative),
  //    and not a bare `/` followed by nothing.
  if (!/^\/(?!\/)/.test(normalised)) return false;

  // 4. No embedded scheme immediately after the leading slash.
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(normalised)) return false;

  return true;
}
