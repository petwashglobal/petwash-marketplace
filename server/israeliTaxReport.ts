/**
 * Israeli Tax Authority (מס הכנסה) Compliance Report Generator
 * Generates bilingual Hebrew/English tax reports for government submission
 */

import { logger } from './lib/logger';
import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface TaxReportData {
  reportDate: string;
  reportPeriod: { start: Date; end: Date };
  totalRevenue: number;
  totalVAT: number;
  totalTransactions: number;
  transactions: Array<{
    date: Date;
    invoiceNumber: string;
    amount: number;
    vat: number;
    netAmount: number;
    paymentMethod: string;
  }>;
}

export class IsraeliTaxReportService {
  
  /**
   * Generate bilingual (Hebrew/English) tax report HTML
   * Compliant with Israeli tax authority requirements
   */
  static generateBilingualTaxReport(data: TaxReportData): string {
    const formatCurrency = (amount: number) => `₪${amount.toFixed(2)}`;
    const formatDate = (date: Date) => date.toLocaleDateString('he-IL');
    const formatDateEn = (date: Date) => date.toLocaleDateString('en-US');
    
    return `
<!DOCTYPE html>
<html lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>דוח מס - Tax Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #D4AF37;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            color: #1a1a1a;
            font-size: 32px;
        }
        .header .subtitle {
            color: #666;
            margin-top: 10px;
            font-size: 16px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-he {
            direction: rtl;
            text-align: right;
        }
        .section-en {
            direction: ltr;
            text-align: left;
        }
        .section h2 {
            color: #D4AF37;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .company-info {
            background: #fafafa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .company-info p {
            margin: 8px 0;
            font-size: 14px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
        }
        .summary-card.vat {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .summary-card.net {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            opacity: 0.9;
        }
        .summary-card .value {
            font-size: 28px;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            border: 1px solid #e0e0e0;
        }
        th {
            background: #1a1a1a;
            color: white;
            font-weight: 600;
        }
        tr:nth-child(even) {
            background: #fafafa;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .legal-notice {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .legal-notice strong {
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- HEBREW SECTION -->
        <div class="section section-he">
            <div class="header">
                <h1>🐾 דוח מס - Pet Wash™</h1>
                <div class="subtitle">דוח הכנסות ומע"מ לרשויות המס</div>
                <div class="subtitle">תאריך דוח: ${formatDate(new Date())}</div>
            </div>

            <div class="company-info">
                <h3 style="margin-top: 0;">פרטי החברה</h3>
                <p><strong>שם:</strong> Pet Wash Ltd</p>
                <p><strong>ח.פ / עוסק מורשה:</strong> 517145033</p>
                <p><strong>כתובת:</strong> ישראל</p>
                <p><strong>אימייל:</strong> Support@PetWash.co.il</p>
            </div>

            <div class="legal-notice">
                <strong>⚖️ הצהרה:</strong> דוח זה הוכן בהתאם לתקנות מס הכנסה ומע"מ בישראל. כל הנתונים נשמרים במערכת לצורכי ביקורת.
            </div>

            <h2>סיכום תקופת הדוח</h2>
            <p><strong>תקופה:</strong> ${formatDate(data.reportPeriod.start)} - ${formatDate(data.reportPeriod.end)}</p>

            <div class="summary-grid">
                <div class="summary-card">
                    <h3>סה"כ הכנסות ברוטו</h3>
                    <div class="value">${formatCurrency(data.totalRevenue)}</div>
                </div>
                <div class="summary-card vat">
                    <h3>סה"כ מע"מ (18%)</h3>
                    <div class="value">${formatCurrency(data.totalVAT)}</div>
                </div>
                <div class="summary-card net">
                    <h3>הכנסה נטו (לפני מע"מ)</h3>
                    <div class="value">${formatCurrency(data.totalRevenue - data.totalVAT)}</div>
                </div>
            </div>

            <h2>פירוט עסקאות</h2>
            <p><strong>מספר עסקאות:</strong> ${data.totalTransactions}</p>
            
            ${data.transactions.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>תאריך</th>
                        <th>מספר חשבונית</th>
                        <th>סכום כולל</th>
                        <th>מע"מ</th>
                        <th>נטו</th>
                        <th>אמצעי תשלום</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.transactions.map(tx => `
                    <tr>
                        <td>${formatDate(tx.date)}</td>
                        <td>${tx.invoiceNumber}</td>
                        <td>${formatCurrency(tx.amount)}</td>
                        <td>${formatCurrency(tx.vat)}</td>
                        <td>${formatCurrency(tx.netAmount)}</td>
                        <td>${tx.paymentMethod}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : '<p style="text-align:center; color:#666;">אין עסקאות בתקופה זו</p>'}
        </div>

        <hr style="margin: 40px 0; border: none; border-top: 3px solid #D4AF37;">

        <!-- ENGLISH SECTION -->
        <div class="section section-en">
            <div class="header">
                <h1>🐾 Tax Report - Pet Wash™</h1>
                <div class="subtitle">Revenue and VAT Report for Tax Authorities</div>
                <div class="subtitle">Report Date: ${formatDateEn(new Date())}</div>
            </div>

            <div class="company-info">
                <h3 style="margin-top: 0;">Company Information</h3>
                <p><strong>Name:</strong> Pet Wash Ltd</p>
                <p><strong>Company / VAT Number:</strong> 517145033</p>
                <p><strong>Address:</strong> Israel</p>
                <p><strong>Email:</strong> Support@PetWash.co.il</p>
            </div>

            <div class="legal-notice">
                <strong>⚖️ Declaration:</strong> This report has been prepared in accordance with Israeli Income Tax and VAT regulations. All data is retained in the system for audit purposes.
            </div>

            <h2>Report Period Summary</h2>
            <p><strong>Period:</strong> ${formatDateEn(data.reportPeriod.start)} - ${formatDateEn(data.reportPeriod.end)}</p>

            <div class="summary-grid">
                <div class="summary-card">
                    <h3>Total Gross Revenue</h3>
                    <div class="value">${formatCurrency(data.totalRevenue)}</div>
                </div>
                <div class="summary-card vat">
                    <h3>Total VAT (18%)</h3>
                    <div class="value">${formatCurrency(data.totalVAT)}</div>
                </div>
                <div class="summary-card net">
                    <h3>Net Revenue (Before VAT)</h3>
                    <div class="value">${formatCurrency(data.totalRevenue - data.totalVAT)}</div>
                </div>
            </div>

            <h2>Transaction Details</h2>
            <p><strong>Number of Transactions:</strong> ${data.totalTransactions}</p>
            
            ${data.transactions.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Invoice Number</th>
                        <th>Total Amount</th>
                        <th>VAT</th>
                        <th>Net</th>
                        <th>Payment Method</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.transactions.map(tx => `
                    <tr>
                        <td>${formatDateEn(tx.date)}</td>
                        <td>${tx.invoiceNumber}</td>
                        <td>${formatCurrency(tx.amount)}</td>
                        <td>${formatCurrency(tx.vat)}</td>
                        <td>${formatCurrency(tx.netAmount)}</td>
                        <td>${tx.paymentMethod}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : '<p style="text-align:center; color:#666;">No transactions in this period</p>'}
        </div>

        <div class="footer">
            <p>📄 דוח זה הופק אוטומטית על ידי מערכת Pet Wash™</p>
            <p>This report was generated automatically by Pet Wash™ system</p>
            <p style="margin-top: 10px; font-size: 12px;">
                🔒 כל הנתונים מאובטחים ונשמרים בהתאם לחוק הגנת הפרטיות והנחיות רשות המיסים<br>
                All data is secured and retained in accordance with Privacy Protection Law and Tax Authority guidelines
            </p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Send bilingual tax report to support email
   */
  static async sendTaxReportToAccountant(
    data: TaxReportData,
    recipientEmail: string = 'Support@PetWash.co.il'
  ): Promise<boolean> {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        logger.warn('[TAX REPORT] SendGrid not configured - skipping email');
        return false;
      }

      const htmlContent = this.generateBilingualTaxReport(data);
      
      const msg = {
        to: recipientEmail,
        from: 'reports@petwash.co.il',
        subject: `📊 דוח מס / Tax Report - Pet Wash™ - ${data.reportDate}`,
        html: htmlContent
      };
      
      await sgMail.send(msg);
      logger.info(`[TAX REPORT] Bilingual tax report sent to ${recipientEmail}`);
      return true;
      
    } catch (error) {
      logger.error('[TAX REPORT] Failed to send tax report', error);
      return false;
    }
  }
}
