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
 *   PetWash internal ledger → ALWAYS mandatory for every flow
 */

/** True only when real Israeli bank wiring is live.
 *  When false, ProviderPayoutService routes payouts to pending_transfer, not paid_out. */
export const BANK_PAYOUT_LIVE = process.env.BANK_PAYOUT_LIVE === 'true';

/** True when Tranzila e-gift purchase flow is enabled.
 *  First Tranzila product to migrate — safest because it is discrete & lower risk. */
export const TRANZILA_EGIFT_ENABLED = process.env.TRANZILA_EGIFT_ENABLED === 'true';

/** True when Tranzila wallet top-up flow is enabled.
 *  Migrate after e-gift is proven stable. */
export const TRANZILA_WALLET_TOPUP_ENABLED = process.env.TRANZILA_WALLET_TOPUP_ENABLED === 'true';

/** True when Tranzila marketplace booking capture is enabled.
 *  Migrate last — highest volume, highest risk. */
export const TRANZILA_MARKETPLACE_ENABLED = process.env.TRANZILA_MARKETPLACE_ENABLED === 'true';

/**
 * Wash package purchase via Tranzila is intentionally NOT exposed as a flag here.
 * washPackageCredits are K9000-only by architecture (WalletEngine isKioskWash guard).
 * Any future Tranzila wiring for wash package purchase must first confirm that the
 * isKioskWash=true guard is preserved end-to-end before this flag is introduced.
 * See: server/services/WalletEngine.ts computeDeductionOrder (isKioskWash branch).
 */

/** Diagnostic: log which payment flags are active at startup. */
export function logPaymentFlags(): void {
  const flags = {
    BANK_PAYOUT_LIVE,
    TRANZILA_EGIFT_ENABLED,
    TRANZILA_WALLET_TOPUP_ENABLED,
    TRANZILA_MARKETPLACE_ENABLED,
  };
  // Use console.info so it appears in startup logs even before the logger is ready
  console.info('[PaymentFlags] Active payment feature flags:', flags);
}
