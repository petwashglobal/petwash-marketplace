/**
 * ISRAELI CONTRACTOR COMPLIANCE SERVICE
 * 
 * Implements marketplace broker model (like Airbnb) to avoid employee misclassification
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
  commissionRate: number; // 15-25%
  commissionAmount: number;
  providerEarnings: number;
  vatAmount?: number;
  includesVat: boolean;
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
   * Pet Wash takes 15-25% broker fee (like Airbnb/Uber)
   */
  static async calculateCommission(
    providerId: string,
    providerType: ProviderType,
    bookingId: number,
    customerPaidAmount: number,
    commissionRate: number = 20 // Default 20%
  ): Promise<CommissionCalculation> {
    try {
      // Validate commission rate (15-25% allowed)
      if (commissionRate < 15 || commissionRate > 25) {
        throw new Error('Commission rate must be between 15% and 25%');
      }

      // Calculate amounts (Israeli VAT Law - marketplace broker model)
      // Commission is VAT-INCLUSIVE (like Airbnb/Uber): Customer payment already includes VAT
      const grossCommission = parseFloat((customerPaidAmount * (commissionRate / 100)).toFixed(2));
      const providerEarnings = parseFloat((customerPaidAmount - grossCommission).toFixed(2));

      // Israeli VAT calculation (18% - VAT-inclusive reverse calculation)
      // The commission already includes VAT. We extract the VAT portion for tax reporting.
      // Formula: VAT = GrossAmount / 1.18 * 0.18 (reverse calculation)
      const includesVat = true;
      const vatRate = 0.18;
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

      // Generate unique commission ID
      const commissionId = `COMM-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;

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
