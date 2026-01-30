/**
 * ISRAELI LAW 2025 COMPLIANCE API ROUTES
 *
 * Endpoints for Israeli tax compliance:
 * - Withholding tax (ניכוי מס במקור) calculations
 * - National Insurance (ביטוח לאומי) estimates
 * - VAT threshold monitoring (מעקב סף מע"מ)
 * - Complete payout tax obligations
 *
 * Legal References:
 * - Israeli Tax Authority (רשות המסים) regulations 2025
 * - National Insurance Institute (המוסד לביטוח לאומי) rates 2025
 * - VAT Law (חוק מע"מ) - ₪120,000 threshold
 */
import { Router } from 'express';
import { IsraeliContractorComplianceService } from '../services/IsraeliContractorCompliance';
import { logger } from '../lib/logger';
import { z } from 'zod';
const router = Router();
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
const withholdingTaxSchema = z.object({
    grossPayment: z.number().positive('Gross payment must be positive'),
    hasExemptionCertificate: z.boolean().optional().default(false),
    exemptionPercentage: z.number().min(0).max(100).optional().default(0),
    taxAuthorityCertificateId: z.string().optional(),
    validUntil: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
    providerWithholdingRate: z.number().min(0).max(50).optional(), // 0-50% based on certificate
});
// PII Redaction helper for sensitive identifiers
const redactPII = (value) => {
    if (!value || value.length < 4)
        return value ? '****' : undefined;
    return `***${value.slice(-4)}`;
};
const nationalInsuranceSchema = z.object({
    monthlyIncome: z.number().nonnegative('Monthly income must be non-negative'),
});
const payoutTaxSchema = z.object({
    providerId: z.string().min(1, 'Provider ID required'),
    grossPayoutAmount: z.number().positive('Gross payout must be positive'),
    providerTaxInfo: z.object({
        hasWithholdingExemption: z.boolean().optional(),
        exemptionPercentage: z.number().min(0).max(100).optional(),
        certificateId: z.string().optional(),
        certificateValidUntil: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
        taxIdType: z.enum(['osek_patur', 'osek_murshe']).optional(),
        isVatRegistered: z.boolean().optional(),
    }).optional(),
});
// ============================================================================
// WITHHOLDING TAX ENDPOINTS
// ============================================================================
/**
 * POST /api/israeli-compliance/withholding-tax/calculate
 * Calculate withholding tax for a payment to a contractor
 *
 * Israeli Tax Authority requires 20% withholding unless contractor
 * has a valid exemption certificate (אישור ניכוי מס במקור)
 */
router.post('/withholding-tax/calculate', async (req, res) => {
    try {
        const validation = withholdingTaxSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.error.errors
            });
        }
        const { grossPayment, hasExemptionCertificate, exemptionPercentage, taxAuthorityCertificateId, validUntil, providerWithholdingRate } = validation.data;
        const result = IsraeliContractorComplianceService.calculateWithholdingTax(grossPayment, hasExemptionCertificate, exemptionPercentage, taxAuthorityCertificateId, validUntil, providerWithholdingRate);
        logger.info('[Israeli Compliance API] Withholding tax calculated', {
            grossPayment,
            withholdingAmount: result.withholdingTaxAmount
        });
        // Redact sensitive certificate ID in response
        const redactedResult = {
            ...result,
            taxAuthorityCertificateId: redactPII(result.taxAuthorityCertificateId)
        };
        res.json({
            success: true,
            data: redactedResult,
            legalNote: {
                he: 'ניכוי מס במקור בהתאם לתקנות רשות המסים 2025',
                en: 'Withholding tax per Israeli Tax Authority regulations 2025'
            },
            ratesInfo: {
                defaultServices: '20%',
                defaultConstruction: '30%',
                certificateRange: '0-50% (as specified in אישור ניכוי מס במקור)'
            }
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Withholding tax calculation failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================================================
// NATIONAL INSURANCE ENDPOINTS
// ============================================================================
/**
 * POST /api/israeli-compliance/national-insurance/calculate
 * Calculate National Insurance (Bituach Leumi) contributions
 *
 * Self-employed contractors must pay:
 * - Reduced rate up to 60% of average wage (₪7,522): 5.97%
 * - Regular rate above threshold: 17.83%
 */
router.post('/national-insurance/calculate', async (req, res) => {
    try {
        const validation = nationalInsuranceSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.error.errors
            });
        }
        const { monthlyIncome } = validation.data;
        const result = IsraeliContractorComplianceService.calculateNationalInsurance(monthlyIncome);
        logger.info('[Israeli Compliance API] National Insurance calculated', {
            monthlyIncome,
            totalContribution: result.totalContribution
        });
        res.json({
            success: true,
            data: result,
            legalNote: {
                he: 'חישוב ביטוח לאומי ודמי בריאות לעצמאים בהתאם לשיעורי המוסד לביטוח לאומי 2025',
                en: 'National Insurance and Health Insurance for self-employed per 2025 rates'
            },
            ratesInfo: {
                reducedBracket: {
                    threshold: '60% of average wage (₪7,866)',
                    nationalInsurance: '2.87%',
                    healthInsurance: '3.10%',
                    total: '5.97%'
                },
                regularBracket: {
                    threshold: 'Above 60% of average wage',
                    nationalInsurance: '12.83%',
                    healthInsurance: '5.00%',
                    total: '17.83%'
                },
                maxIncome: '5x average wage (₪65,550/month)',
                averageWage2025: '₪13,110/month',
                source: 'Israeli National Insurance Institute (המוסד לביטוח לאומי)'
            },
            piiWarning: '⚠️ Tax data is sensitive PII. Production requires encryption at rest and redaction in responses.'
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] National Insurance calculation failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================================================
// VAT THRESHOLD ENDPOINTS
// ============================================================================
/**
 * GET /api/israeli-compliance/vat-threshold/:providerId
 * Check provider's VAT threshold status
 *
 * Israeli VAT Law requires registration when exceeding ₪120,000/year
 */
router.get('/vat-threshold/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;
        if (!providerId) {
            return res.status(400).json({
                success: false,
                error: 'Provider ID required'
            });
        }
        const result = await IsraeliContractorComplianceService.checkVatThreshold(providerId);
        logger.info('[Israeli Compliance API] VAT threshold checked', {
            providerId,
            currentYearRevenue: result.currentYearRevenue,
            mustRegisterForVat: result.mustRegisterForVat
        });
        res.json({
            success: true,
            data: result,
            legalNote: {
                he: 'מעקב סף מע"מ בהתאם לחוק מס ערך מוסף - סף ₪120,000 לשנה',
                en: 'VAT threshold monitoring per Israeli VAT Law - ₪120,000/year threshold'
            },
            statusExplanation: {
                osekPatur: {
                    he: 'עוסק פטור - פטור מגביית מע"מ עד ₪120,000 בשנה',
                    en: 'Osek Patur - VAT exempt up to ₪120,000/year'
                },
                osekMurshe: {
                    he: 'עוסק מורשה - חייב בגביית והעברת מע"מ 18%',
                    en: 'Osek Murshe - Must charge and remit 18% VAT'
                }
            }
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] VAT threshold check failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================================================
// COMPLETE PAYOUT TAX OBLIGATIONS
// ============================================================================
/**
 * POST /api/israeli-compliance/payout-obligations
 * Calculate complete tax obligations for a payout
 *
 * Combines:
 * - Withholding tax (ניכוי מס במקור)
 * - National Insurance estimate (ביטוח לאומי)
 * - VAT threshold status (מעקב מע"מ)
 */
router.post('/payout-obligations', async (req, res) => {
    try {
        const validation = payoutTaxSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.error.errors
            });
        }
        const { providerId, grossPayoutAmount, providerTaxInfo } = validation.data;
        const result = await IsraeliContractorComplianceService.calculatePayoutTaxObligations(providerId, grossPayoutAmount, providerTaxInfo);
        logger.info('[Israeli Compliance API] Payout obligations calculated', {
            providerId,
            grossAmount: grossPayoutAmount,
            netPayment: result.netPaymentToProvider
        });
        res.json({
            success: true,
            data: result,
            legalNote: {
                he: 'חישוב מקיף של חובות מס לתשלום קבלנים בהתאם לחוק הישראלי 2025',
                en: 'Comprehensive tax obligations for contractor payouts per Israeli Law 2025'
            }
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Payout obligations calculation failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================================================
// COMPLIANCE SUMMARY ENDPOINT
// ============================================================================
/**
 * GET /api/israeli-compliance/summary/:providerId
 * Get complete compliance summary for a provider
 */
router.get('/summary/:providerId', async (req, res) => {
    try {
        const { providerId } = req.params;
        if (!providerId) {
            return res.status(400).json({
                success: false,
                error: 'Provider ID required'
            });
        }
        const [complianceSummary, vatStatus] = await Promise.all([
            IsraeliContractorComplianceService.getComplianceSummary(providerId),
            IsraeliContractorComplianceService.checkVatThreshold(providerId)
        ]);
        res.json({
            success: true,
            data: {
                ...complianceSummary,
                vatThresholdStatus: vatStatus
            },
            legalNote: {
                he: 'סיכום ציות לחוק הישראלי 2025 - מסים, ביטוח לאומי, מע"מ',
                en: 'Israeli Law 2025 compliance summary - taxes, National Insurance, VAT'
            }
        });
    }
    catch (error) {
        logger.error('[Israeli Compliance API] Compliance summary failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
export default router;
