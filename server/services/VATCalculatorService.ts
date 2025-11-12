/**
 * VAT Calculator Service for Israeli Tax Compliance
 * Israeli VAT Rate: 18% (effective January 1, 2025)
 * VAT applied ONLY to platform commission, NOT to base service rate
 */

import admin from "firebase-admin";

export const ISRAELI_VAT_RATE = 0.18;
export const PLATFORM_COMMISSION_RATE = 0.15;

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
  private db = admin.firestore();

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
    const vatCalc = this.calculateVAT(baseAmount);

    const ledgerRef = this.db.collection("profit_loss_ledger").doc();
    const entry: PLedgerEntry = {
      id: ledgerRef.id,
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

    await ledgerRef.set(entry);
    console.log(`[VATCalculator] Transaction recorded: ${platform} - ₪${vatCalc.totalCharged.toFixed(2)}`);
    
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
    const snapshot = await this.db
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
