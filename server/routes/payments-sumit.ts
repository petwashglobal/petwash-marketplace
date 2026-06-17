/**
 * SUMIT hosted-page payments (the smart, PCI-safe rail; UPay clears underneath).
 *
 *   POST /api/payments/sumit/begin   → creates a hosted payment, returns the SUMIT
 *                                       payment-page URL for the client to redirect to.
 *   GET  /api/payments/sumit/return  → SUMIT redirects the customer back here after
 *                                       paying; we RE-VERIFY server-side (the querystring
 *                                       is spoofable) before treating it as paid.
 *
 * No card data ever touches our server (SUMIT hosts the form). SUMIT issues the
 * fiscal חשבונית/קבלה itself on a successful hosted charge.
 *
 * Active only when SUMIT is wired (SUMIT_ENABLED=true); sandbox until SUMIT_SANDBOX=false.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { sumitClient } from '../services/SumitClient';
import { logger } from '../lib/logger';

const router = Router();

function baseUrl(): string {
  return process.env.BASE_URL || 'https://petwash.co.il';
}

const beginSchema = z.object({
  amountIls: z.number().positive().max(100_000),
  description: z.string().min(1).max(200),
  orderId: z.string().max(120).optional(),
});

// POST /api/payments/sumit/begin
router.post('/begin', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });

  const parsed = beginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const { amountIls, description, orderId } = parsed.data;

  const externalId = orderId || `pw-${uid}-${Date.now().toString(36)}`;
  const result = await sumitClient.beginRedirect({
    externalId,
    amountIls,
    description,
    redirectUrl: `${baseUrl()}/api/payments/sumit/return?ext=${encodeURIComponent(externalId)}`,
    customerName: (req.firebaseUser as any)?.name,
    customerEmail: req.firebaseUser?.email,
  });

  if (!result.wired) return res.status(503).json({ error: 'Payments not enabled yet', reason: result.reason });
  if (!result.redirectUrl) return res.status(502).json({ error: 'Could not start payment', reason: result.reason });
  return res.json({ ok: true, redirectUrl: result.redirectUrl, externalId });
});

// GET /api/payments/sumit/return  (SUMIT redirects the customer back here)
router.get('/return', async (req: Request, res: Response) => {
  const txnId = String(req.query.ID || req.query.id || '');
  const ext = String(req.query.ext || '');
  const base = baseUrl();
  if (!txnId) return res.redirect(`${base}/payment-failed`);

  // Authoritative server-side re-verify — never trust the querystring's Valid/Result.
  const verify = await sumitClient.getTransaction(txnId);
  if (!verify.wired || !verify.valid) {
    logger.warn('[SumitPay] return not verified', { txnId, ext, reason: verify.reason });
    return res.redirect(`${base}/payment-failed?ref=${encodeURIComponent(ext || txnId)}`);
  }
  logger.info('[SumitPay] payment verified', { txnId, ext });
  // SUMIT already issued the fiscal doc on the hosted page. Fulfilment per orderId
  // (credit wallet / mark booking) is handled by the order's own flow keyed on ext.
  return res.redirect(`${base}/payment-success?ref=${encodeURIComponent(ext || txnId)}`);
});

export default router;
