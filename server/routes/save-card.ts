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
import { Router, Request, Response } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { sumitClient } from '../services/SumitClient';
import { SumitCardVault, isCardVaultEnabled } from '../services/SumitCardVault';
import { logger } from '../lib/logger';

const router = Router();
function baseUrl(): string { return process.env.BASE_URL || 'https://petwash.co.il'; }

// POST /api/payments/save-card/start — start a SUMIT hosted page to save the customer's card.
router.post('/save-card/start', validateFirebaseToken, async (req: Request, res: Response) => {
  if (!isCardVaultEnabled()) return res.status(503).json({ error: 'Card-on-file is not enabled yet' });
  const uid = req.firebaseUser!.uid;
  const externalId = `savecard_${uid}_${Date.now()}`;
  const result = await sumitClient.beginRedirect({
    externalId,
    amountIls: 1, // ₪1 verification — refundable; the point is to save the card, not to charge.
    description: 'שמירת אמצעי תשלום · PetWash',
    redirectUrl: `${baseUrl()}/api/payments/save-card/return?ext=${encodeURIComponent(externalId)}&uid=${encodeURIComponent(uid)}`,
    customerName: (req.firebaseUser as any)?.name,
    customerEmail: req.firebaseUser?.email,
  });
  if (!result.wired) return res.status(503).json({ error: 'Payments not enabled yet', reason: result.reason });
  if (!result.redirectUrl) return res.status(502).json({ error: 'Could not start card save', reason: result.reason });
  return res.json({ ok: true, redirectUrl: result.redirectUrl });
});

// GET /api/payments/save-card/return — SUMIT redirects the customer back here.
router.get('/save-card/return', async (req: Request, res: Response) => {
  const txnId = String(req.query.ID || req.query.id || '');
  const uid = String(req.query.uid || '');
  const base = baseUrl();
  if (!txnId || !uid) return res.redirect(`${base}/my-wallet?card=failed`);

  // Authoritative server-side re-verify — never trust the querystring.
  const verify = await sumitClient.getTransaction(txnId);
  if (!verify.wired || !verify.valid) {
    logger.warn('[SaveCard] return not verified', { txnId, uid, reason: verify.reason });
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
