/**
 * sumitCheckout.ts — the client connector for SUMIT hosted-page card payments.
 *
 * The server route POST /api/payments/sumit/begin (server/routes/payments-sumit.ts)
 * creates a SUMIT hosted payment and returns the payment-page URL. UNTIL NOW
 * nothing in the client called it. This helper is that missing link.
 *
 * Flow:
 *   startSumitCheckout({ amountIls, description, orderId })
 *     → POST /api/payments/sumit/begin   (Bearer auth via apiRequest; CSRF-exempt)
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

export interface SumitCheckoutInput {
  /**
   * Server-owned product SKU (price is resolved server-side — the client never
   * sets a price): SINGLE_WASH | WASH_PACKAGE_3/5/10 | EGIFT_100/250/500/1000 |
   * EGIFT (+ giftIls) | ACCOUNT_CREDIT (+ topupIls).
   */
  sku: string;
  /** Variable eGift amount in ILS (only for sku 'EGIFT'; capped server-side at ₪1,500). */
  giftIls?: number;
  /** Variable wallet top-up amount in ILS (only for sku 'ACCOUNT_CREDIT'). */
  topupIls?: number;
  /** Our order/reference id; echoed back on return so the order can be fulfilled. */
  orderId?: string;
  /** REQUIRED for eGift — the gift is bound to this recipient at activation. */
  recipient?: { name: string; email: string; phone?: string; message?: string };
  /** Non-authoritative extras (occasion, language, etc.). Server keys win. */
  metadata?: Record<string, unknown>;
}

export interface SumitCheckoutResult {
  ok: boolean;
  /** When ok:false, a human-readable reason (already localized at call sites if needed). */
  error?: string;
  /** True when the failure was an auth requirement (caller should prompt sign-in). */
  needsAuth?: boolean;
}

/**
 * Begin a SUMIT hosted-page payment and redirect the browser to it.
 * Requires a signed-in buyer (Bearer via apiRequest) — every purchase has a
 * real owner, receipt and audit trail. Returns { ok:false, error } if the
 * session could not be created; on success the browser navigates away.
 */
export async function startSumitCheckout(input: SumitCheckoutInput): Promise<SumitCheckoutResult> {
  if (!input.sku) {
    return { ok: false, error: 'Invalid product' };
  }
  try {
    const res = await apiRequest('POST', '/api/payments/sumit/begin', {
      sku: input.sku,
      giftIls: input.giftIls,
      topupIls: input.topupIls,
      orderId: input.orderId,
      recipient: input.recipient,
      metadata: input.metadata,
    });
    const data = await res.json().catch(() => ({} as any));
    if (res.status === 401) {
      return { ok: false, needsAuth: true, error: data?.error || 'Please sign in to continue' };
    }
    if (!data?.redirectUrl) {
      return { ok: false, error: data?.error || data?.reason || 'Payments are not available right now' };
    }
    // Hand off to SUMIT's hosted payment page.
    window.location.assign(data.redirectUrl as string);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not start payment' };
  }
}
