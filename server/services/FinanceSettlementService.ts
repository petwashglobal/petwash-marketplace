/**
 * Finance Settlement Service
 * Automated revenue sharing and settlement processing for partners
 * 
 * Features:
 * - Automated monthly settlement generation
 * - Revenue share calculation based on partner agreements
 * - CSV export for accounting systems
 * - Audit trail with SHA-256 hashing
 * - Partner dashboard with financial metrics
 */

import { db } from '../db';
import { 
  partners, 
  partnerAgreements, 
  settlements, 
  nayaxTransactions,
  washHistory,
  type Partner,
  type Settlement,
  type InsertSettlement
} from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import { ISRAEL_VAT_RATE } from "@shared/israel-compliance-config";

interface RevenueCalculationResult {
  grossRevenue: string;
  partnerShare: string;
  petwashShare: string;
  vatAmount: string;
  transactionCount: number;
  revenueSharePercent: string;
}

interface PartnerDashboardMetrics {
  partner: Partner;
  currentPeriod: {
    grossRevenue: string;
    partnerShare: string;
    status: string;
  };
  previousSettlements: Settlement[];
  totalLifetimeRevenue: string;
  totalLifetimePayments: string;
  pendingAmount: string;
}

export class FinanceSettlementService {
  /**
   * Generate a settlement for a partner within a specific period
   */
  static async generateSettlement(
    partnerId: number,
    periodStart: Date,
    periodEnd: Date,
    periodType: 'weekly' | 'monthly' | 'quarterly' = 'monthly'
  ): Promise<Settlement> {
    try {
      logger.info(`[FinanceSettlement] Generating settlement for partner ${partnerId}`, {
        periodStart,
        periodEnd,
        periodType,
      });

      // 1. Verify partner exists and is active
      const partner = await db.query.partners.findFirst({
        where: eq(partners.id, partnerId),
      });

      if (!partner) {
        throw new Error(`Partner ${partnerId} not found`);
      }

      if (!partner.isActive) {
        throw new Error(`Partner ${partnerId} is not active`);
      }

      // 2. Check if settlement already exists for this period
      const existingSettlement = await db.query.settlements.findFirst({
        where: and(
          eq(settlements.partnerId, partnerId),
          eq(settlements.periodStart, periodStart),
          eq(settlements.periodEnd, periodEnd)
        ),
      });

      if (existingSettlement) {
        logger.warn(`[FinanceSettlement] Settlement already exists for this period`, {
          settlementId: existingSettlement.id,
          settlementNumber: existingSettlement.settlementNumber,
        });
        return existingSettlement;
      }

      // 3. Calculate revenue share
      const revenueData = await this.calculateRevenueShare(partnerId, periodStart, periodEnd);

      // 4. Generate unique settlement number
      const settlementNumber = await this.generateSettlementNumber(periodStart);

      // 5. Calculate audit hash for immutability
      const auditHash = this.calculateAuditHash({
        partnerId,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        grossRevenue: revenueData.grossRevenue,
        partnerShare: revenueData.partnerShare,
        petwashShare: revenueData.petwashShare,
      });

      // 6. Create settlement record
      const [newSettlement] = await db.insert(settlements).values({
        settlementNumber,
        partnerId,
        periodType,
        periodStart,
        periodEnd,
        grossRevenue: revenueData.grossRevenue,
        partnerShare: revenueData.partnerShare,
        petwashShare: revenueData.petwashShare,
        vatAmount: revenueData.vatAmount,
        status: 'pending',
        auditHash,
      }).returning();

      logger.info(`[FinanceSettlement] Settlement created successfully`, {
        settlementId: newSettlement.id,
        settlementNumber: newSettlement.settlementNumber,
        partnerShare: revenueData.partnerShare,
      });

      return newSettlement;

    } catch (error) {
      logger.error(`[FinanceSettlement] Failed to generate settlement`, error);
      throw error;
    }
  }

  /**
   * Calculate revenue share for a partner based on transactions and agreements
   */
  static async calculateRevenueShare(
    partnerId: number,
    periodStart: Date,
    periodEnd: Date
  ): Promise<RevenueCalculationResult> {
    try {
      // 1. Get partner's active agreements
      const agreements = await db.query.partnerAgreements.findMany({
        where: and(
          eq(partnerAgreements.partnerId, partnerId),
          eq(partnerAgreements.isActive, true),
          lte(partnerAgreements.startDate, periodEnd)
        ),
      });

      if (agreements.length === 0) {
        logger.warn(`[FinanceSettlement] No active agreements found for partner ${partnerId}`);
        return {
          grossRevenue: '0.00',
          partnerShare: '0.00',
          petwashShare: '0.00',
          vatAmount: '0.00',
          transactionCount: 0,
          revenueSharePercent: '0.00',
        };
      }

      // 2. Get all transactions from partner stations during the period
      const stationIds = agreements
        .filter(a => a.stationId !== null)
        .map(a => a.stationId!);

      let grossRevenue = 0;
      let transactionCount = 0;

      // Fetch from nayaxTransactions
      if (stationIds.length > 0) {
        const nayaxResults = await db
          .select({
            totalAmount: sql<string>`COALESCE(SUM(CAST(${nayaxTransactions.amount} AS DECIMAL)), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(nayaxTransactions)
          .where(
            and(
              sql`${nayaxTransactions.stationId}::integer = ANY(${stationIds})`,
              gte(nayaxTransactions.createdAt, periodStart),
              lte(nayaxTransactions.createdAt, periodEnd),
              eq(nayaxTransactions.status, 'completed')
            )
          );

        if (nayaxResults[0]) {
          grossRevenue += parseFloat(nayaxResults[0].totalAmount || '0');
          transactionCount += nayaxResults[0].count || 0;
        }
      }

      // 3. Calculate partner share based on agreement percentage
      // Use the highest revenue share percent if multiple agreements exist
      const maxSharePercent = Math.max(
        ...agreements.map(a => parseFloat(a.revenueSharePercent || '0'))
      );

      const partnerShareAmount = grossRevenue * (maxSharePercent / 100);
      const petwashShareAmount = grossRevenue - partnerShareAmount;

      // 4. Calculate VAT (18% Israeli VAT on partner share - updated Jan 2025)
      const VAT_RATE = parseFloat(process.env.VAT_RATE || String(ISRAEL_VAT_RATE)); // Israeli VAT rate from environment
      const vatAmount = partnerShareAmount * VAT_RATE;

      return {
        grossRevenue: grossRevenue.toFixed(2),
        partnerShare: partnerShareAmount.toFixed(2),
        petwashShare: petwashShareAmount.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        transactionCount,
        revenueSharePercent: maxSharePercent.toFixed(2),
      };

    } catch (error) {
      logger.error(`[FinanceSettlement] Revenue calculation failed`, error);
      throw error;
    }
  }

  /**
   * Approve a settlement (finance team action)
   */
  static async approveSettlement(
    settlementId: number,
    userId: string
  ): Promise<Settlement> {
    try {
      const [updatedSettlement] = await db
        .update(settlements)
        .set({
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(settlements.id, settlementId))
        .returning();

      if (!updatedSettlement) {
        throw new Error(`Settlement ${settlementId} not found`);
      }

      logger.info(`[FinanceSettlement] Settlement approved`, {
        settlementId,
        approvedBy: userId,
      });

      return updatedSettlement;

    } catch (error) {
      logger.error(`[FinanceSettlement] Approval failed`, error);
      throw error;
    }
  }

  /**
   * Mark settlement as paid
   */
  static async markSettlementPaid(
    settlementId: number,
    paymentReference: string
  ): Promise<Settlement> {
    try {
      const [updatedSettlement] = await db
        .update(settlements)
        .set({
          status: 'paid',
          paidAt: new Date(),
          paymentReference,
          updatedAt: new Date(),
        })
        .where(eq(settlements.id, settlementId))
        .returning();

      if (!updatedSettlement) {
        throw new Error(`Settlement ${settlementId} not found`);
      }

      logger.info(`[FinanceSettlement] Settlement marked as paid`, {
        settlementId,
        paymentReference,
      });

      return updatedSettlement;

    } catch (error) {
      logger.error(`[FinanceSettlement] Payment marking failed`, error);
      throw error;
    }
  }

  /**
   * Export settlement to CSV format for accounting systems
   */
  static async exportSettlementToCSV(settlementId: number): Promise<string> {
    try {
      const settlement = await db.query.settlements.findFirst({
        where: eq(settlements.id, settlementId),
        with: {
          partner: true,
        },
      });

      if (!settlement) {
        throw new Error(`Settlement ${settlementId} not found`);
      }

      // CSV Header
      const headers = [
        'Settlement Number',
        'Partner Name',
        'Partner Type',
        'Period Start',
        'Period End',
        'Gross Revenue',
        'Partner Share',
        'PetWash Share',
        'VAT Amount',
        'Status',
        'Approved By',
        'Approved At',
        'Paid At',
        'Payment Reference',
      ];

      // CSV Data Row
      const row = [
        settlement.settlementNumber,
        settlement.partner?.name || 'N/A',
        settlement.partner?.type || 'N/A',
        settlement.periodStart.toISOString().split('T')[0],
        settlement.periodEnd.toISOString().split('T')[0],
        settlement.grossRevenue,
        settlement.partnerShare,
        settlement.petwashShare,
        settlement.vatAmount || '0.00',
        settlement.status,
        settlement.approvedBy || '',
        settlement.approvedAt?.toISOString().split('T')[0] || '',
        settlement.paidAt?.toISOString().split('T')[0] || '',
        settlement.paymentReference || '',
      ];

      const csv = [
        headers.join(','),
        row.map(cell => `"${cell}"`).join(','),
      ].join('\n');

      logger.info(`[FinanceSettlement] CSV export generated`, { settlementId });

      return csv;

    } catch (error) {
      logger.error(`[FinanceSettlement] CSV export failed`, error);
      throw error;
    }
  }

  /**
   * Get partner dashboard with financial metrics
   */
  static async getPartnerDashboard(partnerId: number): Promise<PartnerDashboardMetrics> {
    try {
      // 1. Get partner details
      const partner = await db.query.partners.findFirst({
        where: eq(partners.id, partnerId),
      });

      if (!partner) {
        throw new Error(`Partner ${partnerId} not found`);
      }

      // 2. Get current period (this month)
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const currentPeriodRevenue = await this.calculateRevenueShare(
        partnerId,
        periodStart,
        periodEnd
      );

      // 3. Get previous settlements (last 12 months)
      const previousSettlements = await db.query.settlements.findMany({
        where: eq(settlements.partnerId, partnerId),
        orderBy: desc(settlements.periodStart),
        limit: 12,
      });

      // 4. Calculate lifetime metrics
      const lifetimeMetrics = await db
        .select({
          totalRevenue: sql<string>`COALESCE(SUM(CAST(${settlements.partnerShare} AS DECIMAL)), 0)`,
          totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${settlements.status} = 'paid' THEN CAST(${settlements.partnerShare} AS DECIMAL) ELSE 0 END), 0)`,
          totalPending: sql<string>`COALESCE(SUM(CASE WHEN ${settlements.status} IN ('pending', 'approved') THEN CAST(${settlements.partnerShare} AS DECIMAL) ELSE 0 END), 0)`,
        })
        .from(settlements)
        .where(eq(settlements.partnerId, partnerId));

      return {
        partner,
        currentPeriod: {
          grossRevenue: currentPeriodRevenue.grossRevenue,
          partnerShare: currentPeriodRevenue.partnerShare,
          status: 'not_yet_settled',
        },
        previousSettlements,
        totalLifetimeRevenue: lifetimeMetrics[0]?.totalRevenue || '0.00',
        totalLifetimePayments: lifetimeMetrics[0]?.totalPaid || '0.00',
        pendingAmount: lifetimeMetrics[0]?.totalPending || '0.00',
      };

    } catch (error) {
      logger.error(`[FinanceSettlement] Dashboard retrieval failed`, error);
      throw error;
    }
  }

  /**
   * Generate unique settlement number (SETTLE-YYYY-XXX format)
   */
  private static async generateSettlementNumber(periodStart: Date): Promise<string> {
    const year = periodStart.getFullYear();
    const month = String(periodStart.getMonth() + 1).padStart(2, '0');

    // Count existing settlements for this period
    const existingCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(settlements)
      .where(sql`EXTRACT(YEAR FROM ${settlements.periodStart}) = ${year}`);

    const sequenceNumber = (existingCount[0]?.count || 0) + 1;
    const paddedSequence = String(sequenceNumber).padStart(3, '0');

    return `SETTLE-${year}-${month}-${paddedSequence}`;
  }

  /**
   * Calculate SHA-256 audit hash for settlement immutability
   */
  private static calculateAuditHash(data: Record<string, any>): string {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Verify settlement audit hash (for fraud detection)
   */
  static verifySettlementIntegrity(settlement: Settlement): boolean {
    const calculatedHash = this.calculateAuditHash({
      partnerId: settlement.partnerId,
      periodStart: settlement.periodStart.toISOString(),
      periodEnd: settlement.periodEnd.toISOString(),
      grossRevenue: settlement.grossRevenue,
      partnerShare: settlement.partnerShare,
      petwashShare: settlement.petwashShare,
    });

    return calculatedHash === settlement.auditHash;
  }
}
