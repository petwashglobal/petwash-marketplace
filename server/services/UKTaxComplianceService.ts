import { db } from '../db';
import {
  ukTaxFilings,
  type InsertUkTaxFiling,
} from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export class UKTaxComplianceService {
  async recordVATReturn(data: {
    entityId?: number;
    periodStart: string;
    periodEnd: string;
    outputVAT: number;
    inputVAT: number;
    netVAT: number;
    submissionDate: string;
    vrn: string;
    confirmationNumber?: string;
  }) {
    const filingData: InsertUkTaxFiling = {
      entityId: data.entityId,
      filingType: 'VAT',
      taxYear: new Date(data.periodEnd).getFullYear(),
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      taxAmount: data.netVAT.toString(),
      filingDate: new Date(data.submissionDate),
      confirmationNumber: data.confirmationNumber,
      vrn: data.vrn,
      filingStatus: 'filed',
    };

    const [filing] = await db
      .insert(ukTaxFilings)
      .values(filingData)
      .returning();

    return filing;
  }

  async recordCorporationTaxReturn(data: {
    entityId?: number;
    taxYear: number;
    accountingPeriodStart: string;
    accountingPeriodEnd: string;
    profit: number;
    corporationTax: number;
    submissionDate: string;
    utr: string;
    confirmationNumber?: string;
  }) {
    const filingData: InsertUkTaxFiling = {
      entityId: data.entityId,
      filingType: 'corporation_tax',
      taxYear: data.taxYear,
      periodStart: new Date(data.accountingPeriodStart),
      periodEnd: new Date(data.accountingPeriodEnd),
      taxAmount: data.corporationTax.toString(),
      filingDate: new Date(data.submissionDate),
      confirmationNumber: data.confirmationNumber,
      utr: data.utr,
      filingStatus: 'filed',
    };

    const [filing] = await db
      .insert(ukTaxFilings)
      .values(filingData)
      .returning();

    return filing;
  }

  async recordPAYESubmission(data: {
    entityId?: number;
    taxYear: number;
    taxMonth: number;
    incomeTax: number;
    nationalInsurance: number;
    submissionDate: string;
    confirmationNumber?: string;
  }) {
    const filingData: InsertUkTaxFiling = {
      entityId: data.entityId,
      filingType: 'PAYE',
      taxYear: data.taxYear,
      taxMonth: data.taxMonth,
      taxAmount: (data.incomeTax + data.nationalInsurance).toString(),
      filingDate: new Date(data.submissionDate),
      confirmationNumber: data.confirmationNumber,
      filingStatus: 'filed',
    };

    const [filing] = await db
      .insert(ukTaxFilings)
      .values(filingData)
      .returning();

    return filing;
  }

  getVATRate(type: 'standard' | 'reduced' | 'zero'): number {
    const rates = {
      standard: 20.0,
      reduced: 5.0,
      zero: 0.0,
    };
    return rates[type];
  }

  async checkVATRegistrationRequirement(annualTurnover: number): Promise<{
    required: boolean;
    threshold: number;
    message: string;
  }> {
    const threshold = 85000;

    if (annualTurnover >= threshold) {
      return {
        required: true,
        threshold,
        message: `VAT registration required. Annual turnover £${annualTurnover.toLocaleString()} exceeds threshold of £${threshold.toLocaleString()}`,
      };
    }

    return {
      required: false,
      threshold,
      message: `VAT registration optional. Annual turnover £${annualTurnover.toLocaleString()} below threshold of £${threshold.toLocaleString()}`,
    };
  }

  async calculateCorporationTax(data: {
    profit: number;
    taxYear: number;
  }): Promise<{
    taxableProfit: number;
    corporationTaxRate: number;
    corporationTax: number;
  }> {
    const smallProfitsRate = 19.0;
    const mainRate = 25.0;
    const lowerThreshold = 50000;
    const upperThreshold = 250000;

    let rate = smallProfitsRate;

    if (data.profit >= upperThreshold) {
      rate = mainRate;
    } else if (data.profit > lowerThreshold) {
      const marginalRelief = ((upperThreshold - data.profit) / (upperThreshold - lowerThreshold)) * 
        (mainRate - smallProfitsRate) * data.profit / 100;
      const taxAtMainRate = (data.profit * mainRate) / 100;
      return {
        taxableProfit: data.profit,
        corporationTaxRate: mainRate,
        corporationTax: Math.round((taxAtMainRate - marginalRelief) * 100) / 100,
      };
    }

    return {
      taxableProfit: data.profit,
      corporationTaxRate: rate,
      corporationTax: Math.round((data.profit * rate / 100) * 100) / 100,
    };
  }

  async calculateNationalInsurance(data: {
    grossEarnings: number;
    employmentType: 'employed' | 'self-employed';
  }): Promise<{
    employeeNI: number;
    employerNI: number;
    total: number;
  }> {
    const weeklyEarnings = data.grossEarnings / 52;

    const lowerEarningsLimit = 123;
    const primaryThreshold = 242;
    const secondaryThreshold = 175;
    const upperEarningsLimit = 967;

    let employeeNI = 0;
    let employerNI = 0;

    if (data.employmentType === 'employed') {
      if (weeklyEarnings > primaryThreshold) {
        const earningsAbovePrimary = Math.min(weeklyEarnings - primaryThreshold, upperEarningsLimit - primaryThreshold);
        employeeNI = earningsAbovePrimary * 0.12;

        if (weeklyEarnings > upperEarningsLimit) {
          employeeNI += (weeklyEarnings - upperEarningsLimit) * 0.02;
        }
      }

      if (weeklyEarnings > secondaryThreshold) {
        employerNI = (weeklyEarnings - secondaryThreshold) * 0.138;
      }
    } else {
      const annualLowerProfitLimit = 6725;
      const annualUpperProfitLimit = 50270;

      if (data.grossEarnings > annualLowerProfitLimit) {
        const earningsAboveLower = Math.min(data.grossEarnings - annualLowerProfitLimit, annualUpperProfitLimit - annualLowerProfitLimit);
        employeeNI = earningsAboveLower * 0.09;

        if (data.grossEarnings > annualUpperProfitLimit) {
          employeeNI += (data.grossEarnings - annualUpperProfitLimit) * 0.02;
        }
      }
    }

    const annualEmployeeNI = data.employmentType === 'employed' ? employeeNI * 52 : employeeNI;
    const annualEmployerNI = data.employmentType === 'employed' ? employerNI * 52 : 0;

    return {
      employeeNI: Math.round(annualEmployeeNI * 100) / 100,
      employerNI: Math.round(annualEmployerNI * 100) / 100,
      total: Math.round((annualEmployeeNI + annualEmployerNI) * 100) / 100,
    };
  }

  async validateUTR(utr: string): boolean {
    const utrRegex = /^\d{10}$/;
    return utrRegex.test(utr);
  }

  async validateVRN(vrn: string): boolean {
    const vrnRegex = /^(GB)?(\d{9}|\d{12})$/;
    return vrnRegex.test(vrn);
  }

  async getUpcomingDeadlines(): Promise<Array<{
    type: string;
    dueDate: string;
    description: string;
  }>> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const deadlines = [];

    const nextMonthDate = new Date(currentYear, currentMonth + 1, 0);
    const next7thOfMonth = new Date(currentYear, currentMonth + 1, 7);
    const next19thOfMonth = new Date(currentYear, currentMonth + 1, 19);

    deadlines.push({
      type: 'VAT',
      dueDate: next7thOfMonth.toISOString().split('T')[0],
      description: 'VAT Return - End of previous quarter + 7 days',
    });

    deadlines.push({
      type: 'PAYE',
      dueDate: next19thOfMonth.toISOString().split('T')[0],
      description: 'PAYE Payment - Monthly submission',
    });

    if (currentMonth >= 0 && currentMonth <= 3) {
      deadlines.push({
        type: 'Self-Assessment',
        dueDate: `${currentYear}-01-31`,
        description: `${currentYear - 1}/${currentYear} Self-Assessment Tax Return`,
      });
    }

    const accountingYearEnd = new Date(currentYear, 2, 31);
    const ctDeadline = new Date(accountingYearEnd);
    ctDeadline.setMonth(ctDeadline.getMonth() + 12);

    deadlines.push({
      type: 'Corporation Tax',
      dueDate: ctDeadline.toISOString().split('T')[0],
      description: 'Corporation Tax Payment - 9 months + 1 day after accounting period end',
    });

    return deadlines;
  }

  async checkMakingTaxDigitalCompliance(data: {
    annualTurnover: number;
    hasCompatibleSoftware: boolean;
  }): Promise<{
    compliant: boolean;
    required: boolean;
    message: string;
  }> {
    const mtdThreshold = 85000;

    if (data.annualTurnover < mtdThreshold) {
      return {
        compliant: true,
        required: false,
        message: 'Making Tax Digital not required - turnover below £85,000',
      };
    }

    if (!data.hasCompatibleSoftware) {
      return {
        compliant: false,
        required: true,
        message: 'Making Tax Digital REQUIRED. Must use MTD-compatible software for VAT submissions.',
      };
    }

    return {
      compliant: true,
      required: true,
      message: 'Making Tax Digital compliant - using MTD-compatible software',
    };
  }
}

export const ukTaxComplianceService = new UKTaxComplianceService();
