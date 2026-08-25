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
import { resolveWashDiscount, applyWashDiscountCents, type WashDiscount } from '../services/memberDiscount';
import { activateFromVerifiedPayment } from '../services/PurchaseActivationService';

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
  WASH_PACKAGE_10: { surface: 'kiosk' as const, amountCents: 40000, washCount: 10, productType: 'WASH_PACKAGE', description: 'Wash package — 10 washes' }, // ₪400 — CEO decision 2026-07-15 (Maison ladder fix, #1426)
  // eGift cards — the four CEO-confirmed tiers, server-owned prices (no client
  // amount = no tampering). Rail moved OFF Nayax → SUMIT/UPay. Recipient/sender
  // details ride in the client `metadata` (spread into the purchase row) and are
  // fulfilled on the SUMIT webhook by activateProduct → GiftOrchestrationService.
  EGIFT_100:       { surface: 'egift' as const, amountCents: 10000,  productType: 'EGIFT', description: 'eGift card — ₪100' },
  EGIFT_250:       { surface: 'egift' as const, amountCents: 25000,  productType: 'EGIFT', description: 'eGift card — ₪250' },
  EGIFT_500:       { surface: 'egift' as const, amountCents: 50000,  productType: 'EGIFT', description: 'eGift card — ₪500' },
  EGIFT_1000:      { surface: 'egift' as const, amountCents: 100000, productType: 'EGIFT', description: 'eGift card — ₪1000' },
} as const;
type Phase1Sku = keyof typeof PHASE1_PRODUCTS;

const beginSchema = z.object({
  // The product is chosen by SKU from the server-owned catalog. NO client price.
  sku: z.enum(['ACCOUNT_CREDIT', 'SINGLE_WASH', 'WASH_PACKAGE_3', 'WASH_PACKAGE_5', 'WASH_PACKAGE_10', 'EGIFT_100', 'EGIFT_250', 'EGIFT_500', 'EGIFT_1000']),
  // Only meaningful for ACCOUNT_CREDIT (variable-amount wallet top-up). Bounded.
  topupIls: z.number().positive().max(10_000).optional(),
  orderId: z.string().max(120).optional(),
  metadata: z.record(z.unknown()).optional(),
  // Optional coupon. Validated + priced SERVER-SIDE by CouponService; the client
  // never supplies a discount amount. Kiosk wash SKUs only (never eGift/top-up —
  // discounting stored value would be a cash-arbitrage hole).
  couponCode: z.string().min(1).max(64).optional(),
});

// Which coupon orderType each kiosk SKU maps to. eGift + wallet top-up are
// DELIBERATELY absent: a coupon there would sell ₪100 of stored value for less
// than ₪100 (value arbitrage), which the discount policy forbids.
const COUPON_ORDER_TYPE: Partial<Record<Phase1Sku, 'kiosk_wash' | 'package_purchase'>> = {
  SINGLE_WASH: 'kiosk_wash',
  WASH_PACKAGE_3: 'package_purchase',
  WASH_PACKAGE_5: 'package_purchase',
  WASH_PACKAGE_10: 'package_purchase',
};

/**
 * Resolve price, productType, surface and unit count SERVER-SIDE from the
 * Phase-1 catalog. The client cannot influence the charged amount (except the
 * bounded wallet top-up value, which is credited 1:1 with what we charge).
 * Returns null for anything not purchasable in Phase 1.
 */
function resolvePhase1Order(sku: Phase1Sku, topupIls?: number):
  | { amountCents: number; productType: string; surface: string; washCount?: number; description: string }
  | null {
  if (sku === 'ACCOUNT_CREDIT') {
    if (!topupIls || !Number.isFinite(topupIls) || topupIls <= 0) return null;
    const amountCents = Math.round(topupIls * 100);
    return { amountCents, productType: 'ACCOUNT_CREDIT', surface: 'wallet_topup', description: 'Account credit' };
  }
  const def = PHASE1_PRODUCTS[sku] as any;
  if (!def || typeof def.amountCents !== 'number') return null;
  return {
    amountCents: def.amountCents,
    productType: def.productType || sku,
    surface: def.surface,
    washCount: def.washCount,
    description: def.description,
  };
}

// GET /api/payments/sumit/catalog — the server-owned price list, read-only.
// The canonical /checkout page renders prices FROM THIS, never from client
// constants, so what the customer sees is exactly what /begin will charge.
router.get('/catalog', (_req: Request, res: Response) => {
  const products = (Object.keys(PHASE1_PRODUCTS) as Phase1Sku[])
    .filter((sku) => sku !== 'ACCOUNT_CREDIT')
    .map((sku) => {
      const def = PHASE1_PRODUCTS[sku] as any;
      return {
        sku,
        amountCents: def.amountCents as number,
        description: def.description as string,
        surface: def.surface as string,
        ...(def.washCount != null ? { washCount: def.washCount as number } : {}),
        couponEligible: sku in COUPON_ORDER_TYPE,
      };
    });
  res.json({ ok: true, currency: 'ILS', vatIncluded: true, products });
});

// POST /api/payments/sumit/begin
router.post('/begin', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Authentication required' });

  const parsed = beginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const { sku, topupIls, orderId, metadata, couponCode } = parsed.data;

  // SERVER-SIDE price/quantity. The client supplies only a SKU (+ a bounded
  // top-up value for wallet_topup); price, productType, surface and the unit
  // count all come from the server-owned catalog. A request for anything not
  // in the Phase-1 PetWash-owned set is rejected — "provider commerce
  // disabled" is enforced here, not left to a downstream switch default.
  const order = resolvePhase1Order(sku, topupIls);
  if (!order) return res.status(400).json({ error: 'product_not_purchasable' });
  const { amountCents: grossCents, productType: resolvedProductType, surface: resolvedSurface, washCount, description } = order;

  // ── Member wash discount (server-authoritative). Applies to K9000 WASH SKUs
  //    ONLY — single wash + wash packages, which are the catalog's kiosk-surface
  //    products. NEVER to wallet top-up / eGift / shop / other services. The
  //    discount percent is resolved server-side from loyalty membership
  //    (Prestige Basic = automatic 5%) and any admin-approved senior/disability
  //    record; the client cannot influence it. Capped at 10%.
  const isWashSku = resolvedSurface === 'kiosk'
    && (resolvedProductType === 'SINGLE_WASH' || resolvedProductType === 'WASH_PACKAGE');
  let amountCents = grossCents;
  let washDiscount: { percent: number; source: WashDiscount['source'] } = { percent: 0, source: 'none' };
  let discountCents = 0;
  if (isWashSku) {
    const resolved = await resolveWashDiscount(uid);
    if (resolved.percent > 0) {
      const applied = applyWashDiscountCents(grossCents, resolved.percent);
      amountCents = applied.netCents;
      discountCents = applied.discountCents;
      washDiscount = { percent: applied.percent, source: resolved.source };
      logger.info('[SumitPay] member wash discount applied', {
        uid, sku, grossCents, netCents: amountCents, percent: applied.percent, source: resolved.source,
      });
    }
  }
  // ── Coupon (server-validated, server-priced). FAIL-CLOSED: an invalid or
  //    ineligible coupon rejects the request with the reason — we never
  //    silently charge full price after the customer saw a discount. The
  //    redemption itself is recorded ONLY when the payment is verified
  //    (PurchaseActivationService, after the paid-claim lock), so an abandoned
  //    checkout never burns the coupon.
  let coupon: {
    code: string; couponId: number; issuanceId?: number;
    amountBeforeCents: number; discountCents: number; orderType: string;
  } | null = null;
  if (couponCode) {
    const couponOrderType = COUPON_ORDER_TYPE[sku];
    if (!couponOrderType) {
      return res.status(400).json({ error: 'coupon_not_applicable', errorCode: 'COUPON_NOT_APPLICABLE_TO_PRODUCT' });
    }
    const { couponService } = await import('../services/CouponService');
    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] ?? req.socket.remoteAddress;
    const v = await couponService.validateCoupon({
      code: couponCode,
      userId: uid,
      orderType: couponOrderType,
      amountCents,
      ipAddress,
      // Tell the stacking engine which automatic member benefit is already on
      // this order so its stackability rules (not us) decide the combination.
      activeBenefits: washDiscount.percent > 0
        ? { loyalty_5_pct: washDiscount.percent === 5, special_10_pct: washDiscount.percent > 5 }
        : undefined,
    });
    if (!v.valid || !v.couponId || !(v.discountAmountCents! > 0) || !(v.amountAfterCents! > 0)) {
      return res.status(400).json({
        error: 'coupon_invalid',
        errorCode: v.errorCode || 'COUPON_INVALID',
        reason: v.error || 'Coupon not valid for this order',
      });
    }
    // SUMIT cannot charge a zero/near-zero order; keep a ₪1 floor.
    if (v.amountAfterCents! < 100) {
      return res.status(400).json({ error: 'coupon_invalid', errorCode: 'COUPON_DISCOUNT_TOO_LARGE' });
    }
    coupon = {
      code: couponCode,
      couponId: v.couponId,
      issuanceId: v.issuanceId,
      amountBeforeCents: amountCents,
      discountCents: v.discountAmountCents!,
      orderType: couponOrderType,
    };
    amountCents = v.amountAfterCents!;
    logger.info('[SumitPay] coupon applied at begin', {
      uid, sku, couponId: v.couponId, discountCents: v.discountAmountCents, netCents: amountCents,
    });
  }

  const amountIls = amountCents / 100;

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
          description,
          sku,
          ...(washCount != null ? { washCount } : {}),
          // Discount line-item facts (server-owned). grossCents is the catalog
          // price before discount; amountCents (above) is what we actually charge.
          ...(discountCents > 0
            // netCents here = after the member discount, BEFORE any coupon
            // (coupon.amountBeforeCents equals it when a coupon applied after).
            ? { washDiscount: { percent: washDiscount.percent, source: washDiscount.source, grossCents, discountCents, netCents: coupon ? coupon.amountBeforeCents : amountCents } }
            : {}),
          // Server-validated coupon facts. PurchaseActivationService records the
          // redemption from THIS block after the paid-claim lock — client
          // metadata can never fabricate it (server keys spread last, above).
          ...(coupon ? { coupon } : {}),
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
  return res.json({
    ok: true,
    redirectUrl: result.redirectUrl,
    externalId,
    // Surface the discount as a line item so the client can show the savings.
    ...(discountCents > 0
      ? { discount: { percent: washDiscount.percent, source: washDiscount.source, grossCents, discountCents, netCents: coupon ? coupon.amountBeforeCents : amountCents } }
      : {}),
    ...(coupon
      ? { coupon: { code: coupon.code, discountCents: coupon.discountCents, netCents: amountCents } }
      : {}),
  });
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

  // FULFIL NOW, from the verified return — do NOT depend on a SUMIT webhook.
  // beginRedirect registers NO notification URL with SUMIT, and the webhook
  // lifecycle flag (ff.commerce.unified_purchase_lifecycle) is OFF in prod, so the
  // ONLY other fulfilment path never runs. Without this, a paid wash-package / wallet
  // top-up sits 'payment_pending' forever: the customer is charged and receives
  // NOTHING (verified P0, 2026-08-01). This mirrors the proven guest-eGift /return
  // pattern (fulfil inline after an authoritative re-verify).
  //
  // activateFromVerifiedPayment is fully idempotent — provider-ref lock + a
  // purchase-level conditional flip (payment_pending → activated) + addCredits'
  // (sourceType,sourceId) dedupe — so if the webhook is ever enabled and ALSO
  // fires, or the customer refreshes this page, it CANNOT double-credit. It also
  // re-verifies the transaction itself, so this is belt-and-suspenders.
  let fulfilOk = true;
  try {
    const activation = await activateFromVerifiedPayment({
      providerReference: `sumit_return:${txnId}`,
      transactionId: txnId,
      externalRef: ext || undefined,
    });
    fulfilOk = activation.outcome === 'activated' || activation.outcome === 'already_processed';
    if (!fulfilOk) {
      logger.error('[SumitPay] FULFILMENT INCOMPLETE after verified payment — paid, not delivered; needs reconcile', { txnId, ext, outcome: activation.outcome, reason: activation.reason });
    } else {
      logger.info('[SumitPay] fulfilment ok', { txnId, ext, outcome: activation.outcome });
    }
  } catch (e: any) {
    fulfilOk = false;
    logger.error('[SumitPay] fulfilment THREW after verified payment — paid, not delivered; needs reconcile', { txnId, ext, err: e?.message });
  }

  // A verified paid + failed fulfilment is a paid-not-delivered case that
  // must be surfaced to ops explicitly, not left buried in the log. Fire a
  // deduped admin alert so ops sees + reconciles it manually. Best-effort:
  // the customer redirect must still succeed even if the alert insert fails.
  if (!fulfilOk) {
    try {
      const { createOrUpdateAlert } = await import('../services/AlertEngine');
      await createOrUpdateAlert({
        dedupeKey: `sumit_fulfil_pending:${txnId}`,
        category: 'money' as any,
        severity: 'critical' as any,
        title: 'SUMIT payment verified but fulfilment failed — paid, not delivered',
        message: `Customer paid successfully (txn ${txnId}) but the wallet-credit / wash-package activation did NOT complete. Manual reconciliation required.`,
        linkedEntityType: 'sumit_transaction',
        linkedEntityId: txnId,
        source: 'sumit_return',
        metadata: { txnId, ext },
      });
    } catch (alertErr: any) {
      logger.error('[SumitPay] Failed to open reconciliation alert (non-blocking)', { txnId, err: alertErr?.message });
    }
  }

  // Always land on success (the money DID clear); when fulfilment didn't complete,
  // flag it so the success page tells the truth ("being processed") + carries a ref.
  const suffix = fulfilOk ? '' : '&fulfil=pending';
  return res.redirect(`${base}/payment-success?ref=${encodeURIComponent(ext || txnId)}${suffix}`);
});

export default router;
