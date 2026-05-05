/**
 * VAT Calculator Service — Israeli Tax Compliance (מע"מ)
 * ========================================================
 * Israeli VAT rate: 18% (effective 1 January 2025, per Tax Authority circular)
 * Company VAT number: 516788400  (Pet Wash Ltd)
 *
 * TWO LEGALLY DISTINCT SALE MODES:
 *
 * ── MODE A: DIRECT SALE ─────────────────────────────────────────────────────
 * Used for: K9000 automated wash, eGift card purchase
 * PetWash is the sole seller. Nayax collects the FULL consumer price.
 * Israeli consumer prices must be VAT-inclusive (Consumer Protection Law §17a).
 * PetWash owes VAT on the FULL amount collected.
 *
 *   grossCollectedILS (VAT-inclusive)
 *   vatOwed            = grossCollectedILS × (18 / 118)   ← back-calc from gross
 *   netRevenue         = grossCollectedILS − vatOwed
 *   providerShare      = 0
 *
 * ── MODE B: MARKETPLACE (broker model) ─────────────────────────────────
 * Used for: Sitter Suite, Walk My Pet, PetTrek, Pet Wash Hub, Paw Finder, PlushLab
 * PetWash is an indirect agent (סוכן בלתי מגולה).
 * Customer pays ONE total amount; PetWash keeps its commission; provider receives the rest.
 * PetWash ONLY owes VAT on its own commission portion.
 * Provider MUST issue PetWash a חשבונית מס (tax invoice) for their share so PetWash
 * can claim input-VAT credit — resulting in net VAT obligation = VAT on commission only.
 * If provider is עוסק פטור they cannot issue a tax invoice; flag is set accordingly.
 *
 *   grossCollectedILS (VAT-inclusive, what Nayax charges the customer)
 *   platformFeeGross   = grossCollectedILS × commissionRate   (e.g. 15%)
 *   providerGross      = grossCollectedILS × (1 − commissionRate)
 *   vatOnPlatformFee   = platformFeeGross  × (18 / 118)       ← PetWash's VAT liability
 *   platformNetRevenue = platformFeeGross  − vatOnPlatformFee
 *   vatInProviderShare = providerGross     × (18 / 118)       ← offset by provider invoice
 *   providerNet        = providerGross     − vatInProviderShare
 *
 * Dual-save: Firestore (real-time dashboard) + PostgreSQL digital_receipts (legal archive)
 */

import admin from "../lib/firebase-admin";
import { db } from '../db';
import { digitalReceipts } from '@shared/schema';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

// Re-exported for downstream consumers that already import this name from
// VATCalculatorService. The single source of truth is
// shared/israel-compliance-config.ts (PR-W13).
export const ISRAELI_VAT_RATE = ISRAEL_VAT_RATE;
export const PLATFORM_COMMISSION_RATE = 0.15;

const PLATFORM_COMMISSION_RATES: Record<string, number> = {
  'sitter-suite': 0.15,
  'walk-my-pet': 0.15,
  'pettrek': 0.15,
  'pet-wash-hub': 0.15,
  'paw-finder': 0.15,
  'plush-lab': 0.15,
  'enterprise': 0.15,
};

function ils(n: number): number {
  return Math.round(n * 100) / 100;
}

function vatFromGross(gross: number): number {
  return ils(gross * (ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)));
}

// ─── Exported types ──────────────────────────────────────────────────────────

export interface DirectSaleVAT {
  mode: 'direct';
  grossCollectedILS: number;
  vatOwed: number;
  netRevenue: number;
  vatRate: number;
  providerShare: 0;
  requiresProviderTaxInvoice: false;
}

export interface MarketplaceVAT {
  mode: 'marketplace';
  grossCollectedILS: number;
  commissionRate: number;
  platformFeeGross: number;
  vatOnPlatformFee: number;
  platformNetRevenue: number;
  providerGross: number;
  vatInProviderShare: number;
  providerNet: number;
  vatRate: number;
  requiresProviderTaxInvoice: true;
}

export type VATBreakdown = DirectSaleVAT | MarketplaceVAT;

export interface PLedgerEntry {
  id: string;
  platform: "sitter-suite" | "walk-my-pet" | "pettrek" | "pet-wash-hub" | "paw-finder" | "plush-lab" | "enterprise";
  transactionId: string;
  bookingId?: string;
  date: Date;
  grossCollectedILS: number;
  platformFeeGross: number;
  vatOnPlatformFee: number;
  platformNetRevenue: number;
  providerGross: number;
  providerNet: number;
  commissionRate: number;
  vatRate: number;
  currency: "ILS" | "USD" | "EUR" | "GBP";
  status: "pending" | "completed" | "refunded" | "voided";
  requiresProviderTaxInvoice: boolean;
  // ── Stage 2: Israeli provider withholding & Osek classification ────────────
  withholdingTaxAmount?: number;    // ניכוי מס במקור deducted from provider gross
  withholdingTaxRate?: number;      // effective rate (0.0 – 1.0)
  netProviderPayout?: number;       // grossPayout − withholdingTax (actual wire to provider)
  osekType?: "osek_patur" | "osek_murshe"; // Israeli provider tax classification
  commissionId?: string;            // COMM-YYYY-XXXXXXXX from provider_commissions table
  voidReason?: string;              // set when status = 'voided'
  metadata?: any;
}

class VATCalculatorService {
  private firestore = admin.firestore();

  getCommissionRate(platform: string): number {
    return PLATFORM_COMMISSION_RATES[platform] ?? PLATFORM_COMMISSION_RATE;
  }

  // ── MODE A: Direct sale (K9000, eGift purchase) ────────────────────────────
  calculateDirectSaleVAT(grossCollectedILS: number): DirectSaleVAT {
    const gross = ils(grossCollectedILS);
    const vatOwed = vatFromGross(gross);
    return {
      mode: 'direct',
      grossCollectedILS: gross,
      vatOwed,
      netRevenue: ils(gross - vatOwed),
      vatRate: ISRAELI_VAT_RATE,
      providerShare: 0,
      requiresProviderTaxInvoice: false,
    };
  }

  // ── MODE B: Marketplace / agent model (broker-style provider services) ─────
  // Input: grossCollectedILS = the total the customer actually paid (Nayax charge)
  calculateMarketplaceVAT(
    grossCollectedILS: number,
    commissionRate: number = PLATFORM_COMMISSION_RATE
  ): MarketplaceVAT {
    const gross = ils(grossCollectedILS);
    const platformFeeGross = ils(gross * commissionRate);
    const providerGross = ils(gross - platformFeeGross);
    const vatOnPlatformFee = vatFromGross(platformFeeGross);
    const vatInProviderShare = vatFromGross(providerGross);
    return {
      mode: 'marketplace',
      grossCollectedILS: gross,
      commissionRate,
      platformFeeGross,
      vatOnPlatformFee,
      platformNetRevenue: ils(platformFeeGross - vatOnPlatformFee),
      providerGross,
      vatInProviderShare,
      providerNet: ils(providerGross - vatInProviderShare),
      vatRate: ISRAELI_VAT_RATE,
      requiresProviderTaxInvoice: true,
    };
  }

  // ── Convenience: provider's net → gross (for callers that only know provider rate) ─
  // Given the provider's share (= 85% of gross when commission is 15%), back-calculate gross.
  // grossCollected = providerNetAmount / (1 - commissionRate)
  grossFromProviderShare(
    providerNetILS: number,
    commissionRate: number = PLATFORM_COMMISSION_RATE
  ): number {
    return ils(providerNetILS / (1 - commissionRate));
  }

  // ── K9000 direct sale (already correct, kept for symmetry) ─────────────────
  calculateK9000Revenue(chargeILS: number): DirectSaleVAT & { revenueOwner: 'petwash'; chargeILS: number } {
    const base = this.calculateDirectSaleVAT(chargeILS);
    return {
      ...base,
      chargeILS: base.grossCollectedILS,
      revenueOwner: 'petwash',
    };
  }

  // ── Record marketplace provider transaction ────────────────────────────────
  // providerShareILS: the amount the provider is receiving (their net portion before their own VAT)
  // NOTE: This back-calculates gross from the provider share. Prefer recordTransactionFromGross()
  // when the actual customer-paid gross is known (service completion path).
  async recordTransaction(
    platform: PLedgerEntry["platform"],
    transactionId: string,
    providerShareILS: number,
    bookingId?: string,
    metadata?: any
  ): Promise<PLedgerEntry> {
    const commissionRate = this.getCommissionRate(platform);
    const grossCollectedILS = this.grossFromProviderShare(providerShareILS, commissionRate);
    const calc = this.calculateMarketplaceVAT(grossCollectedILS, commissionRate);

    const entryId = `PL-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const entry: PLedgerEntry = {
      id: entryId,
      platform,
      transactionId,
      bookingId,
      date: new Date(),
      grossCollectedILS: calc.grossCollectedILS,
      platformFeeGross: calc.platformFeeGross,
      vatOnPlatformFee: calc.vatOnPlatformFee,
      platformNetRevenue: calc.platformNetRevenue,
      providerGross: calc.providerGross,
      providerNet: calc.providerNet,
      commissionRate: calc.commissionRate,
      vatRate: ISRAELI_VAT_RATE,
      currency: "ILS",
      status: "completed",
      requiresProviderTaxInvoice: true,
      metadata,
    };

    try {
      const ledgerRef = this.firestore.collection("profit_loss_ledger").doc(entryId);
      await ledgerRef.set(entry);
    } catch (firestoreError: any) {
      logger.warn('[VATCalculator] Firestore write failed (non-critical)', {
        platform,
        transactionId,
        error: firestoreError.message,
      });
    }

    try {
      const receiptNumber = `PL-${entryId}`;
      const issuedAt = new Date();
      const auditHash = createHash('sha256').update(JSON.stringify({
        receiptNumber,
        grossCollectedILS: calc.grossCollectedILS,
        vatOnPlatformFee: calc.vatOnPlatformFee,
        platformFeeGross: calc.platformFeeGross,
        issuedAt: issuedAt.toISOString(),
        companyTaxId: '516788400',
      })).digest('hex');

      await db.insert(digitalReceipts).values({
        receiptNumber,
        receiptType: 'pl_ledger_entry',
        platform,
        bookingId: bookingId || transactionId,
        customerEmail: `platform-${platform}@internal`,
        customerName: `PetWash ${platform} Platform`,
        serviceDescription: `P&L ledger entry - ${platform} - Transaction ${transactionId}`,
        serviceDescriptionHe: `רשומת רווח והפסד - ${platform} - עסקה ${transactionId}`,
        subtotalAmount: calc.platformNetRevenue.toFixed(2),
        vatRate: (ISRAELI_VAT_RATE * 100).toFixed(2),
        vatAmount: calc.vatOnPlatformFee.toFixed(2),
        platformFeeAmount: calc.platformFeeGross.toFixed(2),
        totalAmount: calc.grossCollectedILS.toFixed(2),
        currency: 'ILS',
        providerPayoutAmount: calc.providerNet.toFixed(2),
        brokerCommissionAmount: calc.platformFeeGross.toFixed(2),
        paymentMethod: 'internal_ledger',
        paymentStatus: 'completed',
        companyName: 'Pet Wash Ltd',
        companyTaxId: '516788400',
        companyAddress: 'ישראל',
        auditHash,
        accountingRecorded: true,
        accountingEntryId: entryId,
        issuedAt,
      });
    } catch (pgError: any) {
      logger.error('[VATCalculator] PostgreSQL dual-save FAILED — legal compliance gap', {
        platform,
        transactionId,
        error: pgError.message,
      });
    }

    logger.info(
      `[VATCalculator] Marketplace TX recorded: ${platform} — ` +
      `gross ₪${calc.grossCollectedILS.toFixed(2)}, ` +
      `platform fee ₪${calc.platformFeeGross.toFixed(2)}, ` +
      `VAT obligation ₪${calc.vatOnPlatformFee.toFixed(2)}, ` +
      `provider net ₪${calc.providerNet.toFixed(2)}`
    );

    return entry;
  }

  // ── Record marketplace transaction using ACTUAL GROSS (authoritative completion path) ──
  // grossCollectedILS: the exact amount the customer paid (Nayax charge), including VAT.
  // Use this at service completion / escrow release when the real gross is known.
  // settlement: optional withholding + Osek data from IsraeliDigitalReceiptService to
  //   embed all Stage 2 compliance fields in a single atomic Firestore write.
  async recordTransactionFromGross(
    platform: PLedgerEntry["platform"],
    transactionId: string,
    grossCollectedILS: number,
    bookingId?: string,
    metadata?: any,
    settlement?: {
      withholdingTaxAmount: number;
      withholdingTaxRate: number;
      netPaymentToProvider: number;
      commissionId: string;
      osekType?: "osek_patur" | "osek_murshe";
    }
  ): Promise<PLedgerEntry> {
    const commissionRate = this.getCommissionRate(platform);
    const calc = this.calculateMarketplaceVAT(grossCollectedILS, commissionRate);

    const entryId = `PL-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const entry: PLedgerEntry = {
      id: entryId,
      platform,
      transactionId,
      bookingId,
      date: new Date(),
      grossCollectedILS: calc.grossCollectedILS,
      platformFeeGross: calc.platformFeeGross,
      vatOnPlatformFee: calc.vatOnPlatformFee,
      platformNetRevenue: calc.platformNetRevenue,
      providerGross: calc.providerGross,
      providerNet: calc.providerNet,
      commissionRate: calc.commissionRate,
      vatRate: ISRAELI_VAT_RATE,
      currency: "ILS",
      status: "completed",
      requiresProviderTaxInvoice: true,
      // Stage 2 withholding & Osek fields (populated when settlement is provided)
      withholdingTaxAmount: settlement?.withholdingTaxAmount,
      withholdingTaxRate: settlement?.withholdingTaxRate,
      netProviderPayout: settlement?.netPaymentToProvider,
      osekType: settlement?.osekType,
      commissionId: settlement?.commissionId,
      metadata,
    };

    try {
      const ledgerRef = this.firestore.collection("profit_loss_ledger").doc(entryId);
      await ledgerRef.set(entry);
    } catch (firestoreError: any) {
      logger.warn('[VATCalculator] Firestore write failed (non-critical)', {
        platform,
        transactionId,
        error: firestoreError.message,
      });
    }

    try {
      const receiptNumber = `PL-${entryId}`;
      const issuedAt = new Date();
      const auditHash = createHash('sha256').update(JSON.stringify({
        receiptNumber,
        grossCollectedILS: calc.grossCollectedILS,
        vatOnPlatformFee: calc.vatOnPlatformFee,
        platformFeeGross: calc.platformFeeGross,
        issuedAt: issuedAt.toISOString(),
        companyTaxId: '516788400',
      })).digest('hex');

      await db.insert(digitalReceipts).values({
        receiptNumber,
        receiptType: 'pl_ledger_entry',
        platform,
        bookingId: bookingId || transactionId,
        customerEmail: `platform-${platform}@internal`,
        customerName: `PetWash ${platform} Platform`,
        serviceDescription: `P&L ledger entry - ${platform} - Transaction ${transactionId}`,
        serviceDescriptionHe: `רשומת רווח והפסד - ${platform} - עסקה ${transactionId}`,
        subtotalAmount: calc.platformNetRevenue.toFixed(2),
        vatRate: (ISRAELI_VAT_RATE * 100).toFixed(2),
        vatAmount: calc.vatOnPlatformFee.toFixed(2),
        platformFeeAmount: calc.platformFeeGross.toFixed(2),
        totalAmount: calc.grossCollectedILS.toFixed(2),
        currency: 'ILS',
        providerPayoutAmount: settlement?.netPaymentToProvider?.toFixed(2) ?? calc.providerNet.toFixed(2),
        brokerCommissionAmount: calc.platformFeeGross.toFixed(2),
        paymentMethod: 'internal_ledger',
        paymentStatus: 'completed',
        companyName: 'Pet Wash Ltd',
        companyTaxId: '516788400',
        companyAddress: 'ישראל',
        auditHash,
        accountingRecorded: true,
        accountingEntryId: entryId,
        issuedAt,
      });
    } catch (pgError: any) {
      logger.error('[VATCalculator] PostgreSQL dual-save FAILED — legal compliance gap', {
        platform,
        transactionId,
        error: pgError.message,
      });
    }

    logger.info(
      `[VATCalculator] Marketplace TX recorded (from gross): ${platform} — ` +
      `gross ₪${calc.grossCollectedILS.toFixed(2)}, ` +
      `platform fee ₪${calc.platformFeeGross.toFixed(2)}, ` +
      `VAT obligation ₪${calc.vatOnPlatformFee.toFixed(2)}, ` +
      `provider net ₪${calc.providerNet.toFixed(2)}` +
      (settlement ? `, withholding ₪${settlement.withholdingTaxAmount.toFixed(2)} (${(settlement.withholdingTaxRate * 100).toFixed(0)}%), osek: ${settlement.osekType ?? 'unknown'}` : '')
    );

    return entry;
  }

  // ── K9000 direct-sale revenue recording ─────────────────────────────────────
  async recordK9000Transaction(params: {
    washId: string;
    machineId: string;
    transactionId?: string;
    chargeILS: number;
    washType: string;
    isFreeWash: boolean;
    customerUid?: string;
    stationId?: string;
  }): Promise<{ entryId: string; vatOwed: number; netRevenue: number }> {
    const calc = this.calculateDirectSaleVAT(params.chargeILS);

    const entryId = `K9-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const entry = {
      id: entryId,
      saleMode: 'direct',
      platform: 'k9000',
      washId: params.washId,
      machineId: params.machineId,
      transactionId: params.transactionId ?? null,
      date: new Date(),
      grossCollectedILS: calc.grossCollectedILS,
      vatOwed: calc.vatOwed,
      netRevenue: calc.netRevenue,
      providerShare: 0,
      vatRate: ISRAELI_VAT_RATE,
      washType: params.washType,
      isFreeWash: params.isFreeWash,
      customerUid: params.customerUid ?? null,
      stationId: params.stationId ?? null,
      currency: 'ILS',
      revenueOwner: 'petwash',
      requiresProviderTaxInvoice: false,
      status: params.isFreeWash ? 'free' : 'completed',
    };

    try {
      await this.firestore.collection('k9000_revenue_ledger').doc(entryId).set(entry);
      logger.info('[K9000 Revenue] Direct sale recorded', {
        entryId,
        grossCollectedILS: calc.grossCollectedILS,
        vatOwed: calc.vatOwed,
        netRevenue: calc.netRevenue,
        isFreeWash: params.isFreeWash,
      });
    } catch (err: any) {
      logger.error('[K9000 Revenue] Failed to record to Firestore', {
        entryId,
        error: err.message,
      });
    }

    return { entryId, vatOwed: calc.vatOwed, netRevenue: calc.netRevenue };
  }

  // ── P&L reports (unchanged) ─────────────────────────────────────────────────
  async getPlatformPL(
    platform: PLedgerEntry["platform"],
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRevenue: number;
    totalVAT: number;
    totalCommission: number;
    netProfit: number;
    transactionCount: number;
  }> {
    const snapshot = await this.firestore
      .collection("profit_loss_ledger")
      .where("platform", "==", platform)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .where("status", "==", "completed")
      .get();

    const entries = snapshot.docs.map((doc) => doc.data() as PLedgerEntry);

    return {
      totalRevenue: entries.reduce((s, e) => s + (e.grossCollectedILS ?? 0), 0),
      totalVAT: entries.reduce((s, e) => s + (e.vatOnPlatformFee ?? 0), 0),
      totalCommission: entries.reduce((s, e) => s + (e.platformFeeGross ?? 0), 0),
      netProfit: entries.reduce((s, e) => s + (e.platformNetRevenue ?? 0), 0),
      transactionCount: entries.length,
    };
  }

  async getConsolidatedPL(
    startDate: Date,
    endDate: Date
  ): Promise<{
    [platform: string]: { revenue: number; vat: number; commission: number; netProfit: number; transactions: number };
    total: { revenue: number; vat: number; commission: number; netProfit: number; transactions: number };
  }> {
    const platforms: PLedgerEntry["platform"][] = [
      "sitter-suite", "walk-my-pet", "pettrek",
      "pet-wash-hub", "paw-finder", "plush-lab", "enterprise",
    ];

    const results: any = { total: { revenue: 0, vat: 0, commission: 0, netProfit: 0, transactions: 0 } };

    await Promise.all(
      platforms.map(async (platform) => {
        const pl = await this.getPlatformPL(platform, startDate, endDate);
        results[platform] = {
          revenue: pl.totalRevenue,
          vat: pl.totalVAT,
          commission: pl.totalCommission,
          netProfit: pl.netProfit,
          transactions: pl.transactionCount,
        };
        results.total.revenue += pl.totalRevenue;
        results.total.vat += pl.totalVAT;
        results.total.commission += pl.totalCommission;
        results.total.netProfit += pl.netProfit;
        results.total.transactions += pl.transactionCount;
      })
    );

    return results;
  }

  async generateVATReport(month: number, year: number): Promise<{
    reportPeriod: string;
    totalVATCollected: number;
    totalCommission: number;
    platformBreakdown: any;
  }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const consolidated = await this.getConsolidatedPL(startDate, endDate);
    return {
      reportPeriod: `${month}/${year}`,
      totalVATCollected: consolidated.total.vat,
      totalCommission: consolidated.total.commission,
      platformBreakdown: consolidated,
    };
  }
}

export default new VATCalculatorService();
