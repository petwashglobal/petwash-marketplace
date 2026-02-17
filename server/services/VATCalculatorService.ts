/**
 * VAT Calculator Service for Israeli Tax Compliance
 * Israeli VAT Rate: 18% (effective January 1, 2025)
 * 
 * FLAT 15% commission on ALL third-party providers across ALL platforms.
 * This matches MadPaws (Australia) and industry standard marketplace commission.
 * 
 * Fee Model (all platforms):
 * - Provider sets base rate
 * - Customer pays: Base + 15% platform fee + 18% VAT on platform fee
 * - Provider receives: 85% of base (after 15% commission deduction)
 * - Platform keeps: 15% commission + VAT collected
 * 
 * Dual-save: Records to both Firestore (real-time) and PostgreSQL (legal compliance)
 */

import admin from "../lib/firebase-admin";
import { db } from '../db';
import { digitalReceipts } from '@shared/schema';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

export const ISRAELI_VAT_RATE = 0.18;
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

export interface VATCalculation {
  baseAmount: number;
  commission: number;
  vatOnCommission: number;
  totalCharged: number;
  vatRate: number;
  commissionRate: number;
  netToProvider: number;
  netToPlatform: number;
}

export interface PLedgerEntry {
  id: string;
  platform: "sitter-suite" | "walk-my-pet" | "pettrek" | "pet-wash-hub" | "paw-finder" | "plush-lab" | "enterprise";
  transactionId: string;
  bookingId?: string;
  date: Date;
  baseAmount: number;
  commission: number;
  vat: number;
  totalRevenue: number;
  netToProvider: number;
  netToPlatform: number;
  currency: "ILS" | "USD" | "EUR" | "GBP";
  status: "pending" | "completed" | "refunded";
  metadata?: any;
}

class VATCalculatorService {
  private firestore = admin.firestore();

  getCommissionRate(platform: string): number {
    return PLATFORM_COMMISSION_RATES[platform] || PLATFORM_COMMISSION_RATE;
  }

  calculateVAT(baseAmount: number, commissionRate: number = PLATFORM_COMMISSION_RATE): VATCalculation {
    const commission = baseAmount * commissionRate;
    const vatOnCommission = commission * ISRAELI_VAT_RATE;
    const totalCharged = baseAmount + commission + vatOnCommission;
    const netToProvider = baseAmount;
    const netToPlatform = commission + vatOnCommission;

    return {
      baseAmount,
      commission,
      vatOnCommission,
      totalCharged,
      vatRate: ISRAELI_VAT_RATE,
      commissionRate,
      netToProvider,
      netToPlatform,
    };
  }

  async recordTransaction(
    platform: PLedgerEntry["platform"],
    transactionId: string,
    baseAmount: number,
    bookingId?: string,
    metadata?: any
  ): Promise<PLedgerEntry> {
    const platformRate = this.getCommissionRate(platform);
    const vatCalc = this.calculateVAT(baseAmount, platformRate);

    const entryId = `PL-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const entry: PLedgerEntry = {
      id: entryId,
      platform,
      transactionId,
      bookingId,
      date: new Date(),
      baseAmount: vatCalc.baseAmount,
      commission: vatCalc.commission,
      vat: vatCalc.vatOnCommission,
      totalRevenue: vatCalc.totalCharged,
      netToProvider: vatCalc.netToProvider,
      netToPlatform: vatCalc.netToPlatform,
      currency: "ILS",
      status: "completed",
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
        totalAmount: vatCalc.totalCharged,
        vatAmount: vatCalc.vatOnCommission,
        customerEmail: `platform-${platform}@internal`,
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
        subtotalAmount: vatCalc.baseAmount.toFixed(2),
        vatRate: (ISRAELI_VAT_RATE * 100).toFixed(2),
        vatAmount: vatCalc.vatOnCommission.toFixed(2),
        platformFeeAmount: vatCalc.commission.toFixed(2),
        totalAmount: vatCalc.totalCharged.toFixed(2),
        currency: 'ILS',
        providerPayoutAmount: vatCalc.netToProvider.toFixed(2),
        brokerCommissionAmount: vatCalc.commission.toFixed(2),
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
      logger.error('[VATCalculator] PostgreSQL dual-save FAILED - legal compliance gap', {
        platform,
        transactionId,
        error: pgError.message,
      });
    }

    logger.info(`[VATCalculator] Transaction recorded: ${platform} - ₪${vatCalc.totalCharged.toFixed(2)} (rate: ${(platformRate * 100).toFixed(1)}%)`);
    
    return entry;
  }

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

    const totalRevenue = entries.reduce((sum, e) => sum + e.totalRevenue, 0);
    const totalVAT = entries.reduce((sum, e) => sum + e.vat, 0);
    const totalCommission = entries.reduce((sum, e) => sum + e.commission, 0);
    const netProfit = entries.reduce((sum, e) => sum + e.netToPlatform, 0);

    return {
      totalRevenue,
      totalVAT,
      totalCommission,
      netProfit,
      transactionCount: entries.length,
    };
  }

  async getConsolidatedPL(
    startDate: Date,
    endDate: Date
  ): Promise<{
    [platform: string]: {
      revenue: number;
      vat: number;
      commission: number;
      netProfit: number;
      transactions: number;
    };
    total: {
      revenue: number;
      vat: number;
      commission: number;
      netProfit: number;
      transactions: number;
    };
  }> {
    const platforms: PLedgerEntry["platform"][] = [
      "sitter-suite",
      "walk-my-pet",
      "pettrek",
      "pet-wash-hub",
      "paw-finder",
      "plush-lab",
      "enterprise",
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
