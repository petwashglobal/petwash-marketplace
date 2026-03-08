/**
 * PetWash™ Finance Flow Type System — 2026
 *
 * CRITICAL PRINCIPLE:
 * Two fundamentally different financial flows exist in the platform.
 * They must NEVER be mixed in logic, receipts, dashboards, or legal explanations.
 *
 * FLOW A — Marketplace Booking:
 *   Customer pays → Processor → VAT → PlatformFee → Escrow → ProviderPayout
 *   → Provider exists. Provider tax explanation is relevant.
 *
 * FLOW B — Direct Platform Sale (no provider):
 *   Customer pays → Processor → VAT → PetWash Revenue
 *   → NO provider. NO provider payout. NO provider tax explanation.
 */

// ── Transaction Types ─────────────────────────────────────────────────────────

export const TRANSACTION_TYPES = {
  // Flow A — Marketplace
  MARKETPLACE_BOOKING:  'marketplace_booking',   // Customer pays for a provider service
  PROVIDER_PAYOUT:      'provider_payout',        // Platform pays provider after escrow release
  ESCROW_HOLD:          'escrow_hold',            // Funds captured + held pre-release
  ESCROW_RELEASE:       'escrow_release',         // Funds released to provider (72h after service)
  ESCROW_REFUND:        'escrow_refund',          // Refund from escrow (dispute / cancellation)

  // Flow B — Direct PetWash Sale
  DIRECT_PLATFORM_SALE: 'direct_platform_sale',  // Platform sells something directly (no provider)
  EGIFT_SALE:           'egift_sale',             // E-gift card purchase
  WALLET_TOPUP:         'wallet_topup',           // Customer tops up wallet balance

  // Shared — both flows
  PLATFORM_FEE:         'platform_fee',           // Commission entry (marketplace)
  PROCESSING_FEE:       'processing_fee',         // Nayax / processor fee
  VAT_ENTRY:            'vat_entry',              // VAT collected (both flows, different targets)
  REFUND:               'refund',                 // Generic refund (either flow)
  ADJUSTMENT:           'adjustment',             // Manual correction
  CHARGEBACK:           'chargeback',             // Disputed charge by card network
} as const;

export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

// ── Flow Classification ───────────────────────────────────────────────────────

/** Returns true when a transaction is part of a marketplace booking (provider exists) */
export function isMarketplaceFlow(type: TransactionType): boolean {
  return [
    TRANSACTION_TYPES.MARKETPLACE_BOOKING,
    TRANSACTION_TYPES.PROVIDER_PAYOUT,
    TRANSACTION_TYPES.ESCROW_HOLD,
    TRANSACTION_TYPES.ESCROW_RELEASE,
    TRANSACTION_TYPES.ESCROW_REFUND,
    TRANSACTION_TYPES.PLATFORM_FEE,
  ].includes(type as any);
}

/** Returns true when a transaction is a direct PetWash company sale (no provider) */
export function isDirectSaleFlow(type: TransactionType): boolean {
  return [
    TRANSACTION_TYPES.DIRECT_PLATFORM_SALE,
    TRANSACTION_TYPES.EGIFT_SALE,
    TRANSACTION_TYPES.WALLET_TOPUP,
  ].includes(type as any);
}

/** Returns true when a provider exists in this flow and provider tax info is relevant */
export function hasProvider(type: TransactionType): boolean {
  return isMarketplaceFlow(type);
}

// ── Flow A: Marketplace Booking Fee Breakdown ─────────────────────────────────

export interface MarketplaceFeeBreakdown {
  flowType: 'marketplace_booking';
  customerId: string;
  providerId: string;              // REQUIRED — provider must exist
  bookingId: string;
  grossAmountCents: number;        // What customer pays (base + platform fee + VAT)
  basePriceCents: number;          // Provider's rate
  platformFeeCents: number;        // Platform commission (e.g. 15%)
  platformFeePercent: number;      // e.g. 0.15
  vatOnPlatformFeeCents: number;   // 18% VAT on platform fee only
  vatRate: number;                 // 0.18 (Israeli VAT 2026)
  processorFeeCents: number;       // Nayax processing fee
  escrowAmountCents: number;       // Held in escrow
  providerPayoutCents: number;     // What provider receives (base - 15%)
  currency: string;                // 'ILS'
}

// ── Flow B: Direct Platform Sale Fee Breakdown ────────────────────────────────

export interface DirectSaleFeeBreakdown {
  flowType: 'direct_platform_sale' | 'egift_sale' | 'wallet_topup';
  customerId: string;
  saleId: string;
  saleType: 'egift' | 'wallet' | 'bundle' | 'wash_package';
  grossAmountCents: number;       // Customer paid
  vatAmountCents: number;         // 18% VAT on the full sale (PetWash is the seller)
  vatRate: number;                // 0.18
  processorFeeCents: number;      // Nayax fee
  netRevenueCents: number;        // PetWash net income (gross - vat - processor)
  currency: string;               // 'ILS'
  // NOTE: NO providerId, NO providerPayout, NO escrow
}

// ── Receipt Classification ────────────────────────────────────────────────────

export interface ReceiptMetadata {
  transactionType: TransactionType;
  showProviderSection: boolean;   // true only for marketplace flows
  showEscrowSection: boolean;     // true only for marketplace flows
  showProviderTaxNote: boolean;   // true only for marketplace flows
  invoiceParty: 'petwash_direct' | 'marketplace_facilitation';
  // 'petwash_direct' = PetWash is the seller (direct sale)
  // 'marketplace_facilitation' = PetWash facilitated a third-party service
}

export function getReceiptMetadata(type: TransactionType): ReceiptMetadata {
  const marketplace = isMarketplaceFlow(type);
  return {
    transactionType: type,
    showProviderSection: marketplace,
    showEscrowSection: marketplace,
    showProviderTaxNote: marketplace,
    invoiceParty: marketplace ? 'marketplace_facilitation' : 'petwash_direct',
  };
}

// ── Admin Finance KPI Shape ───────────────────────────────────────────────────

export interface MoneyFlowSummary {
  // Flow A — Marketplace
  totalMarketplaceBookings: number;
  totalMarketplaceGrossILS: number;
  totalPlatformFeesILS: number;
  totalProviderPayoutsILS: number;
  totalEscrowHeldILS: number;
  totalEscrowReleasedILS: number;
  totalVATMarketplaceILS: number;

  // Flow B — Direct PetWash Sales
  totalDirectPlatformSales: number;
  totalDirectSalesGrossILS: number;
  totalEGiftSales: number;
  totalEGiftValueILS: number;
  totalWalletTopups: number;
  totalWalletTopupValueILS: number;
  totalVATDirectSalesILS: number;

  // Shared
  totalProcessorFeesILS: number;
  totalRefundsILS: number;
  totalChargebacks: number;

  // Computed
  totalVATAllFlowsILS: number;    // marketplace VAT + direct sales VAT
  totalNetRevenueILS: number;     // platform fees + direct sales net
}

// ── Israeli Tax Constants 2026 ────────────────────────────────────────────────

export const ISRAELI_TAX_2026 = {
  VAT_RATE: 0.18,                  // מע"מ — 18%
  CORPORATE_TAX_RATE: 0.23,        // מס חברות — 23%

  // Income tax brackets (for PROVIDER information only — NOT collected by platform)
  INCOME_TAX_BRACKETS: [
    { from: 0,        to: 84120,   rate: 0.10, label: '10%' },
    { from: 84121,    to: 120720,  rate: 0.14, label: '14%' },
    { from: 120721,   to: 193800,  rate: 0.20, label: '20%' },
    { from: 193801,   to: 269280,  rate: 0.31, label: '31%' },
    { from: 269281,   to: 560280,  rate: 0.35, label: '35%' },
    { from: 560281,   to: Infinity, rate: 0.47, label: '47%-50%' },
  ],

  // National insurance (Bituach Leumi) — self-employed, combined with health insurance
  // For PROVIDER information only — NOT collected by platform
  NATIONAL_INSURANCE_RANGE: { min: 0.09, max: 0.17 },  // 9%–17% combined
} as const;
