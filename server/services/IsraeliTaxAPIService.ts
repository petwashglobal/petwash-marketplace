import axios, { AxiosInstance } from 'axios';
import { logger } from '../lib/logger';

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface InvoiceSubmissionPayload {
  invoiceNumber: string;
  invoiceDate: string;
  customerTaxId: string;
  customerName: string;
  totalAmount: number;
  vatAmount: number;
  amountBeforeVAT: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    vatRate: number;
  }>;
  invoiceType: 'B2B' | 'B2C';
  currency: string;
  paymentMethod?: string;
}

interface InvoiceSubmissionResponse {
  success: boolean;
  itaReferenceNumber?: string;
  submissionDate?: string;
  status: 'submitted' | 'pending' | 'rejected' | 'error';
  errorMessage?: string;
  errorCode?: string;
}

interface VATReportPayload {
  reportingPeriod: string;
  totalSales: number;
  outputVAT: number;
  totalPurchases: number;
  inputVAT: number;
  vatPayable: number;
  currency: string;
}

class IsraeliTaxAPIService {
  private clientId: string;
  private clientSecret: string;
  private scope: string;
  private tokenUrl: string;
  private apiBaseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private axiosClient: AxiosInstance;

  constructor() {
    this.clientId = process.env.ITA_CLIENT_ID || '';
    this.clientSecret = process.env.ITA_CLIENT_SECRET || '';
    this.scope = process.env.ITA_SCOPE || 'invoice vat income_tax reports';
    this.tokenUrl = process.env.ITA_TOKEN_URL || 'https://openapi.taxes.gov.il/shaam/longtimetoken/oauth2/token';
    this.apiBaseUrl = process.env.ITA_API_BASE_URL || 'https://api.taxes.gov.il/shaam/production/';

    this.axiosClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!this.clientId || !this.clientSecret) {
      logger.warn('[ITA API] ⚠️ CLIENT_ID or CLIENT_SECRET not configured - ITA integration disabled');
      logger.warn('[ITA API] See ITA_API_REGISTRATION_GUIDE.md for setup instructions');
    } else {
      logger.info('[ITA API] ✅ Israeli Tax Authority API service initialized');
    }
  }

  async getAccessToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('ITA_CLIENT_ID and ITA_CLIENT_SECRET must be configured. See ITA_API_REGISTRATION_GUIDE.md');
    }

    const now = Date.now();
    if (this.accessToken && this.tokenExpiresAt > now + 60000) {
      return this.accessToken;
    }

    try {
      logger.info('[ITA OAuth2] Requesting new access token...');

      const credentials = `${this.clientId}:${this.clientSecret}`;
      const base64Auth = Buffer.from(credentials, 'utf-8').toString('base64');

      const response = await axios.post<OAuthTokenResponse>(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          scope: this.scope,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${base64Auth}`,
          },
          timeout: 15000,
        }
      );

      const { access_token, expires_in } = response.data;
      this.accessToken = access_token;
      this.tokenExpiresAt = now + (expires_in * 1000);

      logger.info('[ITA OAuth2] ✅ Access token obtained successfully', {
        expiresIn: expires_in,
        scope: response.data.scope,
      });

      return access_token;
    } catch (error: any) {
      logger.error('[ITA OAuth2] ❌ Failed to obtain access token', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw new Error(`ITA OAuth2 authentication failed: ${error.message}`);
    }
  }

  async submitInvoice(payload: InvoiceSubmissionPayload): Promise<InvoiceSubmissionResponse> {
    if (!this.clientId || !this.clientSecret) {
      logger.warn('[ITA API] Skipping invoice submission - credentials not configured');
      return {
        success: false,
        status: 'error',
        errorMessage: 'ITA API credentials not configured',
        errorCode: 'NOT_CONFIGURED',
      };
    }

    try {
      const token = await this.getAccessToken();

      const formattedPayload = this.formatInvoicePayload(payload);

      logger.info('[ITA API] Submitting invoice to Israeli Tax Authority', {
        invoiceNumber: payload.invoiceNumber,
        invoiceType: payload.invoiceType,
        totalAmount: payload.totalAmount,
      });

      const response = await this.axiosClient.post(
        `${this.apiBaseUrl}Invoices/`,
        formattedPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      logger.info('[ITA API] ✅ Invoice submitted successfully', {
        invoiceNumber: payload.invoiceNumber,
        itaReference: response.data.referenceNumber,
      });

      return {
        success: true,
        status: 'submitted',
        itaReferenceNumber: response.data.referenceNumber || response.data.id,
        submissionDate: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('[ITA API] ❌ Invoice submission failed', {
        invoiceNumber: payload.invoiceNumber,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      return {
        success: false,
        status: 'error',
        errorMessage: error.response?.data?.message || error.message,
        errorCode: error.response?.data?.code || 'SUBMISSION_FAILED',
      };
    }
  }

  async submitVATReport(payload: VATReportPayload): Promise<InvoiceSubmissionResponse> {
    if (!this.clientId || !this.clientSecret) {
      logger.warn('[ITA API] Skipping VAT report submission - credentials not configured');
      return {
        success: false,
        status: 'error',
        errorMessage: 'ITA API credentials not configured',
        errorCode: 'NOT_CONFIGURED',
      };
    }

    try {
      const token = await this.getAccessToken();

      logger.info('[ITA API] Submitting VAT report to Israeli Tax Authority', {
        period: payload.reportingPeriod,
        vatPayable: payload.vatPayable,
      });

      const response = await this.axiosClient.post(
        `${this.apiBaseUrl}VAT/Reports/`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      logger.info('[ITA API] ✅ VAT report submitted successfully', {
        period: payload.reportingPeriod,
        itaReference: response.data.referenceNumber,
      });

      return {
        success: true,
        status: 'submitted',
        itaReferenceNumber: response.data.referenceNumber || response.data.id,
        submissionDate: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('[ITA API] ❌ VAT report submission failed', {
        period: payload.reportingPeriod,
        error: error.message,
        response: error.response?.data,
      });

      return {
        success: false,
        status: 'error',
        errorMessage: error.response?.data?.message || error.message,
        errorCode: error.response?.data?.code || 'VAT_SUBMISSION_FAILED',
      };
    }
  }

  async checkInvoiceStatus(itaReferenceNumber: string): Promise<{
    status: string;
    details?: any;
  }> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('ITA API credentials not configured');
    }

    try {
      const token = await this.getAccessToken();

      const response = await this.axiosClient.get(
        `${this.apiBaseUrl}Invoices/${itaReferenceNumber}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return {
        status: response.data.status || 'unknown',
        details: response.data,
      };
    } catch (error: any) {
      logger.error('[ITA API] Failed to check invoice status', {
        referenceNumber: itaReferenceNumber,
        error: error.message,
      });
      throw error;
    }
  }

  private formatInvoicePayload(payload: InvoiceSubmissionPayload): any {
    return {
      DocumentNumber: payload.invoiceNumber,
      DocumentDate: payload.invoiceDate,
      Customer: {
        TaxId: payload.customerTaxId,
        Name: payload.customerName,
      },
      TotalAmount: payload.totalAmount,
      VATAmount: payload.vatAmount,
      AmountBeforeVAT: payload.amountBeforeVAT,
      DocumentType: payload.invoiceType === 'B2B' ? 'InvoiceB2B' : 'InvoiceB2C',
      Currency: payload.currency,
      PaymentMethod: payload.paymentMethod || 'other',
      LineItems: payload.lineItems.map((item, index) => ({
        LineNumber: index + 1,
        Description: item.description,
        Quantity: item.quantity,
        UnitPrice: item.unitPrice,
        TotalPrice: item.totalPrice,
        VATRate: item.vatRate,
      })),
    };
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  getConfiguration(): {
    configured: boolean;
    tokenUrl: string;
    apiBaseUrl: string;
    scope: string;
  } {
    return {
      configured: this.isConfigured(),
      tokenUrl: this.tokenUrl,
      apiBaseUrl: this.apiBaseUrl,
      scope: this.scope,
    };
  }
}

export default new IsraeliTaxAPIService();
export type { InvoiceSubmissionPayload, InvoiceSubmissionResponse, VATReportPayload };
