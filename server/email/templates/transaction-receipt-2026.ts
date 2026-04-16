/**
 * PetWash™ — חשבונית מס קבלה / Tax Invoice-Receipt  v3
 *
 * Design strategy after testing:
 *   Gmail strips ALL background-color (CSS and bgcolor attribute) on body/wrapper tds.
 *   Dark-on-dark becomes invisible.  Solution: white body, black text, gold accents.
 *   Think: Apple receipt, Amex Centurion statement, Cartier invoice.
 *   The ONLY dark element is the branded header and the payout summary card.
 *
 * Email-client rules:
 *   ✓ White (#FFFFFF) body — survives every email client
 *   ✓ bgcolor="" attribute on EVERY <table> and <td>
 *   ✓ No min-height / vh — blank-top bug eliminated
 *   ✓ No @import — stripped by Gmail
 *   ✓ All text colors use high contrast on white (#111 / #333 / #555)
 *   ✓ Gold amounts readable on both white and dark backgrounds
 *   ✓ Hidden preheader prevents Gmail blank-top rendering
 *   ✓ Table-based layout only
 */

import { SUPPORT_EMAIL, SUPPORT_PHONE as SUPPORT_PHONE_CONST, SUPPORT_WHATSAPP_URL } from '../../../shared/support-contact';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const GOLD       = '#B8941F';   // readable on white AND dark
const GOLD_HERO  = '#C6A35B';   // large display amounts
const GOLD_BADGE = '#A07830';
const BLACK      = '#111111';
const BODY_BG    = '#FFFFFF';
const STRIPE_BG  = '#F9F7F3';   // warm off-white for alternating rows
const HEADER_BG  = '#0F0F0F';   // only the top header is dark
const CARD_BG    = '#1A1A1A';   // provider payout card
const DIVIDER    = '#E8DEC8';   // warm gold-tinted divider on white
const TEXT_HEAD  = '#FFFFFF';   // text on dark header
const TEXT_PRI   = '#111111';   // main body text on white
const TEXT_SEC   = '#555555';   // secondary labels
const TEXT_DIM   = '#888888';   // tertiary / English labels
const GOLD_FADE  = '#F5EDD8';   // background of total row highlight

// ─── Israeli legal constants ──────────────────────────────────────────────────
const VAT_RATE      = 0.18;
const BUSINESS_REG  = '515895671';
const BUSINESS_HE   = 'פט ווש בע"מ';
const BUSINESS_EN   = 'Pet Wash Ltd';

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

// ─── Shell ───────────────────────────────────────────────────────────────────
function shell(preheader: string, invoiceNo: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="x-apple-disable-message-reformatting">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>PetWash™ — חשבונית מס קבלה ${invoiceNo}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style type="text/css">
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}
body{margin:0!important;padding:0!important;background-color:#F0EBE0;}
@media only screen and (max-width:640px){
  .wrap{width:100%!important;}
  .pad{padding-left:20px!important;padding-right:20px!important;}
  .hero-amt{font-size:40px!important;line-height:1.1!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#F0EBE0;">

<!-- PREHEADER: hidden text forces Gmail to start render immediately, prevents blank-top -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F0EBE0;">
${preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;
</div>

<!-- OUTER CANVAS — warm parchment -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  bgcolor="#F0EBE0" style="background-color:#F0EBE0;">
<tr><td align="center" valign="top" bgcolor="#F0EBE0" style="background-color:#F0EBE0;padding:28px 16px 36px;">

  <!-- CARD — white, 600px -->
  <table class="wrap" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
    bgcolor="${BODY_BG}" style="background-color:${BODY_BG};max-width:600px;width:100%;
    box-shadow:0 4px 24px rgba(0,0,0,0.18);border-radius:2px;">

    <!-- GOLD TOP LINE -->
    <tr>
      <td height="5" bgcolor="${GOLD}" style="background-color:${GOLD};font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- DARK HEADER -->
    <tr>
      <td bgcolor="${HEADER_BG}" style="background-color:${HEADER_BG};padding:24px 36px 20px;" class="pad">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="middle">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9px;
                letter-spacing:3px;color:${GOLD_HERO};text-transform:uppercase;line-height:1.4;">
                חשבונית מס קבלה<br>
                <span style="color:#666666;letter-spacing:2px;">TAX INVOICE · RECEIPT</span>
              </p>
            </td>
            <td valign="middle" align="left" width="150">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:19px;
                font-weight:700;color:${GOLD_HERO};letter-spacing:-0.3px;">🐾 PetWash™</p>
              <p style="margin:2px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:8px;
                letter-spacing:2px;color:#444444;text-transform:uppercase;">PRESTIGE PLATFORM</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- CONFIRMED BADGE ROW -->
    <tr>
      <td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};padding:20px 36px 0;" class="pad">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${GOLD_BADGE}" style="background-color:${GOLD_BADGE};
              border-radius:3px;padding:7px 18px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;
                color:#FFFFFF;letter-spacing:1.5px;text-transform:uppercase;">
                &#10003;&nbsp; אושר ושולם &nbsp;·&nbsp; CONFIRMED &amp; PAID
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- BODY -->
    ${body}

    <!-- GOLD BOTTOM LINE -->
    <tr>
      <td height="5" bgcolor="${GOLD}" style="background-color:${GOLD};font-size:0;line-height:0;">&nbsp;</td>
    </tr>

  </table>
  <!-- /CARD -->

  <!-- LEGAL FOOTER (outside card, on parchment) -->
  <table class="wrap" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
    style="max-width:600px;width:100%;margin-top:20px;">
    <tr>
      <td style="padding:0 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td valign="top" style="padding-left:16px;border-right:2px solid ${DIVIDER};padding-right:0;">
              <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:8px;
                letter-spacing:2px;color:${TEXT_DIM};text-transform:uppercase;">פרטי עוסק</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;
                color:${TEXT_SEC};line-height:1.8;">${BUSINESS_HE} / ${BUSINESS_EN}<br>
                עוסק מורשה מס׳ ${BUSINESS_REG}<br>תל אביב, ישראל</p>
            </td>
            <td width="20">&nbsp;</td>
            <td valign="top" align="left">
              <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:8px;
                letter-spacing:2px;color:${TEXT_DIM};text-transform:uppercase;">יצירת קשר</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;
                color:${TEXT_SEC};line-height:1.8;">${SUPPORT_EMAIL}<br>${SUPPORT_PHONE_CONST}<br>
                <a href="https://petwash.co.il" style="color:${GOLD};text-decoration:none;">petwash.co.il</a>
              </p>
            </td>
          </tr>
        </table>
        <!-- Social Media Buttons -->
        <p style="margin:20px 0 10px;text-align:center;">
          <a href="https://www.instagram.com/petwashltd" target="_blank" style="display:inline-block;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;text-decoration:none;border-radius:6px;padding:7px 12px;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;margin:0 3px;">📷 Instagram</a>
          <a href="https://www.facebook.com/petwashltd" target="_blank" style="display:inline-block;background:#1877F2;color:#fff;text-decoration:none;border-radius:6px;padding:7px 12px;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;margin:0 3px;">f Facebook</a>
          <a href="https://www.tiktok.com/@petwashltd" target="_blank" style="display:inline-block;background:#010101;color:#fff;text-decoration:none;border-radius:6px;padding:7px 12px;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;margin:0 3px;border:1px solid #333;">♪ TikTok</a>
          <a href="${SUPPORT_WHATSAPP_URL}" target="_blank" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;border-radius:6px;padding:7px 12px;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;margin:0 3px;">💬 WhatsApp</a>
        </p>
        <p style="margin:8px 0 10px;text-align:center;">
          <a href="https://petwash.co.il/privacy" style="color:${TEXT_DIM};text-decoration:none;font-family:Arial,sans-serif;font-size:9px;margin:0 6px;">Privacy / פרטיות</a>
          <span style="color:${TEXT_DIM};font-size:9px;">·</span>
          <a href="https://petwash.co.il/terms" style="color:${TEXT_DIM};text-decoration:none;font-family:Arial,sans-serif;font-size:9px;margin:0 6px;">Terms / תנאי שימוש</a>
          <span style="color:${TEXT_DIM};font-size:9px;">·</span>
          <a href="mailto:${SUPPORT_EMAIL}" style="color:${TEXT_DIM};text-decoration:none;font-family:Arial,sans-serif;font-size:9px;margin:0 6px;">Contact / צור קשר</a>
        </p>
        <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:8.5px;
          color:${TEXT_DIM};line-height:1.7;text-align:center;">
          מסמך זה מהווה חשבונית מס קבלה לפי תקנות מס ערך מוסף (מע"מ), תשל"ו-1976.
          שמור/י מסמך זה לצורך דיווח לרשות המסים.<br>
          This document serves as a Tax Invoice-Receipt under Israeli VAT Regulations 1976. Retain for tax reporting.
        </p>
      </td>
    </tr>
  </table>

</td></tr>
</table>

</body>
</html>`;
}

// ─── Row helpers ─────────────────────────────────────────────────────────────
function detailRow(heLabel: string, enLabel: string, value: string, stripe = false): string {
  const bg = stripe ? STRIPE_BG : BODY_BG;
  return `<tr>
    <td bgcolor="${bg}" style="background-color:${bg};padding:0 36px;" class="pad">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border-bottom:1px solid ${DIVIDER};">
        <tr>
          <td style="padding:10px 0;width:55%;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;
              font-weight:600;color:${TEXT_PRI};">${heLabel}</span>
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;
              color:${TEXT_DIM};margin-right:5px;">${enLabel}</span>
          </td>
          <td align="left" style="padding:10px 0;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;
              color:${TEXT_SEC};">${value}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function amountRow(heLabel: string, enLabel: string, amount: string, isTotal = false): string {
  if (isTotal) {
    return `<tr>
      <td bgcolor="${GOLD_FADE}" style="background-color:${GOLD_FADE};padding:0 36px;" class="pad">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:14px 0;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;
                color:${TEXT_PRI};">${heLabel}</span>
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;
                color:${GOLD};margin-right:6px;">${enLabel}</span>
            </td>
            <td align="left" style="padding:14px 0;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;
                font-weight:700;color:${GOLD};">${amount}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  }
  return `<tr>
    <td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};padding:0 36px;" class="pad">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border-bottom:1px solid ${DIVIDER};">
        <tr>
          <td style="padding:9px 0;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;
              color:${TEXT_SEC};">${heLabel}</span>
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;
              color:${TEXT_DIM};margin-right:5px;">${enLabel}</span>
          </td>
          <td align="left" style="padding:9px 0;">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;
              font-weight:600;color:${TEXT_PRI};">${amount}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function sectionLabel(heText: string, enText: string): string {
  return `<tr>
    <td bgcolor="${STRIPE_BG}" style="background-color:${STRIPE_BG};
      padding:16px 36px 10px;border-top:2px solid ${DIVIDER};" class="pad">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9px;letter-spacing:2.5px;
        color:${GOLD};text-transform:uppercase;font-weight:700;">${heText} &nbsp;—&nbsp; ${enText}</p>
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
    <!-- HERO -->
    <tr>
      <td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};padding:28px 36px 24px;
        text-align:right;" class="pad">
        <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:9px;
          letter-spacing:2.5px;color:${GOLD};text-transform:uppercase;font-weight:700;">
          &#127873; כרטיס מתנה &nbsp;·&nbsp; E-GIFT CARD
        </p>
        <p class="hero-amt" style="margin:4px 0 0;font-family:Georgia,'Times New Roman',serif;
          font-size:52px;font-weight:700;color:${TEXT_PRI};letter-spacing:-2px;line-height:1.1;">
          ${ils(gross)}
        </p>
        <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;
          color:${TEXT_DIM};">מסופק מיידית &nbsp;·&nbsp; Instant digital delivery</p>
      </td>
    </tr>

    <!-- GOLD RULE -->
    <tr><td height="2" bgcolor="${GOLD}" style="background-color:${GOLD};font-size:0;">&nbsp;</td></tr>

    <!-- TRANSACTION DETAILS -->
    ${sectionLabel('פרטי עסקה', 'TRANSACTION DETAILS')}
    ${detailRow('מס׳ חשבונית', 'Invoice No.', `<strong>${p.invoiceNo}</strong>`, false)}
    ${detailRow('מס׳ עסקה', 'Transaction ID', p.txId, true)}
    ${detailRow('תאריך', 'Date', fmtDate(p.date), false)}
    ${detailRow('קונה', 'Buyer', `${p.buyerName}`, true)}
    ${detailRow('מקבל המתנה', 'Recipient', `<strong style="color:${TEXT_PRI};">${p.recipientName}</strong>`, false)}
    ${detailRow('מק״ט שובר', 'Voucher ID', `<strong style="color:${GOLD};font-family:'Courier New',monospace;">${p.voucherId}</strong>`, true)}
    ${detailRow('אמצעי תשלום', 'Payment', `${p.paymentBrand} ****${p.paymentLast4}`, false)}

    <!-- SPACER -->
    <tr><td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};height:8px;font-size:0;">&nbsp;</td></tr>

    ${p.personalMessage ? `
    <!-- PERSONAL MESSAGE -->
    <tr>
      <td bgcolor="${STRIPE_BG}" style="background-color:${STRIPE_BG};
        padding:16px 36px;border-top:2px solid ${DIVIDER};border-bottom:2px solid ${DIVIDER};" class="pad">
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;
          letter-spacing:2px;color:${GOLD};text-transform:uppercase;">&#128140; הודעה אישית · PERSONAL MESSAGE</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="3" bgcolor="${GOLD}" style="background-color:${GOLD};">&nbsp;</td>
            <td style="padding-right:14px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;
                color:${TEXT_PRI};font-style:italic;line-height:1.7;">"${p.personalMessage}"</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''}

    <!-- PRICE BREAKDOWN -->
    ${sectionLabel('פירוט מחיר', 'PRICE BREAKDOWN')}
    ${amountRow('מחיר לפני מע"מ', 'Net (ex. VAT)', ils(net))}
    ${amountRow('מע"מ 18%', 'VAT 18%', ils(vat))}
    ${amountRow('סה"כ שולם', 'TOTAL PAID', ils(gross), true)}

    <!-- SPACER -->
    <tr><td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};height:24px;font-size:0;">&nbsp;</td></tr>

    <!-- VOUCHER CARD -->
    <tr>
      <td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};padding:0 36px 32px;" class="pad">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};
              border-radius:8px;padding:24px 28px;border-right:4px solid ${GOLD};">
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:8px;
                letter-spacing:3px;color:${GOLD_HERO};text-transform:uppercase;">&#128062; PetWash™ E-Gift</p>
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;
                font-weight:700;color:${GOLD_HERO};">${ils(gross)}</p>
              <p style="margin:10px 0 0;font-family:'Courier New',Courier,monospace;font-size:11px;
                color:#666666;letter-spacing:2px;">${p.voucherId}</p>
              <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9px;
                color:#555555;">תקף לכל השירותים ב-PetWash™ &nbsp;·&nbsp; Valid for all PetWash™ services</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- VAT NOTE -->
    <tr>
      <td bgcolor="${STRIPE_BG}" style="background-color:${STRIPE_BG};
        padding:14px 36px;border-top:2px solid ${DIVIDER};" class="pad">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9px;
          color:${TEXT_DIM};line-height:1.7;text-align:right;">
          <strong style="color:${TEXT_SEC};">הערת מס:</strong>
          מסמך זה כולל חשבונית מס קבלה בהתאם לחוק מע"מ. מע"מ בשיעור 18% כלול במחיר.
          ${BUSINESS_HE}, עוסק מורשה ${BUSINESS_REG}.
        </p>
      </td>
    </tr>
  `;

  return shell(`כרטיס מתנה ${ils(gross)} ל-${p.recipientName} — אושר ושולם`, p.invoiceNo, body);
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
  petsitter:  '&#127968;', pet_walker: '&#128054;',
  academy:    '&#127891;', petwash:    '&#128701;',
};
const SVC_HE: Record<ProviderServiceType, string> = {
  petsitter: 'שמירה על חיות', pet_walker: 'טיול כלבים',
  academy:   'אקדמיה לאילוף', petwash:    'שטיפת חיות מחמד',
};
const SVC_EN: Record<ProviderServiceType, string> = {
  petsitter: 'PET SITTING',   pet_walker: 'DOG WALKING',
  academy:   'PET ACADEMY',   petwash:    'PET WASH',
};

export function buildProviderTxReceipt(p: ProviderTxReceiptParams): string {
  const { net, vat, gross } = vatBreakdown(p.grossChargedIls);
  const pfGross = +(p.grossChargedIls * p.platformFeeRate).toFixed(2);
  const pfVat   = +(pfGross - pfGross / (1 + VAT_RATE)).toFixed(2);
  const payout  = +(p.grossChargedIls - pfGross).toFixed(2);
  const icon    = SVC_ICON[p.serviceType];
  const labelHe = SVC_HE[p.serviceType];
  const labelEn = SVC_EN[p.serviceType];

  const body = `
    <!-- HERO -->
    <tr>
      <td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};padding:28px 36px 24px;
        text-align:right;" class="pad">
        <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:9px;
          letter-spacing:2.5px;color:${GOLD};text-transform:uppercase;font-weight:700;">
          ${icon} ${labelHe} &nbsp;·&nbsp; ${labelEn}
        </p>
        <p class="hero-amt" style="margin:4px 0 0;font-family:Georgia,'Times New Roman',serif;
          font-size:52px;font-weight:700;color:${TEXT_PRI};letter-spacing:-2px;line-height:1.1;">
          ${ils(gross)}
        </p>
        <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;
          color:${TEXT_DIM};">
          ${p.serviceDescHe}${p.durationLabel ? ` &nbsp;·&nbsp; ${p.durationLabel}` : ''}
        </p>
      </td>
    </tr>

    <!-- GOLD RULE -->
    <tr><td height="2" bgcolor="${GOLD}" style="background-color:${GOLD};font-size:0;">&nbsp;</td></tr>

    <!-- TRANSACTION DETAILS -->
    ${sectionLabel('פרטי עסקה', 'TRANSACTION DETAILS')}
    ${detailRow('מס׳ חשבונית', 'Invoice No.', `<strong>${p.invoiceNo}</strong>`, false)}
    ${detailRow('מס׳ עסקה', 'Transaction ID', p.txId, true)}
    ${detailRow('תאריך הנפקה', 'Issued', fmtDate(p.date), false)}
    ${detailRow('תאריך שירות', 'Service Date', fmtDate(p.serviceDate), true)}
    ${detailRow('שירות', 'Service', p.serviceDescHe, false)}
    ${detailRow('נותן שירות', 'Provider',
      `<strong style="color:${TEXT_PRI};">${p.providerName}</strong>${p.providerBizNo ? `<br><span style="font-size:10px;color:${TEXT_DIM};">ע.מ. ${p.providerBizNo}</span>` : ''}`, true)}
    ${detailRow('חיית מחמד', 'Pet', `${p.petName}${p.petBreed ? ` — ${p.petBreed}` : ''}`, false)}
    ${detailRow('לקוח', 'Customer', `${p.customerName} <span style="color:${TEXT_DIM};font-size:10px;">${p.customerEmail}</span>`, true)}
    ${detailRow('אמצעי תשלום', 'Payment', `${p.paymentBrand} ****${p.paymentLast4}`, false)}

    <!-- SPACER -->
    <tr><td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};height:8px;font-size:0;">&nbsp;</td></tr>

    <!-- PRICE BREAKDOWN -->
    ${sectionLabel('פירוט מחיר מלא', 'FULL PRICE BREAKDOWN')}
    ${amountRow('מחיר שירות לפני מע"מ', 'Net (ex. VAT)', ils(net))}
    ${amountRow('מע"מ 18%', 'VAT 18%', ils(vat))}
    ${amountRow('סה"כ שולם', 'TOTAL PAID', ils(gross), true)}

    <!-- PLATFORM FEE SUBSECTION -->
    <tr>
      <td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};padding:16px 36px 8px;" class="pad">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:8px;letter-spacing:2px;
          color:${TEXT_DIM};text-transform:uppercase;border-top:1px dashed ${DIVIDER};padding-top:14px;">
          עמלת פלטפורמה &nbsp;·&nbsp; PLATFORM COMMISSION
        </p>
      </td>
    </tr>
    ${amountRow(`עמלת PetWash™ (${Math.round(p.platformFeeRate * 100)}%)`, 'Platform fee', ils(pfGross))}
    ${amountRow('מע"מ על עמלה', 'VAT on fee', ils(pfVat))}
    ${amountRow('תשלום נטו לספק', 'PROVIDER PAYOUT', ils(payout), true)}

    <!-- SPACER -->
    <tr><td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};height:24px;font-size:0;">&nbsp;</td></tr>

    <!-- PROVIDER PAYOUT CARD -->
    <tr>
      <td bgcolor="${BODY_BG}" style="background-color:${BODY_BG};padding:0 36px 32px;" class="pad">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};
              border-radius:8px;padding:22px 28px;border-right:4px solid ${GOLD};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:8px;
                      letter-spacing:2px;color:${GOLD_HERO};text-transform:uppercase;">ספק שירות · PROVIDER</p>
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;
                      font-weight:700;color:#FFFFFF;">${p.providerName}</p>
                    ${p.providerBizNo ? `<p style="margin:2px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#666666;">ע.מ. ${p.providerBizNo}</p>` : ''}
                  </td>
                  <td valign="middle" align="left" width="160">
                    <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:8px;
                      letter-spacing:2px;color:${GOLD_HERO};text-transform:uppercase;">יתרה לספק</p>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;
                      font-weight:700;color:${GOLD_HERO};">${ils(payout)}</p>
                    <p style="margin:3px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9px;
                      color:#555555;">לאחר עמלת פלטפורמה</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- VAT NOTE -->
    <tr>
      <td bgcolor="${STRIPE_BG}" style="background-color:${STRIPE_BG};
        padding:14px 36px;border-top:2px solid ${DIVIDER};" class="pad">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:9px;
          color:${TEXT_DIM};line-height:1.7;text-align:right;">
          <strong style="color:${TEXT_SEC};">הערת מס:</strong>
          מסמך זה מהווה חשבונית מס קבלה לפי חוק מע"מ. מע"מ 18% כלול במחיר הכולל.
          עמלת הפלטפורמה כוללת מע"מ. ${BUSINESS_HE}, עוסק מורשה ${BUSINESS_REG}.
          הכנסת הספק ממוסה בנפרד ואינה כלולה בחשבונית זו.
        </p>
      </td>
    </tr>
  `;

  return shell(
    `${labelHe} — ${p.petName} עם ${p.providerName} — ${ils(gross)} אושר ושולם`,
    p.invoiceNo, body
  );
}
