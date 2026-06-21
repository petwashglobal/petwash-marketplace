/**
 * Canonical PetWash service / division registry — 2026
 * =====================================================
 * THE single source of truth for "which platform/service does this money
 * movement belong to". Before this file, three incompatible taxonomies ran in
 * parallel (the wallet ledger's `divisionCode`, `credit_transactions.platform`,
 * and the VAT P&L ledger's `platform`) and several inline mappers re-declared
 * the same mapping with different keys — so e.g. a trainer/Academy booking was
 * silently filed under the pet-sitter platform in the fiscal ledger.
 *
 * Each PetWash service has ONE unique fiscal platform code so every receipt,
 * VAT entry and payout can be attributed unambiguously to the right service
 * (K9000 wash vs pet-sitting vs walk vs Academy vs …). Import from here; never
 * re-declare these codes inline.
 *
 * NOTE (migration in progress): the wallet ledgers (`wallet_ledger_entries.
 * divisionCode`, `credit_transactions.platform`) still use their own legacy
 * strings. `WALLET_DIVISION_BY_PLATFORM` below bridges them; the next batch
 * makes `divisionCode` NOT NULL and routes every `addCredits` through this
 * registry so a single wallet row always names its service.
 */

/**
 * Fiscal-ledger platform codes — used by VATCalculatorService's P&L ledger and
 * by the Israeli receipt/tax layer. One code per real PetWash revenue service.
 */
export const FISCAL_PLATFORMS = [
  'pet-wash-hub', // K9000 station wash (direct sale)
  'sitter-suite', // pet sitting
  'walk-my-pet',  // dog walking
  'academy',      // trainer / Pet Wash Academy™
  'pettrek',      // pet transport
  'paw-finder',   // lost-pet portal services
  'plush-lab',    // grooming / plush
  'enterprise',   // B2B / franchise
] as const;

export type FiscalPlatform = (typeof FISCAL_PLATFORMS)[number];

/** Platform commission (15%) unless a specific platform overrides it. */
export const DEFAULT_COMMISSION_RATE = 0.15;

export const COMMISSION_RATE_BY_PLATFORM: Record<FiscalPlatform, number> = {
  'pet-wash-hub': DEFAULT_COMMISSION_RATE,
  'sitter-suite': DEFAULT_COMMISSION_RATE,
  'walk-my-pet': DEFAULT_COMMISSION_RATE,
  'academy': DEFAULT_COMMISSION_RATE,
  'pettrek': DEFAULT_COMMISSION_RATE,
  'paw-finder': DEFAULT_COMMISSION_RATE,
  'plush-lab': DEFAULT_COMMISSION_RATE,
  'enterprise': DEFAULT_COMMISSION_RATE,
};

/**
 * Map a marketplace providerType to its fiscal platform.
 * `trainer` → `academy` (previously fell through to `sitter-suite`, so Academy
 * revenue was mis-attributed to pet-sitting in the P&L ledger).
 */
export function providerTypeToFiscalPlatform(providerType?: string | null): FiscalPlatform {
  switch (providerType) {
    case 'sitter':
      return 'sitter-suite';
    case 'walker':
      return 'walk-my-pet';
    case 'trainer':
      return 'academy';
    case 'transporter':
    case 'pettrek':
      return 'pettrek';
    case 'groomer':
      return 'plush-lab';
    default:
      // Unknown provider types keep the historical conservative default rather
      // than inventing a code — but the four real ones above are now exact.
      return 'sitter-suite';
  }
}

/**
 * Map a booking serviceType (the verb-form used by booking-requests) to its
 * fiscal platform. Mirrors providerTypeToFiscalPlatform but keyed on the
 * service verb (`sitting`/`walking`/`training`/`pettrek`).
 */
export function serviceTypeToFiscalPlatform(serviceType?: string | null): FiscalPlatform {
  switch (serviceType) {
    case 'sitting':
      return 'sitter-suite';
    case 'walking':
      return 'walk-my-pet';
    case 'training':
      return 'academy';
    case 'pettrek':
      return 'pettrek';
    case 'grooming':
      return 'plush-lab';
    default:
      return 'sitter-suite';
  }
}

/**
 * Wallet-ledger service tag (`credit_transactions.platform`) derived from the
 * RELIABLE `creditType` enum. Before this, addCredits never set `platform`, so a
 * wash credit was only inferable from a free-text, overloaded `sourceType` — you
 * could not tell "is this credit for K9000 or pet-sitting?" from one row. The
 * creditType enum answers it unambiguously: a wash_package credit IS a K9000
 * credit. Values match the taxonomy documented on credit_transactions.platform.
 */
export function creditTypeToServiceTag(creditType: string): string {
  switch (creditType) {
    case 'wash_package':
      return 'k9000';
    case 'egift':
      return 'egift';
    case 'loyalty_points':
      return 'loyalty';
    case 'promo_credit':
      return 'promo';
    case 'referral_credit':
      return 'referral';
    default:
      return 'account_credit';
  }
}

/**
 * SUMIT (OfficeGuy) document types we issue. One canonical mapping so every
 * service issues the RIGHT fiscal document for the same economic event — before
 * this, eGift sent a bare 'Invoice' while a sitter booking sent
 * 'InvoiceAndReceipt' for the identical "customer already paid" situation.
 *
 *   InvoiceAndReceipt — חשבונית מס/קבלה — a B2C sale already paid (DEFAULT).
 *   Receipt           — קבלה            — money received against an existing invoice.
 *   Invoice           — חשבונית מס       — a charge not yet receipted (rare for us).
 *   CreditInvoice     — חשבונית זיכוי    — refund / reversal.
 */
export type SumitDocType = 'InvoiceAndReceipt' | 'Receipt' | 'Invoice' | 'CreditInvoice';

/**
 * The fiscal document type for a customer-facing, already-paid PetWash sale.
 * Every paid service (K9000 wash, eGift, sitter, walk, Academy, shop) issues
 * the same חשבונית מס/קבלה. Refunds use 'CreditInvoice' explicitly at the call
 * site — this helper is for the forward (charge) direction only.
 */
export function sumitDocTypeForPaidSale(_platform?: FiscalPlatform | string | null): SumitDocType {
  return 'InvoiceAndReceipt';
}

/**
 * Legacy wallet-ledger `divisionCode` per fiscal platform (bridge until the
 * wallet ledgers adopt FiscalPlatform directly). Mirrors the strings documented
 * on `wallet_ledger_entries.divisionCode`.
 */
export const WALLET_DIVISION_BY_PLATFORM: Record<FiscalPlatform, string> = {
  'pet-wash-hub': 'station_k9000',
  'sitter-suite': 'petsitter',
  'walk-my-pet': 'walkers',
  'academy': 'academy',
  'pettrek': 'pettrek',
  'paw-finder': 'paw_finder',
  'plush-lab': 'plush_lab',
  'enterprise': 'enterprise',
};
