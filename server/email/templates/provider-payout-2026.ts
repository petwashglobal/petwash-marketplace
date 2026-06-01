/**
 * PetWash™ — Provider Payout Email 2026
 *
 * Triggered: weekly (every Sunday) by ProviderPayoutService for all active providers
 * Audience: service provider (groomer, dog walker, sitter, K9000 operator)
 * Type: OPERATIONAL — no unsubscribe required
 * Includes: earnings summary, booking breakdown, commission deduction, net payout
 * Israeli law: payout treated as income; must show gross, commission, net
 */

import { PETWASH_LOGO_BASE64 } from './logo-base64';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL } from '@shared/support-contact';
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

// Brand tokens
const GOLD        = '#B8941F';
const GOLD_HERO   = '#C6A35B';
const BLACK       = '#111111';
const BODY_BG     = '#FFFFFF';
const STRIPE_BG   = '#F9F7F3';
const HEADER_BG   = '#0F0F0F';
const DIVIDER     = '#E8DEC8';
const TEXT_PRI    = '#111111';
const TEXT_SEC    = '#555555';
const TEXT_DIM    = '#888888';
const GOLD_FADE   = '#F5EDD8';
const SUCCESS_GRN = '#1A7A3F';
const DANGER_RED  = '#D32F2F';
const BUSINESS_HE = 'פט ווש בע"מ';
const BUSINESS_EN = 'Pet Wash Ltd';
const COMPANY_REG = '515895671';

function formatILS(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' });
}

export interface ProviderPayoutParams {
  providerName: string;
  providerEmail: string;
  providerId: string;
  providerType: 'groomer' | 'dog_walker' | 'sitter' | 'k9000_operator' | 'franchise';
  periodStart: string;
  periodEnd: string;
  bookings: Array<{
    date: string;
    serviceType: string;
    petName?: string;
    grossCents: number;
    commissionCents: number;
    netCents: number;
    status: string;
  }>;
  totalGrossCents: number;
  totalCommissionCents: number;
  totalBonusCents: number;
  totalDeductionsCents: number;
  netPayoutCents: number;
  commissionRatePercent: number;
  payoutMethod: string;
  bankLast4?: string;
  walletBalance?: number;
  loyaltyRating?: number;
  language?: string;
}

const PROVIDER_TYPE_LABELS: Record<string, { he: string; en: string }> = {
  groomer:       { he: 'גרומר',         en: 'Groomer' },
  dog_walker:    { he: 'מאהל כלבים',   en: 'Dog Walker' },
  sitter:        { he: 'שומר חיות',   en: 'Pet Sitter' },
  k9000_operator:{ he: 'מפעיל K9000',   en: 'K9000 Operator' },
  franchise:     { he: 'זכיין',       en: 'Franchise Owner' },
};

export function providerPayout(p: ProviderPayoutParams): string {
  const lang = p.language ?? 'he';
  const isHe = lang === 'he';
  const typeLabel = PROVIDER_TYPE_LABELS[p.providerType] ?? { he: p.providerType, en: p.providerType };
  const hasBonus = p.totalBonusCents > 0;
  const hasDeductions = p.totalDeductionsCents > 0;

  // Booking rows
  const bookingRows = p.bookings.map((b, i) => {
    const bg = i % 2 === 0 ? BODY_BG : STRIPE_BG;
    return `
    <tr style="background:${bg}">
      <td style="padding:9px 12px;font-size:12px;color:${TEXT_SEC};direction:rtl;border-bottom:1px solid #F0F0F0">
        ${formatDate(b.date)}
      </td>
      <td style="padding:9px 12px;font-size:12px;color:${TEXT_PRI};direction:rtl;border-bottom:1px solid #F0F0F0">
        ${b.serviceType}${b.petName ? ` — ${b.petName}` : ``}
      </td>
      <td style="padding:9px 8px;font-size:12px;color:${TEXT_PRI};white-space:nowrap;border-bottom:1px solid #F0F0F0">
        ${formatILS(b.grossCents)}
      </td>
      <td style="padding:9px 8px;font-size:12px;color:${DANGER_RED};white-space:nowrap;border-bottom:1px solid #F0F0F0">
        −${formatILS(b.commissionCents)}
      </td>
      <td style="padding:9px 8px;font-size:12px;font-weight:700;color:${SUCCESS_GRN};white-space:nowrap;border-bottom:1px solid #F0F0F0">
        ${formatILS(b.netCents)}
      </td>
    </tr>`;
  }).join(``);

  return `<!DOCTYPE html>
<html lang="${lang}" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${isHe ? `משכורת שבועית — Pet Wash™` : `Weekly Payout — Pet Wash™`}</title>
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
            <div style="color:${GOLD};font-size:18px;font-weight:700">
              ${isHe ? `תשלום שבועי — ${isHe ? typeLabel.he : typeLabel.en}` : `Weekly Payout — ${isHe ? typeLabel.he : typeLabel.en}`}
            </div>
            <div style="color:#aaa;font-size:12px;margin-top:4px">
              ${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}
            </div>
          </td>
          <td align="left" style="vertical-align:top">
            <div style="color:#888;font-size:11px;text-align:left;margin-bottom:4px">ID: ${p.providerId}</div>
            <div style="color:#fff;font-size:13px;font-weight:600;text-align:left">${p.providerName}</div>
            ${p.loyaltyRating ? `<div style="color:${GOLD};font-size:12px;text-align:left;margin-top:4px">★★★★★ ${p.loyaltyRating.toFixed(1)}</div>` : ``}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- PAYOUT SUMMARY CARDS -->
  <tr>
    <td style="padding:24px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="33%" style="padding:0 6px 0 0;vertical-align:top">
            <div style="background:${STRIPE_BG};border:1px solid ${DIVIDER};padding:16px;text-align:center">
              <div style="font-size:11px;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
                ${isHe ? `הכנסות גולמת` : 'Gross Earnings'}
              </div>
              <div style="font-size:22px;font-weight:700;color:${BLACK}">${formatILS(p.totalGrossCents)}</div>
            </div>
          </td>
          <td width="33%" style="padding:0 3px;vertical-align:top">
            <div style="background:${STRIPE_BG};border:1px solid ${DIVIDER};padding:16px;text-align:center">
              <div style="font-size:11px;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
                ${isHe ? `עמלה פלטפורם (${p.commissionRatePercent}%)` : `Commission (${p.commissionRatePercent}%)`}
              </div>
              <div style="font-size:22px;font-weight:700;color:${DANGER_RED}">−${formatILS(p.totalCommissionCents)}</div>
            </div>
          </td>
          <td width="33%" style="padding:0 0 0 6px;vertical-align:top">
            <div style="background:${GOLD_FADE};border:2px solid ${GOLD};padding:16px;text-align:center">
              <div style="font-size:11px;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
                ${isHe ? `נטו לתשלום` : 'Net Payout'}
              </div>
              <div style="font-size:26px;font-weight:700;color:${GOLD}">${formatILS(p.netPayoutCents)}</div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  ${hasBonus || hasDeductions ? `
  <tr>
    <td style="padding:16px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${hasBonus ? `<tr>
          <td style="padding:8px 0;font-size:13px;color:${SUCCESS_GRN};direction:rtl">
            + ${isHe ? `בונוס ותוספות` : 'Bonuses & extras'}: ${formatILS(p.totalBonusCents)}
          </td>
        </tr>` : ``}
        ${hasDeductions ? `<tr>
          <td style="padding:8px 0;font-size:13px;color:${DANGER_RED};direction:rtl">
            − ${isHe ? `נכויים` : 'Deductions'}: ${formatILS(p.totalDeductionsCents)}
          </td>
        </tr>` : ``}
      </table>
    </td>
  </tr>` : ``}

  <!-- BOOKING TABLE -->
  <tr>
    <td style="padding:24px 32px 0">
      <div style="font-size:12px;font-weight:700;color:${TEXT_DIM};letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;direction:rtl">
        ${isHe ? `פירוט הזמנות (${p.bookings.length})` : `Booking breakdown (${p.bookings.length})`}
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${DIVIDER}">
        <tr bgcolor="${HEADER_BG}">
          <td style="padding:10px 12px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase">
            ${isHe ? `תאריך` : 'DATE'}
          </td>
          <td style="padding:10px 12px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase">
            ${isHe ? `שירות` : 'SERVICE'}
          </td>
          <td style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;white-space:nowrap">
            ${isHe ? `גלמי` : 'GROSS'}
          </td>
          <td style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;white-space:nowrap">
            ${isHe ? `עמלה` : 'COMM.'}
          </td>
          <td style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;white-space:nowrap">
            ${isHe ? `נטו` : 'NET'}
          </td>
        </tr>
        ${bookingRows}
      </table>
    </td>
  </tr>

  <!-- PAYMENT METHOD -->
  <tr>
    <td style="padding:24px 32px;border-top:1px solid ${DIVIDER}">
      <div style="font-size:12px;font-weight:700;color:${TEXT_DIM};letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;direction:rtl">
        ${isHe ? `פרטי תשלום` : 'PAYMENT DETAILS'}
      </div>
      <div style="font-size:13px;color:${TEXT_PRI};direction:rtl">
        ${p.paymentMethod}${p.bankLast4 ? ` (**** ${p.bankLast4})` : ``}
      </div>
    </td>
  </tr>

  <!-- SUPPORT CTA -->
  <tr>
    <td style="padding:0 32px 28px;text-align:center">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto">
        <tr><td style="background:${BLACK}">
          <a href="${SUPPORT_WHATSAPP_URL}"
             style="display:inline-block;padding:14px 32px;color:${GOLD};font-size:13px;font-weight:700;
                    text-decoration:none;letter-spacing:2px;text-transform:uppercase">
            ${isHe ? `שאלות לגבי התשלום` : 'PAYOUT QUESTIONS'}
          </a>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- LEGAL FOOTER -->
  <tr>
    <td bgcolor="${HEADER_BG}" style="padding:20px 32px;text-align:center;background:${HEADER_BG}">
      <p style="margin:0 0 6px;font-size:11px;color:#888;direction:rtl">
        ${BUSINESS_HE} | ${BUSINESS_EN} | ח.פ. ${COMPANY_REG}
      </p>
      <p style="margin:0 0 4px;font-size:11px;color:#666">noreply@petwash.co.il | petwash.co.il</p>
      <p style="margin:0;font-size:10px;color:#555;direction:rtl">
        ${isHe ? 'הודעת תשלום עסקי. אין ביטול הרשמה.' : 'Operational payout notification. No unsubscribe required.'}
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
}
