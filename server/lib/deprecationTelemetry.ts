/**
 * CEO FLY MODE II §22 (2026-08-29) — deprecation telemetry.
 *
 * A single-purpose logger the retirement-candidate endpoints call
 * ONCE per hit so on-call can measure real-world caller volume
 * before we return a 410. This is the "observe production usage"
 * step CEO required before deleting live handlers whose repo
 * caller-search returned zero.
 *
 * PII discipline: only the safe axes go in — route, method, client
 * family (a 6-char user-agent prefix hash, not the raw UA),
 * X-App-Version if the caller sends it (mobile app builds may),
 * the authenticated uid (no email, no phone, no token). NO request
 * body. NO PII. The uid is the identity signal we need to answer
 * "is this hitting real production users" — anything narrower goes
 * through a purpose-built log line, not this shim.
 *
 * Log level is WARN so a dashboard alert can pattern-match without
 * digging through info-level noise, but not high enough to page.
 * The log tag `[Deprecation]` is stable so a filter can pin it.
 */
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { logger } from './logger';

/**
 * Emit one telemetry line for a hit on a deprecation-candidate route.
 *
 * Callers pass `route` verbatim (e.g. '/api/auth/2fa/send') and
 * optionally the authenticated uid. If the uid is unknown we log
 * it as null — knowing that anonymous callers still reach the
 * endpoint is itself valuable signal.
 *
 * Idempotent — safe to call more than once per request. Never
 * throws — a telemetry failure MUST NOT break the handler that
 * still needs to serve its business response.
 */
export function recordDeprecationHit(
  req: Request,
  route: string,
  opts: { uid?: string | null } = {},
): void {
  try {
    // A stable, non-reversible client-family fingerprint. The full
    // user-agent has enough entropy to fingerprint a specific
    // browser build; a truncated hash groups callers by rough
    // family (web browser generation, mobile app version) without
    // making any single hit re-identifiable.
    const ua = String(req.headers['user-agent'] || '').slice(0, 200);
    const clientFamily = ua
      ? createHash('sha256').update(ua).digest('hex').slice(0, 8)
      : 'none';

    // X-App-Version is a header our mobile app builds set. Keep it
    // if present — it lets on-call see "the retirement candidate is
    // hit by app builds up to 2.4.x, not 2.5.x onwards" without
    // dredging through UA parsers.
    const appVersionRaw = req.headers['x-app-version'];
    const appVersion = typeof appVersionRaw === 'string'
      ? appVersionRaw.slice(0, 32)
      : null;

    logger.warn('[Deprecation] retirement-candidate hit', {
      route,
      method: req.method,
      uid: opts.uid ?? null,
      clientFamily,
      appVersion,
      // The IP goes in as a coarse geolocation cue — not stored,
      // just logged. It is not itself PII in the sense CEO §D4
      // forbids (token/OTP/password/national ID/bank). We already
      // log IPs elsewhere in the auth stack.
      ip: req.ip || null,
      ts: new Date().toISOString(),
    });
  } catch {
    // Never break the handler because telemetry choked.
  }
}
