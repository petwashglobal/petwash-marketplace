import { db } from "../db";
import { taxRateHistory, type TaxRateHistory } from "../../shared/schema";
import { eq, and, lte, gte, isNull, or, desc } from "drizzle-orm";

export interface ActiveTaxRate {
  taxType: string;
  rate: number;
  ratePercent: number;
  category: string | null;
  description: string | null;
  descriptionHe: string | null;
  effectiveFrom: string;
}

export class TaxRateService {
  async getCurrentTaxRates(asOfDate?: Date): Promise<ActiveTaxRate[]> {
    const queryDate = asOfDate || new Date();
    const queryDateStr = queryDate.toISOString().split('T')[0];

    const rates = await db
      .select()
      .from(taxRateHistory)
      .where(
        and(
          eq(taxRateHistory.isActive, true),
          lte(taxRateHistory.effectiveFrom, queryDateStr),
          or(
            isNull(taxRateHistory.effectiveTo),
            gte(taxRateHistory.effectiveTo, queryDateStr)
          )
        )
      )
      .orderBy(desc(taxRateHistory.effectiveFrom));

    return rates.map(rate => ({
      taxType: rate.taxType,
      rate: parseFloat(rate.rate),
      ratePercent: parseFloat(rate.ratePercent),
      category: rate.category,
      description: rate.description,
      descriptionHe: rate.descriptionHe,
      effectiveFrom: rate.effectiveFrom,
    }));
  }

  async getCurrentVATRate(category: string = 'standard', asOfDate?: Date): Promise<number> {
    const queryDate = asOfDate || new Date();
    const queryDateStr = queryDate.toISOString().split('T')[0];

    const rates = await db
      .select()
      .from(taxRateHistory)
      .where(
        and(
          eq(taxRateHistory.taxType, 'vat'),
          eq(taxRateHistory.category, category),
          eq(taxRateHistory.isActive, true),
          lte(taxRateHistory.effectiveFrom, queryDateStr),
          or(
            isNull(taxRateHistory.effectiveTo),
            gte(taxRateHistory.effectiveTo, queryDateStr)
          )
        )
      )
      .orderBy(desc(taxRateHistory.effectiveFrom))
      .limit(1);

    if (rates.length === 0) {
      throw new Error(`CRITICAL: No VAT rate configured for category "${category}". Please configure tax rates in database before processing expenses.`);
    }

    return parseFloat(rates[0].rate);
  }

  async getVATRateByExpenseCategory(expenseCategory: string, asOfDate?: Date): Promise<{
    rate: number;
    exemptionReason: string | null;
    category: string;
  }> {
    const vatCategoryMap: Record<string, string> = {
      'flight': 'exempt',
      'international_travel': 'zero_rate',
      'export': 'zero_rate',
      'education': 'exempt',
      'health': 'exempt',
      'meals': 'standard',
      'office_supplies': 'standard',
      'entertainment': 'standard',
      'accommodation': 'standard',
      'training': 'standard',
      'mileage': 'exempt',
      'other': 'standard',
    };

    const vatCategory = vatCategoryMap[expenseCategory.toLowerCase()] || 'standard';
    const rate = await this.getCurrentVATRate(vatCategory, asOfDate);

    let exemptionReason = null;
    if (rate === 0 || vatCategory === 'exempt' || vatCategory === 'zero_rate') {
      exemptionReason = `${vatCategory}_${expenseCategory}`;
    }

    return {
      rate,
      exemptionReason,
      category: vatCategory,
    };
  }

  calculateVATAmounts(grossAmount: number, vatRate: number): {
    netAmount: number;
    vatAmount: number;
  } {
    if (grossAmount <= 0 || vatRate < 0) {
      return { netAmount: 0, vatAmount: 0 };
    }

    if (vatRate === 0) {
      return { netAmount: grossAmount, vatAmount: 0 };
    }

    const netAmount = grossAmount / (1 + vatRate);
    const vatAmount = grossAmount - netAmount;

    return {
      netAmount: parseFloat(netAmount.toFixed(2)),
      vatAmount: parseFloat(vatAmount.toFixed(2)),
    };
  }

  async seedInitialTaxRates(): Promise<void> {
    const existingRates = await db.select().from(taxRateHistory).limit(1);
    
    if (existingRates.length > 0) {
      console.log('Tax rates already seeded, skipping...');
      return;
    }

    const initialRates = [
      {
        taxType: 'vat',
        rate: '0.1800',
        ratePercent: '18.00',
        category: 'standard',
        description: 'Standard Israeli VAT Rate',
        descriptionHe: 'שיעור מע"מ רגיל בישראל',
        effectiveFrom: '2015-01-01',
        effectiveTo: null,
        regulatorySource: 'Israeli Tax Authority',
        regulatoryUrl: 'https://taxes.gov.il',
        isActive: true,
        createdBy: 'system',
      },
      {
        taxType: 'vat',
        rate: '0.0000',
        ratePercent: '0.00',
        category: 'zero_rate',
        description: 'Zero-rated VAT (Exports, International Services)',
        descriptionHe: 'מע"מ אפס (יצוא, שירותים בינלאומיים)',
        effectiveFrom: '2015-01-01',
        effectiveTo: null,
        regulatorySource: 'Israeli Tax Authority - VAT Law Section 30',
        regulatoryUrl: 'https://taxes.gov.il',
        isActive: true,
        createdBy: 'system',
      },
      {
        taxType: 'vat',
        rate: '0.0000',
        ratePercent: '0.00',
        category: 'exempt',
        description: 'VAT Exempt (Education, Health, Financial Services)',
        descriptionHe: 'פטור ממע"מ (חינוך, בריאות, שירותים פיננסיים)',
        effectiveFrom: '2015-01-01',
        effectiveTo: null,
        regulatorySource: 'Israeli Tax Authority - VAT Law Section 31',
        regulatoryUrl: 'https://taxes.gov.il',
        isActive: true,
        createdBy: 'system',
      },
      {
        taxType: 'municipal',
        rate: '0.1800',
        ratePercent: '18.00',
        category: 'standard',
        description: 'Municipal Tax Rate (Example)',
        descriptionHe: 'שיעור ארנונה (דוגמה)',
        effectiveFrom: '2025-01-01',
        effectiveTo: null,
        regulatorySource: 'Municipality Directive',
        regulatoryUrl: null,
        isActive: true,
        createdBy: 'system',
      },
    ];

    await db.insert(taxRateHistory).values(initialRates);
    console.log(`✅ Seeded ${initialRates.length} initial tax rates`);
  }
}

export const taxRateService = new TaxRateService();
