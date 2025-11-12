import { db } from '../db';
import {
  australianTaxFilings,
  type InsertAustralianTaxFiling,
} from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export class AustralianTaxComplianceService {
  async recordBASStatement(data: {
    entityId?: number;
    periodStart: string;
    periodEnd: string;
    gstCollected: number;
    gstPaid: number;
    netGST: number;
    paygWithholding: number;
    submissionDate: string;
    abn: string;
    confirmationNumber?: string;
  }) {
    const filingData: InsertAustralianTaxFiling = {
      entityId: data.entityId,
      filingType: 'BAS',
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      taxAmount: data.netGST.toString(),
      filingDate: new Date(data.submissionDate),
      confirmationNumber: data.confirmationNumber,
      abn: data.abn,
      filingStatus: 'filed',
    };

    const [filing] = await db
      .insert(australianTaxFilings)
      .values(filingData)
      .returning();

    return filing;
  }

  async recordSuperannuationContribution(data: {
    entityId?: number;
    quarter: number;
    taxYear: number;
    totalContributions: number;
    paymentDate: string;
    confirmationNumber?: string;
  }) {
    const filingData: InsertAustralianTaxFiling = {
      entityId: data.entityId,
      filingType: 'superannuation',
      taxYear: data.taxYear,
      quarter: data.quarter,
      taxAmount: data.totalContributions.toString(),
      filingDate: new Date(data.paymentDate),
      confirmationNumber: data.confirmationNumber,
      filingStatus: 'filed',
    };

    const [filing] = await db
      .insert(australianTaxFilings)
      .values(filingData)
      .returning();

    return filing;
  }

  async recordPaygWithholding(data: {
    entityId?: number;
    periodStart: string;
    periodEnd: string;
    totalWithheld: number;
    paymentDate: string;
    confirmationNumber?: string;
  }) {
    const filingData: InsertAustralianTaxFiling = {
      entityId: data.entityId,
      filingType: 'PAYG',
      periodStart: new Date(data.periodStart),
      periodEnd: new Date(data.periodEnd),
      taxAmount: data.totalWithheld.toString(),
      filingDate: new Date(data.paymentDate),
      confirmationNumber: data.confirmationNumber,
      filingStatus: 'filed',
    };

    const [filing] = await db
      .insert(australianTaxFilings)
      .values(filingData)
      .returning();

    return filing;
  }

  getGSTRate(): number {
    return 10.0;
  }

  async checkGSTRegistrationRequirement(annualTurnover: number): Promise<{
    required: boolean;
    threshold: number;
    message: string;
  }> {
    const threshold = 75000;

    if (annualTurnover >= threshold) {
      return {
        required: true,
        threshold,
        message: `GST registration required. Annual turnover AUD $${annualTurnover.toLocaleString()} exceeds threshold of AUD $${threshold.toLocaleString()}`,
      };
    }

    return {
      required: false,
      threshold,
      message: `GST registration optional. Annual turnover AUD $${annualTurnover.toLocaleString()} below threshold of AUD $${threshold.toLocaleString()}`,
    };
  }

  async calculateSuperannuation(data: {
    grossWages: number;
    superRate?: number;
  }): Promise<{
    superannuationRate: number;
    superannuationAmount: number;
    minimumQuarterlyThreshold: number;
    aboveThreshold: boolean;
  }> {
    const currentSuperRate = data.superRate || 11.0;
    const minimumQuarterlyThreshold = 450;

    const quarterlyWages = data.grossWages / 4;
    const superannuationAmount = (data.grossWages * currentSuperRate) / 100;

    return {
      superannuationRate: currentSuperRate,
      superannuationAmount: Math.round(superannuationAmount * 100) / 100,
      minimumQuarterlyThreshold,
      aboveThreshold: quarterlyWages >= minimumQuarterlyThreshold,
    };
  }

  async calculatePaygWithholding(data: {
    grossWages: number;
    payPeriod: 'weekly' | 'fortnightly' | 'monthly';
    claimsTaxFreeThreshold: boolean;
  }): Promise<{
    taxWithheld: number;
    taxFreeThreshold: number;
    effectiveRate: number;
  }> {
    const taxFreeThreshold = data.claimsTaxFreeThreshold ? 18200 : 0;

    const annualIncome = data.grossWages;
    let tax = 0;

    if (annualIncome <= 18200) {
      tax = 0;
    } else if (annualIncome <= 45000) {
      tax = (annualIncome - 18200) * 0.19;
    } else if (annualIncome <= 120000) {
      tax = 5092 + (annualIncome - 45000) * 0.325;
    } else if (annualIncome <= 180000) {
      tax = 29467 + (annualIncome - 120000) * 0.37;
    } else {
      tax = 51667 + (annualIncome - 180000) * 0.45;
    }

    const effectiveRate = annualIncome > 0 ? (tax / annualIncome) * 100 : 0;

    return {
      taxWithheld: Math.round(tax * 100) / 100,
      taxFreeThreshold,
      effectiveRate: Math.round(effectiveRate * 100) / 100,
    };
  }

  async validateABN(abn: string): boolean {
    const abnClean = abn.replace(/\s/g, '');
    const abnRegex = /^\d{11}$/;

    if (!abnRegex.test(abnClean)) {
      return false;
    }

    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const digits = abnClean.split('').map(Number);
    digits[0] -= 1;

    const sum = digits.reduce((acc, digit, index) => acc + digit * weights[index], 0);

    return sum % 89 === 0;
  }

  async validateTFN(tfn: string): boolean {
    const tfnClean = tfn.replace(/\s/g, '');
    const tfnRegex = /^\d{9}$/;
    return tfnRegex.test(tfnClean);
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

    const currentQuarter = Math.floor(currentMonth / 3) + 1;
    const quarterEndMonth = currentQuarter * 3 - 1;

    const basDeadline = new Date(currentYear, quarterEndMonth + 1, 28);
    deadlines.push({
      type: 'BAS',
      dueDate: basDeadline.toISOString().split('T')[0],
      description: `Q${currentQuarter} ${currentYear} Business Activity Statement`,
    });

    const superDeadline = new Date(currentYear, quarterEndMonth + 1, 28);
    deadlines.push({
      type: 'Superannuation',
      dueDate: superDeadline.toISOString().split('T')[0],
      description: `Q${currentQuarter} ${currentYear} Superannuation Guarantee Charge`,
    });

    if (currentMonth >= 6 && currentMonth <= 9) {
      deadlines.push({
        type: 'Tax Return',
        dueDate: `${currentYear}-10-31`,
        description: `${currentYear - 1}/${currentYear} Individual Tax Return`,
      });

      deadlines.push({
        type: 'Company Tax',
        dueDate: `${currentYear + 1}-02-28`,
        description: `${currentYear - 1}/${currentYear} Company Tax Return`,
      });
    }

    deadlines.push({
      type: 'PAYG',
      dueDate: new Date(currentYear, currentMonth + 1, 21).toISOString().split('T')[0],
      description: 'PAYG Withholding Payment',
    });

    return deadlines;
  }

  async checkSingleTouchPayrollCompliance(data: {
    numberOfEmployees: number;
    hasSTPSoftware: boolean;
  }): Promise<{
    compliant: boolean;
    required: boolean;
    message: string;
  }> {
    if (data.numberOfEmployees === 0) {
      return {
        compliant: true,
        required: false,
        message: 'Single Touch Payroll not required - no employees',
      };
    }

    if (!data.hasSTPSoftware) {
      return {
        compliant: false,
        required: true,
        message: 'Single Touch Payroll REQUIRED. Must use STP-enabled payroll software.',
      };
    }

    return {
      compliant: true,
      required: true,
      message: 'Single Touch Payroll compliant - using STP-enabled software',
    };
  }
}

export const australianTaxComplianceService = new AustralianTaxComplianceService();
