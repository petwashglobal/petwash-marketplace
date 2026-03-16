/**
 * PetWash™ — חשבונית מס קבלה / Tax Invoice-Receipt  v2
 *
 * Email-client rules followed (Gmail, Apple Mail, Outlook):
 *   ✓ bgcolor="" attribute on every <table> and <td>  (not just CSS)
 *   ✓ No min-height / vh units  (Gmail ignores them, creates blank space)
 *   ✓ No @import  (stripped by Gmail before render)
 *   ✓ All CSS inline  (never in <style> block for critical properties)
 *   ✓ background-color: fallback before gradient  (Outlook safe)
 *   ✓ No rgba()  (replaced with solid hex)
 *   ✓ Hidden preheader  (prevents giant blank at top in Gmail app)
 *   ✓ Table-based layout only  (no flexbox, no grid)
 */

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const GOLD     = '#C6A35B';
const GOLD_LT  = '#E7C978';
const GOLD_DK  = '#A07830';
const BLACK    = '#0a0a0a';
const DARK     = '#111111';
const CARD     = '#181818';
const SECTION  = '#141414';
const DIVIDER  = '#2a2416';   // replaces rgba(gold, 0.25)
const TEXT_PRI = '#EEEEEE';
const TEXT_SEC = '#999999';
const TEXT_DIM = '#555555';

// ─── Israeli legal constants ──────────────────────────────────────────────────
const VAT_RATE      = 0.18;
const BUSINESS_REG  = '515895671';
const BUSINESS_HE   = 'פט ווש בע"מ';
const BUSINESS_EN   = 'Pet Wash Ltd';
const SUPPORT_EMAIL = 'support@petwash.co.il';
const SUPPORT_PHONE = '03-000-0000';

function vatBreakdown(gross: number) {
  const net = +(gross / (1 + VAT_RATE)).toFixed(2);
  const vat = +(gross - net).toFixed(2);
  return { net, vat, gross };
}

function ils(n: number): string {
  return `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Shared shell ─────────────────────────────────────────────────────────────
// The outer table MUST carry bgcolor for Gmail dark mode / light mode to work.
// No min-height, no vh, no @import — these all cause the blank-top bug.
function shell(preheaderText: string, invoiceNo: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="x-apple-disable-message-reformatting">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<title>PetWash™ — חשבונית מס קבלה ${invoiceNo}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; }
  body { margin: 0 !important; padding: 0 !important; background-color: ${BLACK}; }
  @media only screen and (max-width: 640px) {
    .email-container { width: 100% !important; }
    .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
    .hero-amount { font-size: 36px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BLACK};">

<!-- PREHEADER (hidden — prevents Gmail blank-top bug) -->
<div style="display:none;font-size:1px;color:${BLACK};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${preheaderText} — PetWash™ חשבונית מס קבלה ${invoiceNo}
</div>

<!-- OUTER WRAPPER — bgcolor attr required for Gmail -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  bgcolor="${BLACK}" style="background-color:${BLACK};">
  <tr>
    <td align="center" valign="top" style="background-color:${BLACK};padding:32px 16px;">

      <!-- INNER CARD — 620px max -->
      <table class="email-container" role="presentation" width="620" cellpadding="0" cellspacing="0" border="0"
        style="max-width:620px;width:100%;">

        <!-- ══ GOLD TOP LINE ══ -->
        <tr>
          <td height="4" style="background-color:${GOLD};font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- ══ HEADER ══ -->
        <tr>
          <td bgcolor="${DARK}" style="background-color:${DARK};padding:28px 40px 20px;" class="mobile-pad">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;
                    color:${GOLD};text-transform:uppercase;">חשבונית מס קבלה</p>
                  <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;
                    color:${TEXT_DIM};text-transform:uppercase;">TAX INVOICE — RECEIPT</p>
                </td>
                <td valign="middle" align="left" width="160">
                  <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;
                    color:${GOLD};letter-spacing:-0.5px;">🐾 PetWash™</p>
                  <p style="margin:3px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:3px;
                    color:${TEXT_DIM};text-transform:uppercase;">PRESTIGE PLATFORM</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ STATUS BADGE ══ -->
        <tr>
          <td bgcolor="${CARD}" style="background-color:${CARD};padding:16px 40px 20px;" class="mobile-pad">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="${GOLD_DK}" style="background-color:${GOLD_DK};border-radius:20px;padding:6px 20px;">
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;
                    color:#000000;letter-spacing:2px;text-transform:uppercase;">&#10003; אושר ושולם &nbsp;·&nbsp; CONFIRMED &amp; PAID</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ BODY CONTENT (injected) ══ -->
        ${body}

        <!-- ══ GOLD DIVIDER ══ -->
        <tr>
          <td height="1" bgcolor="${DIVIDER}" style="background-color:${DIVIDER};font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- ══ LEGAL FOOTER ══ -->
        <tr>
          <td bgcolor="${DARK}" style="background-color:${DARK};padding:28px 40px;" class="mobile-pad">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="top" style="padding-left:24px;border-left:none;border-right:2px solid ${DIVIDER};padding-right:0;padding-left:24px;">
                  <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;
                    color:${TEXT_DIM};text-transform:uppercase;">פרטי עוסק</p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;
                    color:${TEXT_SEC};line-height:1.8;">
                    ${BUSINESS_HE} / ${BUSINESS_EN}<br>
                    עוסק מורשה מס׳ ${BUSINESS_REG}<br>
                    תל אביב, ישראל
                  </p>
                </td>
                <td width="24">&nbsp;</td>
                <td valign="top" align="left">
                  <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;
                    color:${TEXT_DIM};text-transform:uppercase;">יצירת קשר</p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;
                    color:${TEXT_SEC};line-height:1.8;">
                    ${SUPPORT_EMAIL}<br>
                    ${SUPPORT_PHONE}<br>
                    <a href="https://petwash.co.il" style="color:${GOLD};text-decoration:none;">petwash.co.il</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ VAT LEGAL DISCLAIMER ══ -->
        <tr>
          <td bgcolor="${BLACK}" style="background-color:${BLACK};padding:16px 40px 20px;" class="mobile-pad">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:8.5px;color:${TEXT_DIM};
              line-height:1.7;text-align:center;">
              מסמך זה מהווה חשבונית מס קבלה לפי תקנות מס ערך מוסף (מע"מ), תשל"ו-1976.
              שמור/י מסמך זה לצורך דיווח לרשות המסים.<br>
              <span style="color:#333333;">This document serves as a Tax Invoice-Receipt under Israeli VAT Regulations 1976. Retain for tax reporting.</span>
            </p>
          </td>
        </tr>

        <!-- ══ GOLD BOTTOM LINE ══ -->
        <tr>
          <td height="4" style="background-color:${GOLD};font-size:0;line-height:0;">&nbsp;</td>
        </tr>

      </table>
      <!-- /INNER CARD -->

    </td>
  </tr>
</table>
<!-- /OUTER WRAPPER -->

</body>
</html>`;
}

// ─── Section helpers (email-safe) ────────────────────────────────────────────
function sectionHeader(heText: string, enText: string): string {
  return `<tr>
    <td bgcolor="${SECTION}" style="background-color:${SECTION};padding:20px 40px 12px;" class="mobile-pad">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:3px;
        color:${GOLD};text-transform:uppercase;">${heText} &nbsp;&#8212;&nbsp; ${enText}</p>
    </td>
  </tr>`;
}

function detailRow(heLabel: string, enLabel: string, value: string): string {
  return `<tr>
    <td bgcolor="${SECTION}" style="background-color:${SECTION};padding:0 40px;" class="mobile-pad">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border-bottom:1px solid ${DIVIDER};">
        <tr>
          <td style="padding:10px 0;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${TEXT_PRI};">${heLabel}</span>
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:${TEXT_DIM};margin-right:6px;">${enLabel}</span>
          </td>
          <td align="left" style="padding:10px 0;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${TEXT_SEC};">${value}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function amountRow(heLabel: string, enLabel: string, amount: string, isTotal = false): string {
  if (isTotal) {
    return `<tr>
      <td bgcolor="${CARD}" style="background-color:${CARD};padding:0 40px;" class="mobile-pad">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td colspan="2" height="1" style="background-color:${GOLD};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:14px 0 8px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${GOLD_LT};">${heLabel}</span>
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:${GOLD};margin-right:6px;opacity:0.7;">${enLabel}</span>
            </td>
            <td align="left" style="padding:14px 0 8px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:${GOLD};">${amount}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }
  return `<tr>
    <td bgcolor="${CARD}" style="background-color:${CARD};padding:0 40px;" class="mobile-pad">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border-bottom:1px solid ${DIVIDER};">
        <tr>
          <td style="padding:9px 0;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${TEXT_SEC};">${heLabel}</span>
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:${TEXT_DIM};margin-right:6px;">${enLabel}</span>
          </td>
          <td align="left" style="padding:9px 0;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_SEC};">${amount}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. E-GIFT CARD PURCHASE RECEIPT
// ═══════════════════════════════════════════════════════════════════════════════
export interface EGiftReceiptParams {
  invoiceNo:       string;
  txId:            string;
  date:            Date;
  buyerName:       string;
  buyerEmail:      string;
  recipientName:   string;
  giftAmountIls:   number;
  voucherId:       string;
  paymentLast4:    string;
  paymentBrand:    string;
  personalMessage?: string;
  language?:       'he' | 'en';
}

export function buildEGiftReceipt(p: EGiftReceiptParams): string {
  const { net, vat, gross } = vatBreakdown(p.giftAmountIls);

  const body = `
    <!-- HERO AMOUNT -->
    <tr>
      <td bgcolor="${BLACK}" style="background-color:${BLACK};padding:32px 40px 28px;text-align:right;" class="mobile-pad">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;
          color:${GOLD};text-transform:uppercase;">&#127873; כרטיס מתנה &nbsp;·&nbsp; E-GIFT CARD</p>
        <p class="hero-amount" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:52px;
          font-weight:700;color:#FFFFFF;letter-spacing:-2px;line-height:1;">${ils(gross)}</p>
        <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${TEXT_DIM};">
          מסופק מיידית &nbsp;·&nbsp; Instant digital delivery
        </p>
      </td>
    </tr>

    <!-- GOLD DIVIDER -->
    <tr><td height="1" bgcolor="${DIVIDER}" style="background-color:${DIVIDER};font-size:0;">&nbsp;</td></tr>

    <!-- TRANSACTION DETAILS HEADER -->
    ${sectionHeader('פרטי עסקה', 'TRANSACTION DETAILS')}

    <!-- DETAIL ROWS -->
    ${detailRow('מס׳ חשבונית', 'Invoice No.', p.invoiceNo)}
    ${detailRow('מס׳ עסקה', 'Transaction ID', p.txId)}
    ${detailRow('תאריך', 'Date', fmtDate(p.date))}
    ${detailRow('קונה', 'Buyer', `${p.buyerName} — ${p.buyerEmail}`)}
    ${detailRow('מקבל המתנה', 'Recipient', p.recipientName)}
    ${detailRow('מק״ט שובר', 'Voucher ID', `<strong style="color:${GOLD_LT};">${p.voucherId}</strong>`)}
    ${detailRow('אמצעי תשלום', 'Payment', `${p.paymentBrand} ****${p.paymentLast4}`)}

    <!-- SPACER -->
    <tr><td bgcolor="${SECTION}" style="background-color:${SECTION};height:12px;font-size:0;">&nbsp;</td></tr>
    <tr><td height="1" bgcolor="${DIVIDER}" style="background-color:${DIVIDER};font-size:0;">&nbsp;</td></tr>

    ${p.personalMessage ? `
    <!-- PERSONAL MESSAGE -->
    <tr>
      <td bgcolor="${DARK}" style="background-color:${DARK};padding:20px 40px;" class="mobile-pad">
        <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2px;
          color:${TEXT_DIM};text-transform:uppercase;">&#128140; הודעה אישית &nbsp;·&nbsp; PERSONAL MESSAGE</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="3" bgcolor="${GOLD}" style="background-color:${GOLD};">&nbsp;</td>
            <td style="padding-right:16px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;
                color:${TEXT_PRI};font-style:italic;line-height:1.7;">"${p.personalMessage}"</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td height="1" bgcolor="${DIVIDER}" style="background-color:${DIVIDER};font-size:0;">&nbsp;</td></tr>` : ''}

    <!-- PRICE BREAKDOWN HEADER -->
    <tr>
      <td bgcolor="${CARD}" style="background-color:${CARD};padding:20px 40px 12px;" class="mobile-pad">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:3px;
          color:${GOLD};text-transform:uppercase;">פירוט מחיר &nbsp;&#8212;&nbsp; PRICE BREAKDOWN</p>
      </td>
    </tr>

    ${amountRow('מחיר לפני מע"מ', 'Net (ex. VAT)', ils(net))}
    ${amountRow('מע"מ 18%', 'VAT 18%', ils(vat))}
    ${amountRow('סה"כ שולם', 'TOTAL PAID', ils(gross), true)}

    <tr><td bgcolor="${CARD}" style="background-color:${CARD};height:20px;font-size:0;">&nbsp;</td></tr>
    <tr><td height="1" bgcolor="${DIVIDER}" style="background-color:${DIVIDER};font-size:0;">&nbsp;</td></tr>

    <!-- GIFT CARD VISUAL -->
    <tr>
      <td bgcolor="${BLACK}" style="background-color:${BLACK};padding:28px 40px;" class="mobile-pad">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${CARD}" style="background-color:${CARD};border-radius:12px;padding:28px 32px;
              border:1px solid ${DIVIDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:9px;
                      letter-spacing:3px;color:${GOLD};text-transform:uppercase;">&#128062; PetWash™ E-Gift</p>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:32px;
                      font-weight:700;color:${GOLD};">${ils(gross)}</p>
                    <p style="margin:12px 0 0;font-family:'Courier New',Courier,monospace;font-size:12px;
                      color:${TEXT_DIM};letter-spacing:3px;">${p.voucherId}</p>
                    <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9px;
                      color:${TEXT_DIM};">תקף לכל השירותים ב-PetWash™ &nbsp;·&nbsp; Valid for all PetWash™ services</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const preheader = `כרטיס מתנה ${ils(gross)} ל-${p.recipientName} אושר ושולם`;
  return shell(preheader, p.invoiceNo, body);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PROVIDER SERVICE TRANSACTION RECEIPT
// ═══════════════════════════════════════════════════════════════════════════════
export type ProviderServiceType = 'petsitter' | 'pet_walker' | 'academy' | 'petwash';

export interface ProviderTxReceiptParams {
  invoiceNo:       string;
  txId:            string;
  date:            Date;
  serviceDate:     Date;
  serviceType:     ProviderServiceType;
  serviceDescHe:   string;
  serviceDescEn:   string;
  providerName:    string;
  providerBizNo?:  string;
  petName:         string;
  petBreed?:       string;
  customerName:    string;
  customerEmail:   string;
  grossChargedIls: number;
  platformFeeRate: number;
  paymentLast4:    string;
  paymentBrand:    string;
  durationLabel?:  string;
  language?:       'he' | 'en';
}

const SVC_ICON: Record<ProviderServiceType, string> = {
  petsitter:  '&#127968;',
  pet_walker: '&#128054;',
  academy:    '&#127891;',
  petwash:    '&#128701;',
};
const SVC_HE: Record<ProviderServiceType, string> = {
  petsitter:  'שמירה על חיות',
  pet_walker: 'טיול כלבים',
  academy:    'אקדמיה לאילוף',
  petwash:    'שטיפת חיות מחמד',
};
const SVC_EN: Record<ProviderServiceType, string> = {
  petsitter:  'PET SITTING',
  pet_walker: 'DOG WALKING',
  academy:    'PET ACADEMY',
  petwash:    'PET WASH',
};

export function buildProviderTxReceipt(p: ProviderTxReceiptParams): string {
  const { net, vat, gross } = vatBreakdown(p.grossChargedIls);
  const pfGross = +(p.grossChargedIls * p.platformFeeRate).toFixed(2);
  const pfNet   = +(pfGross / (1 + VAT_RATE)).toFixed(2);
  const pfVat   = +(pfGross - pfNet).toFixed(2);
  const payout  = +(p.grossChargedIls - pfGross).toFixed(2);
  const icon    = SVC_ICON[p.serviceType];
  const labelHe = SVC_HE[p.serviceType];
  const labelEn = SVC_EN[p.serviceType];

  const body = `
    <!-- HERO AMOUNT -->
    <tr>
      <td bgcolor="${BLACK}" style="background-color:${BLACK};padding:32px 40px 28px;text-align:right;" class="mobile-pad">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;
          color:${GOLD};text-transform:uppercase;">${icon} ${labelHe} &nbsp;·&nbsp; ${labelEn}</p>
        <p class="hero-amount" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:52px;
          font-weight:700;color:#FFFFFF;letter-spacing:-2px;line-height:1;">${ils(gross)}</p>
        <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${TEXT_DIM};">
          ${p.serviceDescHe}${p.durationLabel ? ` &nbsp;·&nbsp; ${p.durationLabel}` : ''}
        </p>
      </td>
    </tr>

    <!-- GOLD DIVIDER -->
    <tr><td height="1" bgcolor="${DIVIDER}" style="background-color:${DIVIDER};font-size:0;">&nbsp;</td></tr>

    <!-- TRANSACTION DETAILS -->
    ${sectionHeader('פרטי עסקה', 'TRANSACTION DETAILS')}

    ${detailRow('מס׳ חשבונית', 'Invoice No.', p.invoiceNo)}
    ${detailRow('מס׳ עסקה', 'Transaction ID', p.txId)}
    ${detailRow('תאריך הנפקה', 'Issued', fmtDate(p.date))}
    ${detailRow('תאריך שירות', 'Service Date', fmtDate(p.serviceDate))}
    ${detailRow('שירות', 'Service', `${p.serviceDescHe} / ${p.serviceDescEn}`)}
    ${detailRow('נותן שירות', 'Provider', p.providerName + (p.providerBizNo ? ` &nbsp;(ע.מ. ${p.providerBizNo})` : ''))}
    ${detailRow('חיית מחמד', 'Pet', `${p.petName}${p.petBreed ? ` — ${p.petBreed}` : ''}`)}
    ${detailRow('לקוח', 'Customer', `${p.customerName} — ${p.customerEmail}`)}
    ${detailRow('אמצעי תשלום', 'Payment', `${p.paymentBrand} ****${p.paymentLast4}`)}

    <tr><td bgcolor="${SECTION}" style="background-color:${SECTION};height:12px;font-size:0;">&nbsp;</td></tr>
    <tr><td height="1" bgcolor="${DIVIDER}" style="background-color:${DIVIDER};font-size:0;">&nbsp;</td></tr>

    <!-- PRICE BREAKDOWN HEADER -->
    <tr>
      <td bgcolor="${CARD}" style="background-color:${CARD};padding:20px 40px 12px;" class="mobile-pad">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:3px;
          color:${GOLD};text-transform:uppercase;">פירוט מחיר מלא &nbsp;&#8212;&nbsp; FULL PRICE BREAKDOWN</p>
      </td>
    </tr>

    ${amountRow('מחיר שירות לפני מע"מ', 'Net (ex. VAT)', ils(net))}
    ${amountRow('מע"מ 18%', 'VAT 18%', ils(vat))}
    ${amountRow('סה"כ שולם', 'TOTAL PAID', ils(gross), true)}

    <!-- PLATFORM FEE SUB-SECTION -->
    <tr>
      <td bgcolor="${CARD}" style="background-color:${CARD};padding:16px 40px 10px;" class="mobile-pad">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:2px;
          color:${TEXT_DIM};text-transform:uppercase;border-top:1px dashed ${DIVIDER};padding-top:14px;">
          עמלת פלטפורמה &nbsp;·&nbsp; PLATFORM COMMISSION
        </p>
      </td>
    </tr>

    ${amountRow(`עמלת PetWash™ (${Math.round(p.platformFeeRate * 100)}%)`, 'Platform fee', ils(pfGross))}
    ${amountRow('מע"מ על עמלה', 'VAT on fee', ils(pfVat))}
    ${amountRow('תשלום נטו לספק', 'PROVIDER PAYOUT', ils(payout), true)}

    <tr><td bgcolor="${CARD}" style="background-color:${CARD};height:20px;font-size:0;">&nbsp;</td></tr>
    <tr><td height="1" bgcolor="${DIVIDER}" style="background-color:${DIVIDER};font-size:0;">&nbsp;</td></tr>

    <!-- PROVIDER PAYOUT BOX -->
    <tr>
      <td bgcolor="${BLACK}" style="background-color:${BLACK};padding:28px 40px;" class="mobile-pad">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${CARD}" style="background-color:${CARD};border-radius:12px;
              border:1px solid ${DIVIDER};padding:24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:9px;
                      letter-spacing:2px;color:${GOLD};text-transform:uppercase;">ספק שירות &nbsp;·&nbsp; PROVIDER</p>
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;
                      font-weight:700;color:${TEXT_PRI};">${p.providerName}</p>
                    ${p.providerBizNo ? `<p style="margin:2px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:${TEXT_DIM};">ע.מ. ${p.providerBizNo}</p>` : ''}
                  </td>
                  <td valign="middle" align="left">
                    <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:9px;
                      letter-spacing:2px;color:${GOLD};text-transform:uppercase;">יתרה לספק</p>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;
                      font-weight:700;color:${GOLD};">${ils(payout)}</p>
                    <p style="margin:3px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9px;
                      color:${TEXT_DIM};">לאחר עמלת פלטפורמה</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const preheader = `${labelHe} — ${p.petName} עם ${p.providerName} — ${ils(gross)} אושר ושולם`;
  return shell(preheader, p.invoiceNo, body);
}
