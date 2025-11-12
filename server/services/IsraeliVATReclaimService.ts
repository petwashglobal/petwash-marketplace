/**
 * Israeli VAT Reclaim Service (שירות החזר מע"מ)
 * 
 * Automatically calculates VAT position for PetWash Ltd:
 * - Output VAT (מע״מ עסקאות): VAT collected from customers
 * - Input VAT (מע״מ תשומות): VAT paid on business expenses
 * - Net Position: Amount to pay or refund to claim
 * 
 * Compliance: Israeli Tax Authority (רשות המסים) requirements
 * VAT Rate: 18% (standard rate as of 2025)
 * Filing: Monthly or bi-monthly depending on business size
 */

import { db } from '../db';
import { israeliExpenses, israeliVatDeclarations, transactionRecords } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { db as firestoreDb } from '../lib/firebase-admin';
import { IsraeliTaxAuthorityAPI } from './IsraeliTaxAuthorityAPI';

const VAT_RATE = 0.18; // 18% Israeli VAT (standard rate as of 2025)

export interface VATCalculationResult {
  periodStart: Date;
  periodEnd: Date;
  taxMonth: number;
  taxYear: number;
  
  // Output VAT (מע״מ עסקאות) - VAT collected from customers
  outputVAT: {
    totalRevenue: number;        // Total sales including VAT
    revenueExcludingVAT: number; // Revenue without VAT
    vatCollected: number;        // VAT amount collected
    transactionCount: number;
  };
  
  // Input VAT (מע״מ תשומות) - VAT paid on expenses
  inputVAT: {
    totalExpenses: number;       // Total expenses including VAT
    expensesExcludingVAT: number;// Expenses without VAT
    vatPaid: number;             // VAT amount paid
    expenseCount: number;
  };
  
  // Net VAT Position
  netVAT: {
    amount: number;              // Positive = owe to government, Negative = reclaim from government
    status: 'payment_due' | 'refund_due' | 'balanced';
    paymentAmount?: number;      // Amount to pay if positive
    refundAmount?: number;       // Amount to reclaim if negative
  };
  
  // Breakdown by category
  revenueBreakdown: Record<string, number>;
  expenseBreakdown: Record<string, number>;
}

export class IsraeliVATReclaimService {
  
  /**
   * Calculate VAT position for a specific month
   */
  static async calculateMonthlyVAT(year: number, month: number): Promise<VATCalculationResult> {
    logger.info(`[VAT Reclaim] Calculating VAT for ${year}-${month.toString().padStart(2, '0')}`);
    
    // Define period boundaries
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);
    
    try {
      // 1. Calculate Output VAT (מע״מ עסקאות) - VAT from sales
      const outputVAT = await this.calculateOutputVAT(periodStart, periodEnd);
      
      // 2. Calculate Input VAT (מע״מ תשומות) - VAT from expenses
      const inputVAT = await this.calculateInputVAT(periodStart, periodEnd);
      
      // 3. Calculate net VAT position
      const netVATAmount = outputVAT.vatCollected - inputVAT.vatPaid;
      
      let netVATStatus: 'payment_due' | 'refund_due' | 'balanced';
      let paymentAmount: number | undefined;
      let refundAmount: number | undefined;
      
      if (netVATAmount > 10) {
        netVATStatus = 'payment_due';
        paymentAmount = netVATAmount;
      } else if (netVATAmount < -10) {
        netVATStatus = 'refund_due';
        refundAmount = Math.abs(netVATAmount);
      } else {
        netVATStatus = 'balanced';
      }
      
      const result: VATCalculationResult = {
        periodStart,
        periodEnd,
        taxMonth: month,
        taxYear: year,
        outputVAT,
        inputVAT,
        netVAT: {
          amount: netVATAmount,
          status: netVATStatus,
          paymentAmount,
          refundAmount
        },
        revenueBreakdown: await this.getRevenueBreakdown(periodStart, periodEnd),
        expenseBreakdown: await this.getExpenseBreakdown(periodStart, periodEnd)
      };
      
      logger.info(`[VAT Reclaim] Calculation complete`, {
        month,
        year,
        outputVAT: outputVAT.vatCollected,
        inputVAT: inputVAT.vatPaid,
        netVAT: netVATAmount,
        status: netVATStatus
      });
      
      return result;
      
    } catch (error) {
      logger.error(`[VAT Reclaim] Calculation failed for ${year}-${month}`, error);
      throw error;
    }
  }
  
  /**
   * Calculate Output VAT (מע״מ עסקאות) - VAT collected from customers
   */
  private static async calculateOutputVAT(
    periodStart: Date,
    periodEnd: Date
  ): Promise<VATCalculationResult['outputVAT']> {
    
    // Query all revenue from database (transactions, bookings, etc.)
    const revenueRecords = await db
      .select()
      .from(transactionRecords)
      .where(
        and(
          gte(transactionRecords.timestamp, periodStart),
          lte(transactionRecords.timestamp, periodEnd)
        )
      );
    
    // Also get Firestore revenue (Nayax payments, marketplace transactions)
    const firestoreRevenue = await this.getFirestoreRevenue(periodStart, periodEnd);
    
    // Calculate totals - use actual columns from schema
    const postgresRevenue = revenueRecords.reduce((sum, record) => {
      const amount = parseFloat(record.totalAmount || '0');
      return sum + amount;
    }, 0);
    
    const totalRevenue = postgresRevenue + firestoreRevenue;
    const revenueExcludingVAT = totalRevenue / (1 + VAT_RATE);
    const vatCollected = totalRevenue - revenueExcludingVAT;
    
    return {
      totalRevenue,
      revenueExcludingVAT,
      vatCollected,
      transactionCount: revenueRecords.length
    };
  }
  
  /**
   * Calculate Input VAT (מע״מ תשומות) - VAT paid on expenses
   */
  private static async calculateInputVAT(
    periodStart: Date,
    periodEnd: Date
  ): Promise<VATCalculationResult['inputVAT']> {
    
    // Extract year and month from period
    const year = periodStart.getFullYear();
    const month = periodStart.getMonth() + 1;
    
    // Query approved expenses from database (using taxYear and taxMonth)
    const expenseRecords = await db
      .select()
      .from(israeliExpenses)
      .where(
        and(
          eq(israeliExpenses.taxYear, year),
          eq(israeliExpenses.taxMonth, month),
          eq(israeliExpenses.status, 'approved') // Only approved expenses
        )
      );
    
    // Calculate totals
    const totalExpenses = expenseRecords.reduce((sum, record) => {
      const amount = parseFloat(String(record.totalAmount || 0));
      return sum + amount;
    }, 0);
    
    const vatPaid = expenseRecords.reduce((sum, record) => {
      const amount = parseFloat(String(record.vatAmount || 0));
      return sum + amount;
    }, 0);
    
    const expensesExcludingVAT = totalExpenses - vatPaid;
    
    return {
      totalExpenses,
      expensesExcludingVAT,
      vatPaid,
      expenseCount: expenseRecords.length
    };
  }
  
  /**
   * Get revenue from Firestore (Nayax, marketplace transactions)
   */
  private static async getFirestoreRevenue(periodStart: Date, periodEnd: Date): Promise<number> {
    try {
      const snapshot = await firestoreDb
        .collection('transactions')
        .where('createdAt', '>=', periodStart)
        .where('createdAt', '<=', periodEnd)
        .where('status', '==', 'completed')
        .get();
      
      let total = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        total += data.totalAmount || 0;
      });
      
      return total;
    } catch (error) {
      logger.warn('[VAT Reclaim] Failed to fetch Firestore revenue, using 0', error);
      return 0;
    }
  }
  
  /**
   * Get revenue breakdown by source
   */
  private static async getRevenueBreakdown(
    periodStart: Date,
    periodEnd: Date
  ): Promise<Record<string, number>> {
    
    const breakdown: Record<string, number> = {
      'wash_stations': 0,
      'sitter_suite': 0,
      'walk_my_pet': 0,
      'pettrek_transport': 0,
      'franchise_fees': 0,
      'other': 0
    };
    
    try {
      // Get from Firestore with source categorization
      const snapshot = await firestoreDb
        .collection('transactions')
        .where('createdAt', '>=', periodStart)
        .where('createdAt', '<=', periodEnd)
        .where('status', '==', 'completed')
        .get();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const source = data.source || 'other';
        breakdown[source] = (breakdown[source] || 0) + (data.totalAmount || 0);
      });
      
    } catch (error) {
      logger.warn('[VAT Reclaim] Failed to fetch revenue breakdown', error);
    }
    
    return breakdown;
  }
  
  /**
   * Get expense breakdown by category
   */
  private static async getExpenseBreakdown(
    periodStart: Date,
    periodEnd: Date
  ): Promise<Record<string, number>> {
    
    // Extract year and month from period
    const year = periodStart.getFullYear();
    const month = periodStart.getMonth() + 1;
    
    const expenseRecords = await db
      .select()
      .from(israeliExpenses)
      .where(
        and(
          eq(israeliExpenses.taxYear, year),
          eq(israeliExpenses.taxMonth, month),
          eq(israeliExpenses.status, 'approved')
        )
      );
    
    const breakdown: Record<string, number> = {};
    
    expenseRecords.forEach(record => {
      const category = record.category || 'other';
      const amount = parseFloat(String(record.totalAmount || 0));
      breakdown[category] = (breakdown[category] || 0) + amount;
    });
    
    return breakdown;
  }
  
  /**
   * Generate and save monthly VAT declaration
   * Includes duplicate check to prevent multiple declarations for same period
   */
  static async generateMonthlyDeclaration(year: number, month: number): Promise<number> {
    logger.info(`[VAT Reclaim] Generating VAT declaration for ${year}-${month.toString().padStart(2, '0')}`);
    
    // Check for existing declaration (idempotency)
    const existing = await db
      .select()
      .from(israeliVatDeclarations)
      .where(
        and(
          eq(israeliVatDeclarations.taxYear, year),
          eq(israeliVatDeclarations.taxMonth, month)
        )
      );
    
    if (existing.length > 0) {
      logger.warn(`[VAT Reclaim] Declaration already exists for ${year}-${month.toString().padStart(2, '0')}`, {
        declarationId: existing[0].declarationId
      });
      return existing[0].id;
    }
    
    // Calculate VAT
    const vatCalculation = await this.calculateMonthlyVAT(year, month);
    
    // Generate declaration ID
    const declarationId = `VAT-${year}-${month.toString().padStart(2, '0')}-${Date.now().toString().slice(-6)}`;
    
    // Save to database
    const [declaration] = await db.insert(israeliVatDeclarations).values({
      declarationId,
      taxYear: year,
      taxMonth: month,
      periodStart: vatCalculation.periodStart,
      periodEnd: vatCalculation.periodEnd,
      
      // Output VAT
      totalRevenue: vatCalculation.outputVAT.totalRevenue,
      revenueExcludingVat: vatCalculation.outputVAT.revenueExcludingVAT,
      outputVat: vatCalculation.outputVAT.vatCollected,
      
      // Input VAT
      totalExpenses: vatCalculation.inputVAT.totalExpenses,
      expensesExcludingVat: vatCalculation.inputVAT.expensesExcludingVAT,
      inputVat: vatCalculation.inputVAT.vatPaid,
      
      // Net VAT
      netVatPosition: vatCalculation.netVAT.amount,
      vatToPay: vatCalculation.netVAT.paymentAmount || 0,
      vatToReclaim: vatCalculation.netVAT.refundAmount || 0,
      
      status: 'draft',
      createdBy: 'system-auto'
    }).returning();
    
    logger.info(`[VAT Reclaim] Declaration generated: ${declarationId}`, {
      netVAT: vatCalculation.netVAT.amount,
      status: vatCalculation.netVAT.status
    });
    
    return declaration.id;
  }
  
  /**
   * Submit VAT declaration to Israeli Tax Authority
   * Requires API credentials configured in environment
   * 
   * @param declarationId Database ID of the declaration
   * @param submitToTaxAuthority If true, automatically submit to Tax Authority API
   * @returns Tax Authority response with reference number
   */
  static async submitToTaxAuthority(declarationId: number, autoSubmit: boolean = false): Promise<{
    success: boolean;
    taxAuthorityReference?: string;
    message?: string;
  }> {
    try {
      // Get declaration from database
      const [declaration] = await db
        .select()
        .from(israeliVatDeclarations)
        .where(eq(israeliVatDeclarations.id, declarationId));
      
      if (!declaration) {
        throw new Error(`Declaration ${declarationId} not found`);
      }
      
      // Check if already submitted
      if (declaration.submittedToTaxAuthority) {
        logger.warn(`[VAT Reclaim] Declaration already submitted to Tax Authority`, {
          declarationId: declaration.declarationId,
          reference: declaration.taxAuthorityReference
        });
        return {
          success: true,
          taxAuthorityReference: declaration.taxAuthorityReference || undefined,
          message: 'Already submitted'
        };
      }
      
      // Check if Tax Authority API is configured
      if (!IsraeliTaxAuthorityAPI.isConfigured()) {
        logger.warn('[VAT Reclaim] Tax Authority API not configured, skipping submission');
        return {
          success: false,
          message: 'Tax Authority API not configured. Please set ISRAELI_TAX_API_CLIENT_ID and ISRAELI_TAX_API_CLIENT_SECRET environment secrets.'
        };
      }
      
      // Skip automatic submission unless explicitly enabled
      if (!autoSubmit) {
        logger.info('[VAT Reclaim] Manual submission required - autoSubmit is disabled');
        return {
          success: false,
          message: 'Manual submission required. Set autoSubmit=true to submit automatically.'
        };
      }
      
      // Prepare submission data
      const companyId = process.env.ISRAELI_COMPANY_ID || 'PETWASH_LTD';
      const reportingPeriod = `${declaration.taxYear}-${declaration.taxMonth.toString().padStart(2, '0')}`;
      
      // Map internal status to Tax Authority API enum
      const netVatAmount = parseFloat(String(declaration.netVatPosition || 0));
      let apiStatus: 'payment_due' | 'refund_eligible' | 'zero';
      
      if (netVatAmount > 0) {
        apiStatus = 'payment_due';
      } else if (netVatAmount < 0) {
        apiStatus = 'refund_eligible'; // API expects "refund_eligible", not "refund_due"
      } else {
        apiStatus = 'zero'; // API expects "zero", not "balanced"
      }
      
      // Round all amounts to 2 decimal places (shekel precision)
      const round = (num: number) => Math.round(num * 100) / 100;
      
      const submission = {
        taxYear: declaration.taxYear,
        taxMonth: declaration.taxMonth,
        reportingPeriod,
        companyId,
        outputVAT: {
          totalRevenue: round(parseFloat(String(declaration.totalRevenue || 0))),
          revenueExcludingVAT: round(parseFloat(String(declaration.revenueExcludingVat || 0))),
          vatCollected: round(parseFloat(String(declaration.outputVat || 0))),
          transactionCount: declaration.outputVatTransactionCount || 0,
        },
        inputVAT: {
          totalExpenses: round(parseFloat(String(declaration.totalExpenses || 0))),
          expensesExcludingVAT: round(parseFloat(String(declaration.expensesExcludingVat || 0))),
          vatPaid: round(parseFloat(String(declaration.inputVat || 0))),
          expenseCount: declaration.inputVatExpenseCount || 0,
        },
        netVAT: {
          amount: round(netVatAmount),
          status: apiStatus,
        },
      };
      
      // Submit to Tax Authority
      logger.info('[VAT Reclaim] Submitting to Israeli Tax Authority...', {
        period: reportingPeriod,
        netVAT: submission.netVAT.amount
      });
      
      const response = await IsraeliTaxAuthorityAPI.submitVATDeclaration(submission);
      
      if (response.success) {
        // Update declaration with Tax Authority response
        await db
          .update(israeliVatDeclarations)
          .set({
            submittedToTaxAuthority: true,
            submittedAt: new Date(),
            taxAuthorityReference: response.referenceNumber,
            taxAuthorityResponse: response as any,
            declarationStatus: response.status === 'accepted' ? 'approved' : 'pending',
            paymentDueDate: response.paymentDueDate,
            updatedAt: new Date(),
          })
          .where(eq(israeliVatDeclarations.id, declarationId));
        
        logger.info('[VAT Reclaim] Successfully submitted to Tax Authority', {
          declarationId: declaration.declarationId,
          referenceNumber: response.referenceNumber,
          status: response.status
        });
        
        return {
          success: true,
          taxAuthorityReference: response.referenceNumber,
          message: `Successfully submitted. Reference: ${response.referenceNumber}`
        };
      } else {
        logger.error('[VAT Reclaim] Tax Authority rejected submission', {
          declarationId: declaration.declarationId,
          errors: response.errors
        });
        
        return {
          success: false,
          message: response.message || 'Submission rejected by Tax Authority'
        };
      }
      
    } catch (error) {
      logger.error('[VAT Reclaim] Failed to submit to Tax Authority', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Generate VAT report for Israeli Tax Authority (רשות המסים)
   */
  static generateVATReportHTML(vatCalculation: VATCalculationResult): string {
    const formatCurrency = (amount: number) => `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const periodLabel = `${vatCalculation.taxMonth}/${vatCalculation.taxYear}`;
    
    return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>דוח מע״מ - ${periodLabel}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #0066cc; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0; color: #0066cc; }
        .section { margin: 30px 0; }
        .section h2 { background: #0066cc; color: white; padding: 10px; margin-bottom: 15px; }
        .summary-box { background: #f0f7ff; border: 2px solid #0066cc; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .summary-box.refund { background: #e8f5e9; border-color: #4caf50; }
        .summary-box.payment { background: #fff3e0; border-color: #ff9800; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; border: 1px solid #ddd; text-align: right; }
        th { background: #f5f5f5; font-weight: bold; }
        .amount { font-weight: bold; color: #0066cc; }
        .refund-amount { font-weight: bold; color: #4caf50; font-size: 1.2em; }
        .payment-amount { font-weight: bold; color: #ff9800; font-size: 1.2em; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐾 דוח מע״מ - Pet Wash Ltd</h1>
            <p>חברת פטוואש בע״מ</p>
            <p>תקופת הדיווח: ${periodLabel}</p>
        </div>
        
        <!-- VAT Summary -->
        <div class="section">
            <h2>סיכום מע״מ</h2>
            <div class="summary-box ${vatCalculation.netVAT.status === 'refund_due' ? 'refund' : vatCalculation.netVAT.status === 'payment_due' ? 'payment' : ''}">
                ${vatCalculation.netVAT.status === 'refund_due' ? `
                    <h3 style="margin-top:0;color:#4caf50;">💰 זכאות להחזר מע״מ</h3>
                    <p class="refund-amount">סכום להחזר: ${formatCurrency(vatCalculation.netVAT.refundAmount || 0)}</p>
                ` : vatCalculation.netVAT.status === 'payment_due' ? `
                    <h3 style="margin-top:0;color:#ff9800;">💳 תשלום מע״מ לרשות המסים</h3>
                    <p class="payment-amount">סכום לתשלום: ${formatCurrency(vatCalculation.netVAT.paymentAmount || 0)}</p>
                ` : `
                    <h3 style="margin-top:0;">✅ מאוזן</h3>
                    <p>אין תשלום או החזר</p>
                `}
            </div>
        </div>
        
        <!-- Output VAT (Sales) -->
        <div class="section">
            <h2>מע״מ עסקאות (מכירות)</h2>
            <table>
                <tr>
                    <th>תיאור</th>
                    <th>סכום</th>
                </tr>
                <tr>
                    <td>סה״כ הכנסות (כולל מע״מ)</td>
                    <td class="amount">${formatCurrency(vatCalculation.outputVAT.totalRevenue)}</td>
                </tr>
                <tr>
                    <td>הכנסות ללא מע״מ</td>
                    <td>${formatCurrency(vatCalculation.outputVAT.revenueExcludingVAT)}</td>
                </tr>
                <tr style="background:#e3f2fd;">
                    <td><strong>מע״מ שנגבה (18%)</strong></td>
                    <td class="amount">${formatCurrency(vatCalculation.outputVAT.vatCollected)}</td>
                </tr>
                <tr>
                    <td>מספר עסקאות</td>
                    <td>${vatCalculation.outputVAT.transactionCount}</td>
                </tr>
            </table>
        </div>
        
        <!-- Input VAT (Expenses) -->
        <div class="section">
            <h2>מע״מ תשומות (הוצאות)</h2>
            <table>
                <tr>
                    <th>תיאור</th>
                    <th>סכום</th>
                </tr>
                <tr>
                    <td>סה״כ הוצאות (כולל מע״מ)</td>
                    <td class="amount">${formatCurrency(vatCalculation.inputVAT.totalExpenses)}</td>
                </tr>
                <tr>
                    <td>הוצאות ללא מע״מ</td>
                    <td>${formatCurrency(vatCalculation.inputVAT.expensesExcludingVAT)}</td>
                </tr>
                <tr style="background:#e8f5e9;">
                    <td><strong>מע״מ ששולם (18%)</strong></td>
                    <td class="amount">${formatCurrency(vatCalculation.inputVAT.vatPaid)}</td>
                </tr>
                <tr>
                    <td>מספר הוצאות מאושרות</td>
                    <td>${vatCalculation.inputVAT.expenseCount}</td>
                </tr>
            </table>
        </div>
        
        <!-- Net VAT Calculation -->
        <div class="section">
            <h2>חישוב מע״מ נטו</h2>
            <table>
                <tr>
                    <td>מע״מ עסקאות (שנגבה מלקוחות)</td>
                    <td class="amount">${formatCurrency(vatCalculation.outputVAT.vatCollected)}</td>
                </tr>
                <tr>
                    <td>מע״מ תשומות (ששולם לספקים)</td>
                    <td class="amount">(${formatCurrency(vatCalculation.inputVAT.vatPaid)})</td>
                </tr>
                <tr style="background:#fff3cd; font-size:1.1em;">
                    <td><strong>מע״מ נטו</strong></td>
                    <td class="amount">${formatCurrency(vatCalculation.netVAT.amount)}</td>
                </tr>
            </table>
        </div>
        
        <div class="footer">
            <p>דוח זה נוצר אוטומטית על ידי מערכת החשבונאות של Pet Wash™</p>
            <p>לשאלות: Support@PetWash.co.il</p>
        </div>
    </div>
</body>
</html>
    `;
  }
}
