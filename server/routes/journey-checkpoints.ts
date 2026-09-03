/**
 * /api/journey/checkpoint(s) — Lane C.3 (post-release 2026-09-03).
 *
 * REST surface over the JourneyCheckpoint service. Lets a resumable
 * wizard (sitter book, walk book, marketplace book, shop, egift,
 * provider apply) durably persist its in-flight step + opaque
 * payload, so an abandoned tab / phone lock / battery-die resumes
 * where the user left off.
 *
 * Safety model — enforced by this router:
 *   1. Auth: `validateFirebaseToken` fills `req.firebaseUser.uid` from a
 *      verified ID token / session cookie. Anonymous callers get 401.
 *      The uid is NEVER read from the body.
 *   2. Domain: the wizard's `domain` field is a CLOSED enum
 *      (JourneyDomain — walk_book/sitter_book/marketplace_book/
 *      shop_checkout/egift/provider_apply). Any other value → 400.
 *   3. Payload: opaque JSON object, ≤ 8 KB after JSON.stringify. The
 *      RESUMING wizard is the sole arbiter of what to do with it.
 *      This layer never reads inside the payload for authority.
 *   4. TTL: caller may pass `ttlHours` between 1 and 168 (7d). The
 *      service defaults to 72h if omitted. Refuses larger windows so
 *      stale drafts can't lurk for months.
 *   5. NEVER stores payment state. The service comment says so; this
 *      route also rejects payloads whose top-level keys look like a
 *      completed payment (`chargeId`, `paidAt`, etc.) — a defence-in-
 *      depth pin against a wizard accidentally saving fiscal truth.
 *   6. Every write / read / delete is fail-soft in the service; this
 *      router still wraps calls in try/catch so a service outage
 *      surfaces a plain 5xx (never leaks Postgres error text).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { pool } from '../db';
import {
  saveCheckpoint,
  getActiveCheckpoint,
  listActiveCheckpoints,
  clearCheckpoint,
  type JourneyDomain,
} from '../services/journeyCheckpoints';
import { logger } from '../lib/logger';

const router = Router();

const JOURNEY_DOMAINS = [
  'walk_book',
  'sitter_book',
  'marketplace_book',
  'shop_checkout',
  'egift',
  'provider_apply',
] as const;

/**
 * Top-level payload keys that STRONGLY suggest a wizard is trying
 * to persist finalised payment state. Reject them here — payment
 * truth lives only in wallet_transactions / booking_requests /
 * fiscal_documents. A checkpoint is a UX resume hint.
 */
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'chargeId',
  'chargeid',
  'paidAt',
  'paidat',
  'paymentReceived',
  'settlementId',
  'settlementid',
  'refundId',
  'refundid',
  'fiscalDocumentNumber',
]);

const SaveCheckpointBody = z.object({
  domain: z.enum(JOURNEY_DOMAINS),
  payload: z.record(z.string(), z.unknown()),
  ttlHours: z.number().int().min(1).max(168).optional(),
});

const MAX_PAYLOAD_BYTES = 8 * 1024;

router.post('/checkpoint', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const parsed = SaveCheckpointBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
  }
  const { domain, payload, ttlHours } = parsed.data;

  // Defence-in-depth: reject payloads that carry finalised payment
  // fields at the top level.
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(key)) {
      return res.status(400).json({ error: 'FORBIDDEN_PAYLOAD_KEY', key });
    }
  }

  // Size cap — JSON.stringify catches nested bloat too.
  const size = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  if (size > MAX_PAYLOAD_BYTES) {
    return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', maxBytes: MAX_PAYLOAD_BYTES, gotBytes: size });
  }

  try {
    const row = await saveCheckpoint(pool, {
      userUid: uid,
      domain: domain as JourneyDomain,
      payload,
      ttlHours,
    });
    if (!row) {
      // Service already logged the reason.
      return res.status(500).json({ error: 'CHECKPOINT_WRITE_FAILED' });
    }
    return res.status(200).json({
      ok: true,
      id: row.id,
      domain: row.domain,
      expiresAt: row.expiresAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    logger.warn('[JourneyCheckpoints] save handler failed', { uid, domain, err: (err as Error)?.message });
    return res.status(500).json({ error: 'CHECKPOINT_WRITE_FAILED' });
  }
});

router.get('/checkpoint/:domain', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const domain = String(req.params.domain);
  if (!JOURNEY_DOMAINS.includes(domain as any)) {
    return res.status(400).json({ error: 'UNKNOWN_DOMAIN' });
  }

  try {
    const row = await getActiveCheckpoint(pool, { userUid: uid, domain: domain as JourneyDomain });
    if (!row) return res.status(404).json({ error: 'NO_ACTIVE_CHECKPOINT' });
    return res.status(200).json({
      id: row.id,
      domain: row.domain,
      payload: row.payload,
      expiresAt: row.expiresAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    logger.warn('[JourneyCheckpoints] get handler failed', { uid, domain, err: (err as Error)?.message });
    return res.status(500).json({ error: 'CHECKPOINT_READ_FAILED' });
  }
});

router.get('/checkpoints', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  try {
    const rows = await listActiveCheckpoints(pool, { userUid: uid });
    return res.status(200).json({
      items: rows.map((r) => ({
        id: r.id,
        domain: r.domain,
        expiresAt: r.expiresAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        // Payload NOT included in the list surface. Callers that need
        // it hit /checkpoint/:domain — keeps the list response tiny.
      })),
    });
  } catch (err) {
    logger.warn('[JourneyCheckpoints] list handler failed', { uid, err: (err as Error)?.message });
    return res.status(500).json({ error: 'CHECKPOINT_LIST_FAILED' });
  }
});

router.delete('/checkpoint/:domain', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const domain = String(req.params.domain);
  if (!JOURNEY_DOMAINS.includes(domain as any)) {
    return res.status(400).json({ error: 'UNKNOWN_DOMAIN' });
  }

  try {
    const cleared = await clearCheckpoint(pool, { userUid: uid, domain: domain as JourneyDomain });
    return res.status(200).json({ ok: true, cleared });
  } catch (err) {
    logger.warn('[JourneyCheckpoints] delete handler failed', { uid, domain, err: (err as Error)?.message });
    return res.status(500).json({ error: 'CHECKPOINT_DELETE_FAILED' });
  }
});

export default router;
