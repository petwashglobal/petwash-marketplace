/**
 * PetWash™ Tranzila Payment Service
 *
 * Architecture: Tranzila handles ALL digital purchase flows.
 *   - e-gift purchase   (migrate first — discrete, low risk)
 *   - wallet top-up     (migrate second)
 *   - marketplace booking captures (migrate last — highest volume)
 *
 * K9000 public machine card sale stays on Nayax — DO NOT route here.
 * K9000 member redeem stays on internal ledger — DO NOT route here.
 * washPackageCredits must remain K9000-only (isKioskWash guard in WalletEngine).
 *
 * Migration sequence (feature-flagged, rollout-safe):
 *   Step 1: TRANZILA_EGIFT_ENABLED=true      → e-gift purchase
 *   Step 2: TRANZILA_WALLET_TOPUP_ENABLED=true → wallet top-up
 *   Step 3: TRANZILA_MARKETPLACE_ENABLED=true  → marketplace booking captures
 *
 * Each step must be independently deployable and reversible by flipping the flag.
 * Internal ledger write is ALWAYS executed regardless of which Tranzila flag is set.
 *
 * WEBHOOK contract:
 *   POST /api/payments/tranzila/webhook
 *   - Verifies HMAC signature using TRANZILA_WEBHOOK_SECRET
 *   - Updates internal ledger ONLY after successful signature check
 *   - Never trusts client-side confirmation as source of truth
 *
 * TODO (before enabling any flag in production):
 *   1. Obtain Tranzila merchant credentials and store in TRANZILA_TERMINAL_NAME /
 *      TRANZILA_TERMINAL_PASSWORD env vars.
 *   2. Implement real charge() call using Tranzila REST API (IL credit card processing).
 *   3. Implement verifyWebhookSignature() with the shared secret from Tranzila console.
 *   4. Add idempotency check on transactionId before applying any ledger write.
 *   5. Get CPA written confirmation on VAT document timing for each product type
 *      BEFORE wiring tax document generation in processEgiftPurchase / processWalletTopup.
 */

import { logger } from '../lib/logger';
import {
  TRANZILA_EGIFT_ENABLED,
  TRANZILA_WALLET_TOPUP_ENABLED,
  TRANZILA_MARKETPLACE_ENABLED,
} from '../lib/payment-flags';

// ── Tranzila credentials (read from env, never hardcoded) ────────────────────
const TERMINAL_NAME     = process.env.TRANZILA_TERMINAL_NAME;
const TERMINAL_PASSWORD = process.env.TRANZILA_TERMINAL_PASSWORD;
const WEBHOOK_SECRET    = process.env.TRANZILA_WEBHOOK_SECRET;

/** Shared result shape for all Tranzila charge operations. */
export interface TranzilaChargeResult {
  success: boolean;
  transactionId?: string;
  /** Tranzila confirmation code (tran_num) returned on success. */
  confirmationCode?: string;
  error?: string;
}

/** Shared result shape for webhook verification. */
export interface TranzilaWebhookResult {
  verified: boolean;
  transactionId?: string;
  amountAgorot?: number;
  status?: 'approved' | 'declined' | 'error';
  error?: string;
}

export class TranzilaService {
  /**
   * Process e-gift card purchase via Tranzila.
   * Gated by TRANZILA_EGIFT_ENABLED feature flag.
   * Internal ledger write must be called by the caller AFTER this returns success.
   */
  static async processEgiftPurchase(params: {
    amountAgorot: number;
    customerId: string;
    cardToken: string;
    idempotencyKey: string;
  }): Promise<TranzilaChargeResult> {
    if (!TRANZILA_EGIFT_ENABLED) {
      logger.warn('[Tranzila] e-gift purchase attempted but TRANZILA_EGIFT_ENABLED is false');
      return { success: false, error: 'Tranzila e-gift not enabled. Set TRANZILA_EGIFT_ENABLED=true.' };
    }
    return TranzilaService._charge({ ...params, productType: 'egift' });
  }

  /**
   * Process wallet top-up via Tranzila.
   * Gated by TRANZILA_WALLET_TOPUP_ENABLED feature flag.
   * Internal ledger write must be called by the caller AFTER this returns success.
   */
  static async processWalletTopup(params: {
    amountAgorot: number;
    customerId: string;
    cardToken: string;
    idempotencyKey: string;
  }): Promise<TranzilaChargeResult> {
    if (!TRANZILA_WALLET_TOPUP_ENABLED) {
      logger.warn('[Tranzila] wallet top-up attempted but TRANZILA_WALLET_TOPUP_ENABLED is false');
      return { success: false, error: 'Tranzila wallet top-up not enabled. Set TRANZILA_WALLET_TOPUP_ENABLED=true.' };
    }
    return TranzilaService._charge({ ...params, productType: 'wallet_topup' });
  }

  /**
   * Capture payment for a marketplace booking via Tranzila.
   * Gated by TRANZILA_MARKETPLACE_ENABLED feature flag.
   * Internal ledger + escrow write must be called by the caller AFTER this returns success.
   */
  static async captureMarketplaceBooking(params: {
    amountAgorot: number;
    customerId: string;
    providerId: string;
    bookingId: string;
    cardToken: string;
    idempotencyKey: string;
  }): Promise<TranzilaChargeResult> {
    if (!TRANZILA_MARKETPLACE_ENABLED) {
      logger.warn('[Tranzila] marketplace capture attempted but TRANZILA_MARKETPLACE_ENABLED is false');
      return { success: false, error: 'Tranzila marketplace not enabled. Set TRANZILA_MARKETPLACE_ENABLED=true.' };
    }
    return TranzilaService._charge({ ...params, productType: 'marketplace_booking' });
  }

  /**
   * Verify an inbound Tranzila webhook signature.
   * MUST be called before trusting any webhook payload.
   * Returns verified=false if secret is not configured — webhook is rejected.
   */
  static verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!WEBHOOK_SECRET) {
      logger.error('[Tranzila] TRANZILA_WEBHOOK_SECRET not set — rejecting all webhooks');
      return false;
    }
    // TODO: implement HMAC-SHA256 verification using WEBHOOK_SECRET.
    // Tranzila sends signature in X-Tranzila-Signature header.
    // Until implemented, reject all webhooks (fail-safe, not fail-open).
    logger.error('[Tranzila] verifyWebhookSignature not yet implemented — rejecting webhook');
    return false;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private static async _charge(params: {
    amountAgorot: number;
    customerId: string;
    cardToken: string;
    idempotencyKey: string;
    productType: string;
    providerId?: string;
    bookingId?: string;
  }): Promise<TranzilaChargeResult> {
    if (!TERMINAL_NAME || !TERMINAL_PASSWORD) {
      logger.error('[Tranzila] TRANZILA_TERMINAL_NAME or TRANZILA_TERMINAL_PASSWORD not set');
      return { success: false, error: 'Tranzila credentials not configured.' };
    }

    // TODO: implement real Tranzila REST API call.
    // API endpoint: https://secure5.tranzila.com/cgi-bin/tranzila71u.cgi (or REST equivalent)
    // Required fields: terminal_name, TranzilaPW, sum (in ILS), ccno/token, expdate, mycvv
    // On success: response.Response === '000' && response.tran_num is set
    logger.error('[Tranzila] _charge not yet implemented — returning failure (safe default)', {
      productType: params.productType,
      amountAgorot: params.amountAgorot,
    });
    return {
      success: false,
      error: 'Tranzila charge not yet implemented. Wire real API call before enabling flags.',
    };
  }
}

export default TranzilaService;
