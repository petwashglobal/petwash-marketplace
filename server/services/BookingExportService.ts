/**
 * Booking Export & AI Bookkeeping Service
 * 
 * Exports all booking transactions to Google Sheets for accounting
 * AI classification using Gemini for tax categorization
 * Israeli compliance 2025/2026 ready
 */

import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';
import { db } from '../db';
import { bookingRequests } from '@shared/schema';
import { eq, gte, and, isNotNull } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { format } from 'date-fns';

const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const ACCOUNTING_SPREADSHEET_ID = process.env.ACCOUNTING_SPREADSHEET_ID;

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Sheet names for accounting
const ACCOUNTING_SHEETS = {
  TRANSACTIONS: 'Booking Transactions',
  REVENUE: 'Revenue Summary',
  VAT_REPORT: 'VAT Report',
  PROVIDER_PAYOUTS: 'Provider Payouts',
  ESCROW_TRACKING: 'Escrow Status',
  COMPLIANCE: 'Tax Compliance',
} as const;

interface ExportResult {
  success: boolean;
  exportedCount: number;
  spreadsheetUrl?: string;
  errors: string[];
}

interface AIClassification {
  revenueType: 'service_commission' | 'platform_fee' | 'cancellation_fee' | 'other';
  vatCategory: 'standard_17' | 'exempt' | 'reduced';
  taxDeductible: boolean;
  expenseCategory?: string;
  confidence: number;
  notes: string;
}

interface ComplianceReport {
  period: string;
  totalRevenue: number;
  vatCollected: number;
  providerPayouts: number;
  platformFees: number;
  escrowHeld: number;
  withholdingTax: number;
  nationalInsurance: number;
}

let sheetsClient: any = null;
let spreadsheetId: string | null = null;

/**
 * Initialize Google Sheets client for accounting
 */
async function initializeAccountingSheets(): Promise<boolean> {
  if (sheetsClient && spreadsheetId) return true;

  if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
    logger.warn('[BookingExport] Google service account not configured');
    return false;
  }

  try {
    const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: authClient as any });

    // Create new accounting spreadsheet if not configured
    if (!ACCOUNTING_SPREADSHEET_ID || ACCOUNTING_SPREADSHEET_ID === 'CREATE_NEW') {
      spreadsheetId = await createAccountingSpreadsheet();
    } else {
      spreadsheetId = ACCOUNTING_SPREADSHEET_ID;
    }

    logger.info('[BookingExport] ✅ Accounting sheets initialized');
    return true;
  } catch (error) {
    logger.error('[BookingExport] Initialization error:', error);
    return false;
  }
}

/**
 * Create accounting spreadsheet with all required sheets
 */
async function createAccountingSpreadsheet(): Promise<string> {
  const response = await sheetsClient.spreadsheets.create({
    requestBody: {
      properties: {
        title: '⁦Pet Wash™⁩ Accounting - הנהלת חשבונות',
      },
      sheets: Object.values(ACCOUNTING_SHEETS).map(sheetName => ({
        properties: { title: sheetName },
      })),
    },
  });

  const newSpreadsheetId = response.data.spreadsheetId;
  
  // Initialize headers
  await initializeAccountingHeaders(newSpreadsheetId);
  
  logger.info(`[BookingExport] ✅ Created accounting spreadsheet: ${newSpreadsheetId}`);
  return newSpreadsheetId;
}

/**
 * Initialize headers for accounting sheets
 */
async function initializeAccountingHeaders(ssId: string) {
  const headers = {
    [ACCOUNTING_SHEETS.TRANSACTIONS]: [
      'Transaction Date', 'Request ID', 'Service Type', 'Provider Type',
      'Owner ID', 'Provider ID', 'Start Date', 'End Date',
      'Subtotal (₪)', 'Service Fee (₪)', 'Total (₪)', 'Currency',
      'Status', 'Payment Method', 'Payment Date', 'Released Date',
      'AI Category', 'VAT Category', 'VAT Amount (₪)', 'Confidence'
    ],
    [ACCOUNTING_SHEETS.REVENUE]: [
      'Period', 'Total Bookings', 'Gross Revenue (₪)', 'Platform Fees (₪)',
      'Provider Payouts (₪)', 'Net Revenue (₪)', 'Growth %'
    ],
    [ACCOUNTING_SHEETS.VAT_REPORT]: [
      'Period', 'Taxable Revenue (₪)', 'VAT Rate', 'VAT Collected (₪)',
      'Input VAT (₪)', 'Net VAT Payable (₪)', 'Report Status'
    ],
    [ACCOUNTING_SHEETS.PROVIDER_PAYOUTS]: [
      'Payout Date', 'Provider ID', 'Provider Type', 'Booking IDs',
      'Gross Amount (₪)', 'Withholding Tax (₪)', 'Net Payout (₪)',
      'Tax Certificate', 'Status'
    ],
    [ACCOUNTING_SHEETS.ESCROW_TRACKING]: [
      'Request ID', 'Owner ID', 'Provider ID', 'Amount (₪)',
      'Held Date', 'Expected Release', 'Actual Release', 'Status', 'Days Held'
    ],
    [ACCOUNTING_SHEETS.COMPLIANCE]: [
      'Period', 'Report Type', 'Due Date', 'Amount (₪)',
      'Status', 'Submitted Date', 'Reference Number', 'Notes'
    ],
  };

  for (const [sheetName, headerRow] of Object.entries(headers)) {
    try {
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId: ssId,
        range: `'${sheetName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headerRow],
        },
      });
    } catch (error) {
      logger.error(`[BookingExport] Error initializing headers for ${sheetName}:`, error);
    }
  }
}

/**
 * AI Classification using Gemini for booking transactions
 */
async function classifyTransactionWithAI(booking: any): Promise<AIClassification> {
  if (!ai) {
    return {
      revenueType: 'platform_fee',
      vatCategory: 'standard_17',
      taxDeductible: false,
      confidence: 0.5,
      notes: 'AI not configured - using default classification'
    };
  }

  try {
    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `You are an Israeli certified public accountant (רואה חשבון מוסמך) for ⁦Pet Wash™⁩.
    
Classify this booking transaction for Israeli tax compliance 2025:

Transaction Details:
- Service Type: ${booking.serviceType}
- Provider Type: ${booking.providerType}
- Subtotal: ₪${(booking.subtotalCents / 100).toFixed(2)}
- Platform Fee: ₪${(booking.serviceFeeCents / 100).toFixed(2)}
- Total: ₪${(booking.totalCents / 100).toFixed(2)}
- Status: ${booking.status}
- Payment Held: ${booking.paymentHeldAt ? 'Yes' : 'No'}
- Payment Released: ${booking.paymentReleasedAt ? 'Yes' : 'No'}

Return JSON with these fields:
{
  "revenueType": "service_commission" | "platform_fee" | "cancellation_fee" | "other",
  "vatCategory": "standard_17" | "exempt" | "reduced",
  "taxDeductible": boolean,
  "expenseCategory": string or null,
  "confidence": number (0-1),
  "notes": "brief accounting notes for this transaction"
}

Israeli Tax Context 2025:
- Standard VAT rate: 17%
- Platform fee is service commission (עמלת שירות)
- Provider payouts are pass-through (not our revenue)
- Escrow held funds are liability until released
- Report requirements per רשות המסים regulations`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const classification: AIClassification = JSON.parse(text);
    
    logger.info('[BookingExport] AI classified transaction', {
      requestId: booking.requestId,
      revenueType: classification.revenueType,
      confidence: classification.confidence
    });
    
    return classification;
  } catch (error: any) {
    logger.error('[BookingExport] AI classification failed:', error);
    return {
      revenueType: 'platform_fee',
      vatCategory: 'standard_17',
      taxDeductible: false,
      confidence: 0.3,
      notes: `AI error: ${error.message}`
    };
  }
}

/**
 * Export all booking transactions to Google Sheets
 */
export async function exportBookingsToSheets(
  fromDate?: Date,
  includeAIClassification: boolean = true
): Promise<ExportResult> {
  const errors: string[] = [];
  
  const initialized = await initializeAccountingSheets();
  if (!initialized || !spreadsheetId) {
    return {
      success: false,
      exportedCount: 0,
      errors: ['Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and ACCOUNTING_SPREADSHEET_ID']
    };
  }

  try {
    // Fetch bookings from database
    let bookings;
    if (fromDate) {
      bookings = await db.select().from(bookingRequests)
        .where(gte(bookingRequests.createdAt, fromDate));
    } else {
      bookings = await db.select().from(bookingRequests);
    }

    logger.info(`[BookingExport] Exporting ${bookings.length} bookings`);

    const rows: any[][] = [];
    
    for (const booking of bookings) {
      // AI classification (optional)
      let classification: AIClassification | null = null;
      if (includeAIClassification) {
        classification = await classifyTransactionWithAI(booking);
      }

      const vatRate = classification?.vatCategory === 'standard_17' ? 0.17 : 0;
      const vatAmount = (booking.serviceFeeCents / 100) * vatRate;

      rows.push([
        booking.createdAt ? format(new Date(booking.createdAt), 'yyyy-MM-dd HH:mm') : '',
        booking.requestId,
        booking.serviceType,
        booking.providerType,
        booking.ownerId,
        booking.providerId,
        booking.startDate ? format(new Date(booking.startDate), 'yyyy-MM-dd') : '',
        booking.endDate ? format(new Date(booking.endDate), 'yyyy-MM-dd') : '',
        (booking.subtotalCents / 100).toFixed(2),
        (booking.serviceFeeCents / 100).toFixed(2),
        (booking.totalCents / 100).toFixed(2),
        booking.currency,
        booking.status,
        booking.paymentMethod || '',
        booking.paymentHeldAt ? format(new Date(booking.paymentHeldAt), 'yyyy-MM-dd') : '',
        booking.paymentReleasedAt ? format(new Date(booking.paymentReleasedAt), 'yyyy-MM-dd') : '',
        classification?.revenueType || '',
        classification?.vatCategory || '',
        vatAmount.toFixed(2),
        classification?.confidence?.toFixed(2) || ''
      ]);
    }

    // Append to transactions sheet
    if (rows.length > 0) {
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range: `'${ACCOUNTING_SHEETS.TRANSACTIONS}'!A2`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows },
      });
    }

    return {
      success: true,
      exportedCount: rows.length,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      errors
    };
  } catch (error: any) {
    logger.error('[BookingExport] Export failed:', error);
    return {
      success: false,
      exportedCount: 0,
      errors: [error.message]
    };
  }
}

/**
 * Generate Israeli compliance report
 */
export async function generateComplianceReport(
  year: number,
  month: number
): Promise<ComplianceReport> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const bookings = await db.select().from(bookingRequests)
    .where(and(
      gte(bookingRequests.createdAt, startDate),
      isNotNull(bookingRequests.paymentHeldAt)
    ));

  const completedBookings = bookings.filter(b => 
    ['completed', 'reviewed'].includes(b.status)
  );
  const escrowBookings = bookings.filter(b => 
    b.paymentHeldAt && !b.paymentReleasedAt
  );

  const totalRevenue = completedBookings.reduce((sum, b) => sum + b.totalCents, 0) / 100;
  const platformFees = completedBookings.reduce((sum, b) => sum + b.serviceFeeCents, 0) / 100;
  const providerPayouts = completedBookings.reduce((sum, b) => sum + b.subtotalCents, 0) / 100;
  const escrowHeld = escrowBookings.reduce((sum, b) => sum + b.totalCents, 0) / 100;
  
  // Israeli tax calculations
  const vatRate = 0.17;
  const vatCollected = platformFees * vatRate;
  const withholdingRate = 0.20; // Default 20% unless provider has exemption certificate
  const withholdingTax = providerPayouts * withholdingRate;
  const nationalInsurance = platformFees * 0.0597; // 5.97% reduced rate

  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    totalRevenue,
    vatCollected,
    providerPayouts,
    platformFees,
    escrowHeld,
    withholdingTax,
    nationalInsurance
  };
}

/**
 * Export compliance report to Google Sheets
 */
export async function exportComplianceReport(
  year: number,
  month: number
): Promise<ExportResult> {
  const initialized = await initializeAccountingSheets();
  if (!initialized || !spreadsheetId) {
    return {
      success: false,
      exportedCount: 0,
      errors: ['Google Sheets not configured']
    };
  }

  try {
    const report = await generateComplianceReport(year, month);

    // Export to VAT Report sheet
    const vatRow = [
      report.period,
      report.platformFees.toFixed(2),
      '17%',
      report.vatCollected.toFixed(2),
      '0.00', // Input VAT (calculated separately)
      report.vatCollected.toFixed(2),
      'Pending'
    ];

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `'${ACCOUNTING_SHEETS.VAT_REPORT}'!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [vatRow] },
    });

    // Export to Compliance sheet
    const now = new Date();
    const dueDate = new Date(year, month, 23); // VAT due by 23rd of following month
    
    const complianceRows = [
      [report.period, 'VAT Report (דו"ח מע"מ)', format(dueDate, 'yyyy-MM-dd'), report.vatCollected.toFixed(2), 'Pending', '', '', ''],
      [report.period, 'Withholding Tax (ניכוי מס במקור)', format(dueDate, 'yyyy-MM-dd'), report.withholdingTax.toFixed(2), 'Pending', '', '', ''],
      [report.period, 'National Insurance (ביטוח לאומי)', format(new Date(year, month, 15), 'yyyy-MM-dd'), report.nationalInsurance.toFixed(2), 'Pending', '', '', ''],
    ];

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `'${ACCOUNTING_SHEETS.COMPLIANCE}'!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: complianceRows },
    });

    // Export Revenue Summary
    const revenueRow = [
      report.period,
      await getBookingCount(year, month),
      report.totalRevenue.toFixed(2),
      report.platformFees.toFixed(2),
      report.providerPayouts.toFixed(2),
      (report.platformFees - report.vatCollected - report.nationalInsurance).toFixed(2),
      '0%' // Growth calculated separately
    ];

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `'${ACCOUNTING_SHEETS.REVENUE}'!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [revenueRow] },
    });

    logger.info('[BookingExport] Compliance report exported', { period: report.period });

    return {
      success: true,
      exportedCount: 4, // VAT + 3 compliance rows
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      errors: []
    };
  } catch (error: any) {
    logger.error('[BookingExport] Compliance export failed:', error);
    return {
      success: false,
      exportedCount: 0,
      errors: [error.message]
    };
  }
}

async function getBookingCount(year: number, month: number): Promise<number> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const bookings = await db.select().from(bookingRequests)
    .where(gte(bookingRequests.createdAt, startDate));
    
  return bookings.filter(b => new Date(b.createdAt!) <= endDate).length;
}

/**
 * Export escrow tracking
 */
export async function exportEscrowStatus(): Promise<ExportResult> {
  const initialized = await initializeAccountingSheets();
  if (!initialized || !spreadsheetId) {
    return {
      success: false,
      exportedCount: 0,
      errors: ['Google Sheets not configured']
    };
  }

  try {
    const escrowBookings = await db.select().from(bookingRequests)
      .where(isNotNull(bookingRequests.paymentHeldAt));

    const rows = escrowBookings.map(b => {
      const heldDate = b.paymentHeldAt ? new Date(b.paymentHeldAt) : null;
      const releasedDate = b.paymentReleasedAt ? new Date(b.paymentReleasedAt) : null;
      const now = new Date();
      const daysHeld = heldDate 
        ? Math.floor((releasedDate || now).getTime() - heldDate.getTime()) / (1000 * 60 * 60 * 24)
        : 0;

      return [
        b.requestId,
        b.ownerId,
        b.providerId,
        (b.totalCents / 100).toFixed(2),
        heldDate ? format(heldDate, 'yyyy-MM-dd') : '',
        b.endDate ? format(new Date(b.endDate), 'yyyy-MM-dd') : '',
        releasedDate ? format(releasedDate, 'yyyy-MM-dd') : '',
        releasedDate ? 'Released' : 'Held',
        daysHeld.toFixed(0)
      ];
    });

    if (rows.length > 0) {
      // Clear existing data first
      await sheetsClient.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${ACCOUNTING_SHEETS.ESCROW_TRACKING}'!A2:I1000`,
      });

      await sheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range: `'${ACCOUNTING_SHEETS.ESCROW_TRACKING}'!A2`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows },
      });
    }

    return {
      success: true,
      exportedCount: rows.length,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      errors: []
    };
  } catch (error: any) {
    return {
      success: false,
      exportedCount: 0,
      errors: [error.message]
    };
  }
}

export const BookingExportService = {
  exportBookingsToSheets,
  generateComplianceReport,
  exportComplianceReport,
  exportEscrowStatus,
  classifyTransactionWithAI,
};
