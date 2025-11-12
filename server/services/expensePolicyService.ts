import { taxRateService } from "./taxRateService";
import type { Expense } from "../../shared/schema";

export interface PolicyViolation {
  id: string;
  ruleCode: string;
  messageHE: string;
  messageEN: string;
  isCritical: boolean;
  severity: 'info' | 'warning' | 'error';
}

export interface PolicyLimits {
  maxMealAllowanceILS: number;
  maxAccommodationPerNightILS: number;
  maxEntertainmentPerMonthILS: number;
  mileageRatePerKm: number;
  forbiddenVendors: string[];
  requireReceiptAboveILS: number;
}

const DEFAULT_POLICY_LIMITS: PolicyLimits = {
  maxMealAllowanceILS: 100,
  maxAccommodationPerNightILS: 800,
  maxEntertainmentPerMonthILS: 2000,
  mileageRatePerKm: 1.80,
  forbiddenVendors: ['casino', 'betting', 'lottery', 'גן עדן', 'בית הימורים'],
  requireReceiptAboveILS: 50,
};

export class ExpensePolicyService {
  private policyLimits: PolicyLimits;

  constructor(customLimits?: Partial<PolicyLimits>) {
    this.policyLimits = { ...DEFAULT_POLICY_LIMITS, ...customLimits };
  }

  async validateExpense(expense: Partial<Expense>): Promise<{
    isValid: boolean;
    violations: PolicyViolation[];
    policyStatus: 'compliant' | 'warning' | 'violation';
  }> {
    const violations: PolicyViolation[] = [];

    await this.checkAmountLimits(expense, violations);
    await this.checkVATCompliance(expense, violations);
    await this.checkForbiddenVendors(expense, violations);
    await this.checkReceiptRequirements(expense, violations);
    await this.checkMileageCompliance(expense, violations);

    const hasCritical = violations.some(v => v.isCritical);
    const hasWarnings = violations.some(v => v.severity === 'warning');

    return {
      isValid: !hasCritical,
      violations,
      policyStatus: hasCritical ? 'violation' : hasWarnings ? 'warning' : 'compliant',
    };
  }

  private async checkAmountLimits(
    expense: Partial<Expense>,
    violations: PolicyViolation[]
  ): Promise<void> {
    const category = expense.category?.toLowerCase();
    const amount = parseFloat(expense.totalAmountILS?.toString() || '0');

    if (category === 'meals' && amount > this.policyLimits.maxMealAllowanceILS) {
      violations.push({
        id: `meal_limit_${Date.now()}`,
        ruleCode: 'MAX_MEAL_AMOUNT',
        messageHE: `הוצאת ארוחה חורגת מהמגבלה של ₪${this.policyLimits.maxMealAllowanceILS}`,
        messageEN: `Meal expense exceeds limit of ₪${this.policyLimits.maxMealAllowanceILS}`,
        isCritical: false,
        severity: 'warning',
      });
    }

    if (category === 'accommodation' && amount > this.policyLimits.maxAccommodationPerNightILS) {
      violations.push({
        id: `accommodation_limit_${Date.now()}`,
        ruleCode: 'MAX_ACCOMMODATION_AMOUNT',
        messageHE: `הוצאת לינה חורגת מהמגבלה של ₪${this.policyLimits.maxAccommodationPerNightILS} ללילה`,
        messageEN: `Accommodation expense exceeds limit of ₪${this.policyLimits.maxAccommodationPerNightILS} per night`,
        isCritical: false,
        severity: 'warning',
      });
    }

    if (category === 'entertainment' && amount > this.policyLimits.maxEntertainmentPerMonthILS) {
      violations.push({
        id: `entertainment_limit_${Date.now()}`,
        ruleCode: 'MAX_ENTERTAINMENT_AMOUNT',
        messageHE: `הוצאת בידור/אירוח חורגת מהמגבלה החודשית של ₪${this.policyLimits.maxEntertainmentPerMonthILS}`,
        messageEN: `Entertainment expense exceeds monthly limit of ₪${this.policyLimits.maxEntertainmentPerMonthILS}`,
        isCritical: false,
        severity: 'warning',
      });
    }
  }

  private async checkVATCompliance(
    expense: Partial<Expense>,
    violations: PolicyViolation[]
  ): Promise<void> {
    if (!expense.category || !expense.vatRateApplied || !expense.expenseDate) {
      return;
    }

    const expenseDate = new Date(expense.expenseDate);
    const expectedVAT = await taxRateService.getVATRateByExpenseCategory(
      expense.category,
      expenseDate
    );

    const appliedRate = parseFloat(expense.vatRateApplied.toString());
    const expectedRate = expectedVAT.rate;

    const rateDifference = Math.abs(appliedRate - expectedRate);
    
    if (rateDifference > 0.001) {
      const isCritical = rateDifference > 0.01;
      
      violations.push({
        id: `vat_mismatch_${Date.now()}`,
        ruleCode: 'VAT_RATE_MISMATCH',
        messageHE: `שיעור המע"מ המוחל (${(appliedRate * 100).toFixed(2)}%) אינו תואם לשיעור הצפוי (${(expectedRate * 100).toFixed(2)}%) עבור קטגוריה: ${expense.category}`,
        messageEN: `Applied VAT rate (${(appliedRate * 100).toFixed(2)}%) does not match expected rate (${(expectedRate * 100).toFixed(2)}%) for category: ${expense.category}`,
        isCritical,
        severity: isCritical ? 'error' : 'warning',
      });
    }

    if (expectedRate === 0 && !expense.vatExemptionReason) {
      violations.push({
        id: `missing_exemption_${Date.now()}`,
        ruleCode: 'MISSING_VAT_EXEMPTION_REASON',
        messageHE: 'נדרשת סיבה לפטור ממע"מ',
        messageEN: 'VAT exemption reason required',
        isCritical: true,
        severity: 'error',
      });
    }
  }

  private async checkForbiddenVendors(
    expense: Partial<Expense>,
    violations: PolicyViolation[]
  ): Promise<void> {
    const description = (expense.description || '').toLowerCase();
    const vendorName = (expense.receiptVendorName || '').toLowerCase();
    const combinedText = `${description} ${vendorName}`;

    for (const forbidden of this.policyLimits.forbiddenVendors) {
      if (combinedText.includes(forbidden.toLowerCase())) {
        violations.push({
          id: `forbidden_vendor_${Date.now()}`,
          ruleCode: 'FORBIDDEN_VENDOR',
          messageHE: `ספק זה אינו מאושר להוצאות חברה: ${forbidden}`,
          messageEN: `This vendor is not approved for company expenses: ${forbidden}`,
          isCritical: true,
          severity: 'error',
        });
      }
    }
  }

  private async checkReceiptRequirements(
    expense: Partial<Expense>,
    violations: PolicyViolation[]
  ): Promise<void> {
    const amount = parseFloat(expense.totalAmountILS?.toString() || '0');
    const hasReceipt = expense.receiptImageUrls && expense.receiptImageUrls.length > 0;

    if (amount > this.policyLimits.requireReceiptAboveILS && !hasReceipt) {
      violations.push({
        id: `missing_receipt_${Date.now()}`,
        ruleCode: 'MISSING_RECEIPT',
        messageHE: `נדרשת קבלה להוצאות מעל ₪${this.policyLimits.requireReceiptAboveILS}`,
        messageEN: `Receipt required for expenses above ₪${this.policyLimits.requireReceiptAboveILS}`,
        isCritical: true,
        severity: 'error',
      });
    }
  }

  private async checkMileageCompliance(
    expense: Partial<Expense>,
    violations: PolicyViolation[]
  ): Promise<void> {
    if (expense.category?.toLowerCase() !== 'mileage' || !expense.mileageKm) {
      return;
    }

    const mileageRate = parseFloat(expense.mileageRatePerKm?.toString() || '0');
    const expectedRate = this.policyLimits.mileageRatePerKm;

    if (Math.abs(mileageRate - expectedRate) > 0.01) {
      violations.push({
        id: `mileage_rate_${Date.now()}`,
        ruleCode: 'INVALID_MILEAGE_RATE',
        messageHE: `תעריף הקילומטראז' (₪${mileageRate}) אינו תואם לתעריף המאושר (₪${expectedRate})`,
        messageEN: `Mileage rate (₪${mileageRate}) does not match approved rate (₪${expectedRate})`,
        isCritical: false,
        severity: 'warning',
      });
    }
  }
}

export const expensePolicyService = new ExpensePolicyService();
