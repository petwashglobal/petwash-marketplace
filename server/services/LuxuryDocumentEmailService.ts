/**
 * Luxury Document Email Service
 * Sends sample invoices, receipts, and statements to CEO email
 */

import { logger } from '../lib/logger';
import { sendLuxuryEmail } from '../email/luxury-email-service';
import LuxuryInvoiceService from './LuxuryInvoiceService';
import GeminiEmailMonitor from './GeminiEmailMonitor';
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface SampleDocuments {
  invoice: string;
  receipt: string;
  statement: string;
}

class LuxuryDocumentEmailService {
  /**
   * Generate sample documents for demonstration
   */
  private generateSampleDocuments(): SampleDocuments {
    const sampleInvoiceData = {
      invoiceNumber: 'INV-2025-001234',
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      customerName: 'לקוח לדוגמה',
      customerTaxId: '123456789',
      customerAddress: 'רחוב דוגמה 123, תל אביב',
      transactionId: 'TXN-2025-ABC123',
      paymentMethod: 'כרטיס אשראי',
      lineItems: [
        {
          description: 'K9000 Wash Station - Premium Package',
          descriptionHe: 'K9000 תחנת רחצה - חבילת פרמיום',
          quantity: 2,
          unitPrice: 150.00,
          vatRate: 0.18,
          commission: 15.00,
          operationCode: 'K9K-PREM-001'
        },
        {
          description: 'Walk My Pet™ - 1 Hour Premium Walk',
          descriptionHe: 'Walk My Pet™ - טיול פרמיום שעה',
          quantity: 5,
          unitPrice: 80.00,
          vatRate: 0.18,
          commission: 19.20, // 24% commission
          operationCode: 'WMP-WALK-002'
        },
        {
          description: 'PetTrek™ Transport - Airport to Home',
          descriptionHe: 'PetTrek™ הובלה - שדה תעופה לבית',
          quantity: 1,
          unitPrice: 250.00,
          vatRate: 0.18,
          commission: 50.00, // 20% commission
          operationCode: 'PTK-TRANS-003'
        },
        {
          description: 'The Sitter Suite™ - Overnight Care',
          descriptionHe: 'The Sitter Suite™ - שמירה ללילה',
          quantity: 3,
          unitPrice: 120.00,
          vatRate: 0.18,
          commission: 27.00, // 7.5% commission
          operationCode: 'TSS-CARE-004'
        }
      ],
      notesHe: 'תודה שבחרתם ב-Pet Wash™ - המובילה בישראל בשירותי טיפול פרמיום לחיות מחמד. כל השירותים שלנו כוללים ביטוח מלא ומעקב GPS בזמן אמת.'
    };

    const invoice = LuxuryInvoiceService.generateInvoice(sampleInvoiceData);
    const receipt = LuxuryInvoiceService.generateReceipt({
      ...sampleInvoiceData,
      notesHe: 'קבלה על תשלום ששולם במלואו ביום ' + new Date().toLocaleDateString('he-IL')
    });
    
    const statementData = {
      ...sampleInvoiceData,
      period: 'ינואר 2025'
    };
    const statement = LuxuryInvoiceService.generateStatement(statementData);

    return { invoice, receipt, statement };
  }

  /**
   * Send luxury document samples to CEO email
   */
  async sendSampleDocumentsToCEO(emailAddress: string = 'Nir.h@petwash.co.il'): Promise<{
    success: boolean;
    sentDocuments?: string[];
    error?: string;
  }> {
    try {
      logger.info('[Luxury Documents] Generating sample documents for CEO...');
      
      const documents = this.generateSampleDocuments();
      const sentDocs: string[] = [];

      // Send Invoice with Gemini AI validation
      try {
        // Validate and auto-fix email with Gemini AI
        const validation = await GeminiEmailMonitor.validateAndFixEmail(documents.invoice, 'invoice');
        
        if (!validation.valid) {
          logger.warn('[Luxury Documents] Invoice has rendering issues', { 
            issues: validation.issues.length,
            critical: validation.issues.filter(i => i.severity === 'critical').length
          });
        }

        // Auto-fix common issues
        const fixedHtml = await GeminiEmailMonitor.autoFixEmailIssues(documents.invoice);

        await sendLuxuryEmail({
          to: emailAddress,
          subject: '✨ Pet Wash™ - דוגמת חשבונית מס פרמיום (Sample Tax Invoice)',
          html: fixedHtml
        });

        // Log quality metrics
        await GeminiEmailMonitor.logEmailQuality('invoice', emailAddress, validation, true);

        sentDocs.push('חשבונית מס (Tax Invoice)');
        logger.info('[Luxury Documents] Invoice sent successfully with Gemini validation');
      } catch (error) {
        logger.error('[Luxury Documents] Failed to send invoice', error);
      }

      // Send Receipt with Gemini AI validation
      try {
        const validation = await GeminiEmailMonitor.validateAndFixEmail(documents.receipt, 'receipt');
        const fixedHtml = await GeminiEmailMonitor.autoFixEmailIssues(documents.receipt);

        await sendLuxuryEmail({
          to: emailAddress,
          subject: '✨ Pet Wash™ - דוגמת קבלה פרמיום (Sample Receipt)',
          html: fixedHtml
        });

        await GeminiEmailMonitor.logEmailQuality('receipt', emailAddress, validation, true);
        sentDocs.push('קבלה (Receipt)');
        logger.info('[Luxury Documents] Receipt sent successfully with Gemini validation');
      } catch (error) {
        logger.error('[Luxury Documents] Failed to send receipt', error);
      }

      // Send Statement with Gemini AI validation
      try {
        const validation = await GeminiEmailMonitor.validateAndFixEmail(documents.statement, 'statement');
        const fixedHtml = await GeminiEmailMonitor.autoFixEmailIssues(documents.statement);

        await sendLuxuryEmail({
          to: emailAddress,
          subject: '✨ Pet Wash™ - דוגמת דוח הכנסות ומע"מ (Sample Income & VAT Statement)',
          html: fixedHtml
        });

        await GeminiEmailMonitor.logEmailQuality('statement', emailAddress, validation, true);
        sentDocs.push('דוח הכנסות (Income Statement)');
        logger.info('[Luxury Documents] Statement sent successfully with Gemini validation');
      } catch (error) {
        logger.error('[Luxury Documents] Failed to send statement', error);
      }

      if (sentDocs.length === 0) {
        throw new Error('Failed to send any documents');
      }

      logger.info(`[Luxury Documents] Successfully sent ${sentDocs.length}/3 documents to ${emailAddress}`);

      return {
        success: true,
        sentDocuments: sentDocs
      };
    } catch (error: any) {
      logger.error('[Luxury Documents] Failed to send sample documents', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new LuxuryDocumentEmailService();
