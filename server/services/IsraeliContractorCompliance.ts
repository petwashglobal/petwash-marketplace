/**
 * ISRAELI CONTRACTOR COMPLIANCE SERVICE
 * 
 * Implements marketplace broker model (marketplace platform) to avoid employee misclassification
 * Per Israeli Labor Law 2025: Independent contractors must demonstrate true independence
 * 
 * Key Features:
 * - Tax registration verification (Osek Patur/Murshe)  
 * - National Insurance (Bituach Leumi) tracking
 * - Commission calculation (15-25% broker fee)
 * - Independence scoring (prevents employee classification)
 * - Monthly compliance audits
 * - Risk monitoring & alerts
 * 
 * Legal References:
 * - Israeli Labor Law (employee vs contractor tests)
 * - National Insurance (Bituach Leumi) requirements
 * - Tax Authority (Mas Hachnasa) registration rules
 * - VAT Law (>₪120,000/year threshold)
 */

import { db } from '../db';
import { 
  providerTaxCompliance,
  providerCommissions,
  providerIndependenceScore,
  complianceVerificationLogs,
  type InsertProviderTaxCompliance,
  type InsertProviderCommission,
  type ProviderIndependenceScore,
} from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { generateCommissionInvoiceNumber } from '../lib/invoiceSequence';
import { ISRAEL_VAT_RATE } from "@shared/israel-compliance-config";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ProviderType = 'walker' | 'sitter' | 'driver' | 'groomer' | 'trainer';
export type TaxIdType = 'osek_patur' | 'osek_murshe';
export type ComplianceRiskLevel = 'low' | 'medium' | 'high';

export interface TaxVerificationResult {
  isValid: boolean;
  verificationStatus: 'verified' | 'rejected' | 'pending';
  riskLevel: ComplianceRiskLevel;
  issues: string[];
  recommendations: string[];
}

export interface IndependenceCalculation {
  employeeRiskScore: number; // 0-100 (0=safe, 100=high risk)
  riskLevel: ComplianceRiskLevel;
  factors: {
    exclusivityScore: number;
    revenueConcentration: number;
    equipmentOwnership: boolean;
    pricingControl: boolean;
    workFlexibility: boolean;
  };
  recommendations: string[];
}

export interface CommissionCalculation {
  customerPaidAmount: number;
  commissionRate: number; // 15% flat rate (all platforms)
  commissionAmount: number;
  providerEarnings: number;
  vatAmount?: number;
  includesVat: boolean;
}

// ============================================================================
// ISRAELI LAW 2025 COMPLIANCE TYPES
// ============================================================================

/**
 * Israeli Withholding Tax (ניכוי מס במקור) 2025
 * Per Israeli Tax Authority regulations, payers must withhold tax from contractor payments
 */
export interface WithholdingTaxCalculation {
  grossPayment: number;           // Total payment before deductions
  withholdingTaxRate: number;     // Rate based on provider's exemption certificate
  withholdingTaxAmount: number;   // Amount to withhold (remit to Tax Authority)
  netPaymentToProvider: number;   // Amount provider receives
  hasExemptionCertificate: boolean; // אישור ניכוי מס במקור
  exemptionPercentage: number;    // 0% = full withholding, 100% = no withholding
  taxAuthorityCertificateId?: string; // Certificate reference number
  validUntil?: Date;              // Certificate expiry
}

/**
 * National Insurance (ביטוח לאומי) 2025 Rates for Self-Employed
 * Based on Israeli National Insurance Institute (המוסד לביטוח לאומי) rates
 */
export interface NationalInsuranceCalculation {
  monthlyIncome: number;
  nationalInsuranceRate: number;   // ביטוח לאומי rate
  healthInsuranceRate: number;     // ביטוח בריאות rate
  totalContributionRate: number;
  nationalInsuranceAmount: number;
  healthInsuranceAmount: number;
  totalContribution: number;
  incomeBracket: 'reduced' | 'regular'; // Reduced rate up to 60% of average wage
  averageWage2025: number;         // שכר ממוצע במשק
}

/**
 * VAT Threshold Monitor (מעקב סף מע"מ)
 * Israeli VAT Law requires registration when exceeding ₪120,000/year
 */
export interface VatThresholdStatus {
  providerId: string;
  currentYearRevenue: number;
  vatThreshold: number;            // ₪120,000 for 2025
  remainingUntilThreshold: number;
  percentageOfThreshold: number;
  mustRegisterForVat: boolean;
  recommendUpgrade: boolean;       // Recommend upgrading to Osek Murshe
  projectedAnnualRevenue?: number;
  monthsUntilThreshold?: number;
}

// ============================================================================
// TAX REGISTRATION VERIFICATION
// ============================================================================

export class IsraeliContractorComplianceService {
  
  /**
   * Verify provider's Israeli tax registration
   * Checks Osek Patur/Murshe status and National Insurance
   * 
   * ⚠️ PRODUCTION REQUIREMENT: This is a placeholder verification.
   * For production deployment, MUST integrate with:
   * 1. Israeli Tax Authority (Mas Hachnasa) API for tax ID verification
   * 2. National Insurance Institute (Bituach Leumi) API for insurance verification
   * 3. Implement admin manual review workflow for document verification
   * 
   * Current implementation: Basic validation only - NOT suitable for legal compliance
   */
  static async verifyTaxRegistration(
    providerId: string,
    providerType: ProviderType,
    taxData: InsertProviderTaxCompliance
  ): Promise<TaxVerificationResult> {
    try {
      logger.info('[Israeli Compliance] Verifying tax registration', { 
        providerId, 
        providerType,
        taxIdType: taxData.taxIdType 
      });

      const issues: string[] = [];
      const recommendations: string[] = [];

      // ⚠️ BASIC VALIDATION ONLY - NOT PRODUCTION-READY
      // TODO: Replace with Israeli Tax Authority (Mas Hachnasa) API integration
      if (!taxData.taxId || taxData.taxId.length < 5) {
        issues.push('Invalid tax ID number - must verify against Mas Hachnasa registry');
      }

      // ⚠️ BASIC VALIDATION ONLY - NOT PRODUCTION-READY  
      // TODO: Replace with National Insurance (Bituach Leumi) API integration
      if (!taxData.nationalInsuranceNumber || taxData.nationalInsuranceNumber.length < 9) {
        issues.push('Invalid National Insurance number - must verify against Bituach Leumi registry');
      }
      
      // Add production warning
      recommendations.push('⚠️ PRODUCTION: Integrate with Israeli Tax Authority API for real verification');

      // VAT registration check (required if earning >₪120,000/year)
      if (taxData.taxIdType === 'osek_murshe' && !taxData.isVatRegistered) {
        recommendations.push('Osek Murshe must register for VAT');
      }

      // Determine verification status
      const verificationStatus: 'verified' | 'rejected' | 'pending' = 
        issues.length > 0 ? 'rejected' : 'verified';

      // Calculate risk level
      const riskLevel: ComplianceRiskLevel = this.calculateRiskLevel(issues, taxData);

      // Save to database
      // ⚠️ SECURITY WARNING: Tax IDs and National Insurance numbers are stored in plaintext
      // TODO PRODUCTION: Encrypt sensitive PII (taxId, nationalInsuranceNumber) at rest using AES-256
      // TODO PRODUCTION: Implement field-level encryption for GDPR/Israeli Privacy Law compliance
      // TODO PRODUCTION: Redact sensitive fields in API responses (show only last 4 digits)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // Tax registration valid for 1 year

      // NOTE: In production, status should remain 'pending' until admin/API verification completes
      const productionSafeStatus = verificationStatus === 'verified' ? 'pending' : verificationStatus;
      
      await db.insert(providerTaxCompliance).values({
        providerId,
        providerType,
        ...taxData,
        verificationStatus: productionSafeStatus, // Force pending until real verification
        riskLevel,
        isCompliant: false, // Never auto-approve without real verification
        expiresAt,
        verifiedAt: null, // Only set after real verification
      });

      // Log verification
      await this.logComplianceCheck(
        providerId,
        providerType,
        'tax_registration',
        verificationStatus === 'verified' ? 'passed' : 'failed',
        { issues, recommendations }
      );

      logger.info('[Israeli Compliance] Tax verification complete', {
        providerId,
        verificationStatus,
        riskLevel
      });

      return {
        isValid: verificationStatus === 'verified',
        verificationStatus,
        riskLevel,
        issues,
        recommendations,
      };
    } catch (error: any) {
      logger.error('[Israeli Compliance] Tax verification failed', {
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate commission for a booking
   * Pet Wash takes flat 15% commission on ALL third-party providers (unified rate)
   */
  static async calculateCommission(
    providerId: string,
    providerType: ProviderType,
    bookingId: number,
    customerPaidAmount: number,
    commissionRate: number = 15 // Flat 15% on all platforms
  ): Promise<CommissionCalculation> {
    try {
      if (commissionRate < 5 || commissionRate > 25) {
        throw new Error('Commission rate must be between 5% and 25%');
      }

      // Calculate amounts (Israeli VAT Law - marketplace broker model)
      // Commission is VAT-INCLUSIVE (marketplace platform/on-demand platform): Customer payment already includes VAT
      const grossCommission = parseFloat((customerPaidAmount * (commissionRate / 100)).toFixed(2));
      const providerEarnings = parseFloat((customerPaidAmount - grossCommission).toFixed(2));

      // Israeli VAT calculation (18% - VAT-inclusive reverse calculation)
      // The commission already includes VAT. We extract the VAT portion for tax reporting.
      // Formula: VAT = GrossAmount / 1.18 * 0.18 (reverse calculation)
      const includesVat = true;
      const vatRate = ISRAEL_VAT_RATE;
      const vatAmount = parseFloat((grossCommission / (1 + vatRate) * vatRate).toFixed(2));
      const commissionAmount = grossCommission; // Gross commission (includes VAT)
      const netCommission = parseFloat((grossCommission - vatAmount).toFixed(2)); // Net commission (without VAT)
      
      // Verify balance: customerPaid = providerEarnings + netCommission + VAT
      const balance = providerEarnings + netCommission + vatAmount;
      if (Math.abs(balance - customerPaidAmount) > 0.02) {
        logger.warn('[Israeli Compliance] Commission calculation imbalance', {
          customerPaidAmount,
          providerEarnings,
          netCommission,
          vatAmount,
          balance,
          difference: balance - customerPaidAmount
        });
      }

      // Generate unique commission ID and sequential invoice number
      const commissionId = `COMM-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;
      const invoiceNumber = await generateCommissionInvoiceNumber();

      // Save commission record
      await db.insert(providerCommissions).values({
        commissionId,
        providerId,
        providerType,
        bookingId,
        customerPaidAmount: customerPaidAmount.toString(),
        commissionRate: commissionRate.toString(),
        commissionAmount: commissionAmount.toString(),
        providerEarnings: providerEarnings.toString(),
        includesVat,
        vatAmount: vatAmount.toString(),
        status: 'pending',
        invoiceNumber,
      });

      logger.info('[Israeli Compliance] Commission calculated', {
        commissionId,
        providerId,
        commissionAmount,
        providerEarnings
      });

      return {
        customerPaidAmount,
        commissionRate,
        commissionAmount,
        providerEarnings,
        vatAmount,
        includesVat,
      };
    } catch (error: any) {
      logger.error('[Israeli Compliance] Commission calculation failed', {
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate provider independence score
   * Prevents employee misclassification per Israeli Labor Law
   */
  static async calculateIndependenceScore(
    providerId: string,
    providerType: ProviderType,
    metrics: {
      totalClients?: number;
      petwashRevenuePercent?: number;
      hasOwnEquipment?: boolean;
      canRefuseGigs?: boolean;
      setOwnRates?: boolean;
      hasSubstitutes?: boolean;
    }
  ): Promise<IndependenceCalculation> {
    try {
      logger.info('[Israeli Compliance] Calculating independence score', { providerId });

      // Default values
      const totalClients = metrics.totalClients || 1;
      const petwashRevenuePercent = metrics.petwashRevenuePercent || 100;
      const hasOwnEquipment = metrics.hasOwnEquipment || false;
      const canRefuseGigs = metrics.canRefuseGigs !== false; // Default true
      const setOwnRates = metrics.setOwnRates || false;
      const hasSubstitutes = metrics.hasSubstitutes || false;

      // Calculate exclusivity score (0=many clients, 100=exclusive)
      const exclusivityScore = totalClients === 1 ? 100 : Math.max(0, 100 - (totalClients * 20));

      // Calculate employee risk score (0-100)
      let riskScore = 0;

      // Revenue concentration risk (40 points max)
      riskScore += (petwashRevenuePercent / 100) * 40;

      // Exclusivity risk (30 points max)
      riskScore += (exclusivityScore / 100) * 30;

      // Equipment ownership (10 points - lack increases risk)
      if (!hasOwnEquipment) riskScore += 10;

      // Gig refusal freedom (10 points - lack increases risk)
      if (!canRefuseGigs) riskScore += 10;

      // Pricing control (5 points - lack increases risk)
      if (!setOwnRates) riskScore += 5;

      // Substitution ability (5 points - lack increases risk)
      if (!hasSubstitutes) riskScore += 5;

      // Determine risk level
      const riskLevel: ComplianceRiskLevel = 
        riskScore < 30 ? 'low' :
        riskScore < 60 ? 'medium' : 'high';

      // Generate recommendations
      const recommendations: string[] = [];
      if (totalClients === 1) {
        recommendations.push('Work with multiple platforms to demonstrate independence');
      }
      if (petwashRevenuePercent > 80) {
        recommendations.push('Diversify income sources to reduce economic dependence');
      }
      if (!hasOwnEquipment) {
        recommendations.push('Provide your own equipment (car, tools) to show independence');
      }
      if (!setOwnRates) {
        recommendations.push('Set your own pricing or choose from marketplace tiers');
      }
      if (!canRefuseGigs) {
        recommendations.push('Must have ability to refuse bookings freely');
      }

      // Save independence score
      await db.insert(providerIndependenceScore).values({
        providerId,
        providerType,
        totalClients,
        exclusivityScore: exclusivityScore.toFixed(2),
        petwashRevenuePercent: petwashRevenuePercent.toFixed(2),
        hasOwnEquipment,
        canRefuseGigs,
        setOwnRates,
        hasSubstitutes,
        employeeRiskScore: riskScore.toFixed(2),
        riskLevel,
        complianceRecommendations: JSON.stringify(recommendations),
      }).onConflictDoUpdate({
        target: providerIndependenceScore.providerId,
        set: {
          totalClients,
          exclusivityScore: exclusivityScore.toFixed(2),
          petwashRevenuePercent: petwashRevenuePercent.toFixed(2),
          hasOwnEquipment,
          canRefuseGigs,
          setOwnRates,
          hasSubstitutes,
          employeeRiskScore: riskScore.toFixed(2),
          riskLevel,
          complianceRecommendations: JSON.stringify(recommendations),
          updatedAt: new Date(),
        },
      });

      // Log independence check
      await this.logComplianceCheck(
        providerId,
        providerType,
        'independence_check',
        riskLevel === 'high' ? 'warning' : 'passed',
        {
          riskScore,
          riskLevel,
          recommendations
        }
      );

      logger.info('[Israeli Compliance] Independence score calculated', {
        providerId,
        riskScore,
        riskLevel
      });

      return {
        employeeRiskScore: riskScore,
        riskLevel,
        factors: {
          exclusivityScore,
          revenueConcentration: petwashRevenuePercent,
          equipmentOwnership: hasOwnEquipment,
          pricingControl: setOwnRates,
          workFlexibility: canRefuseGigs,
        },
        recommendations,
      };
    } catch (error: any) {
      logger.error('[Israeli Compliance] Independence calculation failed', {
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Run monthly compliance audit for a provider
   */
  static async runMonthlyAudit(
    providerId: string,
    providerType: ProviderType
  ): Promise<{
    passed: boolean;
    issues: string[];
    warnings: string[];
  }> {
    try {
      logger.info('[Israeli Compliance] Running monthly audit', { providerId });

      const issues: string[] = [];
      const warnings: string[] = [];

      // Check tax compliance
      const taxCompliance = await db.query.providerTaxCompliance.findFirst({
        where: eq(providerTaxCompliance.providerId, providerId)
      });

      if (!taxCompliance) {
        issues.push('No tax registration found');
      } else {
        if (taxCompliance.verificationStatus !== 'verified') {
          issues.push('Tax registration not verified');
        }
        if (taxCompliance.expiresAt && new Date(taxCompliance.expiresAt) < new Date()) {
          issues.push('Tax registration expired');
        }
      }

      // Check independence score
      const independence = await db.query.providerIndependenceScore.findFirst({
        where: eq(providerIndependenceScore.providerId, providerId)
      });

      if (independence) {
        if (independence.riskLevel === 'high') {
          warnings.push('High employee misclassification risk');
        }
        if (parseFloat(independence.petwashRevenuePercent || '0') > 90) {
          warnings.push('Revenue too concentrated with PetWash (>90%)');
        }
      }

      const passed = issues.length === 0;

      // Log audit results
      await this.logComplianceCheck(
        providerId,
        providerType,
        'monthly_audit',
        passed ? 'passed' : 'failed',
        { issues, warnings }
      );

      logger.info('[Israeli Compliance] Monthly audit complete', {
        providerId,
        passed,
        issuesCount: issues.length,
        warningsCount: warnings.length
      });

      return { passed, issues, warnings };
    } catch (error: any) {
      logger.error('[Israeli Compliance] Monthly audit failed', {
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  // ============================================================================
  // ISRAELI LAW 2025 COMPLIANCE METHODS
  // ============================================================================

  /**
   * Israeli Withholding Tax Calculation (ניכוי מס במקור) 2025
   * 
   * Per Israeli Tax Authority (רשות המסים) regulations:
   * - Default withholding: 20-30% for contractors without exemption
   * - With exemption certificate (אישור ניכוי מס במקור): 0-100% exemption
   * - Certificates must be verified with Tax Authority and renewed annually
   * 
   * ⚠️ PRODUCTION REQUIREMENT: Integrate with Israeli Tax Authority API
   * to verify exemption certificates in real-time
   */
  static calculateWithholdingTax(
    grossPayment: number,
    hasExemptionCertificate: boolean = false,
    exemptionPercentage: number = 0,
    taxAuthorityCertificateId?: string,
    validUntil?: Date,
    providerWithholdingRate?: number // Provider-specific rate from certificate (0-50%)
  ): WithholdingTaxCalculation {
    logger.info('[Israeli Compliance 2025] Calculating withholding tax', {
      grossPayment,
      hasExemptionCertificate,
      exemptionPercentage,
      providerWithholdingRate
    });

    // Israeli Tax Authority withholding rates for contractors (2025)
    // Default rates vary by provider type:
    // - Services (general): 20%
    // - Construction/subcontractors: 30%
    // - Certificate holders: As specified in אישור ניכוי מס במקור (0-50%)
    const DEFAULT_WITHHOLDING_RATE_SERVICES = 0.20; // 20% default for services
    const DEFAULT_WITHHOLDING_RATE_CONSTRUCTION = 0.30; // 30% for construction

    // Use provider-specific rate if available, otherwise default to 20% services rate
    let baseRate = providerWithholdingRate !== undefined 
      ? providerWithholdingRate / 100 
      : DEFAULT_WITHHOLDING_RATE_SERVICES;

    // Validate rate range (0-50%)
    if (baseRate < 0) baseRate = 0;
    if (baseRate > 0.50) baseRate = 0.50;

    // Check certificate validity
    let effectiveExemption = 0;
    let certificateValid = false;
    
    if (hasExemptionCertificate && validUntil) {
      if (new Date(validUntil) >= new Date()) {
        effectiveExemption = exemptionPercentage;
        certificateValid = true;
      } else {
        logger.warn('[Israeli Compliance 2025] Withholding certificate expired - using default rate', {
          taxAuthorityCertificateId: taxAuthorityCertificateId ? `***${taxAuthorityCertificateId.slice(-4)}` : undefined,
          validUntil
        });
      }
    } else if (hasExemptionCertificate) {
      effectiveExemption = exemptionPercentage;
      certificateValid = true;
    }

    // Calculate effective withholding rate
    // exemptionPercentage of 100% = no withholding, 0% = full withholding at base rate
    const withholdingTaxRate = certificateValid 
      ? baseRate * (1 - effectiveExemption / 100)
      : baseRate;
    const withholdingTaxAmount = parseFloat((grossPayment * withholdingTaxRate).toFixed(2));
    const netPaymentToProvider = parseFloat((grossPayment - withholdingTaxAmount).toFixed(2));

    logger.info('[Israeli Compliance 2025] Withholding tax calculated', {
      grossPayment,
      withholdingTaxRate: (withholdingTaxRate * 100).toFixed(1) + '%',
      withholdingTaxAmount,
      netPaymentToProvider
    });

    return {
      grossPayment,
      withholdingTaxRate,
      withholdingTaxAmount,
      netPaymentToProvider,
      hasExemptionCertificate,
      exemptionPercentage: effectiveExemption,
      taxAuthorityCertificateId,
      validUntil
    };
  }

  /**
   * Israeli National Insurance Calculation (ביטוח לאומי) 2025
   * 
   * Self-employed contribution rates per National Insurance Institute:
   * 
   * REDUCED RATE (up to 60% of average wage - ₪7,866/month in 2025):
   * - National Insurance: 2.87%
   * - Health Insurance: 3.10%
   * - Total: 5.97%
   * 
   * REGULAR RATE (above 60% of average wage):
   * - National Insurance: 12.83%
   * - Health Insurance: 5.00%
   * - Total: 17.83%
   * 
   * Maximum income for contributions: 5x average wage (₪65,550/month)
   * 
   * Average wage 2025: ₪13,110 (updated January 2025)
   * Source: Israeli National Insurance Institute (המוסד לביטוח לאומי)
   */
  static calculateNationalInsurance(monthlyIncome: number): NationalInsuranceCalculation {
    logger.info('[Israeli Compliance 2025] Calculating National Insurance', { monthlyIncome });

    // 2025 Israeli National Insurance rates (המוסד לביטוח לאומי)
    // Updated January 2025 based on official Bituach Leumi publication
    // Source: https://www.btl.gov.il (National Insurance Institute of Israel)
    const AVERAGE_WAGE_2025 = 13_110; // שכר ממוצע במשק ינואר 2025 (₪13,110)
    const REDUCED_RATE_THRESHOLD = AVERAGE_WAGE_2025 * 0.60; // 60% = ₪7,866
    const MAX_INCOME_THRESHOLD = AVERAGE_WAGE_2025 * 5; // 5x = ₪65,550

    // Reduced rates (up to 60% of average wage)
    const REDUCED_NI_RATE = 0.0287; // 2.87% National Insurance
    const REDUCED_HEALTH_RATE = 0.031; // 3.10% Health Insurance

    // Regular rates (above 60% of average wage)
    const REGULAR_NI_RATE = 0.1283; // 12.83% National Insurance
    const REGULAR_HEALTH_RATE = 0.05; // 5.00% Health Insurance

    // Cap income at maximum threshold
    const cappedIncome = Math.min(monthlyIncome, MAX_INCOME_THRESHOLD);

    let nationalInsuranceAmount = 0;
    let healthInsuranceAmount = 0;
    let incomeBracket: 'reduced' | 'regular' = 'reduced';

    if (cappedIncome <= REDUCED_RATE_THRESHOLD) {
      // All income at reduced rate
      nationalInsuranceAmount = cappedIncome * REDUCED_NI_RATE;
      healthInsuranceAmount = cappedIncome * REDUCED_HEALTH_RATE;
      incomeBracket = 'reduced';
    } else {
      // Split calculation: reduced rate up to threshold, regular rate above
      const reducedPortion = REDUCED_RATE_THRESHOLD;
      const regularPortion = cappedIncome - REDUCED_RATE_THRESHOLD;

      nationalInsuranceAmount = 
        (reducedPortion * REDUCED_NI_RATE) + 
        (regularPortion * REGULAR_NI_RATE);
      
      healthInsuranceAmount = 
        (reducedPortion * REDUCED_HEALTH_RATE) + 
        (regularPortion * REGULAR_HEALTH_RATE);
      
      incomeBracket = 'regular';
    }

    // Round to 2 decimal places
    nationalInsuranceAmount = parseFloat(nationalInsuranceAmount.toFixed(2));
    healthInsuranceAmount = parseFloat(healthInsuranceAmount.toFixed(2));
    const totalContribution = parseFloat((nationalInsuranceAmount + healthInsuranceAmount).toFixed(2));

    // Calculate effective rates
    const nationalInsuranceRate = cappedIncome > 0 ? nationalInsuranceAmount / cappedIncome : 0;
    const healthInsuranceRate = cappedIncome > 0 ? healthInsuranceAmount / cappedIncome : 0;
    const totalContributionRate = cappedIncome > 0 ? totalContribution / cappedIncome : 0;

    logger.info('[Israeli Compliance 2025] National Insurance calculated', {
      monthlyIncome: cappedIncome,
      incomeBracket,
      nationalInsuranceAmount,
      healthInsuranceAmount,
      totalContribution
    });

    return {
      monthlyIncome: cappedIncome,
      nationalInsuranceRate,
      healthInsuranceRate,
      totalContributionRate,
      nationalInsuranceAmount,
      healthInsuranceAmount,
      totalContribution,
      incomeBracket,
      averageWage2025: AVERAGE_WAGE_2025
    };
  }

  /**
   * VAT Threshold Monitoring (מעקב סף מע"מ) 2025
   * 
   * Israeli VAT Law requires registration when annual revenue exceeds ₪120,000
   * - Osek Patur (עוסק פטור): Exempt from VAT, max ₪120,000/year
   * - Osek Murshe (עוסק מורשה): Must charge and remit 18% VAT
   * 
   * This method monitors provider revenue and alerts when approaching threshold
   */
  static async checkVatThreshold(providerId: string): Promise<VatThresholdStatus> {
    logger.info('[Israeli Compliance 2025] Checking VAT threshold', { providerId });

    // Israeli VAT threshold 2025
    const VAT_THRESHOLD_2025 = 120_000; // ₪120,000/year

    try {
      // Get provider's current year earnings
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31);

      const earnings = await db.select({
        totalEarnings: sql<number>`COALESCE(SUM(CAST(${providerCommissions.providerEarnings} AS NUMERIC)), 0)`,
        bookingCount: sql<number>`COUNT(*)`,
      }).from(providerCommissions)
        .where(and(
          eq(providerCommissions.providerId, providerId),
          gte(providerCommissions.createdAt, yearStart),
          lte(providerCommissions.createdAt, yearEnd)
        ));

      const currentYearRevenue = parseFloat(earnings[0]?.totalEarnings?.toString() || '0');
      const bookingCount = parseInt(earnings[0]?.bookingCount?.toString() || '0');
      
      // Calculate projections
      const currentMonth = new Date().getMonth() + 1; // 1-12
      const monthlyAverage = currentYearRevenue / currentMonth;
      const projectedAnnualRevenue = monthlyAverage * 12;
      
      // Calculate remaining until threshold
      const remainingUntilThreshold = Math.max(0, VAT_THRESHOLD_2025 - currentYearRevenue);
      const percentageOfThreshold = (currentYearRevenue / VAT_THRESHOLD_2025) * 100;
      
      // Calculate months until threshold (at current pace)
      const monthsUntilThreshold = monthlyAverage > 0 
        ? Math.ceil(remainingUntilThreshold / monthlyAverage)
        : undefined;

      // Determine if VAT registration required
      const mustRegisterForVat = currentYearRevenue >= VAT_THRESHOLD_2025;
      
      // Recommend upgrade if at 80%+ of threshold
      const recommendUpgrade = percentageOfThreshold >= 80 || projectedAnnualRevenue >= VAT_THRESHOLD_2025;

      // Log warning if approaching threshold
      if (recommendUpgrade && !mustRegisterForVat) {
        logger.warn('[Israeli Compliance 2025] Provider approaching VAT threshold', {
          providerId,
          currentYearRevenue,
          percentageOfThreshold: percentageOfThreshold.toFixed(1) + '%',
          projectedAnnualRevenue
        });

        // Log compliance check
        await this.logComplianceCheck(
          providerId,
          'sitter', // Default type, should be fetched from provider
          'vat_threshold_warning',
          'warning',
          {
            currentYearRevenue,
            vatThreshold: VAT_THRESHOLD_2025,
            percentageOfThreshold,
            projectedAnnualRevenue,
            recommendation: 'Consider upgrading to Osek Murshe (עוסק מורשה)'
          }
        );
      }

      logger.info('[Israeli Compliance 2025] VAT threshold check complete', {
        providerId,
        currentYearRevenue,
        mustRegisterForVat,
        recommendUpgrade
      });

      return {
        providerId,
        currentYearRevenue,
        vatThreshold: VAT_THRESHOLD_2025,
        remainingUntilThreshold,
        percentageOfThreshold,
        mustRegisterForVat,
        recommendUpgrade,
        projectedAnnualRevenue,
        monthsUntilThreshold
      };
    } catch (error: any) {
      logger.error('[Israeli Compliance 2025] VAT threshold check failed', {
        providerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate complete Israeli tax obligations for a payout
   * Combines withholding tax, VAT, and provides National Insurance estimate
   */
  static async calculatePayoutTaxObligations(
    providerId: string,
    grossPayoutAmount: number,
    providerTaxInfo?: {
      hasWithholdingExemption?: boolean;
      exemptionPercentage?: number;
      certificateId?: string;
      certificateValidUntil?: Date;
      taxIdType?: TaxIdType;
      isVatRegistered?: boolean;
    }
  ): Promise<{
    grossAmount: number;
    withholding: WithholdingTaxCalculation;
    nationalInsuranceEstimate: NationalInsuranceCalculation;
    vatStatus: VatThresholdStatus;
    netPaymentToProvider: number;
    taxSummary: {
      totalDeductions: number;
      providerTakeHome: number;
      petwashCommission: number;
      remitToTaxAuthority: number;
    };
  }> {
    logger.info('[Israeli Compliance 2025] Calculating payout tax obligations', {
      providerId,
      grossPayoutAmount
    });

    // Calculate withholding tax
    const withholding = this.calculateWithholdingTax(
      grossPayoutAmount,
      providerTaxInfo?.hasWithholdingExemption || false,
      providerTaxInfo?.exemptionPercentage || 0,
      providerTaxInfo?.certificateId,
      providerTaxInfo?.certificateValidUntil
    );

    // Estimate National Insurance (monthly average based on payout)
    // This is informational - providers pay NI directly to Bituach Leumi
    const estimatedMonthlyFromPayout = grossPayoutAmount; // Simplified estimation
    const nationalInsuranceEstimate = this.calculateNationalInsurance(estimatedMonthlyFromPayout);

    // Check VAT threshold status
    const vatStatus = await this.checkVatThreshold(providerId);

    // Calculate summary
    const petwashCommission = grossPayoutAmount * 0.15; // 15% flat commission (all platforms)
    const netAfterCommission = grossPayoutAmount - petwashCommission;
    const remitToTaxAuthority = withholding.withholdingTaxAmount;
    const providerTakeHome = netAfterCommission - remitToTaxAuthority;

    logger.info('[Israeli Compliance 2025] Payout tax obligations calculated', {
      providerId,
      grossAmount: grossPayoutAmount,
      withholdingTax: remitToTaxAuthority,
      netPayment: withholding.netPaymentToProvider
    });

    return {
      grossAmount: grossPayoutAmount,
      withholding,
      nationalInsuranceEstimate,
      vatStatus,
      netPaymentToProvider: withholding.netPaymentToProvider,
      taxSummary: {
        totalDeductions: petwashCommission + remitToTaxAuthority,
        providerTakeHome,
        petwashCommission,
        remitToTaxAuthority
      }
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private static calculateRiskLevel(
    issues: string[],
    taxData: InsertProviderTaxCompliance
  ): ComplianceRiskLevel {
    if (issues.length > 0) return 'high';
    if (!taxData.isVatRegistered && taxData.taxIdType === 'osek_murshe') return 'medium';
    return 'low';
  }

  private static async logComplianceCheck(
    providerId: string,
    providerType: ProviderType,
    verificationType: string,
    checkStatus: 'passed' | 'failed' | 'warning',
    findings: any
  ): Promise<void> {
    await db.insert(complianceVerificationLogs).values({
      providerId,
      providerType,
      verificationType,
      checkStatus,
      findings: JSON.stringify(findings),
      performedBySystem: true,
    });
  }

  /**
   * Get provider compliance summary
   */
  static async getComplianceSummary(providerId: string): Promise<{
    taxCompliance: any;
    independenceScore: any;
    commissionStats: any;
    recentLogs: any[];
  }> {
    try {
      const [tax, independence, commissions, logs] = await Promise.all([
        db.query.providerTaxCompliance.findFirst({
          where: eq(providerTaxCompliance.providerId, providerId)
        }),
        db.query.providerIndependenceScore.findFirst({
          where: eq(providerIndependenceScore.providerId, providerId)
        }),
        db.select({
          total: sql<number>`COUNT(*)`,
          totalEarnings: sql<number>`SUM(CAST(${providerCommissions.providerEarnings} AS NUMERIC))`,
          totalCommissions: sql<number>`SUM(CAST(${providerCommissions.commissionAmount} AS NUMERIC))`,
        }).from(providerCommissions).where(eq(providerCommissions.providerId, providerId)),
        db.select().from(complianceVerificationLogs)
          .where(eq(complianceVerificationLogs.providerId, providerId))
          .orderBy(desc(complianceVerificationLogs.createdAt))
          .limit(10)
      ]);

      return {
        taxCompliance: tax,
        independenceScore: independence,
        commissionStats: commissions[0] || { total: 0, totalEarnings: 0, totalCommissions: 0 },
        recentLogs: logs,
      };
    } catch (error: any) {
      logger.error('[Israeli Compliance] Failed to get compliance summary', {
        providerId,
        error: error.message
      });
      throw error;
    }
  }
}
