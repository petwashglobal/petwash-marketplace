/**
 * PetWash™ Server-Side Payment Feature Flags
 *
 * All flags are read from environment variables at runtime so they can be
 * toggled without a code deployment.  No client-side exposure.
 *
 * Architecture contract (must never change without CPA + engineering sign-off):
 *   Nayax    → K9000 public machine card sale ONLY
 *   Internal → K9000 member redeem ONLY
 *   Tranzila → digital purchase flows (e-gift, wallet top-up, marketplace)
 *              + payment requests, accounting documents, chargebacks, settlements
 *   PetWash internal ledger → ALWAYS mandatory for every flow
 *
 * Flag hierarchy (must be enabled in order — each depends on prior stability):
 *   Tier 1 — Charge flows:   EGIFT → WALLET_TOPUP → MARKETPLACE
 *   Tier 2 — Processor side: PAYMENT_REQUESTS → DOCUMENT_INGESTION
 *   Tier 3 — Monitoring:     CHARGEBACK_ALERTS → SETTLEMENT_IMPORT
 */

// ── Core bank / payout ───────────────────────────────────────────────────────

/** True only when real Israeli bank wiring is live.
 *  When false, ProviderPayoutService routes payouts to pending_transfer, not paid_out. */
export const BANK_PAYOUT_LIVE = process.env.BANK_PAYOUT_LIVE === 'true';

// ── Tranzila webhook security gate ───────────────────────────────────────────
//
// ALL live Tranzila charge flags are hard-blocked if the inbound webhook
// endpoint is not properly secured.  This prevents money writes from flowing
// through a path whose authenticity cannot be verified.
//
// Required for ANY live Tranzila flag to be active:
//   1. TRANZILA_WEBHOOK_SECRET must be set (HMAC verification key).
//   2. TRANZILA_WEBHOOK_BYPASS_SIGNATURE must NOT be 'true' (bypass off).
//   3. TRANZILA_ALLOWED_IPS must be set in production/staging.
//      (optional in local dev where IPs are not fixed)
//
// If any condition fails, all Tier-1 charge flags resolve to false regardless
// of their own env-var values.
//
// NOTE: This guard runs at module load time.  A flag change requires a
// process restart (no hot-reload).
const _isTranzilaWebhookSecured: boolean = (() => {
  const hasSecret    = !!process.env.TRANZILA_WEBHOOK_SECRET;
  const bypassActive = process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE === 'true';
  const hasAllowedIPs = !!(process.env.TRANZILA_ALLOWED_IPS || '').trim();
  const env = (process.env.NODE_ENV || '').toLowerCase();
  const isRestrictedEnv = env === 'production' || env === 'staging';

  if (!hasSecret)    return false;
  if (bypassActive)  return false;
  // In production/staging the IP allowlist is mandatory
  if (isRestrictedEnv && !hasAllowedIPs) return false;
  return true;
})();

/**
 * Exported for use in status endpoints and tests.
 * Returns true only when all webhook security requirements are satisfied.
 */
export function isTranzilaWebhookSecured(): boolean {
  return _isTranzilaWebhookSecured;
}

// ── Tranzila charge flows (Tier 1) ───────────────────────────────────────────
// Each flag is gated behind _isTranzilaWebhookSecured.
// A live charge flag is meaningless without a secure inbound confirmation path.

/** True when Tranzila e-gift purchase flow is enabled.
 *  First Tranzila product to migrate — safest because it is discrete & lower risk. */
export const TRANZILA_EGIFT_ENABLED = _isTranzilaWebhookSecured && process.env.TRANZILA_EGIFT_ENABLED === 'true';

/** True when Tranzila wallet top-up flow is enabled.
 *  Migrate after e-gift is proven stable. */
export const TRANZILA_WALLET_TOPUP_ENABLED = _isTranzilaWebhookSecured && process.env.TRANZILA_WALLET_TOPUP_ENABLED === 'true';

/** True when Tranzila marketplace booking capture is enabled.
 *  Migrate last — highest volume, highest risk. */
export const TRANZILA_MARKETPLACE_ENABLED = _isTranzilaWebhookSecured && process.env.TRANZILA_MARKETPLACE_ENABLED === 'true';

/**
 * Wash package purchase via Tranzila is intentionally NOT exposed as a flag here.
 * washPackageCredits are K9000-only by architecture (WalletEngine isKioskWash guard).
 * Any future Tranzila wiring for wash package purchase must first confirm that the
 * isKioskWash=true guard is preserved end-to-end before this flag is introduced.
 * See: server/services/WalletEngine.ts computeDeductionOrder (isKioskWash branch).
 */

// ── Tranzila processor-side features (Tier 2) ────────────────────────────────

/**
 * True when Tranzila payment request (remote pay) feature is active.
 * Allows merchants to create payment links and send via email/SMS through Tranzila.
 * Requires TRANZILA_PAYMENT_REQUEST_API credentials in env.
 * DO NOT enable until Tranzila account is configured and webhook endpoint is verified.
 */
export const TRANZILA_PAYMENT_REQUESTS_ENABLED = process.env.TRANZILA_PAYMENT_REQUESTS_ENABLED === 'true';

/**
 * True when PetWash ingests Tranzila-generated accounting documents.
 * When enabled, TranzilaDocumentMapper maps processor document numbers into
 * pw_tax_documents rows. PetWash does NOT generate the documents — only maps them.
 * Requires CPA written confirmation on VAT timing before enabling.
 */
export const TRANZILA_DOCUMENT_INGESTION_ENABLED = process.env.TRANZILA_DOCUMENT_INGESTION_ENABLED === 'true';

// ── Tranzila monitoring features (Tier 3) ────────────────────────────────────

/**
 * True when chargeback webhook events from Tranzila trigger PetWash alerts.
 * When false, chargeback webhooks are accepted and logged but do NOT trigger
 * Octopus alerts or booking flags.
 */
export const TRANZILA_CHARGEBACK_ALERTS_ENABLED = process.env.TRANZILA_CHARGEBACK_ALERTS_ENABLED === 'true';

/**
 * True when Tranzila settlement batch imports run reconciliation against pw_payments.
 * When false, settlement batches are stored but reconciliation is a no-op.
 */
export const TRANZILA_SETTLEMENT_RECONCILIATION_ENABLED =
  process.env.TRANZILA_SETTLEMENT_RECONCILIATION_ENABLED === 'true';

/** Diagnostic: log which payment flags are active at startup. */
export function logPaymentFlags(): void {
  const flags = {
    BANK_PAYOUT_LIVE,
    TRANZILA_EGIFT_ENABLED,
    TRANZILA_WALLET_TOPUP_ENABLED,
    TRANZILA_MARKETPLACE_ENABLED,
    TRANZILA_PAYMENT_REQUESTS_ENABLED,
    TRANZILA_DOCUMENT_INGESTION_ENABLED,
    TRANZILA_CHARGEBACK_ALERTS_ENABLED,
    TRANZILA_SETTLEMENT_RECONCILIATION_ENABLED,
  };
  // Use console.info so it appears in startup logs even before the logger is ready
  console.info('[PaymentFlags] Active payment feature flags:', flags);
}
