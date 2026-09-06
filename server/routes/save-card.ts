/**
 * Save-a-card flow (CTO P0-2 vault go-live, 2026-08-01).
 *
 * Mirrors the PROVEN SUMIT hosted-page pattern in payments-sumit.ts (begin → SUMIT page →
 * return → re-verify). A small ₪1 verification (refundable) lets the customer enter their
 * card on SUMIT's own PCI-safe page; SUMIT keeps the card on the customer for future
 * charges, and we store only the token (no PAN/CVV ever touches us).
 *
 * PROTECTION: gated by CARD_VAULT_ENABLED (default OFF) and fail-closed — if SUMIT doesn't
 * come back with a customer/token, we save NOTHING and tell the user it didn't save. The
 * exact SUMIT customer/token field shapes are read defensively and confirmed on the first
 * real save; a mismatch just fails closed (no card stored, no wrong charge).
 */
import { randomBytes } from 'node:crypto';
import { Router, Request, Response } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { redis } from '../services/redis';
import { sumitClient } from '../services/SumitClient';
import { SumitCardVault, isCardVaultEnabled } from '../services/SumitCardVault';
import { logger } from '../lib/logger';

const router = Router();
function baseUrl(): string { return process.env.BASE_URL || 'https://petwash.co.il'; }

// ---------------------------------------------------------------------------
// OWNERSHIP HANDOFF (IDOR fix #2263, made durable 2026-09-06)
//
// #2263 stopped the /return handler trusting `uid` from the querystring — the
// redirect URL is fully editable in the customer's browser, so anyone could
// swap in a victim's uid and have their card token attached to that account.
//
// That fix parked the trusted uid in a per-instance in-memory Map and called
// it "fine". It is not: Cloud Run runs min-instances=0 and scales, so /start
// and /return routinely land on DIFFERENT instances (or the same instance
// after a cold start). The map misses, the handler fails closed, and the
// customer has already been charged the ₪1 — which nothing in this codebase
// refunds (see the note on amountIls below). Silent, money-losing, and
// invisible in a single-instance test.
//
// Now: the handoff lives in Redis (the canonical server/services/redis.ts —
// no second client), keyed by an OPAQUE crypto-random external id.
//
//   • /start persists {uid, createdAt} under a 30-min TTL and FAILS CLOSED
//     with 503 BEFORE SUMIT is called. We never take the ₪1 unless we know
//     we can recover ownership afterwards.
//   • If SUMIT then fails to start, the pending key is deleted.
//   • /return reads the record, verifies the transaction with SUMIT, checks
//     it corresponds to this external reference, and only then CONSUMES the
//     record with an atomic GETDEL. Two concurrent callbacks race on that
//     single command: one wins, the replay gets null and fails closed.
//
// redis.set()/getDel() already return false/null when Redis is unavailable,
// so an outage degrades to "cannot start / cannot save" — never to a bypass.
// There is deliberately NO in-memory fallback: that is the bug being fixed.
// ---------------------------------------------------------------------------
const SAVE_CARD_PENDING_TTL_SECONDS = 30 * 60; // 30 min — generous for a hosted-page checkout

interface PendingSaveCard {
  uid: string;
  createdAt: number;
}

function pendingKey(externalId: string): string {
  return `savecard:pending:${externalId}`;
}

/**
 * Opaque, unguessable handoff id. Deliberately carries NO uid: the external
 * id travels to SUMIT and back through the customer's browser, and internal
 * user ids should not be exposed there. Ownership lives only in Redis.
 */
function newExternalId(): string {
  return `savecard_${randomBytes(24).toString('hex')}`;
}

/**
 * Defensive correspondence check. SUMIT's external-reference field name is not
 * confirmed against the authenticated swagger (same caveat as every other raw
 * field read in this file), so: if we can find one and it DISAGREES, reject —
 * a stolen `ext` must not be redeemable with an attacker's own transaction. If
 * no such field is present at all we log and continue, because hard-requiring
 * an unverified field name would fail every legitimate save.
 */
function externalRefMismatch(raw: any, expectedExt: string): boolean {
  const found =
    raw?.ExternalIdentifier ?? raw?.ExternalID ?? raw?.ExternalId ??
    raw?.Data?.ExternalIdentifier ?? raw?.Data?.ExternalID ?? raw?.Data?.ExternalId;
  if (found == null || String(found).length === 0) return false;
  return String(found) !== expectedExt;
}

// POST /api/payments/save-card/start — start a SUMIT hosted page to save the customer's card.
router.post('/save-card/start', validateFirebaseToken, async (req: Request, res: Response) => {
  if (!isCardVaultEnabled()) return res.status(503).json({ error: 'Card-on-file is not enabled yet' });
  const uid = req.firebaseUser!.uid;
  const externalId = newExternalId();

  // Persist ownership BEFORE money moves. redis.set() returns false when Redis
  // is unavailable — in that case we must not start SUMIT at all, because the
  // ₪1 would be charged with no way to attribute the resulting card.
  const persisted = await redis.set(
    pendingKey(externalId),
    { uid, createdAt: Date.now() } satisfies PendingSaveCard,
    SAVE_CARD_PENDING_TTL_SECONDS,
  );
  if (!persisted) {
    logger.error('[SaveCard] could not persist pending ownership — refusing to start SUMIT (fail-closed)', { uid });
    return res.status(503).json({ error: 'Card save temporarily unavailable, please try again' });
  }

  const result = await sumitClient.beginRedirect({
    externalId,
    // ₪1 verification. NOTE (verified 2026-09-06): this is a REAL charge —
    // there is no void/refund anywhere in this flow or in SumitCardVault, and
    // beginRedirect documents amountIls as "VAT-inclusive gross". The older
    // comment here said "refundable", which only ever meant "could be
    // refunded", not "is refunded". Business rule left unchanged; this note
    // exists so nobody re-reads it as auto-reversed.
    amountIls: 1,
    description: 'שמירת אמצעי תשלום · PetWash',
    // No uid in the URL — it travels through the customer's browser and is not
    // needed: `ext` is an opaque handle and ownership lives in Redis.
    redirectUrl: `${baseUrl()}/api/payments/save-card/return?ext=${encodeURIComponent(externalId)}`,
    customerName: (req.firebaseUser as any)?.name,
    customerEmail: req.firebaseUser?.email,
  });

  // SUMIT never started → release the pending key rather than leaving it to rot.
  if (!result.wired || !result.redirectUrl) {
    await redis.del(pendingKey(externalId));
    if (!result.wired) return res.status(503).json({ error: 'Payments not enabled yet', reason: result.reason });
    return res.status(502).json({ error: 'Could not start card save', reason: result.reason });
  }
  return res.json({ ok: true, redirectUrl: result.redirectUrl });
});

// GET /api/payments/save-card/return — SUMIT redirects the customer back here.
router.get('/save-card/return', async (req: Request, res: Response) => {
  const txnId = String(req.query.ID || req.query.id || '');
  const ext = String(req.query.ext || '');
  const base = baseUrl();
  if (!txnId || !ext) return res.redirect(`${base}/my-wallet?card=failed`);

  // Ownership is SERVER-DERIVED from the /start-time Redis record. The
  // querystring carries no uid any more, and would not be trusted if it did.
  // Read first (non-destructive) so a SUMIT verification failure does not burn
  // the one-shot record — the customer can be sent back to retry.
  const pending = await redis.get<PendingSaveCard>(pendingKey(ext));
  if (!pending?.uid) {
    logger.warn('[SaveCard] no pending save-card session for this externalId (fail-closed)', { ext, txnId });
    return res.redirect(`${base}/my-wallet?card=failed`);
  }

  // Authoritative server-side re-verify — never trust the querystring.
  const verify = await sumitClient.getTransaction(txnId);
  if (!verify.wired || !verify.valid) {
    logger.warn('[SaveCard] return not verified', { txnId, reason: verify.reason });
    return res.redirect(`${base}/my-wallet?card=failed`);
  }

  // A stolen `ext` must not be redeemable with somebody else's transaction.
  if (externalRefMismatch(verify.raw as any, ext)) {
    logger.error('[SaveCard] transaction external reference does not match this handoff (fail-closed)', { ext, txnId });
    return res.redirect(`${base}/my-wallet?card=failed`);
  }

  // ATOMIC one-shot claim. Concurrent duplicate callbacks race on this single
  // Redis command: exactly one gets the record, every replay gets null.
  const claimedRaw = await redis.getDel(pendingKey(ext));
  if (!claimedRaw) {
    logger.warn('[SaveCard] pending handoff already consumed — replay ignored (fail-closed)', { ext, txnId });
    return res.redirect(`${base}/my-wallet?card=failed`);
  }
  let uid: string;
  try {
    uid = (JSON.parse(claimedRaw) as PendingSaveCard).uid;
  } catch {
    logger.error('[SaveCard] pending handoff was unreadable (fail-closed)', { ext, txnId });
    return res.redirect(`${base}/my-wallet?card=failed`);
  }
  if (!uid) {
    logger.error('[SaveCard] pending handoff carried no uid (fail-closed)', { ext, txnId });
    return res.redirect(`${base}/my-wallet?card=failed`);
  }

  // Pull the SUMIT customer + saved payment method from the verified transaction
  // (defensive field shapes — confirmed on the first real save). Fail-closed if absent.
  const raw: any = verify.raw || {};
  const sumitCustomerId =
    raw?.CustomerID ?? raw?.Customer?.ID ?? raw?.Data?.CustomerID ?? raw?.Payment?.CustomerID ?? raw?.Data?.Customer?.ID;
  const token =
    raw?.PaymentMethodID ?? raw?.SinglePaymentToken ?? raw?.Data?.PaymentMethodID ?? raw?.PaymentMethod?.ID;
  if (!sumitCustomerId) {
    logger.warn('[SaveCard] no SUMIT customer id in verified txn — not saving (fail-closed)', { txnId, uid });
    return res.redirect(`${base}/my-wallet?card=unsaved`);
  }

  const saved = await SumitCardVault.saveCard({
    userId: uid,
    sumitCustomerId,
    singlePaymentToken: String(token ?? sumitCustomerId), // fall back to customer ref if the method id isn't surfaced
    cardBrand: raw?.CardBrand ?? raw?.Data?.CardBrand,
    cardLast4: raw?.CardLast4 ?? raw?.Last4 ?? raw?.Data?.CardLast4,
    consentVersion: 'save-card-v1',
  });
  logger.info('[SaveCard] result', { uid, saved: saved.saved, reason: saved.reason });
  return res.redirect(`${base}/my-wallet?card=${saved.saved ? 'saved' : 'unsaved'}`);
});

// GET /api/payments/save-card/status — public: is card-on-file live yet? Lets the wallet
// UI show the "Save a card" button ONLY once CARD_VAULT_ENABLED is flipped on (so no dead
// button appears in prod before go-live).
router.get('/save-card/status', (_req: Request, res: Response) => {
  res.json({ enabled: isCardVaultEnabled() });
});

export default router;
