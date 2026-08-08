/**
 * PurchaseActivationService — Commerce OS Phase-1 webhook activation.
 * ==================================================================
 *
 * CEO spec (Phase 1, PetWash-owned products ONLY; provider commerce DISABLED):
 *   "A PetWash order activates ONLY from a verified SUMIT webhook payment
 *    confirmation, NOT from the frontend redirect. One order, one payment
 *    event, one activation, one audit ledger."
 *
 * This is the ONLY place a `purchases` row flips to 'paid' → 'activated'.
 * The frontend /return route stays verify-and-display only.
 *
 * IDEMPOTENCY (the whole point):
 *   Before doing anything, we INSERT a `purchase_events` row keyed on
 *   (providerName='sumit', providerReference=<stable SUMIT payment id>).
 *   That pair has a UNIQUE index (purchase_events_provider_ref_uq). A
 *   duplicate webhook therefore throws a unique violation on the insert —
 *   caught here and short-circuited to {outcome:'already_processed'}. The
 *   lock is taken BEFORE activation so concurrent/retried webhooks serialise
 *   on the DB and exactly one of them proceeds. Wallet credits add a second
 *   layer (addCredits dedupes on sourceType+sourceId=purchase.id).
 *
 * SAFETY:
 *   - NEVER activates on an unverified payment (re-verifies with SUMIT when wired).
 *   - NEVER fakes activation. A product type with no safe handler is left at
 *     status 'paid' with metadataJson.activation='pending' + an alert — fully
 *     recoverable by a follow-up once the handler ships.
 *   - PROVIDER COMMERCE IS DISABLED — provider bookings never auto-activate.
 */

import { db } from '../db';
import { purchases, purchaseEvents, users, type Purchase } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { walletService } from './WalletService';
import { shadowMirrorWalletTopup } from './LedgerService';
import { GiftOrchestrationService } from './giftOrchestrationService';
import { sumitClient } from './SumitClient';
import { recordAuditEvent } from '../utils/auditSignature';
import { sendAlert } from '../monitoring';
import { logger } from '../lib/logger';
import { IsraeliDigitalReceiptService } from './IsraeliDigitalReceiptService';
import { PETWASH_INCOME_ITEMS } from '@shared/petwashIncomeItems';

/**
 * Issue a customer tax receipt for a DIRECT PetWash sale bought via SUMIT —
 * a wash package/single, an eGift voucher, or a wallet top-up. All are
 * PetWash's OWN income (no provider, no marketplace commission), so VAT is on
 * the full amount at point of sale. Reuses the live IsraeliDigitalReceiptService
 * (writes digital_receipts + emails the buyer) — the same engine sitter/walk/
 * academy use.
 *
 * The 2026-07-05 fiscal audit found three money classes issuing NO receipt:
 * wash packages (fixed earlier), eGift purchases and wallet top-ups (fixed
 * here). Each takes real money and must produce a חשבונית מס/קבלה.
 * NON-BLOCKING: a receipt failure must never block the credit/voucher grant or
 * risk a double-charge — it logs, like the other modules.
 */
async function issueDirectSaleReceipt(
  purchase: Purchase,
  incomeCode: string,
  opts?: { email?: string; name?: string },
): Promise<void> {
  try {
    const item = PETWASH_INCOME_ITEMS[incomeCode];
    if (!item) return;
    const total = (purchase.amountCents ?? 0) / 100;
    if (total <= 0) return;
    // Prefer an explicit buyer contact (eGift buyers can be guests with no
    // user row); otherwise resolve from the buyer's account.
    let email = opts?.email;
    let name = opts?.name;
    if (!email && purchase.buyerUserId) {
      const [buyer] = await db
        .select({ email: users.email, first: users.firstName, last: users.lastName })
        .from(users).where(eq(users.id, purchase.buyerUserId)).limit(1);
      email = buyer?.email;
      name = [buyer?.first, buyer?.last].filter(Boolean).join(' ');
    }
    await IsraeliDigitalReceiptService.generateReceipt({
      platform: item.module,                 // wash_package | self_service_wash | gift | wallet
      // CPA per-class SUMIT doc: gift/wallet are STORED VALUE (Receipt, no VAT at
      // purchase — tax at redemption); wash = principal InvoiceAndReceipt.
      paymentClass: item.module === 'gift' ? 'EGIFT_PURCHASE'
        : item.module === 'wallet' ? 'WALLET_TOPUP'
        : 'K9000_WASH',
      bookingId: `sumit:${purchase.id}`,
      customerEmail: email || '',
      customerName: name || '',
      serviceDescription: item.en,
      serviceDescriptionHe: item.he,
      subtotalAmount: total,
      platformFeeAmount: 0,                   // direct PetWash sale — no marketplace commission
      totalAmount: total,
      paymentMethod: 'Credit Card (SUMIT)',
    });
  } catch (err) {
    logger.warn('[PurchaseActivation] Direct-sale receipt failed (non-blocking)', { purchaseId: purchase.id, incomeCode, error: (err as any)?.message });
  }
}

export type ActivationOutcome =
  | 'activated'
  | 'already_processed'
  | 'not_found'
  | 'unverified'
  | 'pending'
  | 'failed';

export interface ActivateFromVerifiedPaymentInput {
  /** Stable SUMIT payment/transaction id used as the idempotency anchor. */
  providerReference: string;
  /** SUMIT transaction id used to re-verify the charge server-side. */
  transactionId?: string;
  /** Our ExternalIdentifier (purchases.surfaceRefId) echoed back by SUMIT. */
  externalRef?: string;
  /** Optional surface to disambiguate the (surface, surfaceRefId) lookup. */
  surface?: string;
}

export interface ActivationResult {
  outcome: ActivationOutcome;
  purchaseId?: string;
  reason?: string;
}

/** Postgres unique-violation SQLSTATE — drizzle surfaces it on err.code. */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === '23505';
}

/** Re-read a purchase by id (authoritative status, post any concurrent write). */
async function reloadPurchase(id: string): Promise<Purchase | undefined> {
  try {
    const rows = await db.select().from(purchases).where(eq(purchases.id, id)).limit(1);
    return rows[0];
  } catch (err) {
    logger.error('[PurchaseActivation] reload failed', { id, err: (err as Error)?.message });
    return undefined;
  }
}

/**
 * ✅ SHIPPED (migration 0101, 2026-07-24 — after a live prod dup-check showed
 * zero duplicates): credit_txn_source_uq partial UNIQUE index on
 * credit_transactions (wallet_id, source_type, source_id) WHERE source_id IS
 * NOT NULL — the DB-level backstop behind addCredits' in-tx dedupe. The
 * purchase-level atomic status flip in activateFromVerifiedPayment (step e)
 * remains the first guard; the index makes a concurrent double-credit
 * impossible even if a future code path bypasses it.
 */

/**
 * Activate a PetWash purchase from a verified SUMIT payment. Idempotent:
 * a duplicate webhook is a no-op. Never throws to the caller — the webhook
 * route must always be able to return 200.
 */
export async function activateFromVerifiedPayment(
  input: ActivateFromVerifiedPaymentInput,
): Promise<ActivationResult> {
  const { providerReference, transactionId, externalRef, surface } = input;

  if (!providerReference || !providerReference.trim()) {
    return { outcome: 'failed', reason: 'missing_provider_reference' };
  }

  // ── (b first, lightly) Find the purchase so the lock row can carry its id.
  //    We look it up before taking the lock so the purchase_events row points
  //    at the right purchase; if not found we still take no destructive action.
  let purchase: Purchase | undefined;
  try {
    if (externalRef) {
      const rows = surface
        ? await db
            .select()
            .from(purchases)
            .where(and(eq(purchases.surface, surface), eq(purchases.surfaceRefId, externalRef)))
            .limit(1)
        : await db.select().from(purchases).where(eq(purchases.surfaceRefId, externalRef)).limit(1);
      purchase = rows[0];
    }
    if (!purchase && transactionId) {
      const rows = await db
        .select()
        .from(purchases)
        .where(eq(purchases.transactionId, transactionId))
        .limit(1);
      purchase = rows[0];
    }
  } catch (err) {
    logger.error('[PurchaseActivation] purchase lookup failed', {
      providerReference,
      err: (err as Error)?.message,
    });
    await alertTransientActivationError('lookup_error', { providerReference, transactionId, externalRef });
    return { outcome: 'failed', reason: 'lookup_error' };
  }

  // ── (a) FAST-PATH IDEMPOTENCY LOCK. Insert the provider-ref event FIRST. A
  //    duplicate delivery of the SAME provider reference collides on
  //    purchase_events_provider_ref_uq → unique violation. This serialises
  //    concurrent deliveries of one reference and short-circuits replays.
  //
  //    But the lock is NOT the sole authority: the PURCHASE is. A second SUMIT
  //    delivery can arrive with a DIFFERENT reference (txn id vs event id), and
  //    a hard crash can commit the lock row before the credit is granted. So
  //    on a duplicate-lock collision we do NOT blindly return already_processed
  //    — we re-check the purchase and only treat it as done if it actually
  //    reached 'activated'. Otherwise we fall through and re-attempt; the
  //    purchase-level conditional flip (step d) + addCredits' own
  //    (sourceType,sourceId) dedupe guarantee we still cannot double-credit.
  let lockCollision = false;
  try {
    await db.insert(purchaseEvents).values({
      purchaseId: purchase?.id ?? 'unmatched',
      surface: purchase?.surface ?? surface ?? 'unknown',
      oldStatus: purchase?.status ?? null,
      newStatus: purchase?.status ?? 'payment_pending',
      actorType: 'system',
      actorId: 'sumit_webhook',
      providerName: 'sumit',
      providerReference,
      metadataJson: { kind: 'idempotency_lock', transactionId: transactionId ?? null, externalRef: externalRef ?? null },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      lockCollision = true;
    } else {
      logger.error('[PurchaseActivation] idempotency-lock insert failed', {
        providerReference,
        err: (err as Error)?.message,
      });
      await alertTransientActivationError('lock_insert_error', { providerReference, transactionId, externalRef, purchaseId: purchase?.id });
      return { outcome: 'failed', reason: 'lock_insert_error' };
    }
  }

  // ── (b) Not found → no activation, caller still 200s + alerts.
  if (!purchase) {
    if (lockCollision) {
      logger.info('[PurchaseActivation] duplicate webhook for unmatched payment', { providerReference });
      return { outcome: 'already_processed', reason: 'duplicate_provider_reference' };
    }
    logger.warn('[PurchaseActivation] no matching purchase for verified payment', {
      providerReference,
      transactionId,
      externalRef,
    });
    return { outcome: 'not_found', reason: 'purchase_not_found' };
  }

  // ── (c) Already activated → no-op. (Authoritative status check, not the
  //    stale snapshot above — re-read so a concurrent delivery that just
  //    finished activating is seen as done.)
  if (lockCollision) {
    const fresh = await reloadPurchase(purchase.id);
    if (fresh?.status === 'activated') {
      logger.info('[PurchaseActivation] duplicate webhook — already activated', { providerReference, purchaseId: purchase.id });
      return { outcome: 'already_processed', purchaseId: purchase.id, reason: 'already_activated' };
    }
    // Lock row exists but the purchase never reached 'activated' (e.g. crash
    // between lock commit and credit grant, or a second reference). Fall
    // through and re-attempt; addCredits dedupe makes this safe.
    if (fresh) purchase = fresh;
    logger.warn('[PurchaseActivation] lock collision but purchase not activated — re-attempting', {
      providerReference, purchaseId: purchase.id, status: purchase.status,
    });
  }
  if (purchase.status === 'activated') {
    return { outcome: 'already_processed', purchaseId: purchase.id, reason: 'already_activated' };
  }

  // ── (d) RE-VERIFY with SUMIT. Never activate on an unverified payment.
  //    When SUMIT is wired and we have a tx id, the gettransaction call is
  //    authoritative. When not wired (tests / pre-launch) we proceed — the
  //    webhook signature already cleared upstream.
  if (sumitClient.isWired() && transactionId) {
    let verify: { wired: boolean; valid: boolean; amountCents?: number; reason?: string };
    try {
      verify = await sumitClient.getTransaction(transactionId);
    } catch (err) {
      logger.error('[PurchaseActivation] getTransaction threw', { transactionId, err: (err as Error)?.message });
      verify = { wired: true, valid: false, reason: 'verify_threw' };
    }
    if (!verify.valid) {
      await markFailed(purchase, 'sumit_unverified', verify.reason);
      return { outcome: 'unverified', purchaseId: purchase.id, reason: verify.reason ?? 'unverified' };
    }
    // Defence-in-depth against price tampering: the amount SUMIT actually
    // charged must match the amount we persisted at /begin. A mismatch means
    // the order was tampered between begin and charge — never activate; mark
    // failed + alert (recoverable, never faked). Only enforced when SUMIT
    // reports an amount (field name unverified — absence is not a failure).
    if (
      typeof verify.amountCents === 'number' &&
      typeof purchase.amountCents === 'number' &&
      verify.amountCents !== purchase.amountCents
    ) {
      await markFailed(purchase, 'amount_mismatch', `charged=${verify.amountCents} expected=${purchase.amountCents}`);
      return { outcome: 'failed', purchaseId: purchase.id, reason: 'amount_mismatch' };
    }
  }

  // ── (e) PURCHASE-LEVEL LOCK. Atomically flip status → 'paid' ONLY if the
  //    purchase has not already been claimed (paid/activated). The rowcount is
  //    the lock: if zero rows changed, another delivery already advanced this
  //    purchase past payment_pending, so this is a replay — return
  //    already_processed BEFORE any addCredits. This is the true double-credit
  //    guard and does NOT rely on the stale top-of-function snapshot; it closes
  //    the two-references-one-payment and concurrency windows without a schema
  //    migration (the credit_transactions(walletId,sourceType,sourceId) unique
  //    index is flagged for CEO/migration below, not applied here).
  let claimed: { id: string }[];
  try {
    claimed = (await db
      .update(purchases)
      .set({
        status: 'paid',
        transactionId: transactionId ?? purchase.transactionId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(purchases.id, purchase.id), inArray(purchases.status, ['payment_pending', 'quoted', 'failed'])))
      .returning({ id: purchases.id })) as { id: string }[];
  } catch (err) {
    logger.error('[PurchaseActivation] failed to mark paid', { purchaseId: purchase.id, err: (err as Error)?.message });
    await alertTransientActivationError('paid_update_error', { providerReference, transactionId, externalRef, purchaseId: purchase.id });
    return { outcome: 'failed', purchaseId: purchase.id, reason: 'paid_update_error' };
  }

  if (!claimed || claimed.length === 0) {
    // Another delivery already claimed (→ paid/activated) this purchase. Re-read
    // to report the right outcome; never re-credit.
    const fresh = await reloadPurchase(purchase.id);
    logger.info('[PurchaseActivation] purchase already claimed by another delivery', {
      providerReference, purchaseId: purchase.id, status: fresh?.status,
    });
    return {
      outcome: 'already_processed',
      purchaseId: purchase.id,
      reason: fresh?.status === 'activated' ? 'already_activated' : 'already_paid',
    };
  }
  // Reflect the committed status in our working copy.
  purchase = { ...purchase, status: 'paid' as Purchase['status'], transactionId: transactionId ?? purchase.transactionId ?? null };

  await audit('sumit.payment_paid', purchase, {
    providerReference,
    transactionId: transactionId ?? null,
    amountCents: purchase.amountCents,
  });

  // ── Coupon redemption record. The coupon facts in metadataJson were written
  //    SERVER-SIDE by /begin (validated + priced by CouponService; client
  //    metadata cannot override them — server keys spread last). The paid-claim
  //    lock above guarantees this block runs once per purchase, and redeemAtomic
  //    is itself idempotent on the key. FAIL-SOFT: the customer already paid the
  //    discounted amount — a bookkeeping failure must never block activation.
  {
    const couponMeta = (purchase.metadataJson as any)?.coupon;
    if (couponMeta && Number.isFinite(Number(couponMeta.couponId))) {
      try {
        const { couponService } = await import('./CouponService');
        await couponService.redeemAtomic({
          couponId: Number(couponMeta.couponId),
          userId: purchase.buyerUserId,
          orderType: couponMeta.orderType || 'kiosk_wash',
          orderId: purchase.surfaceRefId ?? purchase.id,
          issuanceId: couponMeta.issuanceId != null ? Number(couponMeta.issuanceId) : undefined,
          amountBeforeCents: Number(couponMeta.amountBeforeCents) || purchase.amountCents,
          discountAmountCents: Number(couponMeta.discountCents) || 0,
          idempotencyKey: `sumit-coupon-${purchase.id}`,
        });
      } catch (err) {
        logger.error('[PurchaseActivation] coupon redemption record failed (activation continues)', {
          purchaseId: purchase.id, couponId: couponMeta.couponId, err: (err as Error)?.message,
        });
      }
    }
  }

  // ── (f) Activate the product. On success → 'activated'. If no safe handler
  //    yet → leave at 'paid', mark activation pending, alert. NEVER fake.
  let activated: boolean;
  try {
    activated = await activateProduct(purchase);
  } catch (err) {
    logger.error('[PurchaseActivation] activateProduct threw', { purchaseId: purchase.id, err: (err as Error)?.message });
    await markActivationPending(purchase, 'activation_threw');
    return { outcome: 'pending', purchaseId: purchase.id, reason: 'activation_threw' };
  }

  if (!activated) {
    await markActivationPending(purchase, 'no_safe_handler');
    return { outcome: 'pending', purchaseId: purchase.id, reason: 'activation_pending' };
  }

  try {
    await db
      .update(purchases)
      .set({ status: 'activated', updatedAt: new Date() })
      .where(eq(purchases.id, purchase.id));
  } catch (err) {
    logger.error('[PurchaseActivation] failed to mark activated', { purchaseId: purchase.id, err: (err as Error)?.message });
    // Money/credit already granted idempotently; leave recoverable.
    await markActivationPending(purchase, 'activated_update_error');
    return { outcome: 'pending', purchaseId: purchase.id, reason: 'activated_update_error' };
  }

  await audit('sumit.activated', purchase, { providerReference, productType: purchase.productType });
  return { outcome: 'activated', purchaseId: purchase.id };
}

/**
 * SINGLE switch on productType. Returns true when the product was activated
 * here, false when no safe handler exists yet (caller marks pending + alerts).
 * Each branch is idempotent (wallet credits dedupe on sourceId=purchase.id).
 *
 * PROVIDER COMMERCE IS DISABLED — provider bookings/memberships/SaaS never
 * auto-activate in Phase 1.
 */
export async function activateProduct(purchase: Purchase): Promise<boolean> {
  const meta = (purchase.metadataJson ?? {}) as Record<string, unknown>;

  // PROVIDER-COMMERCE GUARD. Only PetWash-OWNED product types may auto-activate
  // in Phase 1. Anything else (provider bookings, memberships, SaaS, shop
  // fulfilment, unknown) is left pending + alerted — NEVER auto-credited. This
  // is the activation-side enforcement of "provider commerce disabled"; the
  // /begin allowlist is the first gate, this is defence-in-depth so a row that
  // somehow carries a non-owned productType can never silently credit a wallet.
  const OWNED: ReadonlySet<string> = new Set(['ACCOUNT_CREDIT', 'WASH_PACKAGE', 'SINGLE_WASH', 'EGIFT', 'SHOP_ORDER']);
  if (!OWNED.has(String(purchase.productType))) {
    return false;
  }

  // account-credit: require BOTH the owned ACCOUNT_CREDIT product AND the
  // wallet_topup surface before any value reaches the wallet. The previous OR
  // shortcut (productType==='ACCOUNT_CREDIT' || surface==='wallet_topup') let a
  // tampered row pick either label to launder an arbitrary amount into spendable
  // credit; require both so neither alone is sufficient.
  if (purchase.productType === 'ACCOUNT_CREDIT' && purchase.surface === 'wallet_topup') {
    await walletService.addCredits(
      purchase.buyerUserId,
      'promo_credit',
      purchase.amountCents,
      'sumit_purchase',
      purchase.id,
      'Account credit via SUMIT',
    );
    // Real money loaded → issue the חשבונית מס/קבלה (fiscal audit 2026-07-05:
    // wallet top-ups previously granted credit with NO receipt).
    await issueDirectSaleReceipt(purchase, 'PW_WALLET_TOPUP');
    // LEDGER v2 dual-write SHADOW (2026-08-08): mirror this top-up into the unified
    // ledger for parity proving. Gated by LEDGER_V2_DUAL_WRITE (default OFF) and fully
    // self-wrapped — observe-only, can never affect the credit already granted above.
    await shadowMirrorWalletTopup({
      userId: purchase.buyerUserId,
      amountCents: purchase.amountCents,
      purchaseId: purchase.id,
      paymentRef: purchase.transactionId ?? null,
      provider: 'sumit',
    });
    return true;
  }

  switch (purchase.productType) {
    case 'WASH_PACKAGE': {
      const rawCount = (meta.washCount ?? meta.washPackageCount ?? meta.units) as unknown;
      const washCount = Number.isFinite(Number(rawCount)) && Number(rawCount) > 0 ? Math.floor(Number(rawCount)) : 1;
      await walletService.addCredits(
        purchase.buyerUserId,
        'wash_package',
        washCount,
        'sumit_purchase',
        purchase.id,
        'Wash package via SUMIT',
      );
      // Close the audit gap: issue the customer receipt for the package sale.
      await issueDirectSaleReceipt(purchase, washCount === 5 ? 'PW_WASH_PACKAGE_5' : washCount === 10 ? 'PW_WASH_PACKAGE_10' : 'PW_WASH_PACKAGE_CUSTOM');
      return true;
    }

    case 'SINGLE_WASH': {
      // The K9000 redemption flow mints the actual QR when the credit is
      // consumed — do NOT mint a QR here, just grant the single wash credit.
      await walletService.addCredits(
        purchase.buyerUserId,
        'wash_package',
        1,
        'sumit_purchase',
        purchase.id,
        'Single wash via SUMIT',
      );
      await issueDirectSaleReceipt(purchase, 'PW_SELF_SERVICE_DOG_WASH_SINGLE');
      return true;
    }

    case 'SHOP_ORDER': {
      // CAPTURE-THEN-CREATE for shop card orders (audit #10): the money was
      // just captured (status flipped to 'paid' under the activation lock);
      // only NOW does the shop_orders row come into existence. Stock is
      // re-checked + decremented atomically inside createOrder. Any failure
      // returns false → 'activation_pending' + alert: the charge is flagged
      // for admin action, never silently lost, and no mismatched order is
      // ever created.
      const cartId = String((meta as any).cartId ?? '');
      if (!cartId || !purchase.buyerUserId) {
        logger.error('[PurchaseActivation] SHOP_ORDER missing cartId or buyer', { purchaseId: purchase.id });
        return false;
      }
      const { ShopService } = await import('./ShopService');
      const shopService = new ShopService();

      const cart = await shopService.validateCartForCheckout(purchase.buyerUserId, cartId);
      if (!cart) {
        logger.error('[PurchaseActivation] SHOP_ORDER cart missing or already checked out', {
          purchaseId: purchase.id, cartId,
        });
        return false;
      }
      // Cart-drift guard (fail closed): the cart stays mutable while the
      // customer is on the SUMIT payment page. If its subtotal no longer
      // matches what was priced and charged, do NOT build a mismatched order.
      if (Number(cart.subtotalCents) !== Number((meta as any).subtotalCents)) {
        logger.error('[PurchaseActivation] SHOP_ORDER cart drifted after payment — leaving paid+pending', {
          purchaseId: purchase.id, cartId,
          pricedSubtotalCents: (meta as any).subtotalCents, currentSubtotalCents: cart.subtotalCents,
        });
        return false;
      }

      let order: any;
      try {
        order = await shopService.createOrder(purchase.buyerUserId, cart, {
          paymentRef: purchase.transactionId || `sumit:${purchase.id}`,
          paymentMethod: 'credit_card',
          discountAmountCents: 0,
          deliveryCents: Number((meta as any).deliveryCents ?? 0),
          giftWrap: !!(meta as any).giftWrap,
          deliveryMethod: (meta as any).deliveryMethod,
          deliveryAddressId: (meta as any).deliveryAddressId ?? null,
          notes: (meta as any).notes ?? null,
          language: (meta as any).language ?? 'he',
          netCents: Number((meta as any).netCents ?? 0),
          vatCents: Number((meta as any).vatCents ?? 0),
          totalCents: Number((meta as any).totalCents ?? purchase.amountCents),
        });
      } catch (err: any) {
        // OUT_OF_STOCK race or any create failure: money captured, no order —
        // exactly the case markActivationPending + its alert exist for.
        logger.error('[PurchaseActivation] SHOP_ORDER createOrder failed after capture', {
          purchaseId: purchase.id, cartId, err: err?.message,
        });
        return false;
      }

      // Fiscal receipt AT CAPTURE (same rule as the wallet path, PR #1282).
      // generateTaxInvoice handles its own errors; the dedup guard makes it
      // exactly-once per order.
      await shopService.generateTaxInvoice(order.id);

      // Luxury confirmation email — non-fatal.
      try {
        const profile = await shopService.getUserProfile(purchase.buyerUserId);
        const { shopOrderConfirmation } = await import('../email/templates/shop-order-confirmation-2026');
        const { sendLuxuryEmail } = await import('../email/luxury-email-service');
        const lang = String((meta as any).language ?? 'he');
        const html = shopOrderConfirmation({
          orderId: order.orderNumber,
          customerName: profile.displayName || profile.email,
          customerEmail: profile.email,
          items: order.items,
          subtotalCents: Number((meta as any).subtotalCents ?? 0),
          discountCents: 0,
          deliveryCents: Number((meta as any).deliveryCents ?? 0),
          giftWrapCents: Number((meta as any).giftWrapCents ?? 0),
          netCents: Number((meta as any).netCents ?? 0),
          vatCents: Number((meta as any).vatCents ?? 0),
          totalCents: Number((meta as any).totalCents ?? purchase.amountCents),
          paymentMethod: 'credit_card',
          paymentRef: purchase.transactionId || `sumit:${purchase.id}`,
          deliveryMethod: (meta as any).deliveryMethod,
          estimatedDelivery: (meta as any).estimatedDelivery ?? null,
          deliveryAddress: order.deliveryAddress,
          language: lang,
          orderDate: new Date().toISOString(),
        });
        await sendLuxuryEmail({
          to: profile.email,
          subject: lang === 'he'
            ? `אישור הזמנה #${order.orderNumber} — PetWash™ Shop`
            : `Order Confirmation #${order.orderNumber} — PetWash™ Shop`,
          html,
        });
      } catch (emailErr: any) {
        logger.warn('[PurchaseActivation] SHOP_ORDER confirmation email failed (non-fatal)', {
          purchaseId: purchase.id, err: emailErr?.message,
        });
      }

      logger.info('[PurchaseActivation] ✅ SHOP_ORDER activated — order created after capture', {
        purchaseId: purchase.id, orderId: order.id, orderNumber: order.orderNumber,
      });
      return true;
    }

    case 'EGIFT_CARD':
      // Legacy/Nayax-era productType. The live rail is 'EGIFT' (below) via SUMIT.
      return false;

    case 'EGIFT': {
      // Recipient-bound eGift, paid via SUMIT/UPay (rail moved OFF Nayax). Reached
      // exactly once per the activation idempotency lock (same single-delivery
      // guarantee that protects addCredits). We create + deliver the recipient's
      // voucher — NEVER credit the buyer's wallet.
      const value = Math.round(purchase.amountCents) / 100;
      const recipientEmail = String(meta.recipientEmail ?? (meta as any).recipient_email ?? '').trim();
      if (!recipientEmail) return false; // no recipient → leave pending + alert (don't lose value)
      const recipientName  = String(meta.recipientName ?? (meta as any).recipient_name ?? 'Friend').trim() || 'Friend';
      const senderName     = String(meta.senderName ?? (meta as any).sender_name ?? 'A friend').trim() || 'A friend';
      const purchaserEmail = String(meta.senderEmail ?? meta.purchaserEmail ?? recipientEmail).trim();
      const message        = meta.message ? String(meta.message) : undefined;
      const eligibleServices = Array.isArray(meta.eligibleServices) && (meta.eligibleServices as unknown[]).length
        ? (meta.eligibleServices as any)
        : ['all']; // eGift is redeemable at K9000 + all platforms (CEO)
      const gift = await new GiftOrchestrationService().createMultiServiceGiftCard({
        value,
        currency: (purchase as any).currency ?? 'ILS',
        purchaserEmail,
        recipientEmail,
        recipientName,
        senderName,
        message,
        eligibleServices,
      });
      // Deliver the eGift email to recipient + buyer. The live SUMIT/UPay rail
      // previously created the voucher but sent NOTHING (only the legacy
      // /api/multi-service-gift route emailed) — a paid gift the recipient never
      // heard about. Best-effort: never fail the (idempotent) activation on a
      // mail error; the voucher already exists and admin alerting covers misses.
      try {
        const { sendEGiftConfirmationEmail } = await import('./egiftEmailService');
        await sendEGiftConfirmationEmail({
          senderName,
          senderEmail: purchaserEmail,
          recipientName,
          recipientEmail,
          value,
          currency: (purchase as any).currency ?? 'ILS',
          publicCode: gift.publicCode,
          giftCardId: gift.giftCardId,
          occasion: String((meta as any).occasion ?? 'gift'),
          messageLanguage: String((meta as any).language ?? (meta as any).messageLanguage ?? 'he'),
          personalMessage: message,
          eligibleServices,
          expiresInMonths: 60, // Israeli Amendment 33: gift vouchers ≥5 years
        });
      } catch (mailErr: any) {
        logger.warn('[Activation] eGift email send failed (non-fatal; voucher already created)', { err: mailErr?.message, giftCardId: gift.giftCardId });
      }
      // The eGift is a money-value instrument — the BUYER (who paid) gets the
      // חשבונית מס/קבלה now (VAT at 18% on the gift value at point of sale).
      // Redemption is NOT re-receipted (would double-VAT). Fiscal audit
      // 2026-07-05: eGift purchases previously issued no receipt at all.
      await issueDirectSaleReceipt(purchase, 'PW_GIFT_CARD', { email: purchaserEmail, name: senderName });
      return true;
    }

    case 'MEMBERSHIP':
    case 'SAAS_SUBSCRIPTION':
    case 'PET_SITTING_BOOKING':
    case 'DOG_WALKING_BOOKING':
    case 'GROOMING_BOOKING':
      // Provider commerce is DISABLED in Phase 1 — never auto-activate.
      return false;

    default:
      // SHOP_PRODUCT / physical fulfilment (ShopService) + anything unknown.
      return false;
  }
}

async function markActivationPending(purchase: Purchase, reason: string): Promise<void> {
  try {
    const meta = { ...((purchase.metadataJson ?? {}) as Record<string, unknown>), activation: 'pending', activationPendingReason: reason };
    await db
      .update(purchases)
      .set({ metadataJson: meta, updatedAt: new Date() })
      .where(eq(purchases.id, purchase.id));
  } catch (err) {
    logger.error('[PurchaseActivation] failed to mark activation pending', { purchaseId: purchase.id, err: (err as Error)?.message });
  }
  await audit('sumit.activation_pending', purchase, { reason, productType: purchase.productType });
  try {
    await sendAlert({
      type: 'data_integrity',
      severity: 'warning',
      message: `PetWash purchase ${purchase.id} paid but activation deferred (${purchase.productType})`,
      details: `reason=${reason} surface=${purchase.surface} amountCents=${purchase.amountCents}`,
    });
  } catch {
    /* alert failure must never block — audit row already written */
  }
}

async function markFailed(purchase: Purchase, reason: string, detail?: string): Promise<void> {
  try {
    await db
      .update(purchases)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(purchases.id, purchase.id));
  } catch (err) {
    logger.error('[PurchaseActivation] failed to mark failed', { purchaseId: purchase.id, err: (err as Error)?.message });
  }
  await audit('sumit.payment_unverified', purchase, { reason, detail: detail ?? null });
  try {
    await sendAlert({
      type: 'data_integrity',
      severity: 'critical',
      message: `PetWash purchase ${purchase.id} marked failed — payment did not verify`,
      details: `reason=${reason} detail=${detail ?? ''}`,
    });
  } catch {
    /* never block */
  }
}

/**
 * Transient INFRASTRUCTURE failure during activation (DB lookup/insert/update threw).
 * The SUMIT payment itself is fine — the purchase stays `payment_pending` so a
 * reconciliation sweep can re-drive it — but the webhook always 200s (so SUMIT
 * never retries) and there is no browser `/return` for the unattended case, so
 * without this alert the paid customer would be stranded SILENTLY. Fire a critical
 * alert so ops can re-drive it. Never throws (webhook must still 200).
 * SECURITY/RELIABILITY 2026-08-08 (fail-soft audit).
 */
async function alertTransientActivationError(
  reason: string,
  ctx: { providerReference?: string; transactionId?: string | null; externalRef?: string | null; purchaseId?: string },
): Promise<void> {
  try {
    await sendAlert({
      type: 'data_integrity',
      severity: 'critical',
      message: `PetWash SUMIT activation hit a transient error (${reason}) — verified payment may be stranded payment_pending`,
      details: `reason=${reason} purchaseId=${ctx.purchaseId ?? 'unknown'} providerRef=${ctx.providerReference ?? ''} txn=${ctx.transactionId ?? ''} externalRef=${ctx.externalRef ?? ''}`,
    });
  } catch {
    /* alert failure must never block the webhook 200 */
  }
}

async function audit(
  eventType: string,
  purchase: Purchase,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await recordAuditEvent({
      eventType,
      customerUid: purchase.buyerUserId || 'system',
      metadata: { purchaseId: purchase.id, surface: purchase.surface, ...metadata },
      ipAddress: null,
      userAgent: '[PurchaseActivation]',
    });
  } catch (err) {
    logger.error('[PurchaseActivation] audit write failed (continuing)', {
      eventType,
      purchaseId: purchase.id,
      err: (err as Error)?.message,
    });
  }
}
