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
  /** Amount to charge, in ILS (shekels, not agorot). */
  amountIls: number;
  /** Human-readable line description shown on the SUMIT page + the fiscal doc. */
  description: string;
  /** Our order/reference id; echoed back on return so the order can be fulfilled. */
  orderId?: string;
}

export interface SumitCheckoutResult {
  ok: boolean;
  /** When ok:false, a human-readable reason (already localized at call sites if needed). */
  error?: string;
}

/**
 * Begin a SUMIT hosted-page payment and redirect the browser to it.
 * Returns { ok:false, error } if the session could not be created (so the
 * caller can show a toast); on success the browser navigates away.
 */
export async function startSumitCheckout(input: SumitCheckoutInput): Promise<SumitCheckoutResult> {
  if (!(input.amountIls > 0)) {
    return { ok: false, error: 'Invalid amount' };
  }
  try {
    const res = await apiRequest('POST', '/api/payments/sumit/begin', {
      amountIls: input.amountIls,
      description: input.description,
      orderId: input.orderId,
    });
    const data = await res.json().catch(() => ({} as any));
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

/**
 * Begin a SUMIT hosted-page payment for a WALLET TOP-UP (the server-owned
 * ACCOUNT_CREDIT product). The server resolves the credit 1:1 with the charged
 * amount, and the wallet is credited ONLY by the verified SUMIT webhook flow
 * (server/services/PurchaseActivationService — ACCOUNT_CREDIT + wallet_topup
 * surface). The customer therefore pays FIRST; no balance moves until the
 * payment is verified server-side.
 *
 * `/sumit/begin` requires `{ sku, topupIls }` (it deliberately rejects a raw
 * client amount), so this is a distinct call from startSumitCheckout.
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
