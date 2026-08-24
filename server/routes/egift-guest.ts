/**
 * Guest eGift checkout — buy a gift card WITHOUT signing up (public), 2026-08-01.
 *
 * Fixes two things at once: eGift was member-only AND wired to Nayax (off). This is a
 * PUBLIC path on SUMIT (live) so a stranger can buy a gift with just an email + card.
 *
 * PROTECTION (public money = fraud target — all four in place):
 *   1. Gated by PETWASH_EGIFT_PURCHASE_ENABLED (off by default) — inert until go-live.
 *   2. Server owns the price (bounded ₪MIN..₪MAX) — a guest can't tamper the amount.
 *   3. Turnstile bot-check + payment rate limiter on the public POST.
 *   4. PAY-THEN-ISSUE — the voucher is created ONLY after SUMIT verifies the charge AND
 *      the paid amount matches the stored order. No card data touches us (SUMIT hosts it).
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db';
import { egiftGuestOrders } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sumitClient } from '../services/SumitClient';
import { issueVoucher } from '../services/unifiedVoucherService';
import { verifyTurnstileToken } from '../lib/verifyTurnstile';
import { paymentLimiter } from '../middleware/rateLimiter';
import { EGIFT_EXEMPTION_CAP_ILS } from '../lib/egift-denominations';
import { logger } from '../lib/logger';
// Modernity SEV-1 #1 (2026-08-20 audit): audit-log wrapper on the public
// eGift purchase POST — pay-then-issue mutates money and issues a voucher.
import { auditMiddleware as auditLogMiddleware } from '../middleware/auditLog';

const router = Router();
function baseUrl(): string { return process.env.BASE_URL || 'https://petwash.co.il'; }
function isEgiftPurchaseEnabled(): boolean {
  const v = (process.env.PETWASH_EGIFT_PURCHASE_ENABLED || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

// Server-owned bounds — the guest picks the gift value, but only within safe limits.
// The MAX is the Israeli Payment-Services exemption cap (₪1,500): a closed-loop,
// paid-in-full voucher above it would require a payment LICENCE. Pulled from the
// single locked source (egift-denominations.ts) so this can never silently drift
// past the legal ceiling.
const MIN_EGIFT_ILS = 20;
const MAX_EGIFT_ILS = EGIFT_EXEMPTION_CAP_ILS;

const guestStartSchema = z.object({
  senderEmail: z.string().email(),
  senderName: z.string().max(128).optional(),
  recipientEmail: z.string().email(),
  recipientName: z.string().min(1).max(128),
  recipientPhone: z.string().max(32).optional(),
  message: z.string().max(500).optional(),
  amountIls: z.coerce.number(),
  turnstileToken: z.string().optional(),
});

// POST /api/egift/guest/start — PUBLIC. Bot-protected, server-owned price.
router.post('/guest/start', paymentLimiter, auditLogMiddleware('EGIFT_ISSUE'), async (req: Request, res: Response) => {
  if (!isEgiftPurchaseEnabled()) {
    return res.status(503).json({ error: 'eGift purchase is not available right now', errorCode: 'EGIFT_DISABLED' });
  }
  const parsed = guestStartSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid details', issues: parsed.error.flatten() });
  const d = parsed.data;

  // Bot protection on a public money page. verifyTurnstileToken returns { valid, reason }.
  // Block a real failed challenge, but soft-pass when Turnstile isn't configured
  // (reason 'not_configured') so a config gap can't lock out legitimate buyers.
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
  const ts: any = await verifyTurnstileToken(d.turnstileToken || '', ip).catch(() => ({ valid: false, reason: 'error' }));
  const botOk = ts?.valid === true || ts?.reason === 'not_configured';
  if (!botOk) return res.status(403).json({ error: 'Bot check failed — please retry.', errorCode: 'BOT_CHECK' });

  // Server-owned price bounds.
  const amountIls = Math.round(d.amountIls * 100) / 100;
  if (!(amountIls >= MIN_EGIFT_ILS && amountIls <= MAX_EGIFT_ILS)) {
    return res.status(400).json({ error: `Gift amount must be between ₪${MIN_EGIFT_ILS} and ₪${MAX_EGIFT_ILS}.`, errorCode: 'AMOUNT_OUT_OF_RANGE' });
  }

  const externalId = `egiftguest_${crypto.randomUUID()}`;
  await db.insert(egiftGuestOrders).values({
    externalId,
    senderEmail: d.senderEmail,
    senderName: d.senderName ?? null,
    recipientEmail: d.recipientEmail,
    recipientName: d.recipientName,
    recipientPhone: d.recipientPhone ?? null,
    message: d.message ?? null,
    amountIlsCents: Math.round(amountIls * 100),
    status: 'pending',
  });

  const result = await sumitClient.beginRedirect({
    externalId,
    amountIls,
    description: `PetWash eGift · ₪${amountIls}`,
    redirectUrl: `${baseUrl()}/api/egift/guest/return?ext=${encodeURIComponent(externalId)}`,
    customerName: d.senderName,
    customerEmail: d.senderEmail,
  });
  if (!result.wired) return res.status(503).json({ error: 'Payments not enabled yet', reason: result.reason });
  if (!result.redirectUrl) return res.status(502).json({ error: 'Could not start payment', reason: result.reason });
  return res.json({ ok: true, redirectUrl: result.redirectUrl });
});

// GET /api/egift/guest/return — SUMIT redirects the buyer back. Verify → issue → done.
router.get('/guest/return', async (req: Request, res: Response) => {
  const txnId = String(req.query.ID || req.query.id || '');
  const ext = String(req.query.ext || '');
  const base = baseUrl();
  if (!txnId || !ext) return res.redirect(`${base}/egift?status=failed`);

  const [order] = await db.select().from(egiftGuestOrders).where(eq(egiftGuestOrders.externalId, ext)).limit(1);
  if (!order) { logger.warn('[GuestEgift] return for unknown order', { ext, txnId }); return res.redirect(`${base}/egift?status=failed`); }
  if (order.status === 'issued') return res.redirect(`${base}/egift?status=success`); // idempotent

  // Authoritative re-verify + amount match (never trust the querystring).
  const verify = await sumitClient.getTransaction(txnId);
  if (!verify.wired || !verify.valid) {
    logger.warn('[GuestEgift] payment not verified', { ext, txnId, reason: verify.reason });
    return res.redirect(`${base}/egift?status=failed&ref=${encodeURIComponent(ext)}`);
  }
  if (verify.amountCents != null && verify.amountCents !== order.amountIlsCents) {
    logger.error('[GuestEgift] amount mismatch — NOT issuing', { ext, paid: verify.amountCents, expected: order.amountIlsCents });
    return res.redirect(`${base}/egift?status=failed&ref=${encodeURIComponent(ext)}`);
  }

  // Pay-then-issue: create the voucher for the recipient (unique + cryptographically signed).
  try {
    const voucher = await issueVoucher({
      voucherType: 'PLATFORM_CREDIT',
      valueIls: order.amountIlsCents / 100,
      recipientDisplayName: order.recipientName,
      recipientEmail: order.recipientEmail,
      recipientPhone: order.recipientPhone ?? undefined,
      personalMessage: order.message ?? undefined,
      purchasedByUserId: null,        // guest — no account
      purchasedByEmail: order.senderEmail,
    });
    await db.update(egiftGuestOrders)
      .set({ status: 'issued', voucherId: String(voucher.id), sumitTransactionId: txnId, issuedAt: new Date() })
      .where(eq(egiftGuestOrders.externalId, ext));
    logger.info('[GuestEgift] voucher issued to recipient', { ext, voucherId: voucher.id });
    return res.redirect(`${base}/egift?status=success`);
  } catch (e: any) {
    // Paid but not issued — record for manual reconcile; NEVER silently drop a paid order.
    logger.error('[GuestEgift] issue FAILED after payment — needs manual reconcile', { ext, txnId, err: e?.message });
    // HIGH-2 fix (save-integrity audit 2026-08-24): was .catch(() => {}). If
    // this UPDATE errors, the order stays 'pending' forever while the customer
    // has ALREADY been charged. Money-adjacent — log the failure at error level.
    await db.update(egiftGuestOrders)
      .set({ status: 'failed', sumitTransactionId: txnId })
      .where(eq(egiftGuestOrders.externalId, ext))
      .catch((updateErr: any) => {
        logger.error('[GuestEgift] mark-failed UPDATE errored — order stuck in pending after paid; needs manual reconcile', {
          ext, txnId, updateErr: updateErr?.message,
        });
      });
    return res.redirect(`${base}/egift?status=issue_failed&ref=${encodeURIComponent(ext)}`);
  }
});

export default router;
