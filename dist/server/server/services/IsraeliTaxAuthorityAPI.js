/**
 * Israeli Tax Authority Innovation API Integration
 *
 * Official API Platform: https://govextra.gov.il/taxes/innovation/home/api/
 *
 * Services Available:
 * 1. VAT Reporting & Payment API (דיווח ותשלום דוחות מע"מ)
 * 2. Withholding Tax Reporting (דיווח ותשלום ניכויים)
 * 3. Advance Income Tax Payment (דיווח ותשלום מקדמות)
 * 4. Invoice Allocation Numbers (מספרי הקצאה לחשבוניות)
 *
 * Authentication: OAuth2
 * Registration Required: Yes - must register software with Tax Authority
 *
 * @see https://www.gov.il/BlobFolder/generalpage/hor-software-other/he/IncomeTax_software-houses-130525-1.pdf
 */
import { logger } from '../lib/logger';
/**
 * Israeli Tax Authority API Service
 *
 * IMPORTANT: This service requires:
 * 1. Registration at https://govextra.gov.il/taxes/innovation/home/api/
 * 2. OAuth2 credentials (client ID/secret) from Tax Authority
 * 3. Direct debit authorization (הרשאה לחיוב חשבון) for automatic payment
 *
 * Setup Instructions:
 * 1. CEO/CFO must complete registration process with Tax Authority
 * 2. Obtain API credentials from developer portal
 * 3. Set environment secrets: ISRAELI_TAX_API_CLIENT_ID, ISRAELI_TAX_API_CLIENT_SECRET
 * 4. Configure direct debit authorization with company bank account
 */
export class IsraeliTaxAuthorityAPI {
    static BASE_URL = process.env.ISRAELI_TAX_API_BASE_URL || 'https://secapp.taxes.gov.il/api';
    static TOKEN_URL = process.env.ISRAELI_TAX_API_TOKEN_URL || 'https://secapp.taxes.gov.il/oauth/token';
    static accessToken = null;
    static tokenExpiry = null;
    /**
     * Authenticate with Tax Authority using OAuth2
     * @private
     */
    static async authenticate() {
        try {
            // Check if token is still valid
            if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
                return this.accessToken;
            }
            const clientId = process.env.ISRAELI_TAX_API_CLIENT_ID;
            const clientSecret = process.env.ISRAELI_TAX_API_CLIENT_SECRET;
            if (!clientId || !clientSecret) {
                throw new Error('Israeli Tax Authority API credentials not configured. Please set ISRAELI_TAX_API_CLIENT_ID and ISRAELI_TAX_API_CLIENT_SECRET environment secrets.');
            }
            logger.info('[Israeli Tax API] Requesting OAuth2 access token...');
            const response = await fetch(this.TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: clientId,
                    client_secret: clientSecret,
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OAuth2 authentication failed: ${response.status} ${errorText}`);
            }
            const tokenData = await response.json();
            this.accessToken = tokenData.access_token;
            // Set expiry 5 minutes before actual expiry for safety
            this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in - 300) * 1000);
            logger.info('[Israeli Tax API] Successfully obtained access token', {
                expiresIn: tokenData.expires_in,
                tokenType: tokenData.token_type,
            });
            return this.accessToken;
        }
        catch (error) {
            logger.error('[Israeli Tax API] Authentication failed', error);
            throw error;
        }
    }
    /**
     * Submit VAT declaration to Israeli Tax Authority
     *
     * @param report VAT report data
     * @returns Tax Authority response with reference number
     */
    static async submitVATDeclaration(report) {
        try {
            logger.info('[Israeli Tax API] Submitting VAT declaration', {
                period: report.reportingPeriod,
                netVAT: report.netVAT.amount,
                status: report.netVAT.status,
            });
            const accessToken = await this.authenticate();
            // Prepare request payload according to Tax Authority API specification
            const payload = {
                company_id: report.companyId,
                tax_year: report.taxYear,
                tax_month: report.taxMonth,
                reporting_period: report.reportingPeriod,
                // Output VAT (sales)
                output_vat: {
                    total_revenue: report.outputVAT.totalRevenue.toFixed(2),
                    revenue_excluding_vat: report.outputVAT.revenueExcludingVAT.toFixed(2),
                    vat_collected: report.outputVAT.vatCollected.toFixed(2),
                    transaction_count: report.outputVAT.transactionCount,
                },
                // Input VAT (expenses)
                input_vat: {
                    total_expenses: report.inputVAT.totalExpenses.toFixed(2),
                    expenses_excluding_vat: report.inputVAT.expensesExcludingVAT.toFixed(2),
                    vat_paid: report.inputVAT.vatPaid.toFixed(2),
                    expense_count: report.inputVAT.expenseCount,
                },
                // Net VAT
                net_vat: {
                    amount: report.netVAT.amount.toFixed(2),
                    status: report.netVAT.status,
                },
            };
            const response = await fetch(`${this.BASE_URL}/v2/vat/submit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const responseData = await response.json();
            if (!response.ok) {
                logger.error('[Israeli Tax API] VAT submission failed', {
                    status: response.status,
                    errors: responseData.errors,
                });
                return {
                    success: false,
                    status: 'rejected',
                    message: responseData.message || 'Submission failed',
                    errors: responseData.errors,
                };
            }
            logger.info('[Israeli Tax API] VAT declaration submitted successfully', {
                referenceNumber: responseData.reference_number,
                submissionId: responseData.submission_id,
                status: responseData.status,
            });
            return {
                success: true,
                referenceNumber: responseData.reference_number,
                submissionId: responseData.submission_id,
                status: responseData.status || 'accepted',
                message: responseData.message,
                paymentDueDate: responseData.payment_due_date,
                refundAmount: responseData.refund_amount,
            };
        }
        catch (error) {
            logger.error('[Israeli Tax API] Failed to submit VAT declaration', error);
            return {
                success: false,
                status: 'rejected',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    /**
     * Get VAT submission status from Tax Authority
     *
     * @param submissionId Submission ID from previous submitVATDeclaration call
     * @returns Current status of the submission
     */
    static async getVATSubmissionStatus(submissionId) {
        try {
            const accessToken = await this.authenticate();
            const response = await fetch(`${this.BASE_URL}/v2/vat/status/${submissionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                },
            });
            const responseData = await response.json();
            if (!response.ok) {
                return {
                    success: false,
                    status: 'rejected',
                    message: responseData.message || 'Failed to get status',
                };
            }
            return {
                success: true,
                referenceNumber: responseData.reference_number,
                submissionId: responseData.submission_id,
                status: responseData.status,
                message: responseData.message,
                paymentDueDate: responseData.payment_due_date,
                refundAmount: responseData.refund_amount,
            };
        }
        catch (error) {
            logger.error('[Israeli Tax API] Failed to get VAT submission status', error);
            return {
                success: false,
                status: 'rejected',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    /**
     * Check if Tax Authority API is properly configured
     *
     * @returns true if API credentials are set
     */
    static isConfigured() {
        return !!(process.env.ISRAELI_TAX_API_CLIENT_ID &&
            process.env.ISRAELI_TAX_API_CLIENT_SECRET);
    }
    /**
     * Test connection to Tax Authority API
     *
     * @returns true if connection successful
     */
    static async testConnection() {
        try {
            const token = await this.authenticate();
            return !!token;
        }
        catch (error) {
            logger.error('[Israeli Tax API] Connection test failed', error);
            return false;
        }
    }
}
