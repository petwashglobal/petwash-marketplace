/**
 * sumitCheckout.ts — the client connector for SUMIT hosted-page card payments.
 *
 * The server route POST /api/payments/sumit/begin (server/routes/payments-sumit.ts)
 * creates a SUMIT hosted payment and returns the payment-page URL.
 *
 * Flow:
 *   startSkuCheckout({ sku, couponCode?, metadata? })
 *     → POST /api/payments/sumit/begin   (Bearer auth via apiRequest; CSRF-exempt;
 *                                         price resolved SERVER-SIDE from the SKU)
 *     → { redirectUrl }                  (SUMIT hosted page; UPay clears underneath)
 *     → window.location.assign(redirectUrl)
 *   SUMIT then returns the customer to /api/payments/sumit/return, which
 *   re-verifies server-side before treating the payment as real.
 *
 * No card data ever touches our code — SUMIT hosts the form.
 *
 * NOTE: SUMIT has no separate sandbox server; "sandbox" is a caller-side flag
 * and the call hits the real SUMIT with the live company credentials. The
 * begin-request field shape is best-known but UNVERIFIED against SUMIT's
 * authenticated spec — the FIRST live call confirms it (200 + redirectUrl) or
 * surfaces the exact field SUMIT rejects.
 */
import { apiRequest } from '@/lib/queryClient';

/** The server-owned Phase-1 catalog SKUs `/begin` accepts (besides ACCOUNT_CREDIT). */
export type SumitSku =
  | 'SINGLE_WASH'
  | 'WASH_PACKAGE_3'
  | 'WASH_PACKAGE_5'
  | 'WASH_PACKAGE_10'
  | 'EGIFT_100'
  | 'EGIFT_250'
  | 'EGIFT_500'
  | 'EGIFT_1000';

export interface SumitCheckoutResult {
  ok: boolean;
  /** When ok:false, a human-readable reason (already localized at call sites if needed). */
  error?: string;
  /** Machine-readable error code from the server (e.g. COUPON_INVALID). */
  errorCode?: string;
}

/**
 * Begin a SUMIT hosted-page payment for a SERVER-OWNED catalog SKU — the
 * canonical checkout entry. `/begin` resolves the price from the catalog (the
 * client cannot supply an amount), applies any member discount + server-validated
 * coupon, and returns the hosted-page URL. `metadata` rides on the purchase row
 * (e.g. eGift recipient/sender details) and is fulfilled on the verified SUMIT
 * webhook by PurchaseActivationService — never client-trusted for money facts.
 */
export async function startSkuCheckout(input: {
  sku: SumitSku;
  orderId?: string;
  couponCode?: string;
  metadata?: Record<string, unknown>;
}): Promise<SumitCheckoutResult> {
  try {
    const res = await apiRequest('POST', '/api/payments/sumit/begin', {
      sku: input.sku,
      orderId: input.orderId,
      ...(input.couponCode ? { couponCode: input.couponCode } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!data?.redirectUrl) {
      return {
        ok: false,
        error: data?.reason || data?.error || 'Payments are not available right now',
        errorCode: data?.errorCode,
      };
    }
    // Hand off to SUMIT's hosted payment page.
    window.location.assign(data.redirectUrl as string);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not start payment' };
  }
}

/**
 * Begin a SUMIT hosted-page payment for a WALLET TOP-UP (the server-owned
 * ACCOUNT_CREDIT product). The server resolves the credit 1:1 with the charged
 * amount, and the wallet is credited ONLY by the verified SUMIT webhook flow
 * (server/services/PurchaseActivationService — ACCOUNT_CREDIT + wallet_topup
 * surface). The customer therefore pays FIRST; no balance moves until the
 * payment is verified server-side.
 *
 * `/sumit/begin` requires `{ sku, topupIls }` (it deliberately rejects a raw
 * client amount), so this is a distinct call from startSkuCheckout.
 *
 * Returns { ok:false, error } so the caller can toast; on success the browser
 * navigates away to the SUMIT hosted page.
 */
export async function startWalletTopUpCheckout(input: { amountIls: number }): Promise<SumitCheckoutResult> {
  if (!(input.amountIls > 0)) {
    return { ok: false, error: 'Invalid amount' };
  }
  try {
    const res = await apiRequest('POST', '/api/payments/sumit/begin', {
      sku: 'ACCOUNT_CREDIT',
      topupIls: input.amountIls,
    });
    const data = await res.json().catch(() => ({} as any));
    if (!data?.redirectUrl) {
      return { ok: false, error: data?.error || data?.reason || 'Payments are not available right now' };
    }
    // Hand off to SUMIT's hosted payment page; the wallet credits on verified return/webhook.
    window.location.assign(data.redirectUrl as string);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not start payment' };
  }
}
