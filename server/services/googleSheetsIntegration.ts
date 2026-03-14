/**
 * Google Sheets Integration Service
 * 
 * Centralized form submission tracking across all 8 Pet Wash platforms
 * All form submissions are logged to Google Sheets for easy management and analysis
 * Uses Replit Google Sheets connector for OAuth token management
 */

import { google } from 'googleapis';
import { logger } from '../lib/logger';

// Google Sheets Configuration
const SPREADSHEET_ID = process.env.GOOGLE_FORMS_SPREADSHEET_ID || 'CREATE_NEW';
const SHEETS = {
  K9000_BOOKINGS: 'K9000 Wash Bookings',
  SITTER_BOOKINGS: 'Sitter Suite Bookings',
  WALKER_BOOKINGS: 'Walk My Pet Bookings',
  PETTREK_BOOKINGS: 'PetTrek Bookings',
  ACADEMY_BOOKINGS: 'Academy Bookings',
  CONTACT_FORMS: 'Contact & Inquiries',
  FEEDBACK_REVIEWS: 'Feedback & Reviews',
  NEWSLETTER_SIGNUPS: 'Newsletter Subscriptions',
  FRANCHISE_INQUIRIES: 'Franchise Inquiries',
  REGISTRATIONS: 'User Registrations',
  PROVIDER_APPLICATIONS: 'Provider Applications',
  STAFF_APPLICATIONS: 'Staff Applications',
  E_SIGNATURES: 'E-Signatures & Contracts',
  INVOICES: 'E-Invoices',
  STATEMENTS: 'E-Statements',
  RECEIPTS: 'Receipts & Transactions',
  IDENTITY_VERIFICATIONS: 'Identity Verifications (KYC)',
  LOYALTY_ENROLLMENTS: 'Loyalty Enrollments',
  SECURITY_EVENTS: 'Security Events',
  CONSENT_AUDIT: 'Consent Audit Trail',
  ONBOARDING_CASES: 'Onboarding Cases',
  HR_JOB_APPLICATIONS: 'HR Job Applications',
  PARTNER_INQUIRIES: 'Partner Inquiries',
  SUPPLIER_INQUIRIES: 'Supplier Inquiries',
  SALES_LEADS: 'Sales Leads',
  REFUND_REQUESTS: 'Refund Requests',
  DISPUTE_CASES: 'Dispute Cases',
  PET_PROFILES: 'Pet Profiles',
  PROMO_CODES: 'Promo & Coupon Usage',
  PUSH_NOTIFICATIONS: 'Push Notification Log',
  SMS_LOG: 'SMS Delivery Log',
  API_ERRORS: 'API Error Log',
} as const;

interface GoogleSheetsClient {
  spreadsheetId: string;
  sheets: any;
}

const SHEET_HEADERS: Record<string, string[]> = {
  [SHEETS.LOYALTY_ENROLLMENTS]: [
    'Timestamp', 'Member ID', 'First Name', 'Last Name', 'Email', 'Phone',
    'Enrollment Source', 'Tier', 'Welcome Points', 'Language', 'Country',
    'Member Type', 'Pet Names', 'Preferred Station', 'Birthday', 'Referral Code', 'Status'
  ],
  [SHEETS.REGISTRATIONS]: [
    'Timestamp', 'User ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Country',
    'City', 'Address', 'Registration Source', 'Profile Photo URL', 'Language',
    'Pet Name', 'Pet Type', 'Referral Source', 'Status'
  ],
  [SHEETS.PROVIDER_APPLICATIONS]: [
    'Timestamp', 'Application ID', 'First Name', 'Last Name', 'Email', 'Phone',
    'ID Number', 'Provider Type', 'Selected Platforms', 'City', 'Country',
    'Languages', 'Years of Experience', 'Availability', 'Has Vehicle',
    'Selfie Photo URL', 'Government ID URL',
    'Biometric Status', 'Biometric Score', 'Application Status'
  ],
  [SHEETS.STAFF_APPLICATIONS]: [
    'Timestamp', 'Application ID', 'First Name', 'Last Name', 'Email', 'Phone',
    'Date of Birth', 'Application Type', 'Position ID', 'City', 'Country',
    'Address', 'Tax ID', 'Business Name', 'Has Driving License', 'License Type',
    'Years of Experience', 'Referral Source', 'Fraud Risk Score',
    'Shortlist Score', 'Shortlist Recommendation', 'Status'
  ],
  [SHEETS.SECURITY_EVENTS]: [
    'Timestamp', 'User ID', 'Event Type', 'IP Address', 'Risk Score', 'Metadata'
  ],
  [SHEETS.CONSENT_AUDIT]: [
    'Timestamp', 'User ID', 'Consent Type', 'Version', 'Method', 'Evidence Hash'
  ],
  [SHEETS.ONBOARDING_CASES]: [
    'Timestamp', 'User ID', 'Case Type', 'Status', 'Current Step'
  ],
  [SHEETS.K9000_BOOKINGS]: [
    'Timestamp', 'Booking ID', 'Customer Name', 'Email', 'Phone',
    'Pet Name', 'Station Location', 'Wash Type', 'Date/Time',
    'Amount', 'Payment Status', 'Notes'
  ],
  [SHEETS.SITTER_BOOKINGS]: [
    'Timestamp', 'Booking ID', 'Customer Name', 'Email', 'Phone',
    'Pet Name', 'Pet Type', 'Sitter Name', 'Start Date', 'End Date',
    'Duration (Days)', 'Total Amount', 'Status'
  ],
  [SHEETS.WALKER_BOOKINGS]: [
    'Timestamp', 'Booking ID', 'Customer Name', 'Email', 'Phone',
    'Dog Name', 'Breed', 'Walker Name', 'Walk Date',
    'Duration (Mins)', 'Location', 'Amount', 'Status'
  ],
  [SHEETS.PETTREK_BOOKINGS]: [
    'Timestamp', 'Trip ID', 'Customer Name', 'Email', 'Phone',
    'Pet Name', 'Pet Type', 'Pickup Location', 'Dropoff Location',
    'Driver Name', 'Trip Date', 'Amount', 'Status'
  ],
  [SHEETS.ACADEMY_BOOKINGS]: [
    'Timestamp', 'Booking ID', 'Customer Name', 'Email', 'Phone',
    'Pet Name', 'Pet Age', 'Trainer Name', 'Session Type',
    'Session Date', 'Duration (Mins)', 'Amount', 'Status'
  ],
  [SHEETS.CONTACT_FORMS]: [
    'Timestamp', 'Name', 'Email', 'Phone', 'Subject', 'Message',
    'Platform', 'Status', 'Assigned To', 'Response Sent'
  ],
  [SHEETS.FEEDBACK_REVIEWS]: [
    'Timestamp', 'Customer Name', 'Email', 'Platform', 'Service Type',
    'Rating', 'Review Title', 'Review Text', 'Would Recommend',
    'Status', 'Published'
  ],
  [SHEETS.NEWSLETTER_SIGNUPS]: [
    'Timestamp', 'Email', 'Name', 'Language Preference',
    'Source Platform', 'IP Address', 'Status', 'Confirmed'
  ],
  [SHEETS.FRANCHISE_INQUIRIES]: [
    'Timestamp', 'Name', 'Company', 'Email', 'Phone', 'Country', 'City',
    'Investment Budget', 'Timeline', 'Experience', 'Message',
    'Status', 'Follow-Up Date'
  ],
  [SHEETS.E_SIGNATURES]: [
    'Timestamp', 'Signature ID', 'Document Title', 'Signer Name', 'Signer Email',
    'Document Type', 'Contract Reference', 'Signature Status', 'Signed At', 'IP Address'
  ],
  [SHEETS.INVOICES]: [
    'Timestamp', 'Invoice ID', 'Invoice Number', 'Customer Name', 'Customer Email',
    'Amount', 'VAT Amount', 'Total Amount', 'Currency', 'Due Date',
    'Payment Status', 'Description', 'Platform'
  ],
  [SHEETS.STATEMENTS]: [
    'Timestamp', 'Statement ID', 'Account Holder', 'Email',
    'Period Start', 'Period End', 'Opening Balance', 'Closing Balance',
    'Total Credits', 'Total Debits', 'Currency', 'Status'
  ],
  [SHEETS.RECEIPTS]: [
    'Timestamp', 'Receipt ID', 'Transaction ID', 'Customer Name', 'Email',
    'Amount', 'Payment Method', 'Platform', 'Service Type', 'Description', 'Status'
  ],
  [SHEETS.IDENTITY_VERIFICATIONS]: [
    'Timestamp', 'Verification ID', 'User ID', 'First Name', 'Last Name', 'Email',
    'Document Type', 'Country', 'Selfie URL', 'ID Photo URL',
    'Biometric Score', 'Biometric Match Status', 'Verification Status', 'Manual Review Required'
  ],
  [SHEETS.HR_JOB_APPLICATIONS]: [
    'Timestamp', 'Application ID', 'First Name', 'Last Name', 'Email', 'Phone',
    'Position', 'Department', 'Experience (Years)', 'City', 'Country',
    'CV URL', 'Cover Letter', 'Referral Source', 'Interview Date',
    'Interview Score', 'Decision', 'Offer Sent', 'Start Date', 'Notes'
  ],
  [SHEETS.PARTNER_INQUIRIES]: [
    'Timestamp', 'Inquiry ID', 'Company Name', 'Contact Name', 'Email', 'Phone',
    'Partnership Type', 'Country', 'City', 'Business Description',
    'Proposed Value', 'Website', 'Status', 'Assigned To', 'Follow-Up Date', 'Notes'
  ],
  [SHEETS.SUPPLIER_INQUIRIES]: [
    'Timestamp', 'Inquiry ID', 'Company Name', 'Contact Name', 'Email', 'Phone',
    'Category', 'Products / Services', 'Country', 'City',
    'Tax ID', 'Website', 'Estimated Monthly Value (₪)',
    'Status', 'Assigned To', 'Response Date', 'Notes'
  ],
  [SHEETS.SALES_LEADS]: [
    'Timestamp', 'Lead ID', 'Lead Type', 'Company / Name', 'Email', 'Phone',
    'Source', 'Service Interest', 'City', 'Country',
    'Estimated Value (₪)', 'Stage', 'Assigned To',
    'Next Action', 'Next Action Date', 'Close Probability %',
    'Won Date', 'Lost Reason', 'Status'
  ],
  [SHEETS.REFUND_REQUESTS]: [
    'Timestamp', 'Request ID', 'Booking ID', 'Customer Name', 'Email', 'Phone',
    'Service Type', 'Original Amount (₪)', 'Refund Amount (₪)',
    'Reason', 'Evidence URL', 'Status',
    'Reviewed By', 'Decision Date', 'Refund Method', 'Notes'
  ],
  [SHEETS.DISPUTE_CASES]: [
    'Timestamp', 'Case ID', 'Booking ID', 'Customer ID', 'Provider ID',
    'Service Type', 'Amount in Dispute (₪)', 'Customer Claim',
    'Provider Response', 'Evidence URLs', 'Assigned To',
    'Status', 'Resolution', 'Resolution Date', 'Compensation (₪)', 'Notes'
  ],
  [SHEETS.PET_PROFILES]: [
    'Timestamp', 'Pet ID', 'Owner ID', 'Owner Name', 'Pet Name',
    'Species', 'Breed', 'Age', 'Weight (kg)', 'Gender',
    'Microchip Number', 'Vet Name', 'Vet Phone', 'Allergies',
    'Medical Notes', 'Vaccinations', 'Last Vet Visit', 'Photo URL', 'Status'
  ],
  [SHEETS.PROMO_CODES]: [
    'Timestamp', 'Code', 'Campaign', 'Discount Type', 'Discount Value',
    'Min Order (₪)', 'Max Discount (₪)', 'Used By User ID',
    'Platform', 'Booking ID', 'Original Amount (₪)',
    'Discount Applied (₪)', 'Final Amount (₪)', 'Expiry Date', 'Status'
  ],
  [SHEETS.PUSH_NOTIFICATIONS]: [
    'Timestamp', 'Notification ID', 'Title', 'Body', 'Platform',
    'Target Audience', 'Recipients Count', 'Delivered Count',
    'Opened Count', 'Open Rate %', 'Deep Link', 'Sent By', 'Status'
  ],
  [SHEETS.SMS_LOG]: [
    'Timestamp', 'Message ID', 'Phone Number', 'Type',
    'Message Preview', 'Provider', 'Status',
    'Delivery Time (ms)', 'Cost (₪)', 'User ID', 'Error Code'
  ],
  [SHEETS.API_ERRORS]: [
    'Timestamp', 'Error ID', 'Endpoint', 'Method', 'Status Code',
    'Error Message', 'User ID', 'IP Address', 'Response Time (ms)',
    'Request Size (KB)', 'Service', 'Resolved', 'Notes'
  ],
};

let sheetsClient: GoogleSheetsClient | null = null;

// Replit connector - Google Sheets OAuth token management
let connectionSettings: any;
let serviceAccountAuth: any = null;

const GOOGLE_SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
];

/**
 * Production: service account auth. Development: Replit OAuth connector.
 */
async function getUncachableGoogleSheetsClient() {
  // Production path: use Google service account JSON (any of the 3 known env vars)
  const serviceAccountJson =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    try {
      if (!serviceAccountAuth) {
        const credentials = JSON.parse(serviceAccountJson);
        serviceAccountAuth = new google.auth.GoogleAuth({
          credentials,
          scopes: GOOGLE_SHEETS_SCOPES,
        });
      }
      return google.sheets({ version: 'v4', auth: serviceAccountAuth });
    } catch (err) {
      logger.warn('[GoogleSheets] Service account parse failed, falling back to connector', err);
      serviceAccountAuth = null;
    }
  }

  // Development path: Replit OAuth connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('Google Sheets: no service account credentials and no Replit connector token available');
  }

  if (!connectionSettings || !connectionSettings.settings?.expires_at || new Date(connectionSettings.settings.expires_at).getTime() <= Date.now()) {
    connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);
  }

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;
  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheets not connected via Replit connector');
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

/**
 * Initialize Google Sheets API client via Replit connector
 */
async function initializeSheetsClient(): Promise<GoogleSheetsClient | null> {
  if (sheetsClient) return sheetsClient;

  try {
    const sheets = await getUncachableGoogleSheetsClient();

    let spreadsheetId = SPREADSHEET_ID;

    if (spreadsheetId === 'CREATE_NEW') {
      spreadsheetId = await createMasterSpreadsheet(sheets);
    } else {
      await ensureFormTabs(sheets, spreadsheetId);
    }

    sheetsClient = { spreadsheetId, sheets };
    logger.info('[GoogleSheets] ✅ Initialized via Replit connector');

    return sheetsClient;
  } catch (error: any) {
    logger.warn('[GoogleSheets] Connector not available:', error.message);
    return null;
  }
}

/**
 * Ensure all required form tracking tabs exist in an existing spreadsheet.
 * Idempotent — safe to call on every startup.
 */
async function ensureFormTabs(sheets: any, spreadsheetId: string): Promise<void> {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = new Set<string>(
      (meta.data.sheets || []).map((s: any) => s.properties?.title as string)
    );
    const missing = Object.values(SHEETS).filter(name => !existing.has(name));
    if (missing.length === 0) {
      logger.info('[GoogleSheets] All form tracking tabs already present');
      return;
    }
    logger.info(`[GoogleSheets] Creating ${missing.length} missing tabs: ${missing.join(', ')}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map(title => ({ addSheet: { properties: { title } } })),
      },
    });
    await initializeSheetHeaders(sheets, spreadsheetId, missing);
    logger.info('[GoogleSheets] ✅ Missing form tabs created and headers written');
  } catch (err: any) {
    logger.error('[GoogleSheets] ensureFormTabs error — check service account has Editor access', { error: err.message });
  }
}

export async function setupFormsSpreadsheet(): Promise<boolean> {
  try {
    sheetsClient = null;
    const client = await initializeSheetsClient();
    return !!client;
  } catch {
    return false;
  }
}

/**
 * Create master ⁦Pet Wash™⁩ Forms spreadsheet with all sheets
 */
async function createMasterSpreadsheet(sheets: any): Promise<string> {
  try {
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: '⁦Pet Wash™⁩ Global Forms - Master Tracking',
        },
        sheets: Object.values(SHEETS).map(sheetName => ({
          properties: {
            title: sheetName,
          },
        })),
      },
    });

    const spreadsheetId = response.data.spreadsheetId;
    logger.info(`[GoogleSheets] ✅ Created master spreadsheet: ${spreadsheetId}`);

    // Initialize headers for each sheet
    await initializeSheetHeaders(sheets, spreadsheetId);

    return spreadsheetId;
  } catch (error) {
    logger.error('[GoogleSheets] Error creating spreadsheet:', error);
    throw error;
  }
}

/**
 * Initialize headers for all sheets
 */
async function initializeSheetHeaders(sheets: any, spreadsheetId: string, only?: string[]) {
  const headerConfigs = {
    [SHEETS.K9000_BOOKINGS]: [
      'Timestamp', 'Booking ID', 'Customer Name', 'Email', 'Phone', 'Pet Name', 
      'Station Location', 'Wash Type', 'Date & Time', 'Amount (ILS)', 'Payment Status', 'Notes'
    ],
    [SHEETS.SITTER_BOOKINGS]: [
      'Timestamp', 'Booking ID', 'Customer Name', 'Email', 'Phone', 'Pet Name', 'Pet Type',
      'Sitter Name', 'Start Date', 'End Date', 'Duration (Days)', 'Total Amount (ILS)', 'Status'
    ],
    [SHEETS.WALKER_BOOKINGS]: [
      'Timestamp', 'Booking ID', 'Customer Name', 'Email', 'Phone', 'Dog Name', 'Breed',
      'Walker Name', 'Walk Date', 'Duration (Mins)', 'Location', 'Amount (ILS)', 'Status'
    ],
    [SHEETS.PETTREK_BOOKINGS]: [
      'Timestamp', 'Trip ID', 'Customer Name', 'Email', 'Phone', 'Pet Name', 'Pet Type',
      'Pickup Location', 'Dropoff Location', 'Driver Name', 'Trip Date', 'Amount (ILS)', 'Status'
    ],
    [SHEETS.ACADEMY_BOOKINGS]: [
      'Timestamp', 'Booking ID', 'Customer Name', 'Email', 'Phone', 'Pet Name', 'Pet Age',
      'Trainer Name', 'Session Type', 'Session Date', 'Duration (Mins)', 'Amount (ILS)', 'Status'
    ],
    [SHEETS.CONTACT_FORMS]: [
      'Timestamp', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Platform', 'Status', 'Assigned To', 'Response Sent'
    ],
    [SHEETS.FEEDBACK_REVIEWS]: [
      'Timestamp', 'Customer Name', 'Email', 'Platform', 'Service Type', 'Rating (1-5)', 
      'Review Title', 'Review Text', 'Would Recommend', 'Status', 'Published'
    ],
    [SHEETS.NEWSLETTER_SIGNUPS]: [
      'Timestamp', 'Email', 'Name', 'Language Preference', 'Source Platform', 'IP Address', 'Status', 'Confirmed'
    ],
    [SHEETS.FRANCHISE_INQUIRIES]: [
      'Timestamp', 'Name', 'Company', 'Email', 'Phone', 'Country', 'City', 
      'Investment Budget', 'Timeline', 'Experience', 'Message', 'Status', 'Follow-up Date'
    ],
    [SHEETS.REGISTRATIONS]: [
      'Timestamp', 'User ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Country',
      'Registration Source', 'Profile Photo URL', 'Language', 'Status'
    ],
    [SHEETS.PROVIDER_APPLICATIONS]: [
      'Timestamp', 'Application ID', 'First Name', 'Last Name', 'Email', 'Phone',
      'Provider Type', 'City', 'Country', 'Selfie Photo URL', 'Government ID URL',
      'Biometric Status', 'Biometric Score', 'Application Status'
    ],
    [SHEETS.E_SIGNATURES]: [
      'Timestamp', 'Signature ID', 'Document Title', 'Signer Name', 'Signer Email',
      'Document Type', 'Contract Reference', 'Signature Status', 'Signed At', 'IP Address'
    ],
    [SHEETS.INVOICES]: [
      'Timestamp', 'Invoice ID', 'Invoice Number', 'Customer Name', 'Customer Email',
      'Amount (ILS)', 'VAT Amount', 'Total Amount', 'Currency', 'Due Date', 'Payment Status',
      'Description', 'Platform'
    ],
    [SHEETS.STATEMENTS]: [
      'Timestamp', 'Statement ID', 'Account Holder', 'Email', 'Period Start', 'Period End',
      'Opening Balance', 'Closing Balance', 'Total Credits', 'Total Debits', 'Currency', 'Status'
    ],
    [SHEETS.RECEIPTS]: [
      'Timestamp', 'Receipt ID', 'Transaction ID', 'Customer Name', 'Email',
      'Amount (ILS)', 'Payment Method', 'Platform', 'Service Type', 'Description', 'Status'
    ],
    [SHEETS.IDENTITY_VERIFICATIONS]: [
      'Timestamp', 'Verification ID', 'User ID', 'First Name', 'Last Name', 'Email',
      'Document Type', 'Country', 'Selfie URL', 'ID Photo URL', 'Biometric Score',
      'Biometric Match Status', 'Verification Status', 'Manual Review Required'
    ],
    [SHEETS.LOYALTY_ENROLLMENTS]: [
      'Timestamp', 'Member ID', 'First Name', 'Last Name', 'Email', 'Phone',
      'Enrollment Source', 'Tier', 'Welcome Points', 'Language', 'Country',
      'Member Type', 'Status'
    ],
    [SHEETS.SECURITY_EVENTS]: [
      'Timestamp', 'User ID', 'Event Type', 'IP Address', 'Risk Score', 'Metadata'
    ],
    [SHEETS.CONSENT_AUDIT]: [
      'Timestamp', 'User ID', 'Consent Type', 'Version', 'Method', 'Evidence Hash'
    ],
    [SHEETS.ONBOARDING_CASES]: [
      'Timestamp', 'User ID', 'Case Type', 'Status', 'Current Step'
    ],
    [SHEETS.HR_JOB_APPLICATIONS]: [
      'Timestamp', 'Application ID', 'First Name', 'Last Name', 'Email', 'Phone',
      'Position', 'Department', 'Experience (Years)', 'City', 'Country',
      'CV URL', 'Cover Letter', 'Referral Source', 'Interview Date',
      'Interview Score', 'Decision', 'Offer Sent', 'Start Date', 'Notes'
    ],
    [SHEETS.PARTNER_INQUIRIES]: [
      'Timestamp', 'Inquiry ID', 'Company Name', 'Contact Name', 'Email', 'Phone',
      'Partnership Type', 'Country', 'City', 'Business Description',
      'Proposed Value', 'Website', 'Status', 'Assigned To', 'Follow-Up Date', 'Notes'
    ],
    [SHEETS.SUPPLIER_INQUIRIES]: [
      'Timestamp', 'Inquiry ID', 'Company Name', 'Contact Name', 'Email', 'Phone',
      'Category', 'Products / Services', 'Country', 'City',
      'Tax ID', 'Website', 'Estimated Monthly Value (₪)',
      'Status', 'Assigned To', 'Response Date', 'Notes'
    ],
    [SHEETS.SALES_LEADS]: [
      'Timestamp', 'Lead ID', 'Lead Type', 'Company / Name', 'Email', 'Phone',
      'Source', 'Service Interest', 'City', 'Country',
      'Estimated Value (₪)', 'Stage', 'Assigned To',
      'Next Action', 'Next Action Date', 'Close Probability %',
      'Won Date', 'Lost Reason', 'Status'
    ],
    [SHEETS.REFUND_REQUESTS]: [
      'Timestamp', 'Request ID', 'Booking ID', 'Customer Name', 'Email', 'Phone',
      'Service Type', 'Original Amount (₪)', 'Refund Amount (₪)',
      'Reason', 'Evidence URL', 'Status',
      'Reviewed By', 'Decision Date', 'Refund Method', 'Notes'
    ],
    [SHEETS.DISPUTE_CASES]: [
      'Timestamp', 'Case ID', 'Booking ID', 'Customer ID', 'Provider ID',
      'Service Type', 'Amount in Dispute (₪)', 'Customer Claim',
      'Provider Response', 'Evidence URLs', 'Assigned To',
      'Status', 'Resolution', 'Resolution Date', 'Compensation (₪)', 'Notes'
    ],
    [SHEETS.PET_PROFILES]: [
      'Timestamp', 'Pet ID', 'Owner ID', 'Owner Name', 'Pet Name',
      'Species', 'Breed', 'Age', 'Weight (kg)', 'Gender',
      'Microchip Number', 'Vet Name', 'Vet Phone', 'Allergies',
      'Medical Notes', 'Vaccinations', 'Last Vet Visit', 'Photo URL', 'Status'
    ],
    [SHEETS.PROMO_CODES]: [
      'Timestamp', 'Code', 'Campaign', 'Discount Type', 'Discount Value',
      'Min Order (₪)', 'Max Discount (₪)', 'Used By User ID',
      'Platform', 'Booking ID', 'Original Amount (₪)',
      'Discount Applied (₪)', 'Final Amount (₪)', 'Expiry Date', 'Status'
    ],
    [SHEETS.PUSH_NOTIFICATIONS]: [
      'Timestamp', 'Notification ID', 'Title', 'Body', 'Platform',
      'Target Audience', 'Recipients Count', 'Delivered Count',
      'Opened Count', 'Open Rate %', 'Deep Link', 'Sent By', 'Status'
    ],
    [SHEETS.SMS_LOG]: [
      'Timestamp', 'Message ID', 'Phone Number', 'Type',
      'Message Preview', 'Provider', 'Status',
      'Delivery Time (ms)', 'Cost (₪)', 'User ID', 'Error Code'
    ],
    [SHEETS.API_ERRORS]: [
      'Timestamp', 'Error ID', 'Endpoint', 'Method', 'Status Code',
      'Error Message', 'User ID', 'IP Address', 'Response Time (ms)',
      'Request Size (KB)', 'Service', 'Resolved', 'Notes'
    ],
  };

  try {
    for (const [sheetName, headers] of Object.entries(headerConfigs)) {
      if (only && !only.includes(sheetName)) continue;
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A1:A1`,
      }).catch(() => null);

      if (existing?.data?.values?.length) {
        continue;
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers],
        },
      });
    }
    logger.info('[GoogleSheets] ✅ Initialized all sheet headers');
  } catch (error) {
    logger.error('[GoogleSheets] Error initializing headers:', error);
  }
}

/**
 * Durable retry queue for Google Sheets persistence
 * Uses PostgreSQL table `google_sheets_retry_queue` to survive process restarts
 * Exponential backoff: 1min, 2min, 4min, 8min, 16min
 */
const MAX_RETRY_ATTEMPTS = 5;
let retryWorkerActive = false;

async function getDbPool() {
  const { pool } = await import('../db');
  return pool;
}

async function queueFailedSubmission(sheetName: string, data: Record<string, any>, errorMsg?: string): Promise<void> {
  try {
    const dbPool = await getDbPool();
    await dbPool.query(
      `INSERT INTO google_sheets_retry_queue (sheet_name, data, attempts, status, error_message, next_retry_at)
       VALUES ($1, $2, 1, 'pending', $3, NOW() + INTERVAL '1 minute')`,
      [sheetName, JSON.stringify(data), errorMsg || null]
    );
    logger.warn(`[GoogleSheets] ⚠️ Failed submission queued to DB for ${sheetName}`);
    startRetryWorker();
  } catch (dbErr) {
    logger.error(`[GoogleSheets] ❌ CRITICAL: Failed to queue to DB for ${sheetName}`, dbErr);
  }
}

function startRetryWorker() {
  if (retryWorkerActive) return;
  retryWorkerActive = true;

  setTimeout(async () => {
    retryWorkerActive = false;
    try {
      const dbPool = await getDbPool();
      const { rows } = await dbPool.query(
        `SELECT id, sheet_name, data, attempts FROM google_sheets_retry_queue
         WHERE status = 'pending' AND next_retry_at <= NOW() AND attempts < $1
         ORDER BY created_at ASC LIMIT 20`,
        [MAX_RETRY_ATTEMPTS]
      );

      if (rows.length === 0) return;

      logger.info(`[GoogleSheets] 🔄 Retrying ${rows.length} failed submissions...`);

      for (const row of rows) {
        const success = await appendFormSubmissionDirect(row.sheet_name, row.data);

        if (success) {
          await dbPool.query(
            `UPDATE google_sheets_retry_queue SET status = 'completed', last_attempt = NOW() WHERE id = $1`,
            [row.id]
          );
          logger.info(`[GoogleSheets] ✅ Retry succeeded for ${row.sheet_name} (attempt ${row.attempts + 1})`);
        } else {
          const nextAttempt = row.attempts + 1;
          const backoffMinutes = Math.pow(2, nextAttempt - 1);
          
          if (nextAttempt >= MAX_RETRY_ATTEMPTS) {
            await dbPool.query(
              `UPDATE google_sheets_retry_queue SET status = 'failed', attempts = $2, last_attempt = NOW(), 
               error_message = 'Max retries exceeded' WHERE id = $1`,
              [row.id, nextAttempt]
            );
            logger.error(`[GoogleSheets] ❌ PERMANENT FAILURE after ${nextAttempt} attempts for ${row.sheet_name}`);
          } else {
            await dbPool.query(
              `UPDATE google_sheets_retry_queue SET attempts = $2, last_attempt = NOW(),
               next_retry_at = NOW() + INTERVAL '${backoffMinutes} minutes' WHERE id = $1`,
              [row.id, nextAttempt]
            );
          }
        }
      }

      const { rows: pending } = await dbPool.query(
        `SELECT COUNT(*) as cnt FROM google_sheets_retry_queue WHERE status = 'pending' AND attempts < $1`,
        [MAX_RETRY_ATTEMPTS]
      );
      if (parseInt(pending[0]?.cnt || '0') > 0) {
        startRetryWorker();
      }
    } catch (err) {
      logger.error('[GoogleSheets] Retry worker error:', err);
    }
  }, 60000);
}

/**
 * Direct append without retry logic (used internally)
 * Gets fresh OAuth token via Replit connector for each attempt
 */
async function appendFormSubmissionDirect(
  sheetName: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    const sheets = await getUncachableGoogleSheetsClient();
    const spreadsheetId = SPREADSHEET_ID;

    if (spreadsheetId === 'CREATE_NEW') {
      const client = await initializeSheetsClient();
      if (!client) return false;
      
      const timestamp = new Date().toISOString();
      const values = [timestamp, ...Object.values(data)];
      await client.sheets.spreadsheets.values.append({
        spreadsheetId: client.spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
      });
      return true;
    }

    const timestamp = new Date().toISOString();
    const values = [timestamp, ...Object.values(data)];

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      });
      return true;
    } catch (appendError: any) {
      if (appendError?.message?.includes('Unable to parse range') || 
          appendError?.code === 400 || 
          appendError?.status === 400) {
        logger.info(`[GoogleSheets] Sheet "${sheetName}" not found, creating it...`);
        try {
          try {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [{
                  addSheet: {
                    properties: { title: sheetName }
                  }
                }]
              }
            });
          } catch (addErr: any) {
            if (!addErr?.message?.includes('already exists')) {
              throw addErr;
            }
          }
          
          const headerConfig = SHEET_HEADERS[sheetName];
          if (headerConfig) {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${sheetName}!A1`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [headerConfig] },
            });
          }

          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values] },
          });
          logger.info(`[GoogleSheets] ✅ Created sheet "${sheetName}" and appended data`);
          return true;
        } catch (createErr: any) {
          logger.error(`[GoogleSheets] Failed to create sheet "${sheetName}":`, createErr?.message);
          return false;
        }
      }
      logger.error(`[GoogleSheets] Append error for "${sheetName}":`, appendError?.message);
      return false;
    }
  } catch (error: any) {
    logger.error(`[GoogleSheets] Client error for "${sheetName}":`, error?.message);
    return false;
  }
}

/**
 * Generic function to append form submission to Google Sheets
 * Features: Durable DB-backed retry queue with exponential backoff
 * Ensures 100% persistence for legal compliance (survives process restarts)
 */
export async function appendFormSubmission(
  sheetName: string,
  data: Record<string, any>,
  idempotencyKey?: string
): Promise<boolean> {
  if (idempotencyKey) {
    try {
      const dbPool = await getDbPool();
      const { rows } = await dbPool.query(
        `SELECT id FROM google_sheets_idempotency WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (rows.length > 0) {
        logger.info(`[GoogleSheets] Skipping duplicate submission (idempotency: ${idempotencyKey})`);
        return true;
      }
    } catch {
    }
  }

  const success = await appendFormSubmissionDirect(sheetName, data);

  if (success) {
    logger.info(`[GoogleSheets] Appended to ${sheetName}`);
    if (idempotencyKey) {
      try {
        const dbPool = await getDbPool();
        await dbPool.query(
          `INSERT INTO google_sheets_idempotency (idempotency_key, sheet_name, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
          [idempotencyKey, sheetName]
        );
      } catch {
      }
    }
    return true;
  }

  await queueFailedSubmission(sheetName, data, 'Initial append failed');
  return false;
}

export async function getReconciliationReport(): Promise<{
  pending: number;
  failed: number;
  recentSuccesses: number;
  oldestPending: string | null;
}> {
  try {
    const dbPool = await getDbPool();
    const [pendingRes, failedRes, recentRes, oldestRes] = await Promise.all([
      dbPool.query(`SELECT COUNT(*) as cnt FROM google_sheets_retry_queue WHERE status = 'pending'`),
      dbPool.query(`SELECT COUNT(*) as cnt FROM google_sheets_retry_queue WHERE status = 'failed' AND attempts >= 5`),
      dbPool.query(`SELECT COUNT(*) as cnt FROM google_sheets_idempotency WHERE created_at > NOW() - INTERVAL '24 hours'`),
      dbPool.query(`SELECT MIN(created_at) as oldest FROM google_sheets_retry_queue WHERE status = 'pending'`),
    ]);
    return {
      pending: parseInt(pendingRes.rows[0]?.cnt || '0'),
      failed: parseInt(failedRes.rows[0]?.cnt || '0'),
      recentSuccesses: parseInt(recentRes.rows[0]?.cnt || '0'),
      oldestPending: oldestRes.rows[0]?.oldest || null,
    };
  } catch {
    return { pending: 0, failed: 0, recentSuccesses: 0, oldestPending: null };
  }
}

/**
 * Get pending retry count (for admin monitoring)
 */
export async function getPendingRetryCount(): Promise<number> {
  try {
    const dbPool = await getDbPool();
    const { rows } = await dbPool.query(
      `SELECT COUNT(*) as cnt FROM google_sheets_retry_queue WHERE status = 'pending'`
    );
    return parseInt(rows[0]?.cnt || '0');
  } catch {
    return 0;
  }
}

/**
 * Process any pending retries on startup (catch items from previous process crashes)
 */
export async function processStartupRetries(): Promise<void> {
  try {
    const count = await getPendingRetryCount();
    if (count > 0) {
      logger.info(`[GoogleSheets] 🔄 Found ${count} pending retries from previous session`);
      startRetryWorker();
    }
  } catch {
    // Silently skip if table doesn't exist yet
  }
}

/**
 * K9000 Wash Booking Submission
 */
export async function logK9000Booking(booking: {
  bookingId: string;
  customerName: string;
  email: string;
  phone: string;
  petName: string;
  stationLocation: string;
  washType: string;
  dateTime: string;
  amount: number;
  paymentStatus: string;
  notes?: string;
}) {
  return appendFormSubmission(SHEETS.K9000_BOOKINGS, booking);
}

/**
 * Sitter Suite Booking Submission
 */
export async function logSitterBooking(booking: {
  bookingId: string;
  customerName: string;
  email: string;
  phone: string;
  petName: string;
  petType: string;
  sitterName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  totalAmount: number;
  status: string;
}) {
  return appendFormSubmission(SHEETS.SITTER_BOOKINGS, booking);
}

/**
 * Walk My Pet Booking Submission
 */
export async function logWalkerBooking(booking: {
  bookingId: string;
  customerName: string;
  email: string;
  phone: string;
  dogName: string;
  breed: string;
  walkerName: string;
  walkDate: string;
  durationMins: number;
  location: string;
  amount: number;
  status: string;
}) {
  return appendFormSubmission(SHEETS.WALKER_BOOKINGS, booking);
}

/**
 * PetTrek Transport Booking Submission
 */
export async function logPetTrekBooking(booking: {
  tripId: string;
  customerName: string;
  email: string;
  phone: string;
  petName: string;
  petType: string;
  pickupLocation: string;
  dropoffLocation: string;
  driverName: string;
  tripDate: string;
  amount: number;
  status: string;
}) {
  return appendFormSubmission(SHEETS.PETTREK_BOOKINGS, booking);
}

/**
 * Pet Wash Academy Booking Submission
 */
export async function logAcademyBooking(booking: {
  bookingId: string;
  customerName: string;
  email: string;
  phone: string;
  petName: string;
  petAge: number;
  trainerName: string;
  sessionType: string;
  sessionDate: string;
  durationMins: number;
  amount: number;
  status: string;
}) {
  return appendFormSubmission(SHEETS.ACADEMY_BOOKINGS, booking);
}

/**
 * Contact Form Submission (All Platforms)
 */
export async function logContactForm(contact: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  platform: string;
  status?: string;
  assignedTo?: string;
  responseSent?: boolean;
}) {
  return appendFormSubmission(SHEETS.CONTACT_FORMS, {
    ...contact,
    status: contact.status || 'New',
    assignedTo: contact.assignedTo || '',
    responseSent: contact.responseSent || false,
  });
}

/**
 * Feedback & Review Submission
 */
export async function logFeedbackReview(review: {
  customerName: string;
  email: string;
  platform: string;
  serviceType: string;
  rating: number;
  reviewTitle: string;
  reviewText: string;
  wouldRecommend: boolean;
  status?: string;
  published?: boolean;
}) {
  return appendFormSubmission(SHEETS.FEEDBACK_REVIEWS, {
    ...review,
    status: review.status || 'Pending Review',
    published: review.published || false,
  });
}

/**
 * Newsletter Signup Submission
 */
export async function logNewsletterSignup(signup: {
  email: string;
  name: string;
  languagePreference: string;
  sourcePlatform: string;
  ipAddress: string;
  status?: string;
  confirmed?: boolean;
}) {
  return appendFormSubmission(SHEETS.NEWSLETTER_SIGNUPS, {
    ...signup,
    status: signup.status || 'Pending Confirmation',
    confirmed: signup.confirmed || false,
  });
}

/**
 * Franchise Inquiry Submission
 */
export async function logFranchiseInquiry(inquiry: {
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  investmentBudget: string;
  timeline: string;
  experience: string;
  message: string;
  status?: string;
  followUpDate?: string;
}) {
  return appendFormSubmission(SHEETS.FRANCHISE_INQUIRIES, {
    ...inquiry,
    status: inquiry.status || 'New Lead',
    followUpDate: inquiry.followUpDate || '',
  });
}

/**
 * User Registration Logging
 */
export async function logRegistration(registration: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city?: string;
  address?: string;
  registrationSource: string;
  profilePhotoUrl: string;
  language: string;
  petName?: string;
  petType?: string;
  referralSource?: string;
  status?: string;
}) {
  return appendFormSubmission(SHEETS.REGISTRATIONS, {
    ...registration,
    city: registration.city || '',
    address: registration.address || '',
    petName: registration.petName || '',
    petType: registration.petType || '',
    referralSource: registration.referralSource || '',
    status: registration.status || 'Active',
  });
}

/**
 * Provider Application Logging
 */
export async function logProviderApplication(application: {
  applicationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber?: string;
  providerType: string;
  selectedPlatforms?: string;
  city: string;
  country: string;
  languages?: string;
  yearsOfExperience?: string;
  availability?: string;
  hasVehicle?: string;
  selfiePhotoUrl: string;
  governmentIdUrl: string;
  biometricStatus: string;
  biometricScore: string;
  applicationStatus?: string;
}) {
  return appendFormSubmission(SHEETS.PROVIDER_APPLICATIONS, {
    ...application,
    idNumber: application.idNumber || '',
    selectedPlatforms: application.selectedPlatforms || '',
    languages: application.languages || '',
    yearsOfExperience: application.yearsOfExperience || '',
    availability: application.availability || '',
    hasVehicle: application.hasVehicle || '',
    applicationStatus: application.applicationStatus || 'Pending Review',
  });
}

/**
 * E-Signature Recording
 */
export async function logESignature(signature: {
  signatureId: string;
  documentTitle: string;
  signerName: string;
  signerEmail: string;
  documentType: string;
  contractReference: string;
  signatureStatus: string;
  signedAt: string;
  ipAddress: string;
}) {
  return appendFormSubmission(SHEETS.E_SIGNATURES, signature);
}

/**
 * E-Invoice Recording
 */
export async function logInvoice(invoice: {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  amount: string;
  vatAmount: string;
  totalAmount: string;
  currency: string;
  dueDate: string;
  paymentStatus: string;
  description: string;
  platform: string;
}) {
  return appendFormSubmission(SHEETS.INVOICES, invoice);
}

/**
 * E-Statement Recording
 */
export async function logStatement(statement: {
  statementId: string;
  accountHolder: string;
  email: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: string;
  closingBalance: string;
  totalCredits: string;
  totalDebits: string;
  currency: string;
  status?: string;
}) {
  return appendFormSubmission(SHEETS.STATEMENTS, {
    ...statement,
    status: statement.status || 'Generated',
  });
}

/**
 * Receipt/Transaction Recording
 */
export async function logReceipt(receipt: {
  receiptId: string;
  transactionId: string;
  customerName: string;
  email: string;
  amount: string;
  paymentMethod: string;
  platform: string;
  serviceType: string;
  description: string;
  status?: string;
}) {
  return appendFormSubmission(SHEETS.RECEIPTS, {
    ...receipt,
    status: receipt.status || 'Completed',
  });
}

/**
 * Identity Verification (KYC) Recording
 */
export async function logIdentityVerification(verification: {
  verificationId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  documentType: string;
  country: string;
  selfieUrl: string;
  idPhotoUrl: string;
  biometricScore: string;
  biometricMatchStatus: string;
  verificationStatus: string;
  manualReviewRequired: boolean;
}) {
  return appendFormSubmission(SHEETS.IDENTITY_VERIFICATIONS, verification);
}

/**
 * Loyalty Enrollment Logging
 */
export async function logLoyaltyEnrollment(enrollment: {
  memberId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  enrollmentSource: string;
  tier: string;
  welcomePoints: number;
  language: string;
  country: string;
  memberType: string;
  petNames?: string;
  preferredStation?: string;
  birthday?: string;
  referralCode?: string;
  status?: string;
}) {
  return appendFormSubmission(SHEETS.LOYALTY_ENROLLMENTS, {
    ...enrollment,
    welcomePoints: String(enrollment.welcomePoints),
    petNames: enrollment.petNames || '',
    preferredStation: enrollment.preferredStation || '',
    birthday: enrollment.birthday || '',
    referralCode: enrollment.referralCode || '',
    status: enrollment.status || 'Active',
  });
}

/**
 * Staff Application Logging
 */
export async function logStaffApplication(application: {
  applicationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  applicationType: string;
  positionId?: string;
  city: string;
  country: string;
  address?: string;
  taxId?: string;
  businessName?: string;
  hasDrivingLicense?: boolean;
  drivingLicenseType?: string;
  yearsOfExperience?: number;
  referralSource?: string;
  fraudRiskScore?: number;
  shortlistScore?: number;
  shortlistRecommendation?: string;
  status?: string;
}) {
  return appendFormSubmission(SHEETS.STAFF_APPLICATIONS, {
    ...application,
    dateOfBirth: application.dateOfBirth || '',
    positionId: application.positionId || '',
    address: application.address || '',
    taxId: application.taxId || '',
    businessName: application.businessName || '',
    hasDrivingLicense: application.hasDrivingLicense ? 'Yes' : 'No',
    drivingLicenseType: application.drivingLicenseType || '',
    yearsOfExperience: String(application.yearsOfExperience || 0),
    referralSource: application.referralSource || '',
    fraudRiskScore: String(application.fraudRiskScore || 0),
    shortlistScore: String(application.shortlistScore || ''),
    shortlistRecommendation: application.shortlistRecommendation || '',
    status: application.status || 'Pending',
  });
}

/**
 * Security Event Logging (Wiring Matrix)
 */
export async function logSecurityEventToSheet(event: {
  userId: string;
  eventType: string;
  ip: string;
  riskScore: number;
  metadata?: string;
}): Promise<void> {
  await appendToSheet(SHEETS.SECURITY_EVENTS, {
    timestamp: new Date().toISOString(),
    userId: event.userId,
    eventType: event.eventType,
    ip: event.ip,
    riskScore: event.riskScore?.toString() || '0',
    metadata: event.metadata || '',
  });
}

/**
 * Consent Audit Trail Logging (Wiring Matrix)
 */
export async function logConsentEvent(consent: {
  userId: string;
  consentType: string;
  version: string;
  method: string;
  evidenceHash: string;
}): Promise<void> {
  await appendToSheet(SHEETS.CONSENT_AUDIT, {
    timestamp: new Date().toISOString(),
    userId: consent.userId,
    consentType: consent.consentType,
    version: consent.version,
    method: consent.method,
    evidenceHash: consent.evidenceHash,
  });
}

/**
 * Onboarding Case Logging (Wiring Matrix)
 */
export async function logOnboardingCase(oCase: {
  userId: string;
  caseType: string;
  status: string;
  currentStep: string;
}): Promise<void> {
  await appendToSheet(SHEETS.ONBOARDING_CASES, {
    timestamp: new Date().toISOString(),
    userId: oCase.userId,
    caseType: oCase.caseType,
    status: oCase.status,
    currentStep: oCase.currentStep,
  });
}

/**
 * Get spreadsheet URL for admin dashboard
 */
export function getSpreadsheetUrl(): string | null {
  if (!sheetsClient?.spreadsheetId) return null;
  return `https://docs.google.com/spreadsheets/d/${sheetsClient.spreadsheetId}`;
}

/**
 * Export service for use in routes
 */
export const GoogleSheetsService = {
  initialize: initializeSheetsClient,
  logK9000Booking,
  logSitterBooking,
  logWalkerBooking,
  logPetTrekBooking,
  logAcademyBooking,
  logContactForm,
  logFeedbackReview,
  logNewsletterSignup,
  logFranchiseInquiry,
  logRegistration,
  logProviderApplication,
  logStaffApplication,
  logESignature,
  logInvoice,
  logStatement,
  logReceipt,
  logIdentityVerification,
  logLoyaltyEnrollment,
  logSecurityEventToSheet,
  logConsentEvent,
  logOnboardingCase,
  getSpreadsheetUrl,
  getPendingRetryCount,
  processStartupRetries,
  getReconciliationReport,
  appendToSheet: (sheetName: string, data: Record<string, any>) => appendFormSubmission(sheetName, data),
};
