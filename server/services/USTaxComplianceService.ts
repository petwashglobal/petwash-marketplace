import { db } from '../db';
import {
  usFederalTaxFilings,
  usStateTaxFilings,
  usStateNexus,
  type InsertUsFederalTaxFiling,
  type InsertUsStateTaxFiling,
  type InsertUsStateNexus,
} from '@shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export class USTaxComplianceService {
  async trackStateNexus(data: {
    state: string;
    nexusType: 'physical' | 'economic' | 'marketplace' | 'affiliate';
    establishedDate: string;
    salesThreshold?: number;
    transactionThreshold?: number;
    registrationNumber?: string;
  }) {
    const nexusData: InsertUsStateNexus = {
      state: data.state,
      nexusType: data.nexusType,
      establishedDate: new Date(data.establishedDate),
      salesThreshold: data.salesThreshold?.toString(),
      transactionThreshold: data.transactionThreshold,
      registrationNumber: data.registrationNumber,
      isActive: true,
    };

    const [nexus] = await db
      .insert(usStateNexus)
      .values(nexusData)
      .onConflictDoUpdate({
        target: [usStateNexus.state, usStateNexus.nexusType],
        set: nexusData,
      })
      .returning();

    return nexus;
  }

  async recordFederalTaxFiling(data: {
    entityId?: number;
    filingType: '941' | '940' | '1120' | '1065' | '1099' | 'W2';
    taxYear: number;
    quarter?: number;
    taxAmount: number;
    withholdingAmount?: number;
    filingDate: string;
    confirmationNumber?: string;
  }) {
    const filingData: InsertUsFederalTaxFiling = {
      entityId: data.entityId,
      filingType: data.filingType,
      taxYear: data.taxYear,
      quarter: data.quarter,
      taxAmount: data.taxAmount.toString(),
      withholdingAmount: data.withholdingAmount?.toString(),
      filingDate: new Date(data.filingDate),
      confirmationNumber: data.confirmationNumber,
      filingStatus: 'filed',
    };

    const [filing] = await db
      .insert(usFederalTaxFilings)
      .values(filingData)
      .returning();

    return filing;
  }

  async recordStateTaxFiling(data: {
    entityId?: number;
    state: string;
    filingType: 'income' | 'sales' | 'unemployment' | 'withholding';
    taxYear: number;
    quarter?: number;
    taxAmount: number;
    filingDate: string;
    confirmationNumber?: string;
  }) {
    const filingData: InsertUsStateTaxFiling = {
      entityId: data.entityId,
      state: data.state,
      filingType: data.filingType,
      taxYear: data.taxYear,
      quarter: data.quarter,
      taxAmount: data.taxAmount.toString(),
      filingDate: new Date(data.filingDate),
      confirmationNumber: data.confirmationNumber,
      filingStatus: 'filed',
    };

    const [filing] = await db
      .insert(usStateTaxFilings)
      .values(filingData)
      .returning();

    return filing;
  }

  async getUpcomingDeadlines(entityId?: number): Promise<{
    federal: Array<{ type: string; dueDate: string; description: string }>;
    state: Array<{ state: string; type: string; dueDate: string; description: string }>;
  }> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor((now.getMonth() + 3) / 3);

    const federal = [];
    const state = [];

    const lastDayOfMonth = (month: number) => {
      return new Date(currentYear, month + 1, 0).toISOString().split('T')[0];
    };

    const quarterEndMonth = currentQuarter * 3 - 1;
    const nextQuarterMonth = quarterEndMonth + 1;

    federal.push({
      type: '941',
      dueDate: lastDayOfMonth(nextQuarterMonth),
      description: `Q${currentQuarter} ${currentYear} Form 941 (Quarterly Federal Tax Return)`,
    });

    federal.push({
      type: '940',
      dueDate: `${currentYear + 1}-01-31`,
      description: `${currentYear} Form 940 (Annual Federal Unemployment Tax)`,
    });

    federal.push({
      type: '1099',
      dueDate: `${currentYear + 1}-01-31`,
      description: `${currentYear} Form 1099-NEC (Contractor payments)`,
    });

    federal.push({
      type: 'W2',
      dueDate: `${currentYear + 1}-01-31`,
      description: `${currentYear} Form W-2 (Employee wages)`,
    });

    const activeNexus = await db
      .select()
      .from(usStateNexus)
      .where(eq(usStateNexus.isActive, true));

    for (const nexus of activeNexus) {
      state.push({
        state: nexus.state,
        type: 'sales',
        dueDate: lastDayOfMonth(now.getMonth()),
        description: `${nexus.state} Sales Tax Return`,
      });

      state.push({
        state: nexus.state,
        type: 'withholding',
        dueDate: lastDayOfMonth(nextQuarterMonth),
        description: `${nexus.state} Q${currentQuarter} Withholding Tax`,
      });
    }

    return { federal, state };
  }

  async calculateQuarterlyTaxLiability(quarter: number, year: number): Promise<{
    federalIncome: number;
    federalUnemployment: number;
    socialSecurityMedicare: number;
    stateTax: number;
  }> {
    return {
      federalIncome: 0,
      federalUnemployment: 0,
      socialSecurityMedicare: 0,
      stateTax: 0,
    };
  }

  async validateEIN(ein: string): boolean {
    const einRegex = /^\d{2}-\d{7}$/;
    return einRegex.test(ein);
  }

  async getStateSalesTaxRate(state: string): Promise<number> {
    const stateTaxRates: Record<string, number> = {
      CA: 7.25,
      TX: 6.25,
      FL: 6.0,
      NY: 4.0,
      IL: 6.25,
      PA: 6.0,
      OH: 5.75,
      GA: 4.0,
      NC: 4.75,
      MI: 6.0,
    };

    return stateTaxRates[state] || 0;
  }

  async checkNexusRequirement(data: {
    state: string;
    annualRevenue: number;
    transactionCount: number;
  }): Promise<{
    hasNexus: boolean;
    reason: string;
    threshold: string;
  }> {
    const economicNexusThresholds: Record<string, { revenue: number; transactions: number }> = {
      CA: { revenue: 500000, transactions: 0 },
      TX: { revenue: 500000, transactions: 0 },
      FL: { revenue: 100000, transactions: 0 },
      NY: { revenue: 500000, transactions: 100 },
      IL: { revenue: 100000, transactions: 200 },
      PA: { revenue: 100000, transactions: 0 },
    };

    const threshold = economicNexusThresholds[data.state];

    if (!threshold) {
      return {
        hasNexus: false,
        reason: 'No economic nexus threshold defined',
        threshold: 'N/A',
      };
    }

    const revenueExceeded = data.annualRevenue >= threshold.revenue;
    const transactionsExceeded = threshold.transactions > 0 && data.transactionCount >= threshold.transactions;

    if (revenueExceeded || transactionsExceeded) {
      return {
        hasNexus: true,
        reason: revenueExceeded
          ? `Annual revenue $${data.annualRevenue.toLocaleString()} exceeds threshold $${threshold.revenue.toLocaleString()}`
          : `Transaction count ${data.transactionCount} exceeds threshold ${threshold.transactions}`,
        threshold: `$${threshold.revenue.toLocaleString()} revenue OR ${threshold.transactions} transactions`,
      };
    }

    return {
      hasNexus: false,
      reason: 'Below economic nexus thresholds',
      threshold: `$${threshold.revenue.toLocaleString()} revenue OR ${threshold.transactions} transactions`,
    };
  }
}

export const usTaxComplianceService = new USTaxComplianceService();
