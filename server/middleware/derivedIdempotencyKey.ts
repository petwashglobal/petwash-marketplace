/**
 * Derived idempotency key shim.
 *
 * WHY THIS EXISTS
 * ---------------
 * `requireStrictIdempotency` (server/middleware/idempotency.ts) is the repo's
 * canonical, fail-closed idempotency authority and this file deliberately does
 * NOT reimplement it — it only feeds it a key.
 *
 * That middleware demands an `Idempotency-Key` HTTP header and answers 400 when
 * it is missing. That contract is right for a browser checkout, where the client
 * mints a UUID per user intent. It is wrong for the internal / admin / webhook
 * money endpoints (e.g. POST /api/billing/refund), which today have NO caller
 * that sends the header at all: bolting the header requirement straight on would
 * turn every existing caller into a hard 400 while still leaving a caller that
 * *forgets* to send it completely unprotected.
 *
 * So: when the header is absent we synthesise a DETERMINISTIC key from the
 * request itself — the endpoint plus the business identity of the operation
 * (e.g. recordId + amount + partial-flag for a refund). Two identical submits,
 * a double-click, a second browser tab, an admin replay and a webhook retry all
 * derive the SAME key, so the canonical middleware collapses them to one
 * financial effect. A caller that DOES send an explicit header keeps full
 * control and this shim gets out of the way.
 *
 * DEPENDENCY NOTE: the underlying claim in `requireStrictIdempotency` is being
 * made genuinely atomic by PR #1819 (branch claude/pr-p0-141-atomic-idempotency,
 * INSERT … ON CONFLICT DO NOTHING RETURNING). Until that lands, the middleware's
 * SELECT-then-INSERT still has a narrow race window. This shim is written
 * against the unchanged exported signature, so it works before and after and
 * inherits the atomic claim for free once #1819 merges.
 *
 * NO FINANCIAL RULE IS DEFINED OR CHANGED HERE. This file computes a string.
 */

import { createHash } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { requireStrictIdempotency } from './idempotency';

/**
 * Derive the business identity of the request. Return `null` to fall back to
 * the plain header contract (i.e. let the canonical middleware answer 400).
 */
export type IdempotencyIdentityFn = (req: Request) => string | null;

const MAX_KEY_LEN = 128;

/** Deterministic, header-safe key: `<prefix>-<sha256(identity)[0..40]>`. */
export function deriveIdempotencyKey(prefix: string, identity: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9\-_]/g, '-').slice(0, 40);
  const digest = createHash('sha256').update(identity).digest('hex').slice(0, 40);
  return `${safePrefix}-${digest}`.slice(0, MAX_KEY_LEN);
}

/**
 * Wrap `requireStrictIdempotency` so that a missing `Idempotency-Key` header is
 * filled in from the request body instead of rejected.
 *
 * @param prefix   short endpoint tag, keeps derived keys from colliding across routes
 * @param identity function returning a canonical string for the business operation
 */
export function strictIdempotencyWithDerivedKey(
  prefix: string,
  identity: IdempotencyIdentityFn,
) {
  return function derivedIdempotency(req: Request, res: Response, next: NextFunction) {
    const supplied = (req.headers['idempotency-key'] as string | undefined)?.trim();
    if (!supplied) {
      let derivedFrom: string | null = null;
      try {
        derivedFrom = identity(req);
      } catch {
        derivedFrom = null;
      }
      if (derivedFrom) {
        req.headers['idempotency-key'] = deriveIdempotencyKey(prefix, derivedFrom);
      }
      // derivedFrom === null → leave the header absent; the canonical
      // middleware's 400 is the correct answer for an unidentifiable request.
    }
    return requireStrictIdempotency(req, res, next);
  };
}
