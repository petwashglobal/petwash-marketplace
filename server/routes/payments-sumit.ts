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
import { db } from '../db';
import { purchases } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { EGIFT_EXEMPTION_CAP_ILS } from '../lib/egift-denominations';

const router = Router();

function baseUrl(): string {
  return process.env.BASE_URL || 'https://petwash.co.il';
}

// ── Phase-1 server-owned catalog. PROVIDER COMMERCE IS DISABLED — only
//    PetWash-owned products are purchasable, and their price/quantity are
//    resolved SERVER-SIDE. The client may NOT supply an amount: a tampered
//    request can no longer set its own price or launder an arbitrary sum into
//    spendable wallet credit. A real price-table lookup replaces this map
//    later, but the contract (server owns price) stays the same.
//
//    ACCOUNT_CREDIT (wallet_topup) is the one variable-amount product, so it
//    takes a bounded, explicit `topupIls` rather than a SKU — the credited
//    cents equal exactly what we charge SUMIT, and nothing else can reach the
//    wallet-credit branch in activation.
// Real CEO prices (2026-06-19). K9000 station washes only. ILS, VAT-inclusive
// gross (SUMIT issues the fiscal doc on the hosted page).
const PHASE1_PRODUCTS = {
  ACCOUNT_CREDIT:  { surface: 'wallet_topup' as const },
  SINGLE_WASH:     { surface: 'kiosk' as const, amountCents: 5500,  washCount: 1,  productType: 'SINGLE_WASH',  description: 'Single wash (K9000)' },
  WASH_PACKAGE_3:  { surface: 'kiosk' as const, amountCents: 15000, washCount: 3,  productType: 'WASH_PACKAGE', description: 'Wash package — 3 washes' },
  WASH_PACKAGE_5:  { surface: 'kiosk' as const, amountCents: 22000, washCount: 5,  productType: 'WASH_PACKAGE', description: 'Wash package — 5 washes' },
  WASH_PACKAGE_10: { surface: 'kiosk' as const, amountCents: 44000, washCount: 10, productType: 'WASH_PACKAGE', description: 'Wash package — 10 washes' },
  // eGift cards (CEO prices). Stored monetary value sent to a RECIPIENT — the
  // webhook activation creates a recipient-bound gift (never credits the buyer).
  // Max ₪1,000 keeps every card under the ₪1,500 payment-services exemption cap.
  EGIFT_100:       { surface: 'gift_card' as const, amountCents: 10000,  productType: 'EGIFT_CARD', description: 'PetWash eGift — ₪100' },
  EGIFT_250:       { surface: 'gift_card' as const, amountCents: 25000,  productType: 'EGIFT_CARD', description: 'PetWash eGift — ₪250' },
  EGIFT_500:       { surface: 'gift_card' as const, amountCents: 50000,  productType: 'EGIFT_CARD', description: 'PetWash eGift — ₪500' },
  EGIFT_1000:      { surface: 'gift_card' as const, amountCents: 100000, productType: 'EGIFT_CARD', description: 'PetWash eGift — ₪1,000 (Gold)' },
} as const;
type Phase1Sku = keyof typeof PHASE1_PRODUCTS;

const beginSchema = z.object({
  // The product is chosen by SKU from the server-owned catalog. NO client price.
  sku: z.enum([
    'ACCOUNT_CREDIT', 'SINGLE_WASH', 'WASH_PACKAGE_3', 'WASH_PACKAGE_5', 'WASH_PACKAGE_10',
    'EGIFT_100', 'EGIFT_250', 'EGIFT_500', 'EGIFT_1000', 'EGIFT',
  ]),
  // Only meaningful for ACCOUNT_CREDIT (variable-amount wallet top-up). Bounded.
  topupIls: z.number().positive().max(10_000).optional(),
  // Only meaningful for the variable EGIFT sku. Hard-capped at the ₪1,500
  // payment-services exemption — above it PetWash would need a payment licence.
  giftIls: z.number().positive().max(EGIFT_EXEMPTION_CAP_ILS).optional(),
  orderId: z.string().max(120).optional(),
  metadata: z.record(z.unknown()).optional(),
  // REQUIRED for eGift: who receives the gift. The gift is bound to this
  // recipient at activation, NOT to the buyer.
  recipient: z.object({
    name: z.string().min(1).max(80),
    email: z.string().email().max(120),
    phone: z.string().max(40).optional(),
    message: z.string().max(500).optional(),
  }).optional(),
});

/**
 * Resolve price, productType, surface and unit count SERVER-SIDE from the
 * Phase-1 catalog. The client cannot influence the charged amount (except the
 * bounded wallet top-up value, which is credited 1:1 with what we charge).
 * Returns null for anything not purchasable in Phase 1.
 */
function resolvePhase1Order(sku: string, topupIls?: number, giftIls?: number):
  | { amountCents: number; productType: string; surface: string; washCount?: number; description: string }
  | null {
  if (sku === 'ACCOUNT_CREDIT') {
    if (!topupIls || !Number.isFinite(topupIls) || topupIls <= 0) return null;
    const amountCents = Math.round(topupIls * 100);
    return { amountCents, productType: 'ACCOUNT_CREDIT', surface: 'wallet_topup', description: 'Account credit' };
  }
  // Variable-amount eGift (the gift page allows custom values ₪50–₪1,500).
  // The hard ₪1,500 cap is enforced both by the zod schema and here, from the
  // single-source EGIFT_EXEMPTION_CAP_ILS constant — never exceed it.
  if (sku === 'EGIFT') {
    if (!giftIls || !Number.isFinite(giftIls) || giftIls < 50 || giftIls > EGIFT_EXEMPTION_CAP_ILS) return null;
    const amountCents = Math.round(giftIls * 100);
    return { amountCents, productType: 'EGIFT_CARD', surface: 'gift_card', description: `PetWash eGift — ₪${giftIls}` };
  }
  const def = (PHASE1_PRODUCTS as Record<string, any>)[sku];
  if (!def || typeof def.amountCents !== 'number') return null;
  return {
    amountCents: def.amountCents,
    productType: def.productType || sku,
    surface: def.surface,
    washCount: def.washCount,
    description: def.description,
  };
}

// POST /api/payments/sumit/begin
router.post('/begin', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });

  const parsed = beginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const { sku, topupIls, giftIls, orderId, metadata, recipient } = parsed.data;

  // SERVER-SIDE price/quantity. The client supplies only a SKU (+ a bounded
  // top-up value for wallet_topup); price, productType, surface and the unit
  // count all come from the server-owned catalog. A request for anything not
  // in the Phase-1 PetWash-owned set is rejected — "provider commerce
  // disabled" is enforced here, not left to a downstream switch default.
  const order = resolvePhase1Order(sku, topupIls, giftIls);
  if (!order) return res.status(400).json({ error: 'product_not_purchasable' });
  const { amountCents, productType: resolvedProductType, surface: resolvedSurface, washCount, description } = order;
  const amountIls = amountCents / 100;

  // eGift MUST have a recipient — the gift is bound to them at activation, not
  // to the buyer. Block the purchase if recipient details are missing.
  if (resolvedProductType === 'EGIFT_CARD' && (!recipient?.email || !recipient?.name)) {
    return res.status(400).json({ error: 'egift_recipient_required' });
  }

  const externalId = orderId || `pw-${uid}-${Date.now().toString(36)}`;

  // Create the shadow `purchases` row (status 'payment_pending') BEFORE the
  // redirect so the webhook has something to find via surfaceRefId=externalId.
  // Idempotent on (surface, surfaceRefId): a retried /begin reuses the row.
  try {
    const existing = await db
      .select({ id: purchases.id })
      .from(purchases)
      .where(eq(purchases.surfaceRefId, externalId))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(purchases).values({
        surface: resolvedSurface,
        surfaceRefId: externalId,
        buyerUserId: uid,
        productType: resolvedProductType,
        amountCents,
        currency: 'ILS',
        status: 'payment_pending',
        paymentMethod: 'credit_card',
        segment: 'b2c',
        acquirer: 'upay_via_sumit',
        systemOfRecord: 'sumit',
        // SERVER-OWNED fulfilment facts. washCount comes from the catalog, NOT
        // the client — activation reads metadataJson.washCount but the client
        // can no longer influence it. Client `metadata` is spread first so it
        // can never override the server keys that follow.
        metadataJson: {
          ...(metadata ?? {}),
          description, sku,
          // Activation-owned keys — force null so a client-supplied `metadata`
          // can NEVER inject them. Without this, a buyer could pre-set
          // egiftGiftCardId to trip the activation idempotency belt and be
          // CHARGED with no gift ever minted/delivered (charged-but-no-gift).
          egiftGiftCardId: null,
          egiftPublicCode: null,
          ...(washCount != null ? { washCount } : {}),
          // Server-owned eGift recipient facts (client metadata is spread FIRST so
          // it can never override these). The activation handler reads them to
          // create a recipient-bound gift — the buyer is never credited.
          ...(resolvedProductType === 'EGIFT_CARD' && recipient ? {
            egiftRecipientName: recipient.name,
            egiftRecipientEmail: recipient.email,
            egiftRecipientPhone: recipient.phone ?? null,
            egiftMessage: recipient.message ?? null,
            egiftPurchaserEmail: req.firebaseUser?.email ?? null,
            egiftSenderName: (req.firebaseUser as any)?.name ?? null,
          } : {}),
        },
      });
    }
  } catch (err: any) {
    // A unique-violation here means a concurrent /begin already created it —
    // safe to proceed to redirect. Any other error: log but don't block the
    // customer's payment (the webhook's not_found path stays the safety net).
    if (err?.code !== '23505') {
      logger.error('[SumitPay] failed to create purchase row (continuing to redirect)', {
        externalId, err: err?.message,
      });
    }
  }

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
