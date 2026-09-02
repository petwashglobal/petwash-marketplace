/**
 * One-tap handoff (AUDIT-LOG-13 / #216).
 *
 * The one-tap ops-login flow previously did one of two things:
 *   • inlined the Firebase custom token directly into rendered HTML
 *     (server/security/productionHardeningAndOneTap.ts autoSignHtml,
 *     `const customToken = "..."`), which meant the token was visible
 *     to every browser extension, page-source view, analytics/RUM
 *     snapshot, HAR export, and — if the tab was ever cached or
 *     bfcache'd — later revisits of the same URL, or
 *   • embedded the custom token into the URL query string
 *     (/ops/one-tap-employee?token=...), which meant it was
 *     additionally captured by browser history, referer headers on
 *     any outbound link the page rendered, CDN edge logs, and
 *     server-side access logs.
 *
 * Firebase custom tokens are bearer credentials — anyone who reads
 * one can create a session as the target user for the token's TTL
 * (Firebase default ~1 hour). None of those exposure surfaces are
 * necessary for the flow: the browser only needs the token for
 * ~2 seconds while it calls signInWithCustomToken() and posts the
 * resulting ID token to /api/auth/session.
 *
 * Fix (this module + productionHardeningAndOneTap redesign):
 *   1. The server mints a random 32-byte hex HANDOFF CODE and stores
 *      the Firebase custom token in Redis under `one-tap-handoff:{code}`
 *      with a short TTL (default 60 s). The URL and the HTML now
 *      carry only that code, not the token.
 *   2. The HTML calls POST /api/oauth/one-tap/exchange with the code.
 *      That endpoint does a Redis GETDEL — one-shot atomic read-and-
 *      delete — and returns the custom token in the RESPONSE BODY.
 *      Response bodies (unlike HTML source and URLs) cannot be seen
 *      by extensions on other tabs, browser history, referer headers,
 *      CDN edge logs, or cached page-source views.
 *   3. The browser signs in with the token in memory and discards it.
 *
 * Failure semantics: `consumeHandoff` returns null both when the code
 * is unknown / expired AND when Redis itself is unreachable. Callers
 * MUST treat both as "no valid handoff" and reject with an unrelated
 * generic error — never fall back to accepting a token supplied in
 * the request, and never fabricate a session on Redis outage. That
 * preserves the one-shot semantic when Redis is degraded.
 */

import * as crypto from 'crypto';
import { redis } from '../services/redis';

/** Prefix keeps handoff keys in their own namespace for TTL/eviction tuning. */
const KEY_PREFIX = 'one-tap-handoff:';
/** Default TTL — long enough for a mobile browser to load the page + fetch,
 *  short enough that a leaked code becomes worthless quickly. */
export const DEFAULT_HANDOFF_TTL_SEC = 60;

export interface OneTapHandoffEnvelope {
  /** Firebase custom token minted by admin.auth().createCustomToken(uid). */
  customToken: string;
  /** UID this handoff signs in as. Kept for audit-log breadcrumbs only —
   *  the browser never sees this field. */
  uid: string;
  /** ISO timestamp the handoff was created — sanity check for stale keys
   *  that outlived the TTL for any reason. */
  issuedAt: string;
}

/**
 * Mint a random 32-byte hex code and stash the customToken envelope in
 * Redis under it. Returns the code, or throws when Redis is unavailable
 * (an admin generating a link must know the flow will not work — not
 * hand out a code the exchange endpoint will refuse).
 */
export async function createHandoff(
  input: { customToken: string; uid: string; ttlSec?: number },
): Promise<string> {
  const code = crypto.randomBytes(32).toString('hex');
  const envelope: OneTapHandoffEnvelope = {
    customToken: input.customToken,
    uid: input.uid,
    issuedAt: new Date().toISOString(),
  };
  const key = KEY_PREFIX + code;
  const ttl = input.ttlSec ?? DEFAULT_HANDOFF_TTL_SEC;
  const ok = await redis.set(key, envelope, ttl);
  if (!ok) {
    throw new Error('one-tap handoff store unavailable');
  }
  return code;
}

/**
 * Atomically fetch AND delete the handoff for `code`. Returns the
 * envelope on the first (and only) successful call; null on any
 * subsequent call, an unknown code, an expired code, or a Redis
 * outage. Callers MUST return the same generic error for null
 * regardless of the underlying reason — otherwise an attacker can
 * distinguish "wrong code" from "Redis down" and iterate.
 */
export async function consumeHandoff(
  code: string,
): Promise<OneTapHandoffEnvelope | null> {
  if (!code || typeof code !== 'string' || code.length < 32) return null;
  const raw = await redis.getDel(KEY_PREFIX + code);
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as OneTapHandoffEnvelope;
    if (!env || typeof env.customToken !== 'string' || typeof env.uid !== 'string') {
      return null;
    }
    return env;
  } catch {
    return null;
  }
}
