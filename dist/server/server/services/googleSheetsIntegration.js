/**
 * Google Sheets Integration Service
 *
 * Centralized form submission tracking across all 8 Pet Wash platforms
 * All form submissions are logged to Google Sheets for easy management and analysis
 */
import { google } from 'googleapis';
import { logger } from '../lib/logger';
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
// Google Sheets Configuration
const SPREADSHEET_ID = process.env.GOOGLE_FORMS_SPREADSHEET_ID || 'CREATE_NEW'; // User can configure this
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
};
let sheetsClient = null;
/**
 * Initialize Google Sheets API client
 */
async function initializeSheetsClient() {
    if (sheetsClient)
        return sheetsClient;
    if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
        logger.warn('[GoogleSheets] Service account not configured');
        return null;
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
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        // Check if spreadsheet exists, or create new one
        let spreadsheetId = SPREADSHEET_ID;
        if (spreadsheetId === 'CREATE_NEW') {
            spreadsheetId = await createMasterSpreadsheet(sheets);
        }
        sheetsClient = { spreadsheetId, sheets };
        logger.info('[GoogleSheets] ✅ Initialized successfully');
        return sheetsClient;
    }
    catch (error) {
        logger.error('[GoogleSheets] Initialization error:', error);
        return null;
    }
}
/**
 * Create master Pet Wash™ Forms spreadsheet with all sheets
 */
async function createMasterSpreadsheet(sheets) {
    try {
        const response = await sheets.spreadsheets.create({
            requestBody: {
                properties: {
                    title: 'Pet Wash™ Global Forms - Master Tracking',
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
    }
    catch (error) {
        logger.error('[GoogleSheets] Error creating spreadsheet:', error);
        throw error;
    }
}
/**
 * Initialize headers for all sheets
 */
async function initializeSheetHeaders(sheets, spreadsheetId) {
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
    };
    const requests = Object.entries(headerConfigs).map(([sheetName, headers]) => ({
        appendCells: {
            sheetId: getSheetId(sheetName),
            rows: [{
                    values: headers.map(header => ({
                        userEnteredValue: { stringValue: header },
                        userEnteredFormat: {
                            backgroundColor: { red: 0.2, green: 0.6, blue: 1.0 },
                            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                        },
                    })),
                }],
            fields: 'userEnteredValue,userEnteredFormat',
        },
    }));
    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests },
        });
        logger.info('[GoogleSheets] ✅ Initialized all sheet headers');
    }
    catch (error) {
        logger.error('[GoogleSheets] Error initializing headers:', error);
    }
}
/**
 * Helper to get sheet ID by name (placeholder - would need actual mapping)
 */
function getSheetId(sheetName) {
    // Sheet IDs are assigned sequentially starting from 0
    const sheetNames = Object.values(SHEETS);
    return sheetNames.indexOf(sheetName);
}
/**
 * Generic function to append form submission to Google Sheets
 */
export async function appendFormSubmission(sheetName, data) {
    const client = await initializeSheetsClient();
    if (!client)
        return false;
    try {
        const timestamp = new Date().toISOString();
        const values = [timestamp, ...Object.values(data)];
        await client.sheets.spreadsheets.values.append({
            spreadsheetId: client.spreadsheetId,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [values],
            },
        });
        logger.info(`[GoogleSheets] ✅ Appended to ${sheetName}`);
        return true;
    }
    catch (error) {
        logger.error(`[GoogleSheets] Error appending to ${sheetName}:`, error);
        return false;
    }
}
/**
 * K9000 Wash Booking Submission
 */
export async function logK9000Booking(booking) {
    return appendFormSubmission(SHEETS.K9000_BOOKINGS, booking);
}
/**
 * Sitter Suite Booking Submission
 */
export async function logSitterBooking(booking) {
    return appendFormSubmission(SHEETS.SITTER_BOOKINGS, booking);
}
/**
 * Walk My Pet Booking Submission
 */
export async function logWalkerBooking(booking) {
    return appendFormSubmission(SHEETS.WALKER_BOOKINGS, booking);
}
/**
 * PetTrek Transport Booking Submission
 */
export async function logPetTrekBooking(booking) {
    return appendFormSubmission(SHEETS.PETTREK_BOOKINGS, booking);
}
/**
 * Pet Wash Academy Booking Submission
 */
export async function logAcademyBooking(booking) {
    return appendFormSubmission(SHEETS.ACADEMY_BOOKINGS, booking);
}
/**
 * Contact Form Submission (All Platforms)
 */
export async function logContactForm(contact) {
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
export async function logFeedbackReview(review) {
    return appendFormSubmission(SHEETS.FEEDBACK_REVIEWS, {
        ...review,
        status: review.status || 'Pending Review',
        published: review.published || false,
    });
}
/**
 * Newsletter Signup Submission
 */
export async function logNewsletterSignup(signup) {
    return appendFormSubmission(SHEETS.NEWSLETTER_SIGNUPS, {
        ...signup,
        status: signup.status || 'Pending Confirmation',
        confirmed: signup.confirmed || false,
    });
}
/**
 * Franchise Inquiry Submission
 */
export async function logFranchiseInquiry(inquiry) {
    return appendFormSubmission(SHEETS.FRANCHISE_INQUIRIES, {
        ...inquiry,
        status: inquiry.status || 'New Lead',
        followUpDate: inquiry.followUpDate || '',
    });
}
/**
 * Get spreadsheet URL for admin dashboard
 */
export function getSpreadsheetUrl() {
    if (!sheetsClient?.spreadsheetId)
        return null;
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
    getSpreadsheetUrl,
};
