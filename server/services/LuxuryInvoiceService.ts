/**
 * Luxury Invoice Service for ⁦Pet Wash™⁩
 * Israeli Law Compliant Invoice/Receipt/Statement Generation
 * Full Hebrew RTL Support with מע"מ and Commission Tracking
 */

import { logger } from '../lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CompanyDetails {
  nameHe: string;
  nameEn: string;
  address: string;
  city: string;
  postalCode: string;
  taxId: string; // ח.פ.
  vatNumber: string; // מספר עוסק מורשה
  phone: string;
  email: string;
}

interface LineItem {
  description: string;
  descriptionHe?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  commission?: number; // עמלה
  operationCode?: string; // קוד פעולה
}

interface CreditBreakdown {
  egiftCents: number;
  washPackages: number;
  loyaltyPointsCents: number;
  promoCents: number;
  referralCents: number;
  totalCreditsAppliedCents: number;
  cashPaidCents: number;
  redemptionSessionId?: string;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  customerName: string;
  customerTaxId?: string;
  customerAddress?: string;
  lineItems: LineItem[];
  notes?: string;
  notesHe?: string;
  paymentMethod?: string;
  transactionId?: string;
  creditBreakdown?: CreditBreakdown;
  bookingId?: string;
  platform?: 'walker' | 'sitter' | 'pettrek' | 'k9000' | 'plush_lab';
}

const COMPANY_DETAILS: CompanyDetails = {
  nameHe: 'פט וואש בע״מ',
  nameEn: 'Pet Wash Ltd.',
  address: 'עוזי חיטמן 8',
  city: 'ראש העין',
  postalCode: '4806859',
  taxId: '517145033', // ח.פ.
  vatNumber: '517145033', // מספר עוסק מורשה
  phone: '+972-50-123-4567',
  email: 'noreply@petwash.co.il'
};

const VAT_RATE = 0.18; // 18% מע"מ ישראלי

class LuxuryInvoiceService {
  private logoBase64Cache: string | null = null;
  private lastLogoLoadTime: number = 0;
  private readonly LOGO_CACHE_TTL = 60000; // Cache for 60 seconds only

  /**
   * Get logo as base64 data URI for email embedding
   * Ensures logo displays across ALL email clients (iOS Mail, Android Gmail, Outlook, etc.)
   */
  private getLogoBase64(): string {
    // Refresh cache if expired (allows logo updates without restart)
    const now = Date.now();
    if (this.logoBase64Cache && (now - this.lastLogoLoadTime < this.LOGO_CACHE_TTL)) {
      return this.logoBase64Cache;
    }

    try {
      // Try multiple potential logo paths
      const logoPaths = [
        path.join(process.cwd(), 'dist/public/brand/petwash-logo-official.png'),
        path.join(__dirname, '../public/brand/petwash-logo-official.png'),
        path.join(__dirname, '../../public/brand/petwash-logo-official.png'),
        path.join(__dirname, '../../client/public/brand/petwash-logo-official.png'),
        path.join(process.cwd(), 'public/brand/petwash-logo-official.png')
      ];

      let logoBuffer: Buffer | null = null;
      for (const logoPath of logoPaths) {
        if (fs.existsSync(logoPath)) {
          logoBuffer = fs.readFileSync(logoPath);
          logger.info(`[LuxuryInvoice] Logo loaded from: ${logoPath}`);
          break;
        }
      }

      if (!logoBuffer) {
        logger.warn('[LuxuryInvoice] Logo file not found at any path, using fallback');
        // Return empty placeholder if logo not found
        return 'data:image/png;base64,';
      }

      this.logoBase64Cache = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      this.lastLogoLoadTime = Date.now();
      logger.info(`[LuxuryInvoice] Logo cached successfully (${logoBuffer.length} bytes)`);
      return this.logoBase64Cache;
    } catch (error) {
      logger.error('[LuxuryInvoice] Failed to load logo', error);
      return 'data:image/png;base64,';
    }
  }

  private calculateTotals(lineItems: LineItem[]) {
    let subtotal = 0;
    let totalVat = 0;
    let totalCommission = 0;

    lineItems.forEach(item => {
      const itemTotal = item.quantity * item.unitPrice;
      const itemVat = itemTotal * (item.vatRate || VAT_RATE);
      const itemCommission = item.commission || 0;

      subtotal += itemTotal;
      totalVat += itemVat;
      totalCommission += itemCommission;
    });

    const total = subtotal + totalVat;
    const netAmount = total - totalCommission;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      totalVat: Number(totalVat.toFixed(2)),
      totalCommission: Number(totalCommission.toFixed(2)),
      total: Number(total.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2))
    };
  }

  /**
   * Generate Luxury Invoice (חשבונית מס)
   */
  generateInvoice(data: InvoiceData): string {
    const totals = this.calculateTotals(data.lineItems);

    return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>חשבונית מס - ${data.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Assistant', 'Segoe UI', Tahoma, sans-serif;
      direction: rtl;
      text-align: right;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 40px 20px;
    }
    
    .invoice-container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      position: relative;
    }
    
    .logo {
      width: 180px;
      height: auto;
      margin-bottom: 20px;
      filter: brightness(0) invert(1);
    }
    
    .header-title {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    
    .header-subtitle {
      font-size: 18px;
      opacity: 0.9;
    }
    
    .company-details {
      background: #f8f9fa;
      padding: 30px 40px;
      border-bottom: 3px solid #667eea;
    }
    
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #2d3748;
      margin-bottom: 15px;
    }
    
    .company-info {
      color: #4a5568;
      line-height: 1.8;
      font-size: 14px;
    }
    
    .invoice-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      padding: 30px 40px;
      background: white;
    }
    
    .info-section h3 {
      color: #667eea;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 14px;
    }
    
    .info-label {
      color: #718096;
      font-weight: 600;
    }
    
    .info-value {
      color: #2d3748;
      font-weight: 400;
    }
    
    .line-items {
      padding: 0 40px 30px;
    }
    
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      border-radius: 10px;
      overflow: hidden;
    }
    
    .items-table thead {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .items-table th {
      padding: 15px;
      font-weight: 600;
      text-align: right;
      font-size: 14px;
    }
    
    .items-table tbody tr {
      border-bottom: 1px solid #e2e8f0;
      transition: background 0.2s;
    }
    
    .items-table tbody tr:hover {
      background: #f7fafc;
    }
    
    .items-table td {
      padding: 15px;
      text-align: right;
      color: #2d3748;
      font-size: 14px;
    }
    
    .operation-code {
      background: #edf2f7;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      color: #4a5568;
      display: inline-block;
      font-family: 'Courier New', monospace;
    }
    
    .totals-section {
      padding: 30px 40px;
      background: #f8f9fa;
    }
    
    .totals-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .total-label {
      color: #4a5568;
      font-weight: 600;
      font-size: 14px;
    }
    
    .total-value {
      color: #2d3748;
      font-weight: 700;
      font-size: 14px;
    }
    
    .grand-total {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
    }
    
    .grand-total-label {
      font-size: 20px;
      font-weight: 700;
    }
    
    .grand-total-value {
      font-size: 28px;
      font-weight: 700;
    }
    
    .footer {
      padding: 30px 40px;
      background: #2d3748;
      color: white;
      text-align: center;
    }
    
    .footer-note {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 15px;
    }
    
    .footer-legal {
      font-size: 12px;
      opacity: 0.7;
      line-height: 1.6;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .invoice-container {
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="header-title">חשבונית מס / כספית</div>
      <div class="header-subtitle">⁦Pet Wash™⁩ - Tax Invoice / Receipt</div>
    </div>
    
    <div class="company-details">
      <div class="company-name">${COMPANY_DETAILS.nameHe} | ${COMPANY_DETAILS.nameEn}</div>
      <div class="company-info">
        <div>📍 ${COMPANY_DETAILS.address}, ${COMPANY_DETAILS.city}, ${COMPANY_DETAILS.postalCode}</div>
        <div>ח.פ: ${COMPANY_DETAILS.taxId} | עוסק מורשה: ${COMPANY_DETAILS.vatNumber}</div>
        <div>📞 ${COMPANY_DETAILS.phone} | ✉️ ${COMPANY_DETAILS.email}</div>
      </div>
    </div>
    
    <div class="invoice-info">
      <div class="info-section">
        <h3>פרטי חשבונית</h3>
        <div class="info-row">
          <span class="info-label">מספר חשבונית:</span>
          <span class="info-value">${data.invoiceNumber}</span>
        </div>
        <div class="info-row">
          <span class="info-label">תאריך הנפקה:</span>
          <span class="info-value">${new Date(data.invoiceDate).toLocaleDateString('he-IL')}</span>
        </div>
        ${data.dueDate ? `
        <div class="info-row">
          <span class="info-label">תאריך פרעון:</span>
          <span class="info-value">${new Date(data.dueDate).toLocaleDateString('he-IL')}</span>
        </div>
        ` : ''}
        ${data.transactionId ? `
        <div class="info-row">
          <span class="info-label">מזהה עסקה:</span>
          <span class="info-value operation-code">${data.transactionId}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="info-section">
        <h3>פרטי לקוח</h3>
        <div class="info-row">
          <span class="info-label">שם:</span>
          <span class="info-value">${data.customerName}</span>
        </div>
        ${data.customerTaxId ? `
        <div class="info-row">
          <span class="info-label">ח.פ/ע.מ:</span>
          <span class="info-value">${data.customerTaxId}</span>
        </div>
        ` : ''}
        ${data.customerAddress ? `
        <div class="info-row">
          <span class="info-label">כתובת:</span>
          <span class="info-value">${data.customerAddress}</span>
        </div>
        ` : ''}
        ${data.paymentMethod ? `
        <div class="info-row">
          <span class="info-label">אמצעי תשלום:</span>
          <span class="info-value">${data.paymentMethod}</span>
        </div>
        ` : ''}
      </div>
    </div>
    
    <div class="line-items">
      <table class="items-table">
        <thead>
          <tr>
            <th>תיאור</th>
            <th>כמות</th>
            <th>מחיר יחידה</th>
            <th>מע"מ</th>
            ${data.lineItems.some(i => i.commission) ? '<th>עמלה</th>' : ''}
            ${data.lineItems.some(i => i.operationCode) ? '<th>קוד פעולה</th>' : ''}
            <th>סה"כ</th>
          </tr>
        </thead>
        <tbody>
          ${data.lineItems.map(item => {
            const itemTotal = item.quantity * item.unitPrice;
            const itemVat = itemTotal * (item.vatRate || VAT_RATE);
            return `
            <tr>
              <td>${item.descriptionHe || item.description}</td>
              <td>${item.quantity}</td>
              <td>₪${item.unitPrice.toFixed(2)}</td>
              <td>₪${itemVat.toFixed(2)} (${((item.vatRate || VAT_RATE) * 100).toFixed(0)}%)</td>
              ${data.lineItems.some(i => i.commission) ? `<td>${item.commission ? '₪' + item.commission.toFixed(2) : '-'}</td>` : ''}
              ${data.lineItems.some(i => i.operationCode) ? `<td>${item.operationCode ? '<span class="operation-code">' + item.operationCode + '</span>' : '-'}</td>` : ''}
              <td><strong>₪${(itemTotal + itemVat).toFixed(2)}</strong></td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="totals-section">
      <div class="totals-grid">
        <div class="total-row">
          <span class="total-label">סכום לפני מע"מ:</span>
          <span class="total-value">₪${totals.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span class="total-label">מע"מ (18%):</span>
          <span class="total-value">₪${totals.totalVat.toFixed(2)}</span>
        </div>
        ${totals.totalCommission > 0 ? `
        <div class="total-row">
          <span class="total-label">סה"כ עמלות:</span>
          <span class="total-value">₪${totals.totalCommission.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span class="total-label">סכום נטו (לאחר עמלות):</span>
          <span class="total-value">₪${totals.netAmount.toFixed(2)}</span>
        </div>
        ` : ''}
      </div>
      
      ${data.creditBreakdown && data.creditBreakdown.totalCreditsAppliedCents > 0 ? `
      <div class="credit-breakdown" style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 12px; border-right: 4px solid #10b981;">
        <div style="font-weight: bold; color: #047857; margin-bottom: 10px; font-size: 1.1em;">
          💳 פירוט זיכויים ששימשו לתשלום
        </div>
        ${data.creditBreakdown.egiftCents > 0 ? `
        <div class="total-row" style="display: flex; justify-content: space-between; padding: 5px 0;">
          <span>🎁 כרטיס מתנה:</span>
          <span style="color: #059669;">-₪${(data.creditBreakdown.egiftCents / 100).toFixed(2)}</span>
        </div>` : ''}
        ${data.creditBreakdown.washPackages > 0 ? `
        <div class="total-row" style="display: flex; justify-content: space-between; padding: 5px 0;">
          <span>🚿 חבילות שטיפה:</span>
          <span style="color: #059669;">${data.creditBreakdown.washPackages} חבילות</span>
        </div>` : ''}
        ${data.creditBreakdown.loyaltyPointsCents > 0 ? `
        <div class="total-row" style="display: flex; justify-content: space-between; padding: 5px 0;">
          <span>⭐ נקודות נאמנות:</span>
          <span style="color: #059669;">-₪${(data.creditBreakdown.loyaltyPointsCents / 100).toFixed(2)}</span>
        </div>` : ''}
        ${data.creditBreakdown.promoCents > 0 ? `
        <div class="total-row" style="display: flex; justify-content: space-between; padding: 5px 0;">
          <span>🏷️ זיכוי מבצע:</span>
          <span style="color: #059669;">-₪${(data.creditBreakdown.promoCents / 100).toFixed(2)}</span>
        </div>` : ''}
        ${data.creditBreakdown.referralCents > 0 ? `
        <div class="total-row" style="display: flex; justify-content: space-between; padding: 5px 0;">
          <span>👥 זיכוי הפניות:</span>
          <span style="color: #059669;">-₪${(data.creditBreakdown.referralCents / 100).toFixed(2)}</span>
        </div>` : ''}
        <div style="border-top: 1px solid #10b981; margin-top: 10px; padding-top: 10px; font-weight: bold;">
          <div style="display: flex; justify-content: space-between;">
            <span>סה"כ זיכויים:</span>
            <span style="color: #059669;">-₪${(data.creditBreakdown.totalCreditsAppliedCents / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>
      ` : ''}
      
      <div class="grand-total">
        <span class="grand-total-label">סה"כ לתשלום:</span>
        <span class="grand-total-value">₪${data.creditBreakdown ? (data.creditBreakdown.cashPaidCents / 100).toFixed(2) : totals.total.toFixed(2)}</span>
      </div>
      
      ${data.creditBreakdown && data.creditBreakdown.totalCreditsAppliedCents > 0 ? `
      <div style="text-align: center; margin-top: 10px; padding: 8px; background: #ecfdf5; border-radius: 8px; color: #047857; font-size: 0.9em;">
        💰 חסכת ₪${(data.creditBreakdown.totalCreditsAppliedCents / 100).toFixed(2)} בהזמנה זו באמצעות זיכויים!
      </div>
      ` : ''}
      
      ${data.notesHe || data.notes ? `
      <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px; border-right: 4px solid #667eea;">
        <strong style="color: #667eea;">הערות:</strong><br>
        ${data.notesHe || data.notes}
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <div class="footer-note">
        💎 ⁦Pet Wash™⁩ - שירותי טיפוח פרמיום לחיות מחמד
      </div>
      <div class="footer-legal">
        מסמך זה מהווה חשבונית מס/כספית כדין | מספר עוסק מורשה: ${COMPANY_DETAILS.vatNumber}<br>
        נוצר ב-${new Date().toLocaleString('he-IL')} | כל הזכויות שמורות © ${new Date().getFullYear()} Pet Wash Ltd.
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generate Luxury Receipt (קבלה)
   */
  generateReceipt(data: InvoiceData): string {
    // Similar structure but simplified for receipt
    return this.generateInvoice({
      ...data,
      notes: data.notes || 'קבלה על תשלום ששולם במלואו'
    });
  }

  /**
   * Generate Luxury Statement (דוח הכנסות)
   */
  generateStatement(data: InvoiceData & { period: string }): string {
    const totals = this.calculateTotals(data.lineItems);
    
    return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>דוח הכנסות - ${data.period}</title>
  <style>
    /* Similar styling to invoice with statement-specific adjustments */
  </style>
</head>
<body>
  <div class="statement-container">
    <h1>דוח הכנסות ומע"מ - ${data.period}</h1>
    <p>סה"כ הכנסות: ₪${totals.subtotal.toFixed(2)}</p>
    <p>מע"מ שנגבה: ₪${totals.totalVat.toFixed(2)}</p>
    <p>עמלות שולמו: ₪${totals.totalCommission.toFixed(2)}</p>
  </div>
</body>
</html>
    `;
  }
}

export default new LuxuryInvoiceService();
