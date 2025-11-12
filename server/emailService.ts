import { MailService } from '@sendgrid/mail';
import type { TaxInvoice, TransactionRecord } from '@shared/israeliTax';
import { IsraeliTaxService } from '@shared/israeliTax';
import type { CrmEmailTemplate, CrmCommunicationLog, InsertCrmCommunicationLog } from '@shared/schema';
import { storage } from './storage';
import sanitizeHtml from 'sanitize-html';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { logger } from './lib/logger';
import { replaceTemplates, validateTemplate, type TemplateContext } from './lib/template-engine';

if (!process.env.SENDGRID_API_KEY) {
  logger.warn('SENDGRID_API_KEY not found - email functionality will be disabled');
}

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

export class EmailService {
  private static readonly FROM_EMAIL = 'noreply@petwash.co.il';
  private static readonly SUPPORT_EMAIL = 'Support@PetWash.co.il'; // Using real business email
  private static readonly REPORTS_EMAIL = process.env.REPORTS_EMAIL_TO || 'Support@PetWash.co.il';
  private static readonly REPORTS_CC = process.env.REPORTS_EMAIL_CC || '';
  private static readonly UNSUBSCRIBE_URL = 'https://petwash.co.il/unsubscribe';
  
  // Production-safe rate limiting (TODO: move to persistent storage like Redis in production)
  private static sendCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private static readonly RATE_LIMIT_HOUR = 100; // emails per hour per recipient
  private static readonly RATE_LIMIT_DAY = 500; // emails per day per recipient
  
  // Israeli business hours compliance (8 AM - 8 PM Israel time)
  private static readonly ISRAELI_BUSINESS_START = 8; // 8 AM
  private static readonly ISRAELI_BUSINESS_END = 20;  // 8 PM
  
  /**
   * Send a simple email (for system alerts and internal notifications)
   * Bypasses consent checks and business hours - use only for operational alerts
   */
  static async send(params: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('SendGrid not configured - would send email:', params.subject);
      return true; // Return true for development
    }
    
    try {
      const msg = {
        to: params.to,
        from: params.from || this.FROM_EMAIL,
        subject: params.subject,
        html: params.html,
      };
      
      await mailService.send(msg);
      logger.info(`System email sent to ${params.to}: ${params.subject}`);
      return true;
      
    } catch (error) {
      logger.error('Failed to send system email', error);
      return false;
    }
  }

  /**
   * Check if customer consents to receiving emails
   */
  private static async checkEmailConsent(email: string, messageType: 'transactional' | 'marketing' | 'reminder'): Promise<boolean> {
    try {
      // TODO: Implement suppression list and communication preferences in storage
      // For now, allow all emails (transactional emails always allowed, marketing requires opt-in implementation)
      
      // Transactional emails (invoices, confirmations) are always allowed
      if (messageType === 'transactional') {
        return true;
      }
      
      // For marketing and reminder emails, we'll allow them for now
      // In production, this should check user preferences from the database
      logger.info(`Email consent check passed for ${email} (${messageType})`);
      
      return true;
    } catch (error) {
      logger.error('Error checking email consent', error);
      return messageType === 'transactional'; // Allow transactional, block marketing on error
    }
  }

  /**
   * Check Israeli business hours compliance (8 AM - 8 PM Israel time)
   */
  private static isWithinIsraeliBusinessHours(): boolean {
    const now = new Date();
    const israelTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
    const hour = israelTime.getHours();
    
    const isBusinessHours = hour >= this.ISRAELI_BUSINESS_START && hour < this.ISRAELI_BUSINESS_END;
    
    if (!isBusinessHours) {
      logger.info(`⏰ Outside Israeli business hours (${hour}:00). Business hours: ${this.ISRAELI_BUSINESS_START}:00 - ${this.ISRAELI_BUSINESS_END}:00`);
    }
    
    return isBusinessHours;
  }

  /**
   * Production-safe rate limiting check
   */
  private static checkRateLimit(email: string): boolean {
    const now = Date.now();
    const userLimit = this.sendCounts.get(email);
    
    if (!userLimit) {
      this.sendCounts.set(email, { count: 1, resetTime: now + 3600000 }); // 1 hour
      return true;
    }
    
    // Reset if time window passed
    if (now > userLimit.resetTime) {
      this.sendCounts.set(email, { count: 1, resetTime: now + 3600000 });
      return true;
    }
    
    // Check if under limit
    if (userLimit.count < this.RATE_LIMIT_HOUR) {
      userLimit.count++;
      return true;
    }
    
    logger.info(`Rate limit exceeded for ${email}: ${userLimit.count}/${this.RATE_LIMIT_HOUR} per hour`);
    return false;
  }

  /**
   * Generate secure HMAC-signed unsubscribe token with expiry
   * SECURITY: Uses HMAC signing to prevent token forgery and includes expiry for replay protection
   */
  private static generateUnsubscribeToken(email: string, customerId?: number, userId?: number): string {
    try {
      const now = Date.now();
      const expiryTime = now + (30 * 24 * 60 * 60 * 1000); // 30 days from now
      
      // Create token payload with timestamp and expiry
      const payload = {
        email,
        customerId: customerId || null,
        userId: userId || null,
        timestamp: now,
        expiresAt: expiryTime,
        // Add nonce for additional security
        nonce: crypto.randomBytes(16).toString('hex')
      };
      
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
      
      // Generate HMAC signature using secret key
      const secret = process.env.UNSUBSCRIBE_HMAC_SECRET || 'petwash-unsubscribe-secret-change-in-production';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payloadBase64)
        .digest('hex');
      
      // Combine payload and signature with separator
      const token = `${payloadBase64}.${signature}`;
      
      logger.info(`Generated secure unsubscribe token for ${email} (expires: ${new Date(expiryTime).toISOString()})`);
      return token;
      
    } catch (error) {
      logger.error('Failed to generate unsubscribe token', error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Validate secure HMAC-signed unsubscribe token
   * SECURITY: Verifies signature, checks expiry, and prevents replay attacks
   */
  static validateUnsubscribeToken(token: string): { 
    isValid: boolean; 
    data?: { email: string; customerId?: number; userId?: number; timestamp: number; expiresAt: number; nonce: string }; 
    error?: string;
  } {
    try {
      if (!token || typeof token !== 'string') {
        return { isValid: false, error: 'Invalid token format' };
      }

      // Split token into payload and signature
      const parts = token.split('.');
      if (parts.length !== 2) {
        logger.warn('Invalid token format: missing signature');
        return { isValid: false, error: 'Invalid token format' };
      }

      const [payloadBase64, receivedSignature] = parts;

      // Verify HMAC signature
      const secret = process.env.UNSUBSCRIBE_HMAC_SECRET || 'petwash-unsubscribe-secret-change-in-production';
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadBase64)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      if (!crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'), 
        Buffer.from(receivedSignature, 'hex')
      )) {
        logger.warn('Invalid token signature - potential forgery attempt');
        return { isValid: false, error: 'Invalid token signature' };
      }

      // Decode and parse payload
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);

      // Validate payload structure
      if (!payload.email || !payload.timestamp || !payload.expiresAt) {
        logger.warn('Invalid token payload structure');
        return { isValid: false, error: 'Invalid token payload' };
      }

      // Check token expiry
      const now = Date.now();
      if (now > payload.expiresAt) {
        const expiredDate = new Date(payload.expiresAt);
        logger.warn(`Token expired: ${expiredDate.toISOString()}`);
        return { isValid: false, error: 'Token expired' };
      }

      // Check if token is too old (additional security layer)
      const tokenAge = now - payload.timestamp;
      const maxAge = 32 * 24 * 60 * 60 * 1000; // 32 days (2 days grace period)
      if (tokenAge > maxAge) {
        logger.warn(`Token too old: ${Math.floor(tokenAge / (24 * 60 * 60 * 1000))} days`);
        return { isValid: false, error: 'Token too old' };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(payload.email)) {
        logger.warn(`Invalid email format in token: ${payload.email}`);
        return { isValid: false, error: 'Invalid email format' };
      }

      logger.info(`Valid unsubscribe token for ${payload.email} (age: ${Math.floor(tokenAge / (60 * 60 * 1000))} hours)`);
      
      return {
        isValid: true,
        data: {
          email: payload.email,
          customerId: payload.customerId,
          userId: payload.userId,
          timestamp: payload.timestamp,
          expiresAt: payload.expiresAt,
          nonce: payload.nonce
        }
      };

    } catch (error) {
      logger.error('Token validation error', error);
      return { isValid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Replace template placeholders in email content
   */
  private static replaceTemplateVariables(
    content: string,
    context: TemplateContext,
    locale: 'he' | 'en' = 'he'
  ): string {
    return replaceTemplates(content, context, locale);
  }

  /**
   * Sanitize HTML content for emails
   */
  private static sanitizeEmailContent(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'div', 'span', 'table', 'tr', 'td', 'th', 'tbody', 'thead'],
      allowedAttributes: {
        '*': ['style', 'class'],
        'a': ['href', 'target'],
        'img': ['src', 'alt', 'width', 'height']
      },
      allowedStyles: {
        '*': {
          'color': [/^#([a-f0-9]{3}){1,2}$|^rgb\(/i],
          'background-color': [/^#([a-f0-9]{3}){1,2}$|^rgb\(/i],
          'font-size': [/^\d+px$|^\d+em$|^\d+%$/],
          'text-align': [/^(left|right|center|justify)$/],
          'padding': [/^\d+px$/],
          'margin': [/^\d+px$/]
        }
      }
    });
  }

  /**
   * Send tax invoice to customer
   */
  static async sendTaxInvoice(invoice: TaxInvoice): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('SendGrid not configured - would send invoice:', invoice.invoiceNumber);
      return true; // Return true for development
    }
    
    try {
      // CRITICAL: Check consent (transactional emails are always allowed)
      const hasConsent = await this.checkEmailConsent(invoice.customerEmail, 'transactional');
      if (!hasConsent) {
        logger.info(`Email consent check failed for invoice: ${invoice.customerEmail}`);
        return false;
      }

      // CRITICAL: Rate limiting check
      if (!this.checkRateLimit(invoice.customerEmail)) {
        logger.info(`Rate limit exceeded for invoice: ${invoice.customerEmail}`);
        return false;
      }

      // Sanitize content
      const htmlContent = this.sanitizeEmailContent(IsraeliTaxService.formatInvoiceHTML(invoice));
      
      // Generate unsubscribe token
      const unsubscribeToken = this.generateUnsubscribeToken(invoice.customerEmail);
      const unsubscribeUrl = `${this.UNSUBSCRIBE_URL}?token=${unsubscribeToken}`;
      
      const msg = {
        to: invoice.customerEmail,
        from: this.FROM_EMAIL,
        subject: `חשבונית מס ${invoice.invoiceNumber} - Pet Wash™`,
        html: htmlContent,
        // CRITICAL: List-Unsubscribe headers for legal compliance
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        },
        // Add BCC to support for record keeping
        bcc: this.SUPPORT_EMAIL
      };
      
      await mailService.send(msg);
      logger.info(`Tax invoice sent to ${invoice.customerEmail}`);
      return true;
      
    } catch (error) {
      logger.error('Failed to send tax invoice', error);
      return false;
    }
  }
  
  /**
   * Send transaction report to support team
   */
  static async sendTransactionReport(
    transaction: TransactionRecord, 
    invoice: TaxInvoice
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('SendGrid not configured - would send report for transaction:', transaction.id);
      return true; // Return true for development
    }
    
    try {
      const reportContent = IsraeliTaxService.generateTransactionReport(transaction, invoice);
      
      const msg = {
        to: this.SUPPORT_EMAIL,
        from: this.FROM_EMAIL,
        subject: `Transaction Report ${transaction.id} - ${transaction.customerEmail}`,
        html: reportContent,
        attachments: [
          {
            content: Buffer.from(IsraeliTaxService.formatInvoiceHTML(invoice)).toString('base64'),
            filename: `invoice-${invoice.invoiceNumber}.html`,
            type: 'text/html',
            disposition: 'attachment'
          }
        ]
      };
      
      await mailService.send(msg);
      logger.info(`Transaction report sent to support for transaction ${transaction.id}`);
      return true;
      
    } catch (error) {
      logger.error('Failed to send transaction report', error);
      return false;
    }
  }

  /**
   * Send automated revenue report with Excel, PDF, and CSV attachments
   */
  static async sendRevenueReport(
    reportType: 'daily' | 'monthly' | 'yearly',
    period: string,
    excelBuffer: Buffer,
    pdfBuffer: Buffer,
    csvContent: string,
    summary: { totalRevenue: number; totalTransactions: number }
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info(`SendGrid not configured - would send ${reportType} revenue report for ${period}`);
      return true;
    }

    try {
      const subject = `Pet Wash™ - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Revenue Report - ${period}`;
      
      const htmlContent = `
<!DOCTYPE html>
<html dir="ltr">
<head>
    <meta charset="UTF-8">
    <title>${subject}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #007AFF 0%, #0056b3 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .summary-box { background: #f8f9fa; border-left: 4px solid #007AFF; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .summary-item { margin: 10px 0; font-size: 16px; }
        .summary-item strong { color: #007AFF; }
        .attachments { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .attachments ul { margin: 10px 0; padding-left: 20px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .logo { font-size: 28px; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🐾 Pet Wash™</div>
            <h1>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Revenue Report</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Period: ${period}</p>
        </div>
        
        <div class="content">
            <h2>Executive Summary</h2>
            <div class="summary-box">
                <div class="summary-item">
                    <strong>Total Revenue:</strong> ₪${summary.totalRevenue.toFixed(2)}
                </div>
                <div class="summary-item">
                    <strong>Total Transactions:</strong> ${summary.totalTransactions}
                </div>
                <div class="summary-item">
                    <strong>Average Transaction:</strong> ₪${(summary.totalRevenue / (summary.totalTransactions || 1)).toFixed(2)}
                </div>
            </div>
            
            <div class="attachments">
                <h3 style="margin-top: 0;">📎 Attached Reports</h3>
                <ul>
                    <li><strong>Excel Report (XLSX)</strong> - Detailed breakdown with multiple sheets</li>
                    <li><strong>PDF Report</strong> - Printer-friendly formatted report</li>
                    <li><strong>CSV Export</strong> - Raw data for import/analysis</li>
                </ul>
                <p style="margin-bottom: 0; font-size: 14px;">All reports have been archived to: <code>reports/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/</code></p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This is an automated report generated by Pet Wash™ Revenue Reporting System. 
                Reports are sent to: <strong>${this.REPORTS_EMAIL}</strong>
            </p>
        </div>
        
        <div class="footer">
            <p>Pet Wash™ - Premium Organic Pet Care</p>
            <p>Support@PetWash.co.il | +972549833355</p>
        </div>
    </div>
</body>
</html>
      `;

      const msg: any = {
        to: this.REPORTS_EMAIL,
        from: this.FROM_EMAIL,
        subject,
        html: htmlContent,
        attachments: [
          {
            content: excelBuffer.toString('base64'),
            filename: `revenue_${reportType}_${period.replace(/\//g, '-')}.xlsx`,
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            disposition: 'attachment'
          },
          {
            content: pdfBuffer.toString('base64'),
            filename: `revenue_${reportType}_${period.replace(/\//g, '-')}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment'
          },
          {
            content: Buffer.from(csvContent).toString('base64'),
            filename: `revenue_${reportType}_${period.replace(/\//g, '-')}.csv`,
            type: 'text/csv',
            disposition: 'attachment'
          }
        ]
      };

      // Add CC if configured
      if (this.REPORTS_CC) {
        const ccEmails = this.REPORTS_CC.split(',').map(email => email.trim()).filter(email => email);
        if (ccEmails.length > 0) {
          msg.cc = ccEmails;
        }
      }

      await mailService.send(msg);
      logger.info(`${reportType} revenue report sent to ${this.REPORTS_EMAIL}${this.REPORTS_CC ? ` (CC: ${this.REPORTS_CC})` : ''}`);
      return true;

    } catch (error) {
      logger.error(`Failed to send ${reportType} revenue report`, error);
      return false;
    }
  }

  /**
   * Send VAT declaration notification to CEO/CFO
   */
  static async sendVATDeclarationNotification(params: {
    declarationId: string;
    year: number;
    month: number;
    outputVAT: number;
    inputVAT: number;
    netVAT: number;
    status: 'payment_due' | 'refund_due' | 'balanced';
  }): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info(`SendGrid not configured - would send VAT notification for ${params.month}/${params.year}`);
      return true;
    }

    try {
      const periodStr = `${params.month}/${params.year}`;
      const statusHebrew = params.status === 'payment_due' ? 'תשלום לרשות המסים' : 
                          params.status === 'refund_due' ? 'זכאות להחזר' : 
                          'מאוזן';
      
      const subject = `דוח מע״מ חודשי - ${periodStr} - ${statusHebrew}`;
      
      const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0066cc; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f5f5f5; }
    .alert { padding: 15px; margin: 15px 0; border-radius: 8px; }
    .alert.payment { background: #fff3cd; border-right: 4px solid #ff9800; }
    .alert.refund { background: #e8f5e9; border-right: 4px solid #4caf50; }
    .alert.balanced { background: #e3f2fd; border-right: 4px solid #2196f3; }
    .details { background: white; padding: 15px; margin: 15px 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    td { padding: 10px; border-bottom: 1px solid #ddd; }
    td:first-child { font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐾 Pet Wash Ltd - דוח מע״מ אוטומטי</h1>
    </div>
    <div class="content">
      <h2>דוח מע״מ חודשי</h2>
      <p><strong>תקופה:</strong> ${periodStr}</p>
      <p><strong>מזהה דוח:</strong> ${params.declarationId}</p>
      
      <div class="alert ${params.status === 'payment_due' ? 'payment' : params.status === 'refund_due' ? 'refund' : 'balanced'}">
        <h3>${params.status === 'payment_due' ? '💳 תשלום לרשות המסים' : 
             params.status === 'refund_due' ? '💰 זכאות להחזר מע״מ' : 
             '⚖️ מאוזן'}</h3>
        <p style="font-size: 24px; font-weight: bold; margin: 10px 0;">
          ₪${Math.abs(params.netVAT).toLocaleString('he-IL', { minimumFractionDigits: 2 })}
        </p>
      </div>
      
      <div class="details">
        <h3>פירוט חישוב מע״מ</h3>
        <table>
          <tr>
            <td>מע״מ עסקאות (שנגבה מלקוחות)</td>
            <td>₪${params.outputVAT.toLocaleString('he-IL', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td>מע״מ תשומות (ששולם לספקים)</td>
            <td>₪${params.inputVAT.toLocaleString('he-IL', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr style="background: #f5f5f5; font-weight: bold;">
            <td>מע״מ נטו</td>
            <td>₪${params.netVAT.toLocaleString('he-IL', { minimumFractionDigits: 2 })}</td>
          </tr>
        </table>
      </div>
      
      <p><strong>הערה:</strong> דוח זה נוצר אוטומטית ונמצא במצב טיוטה. יש לבדוק ולאשר לפני הגשה לרשות המסים.</p>
      
      <p>לצפייה בדוח המלא: <a href="${process.env.BASE_URL || 'https://petwash.co.il'}/dashboard">פאנל ניהול</a></p>
    </div>
  </div>
</body>
</html>
      `;
      
      // Send to CEO and National Operations Director
      const recipients = [
        'nir.h@petwash.co.il',  // CEO
        'ido.s@petwash.co.il'   // National Operations Director - Ido Shakarzi
      ];
      
      for (const recipient of recipients) {
        await this.send({
          to: recipient,
          subject,
          html,
        });
      }
      
      logger.info(`VAT declaration notification sent for ${periodStr} to CEO/CFO`);
      return true;
      
    } catch (error) {
      logger.error('Failed to send VAT declaration notification', error);
      return false;
    }
  }

  /**
   * Send employee expense submission notification to supervisor
   */
  static async sendEmployeeExpenseNotification(params: {
    expenseId: string;
    employeeEmail: string;
    category: string;
    description: string;
    totalAmount: number;
    vendor: string;
    supervisorEmail?: string;
  }): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info(`SendGrid not configured - would send expense notification for ${params.expenseId}`);
      return true;
    }

    try {
      const subject = `New Employee Expense Submitted - ${params.expenseId} - ₪${params.totalAmount.toFixed(2)}`;
      
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { padding: 30px; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
    .badge { display: inline-block; padding: 8px 16px; background: #667eea; color: white; border-radius: 20px; font-size: 14px; margin: 10px 0; }
    .details { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
    .amount { font-size: 32px; font-weight: bold; color: #667eea; margin: 15px 0; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    td { padding: 12px; border-bottom: 1px solid #e0e0e0; }
    td:first-child { font-weight: bold; color: #666; width: 40%; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐾 PetWash™ Expense Center</h1>
      <div class="badge">New Expense Submission</div>
    </div>
    <div class="content">
      <h2>Employee Expense Approval Required</h2>
      <p>A new expense has been submitted for your approval.</p>
      
      <div class="details">
        <p><strong>Expense ID:</strong> ${params.expenseId}</p>
        <div class="amount">₪${params.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        
        <table>
          <tr>
            <td>Submitted by:</td>
            <td>${params.employeeEmail}</td>
          </tr>
          <tr>
            <td>Category:</td>
            <td>${params.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
          </tr>
          <tr>
            <td>Vendor:</td>
            <td>${params.vendor}</td>
          </tr>
          <tr>
            <td>Description:</td>
            <td>${params.description}</td>
          </tr>
          <tr>
            <td>Status:</td>
            <td><span style="background: #ffa500; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">Pending Approval</span></td>
          </tr>
        </table>
      </div>
      
      <p style="margin-top: 25px;">
        <strong>Next Steps:</strong><br>
        Log in to your PetWash™ dashboard to review and approve this expense.
      </p>
    </div>
    <div class="footer">
      <p>PetWash Ltd (חברת פטוואש בע״מ) - Premium Organic Pet Care Platform</p>
      <p>This is an automated notification from your expense management system.</p>
    </div>
  </div>
</body>
</html>
      `;

      // Send to supervisor or default to CEO and National Operations Director
      const recipients = params.supervisorEmail 
        ? [params.supervisorEmail]
        : [
            'nir.h@petwash.co.il',  // CEO - Nir Hadad
            'ido.s@petwash.co.il'   // National Operations Director - Ido Shakarzi
          ];
      
      for (const recipient of recipients) {
        await this.send({
          to: recipient,
          subject,
          html,
        });
      }

      logger.info(`Employee expense notification sent for ${params.expenseId}`);
      return true;

    } catch (error) {
      logger.error('Failed to send employee expense notification', error);
      return false;
    }
  }

  /**
   * Send blank expense form draft to CEO and National Operations Director
   */
  static async sendBlankExpenseFormDraft(): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('SendGrid not configured - would send blank expense form draft');
      return true;
    }

    try {
      const subject = 'PetWash™ Employee Expense Form - Blank Draft for Review';
      
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; }
    .form-container { background: white; padding: 40px; margin: 20px 0; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .form-group { margin: 25px 0; }
    .form-label { font-weight: bold; color: #333; display: block; margin-bottom: 8px; font-size: 14px; }
    .form-input { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 14px; background: #fafafa; }
    .form-select { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 6px; background: #fafafa; }
    .form-textarea { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 6px; min-height: 80px; font-family: Arial; background: #fafafa; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
    .section-title { background: #667eea; color: white; padding: 12px 20px; margin: 30px -40px 25px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 13px; }
    .watermark { text-align: center; color: #999; font-size: 12px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐾 PetWash™ Employee Expense Form</h1>
      <p style="font-size: 18px; margin-top: 10px;">Premium 7-Star Expense Management System</p>
    </div>
    
    <div class="form-container">
      <div class="watermark">DRAFT FOR REVIEW - BLANK TEMPLATE</div>
      
      <div class="form-group">
        <label class="form-label">Expense Category *</label>
        <select class="form-select">
          <option>-- Select Category --</option>
          <option>Fuel & Transportation</option>
          <option>Client Lunch/Dinner</option>
          <option>Equipment & Technology</option>
          <option>Overseas Work Trip</option>
          <option>Domestic Work Trip</option>
          <option>Office Supplies</option>
          <option>Marketing & Advertising</option>
          <option>Training & Development</option>
          <option>Other Business Expense</option>
        </select>
      </div>
      
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Vendor/Supplier Name *</label>
          <input type="text" class="form-input" placeholder="e.g., Paz Gas Station, Dell..." />
        </div>
        <div class="form-group">
          <label class="form-label">Payment Method *</label>
          <select class="form-select">
            <option>-- Select Payment Method --</option>
            <option>Company Credit Card</option>
            <option>Personal Card (Reimbursement)</option>
            <option>Cash</option>
            <option>Bank Transfer</option>
            <option>Check</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Detailed Description *</label>
        <textarea class="form-textarea" placeholder="Provide full details: purpose, date, location, attendees (if meal), project/client name..."></textarea>
      </div>
      
      <div class="section-title">Financial Details</div>
      
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Amount Before VAT *</label>
          <input type="text" class="form-input" placeholder="₪0.00" />
        </div>
        <div class="form-group">
          <label class="form-label">VAT Amount (18%)</label>
          <input type="text" class="form-input" placeholder="Auto-calculated" style="background: #f0f0f0;" readonly />
        </div>
        <div class="form-group">
          <label class="form-label">Total Amount *</label>
          <input type="text" class="form-input" placeholder="₪0.00" style="font-weight: bold;" />
        </div>
      </div>
      
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Receipt Number</label>
          <input type="text" class="form-input" placeholder="Optional" />
        </div>
        <div class="form-group">
          <label class="form-label">Invoice Number</label>
          <input type="text" class="form-input" placeholder="Optional" />
        </div>
        <div class="form-group">
          <label class="form-label">Tax Month *</label>
          <select class="form-select">
            <option>-- Select Month --</option>
            <option>January</option>
            <option>February</option>
            <option>March</option>
            <option>April</option>
            <option>May</option>
            <option>June</option>
            <option>July</option>
            <option>August</option>
            <option>September</option>
            <option>October</option>
            <option>November</option>
            <option>December</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Additional Notes</label>
        <textarea class="form-textarea" placeholder="Any additional information..."></textarea>
      </div>
      
      <div style="text-align: center; margin-top: 30px;">
        <button style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 15px 40px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer;">
          ✓ Submit & Continue
        </button>
      </div>
      
      <div class="watermark" style="margin-top: 30px;">
        Each expense submission is tracked with your employee ID and label number for seamless approval workflow.
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Nir Hadad (CEO) & Ido Shakarzi (National Operations Director)</strong></p>
      <p>This blank draft showcases the employee expense form layout and fields.</p>
      <p>Employees can easily fill and submit expenses of any type - the form auto-resets after each submission.</p>
      <p style="margin-top: 15px;">PetWash Ltd (חברת פטוואש בע״מ) - www.petwash.co.il</p>
    </div>
  </div>
</body>
</html>
      `;

      // Send to CEO and National Operations Director
      const recipients = [
        'nir.h@petwash.co.il',  // CEO - Nir Hadad
        'ido.s@petwash.co.il'   // National Operations Director - Ido Shakarzi
      ];
      
      for (const recipient of recipients) {
        await this.send({
          to: recipient,
          subject,
          html,
        });
      }

      logger.info('Blank expense form draft sent to CEO and National Operations Director');
      return true;

    } catch (error) {
      logger.error('Failed to send blank expense form draft', error);
      return false;
    }
  }

  /**
   * Send sample VAT submission to Israeli Tax Authority (demonstration)
   */
  static async sendSampleVATSubmissionTaxAuthority(): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('SendGrid not configured - would send sample VAT submission');
      return true;
    }

    try {
      const subject = 'Sample VAT Declaration - PetWash Ltd to Israeli Tax Authority - דוגמה';
      
      const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; direction: rtl; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; background: #ffffff; }
    .header { background: #003d82; color: white; padding: 30px; text-align: center; }
    .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    .content { padding: 30px; }
    .declaration-box { border: 3px solid #003d82; padding: 25px; margin: 25px 0; background: #f9f9f9; }
    .company-info { background: #e8f4f8; padding: 20px; margin: 20px 0; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #003d82; color: white; padding: 15px; text-align: right; }
    td { padding: 12px; border-bottom: 1px solid #ddd; }
    td:first-child { font-weight: bold; width: 50%; }
    .total-row { background: #fff3cd; font-weight: bold; font-size: 18px; }
    .status-badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-weight: bold; }
    .status-refund { background: #4caf50; color: white; }
    .footer { background: #f5f5f5; padding: 20px; margin-top: 30px; text-align: center; font-size: 13px; color: #666; }
    .watermark { text-align: center; color: #999; font-size: 14px; margin: 15px 0; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🇮🇱 רשות המיסים בישראל</div>
      <h1>דוח מס ערך מוסף (מע״מ)</h1>
      <p>Israel Tax Authority - VAT Declaration</p>
    </div>
    
    <div class="content">
      <div class="watermark">⚠️ דוגמה להמחשה בלבד - SAMPLE FOR DEMONSTRATION ⚠️</div>
      
      <div class="company-info">
        <h2>פרטי המדווח / Company Details</h2>
        <table style="background: white;">
          <tr>
            <td>שם החברה / Company Name:</td>
            <td><strong>חברת פטוואש בע״מ / PetWash Ltd</strong></td>
          </tr>
          <tr>
            <td>ח.פ. / Company ID:</td>
            <td>PETWASH_LTD</td>
          </tr>
          <tr>
            <td>כתובת / Address:</td>
            <td>Tel Aviv, Israel</td>
          </tr>
          <tr>
            <td>תקופת דיווח / Reporting Period:</td>
            <td><strong>אוקטובר 2024 / October 2024</strong></td>
          </tr>
          <tr>
            <td>מזהה דוח / Declaration ID:</td>
            <td><strong>VAT-2024-10-SAMPLE</strong></td>
          </tr>
          <tr>
            <td>תאריך הגשה / Submission Date:</td>
            <td>31 באוקטובר 2025 / October 31, 2025</td>
          </tr>
        </table>
      </div>
      
      <div class="declaration-box">
        <h2>סיכום מע״מ / VAT Summary</h2>
        
        <h3>מע״מ עסקאות (פלט) / Output VAT - Sales</h3>
        <table>
          <tr>
            <th>פריט / Item</th>
            <th>סכום / Amount</th>
          </tr>
          <tr>
            <td>סך הכל הכנסות / Total Revenue:</td>
            <td>₪0.00</td>
          </tr>
          <tr>
            <td>הכנסות ללא מע״מ / Revenue Excl. VAT:</td>
            <td>₪0.00</td>
          </tr>
          <tr>
            <td>מע״מ שנגבה / VAT Collected (18%):</td>
            <td><strong>₪0.00</strong></td>
          </tr>
          <tr>
            <td>מספר עסקאות / Transaction Count:</td>
            <td>0</td>
          </tr>
        </table>
        
        <h3 style="margin-top: 30px;">מע״מ תשומות (קלט) / Input VAT - Expenses</h3>
        <table>
          <tr>
            <th>פריט / Item</th>
            <th>סכום / Amount</th>
          </tr>
          <tr>
            <td>סך הכל הוצאות / Total Expenses:</td>
            <td>₪13,724.10</td>
          </tr>
          <tr>
            <td>הוצאות ללא מע״מ / Expenses Excl. VAT:</td>
            <td>₪11,730.00</td>
          </tr>
          <tr>
            <td>מע״מ ששולם / VAT Paid (18%):</td>
            <td><strong>₪1,994.10</strong></td>
          </tr>
          <tr>
            <td>מספר הוצאות / Expense Count:</td>
            <td>6</td>
          </tr>
        </table>
        
        <h3 style="margin-top: 30px;">חישוב סופי / Final Calculation</h3>
        <table>
          <tr class="total-row">
            <td>מע״מ תשלום / זיכוי / Net VAT Position:</td>
            <td>
              <span class="status-badge status-refund">₪-1,994.10 (זכאות להחזר)</span>
            </td>
          </tr>
        </table>
        
        <div style="background: #e8f5e9; padding: 20px; margin: 25px 0; border-radius: 8px; border-right: 4px solid #4caf50;">
          <h3 style="color: #2e7d32; margin: 0 0 10px 0;">💰 החזר מע״מ / VAT Refund Eligible</h3>
          <p style="margin: 5px 0; font-size: 16px;">
            <strong>סכום להחזר / Refund Amount:</strong> ₪1,994.10
          </p>
          <p style="margin: 5px 0; font-size: 14px; color: #666;">
            החזר יבוצע לחשבון הבנק הרשום / Refund will be processed to registered bank account
          </p>
        </div>
      </div>
      
      <div class="watermark">⚠️ זהו מסמך לדוגמה להמחשת המערכת בלבד - לא מהווה הצהרת מס רשמית ⚠️</div>
      <div class="watermark">⚠️ SAMPLE DOCUMENT FOR SYSTEM DEMONSTRATION - NOT AN OFFICIAL TAX DECLARATION ⚠️</div>
      
    </div>
    
    <div class="footer">
      <p><strong>PetWash Ltd (חברת פטוואש בע״מ)</strong></p>
      <p>www.petwash.co.il | nir.h@petwash.co.il | ido.s@petwash.co.il</p>
      <p style="margin-top: 15px;">
        This sample demonstrates the format of VAT declarations submitted to the Israeli Tax Authority.<br>
        The system automatically calculates Output VAT (collected) - Input VAT (paid) and determines refund eligibility.
      </p>
      <p style="margin-top: 10px; font-size: 12px;">
        Generated by PetWash™ Israeli VAT Reclaim System - Production Ready
      </p>
    </div>
  </div>
</body>
</html>
      `;

      // Send to CEO and National Operations Director
      const recipients = [
        'nir.h@petwash.co.il',  // CEO - Nir Hadad
        'ido.s@petwash.co.il'   // National Operations Director - Ido Shakarzi
      ];
      
      for (const recipient of recipients) {
        await this.send({
          to: recipient,
          subject,
          html,
        });
      }

      logger.info('Sample VAT submission sent to CEO and National Operations Director');
      return true;

    } catch (error) {
      logger.error('Failed to send sample VAT submission', error);
      return false;
    }
  }
  
  /**
   * Send gift card to recipient
   */
  static async sendGiftCard(
    invoice: TaxInvoice,
    voucherCode: string,
    qrCode: string
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('SendGrid not configured - would send gift card:', voucherCode);
      return true;
    }
    
    try {
      const recipientEmail = invoice.recipientEmail || invoice.customerEmail;
      
      // CRITICAL: Check consent (transactional)
      const hasConsent = await this.checkEmailConsent(recipientEmail, 'transactional');
      if (!hasConsent) {
        logger.info(`Email consent check failed for gift card: ${recipientEmail}`);
        return false;
      }

      // CRITICAL: Rate limiting check
      if (!this.checkRateLimit(recipientEmail)) {
        logger.info(`Rate limit exceeded for gift card: ${recipientEmail}`);
        return false;
      }
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Pet Wash™ Gift Card</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
        .gift-card { max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #000; border-radius: 10px; }
        .logo { font-size: 2em; font-weight: bold; margin-bottom: 20px; }
        .amount { font-size: 1.5em; color: #333; margin: 20px 0; }
        .code { font-size: 1.2em; font-weight: bold; background-color: #f0f0f0; padding: 10px; border-radius: 5px; margin: 20px 0; }
        .qr-placeholder { width: 200px; height: 200px; border: 2px dashed #ccc; margin: 20px auto; display: flex; align-items: center; justify-content: center; }
        .instructions { margin-top: 20px; font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <div class="gift-card">
        <div class="logo">Pet Wash™</div>
        <h2>Premium Pet Wash Gift Card</h2>
        <div class="amount">Value: ₪${invoice.totalAmount.toFixed(2)}</div>
        <div class="code">Gift Card Code: ${voucherCode}</div>
        <div class="qr-placeholder">
            QR Code will be generated here
        </div>
        <div class="instructions">
            <p>Present this QR code at any Pet Wash™ station to redeem your wash.</p>
            <p>This gift card expires 12 months from the date of purchase.</p>
            <p>For support, contact: ${EmailService.SUPPORT_EMAIL}</p>
        </div>
    </div>
</body>
</html>`;
      
      const msg = {
        to: recipientEmail,
        from: this.FROM_EMAIL,
        subject: `🎁 Pet Wash™ Gift Card - ${voucherCode}`,
        html: htmlContent,
        // CRITICAL: List-Unsubscribe headers for legal compliance  
        headers: {
          'List-Unsubscribe': `<${this.UNSUBSCRIBE_URL}?token=${this.generateUnsubscribeToken(recipientEmail)}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        },
        // BCC support for record keeping
        bcc: this.SUPPORT_EMAIL
      };
      
      await mailService.send(msg);
      logger.info(`Gift card sent to ${recipientEmail}`);
      return true;
      
    } catch (error) {
      logger.error('Failed to send gift card', error);
      return false;
    }
  }
  
  /**
   * Send purchase confirmation to customer
   */
  static async sendPurchaseConfirmation(
    invoice: TaxInvoice,
    voucherCode: string
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('SendGrid not configured - would send confirmation:', invoice.invoiceNumber);
      return true;
    }
    
    try {
      // CRITICAL: Check consent (transactional)
      const hasConsent = await this.checkEmailConsent(invoice.customerEmail, 'transactional');
      if (!hasConsent) {
        logger.info(`Email consent check failed for purchase confirmation: ${invoice.customerEmail}`);
        return false;
      }

      // CRITICAL: Rate limiting check
      if (!this.checkRateLimit(invoice.customerEmail)) {
        logger.info(`Rate limit exceeded for purchase confirmation: ${invoice.customerEmail}`);
        return false;
      }
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Purchase Confirmation - Pet Wash™</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
        .section { margin-bottom: 20px; }
        .voucher-code { font-size: 1.2em; font-weight: bold; background-color: #f0f0f0; padding: 10px; border-radius: 5px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Pet Wash™ Purchase Confirmation</h1>
        <p>Thank you for your purchase!</p>
    </div>
    
    <div class="section">
        <h3>Order Details:</h3>
        <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
        <p><strong>Package:</strong> ${invoice.packageName}</p>
        <p><strong>Amount Paid:</strong> ₪${invoice.totalAmount.toFixed(2)}</p>
        <p><strong>Payment Method:</strong> ${invoice.paymentMethod}</p>
    </div>
    
    <div class="section">
        <h3>Your Voucher Code:</h3>
        <div class="voucher-code">${voucherCode}</div>
        <p>Present this code at any Pet Wash™ station to redeem your wash.</p>
    </div>
    
    <div class="section">
        <p>A detailed tax invoice has been sent to you separately.</p>
        <p>For any questions, contact: ${EmailService.SUPPORT_EMAIL}</p>
    </div>
</body>
</html>`;
      
      const msg = {
        to: invoice.customerEmail,
        from: this.FROM_EMAIL,
        subject: `Purchase Confirmation ${invoice.invoiceNumber} - Pet Wash™`,
        html: this.sanitizeEmailContent(htmlContent),
        // CRITICAL: List-Unsubscribe headers for legal compliance
        headers: {
          'List-Unsubscribe': `<${this.UNSUBSCRIBE_URL}?token=${this.generateUnsubscribeToken(invoice.customerEmail)}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      };
      
      await mailService.send(msg);
      logger.info(`Purchase confirmation sent to ${invoice.customerEmail}`);
      return true;
      
    } catch (error) {
      logger.error('Failed to send purchase confirmation', error);
      return false;
    }
  }

  /**
   * CRITICAL: Send appointment reminder (used by background job processor)
   */
  static async sendAppointmentReminder(params: {
    reminderId: number;
    customerData: any;
    appointmentData: any;
    dryRun: boolean;
  }): Promise<boolean> {
    const { reminderId, customerData, appointmentData, dryRun } = params;
    
    if (!process.env.SENDGRID_API_KEY && !dryRun) {
      logger.info('SendGrid not configured - would send appointment reminder:', reminderId);
      return true; // Return true for development
    }
    
    try {
      const email = customerData.email;
      
      if (!email) {
        logger.error(`No email found for appointment reminder ${reminderId}`);
        return false;
      }

      // CRITICAL: Check consent (reminder type)
      const hasConsent = await this.checkEmailConsent(email, 'reminder');
      if (!hasConsent) {
        logger.info(`Email consent check failed for appointment reminder: ${email}`);
        return false;
      }

      // CRITICAL: Israeli business hours compliance for reminders
      if (!this.isWithinIsraeliBusinessHours()) {
        logger.info(`⏰ Appointment reminder ${reminderId} scheduled outside business hours`);
        // For reminders, we reschedule rather than fail
        return false; // This will trigger a retry later
      }

      // CRITICAL: Rate limiting check
      if (!this.checkRateLimit(email)) {
        logger.info(`Rate limit exceeded for appointment reminder: ${email}`);
        return false;
      }

      const appointmentDate = new Date(appointmentData.appointmentDate).toLocaleDateString('he-IL');
      const appointmentTime = new Date(appointmentData.appointmentDate).toLocaleTimeString('he-IL', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const htmlContent = `
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Pet Wash™ - תזכורת לטיפול</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; direction: rtl; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
        .section { margin-bottom: 20px; }
        .highlight { background-color: #f0f8ff; padding: 15px; border-radius: 5px; text-align: center; }
        .important { color: #d9534f; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Pet Wash™</h1>
        <h2>תזכורת לטיפול בחיית המחמד שלכם</h2>
    </div>
    
    <div class="section">
        <h3>שלום ${customerData.name || customerData.firstName || 'לקוח יקר'},</h3>
        <p>אנו רוצים להזכיר לכם על הטיפול הקרוב בחיית המחמד שלכם:</p>
    </div>
    
    <div class="highlight">
        <h3>פרטי הטיפול:</h3>
        <p><strong>תאריך:</strong> ${appointmentDate}</p>
        <p><strong>שעה:</strong> ${appointmentTime}</p>
        <p><strong>סוג טיפול:</strong> ${appointmentData.serviceType}</p>
        <p><strong>מיקום:</strong> ${appointmentData.location}</p>
        ${appointmentData.bookingReference ? `<p><strong>מספר הזמנה:</strong> ${appointmentData.bookingReference}</p>` : ''}
    </div>
    
    <div class="section">
        <p class="important">חשוב להגיע בזמן! אם אתם צריכים לבטל או לדחות, אנא צרו קשר מראש.</p>
        <p>לשאלות נוספות: ${this.SUPPORT_EMAIL}</p>
        <p>תודה שבחרתם ב-Pet Wash™!</p>
    </div>
</body>
</html>`;

      if (dryRun) {
        logger.info(`DRY RUN: Would send appointment reminder to ${email} for ${appointmentDate} ${appointmentTime}`);
        return true;
      }

      // Generate unsubscribe token
      const unsubscribeToken = this.generateUnsubscribeToken(email, customerData.id);
      const unsubscribeUrl = `${this.UNSUBSCRIBE_URL}?token=${unsubscribeToken}`;
      
      const msg = {
        to: email,
        from: this.FROM_EMAIL,
        subject: `תזכורת טיפול Pet Wash™ - ${appointmentDate} ${appointmentTime}`,
        html: this.sanitizeEmailContent(htmlContent),
        // CRITICAL: List-Unsubscribe headers for legal compliance
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      };
      
      await mailService.send(msg);
      
      // TODO: Log to CRM communication logs (schema mismatch - needs communication ID)
      // await storage.createCommunicationLog({
      //   communicationId: ..., // Need to create communication first
      //   deliveryStatus: 'sent',
      //   externalMessageId: nanoid()
      // });
      
      logger.info(`Appointment reminder sent to ${email} for ${appointmentDate} ${appointmentTime}`);
      return true;
      
    } catch (error) {
      logger.error('Failed to send appointment reminder', error);
      return false;
    }
  }

  /**
   * Send birthday discount email with voucher code
   */
  static async sendBirthdayDiscount(params: {
    email: string;
    firstName?: string;
    dogName?: string;
    voucherCode: string;
    expiresAt: Date;
    language?: 'he' | 'en';
  }): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('SendGrid not configured - would send birthday discount:', params.voucherCode);
      return true; // Return true for development
    }
    
    try {
      const { email, firstName, dogName, voucherCode, expiresAt, language = 'he' } = params;
      
      // CRITICAL: Check consent (marketing type - birthday special offer)
      const hasConsent = await this.checkEmailConsent(email, 'marketing');
      if (!hasConsent) {
        logger.info(`Email consent check failed for birthday discount: ${email}`);
        return false;
      }

      // CRITICAL: Rate limiting check
      if (!this.checkRateLimit(email)) {
        logger.info(`Rate limit exceeded for birthday discount: ${email}`);
        return false;
      }

      const expiryDate = expiresAt.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Hebrew email template
      const hebrewTemplate = `
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>🎉 יום הולדת שמח ${dogName || 'לכלב שלך'}!</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 0; 
            direction: rtl;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
            background: linear-gradient(135deg, #0B57D0 0%, #4E8DF7 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 700;
        }
        .header .emoji {
            font-size: 64px;
            margin-bottom: 10px;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 24px;
            color: #333;
            margin-bottom: 20px;
            text-align: center;
        }
        .message {
            font-size: 18px;
            color: #666;
            line-height: 1.6;
            text-align: center;
            margin-bottom: 30px;
        }
        .voucher-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            text-align: center;
        }
        .voucher-label {
            color: rgba(255,255,255,0.9);
            font-size: 14px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .voucher-code {
            background: white;
            color: #667eea;
            font-size: 28px;
            font-weight: 700;
            padding: 15px 25px;
            border-radius: 10px;
            display: inline-block;
            letter-spacing: 2px;
            margin: 10px 0;
        }
        .discount-amount {
            color: white;
            font-size: 48px;
            font-weight: 700;
            margin: 20px 0;
        }
        .cta-button {
            display: inline-block;
            background: #0B57D0;
            color: white;
            text-decoration: none;
            padding: 18px 40px;
            border-radius: 50px;
            font-size: 18px;
            font-weight: 600;
            margin: 20px 0;
            transition: all 0.3s ease;
        }
        .expiry {
            background: #FFF3CD;
            border: 2px solid #FFC107;
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
            color: #856404;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
        }
        .paw-prints {
            font-size: 24px;
            opacity: 0.3;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="emoji">🎂🐕🎉</div>
            <h1>Pet Wash™</h1>
        </div>
        
        <div class="content">
            <div class="greeting">
                ${firstName ? `שלום ${firstName},` : 'שלום,'}
            </div>
            
            <div class="message">
                <strong>יום הולדת שמח ל${dogName || 'חבר הכלב שלך'}! 🎊</strong><br><br>
                אנחנו מתרגשים לחגוג את היום המיוחד הזה איתך!<br>
                כמתנה, הנה הנחה מיוחדת שלנו עבורך:
            </div>

            <div class="voucher-box">
                <div class="discount-amount">10% הנחה</div>
                <div class="voucher-label">קוד ההנחה שלך</div>
                <div class="voucher-code">${voucherCode}</div>
            </div>

            <div style="text-align: center;">
                <a href="https://petwash.co.il/packages" class="cta-button">
                    🎁 השתמש במתנה שלך עכשיו
                </a>
            </div>

            <div class="expiry">
                ⏰ תוקף הקופון: עד ${expiryDate}<br>
                (30 יום מהיום)
            </div>

            <div class="message" style="margin-top: 30px;">
                <div class="paw-prints">🐾 🐾 🐾</div>
                <p>תודה שאתה חלק ממשפחת Pet Wash™!</p>
            </div>
        </div>

        <div class="footer">
            <p>Pet Wash™ | שירותי רחצה פרימיום לחיות מחמד</p>
            <p>Support@PetWash.co.il | www.petwash.co.il</p>
        </div>
    </div>
</body>
</html>`;

      // English email template
      const englishTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>🎉 Happy Birthday ${dogName || 'to Your Dog'}!</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 0; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
            background: linear-gradient(135deg, #0B57D0 0%, #4E8DF7 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: 700;
        }
        .header .emoji {
            font-size: 64px;
            margin-bottom: 10px;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 24px;
            color: #333;
            margin-bottom: 20px;
            text-align: center;
        }
        .message {
            font-size: 18px;
            color: #666;
            line-height: 1.6;
            text-align: center;
            margin-bottom: 30px;
        }
        .voucher-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            text-align: center;
        }
        .voucher-label {
            color: rgba(255,255,255,0.9);
            font-size: 14px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .voucher-code {
            background: white;
            color: #667eea;
            font-size: 28px;
            font-weight: 700;
            padding: 15px 25px;
            border-radius: 10px;
            display: inline-block;
            letter-spacing: 2px;
            margin: 10px 0;
        }
        .discount-amount {
            color: white;
            font-size: 48px;
            font-weight: 700;
            margin: 20px 0;
        }
        .cta-button {
            display: inline-block;
            background: #0B57D0;
            color: white;
            text-decoration: none;
            padding: 18px 40px;
            border-radius: 50px;
            font-size: 18px;
            font-weight: 600;
            margin: 20px 0;
            transition: all 0.3s ease;
        }
        .expiry {
            background: #FFF3CD;
            border: 2px solid #FFC107;
            border-radius: 10px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
            color: #856404;
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
        }
        .paw-prints {
            font-size: 24px;
            opacity: 0.3;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="emoji">🎂🐕🎉</div>
            <h1>Pet Wash™</h1>
        </div>
        
        <div class="content">
            <div class="greeting">
                ${firstName ? `Hello ${firstName},` : 'Hello,'}
            </div>
            
            <div class="message">
                <strong>Happy Birthday to ${dogName || 'Your Furry Friend'}! 🎊</strong><br><br>
                We're excited to celebrate this special day with you!<br>
                As a gift, here's a special discount just for you:
            </div>

            <div class="voucher-box">
                <div class="discount-amount">10% OFF</div>
                <div class="voucher-label">Your Discount Code</div>
                <div class="voucher-code">${voucherCode}</div>
            </div>

            <div style="text-align: center;">
                <a href="https://petwash.co.il/packages" class="cta-button">
                    🎁 Use Your Gift Now
                </a>
            </div>

            <div class="expiry">
                ⏰ Valid Until: ${expiryDate}<br>
                (30 days from today)
            </div>

            <div class="message" style="margin-top: 30px;">
                <div class="paw-prints">🐾 🐾 🐾</div>
                <p>Thank you for being part of the Pet Wash™ family!</p>
            </div>
        </div>

        <div class="footer">
            <p>Pet Wash™ | Premium Pet Wash Services</p>
            <p>Support@PetWash.co.il | www.petwash.co.il</p>
        </div>
    </div>
</body>
</html>`;

      const htmlContent = language === 'he' ? hebrewTemplate : englishTemplate;
      const subject = language === 'he' 
        ? `🎉 יום הולדת שמח ${dogName || ''}! 10% הנחה מיוחדת - Pet Wash™`
        : `🎉 Happy Birthday ${dogName || ''}! Special 10% Discount - Pet Wash™`;
      
      // Generate unsubscribe token
      const unsubscribeToken = this.generateUnsubscribeToken(email);
      const unsubscribeUrl = `${this.UNSUBSCRIBE_URL}?token=${unsubscribeToken}`;
      
      const msg = {
        to: email,
        from: this.FROM_EMAIL,
        subject,
        html: this.sanitizeEmailContent(htmlContent),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      };
      
      await mailService.send(msg);
      
      // TODO: Log to CRM communication logs (schema mismatch - needs communication ID)
      // await storage.createCommunicationLog({
      //   communicationId: ..., // Need to create communication first
      //   deliveryStatus: 'sent',
      //   externalMessageId: nanoid()
      // });
      
      logger.info(`Birthday discount email sent to ${email} - Code: ${voucherCode}`);
      return true;
      
    } catch (error) {
      logger.error('Failed to send birthday discount email', error);
      return false;
    }
  }

  /**
   * Send vaccine reminder email
   */
  static async sendVaccineReminder(params: {
    to: string;
    locale: 'he' | 'en';
    petName: string;
    vaccineName: string;
    dueDateISO: string;
    managePetsUrl?: string;
    petId?: string;
    allPets?: Array<{
      petId: string;
      petName: string;
      vaccineType: string;
      vaccineDate: string;
    }>;
  }): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('SendGrid not configured - would send vaccine reminder:', params.petName);
      return true; // Return true for development
    }
    
    try {
      const { to, locale, petName, vaccineName, dueDateISO, managePetsUrl = 'https://petwash.co.il/pets', petId, allPets } = params;
      
      // Vaccine reminders are TRANSACTIONAL (pet health), not marketing
      // They always send regardless of marketing preferences
      const hasConsent = await this.checkEmailConsent(to, 'transactional');
      if (!hasConsent) {
        logger.info(`Email consent check failed for vaccine reminder: ${to}`);
        return false;
      }

      // Rate limiting
      if (!this.checkRateLimit(to)) {
        logger.info(`Rate limit exceeded for vaccine reminder: ${to}`);
        return false;
      }

      // Calculate days until vaccine
      const dueDate = new Date(dueDateISO);
      const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      const { db } = await import('./lib/firebase-admin');
      
      // Try to fetch template from Firestore
      let hebrewTemplate: string = '';
      let englishTemplate: string = '';
      let usedFallback = false;
      
      try {
        const templateDoc = await db.collection('email_templates').doc('vaccine_reminder_v1').get();
        
        if (templateDoc.exists) {
          const templateData = templateDoc.data();
          hebrewTemplate = templateData?.hebrewTemplate;
          englishTemplate = templateData?.englishTemplate;
          logger.info('Loaded vaccine reminder template from Firestore: vaccine_reminder_v1');
        } else {
          throw new Error('Template not found in Firestore');
        }
      } catch (templateError) {
        logger.warn('Could not load template from Firestore, using fallback:', templateError);
        usedFallback = true;
        
        // Format due date
        const dueDate = new Date(dueDateISO);
        const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        // Fallback Hebrew template
        hebrewTemplate = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>תזכורת חיסון - Pet Wash™</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f4f8; padding: 0; margin: 0; }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center; color: white; }
        .header-icon { font-size: 60px; margin-bottom: 15px; }
        .header-title { font-size: 28px; font-weight: 700; margin: 0; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 22px; color: #1f2937; margin-bottom: 20px; font-weight: 600; }
        .message { color: #4b5563; font-size: 16px; line-height: 1.8; margin-bottom: 25px; }
        .reminder-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 15px; padding: 25px; margin: 30px 0; text-align: center; }
        .pet-name { font-size: 24px; font-weight: 700; color: #92400e; margin-bottom: 10px; }
        .vaccine-info { font-size: 18px; color: #78350f; margin: 10px 0; }
        .due-date { font-size: 20px; font-weight: 600; color: #b45309; margin-top: 15px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4); }
        .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        .paw-icon { font-size: 30px; opacity: 0.3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">💉🐕</div>
            <h1 class="header-title">תזכורת חיסון</h1>
        </div>
        
        <div class="content">
            <div class="greeting">שלום,</div>
            
            <div class="message">
                זוהי תזכורת ידידותית שחיסון ${vaccineName} של ${petName} מתקרב!
            </div>

            <div class="reminder-box">
                <div class="pet-name">🐾 ${petName}</div>
                <div class="vaccine-info">חיסון: ${vaccineName}</div>
                <div class="due-date">בעוד ${daysUntil} ימים</div>
                <div class="vaccine-info" style="margin-top: 15px; font-size: 16px;">
                    תאריך: ${dueDate.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div style="text-align: center;">
                <a href="${managePetsUrl}" class="cta-button">
                    נהל/י את פרטי הכלב
                </a>
            </div>

            <div class="message" style="margin-top: 30px; text-align: center;">
                <div class="paw-icon">🐾 🐾 🐾</div>
                <p>אנא וודא/י לתאם תור עם הווטרינר שלך.</p>
                <p>תודה שאת/ה שומר/ת על בריאות חיית המחמד שלך! ❤️</p>
            </div>
        </div>

        <div class="footer">
            <p>Pet Wash™ | שירותי רחיצה פרימיום אורגניים</p>
            <p>Support@PetWash.co.il | www.petwash.co.il</p>
        </div>
    </div>
</body>
</html>`;

        // Fallback English template
        englishTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vaccine Reminder - Pet Wash™</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f4f8; padding: 0; margin: 0; }
        .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center; color: white; }
        .header-icon { font-size: 60px; margin-bottom: 15px; }
        .header-title { font-size: 28px; font-weight: 700; margin: 0; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 22px; color: #1f2937; margin-bottom: 20px; font-weight: 600; }
        .message { color: #4b5563; font-size: 16px; line-height: 1.8; margin-bottom: 25px; }
        .reminder-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 15px; padding: 25px; margin: 30px 0; text-align: center; }
        .pet-name { font-size: 24px; font-weight: 700; color: #92400e; margin-bottom: 10px; }
        .vaccine-info { font-size: 18px; color: #78350f; margin: 10px 0; }
        .due-date { font-size: 20px; font-weight: 600; color: #b45309; margin-top: 15px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4); }
        .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        .paw-icon { font-size: 30px; opacity: 0.3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">💉🐕</div>
            <h1 class="header-title">Vaccine Reminder</h1>
        </div>
        
        <div class="content">
            <div class="greeting">Hello,</div>
            
            <div class="message">
                This is a friendly reminder that ${petName}'s ${vaccineName} vaccine is coming up!
            </div>

            <div class="reminder-box">
                <div class="pet-name">🐾 ${petName}</div>
                <div class="vaccine-info">Vaccine: ${vaccineName}</div>
                <div class="due-date">in ${daysUntil} days</div>
                <div class="vaccine-info" style="margin-top: 15px; font-size: 16px;">
                    Date: ${dueDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div style="text-align: center;">
                <a href="${managePetsUrl}" class="cta-button">
                    Manage Pet Details
                </a>
            </div>

            <div class="message" style="margin-top: 30px; text-align: center;">
                <div class="paw-icon">🐾 🐾 🐾</div>
                <p>Please make sure to schedule an appointment with your vet.</p>
                <p>Thank you for keeping your pet healthy! ❤️</p>
            </div>
        </div>

        <div class="footer">
            <p>Pet Wash™ | Premium Organic Pet Wash Services</p>
            <p>Support@PetWash.co.il | www.petwash.co.il</p>
        </div>
    </div>
</body>
</html>`;
      }

      const htmlContent = locale === 'he' ? hebrewTemplate : englishTemplate;
      
      // Format subject line based on single vs multi-pet
      let subject: string;
      if (allPets && allPets.length > 1) {
        // Multi-pet consolidated format
        const additionalCount = allPets.length - 1;
        subject = locale === 'he'
          ? `תזכורות חיסון – ${petName} (+${additionalCount} נוספים) בעוד ${daysUntil} ימים`
          : `Vaccine reminders – ${petName} (+${additionalCount} more) in ${daysUntil} days`;
      } else {
        // Single pet format
        subject = locale === 'he' 
          ? `תזכורת חיסון ל־${petName} – ${vaccineName} מתקרב`
          : `Vaccine reminder for ${petName} – ${vaccineName} is coming up`;
      }
      
      // Generate unsubscribe token
      const unsubscribeToken = this.generateUnsubscribeToken(to);
      const unsubscribeUrl = `${this.UNSUBSCRIBE_URL}?token=${unsubscribeToken}`;
      
      const msg = {
        to,
        from: this.FROM_EMAIL,
        subject,
        html: this.sanitizeEmailContent(htmlContent),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      };
      
      await mailService.send(msg);
      
      // Log GA4 event data (client-side tracking will handle actual GA4)
      // Server-side GA4 tracking requires Measurement Protocol setup
      logger.info(`📊 GA4 Event: email_vaccine_reminder_sent`, {
        petId: petId || 'unknown',
        petName,
        vaccineName,
        locale,
        daysUntil,
        to // For debugging only, not sent to GA4
      });
      
      logger.info(`Vaccine reminder email sent to ${to} - Pet: ${petName}, Vaccine: ${vaccineName}`);
      return true;
      
    } catch (error) {
      logger.error('Failed to send vaccine reminder email', error);
      return false;
    }
  }

  /**
   * Send welcome email to new users
   */
  static async sendWelcomeEmail(
    email: string,
    firstName: string = '',
    language: 'he' | 'en' = 'he'
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.info('SendGrid not configured - would send welcome email to:', email);
      return true; // Return true for development
    }

    try {
      // Check consent
      const hasConsent = await this.checkEmailConsent(email, 'transactional');
      if (!hasConsent) {
        logger.info(`Email consent check failed for welcome: ${email}`);
        return false;
      }

      // Rate limiting
      if (!this.checkRateLimit(email)) {
        logger.info(`Rate limit exceeded for welcome: ${email}`);
        return false;
      }

      const { db } = await import('./lib/firebase-admin');
      
      // Try to fetch template from Firestore
      let hebrewTemplate: string = '';
      let englishTemplate: string = '';
      let subject: string = '';
      let usedFallback = false;
      
      try {
        // Try to load the enhanced v2 template first
        const templateDoc = await db.collection('crm_email_templates').doc('welcome_v2').get();
        
        if (templateDoc.exists) {
          const templateData = templateDoc.data();
          hebrewTemplate = templateData?.hebrewTemplate;
          englishTemplate = templateData?.englishTemplate;
          const subjectData = templateData?.subject || {};
          subject = language === 'he' ? subjectData.he : subjectData.en;
          logger.info('Loaded welcome template from Firestore: welcome_v2');
        } else {
          throw new Error('Template not found in Firestore');
        }
      } catch (templateError) {
        logger.warn('️ Could not load template from Firestore, using fallback:', templateError);
        usedFallback = true;
        
        // Fallback to enhanced branded template with hero image
        hebrewTemplate = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ברוכים הבאים ל-Pet Wash™</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; overflow: hidden; }
        .hero { width: 100%; height: 250px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; }
        .hero-logo { font-size: 48px; font-weight: 700; margin-bottom: 10px; }
        .hero-subtitle { font-size: 18px; opacity: 0.95; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 28px; color: #667eea; margin-bottom: 20px; font-weight: 600; text-align: center; }
        .message { color: #4a5568; font-size: 18px; line-height: 1.8; margin-bottom: 30px; text-align: center; }
        .cta-container { margin: 40px 0; text-align: center; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 36px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 8px; transition: transform 0.3s, box-shadow 0.3s; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4); }
        .features { background: #f7fafc; padding: 30px; border-radius: 15px; margin: 30px 0; }
        .feature-item { margin: 20px 0; padding: 15px; border-right: 4px solid #667eea; background: white; border-radius: 8px; }
        .feature-title { font-size: 20px; font-weight: 600; color: #2d3748; margin-bottom: 8px; }
        .feature-desc { color: #718096; font-size: 15px; }
        .paw-prints { text-align: center; font-size: 32px; margin: 30px 0; opacity: 0.3; }
        .footer { background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); color: white; padding: 40px 30px; text-align: center; }
        .footer-brand { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
        .footer-info { font-size: 14px; opacity: 0.9; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <div class="hero-logo">🐾 Pet Wash™</div>
            <div class="hero-subtitle">שירותי רחיצה פרימיום אורגניים</div>
        </div>
        
        <div class="content">
            <div class="greeting">
                ${firstName ? `ברוכים הבאים ${firstName}!` : 'ברוכים הבאים!'}
            </div>
            
            <div class="message">
                <strong>תודה רבה שהצטרפת למשפחת Pet Wash™!</strong><br><br>
                אנחנו נרגשים שבחרת בנו לטפל בחיית המחמד האהובה עליך. 
                Pet Wash™ מציעה את השירות המתקדם והאיכותי ביותר עם מוצרים אורגניים פרימיום.
            </div>

            <div class="features">
                <div class="feature-item">
                    <div class="feature-title">✨ מוצרים אורגניים פרימיום</div>
                    <div class="feature-desc">מוצרי טיפוח איכותיים וידידותיים לעור רגיש</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">🎁 תוכנית נאמנות 5 דרגות</div>
                    <div class="feature-desc">NEW → SILVER → GOLD → PLATINUM → DIAMOND עם הנחות עד 25%</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">📱 ניהול דיגיטלי מלא</div>
                    <div class="feature-desc">נהל הכל מהנייד - פרופיל, היסטוריה, קופונים ועוד</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">🤖 עוזר AI חכם</div>
                    <div class="feature-desc">תמיכה 24/7 בעברית ואנגלית</div>
                </div>
            </div>

            <div class="cta-container">
                <a href="https://petwash.co.il/dashboard" class="cta-button">
                    📝 השלם את הפרופיל
                </a>
                <a href="https://petwash.co.il/packages" class="cta-button">
                    🐕 הזמן רחיצה עכשיו
                </a>
                <a href="https://wa.me/972549833355" class="cta-button">
                    💬 הצטרף לוואטסאפ
                </a>
            </div>

            <div class="message" style="margin-top: 50px;">
                <div class="paw-prints">🐾 🐾 🐾</div>
                <p><strong>יש לך שאלות?</strong></p>
                <p>אנחנו כאן בשבילך 24/7!</p>
            </div>
        </div>

        <div class="footer">
            <div class="footer-brand">🐾 Pet Wash™</div>
            <div class="footer-info">שירותי רחיצה פרימיום אורגניים לחיות מחמד</div>
            <div class="footer-info">Support@PetWash.co.il | www.petwash.co.il</div>
            <div class="footer-info">📞 054-983-3355 | WhatsApp זמין 24/7</div>
        </div>
    </div>
</body>
</html>`;

      const englishTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Pet Wash™</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 0; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; overflow: hidden; }
        .hero { width: 100%; height: 250px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; color: white; }
        .hero-logo { font-size: 48px; font-weight: 700; margin-bottom: 10px; }
        .hero-subtitle { font-size: 18px; opacity: 0.95; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 28px; color: #667eea; margin-bottom: 20px; font-weight: 600; text-align: center; }
        .message { color: #4a5568; font-size: 18px; line-height: 1.8; margin-bottom: 30px; text-align: center; }
        .cta-container { margin: 40px 0; text-align: center; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 36px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 8px; transition: transform 0.3s, box-shadow 0.3s; }
        .cta-button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4); }
        .features { background: #f7fafc; padding: 30px; border-radius: 15px; margin: 30px 0; }
        .feature-item { margin: 20px 0; padding: 15px; border-left: 4px solid #667eea; background: white; border-radius: 8px; }
        .feature-title { font-size: 20px; font-weight: 600; color: #2d3748; margin-bottom: 8px; }
        .feature-desc { color: #718096; font-size: 15px; }
        .paw-prints { text-align: center; font-size: 32px; margin: 30px 0; opacity: 0.3; }
        .footer { background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); color: white; padding: 40px 30px; text-align: center; }
        .footer-brand { font-size: 24px; font-weight: 700; margin-bottom: 10px; }
        .footer-info { font-size: 14px; opacity: 0.9; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <div class="hero-logo">🐾 Pet Wash™</div>
            <div class="hero-subtitle">Premium Organic Pet Wash Services</div>
        </div>
        
        <div class="content">
            <div class="greeting">
                ${firstName ? `Welcome ${firstName}!` : 'Welcome!'}
            </div>
            
            <div class="message">
                <strong>Thank you for joining the Pet Wash™ family!</strong><br><br>
                We're thrilled you chose us to care for your beloved pet. 
                Pet Wash™ offers the most advanced and quality service with premium organic products.
            </div>

            <div class="features">
                <div class="feature-item">
                    <div class="feature-title">✨ Premium Organic Products</div>
                    <div class="feature-desc">Quality grooming products gentle on sensitive skin</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">🎁 4-Tier Loyalty Program</div>
                    <div class="feature-desc">NEW → SILVER → GOLD → PLATINUM → DIAMOND with up to 25% discounts</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">📱 Full Digital Management</div>
                    <div class="feature-desc">Manage everything from your phone - profile, history, coupons & more</div>
                </div>
                <div class="feature-item">
                    <div class="feature-title">🤖 Smart AI Assistant</div>
                    <div class="feature-desc">24/7 support in Hebrew and English</div>
                </div>
            </div>

            <div class="cta-container">
                <a href="https://petwash.co.il/dashboard" class="cta-button">
                    📝 Complete Profile
                </a>
                <a href="https://petwash.co.il/packages" class="cta-button">
                    🐕 Book a Wash Now
                </a>
                <a href="https://wa.me/972549833355" class="cta-button">
                    💬 Join WhatsApp
                </a>
            </div>

            <div class="message" style="margin-top: 50px;">
                <div class="paw-prints">🐾 🐾 🐾</div>
                <p><strong>Have questions?</strong></p>
                <p>We're here for you 24/7!</p>
            </div>
        </div>

        <div class="footer">
            <div class="footer-brand">🐾 Pet Wash™</div>
            <div class="footer-info">Premium Organic Pet Wash Services</div>
            <div class="footer-info">Support@PetWash.co.il | www.petwash.co.il</div>
            <div class="footer-info">📞 +972-54-983-3355 | WhatsApp Available 24/7</div>
        </div>
    </div>
</body>
</html>`;
      }

      const htmlContent = language === 'he' ? hebrewTemplate : englishTemplate;
      
      // Use loaded subject or fallback
      if (!subject) {
        subject = language === 'he' 
          ? `🐾 ברוכים הבאים ל-Pet Wash™ - המסע שלך מתחיל כאן!`
          : `🐾 Welcome to Pet Wash™ - Your Journey Starts Here!`;
      }
      
      // Interpolate firstName in template
      const personalizedHtml = htmlContent.replace(/\$\{firstName\}/g, firstName || '');
      
      // Generate unsubscribe token
      const unsubscribeToken = this.generateUnsubscribeToken(email);
      const unsubscribeUrl = `${this.UNSUBSCRIBE_URL}?token=${unsubscribeToken}`;
      
      const msg = {
        to: email,
        from: this.FROM_EMAIL,
        subject,
        html: this.sanitizeEmailContent(personalizedHtml),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      };
      
      await mailService.send(msg);
      
      // Store template in Firestore for future reference (if we used fallback)
      if (usedFallback) {
        try {
          await db
            .collection('crm_email_templates')
            .doc('welcome_v2')
            .set({
              name: 'Welcome Email v2 - Enhanced with Hero',
              type: 'welcome',
              version: 2,
              hebrewTemplate,
              englishTemplate,
              subject: { 
                he: `🐾 ברוכים הבאים ל-Pet Wash™ - המסע שלך מתחיל כאן!`,
                en: `🐾 Welcome to Pet Wash™ - Your Journey Starts Here!`
              },
              description: 'Enhanced welcome email with hero section, 5-tier loyalty program info, AI assistant mention, and branded footer',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          logger.info('Welcome template saved to Firestore: welcome_v2');
        } catch (saveError) {
          logger.warn('️ Could not save template to Firestore:', saveError);
        }
      }
      
      // TODO: Log to CRM communication logs (schema mismatch - needs communication ID)
      // await storage.createCommunicationLog({
      //   communicationId: ..., // Need to create communication first
      //   deliveryStatus: 'sent',
      //   externalMessageId: nanoid()
      // });
      
      logger.info(`Welcome email sent to ${email}`);
      return true;
      
    } catch (error) {
      logger.error('Failed to send welcome email', error);
      return false;
    }
  }

  /**
   * Send voucher purchase receipt email (bilingual)
   */
  static async sendVoucherPurchaseEmail(
    email: string,
    voucherCode: string,
    codeLast4: string,
    amount: string,
    currency: string,
    expiresAt: Date | null,
    language: 'he' | 'en' = 'he'
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.warn('SendGrid API key not configured - skipping voucher purchase email');
      return false;
    }

    try {
      const isHebrew = language === 'he';
      const subject = isHebrew 
        ? `🎁 שובר המתנה שלך ל-Pet Wash™ - ${codeLast4} (₪${amount})`
        : `🎁 Your Pet Wash™ Gift Voucher - ${codeLast4} (${currency} ${amount})`;

      const expiryText = expiresAt 
        ? (isHebrew 
          ? `תוקף השובר: ${new Date(expiresAt).toLocaleDateString('he-IL')}`
          : `Valid until: ${new Date(expiresAt).toLocaleDateString('en-US')}`)
        : (isHebrew ? 'אין תאריך תפוגה' : 'No expiration date');

      const htmlContent = isHebrew ? `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
    
    <!-- Hero Section -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px 40px; text-align: center;">
      <div style="background: white; width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px;">
        🎁
      </div>
      <h1 style="color: white; margin: 0 0 10px 0; font-size: 32px; font-weight: 700;">שובר המתנה שלך מוכן!</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px;">Pet Wash™ - טיפול אורגני פרימיום לחיות מחמד</p>
    </div>

    <!-- Voucher Code Section -->
    <div style="padding: 40px; text-align: center;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; margin-bottom: 30px;">
        <p style="margin: 0 0 15px 0; font-size: 16px; opacity: 0.9;">קוד השובר שלך</p>
        <div style="font-size: 36px; font-weight: 700; letter-spacing: 3px; font-family: 'Courier New', monospace; direction: ltr;">
          ${voucherCode}
        </div>
        <p style="margin: 15px 0 0 0; font-size: 14px; opacity: 0.9;">ערך: ₪${amount}</p>
      </div>

      <div style="background: #f7f9fc; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; color: #667eea; font-size: 20px;">📋 פרטי השובר</h3>
        <div style="text-align: right;">
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>סכום:</strong> ₪${amount}</p>
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>${expiryText}</strong></p>
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>מטבע:</strong> ${currency}</p>
        </div>
      </div>

      <div style="background: #fff3cd; border-right: 4px solid #ffc107; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: right;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          💡 <strong>חשוב:</strong> שמרו על קוד זה במקום מאובטח. תצטרכו אותו כדי לממש את השובר.
        </p>
      </div>

      <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 22px;">כיצד להשתמש בשובר?</h3>
      <div style="text-align: right;">
        <div style="margin-bottom: 20px; padding: 15px; background: #f7f9fc; border-radius: 10px;">
          <div style="color: #667eea; font-size: 24px; font-weight: 700; margin-bottom: 8px;">1️⃣</div>
          <p style="margin: 0; color: #333; font-size: 15px;">היכנסו לחשבון שלכם באתר Pet Wash™</p>
        </div>
        <div style="margin-bottom: 20px; padding: 15px; background: #f7f9fc; border-radius: 10px;">
          <div style="color: #667eea; font-size: 24px; font-weight: 700; margin-bottom: 8px;">2️⃣</div>
          <p style="margin: 0; color: #333; font-size: 15px;">עברו לעמוד "מימוש שובר" והזינו את הקוד</p>
        </div>
        <div style="margin-bottom: 20px; padding: 15px; background: #f7f9fc; border-radius: 10px;">
          <div style="color: #667eea; font-size: 24px; font-weight: 700; margin-bottom: 8px;">3️⃣</div>
          <p style="margin: 0; color: #333; font-size: 15px;">השובר יתווסף לארנק הדיגיטלי שלכם</p>
        </div>
      </div>

      <a href="https://petwash.co.il/claim" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin-top: 10px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
        🎁 מימוש שובר עכשיו
      </a>
    </div>

    <!-- Footer -->
    <div style="background: #f7f9fc; padding: 30px; text-align: center; border-top: 1px solid #e1e8ed;">
      <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">
        צריכים עזרה? צוות התמיכה שלנו כאן בשבילכם 24/7
      </p>
      <p style="margin: 0; color: #666; font-size: 14px;">
        📧 <a href="mailto:Support@PetWash.co.il" style="color: #667eea; text-decoration: none;">Support@PetWash.co.il</a> | 
        📱 <a href="tel:+972549833355" style="color: #667eea; text-decoration: none;">+972-54-983-3355</a>
      </p>
      <p style="margin: 15px 0 0 0; color: #999; font-size: 12px;">
        © ${new Date().getFullYear()} Pet Wash™ - All Rights Reserved
      </p>
    </div>
  </div>
</body>
</html>
      ` : `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
    
    <!-- Hero Section -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px 40px; text-align: center;">
      <div style="background: white; width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px;">
        🎁
      </div>
      <h1 style="color: white; margin: 0 0 10px 0; font-size: 32px; font-weight: 700;">Your Gift Voucher is Ready!</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px;">Pet Wash™ - Premium Organic Pet Care</p>
    </div>

    <!-- Voucher Code Section -->
    <div style="padding: 40px; text-align: center;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; margin-bottom: 30px;">
        <p style="margin: 0 0 15px 0; font-size: 16px; opacity: 0.9;">Your Voucher Code</p>
        <div style="font-size: 36px; font-weight: 700; letter-spacing: 3px; font-family: 'Courier New', monospace;">
          ${voucherCode}
        </div>
        <p style="margin: 15px 0 0 0; font-size: 14px; opacity: 0.9;">Value: ${currency} ${amount}</p>
      </div>

      <div style="background: #f7f9fc; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; color: #667eea; font-size: 20px;">📋 Voucher Details</h3>
        <div style="text-align: left;">
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>Amount:</strong> ${currency} ${amount}</p>
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>${expiryText}</strong></p>
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>Currency:</strong> ${currency}</p>
        </div>
      </div>

      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: left;">
        <p style="margin: 0; color: #856404; font-size: 14px;">
          💡 <strong>Important:</strong> Keep this code safe. You'll need it to claim your voucher.
        </p>
      </div>

      <h3 style="color: #667eea; margin: 0 0 20px 0; font-size: 22px;">How to Use Your Voucher?</h3>
      <div style="text-align: left;">
        <div style="margin-bottom: 20px; padding: 15px; background: #f7f9fc; border-radius: 10px;">
          <div style="color: #667eea; font-size: 24px; font-weight: 700; margin-bottom: 8px;">1️⃣</div>
          <p style="margin: 0; color: #333; font-size: 15px;">Log in to your Pet Wash™ account</p>
        </div>
        <div style="margin-bottom: 20px; padding: 15px; background: #f7f9fc; border-radius: 10px;">
          <div style="color: #667eea; font-size: 24px; font-weight: 700; margin-bottom: 8px;">2️⃣</div>
          <p style="margin: 0; color: #333; font-size: 15px;">Go to "Claim Voucher" page and enter your code</p>
        </div>
        <div style="margin-bottom: 20px; padding: 15px; background: #f7f9fc; border-radius: 10px;">
          <div style="color: #667eea; font-size: 24px; font-weight: 700; margin-bottom: 8px;">3️⃣</div>
          <p style="margin: 0; color: #333; font-size: 15px;">The voucher will be added to your digital wallet</p>
        </div>
      </div>

      <a href="https://petwash.co.il/claim" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin-top: 10px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
        🎁 Claim Voucher Now
      </a>
    </div>

    <!-- Footer -->
    <div style="background: #f7f9fc; padding: 30px; text-align: center; border-top: 1px solid #e1e8ed;">
      <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">
        Need help? Our support team is here for you 24/7
      </p>
      <p style="margin: 0; color: #666; font-size: 14px;">
        📧 <a href="mailto:Support@PetWash.co.il" style="color: #667eea; text-decoration: none;">Support@PetWash.co.il</a> | 
        📱 <a href="tel:+972549833355" style="color: #667eea; text-decoration: none;">+972-54-983-3355</a>
      </p>
      <p style="margin: 15px 0 0 0; color: #999; font-size: 12px;">
        © ${new Date().getFullYear()} Pet Wash™ - All Rights Reserved
      </p>
    </div>
  </div>
</body>
</html>
      `;

      await mailService.send({
        to: email,
        from: { email: this.FROM_EMAIL, name: 'Pet Wash™' },
        subject,
        html: htmlContent
      });

      logger.info(`Voucher purchase email sent to ${email} (${language})`);
      return true;
    } catch (error) {
      logger.error('Failed to send voucher purchase email', error);
      return false;
    }
  }

  /**
   * Send voucher claim confirmation email (bilingual)
   */
  static async sendVoucherClaimEmail(
    email: string,
    codeLast4: string,
    amount: string,
    currency: string,
    language: 'he' | 'en' = 'he'
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.warn('SendGrid API key not configured - skipping voucher claim email');
      return false;
    }

    try {
      const isHebrew = language === 'he';
      const subject = isHebrew 
        ? `✅ שובר המתנה שלך נקלט בהצלחה - ${codeLast4}`
        : `✅ Your Gift Voucher Has Been Claimed - ${codeLast4}`;

      const htmlContent = isHebrew ? `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
    
    <!-- Hero Section -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 60px 40px; text-align: center;">
      <div style="background: white; width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px;">
        ✅
      </div>
      <h1 style="color: white; margin: 0 0 10px 0; font-size: 32px; font-weight: 700;">השובר נקלט בהצלחה!</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px;">השובר הוסף לארנק הדיגיטלי שלך</p>
    </div>

    <!-- Content Section -->
    <div style="padding: 40px; text-align: center;">
      <div style="background: #f7f9fc; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; color: #10b981; font-size: 20px;">פרטי השובר</h3>
        <div style="text-align: right;">
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>קוד (4 ספרות אחרונות):</strong> ****${codeLast4}</p>
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>יתרה:</strong> ₪${amount}</p>
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>מטבע:</strong> ${currency}</p>
        </div>
      </div>

      <div style="background: #d1fae5; border-right: 4px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: right;">
        <p style="margin: 0; color: #065f46; font-size: 14px;">
          💚 השובר כעת בארנק הדיגיטלי שלך ומוכן לשימוש בכל עת!
        </p>
      </div>

      <a href="https://petwash.co.il/dashboard" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin-top: 10px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
        📱 צפייה בארנק שלי
      </a>
    </div>

    <!-- Footer -->
    <div style="background: #f7f9fc; padding: 30px; text-align: center; border-top: 1px solid #e1e8ed;">
      <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">
        שאלות? אנחנו כאן בשבילך 24/7
      </p>
      <p style="margin: 0; color: #666; font-size: 14px;">
        📧 <a href="mailto:Support@PetWash.co.il" style="color: #10b981; text-decoration: none;">Support@PetWash.co.il</a> | 
        📱 <a href="tel:+972549833355" style="color: #10b981; text-decoration: none;">+972-54-983-3355</a>
      </p>
      <p style="margin: 15px 0 0 0; color: #999; font-size: 12px;">
        © ${new Date().getFullYear()} Pet Wash™
      </p>
    </div>
  </div>
</body>
</html>
      ` : `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
    
    <!-- Hero Section -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 60px 40px; text-align: center;">
      <div style="background: white; width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px;">
        ✅
      </div>
      <h1 style="color: white; margin: 0 0 10px 0; font-size: 32px; font-weight: 700;">Voucher Claimed Successfully!</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px;">Your voucher has been added to your digital wallet</p>
    </div>

    <!-- Content Section -->
    <div style="padding: 40px; text-align: center;">
      <div style="background: #f7f9fc; padding: 25px; border-radius: 12px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; color: #10b981; font-size: 20px;">Voucher Details</h3>
        <div style="text-align: left;">
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>Code (Last 4 digits):</strong> ****${codeLast4}</p>
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>Balance:</strong> ${currency} ${amount}</p>
          <p style="margin: 8px 0; color: #333; font-size: 15px;"><strong>Currency:</strong> ${currency}</p>
        </div>
      </div>

      <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: left;">
        <p style="margin: 0; color: #065f46; font-size: 14px;">
          💚 Your voucher is now in your digital wallet and ready to use anytime!
        </p>
      </div>

      <a href="https://petwash.co.il/dashboard" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin-top: 10px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
        📱 View My Wallet
      </a>
    </div>

    <!-- Footer -->
    <div style="background: #f7f9fc; padding: 30px; text-align: center; border-top: 1px solid #e1e8ed;">
      <p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">
        Questions? We're here for you 24/7
      </p>
      <p style="margin: 0; color: #666; font-size: 14px;">
        📧 <a href="mailto:Support@PetWash.co.il" style="color: #10b981; text-decoration: none;">Support@PetWash.co.il</a> | 
        📱 <a href="tel:+972549833355" style="color: #10b981; text-decoration: none;">+972-54-983-3355</a>
      </p>
      <p style="margin: 15px 0 0 0; color: #999; font-size: 12px;">
        © ${new Date().getFullYear()} Pet Wash™
      </p>
    </div>
  </div>
</body>
</html>
      `;

      await mailService.send({
        to: email,
        from: { email: this.FROM_EMAIL, name: 'Pet Wash™' },
        subject,
        html: htmlContent
      });

      logger.info(`Voucher claim confirmation sent to ${email} (${language})`);
      return true;
    } catch (error) {
      logger.error('Failed to send voucher claim email', error);
      return false;
    }
  }

  /**
   * Send legal compliance review reminder to admin/legal team
   * @param params Document type, review dates, and admin contact
   * @returns Promise<boolean> success status
   */
  static async sendLegalComplianceReminder(params: {
    documentType: string;
    nextReviewDue: Date;
    daysUntilDue: number;
    lastReviewDate: Date;
    adminEmail: string;
  }): Promise<boolean> {
    try {
      const { documentType, nextReviewDue, daysUntilDue, lastReviewDate, adminEmail } = params;

      const docTypeDisplay = documentType === 'terms_conditions' ? 'Terms & Conditions' : 'Privacy Policy';
      const docTypeDisplayHe = documentType === 'terms_conditions' ? 'תנאים והגבלות' : 'מדיניות פרטיות';

      const urgencyLevel = daysUntilDue <= 30 ? '🚨 URGENT' : daysUntilDue <= 60 ? '⚠️ ATTENTION' : '📋 REMINDER';
      const urgencyColor = daysUntilDue <= 30 ? '#dc2626' : daysUntilDue <= 60 ? '#f59e0b' : '#3b82f6';

      const subject = `${urgencyLevel}: Israeli Law Compliance Review Due - ${docTypeDisplay} (${daysUntilDue} days)`;

      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6;">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
    
    <!-- Header -->
    <div style="background: ${urgencyColor}; padding: 30px 40px; text-align: center; color: white;">
      <div style="font-size: 48px; margin-bottom: 10px;">⚖️</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Legal Compliance Review Required</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Israeli Law Annual Review Reminder</p>
    </div>

    <!-- Content -->
    <div style="padding: 40px;">
      <div style="background: #fef3c7; border-left: 4px solid ${urgencyColor}; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <p style="margin: 0; color: #92400e; font-size: 15px; font-weight: 600;">
          ${urgencyLevel.replace(/🚨|⚠️|📋/g, '').trim()}: The ${docTypeDisplay} document is due for annual Israeli law compliance review in ${daysUntilDue} days.
        </p>
      </div>

      <div style="background: #f9fafb; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
        <h3 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">Review Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Document:</strong></td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px;">${docTypeDisplay} (${docTypeDisplayHe})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Last Review:</strong></td>
            <td style="padding: 8px 0; color: #111827; font-size: 14px;">${new Date(lastReviewDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Next Review Due:</strong></td>
            <td style="padding: 8px 0; color: #dc2626; font-size: 14px; font-weight: 600;">${new Date(nextReviewDue).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;"><strong>Days Remaining:</strong></td>
            <td style="padding: 8px 0; color: ${urgencyColor}; font-size: 14px; font-weight: 600;">${daysUntilDue} days</td>
          </tr>
        </table>
      </div>

      <div style="background: #e0f2fe; border-left: 4px solid #0284c7; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
        <h4 style="margin: 0 0 10px 0; color: #0c4a6e; font-size: 16px;">📚 Required Review Actions:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #075985; font-size: 14px; line-height: 1.8;">
          <li>Check for recent amendments to Israeli Consumer Protection Law (חוק הגנת הצרכן)</li>
          <li>Review Privacy Protection Law amendments (חוק הגנת הפרטיות - Amendment 13+)</li>
          <li>Verify VAT disclosure (18% as of January 1, 2025)</li>
          <li>Confirm 14-day distance selling cancellation rights</li>
          <li>Update e-voucher validity period if regulations changed</li>
          <li>Review governing law and jurisdiction clauses</li>
          <li>Update "Last Updated" timestamp after review</li>
        </ul>
      </div>

      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
        <h4 style="margin: 0 0 10px 0; color: #991b1b; font-size: 16px;">⚠️ Compliance Risk:</h4>
        <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
          Failure to maintain up-to-date legal documents may expose Pet Wash Ltd to regulatory penalties, 
          consumer lawsuits, and non-compliance fines. Israeli law requires businesses to update Terms & Privacy 
          policies when legal changes occur.
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://petwash.co.il/admin/legal/compliance" style="display: inline-block; background: ${urgencyColor}; color: white; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
          🔍 Review Compliance Status
        </a>
      </div>

      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 30px;">
        <h4 style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">📎 Useful Resources:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 13px; line-height: 1.8;">
          <li><a href="https://www.gov.il/he/departments/consumer_protection_authority" style="color: #2563eb;">Israel Consumer Protection Authority</a></li>
          <li><a href="https://www.gov.il/he/departments/units/privacy_protection_authority" style="color: #2563eb;">Israel Privacy Protection Authority</a></li>
          <li><a href="https://www.nevo.co.il/law_word/law01/081_001.doc" style="color: #2563eb;">Consumer Protection Law (Hebrew)</a></li>
        </ul>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #111827; padding: 30px; text-align: center; color: white;">
      <p style="margin: 0 0 10px 0; font-size: 14px; opacity: 0.9;">
        Pet Wash™ Legal Compliance System
      </p>
      <p style="margin: 0; font-size: 12px; opacity: 0.7;">
        This is an automated reminder from your legal compliance monitoring system.
      </p>
      <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.7;">
        © ${new Date().getFullYear()} Pet Wash Ltd | Company Number: 517145033
      </p>
    </div>
  </div>
</body>
</html>
      `;

      await mailService.send({
        to: adminEmail,
        from: { email: this.FROM_EMAIL, name: 'Pet Wash™ Legal Compliance' },
        subject,
        html: htmlContent
      });

      logger.info(`Legal compliance reminder sent to ${adminEmail} for ${documentType}`);
      return true;
    } catch (error) {
      logger.error('Failed to send legal compliance reminder', error);
      return false;
    }
  }
}
