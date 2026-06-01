/**
 * PetWash™ — חשבונית מס / Tax Invoice Email 2026
 *
 * Type: LEGAL DOCUMENT — NO unsubscribe footer (it's a legal tax doc)
 * NO emoji in finance/legal emails (Israeli Tax Authority requirement)
 * ח.פ. 517145033 MUST appear prominently in body
 * BCC: support@petwash.co.il on all legal documents
 * Bilingual: Hebrew primary + English secondary
 *
 * Triggered by: IsraeliInvoiceGenerator.generateInvoice()
 *   - shop order completion (delivered status)
 *   - booking payment completion
 *   - wallet top-up (if above reporting threshold)
 *   - egift purchase
 */

import { PETWASH_LOGO_BASE64 } from './logo-base64';
import { SUPPORT_EMAIL } from '@shared/support-contact';
import { COMPANY_TAX_ID, ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

// Brand tokens — legal doc uses muted palette, no gold gradient
const HEADER_BG   = '#0F0F0F';
const BODY_BG     = '#FFFFFF';
const STRIPE_BG   = '#F9F7F3';
const DIVIDER     = '#E0E0E0';
const TEXT_PRI    = '#111111';
const TEXT_SEC    = '#444444';
const TEXT_DIM    = '#777777';
const GOLD        = '#B8941F';
const GOLD_FADE   = '#F5EDD8';

// Israeli legal constants
const VAT_RATE    = ISRAEL_VAT_RATE;
const BUSINESS_HE = 'פט ווש בע"מ';
const BUSINESS_EN = 'Pet Wash Ltd';
const COMPANY_REG = COMPANY_TAX_ID;
const COMPANY_ADDRESS_HE = 'ישראל';
const NOREPLY     = SUPPORT_EMAIL;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatILS(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}
function formatDate(iso: string, locale = 'he-IL'): string {
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
}
function padInvoice(n: string | number): string {
  return String(n).padStart(7, '0');
}

export interface TaxInvoiceParams {
  invoiceNumber: string | number;
  invoiceDate: string;
  orderId: string;
  orderDate?: string;
  customerName: string;
  customerEmail: string;
  customerTaxId?: string;
  customerAddress?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
    vatCents: number;
  }>;
  netCents: number;
  vatCents: number;
  totalCents: number;
  paymentMethod?: string;
  invoiceType?: 'tax_invoice' | 'receipt' | 'combined';
  language?: string;
}

export function taxInvoiceLuxury(p: TaxInvoiceParams): string {
  const lang = p.language ?? 'he';
  const isHe = lang === 'he';
  const customerName = escapeHtml(p.customerName);
  const customerEmail = escapeHtml(p.customerEmail);
  const customerAddress = p.customerAddress ? escapeHtml(p.customerAddress) : '';
  const customerTaxId = p.customerTaxId ? escapeHtml(p.customerTaxId) : '';
  const orderId = escapeHtml(p.orderId);
  const paymentMethod = p.paymentMethod ? escapeHtml(p.paymentMethod) : '';
  const invoiceTypeLabel = {
    tax_invoice: { he: 'חשבונית מס', en: 'Tax Invoice' },
    receipt:     { he: 'קבלה', en: 'Receipt' },
    combined:    { he: 'חשבונית מס / קבלה', en: 'Tax Invoice / Receipt' },
  }[p.invoiceType ?? 'tax_invoice'];

  const vatPercent = Math.round(VAT_RATE * 100);

  const itemRows = p.items.map((item, i) => {
    const bg = i % 2 === 0 ? BODY_BG : STRIPE_BG;
    const netUnit = Math.round(item.unitPriceCents / (1 + VAT_RATE));
    const description = escapeHtml(item.description);
    return `
    <tr style="background:${bg}">
      <td style="padding:10px 12px;font-size:13px;color:${TEXT_PRI};direction:rtl;border-bottom:1px solid ${DIVIDER}">
        ${description}
      </td>
      <td align="center" style="padding:10px 8px;font-size:13px;color:${TEXT_SEC};border-bottom:1px solid ${DIVIDER};width:50px">
        ${item.quantity}
      </td>
      <td style="padding:10px 8px;font-size:13px;color:${TEXT_SEC};border-bottom:1px solid ${DIVIDER};white-space:nowrap;width:90px">
        ${formatILS(netUnit)}
      </td>
      <td style="padding:10px 8px;font-size:13px;color:${TEXT_SEC};border-bottom:1px solid ${DIVIDER};white-space:nowrap;width:90px">
        ${formatILS(item.vatCents)}
      </td>
      <td style="padding:10px 8px;font-size:13px;font-weight:600;color:${TEXT_PRI};border-bottom:1px solid ${DIVIDER};white-space:nowrap;width:90px">
        ${formatILS(item.totalCents)}
      </td>
    </tr>`;
  }).join('');

  const customerTaxRow = customerTaxId ? `
    <tr>
      <td style="padding:4px 0;direction:rtl">
        <span style="font-size:12px;color:${TEXT_DIM}">${isHe ? 'מספר עוסק / ח.פ. לקוח' : 'Customer Tax ID'}</span>
      </td>
      <td style="padding:4px 0">
        <span style="font-size:12px;color:${TEXT_PRI};font-family:monospace">${customerTaxId}</span>
      </td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${isHe ? invoiceTypeLabel.he : invoiceTypeLabel.en} ${padInvoice(p.invoiceNumber)} — Pet Wash™</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f4f4f4">
<tr><td align="center" style="padding:24px 8px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${BODY_BG};border:1px solid ${DIVIDER}">

  <!-- HEADER -->
  <tr>
    <td bgcolor="${HEADER_BG}" style="padding:24px 32px;background:${HEADER_BG}">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="direction:rtl">
            <img src="${PETWASH_LOGO_BASE64}" width="120" alt="Pet Wash™" style="display:block;margin-bottom:12px"/>
            <div style="color:${GOLD};font-size:18px;font-weight:700;letter-spacing:1px">
              ${isHe ? invoiceTypeLabel.he : invoiceTypeLabel.en}
            </div>
            <div style="color:#aaa;font-size:11px;margin-top:4px">
              ${BUSINESS_HE} | ${BUSINESS_EN}
            </div>
          </td>
          <td align="left" style="vertical-align:top">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:4px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15)">
                  <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">
                    ${isHe ? 'מספר חשבונית' : 'Invoice No.'}
                  </div>
                  <div style="font-size:16px;font-weight:700;color:#fff;font-family:monospace">
                    ${padInvoice(p.invoiceNumber)}
                  </div>
                  <div style="font-size:11px;color:#aaa;margin-top:2px">
                    ${formatDate(p.invoiceDate)}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- COMPANY + CUSTOMER INFO -->
  <tr>
    <td style="padding:24px 32px;border-bottom:1px solid ${DIVIDER}">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <!-- Supplier (us) -->
          <td width="50%" style="vertical-align:top;direction:rtl">
            <div style="font-size:11px;font-weight:700;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
              ${isHe ? 'מוכר / נותן השירות' : 'Seller'}
            </div>
            <div style="font-size:13px;color:${TEXT_PRI};line-height:1.7">
              <strong>${BUSINESS_HE}</strong><br/>
              ${BUSINESS_EN}<br/>
              ${isHe ? 'ח.פ.' : 'Reg. No.'}: <strong>${COMPANY_REG}</strong><br/>
              ${NOREPLY}
            </div>
          </td>
          <!-- Buyer (customer) -->
          <td width="50%" style="vertical-align:top;padding-right:24px;direction:rtl">
            <div style="font-size:11px;font-weight:700;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
              ${isHe ? 'לקוח' : 'Customer'}
            </div>
            <div style="font-size:13px;color:${TEXT_PRI};line-height:1.7">
              ${customerName}<br/>
              ${customerEmail}
              ${customerAddress ? '<br/>' + customerAddress : ''}
            </div>
            ${customerTaxId ? `
            <table cellpadding="0" cellspacing="0" style="margin-top:8px">
              ${customerTaxRow}
            </table>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ORDER REFERENCE -->
  ${p.orderId ? `
  <tr>
    <td style="padding:12px 32px;background:${STRIPE_BG};border-bottom:1px solid ${DIVIDER};direction:rtl">
      <span style="font-size:12px;color:${TEXT_DIM}">
        ${isHe ? 'מספר הזמנה' : 'Order ref.'}:
        <strong style="font-family:monospace">${orderId}</strong>
        ${p.orderDate ? ` &nbsp;|  ${formatDate(p.orderDate)}` : ''}
      </span>
    </td>
  </tr>` : ''}

  <!-- ITEMS TABLE -->
  <tr>
    <td style="padding:24px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${DIVIDER}">
        <tr bgcolor="${HEADER_BG}">
          <td style="padding:10px 12px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;direction:rtl">
            ${isHe ? 'תיאור' : 'DESCRIPTION'}
          </td>
          <td align="center" style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;width:50px">
            ${isHe ? 'כמות' : 'QTY'}
          </td>
          <td style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;width:90px">
            ${isHe ? 'מחיר לפני מע"מ' : 'UNIT NET'}
          </td>
          <td style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;width:90px">
            ${isHe ? 'מע"מ' : 'VAT'}
          </td>
          <td style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;width:90px">
            ${isHe ? 'סה"כ כולל מע"מ' : 'TOTAL INC. VAT'}
          </td>
        </tr>
        ${itemRows}
      </table>
    </td>
  </tr>

  <!-- TOTALS -->
  <tr>
    <td style="padding:0 32px 24px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-left:1px solid ${DIVIDER};border-right:1px solid ${DIVIDER};border-bottom:1px solid ${DIVIDER}">
        <!-- Net -->
        <tr>
          <td style="padding:10px 12px;direction:rtl">
            <span style="font-size:13px;color:${TEXT_SEC}">
              ${isHe ? 'סכום ללא מע"מ' : 'Net amount (ex. VAT)'}
            </span>
          </td>
          <td style="padding:10px 12px">
            <span style="font-size:13px;color:${TEXT_PRI}">${formatILS(p.netCents)}</span>
          </td>
        </tr>
        <!-- VAT -->
        <tr style="background:${STRIPE_BG}">
          <td style="padding:10px 12px;direction:rtl;border-top:1px solid ${DIVIDER}">
            <span style="font-size:13px;color:${TEXT_SEC}">
              ${isHe ? `מע"מ ${vatPercent}%` : `VAT ${vatPercent}%`}
            </span>
          </td>
          <td style="padding:10px 12px;border-top:1px solid ${DIVIDER}">
            <span style="font-size:13px;color:${TEXT_PRI}">${formatILS(p.vatCents)}</span>
          </td>
        </tr>
        <!-- Grand Total -->
        <tr style="background:${GOLD_FADE}">
          <td style="padding:14px 12px;direction:rtl;border-top:2px solid ${GOLD}">
            <span style="font-size:15px;font-weight:700;color:${TEXT_PRI}">
              ${isHe ? 'סה"כ לתשלום' : 'TOTAL (inc. VAT)'}
            </span>
          </td>
          <td style="padding:14px 12px;border-top:2px solid ${GOLD}">
            <span style="font-size:18px;font-weight:700;color:${GOLD}">${formatILS(p.totalCents)}</span>
          </td>
        </tr>
        <!-- VAT registration line -->
        <tr>
          <td colspan="2" style="padding:8px 12px;border-top:1px solid ${DIVIDER};direction:rtl">
            <span style="font-size:11px;color:${TEXT_DIM}">
              ${isHe
                ? `ח.פ. ${COMPANY_REG} | רשום למע"מ בישראל | שיעור מע"מ: ${vatPercent}%`
                : `Reg. No. ${COMPANY_REG} | Registered for VAT in Israel | VAT rate: ${vatPercent}%`}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- PAYMENT METHOD (if provided) -->
  ${paymentMethod ? `
  <tr>
    <td style="padding:0 32px 24px;direction:rtl">
      <div style="font-size:12px;color:${TEXT_DIM}">
        ${isHe ? 'אמצעי תשלום' : 'Payment method'}: 
        <strong style="color:${TEXT_SEC}">${paymentMethod}</strong>
      </div>
    </td>
  </tr>` : ''}

  <!-- LEGAL NOTICE -->
  <tr>
    <td style="padding:16px 32px;background:${STRIPE_BG};border-top:1px solid ${DIVIDER};direction:rtl">
      <p style="margin:0;font-size:11px;color:${TEXT_DIM};line-height:1.6">
        ${isHe
          ? `מסמך זה הוא מסמך חשבונאי/מס בהתאם לדין הישראלי ולנתוני העסק המאושרים במערכת.
             יש לשמור את המסמך לצרכי מס וחשבונאות. לכל תיקון או בירור נא לפנות לתמיכה.`
          : `This document is an accounting/tax document issued according to Israeli law and the approved business data in the system.
             Retain for tax and accounting purposes. Contact support for corrections or questions.`}
      </p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td bgcolor="${HEADER_BG}" style="padding:20px 32px;text-align:center;background:${HEADER_BG}">
      <p style="margin:0 0 6px;font-size:11px;color:#888;direction:rtl">
        ${BUSINESS_HE} | ${BUSINESS_EN} | ח.פ. ${COMPANY_REG}
      </p>
      <p style="margin:0 0 4px;font-size:11px;color:#666">
        ${NOREPLY} | petwash.co.il
      </p>
      <p style="margin:0;font-size:10px;color:#555;direction:rtl">
        ${isHe
          ? 'זו הודעה עסקית / מסמך חשבונאי. אין ביטול אפשרי.'
          : 'This is a legal/business document. No unsubscribe option available.'}
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
}
