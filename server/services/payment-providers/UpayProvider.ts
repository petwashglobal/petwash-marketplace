/**
 * UpayProvider — UPay (יופיי פיננסים בע״מ, upay.co.il) online card clearing.
 *
 * UPay is PetWash's online payment rail. Its integration is a REDIRECT/hosted-page
 * model: the merchant builds an encrypted `msg` payload and sends the customer to
 *   https://app.upay.co.il/API6/clientsecure/redirectpage.php?msg=<encrypted>
 * UPay renders the payment page, charges the card, issues the legal
 * חשבונית מס/קבלה (when "issue invoice" is enabled on the page), and POSTs an
 * IPN (Instant Payment Notification) back to confirm the transaction.
 *
 * STATE (2026-06-15): the API key is provisioned and wired into the runtime
 * (UPAY_API_KEY, from GCP Secret Manager → Cloud Run). What is NOT yet available
 * is UPay's API6 integration spec — the exact `msg` parameter names and the
 * encryption scheme used to sign the payload with the key. Until that spec is in
 * hand, charge creation FAILS CLOSED (never a fake success — Rule H). Everything
 * else (config detection, endpoint, reachability, health) is live so activation
 * is a small, well-scoped fill-in, not a from-scratch build.
 */

import { logger } from '../../lib/logger';

export const UPAY_BASE_URL = 'https://app.upay.co.il';
/** Hosted redirect payment endpoint (observed from the live payment flow). */
export const UPAY_REDIRECT_PATH = '/API6/clientsecure/redirectpage.php';

export interface UpayHealth {
  configured: boolean;
  baseUrl: string;
  redirectEndpoint: string;
  /** true once the API6 msg-encryption spec is implemented (charges possible) */
  chargeReady: boolean;
  reason: string;
}

export interface UpayChargeResult {
  ok: false;
  provider: 'upay';
  reason: 'spec-pending' | 'not-configured';
  detail: string;
}

function apiKey(): string | undefined {
  return process.env.UPAY_API_KEY;
}

export class UpayProvider {
  public static readonly providerName = 'upay';

  /** Key present in the environment (does NOT prove the key is valid). */
  isConfigured(): boolean {
    return Boolean(apiKey());
  }

  /**
   * Charge readiness. Configured ≠ chargeable: we also need the API6 `msg`
   * spec implemented. Returns false until that lands so callers fail closed.
   */
  isChargeReady(): boolean {
    // Flip to true in the PR that implements buildEncryptedMsg() against the
    // verified API6 spec. Intentionally hard-false today.
    return false;
  }

  health(): UpayHealth {
    const configured = this.isConfigured();
    const chargeReady = this.isChargeReady();
    return {
      configured,
      baseUrl: UPAY_BASE_URL,
      redirectEndpoint: `${UPAY_BASE_URL}${UPAY_REDIRECT_PATH}`,
      chargeReady,
      reason: !configured
        ? 'UPAY_API_KEY not set in this environment'
        : chargeReady
          ? 'configured and charge-ready'
          : 'key configured; charge disabled pending UPay API6 msg/encryption spec',
    };
  }

  /**
   * Live reachability probe of the UPay endpoint. Confirms DNS + TLS + that the
   * host responds — it does NOT authenticate or create a transaction. Safe to
   * call from a health endpoint.
   */
  async checkReachability(timeoutMs = 8000): Promise<{ reachable: boolean; status?: number; error?: string }> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(UPAY_BASE_URL, { method: 'HEAD', signal: controller.signal });
      return { reachable: res.ok || res.status < 500, status: res.status };
    } catch (err: any) {
      return { reachable: false, error: err?.message || 'unreachable' };
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Create a hosted-page charge (redirect URL the client opens). FAILS CLOSED
   * until the API6 msg-encryption spec is implemented — never returns a fake
   * success. Once the spec lands, this builds the encrypted `msg` and returns
   * `${UPAY_BASE_URL}${UPAY_REDIRECT_PATH}?msg=<encrypted>`.
   */
  async createPaymentRedirect(_params: {
    amount: number;
    description: string;
    returnUrl: string;
    issueInvoice?: boolean;
  }): Promise<UpayChargeResult> {
    if (!this.isConfigured()) {
      logger.warn('[UpayProvider] charge requested but UPAY_API_KEY not set');
      return {
        ok: false,
        provider: 'upay',
        reason: 'not-configured',
        detail: 'UPAY_API_KEY is not set in this environment.',
      };
    }
    logger.warn('[UpayProvider] charge requested but API6 msg spec not yet implemented — failing closed');
    return {
      ok: false,
      provider: 'upay',
      reason: 'spec-pending',
      detail:
        'UPay key is configured, but charge is disabled until the API6 msg parameter + encryption spec is implemented. No fake success (Rule H).',
    };
  }
}

export const upayProvider = new UpayProvider();
