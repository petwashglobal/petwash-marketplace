/**
 * PetWash™ — חשבונית מס קבלה / Tax Invoice-Receipt
 * Israeli legal standard: every transaction must include חשבונית מס קבלה
 * with VAT (מע"מ) 18% breakdown — required for government reporting.
 *
 * Two generators:
 *   buildEGiftReceipt()        — e-gift card purchase
 *   buildProviderTxReceipt()   — provider service (petsitter / walker / academy)
 */

import { PETWASH_LOGO_BASE64 } from './logo-base64';

// ─── Shared constants ────────────────────────────────────────────────────────
const VAT_RATE       = 0.18;           // 18% מע"מ (Israel 2024+)
const BUSINESS_REG   = '515895671';    // עוסק מורשה — Pet Wash Ltd
const BUSINESS_NAME  = 'Pet Wash Ltd';
const BUSINESS_NAME_HE = 'פט ווש בע"מ';
const BUSINESS_ADDR  = 'תל אביב, ישראל';
const SUPPORT_EMAIL  = 'support@petwash.co.il';
const SUPPORT_PHONE  = '03-000-0000';

const GOLD     = '#C6A35B';
const GOLD_LT  = '#E7C978';
const GOLD_DK  = '#B8941F';
const BLACK    = '#0a0a0a';
const DARK     = '#111111';
const SURFACE  = '#1a1a1a';
const BORDER   = 'rgba(198,163,91,0.25)';

function vatBreakdown(totalIls: number): { net: number; vat: number; gross: number } {
  const net   = +(totalIls / (1 + VAT_RATE)).toFixed(2);
  const vat   = +(totalIls - net).toFixed(2);
  return { net, vat, gross: totalIls };
}

function fmtIls(n: number): string {
  return `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Shared header / footer ──────────────────────────────────────────────────
function emailShell(bodyContent: string, invoiceNo: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PetWash™ — חשבונית מס קבלה ${invoiceNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap');
  body { margin:0; padding:0; background:#0a0a0a; font-family: -apple-system,Helvetica,Arial,sans-serif; }
  * { box-sizing: border-box; }
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BLACK};min-height:100vh;">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

      <!-- TOP GOLD LINE -->
      <tr><td style="height:3px;background:linear-gradient(90deg,${GOLD_DK},${GOLD_LT},${GOLD_DK});border-radius:3px 3px 0 0;"></td></tr>

      <!-- HEADER -->
      <tr><td style="background:${DARK};padding:32px 40px 24px;text-align:right;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-size:10px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;margin-bottom:4px;">חשבונית מס קבלה</div>
              <div style="font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase;">Tax Invoice — Receipt</div>
            </td>
            <td align="left" style="width:120px;">
              <div style="font-size:22px;font-weight:700;color:${GOLD};letter-spacing:-0.5px;">
                🐾 PetWash™
              </div>
              <div style="font-size:9px;color:#666;letter-spacing:2px;text-transform:uppercase;">PRESTIGE PLATFORM</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- INVOICE BADGE -->
      <tr><td style="background:linear-gradient(135deg,${SURFACE},#222);padding:0 40px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-top:24px;">
              <div style="display:inline-block;background:linear-gradient(135deg,${GOLD_DK},${GOLD});padding:6px 18px;border-radius:20px;">
                <span style="font-size:11px;font-weight:700;color:#000;letter-spacing:2px;text-transform:uppercase;">✓ אושר ושולם</span>
              </div>
            </td>
            <td align="left" style="padding-top:24px;">
              <div style="font-size:10px;color:#888;letter-spacing:1px;">CONFIRMED &amp; PAID</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- BODY CONTENT -->
      ${bodyContent}

      <!-- LEGAL FOOTER -->
      <tr><td style="background:${SURFACE};padding:28px 40px;border-top:1px solid ${BORDER};">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-right:1px solid ${BORDER};padding-left:24px;">
              <div style="font-size:9px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">פרטי עוסק</div>
              <div style="font-size:10px;color:#aaa;line-height:1.7;">
                ${BUSINESS_NAME_HE} / ${BUSINESS_NAME}<br>
                עוסק מורשה מס׳ ${BUSINESS_REG}<br>
                ${BUSINESS_ADDR}
              </div>
            </td>
            <td style="padding-right:24px;" align="right">
              <div style="font-size:9px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">יצירת קשר</div>
              <div style="font-size:10px;color:#aaa;line-height:1.7;">
                ${SUPPORT_EMAIL}<br>
                ${SUPPORT_PHONE}<br>
                <a href="https://petwash.co.il" style="color:${GOLD};text-decoration:none;">petwash.co.il</a>
              </div>
            </td>
          </tr>
        </table>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05);font-size:8.5px;color:#555;line-height:1.6;text-align:center;">
          מסמך זה מהווה חשבונית מס קבלה לפי תקנות מס ערך מוסף (מע"מ), תשל"ו-1976. שמור/י מסמך זה לצורך דיווח לרשות המסים.
          <br>This document serves as a Tax Invoice-Receipt under Israeli VAT Regulations 1976. Retain for tax reporting purposes.
        </div>
      </td></tr>

      <!-- BOTTOM GOLD LINE -->
      <tr><td style="height:3px;background:linear-gradient(90deg,${GOLD_DK},${GOLD_LT},${GOLD_DK});border-radius:0 0 3px 3px;"></td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── ROW helpers ─────────────────────────────────────────────────────────────
function infoRow(labelHe: string, labelEn: string, value: string, highlight = false): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="font-size:11px;color:#888;">${labelHe}</span>
      <span style="font-size:9px;color:#555;margin-right:4px;">${labelEn}</span>
    </td>
    <td align="left" style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="font-size:${highlight ? '13' : '11'}px;font-weight:${highlight ? '700' : '400'};color:${highlight ? GOLD : '#ccc'};">${value}</span>
    </td>
  </tr>`;
}

function amountRow(labelHe: string, labelEn: string, amount: string, emphasis = false, isTotal = false): string {
  if (isTotal) {
    return `<tr>
      <td colspan="2" style="padding:0;"><div style="height:1px;background:linear-gradient(90deg,${GOLD_DK},${GOLD});margin:12px 0;"></div></td>
    </tr>
    <tr>
      <td style="padding:10px 0 4px;">
        <span style="font-size:13px;font-weight:700;color:${GOLD_LT};">${labelHe}</span>
        <span style="font-size:9px;color:${GOLD};margin-right:4px;opacity:0.7;">${labelEn}</span>
      </td>
      <td align="left" style="padding:10px 0 4px;">
        <span style="font-size:20px;font-weight:700;color:${GOLD};">${amount}</span>
      </td>
    </tr>`;
  }
  return `<tr>
    <td style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="font-size:11px;color:${emphasis ? '#ccc' : '#888'};">${labelHe}</span>
      <span style="font-size:9px;color:#555;margin-right:4px;">${labelEn}</span>
    </td>
    <td align="left" style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="font-size:12px;font-weight:${emphasis ? '600' : '400'};color:${emphasis ? '#ddd' : '#999'};">${amount}</span>
    </td>
  </tr>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. E-GIFT CARD PURCHASE RECEIPT
// ═══════════════════════════════════════════════════════════════════════════════
export interface EGiftReceiptParams {
  invoiceNo:       string;   // PW-INV-2026-003847
  txId:            string;   // TXN-20260317-884729
  date:            Date;
  buyerName:       string;
  buyerEmail:      string;
  recipientName:   string;
  giftAmountIls:   number;   // face value, e.g. 500
  voucherId:       string;   // PGIFT-XXX
  paymentLast4:    string;   // last 4 digits of card
  paymentBrand:    string;   // Visa / Mastercard / Amex
  personalMessage?: string;
  language?:       'he' | 'en';
}

export function buildEGiftReceipt(p: EGiftReceiptParams): string {
  const { net, vat, gross } = vatBreakdown(p.giftAmountIls);
  const isHe = (p.language ?? 'he') === 'he';

  const body = `
    <!-- GIFT CARD HERO -->
    <tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,${SURFACE} 50%,#0a0a0a 100%);padding:0 40px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td colspan="2" style="padding-bottom:20px;">
            <div style="font-size:11px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;margin-bottom:8px;">🎁 כרטיס מתנה / E-Gift Card</div>
            <div style="font-size:32px;font-weight:700;color:#fff;letter-spacing:-1px;">${fmtIls(gross)}</div>
            <div style="font-size:11px;color:#666;margin-top:4px;">מסופק מיידית • Digital delivery</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- TRANSACTION DETAILS -->
    <tr><td style="background:${DARK};padding:28px 40px;">
      <div style="font-size:10px;letter-spacing:2px;color:${GOLD};text-transform:uppercase;margin-bottom:16px;">פרטי עסקה — Transaction Details</div>
      <table width="100%" cellpadding="0" cellspacing="0" dir="rtl">
        ${infoRow('מס׳ חשבונית', 'Invoice No.', p.invoiceNo)}
        ${infoRow('מס׳ עסקה', 'Transaction ID', p.txId)}
        ${infoRow('תאריך', 'Date', fmtDate(p.date))}
        ${infoRow('קונה', 'Buyer', `${p.buyerName} &lt;${p.buyerEmail}&gt;`)}
        ${infoRow('מקבל', 'Recipient', p.recipientName)}
        ${infoRow('מק״ט שובר', 'Voucher ID', p.voucherId, true)}
        ${infoRow('תשלום', 'Payment', `${p.paymentBrand} ****${p.paymentLast4}`)}
      </table>
    </td></tr>

    ${p.personalMessage ? `
    <!-- PERSONAL MESSAGE -->
    <tr><td style="background:${SURFACE};padding:20px 40px;">
      <div style="font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase;margin-bottom:10px;">הודעה אישית / Personal Message</div>
      <div style="font-size:13px;color:#bbb;font-style:italic;line-height:1.6;border-right:3px solid ${GOLD};padding-right:14px;">"${p.personalMessage}"</div>
    </td></tr>` : ''}

    <!-- VAT BREAKDOWN — mandatory for Israeli tax law -->
    <tr><td style="background:${DARK};padding:28px 40px;border-top:1px solid ${BORDER};">
      <div style="font-size:10px;letter-spacing:2px;color:${GOLD};text-transform:uppercase;margin-bottom:16px;">פירוט מחיר — Price Breakdown</div>
      <table width="100%" cellpadding="0" cellspacing="0" dir="rtl">
        ${amountRow('מחיר לפני מע"מ', 'Net (ex. VAT)', fmtIls(net))}
        ${amountRow('מע"מ 18%', 'VAT 18%', fmtIls(vat))}
        ${amountRow('סה"כ לתשלום', 'Total Paid', fmtIls(gross), false, true)}
      </table>
    </td></tr>

    <!-- GIFT CARD VISUAL -->
    <tr><td style="background:${BLACK};padding:24px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td>
          <div style="background:linear-gradient(135deg,#111 0%,#1e1a0a 50%,#111 100%);border:1px solid ${BORDER};border-radius:16px;padding:28px 32px;">
            <div style="font-size:9px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;margin-bottom:16px;">🐾 PetWash™ E-Gift</div>
            <div style="font-size:28px;font-weight:700;color:${GOLD};">${fmtIls(gross)}</div>
            <div style="margin-top:16px;font-family:monospace;font-size:13px;color:#888;letter-spacing:3px;">${p.voucherId}</div>
            <div style="margin-top:8px;font-size:10px;color:#555;">תקף לכל השירותים ב-PetWash™ • Valid for all PetWash™ services</div>
          </div>
        </td></tr>
      </table>
    </td></tr>

    <!-- VAT LEGAL NOTE -->
    <tr><td style="background:${SURFACE};padding:16px 40px;border-top:1px solid ${BORDER};">
      <div style="font-size:9px;color:#555;line-height:1.7;text-align:right;">
        ⚠️ <strong style="color:#777;">הערת מס:</strong> מסמך זה כולל חשבונית מס קבלה בהתאם לחוק מע"מ.
        מע"מ בשיעור 18% כלול במחיר. ${BUSINESS_NAME_HE}, עוסק מורשה ${BUSINESS_REG}.
      </div>
    </td></tr>`;

  return emailShell(body, p.invoiceNo);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PROVIDER SERVICE TRANSACTION RECEIPT
// ═══════════════════════════════════════════════════════════════════════════════
export type ProviderServiceType = 'petsitter' | 'pet_walker' | 'academy' | 'petwash';

export interface ProviderTxReceiptParams {
  invoiceNo:       string;    // PW-INV-2026-003848
  txId:            string;
  date:            Date;
  serviceDate:     Date;
  serviceType:     ProviderServiceType;
  serviceDescHe:   string;    // e.g. "שמירה על חיות — 4 שעות"
  serviceDescEn:   string;    // e.g. "Pet Sitting — 4 hours"
  providerName:    string;    // מיכל כהן
  providerBizNo?:  string;    // עוסק מורשה / עוסק פטור of provider (if known)
  petName:         string;    // Max
  petBreed?:       string;    // German Shepherd
  customerName:    string;
  customerEmail:   string;
  grossChargedIls: number;    // what customer actually paid (incl. VAT)
  platformFeeRate: number;    // e.g. 0.15 (15%)
  paymentLast4:    string;
  paymentBrand:    string;
  durationLabel?:  string;    // "4 שעות", "60 דקות"
  language?:       'he' | 'en';
}

const SERVICE_ICONS: Record<ProviderServiceType, string> = {
  petsitter:   '🏠',
  pet_walker:  '🦮',
  academy:     '🎓',
  petwash:     '🚿',
};
const SERVICE_LABEL_HE: Record<ProviderServiceType, string> = {
  petsitter:   'שמירה על חיות',
  pet_walker:  'טיול כלבים',
  academy:     'אקדמיה לאילוף',
  petwash:     'שטיפת חיות מחמד',
};
const SERVICE_LABEL_EN: Record<ProviderServiceType, string> = {
  petsitter:   'Pet Sitting',
  pet_walker:  'Dog Walking',
  academy:     'Pet Academy Training',
  petwash:     'Pet Wash',
};

export function buildProviderTxReceipt(p: ProviderTxReceiptParams): string {
  const { net, vat, gross } = vatBreakdown(p.grossChargedIls);
  const platformFeeGross = +(p.grossChargedIls * p.platformFeeRate).toFixed(2);
  const platformFeeNet   = +(platformFeeGross / (1 + VAT_RATE)).toFixed(2);
  const platformFeeVat   = +(platformFeeGross - platformFeeNet).toFixed(2);
  const providerPayout   = +(p.grossChargedIls - platformFeeGross).toFixed(2);
  const icon = SERVICE_ICONS[p.serviceType];
  const labelHe = SERVICE_LABEL_HE[p.serviceType];
  const labelEn = SERVICE_LABEL_EN[p.serviceType];

  const body = `
    <!-- SERVICE HERO -->
    <tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,${SURFACE} 50%,#0a0a0a 100%);padding:0 40px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:11px;letter-spacing:3px;color:${GOLD};text-transform:uppercase;margin-bottom:8px;">${icon} ${labelHe} / ${labelEn}</div>
            <div style="font-size:32px;font-weight:700;color:#fff;letter-spacing:-1px;">${fmtIls(gross)}</div>
            <div style="font-size:11px;color:#666;margin-top:4px;">
              ${p.serviceDescHe} • ${p.durationLabel ?? ''}
            </div>
          </td>
          <td align="left" style="vertical-align:top;padding-top:8px;">
            <div style="background:rgba(198,163,91,0.1);border:1px solid ${BORDER};border-radius:12px;padding:12px 16px;text-align:center;">
              <div style="font-size:24px;">${icon}</div>
              <div style="font-size:9px;color:${GOLD};letter-spacing:1px;margin-top:4px;">SERVICE</div>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- TRANSACTION & SERVICE DETAILS -->
    <tr><td style="background:${DARK};padding:28px 40px;">
      <div style="font-size:10px;letter-spacing:2px;color:${GOLD};text-transform:uppercase;margin-bottom:16px;">פרטי עסקה — Transaction Details</div>
      <table width="100%" cellpadding="0" cellspacing="0" dir="rtl">
        ${infoRow('מס׳ חשבונית', 'Invoice No.', p.invoiceNo)}
        ${infoRow('מס׳ עסקה', 'Transaction ID', p.txId)}
        ${infoRow('תאריך הנפקה', 'Issued', fmtDate(p.date))}
        ${infoRow('תאריך שירות', 'Service Date', fmtDate(p.serviceDate))}
        ${infoRow('שירות', 'Service', `${p.serviceDescHe} / ${p.serviceDescEn}`)}
        ${infoRow('נותן שירות', 'Provider', p.providerName + (p.providerBizNo ? ` (ע.מ. ${p.providerBizNo})` : ''))}
        ${infoRow('חיית מחמד', 'Pet', `${p.petName}${p.petBreed ? ` — ${p.petBreed}` : ''}`)}
        ${infoRow('לקוח', 'Customer', `${p.customerName} &lt;${p.customerEmail}&gt;`)}
        ${infoRow('תשלום', 'Payment', `${p.paymentBrand} ****${p.paymentLast4}`)}
      </table>
    </td></tr>

    <!-- FULL PRICE BREAKDOWN (platform fee + provider payout + VAT) -->
    <tr><td style="background:${DARK};padding:28px 40px;border-top:1px solid ${BORDER};">
      <div style="font-size:10px;letter-spacing:2px;color:${GOLD};text-transform:uppercase;margin-bottom:16px;">פירוט מחיר מלא — Full Price Breakdown</div>
      <table width="100%" cellpadding="0" cellspacing="0" dir="rtl">

        <!-- Total charged -->
        ${amountRow('מחיר שירות לפני מע"מ', 'Service (net)', fmtIls(net))}
        ${amountRow('מע"מ 18%', 'VAT 18%', fmtIls(vat))}
        ${amountRow('סה"כ שולם', 'Total Paid', fmtIls(gross), true)}

        <!-- Spacer -->
        <tr><td colspan="2" style="height:16px;"></td></tr>
        <tr><td colspan="2">
          <div style="font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;border-top:1px dashed rgba(255,255,255,0.08);padding-top:12px;">עמלת פלטפורמה / Platform Commission</div>
        </td></tr>

        ${amountRow(`עמלת PetWash™ (${Math.round(p.platformFeeRate * 100)}%)`, `Platform fee`, fmtIls(platformFeeGross))}
        ${amountRow('מע"מ על עמלה', 'VAT on fee', fmtIls(platformFeeVat))}
        ${amountRow('תשלום לספק', 'Provider payout', fmtIls(providerPayout), false, true)}
      </table>
    </td></tr>

    <!-- PROVIDER PAYOUT SUMMARY BOX -->
    <tr><td style="background:${BLACK};padding:24px 40px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td>
          <div style="background:linear-gradient(135deg,#111 0%,#1a1a0e 100%);border:1px solid ${BORDER};border-radius:16px;padding:24px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:9px;letter-spacing:2px;color:${GOLD};text-transform:uppercase;margin-bottom:6px;">ספק שירות / Provider</div>
                  <div style="font-size:16px;font-weight:600;color:#eee;">${p.providerName}</div>
                  ${p.providerBizNo ? `<div style="font-size:10px;color:#666;margin-top:2px;">ע.מ. ${p.providerBizNo}</div>` : ''}
                </td>
                <td align="left">
                  <div style="font-size:9px;letter-spacing:2px;color:${GOLD};text-transform:uppercase;margin-bottom:6px;">יתרה לספק</div>
                  <div style="font-size:22px;font-weight:700;color:${GOLD};">${fmtIls(providerPayout)}</div>
                  <div style="font-size:9px;color:#555;">לאחר עמלת פלטפורמה</div>
                </td>
              </tr>
            </table>
          </div>
        </td></tr>
      </table>
    </td></tr>

    <!-- VAT LEGAL NOTE -->
    <tr><td style="background:${SURFACE};padding:16px 40px;border-top:1px solid ${BORDER};">
      <div style="font-size:9px;color:#555;line-height:1.7;text-align:right;">
        ⚠️ <strong style="color:#777;">הערת מס:</strong> מסמך זה מהווה חשבונית מס קבלה לפי חוק מע"מ.
        מע"מ 18% כלול במחיר הכולל. עמלת הפלטפורמה כוללת מע"מ. 
        ${BUSINESS_NAME_HE}, עוסק מורשה ${BUSINESS_REG}.
        הכנסת הספק ממוסה בנפרד ואינה כלולה בחשבונית זו.
      </div>
    </td></tr>`;

  return emailShell(body, p.invoiceNo);
}
