export interface IsraeliTaxConfig {
  VAT_RATE: number; // 18% current Israeli VAT rate
  PROCESSING_FEE_RATE: number; // 1.75% Nayax transaction fee
  COMPANY_TAX_ID: string; // רשום עוסק
  COMPANY_NAME: string;
  COMPANY_ADDRESS: string;
  SUPPORT_EMAIL: string;
}

export const ISRAELI_TAX_CONFIG: IsraeliTaxConfig = {
  VAT_RATE: 0.18, // 18% Israeli VAT (מע״מ)
  PROCESSING_FEE_RATE: 0.0175, // 1.75% Nayax transaction fee
  COMPANY_TAX_ID: process.env.COMPANY_TAX_ID || '517145033', // Pet Wash Ltd company number
  COMPANY_NAME: 'Pet Wash Ltd',
  COMPANY_ADDRESS: 'Israel', // Will be updated with actual address
  SUPPORT_EMAIL: 'Support@PetWash.co.il'
};

export interface TaxCalculation {
  subtotal: number; // Base amount before tax
  vatAmount: number; // VAT amount (מע״מ)
  processingFee: number; // Credit card processing fee
  totalAmount: number; // Final amount including all taxes and fees
  vatRate: number; // VAT rate used
  processingFeeRate: number; // Processing fee rate used
}

export interface TaxInvoice {
  invoiceNumber: string; // מספר חשבונית
  date: Date; // תאריך הנפקה
  customerEmail: string;
  customerName?: string;
  companyName: string; // Pet Wash Ltd
  companyTaxId: string; // רשום עוסק
  companyAddress: string;
  
  // Transaction details
  packageName: string;
  packageNameHe: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  vatAmount: number;
  processingFee: number;
  totalAmount: number;
  
  // Payment details
  paymentMethod: string;
  nayaxTransactionId?: string;
  nayaxReference?: string;
  
  // Tax compliance
  vatRate: number;
  processingFeeRate: number;
  isGiftCard: boolean;
  recipientEmail?: string;
}

export interface TransactionRecord {
  id: string;
  invoiceNumber: string;
  timestamp: Date;
  customerEmail: string;
  customerName?: string;
  
  // Product details
  packageId: number;
  packageName: string;
  packageNameHe: string;
  isGiftCard: boolean;
  
  // Financial details
  subtotal: number;
  vatAmount: number;
  processingFee: number;
  totalAmount: number;
  
  // Payment details
  paymentMethod: string;
  nayaxTransactionId?: string;
  nayaxReference?: string;
  
  // Tax compliance status
  invoiceGenerated: boolean;
  reportSent: boolean;
  taxReported: boolean;
}

export class IsraeliTaxService {
  
  /**
   * Calculate Israeli VAT and processing fees working backwards from customer final price
   * Customer pays finalPrice (e.g. ₪55), we calculate the breakdown including VAT and Nayax fees
   */
  static calculateTax(finalCustomerPrice: number, includeProcessingFee: boolean = true): TaxCalculation {
    // Customer pays finalPrice total (₪55)
    const totalAmount = finalCustomerPrice;
    
    // Calculate backwards: finalPrice includes VAT (18%) and Nayax fee (1.75%)
    // Formula: finalPrice = baseAmount + (baseAmount * VAT_RATE) + (totalAmount * NAYAX_FEE_RATE)
    // Solving for baseAmount: baseAmount = (finalPrice - (finalPrice * NAYAX_FEE_RATE)) / (1 + VAT_RATE)
    
    const nayaxFee = includeProcessingFee ? totalAmount * ISRAELI_TAX_CONFIG.PROCESSING_FEE_RATE : 0;
    const amountAfterNayaxFee = totalAmount - nayaxFee;
    const baseAmount = amountAfterNayaxFee / (1 + ISRAELI_TAX_CONFIG.VAT_RATE);
    const vatAmount = baseAmount * ISRAELI_TAX_CONFIG.VAT_RATE;
    
    return {
      subtotal: parseFloat(baseAmount.toFixed(2)),
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      processingFee: parseFloat(nayaxFee.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      vatRate: ISRAELI_TAX_CONFIG.VAT_RATE,
      processingFeeRate: includeProcessingFee ? ISRAELI_TAX_CONFIG.PROCESSING_FEE_RATE : 0
    };
  }
  
  /**
   * Generate Israeli tax invoice number
   */
  static generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `PW${year}${timestamp}${random}`;
  }
  
  /**
   * Create tax invoice for transaction
   */
  static createTaxInvoice(
    transaction: any,
    washPackage: any,
    taxCalculation: TaxCalculation
  ): TaxInvoice {
    return {
      invoiceNumber: this.generateInvoiceNumber(),
      date: new Date(),
      customerEmail: transaction.customerEmail,
      customerName: transaction.customerName,
      companyName: ISRAELI_TAX_CONFIG.COMPANY_NAME,
      companyTaxId: ISRAELI_TAX_CONFIG.COMPANY_TAX_ID,
      companyAddress: ISRAELI_TAX_CONFIG.COMPANY_ADDRESS,
      
      packageName: washPackage.name,
      packageNameHe: washPackage.nameHe,
      quantity: 1,
      unitPrice: taxCalculation.subtotal,
      subtotal: taxCalculation.subtotal,
      vatAmount: taxCalculation.vatAmount,
      processingFee: taxCalculation.processingFee,
      totalAmount: taxCalculation.totalAmount,
      
      paymentMethod: 'Nayax',
      nayaxTransactionId: transaction.nayaxTransactionId,
      nayaxReference: transaction.nayaxReference,
      
      vatRate: taxCalculation.vatRate,
      processingFeeRate: taxCalculation.processingFeeRate,
      isGiftCard: transaction.isGiftCard,
      recipientEmail: transaction.recipientEmail
    };
  }
  
  /**
   * Format tax invoice as HTML for email
   */
  static formatInvoiceHTML(invoice: TaxInvoice): string {
    const formatCurrency = (amount: number) => `₪${amount.toFixed(2)}`;
    const formatDate = (date: Date) => date.toLocaleDateString('he-IL');
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>חשבונית מס - ${invoice.invoiceNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; direction: rtl; margin: 20px; }
        .invoice-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
        .company-info { text-align: right; margin-bottom: 20px; }
        .customer-info { text-align: right; margin-bottom: 20px; }
        .invoice-details { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .invoice-details th, .invoice-details td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        .invoice-details th { background-color: #f2f2f2; }
        .totals { text-align: right; margin-top: 20px; }
        .total-line { margin: 5px 0; }
        .final-total { font-weight: bold; font-size: 1.2em; border-top: 2px solid #000; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="invoice-header">
        <h1>חשבונית מס</h1>
        <h2>Pet Wash™ - שטיפת חיות מחמד פרימיום</h2>
        <p>מספר חשבונית: ${invoice.invoiceNumber}</p>
        <p>תאריך: ${formatDate(invoice.date)}</p>
    </div>
    
    <div class="company-info">
        <h3>פרטי החברה:</h3>
        <p><strong>${invoice.companyName}</strong></p>
        <p>רשום עוסק: ${invoice.companyTaxId}</p>
        <p>כתובת: ${invoice.companyAddress}</p>
        <p>אימייל: ${ISRAELI_TAX_CONFIG.SUPPORT_EMAIL}</p>
    </div>
    
    <div class="customer-info">
        <h3>פרטי הלקוח:</h3>
        <p>אימייל: ${invoice.customerEmail}</p>
        ${invoice.customerName ? `<p>שם: ${invoice.customerName}</p>` : ''}
        ${invoice.recipientEmail ? `<p>אימייל נמען: ${invoice.recipientEmail}</p>` : ''}
    </div>
    
    <table class="invoice-details">
        <thead>
            <tr>
                <th>תיאור</th>
                <th>כמות</th>
                <th>מחיר יחידה</th>
                <th>סכום</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>${invoice.packageNameHe}${invoice.isGiftCard ? ' (שובר מתנה)' : ''}</td>
                <td>${invoice.quantity}</td>
                <td>${formatCurrency(invoice.unitPrice)}</td>
                <td>${formatCurrency(invoice.subtotal)}</td>
            </tr>
        </tbody>
    </table>
    
    <div class="totals">
        <div class="total-line">סכום ביניים: ${formatCurrency(invoice.subtotal)}</div>
        <div class="total-line">מע״מ (${(invoice.vatRate * 100).toFixed(0)}%): ${formatCurrency(invoice.vatAmount)}</div>
        ${invoice.processingFee > 0 ? `<div class="total-line">עמלת סליקה (${(invoice.processingFeeRate * 100).toFixed(1)}%): ${formatCurrency(invoice.processingFee)}</div>` : ''}
        <div class="total-line final-total">סכום כולל לתשלום: ${formatCurrency(invoice.totalAmount)}</div>
    </div>
    
    <div style="margin-top: 30px; font-size: 0.9em; color: #666;">
        <p>אמצעי תשלום: ${invoice.paymentMethod}</p>
        ${invoice.nayaxTransactionId ? `<p>מספר עסקה: ${invoice.nayaxTransactionId}</p>` : ''}
        ${invoice.nayaxReference ? `<p>אסמכתא: ${invoice.nayaxReference}</p>` : ''}
        <p>חשבונית זו הונפקה באופן אוטומטי על ידי מערכת Pet Wash™</p>
    </div>
</body>
</html>`;
  }
  
  /**
   * Generate transaction report for support team
   */
  static generateTransactionReport(transaction: TransactionRecord, invoice: TaxInvoice): string {
    const formatCurrency = (amount: number) => `₪${amount.toFixed(2)}`;
    const formatDate = (date: Date) => date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL');
    
    return `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
    <meta charset="UTF-8">
    <title>Transaction Report - ${transaction.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
        .section { margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .section h3 { margin-top: 0; color: #333; }
        .field { margin: 5px 0; }
        .field strong { display: inline-block; width: 200px; }
        .totals { background-color: #f9f9f9; }
        .tax-info { background-color: #e8f5e8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Pet Wash™ Transaction Report</h1>
        <h2>Transaction ID: ${transaction.id}</h2>
        <p>Generated: ${formatDate(new Date())}</p>
    </div>
    
    <div class="section">
        <h3>Customer Information</h3>
        <div class="field"><strong>Email:</strong> ${transaction.customerEmail}</div>
        <div class="field"><strong>Name:</strong> ${transaction.customerName || 'Guest Customer'}</div>
        <div class="field"><strong>Transaction Date:</strong> ${formatDate(transaction.timestamp)}</div>
    </div>
    
    <div class="section">
        <h3>Product Information</h3>
        <div class="field"><strong>Package ID:</strong> ${transaction.packageId}</div>
        <div class="field"><strong>Package Name (EN):</strong> ${transaction.packageName}</div>
        <div class="field"><strong>Package Name (HE):</strong> ${transaction.packageNameHe}</div>
        <div class="field"><strong>Type:</strong> ${transaction.isGiftCard ? 'Gift Card' : 'Wash Service'}</div>
    </div>
    
    <div class="section totals">
        <h3>Financial Breakdown</h3>
        <div class="field"><strong>Subtotal:</strong> ${formatCurrency(transaction.subtotal)}</div>
        <div class="field"><strong>VAT Amount:</strong> ${formatCurrency(transaction.vatAmount)}</div>
        <div class="field"><strong>Processing Fee:</strong> ${formatCurrency(transaction.processingFee)}</div>
        <div class="field"><strong>Total Amount:</strong> ${formatCurrency(transaction.totalAmount)}</div>
    </div>
    
    <div class="section">
        <h3>Payment Information</h3>
        <div class="field"><strong>Payment Method:</strong> ${transaction.paymentMethod}</div>
        <div class="field"><strong>Nayax Transaction ID:</strong> ${transaction.nayaxTransactionId || 'N/A'}</div>
        <div class="field"><strong>Nayax Reference:</strong> ${transaction.nayaxReference || 'N/A'}</div>
    </div>
    
    <div class="section tax-info">
        <h3>Tax Compliance Status</h3>
        <div class="field"><strong>Invoice Number:</strong> ${transaction.invoiceNumber}</div>
        <div class="field"><strong>Invoice Generated:</strong> ${transaction.invoiceGenerated ? 'Yes' : 'No'}</div>
        <div class="field"><strong>Report Sent:</strong> ${transaction.reportSent ? 'Yes' : 'No'}</div>
        <div class="field"><strong>Tax Authority Reported:</strong> ${transaction.taxReported ? 'Yes' : 'Pending'}</div>
    </div>
</body>
</html>`;
  }
}