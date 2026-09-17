/**
 * PetWash™ — payment confirmation (the maison letter).
 *
 * CEO 2026-09-17, on SUMIT's stock "חיוב שבוצע בהצלחה" mail: "make it LVMH-group
 * level". SUMIT's template can't be restyled, so Pet Wash sends its own
 * confirmation for every verified card payment.
 *
 * Direction: a fashion-house letter, not a dashboard. One narrow column, a
 * lot of white, the real logo, one gold hairline, the amount set in a serif
 * like a price on a card, a four-line ledger, one quiet button.
 *
 * Email-client rules (same as transaction-receipt-2026): white body (Gmail
 * strips backgrounds), tables only, inline styles, bgcolor on every cell,
 * web-safe fonts with Hebrew-capable fallbacks, hidden preheader.
 * Company identity comes from brand-identity.ts — never hard-coded.
 */
import {
  LEGAL_NAME_HE, LEGAL_NAME_EN, COMPANY_TAX_ID, COMPANY_ADDRESS_HE, COMPANY_ADDRESS_EN, DESIGN,
} from '../brand-identity';
import { PETWASH_LOGO_BASE64 } from './logo-base64';
import { SUPPORT_EMAIL } from '../../../shared/support-contact';

const INK = DESIGN.black;          // #1a1a1a
const GOLD = DESIGN.gold;          // #c9a96e — hairlines and the currency sign only
const MUTED = DESIGN.grey;         // #6b7280
const RULE = '#ece7dc';            // warm hairline, a step warmer than DESIGN.divider
const WHITE = DESIGN.white;

const SERIF = "Georgia, 'Times New Roman', 'David', 'Frank Ruehl', serif";
const SANS = DESIGN.fontStack;

export interface PaymentConfirmationInput {
  language?: 'he' | 'en' | string;
  customerName?: string | null;
  amountIls: number;
  cardLast4?: string | null;
  /** What was paid for, as the customer would name it. */
  itemDescription: string;
  paidAt: Date;
  /** Our reference (booking id / order number) — printed so support can find it. */
  reference: string;
  /** Link to the tax document, when one exists. */
  documentUrl?: string | null;
  /** e.g. "חשבונית מס/קבלה" — shown on the button when a document exists. */
  documentLabel?: string | null;
  /** Full button text, when "View <label>" doesn't read naturally. */
  buttonText?: string | null;
}

export interface BuiltEmail { subject: string; html: string; text: string }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function money(n: number, he: boolean): { whole: string; cents: string } {
  const fixed = (Math.round(n * 100) / 100).toFixed(2);
  const [w, c] = fixed.split('.');
  return { whole: Number(w).toLocaleString(he ? 'he-IL' : 'en-IL'), cents: c };
}

function when(d: Date, he: boolean): string {
  return d.toLocaleString(he ? 'he-IL' : 'en-GB', {
    timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function buildPaymentConfirmationEmail(input: PaymentConfirmationInput): BuiltEmail {
  const he = String(input.language || 'he').slice(0, 2) !== 'en';
  const dir = he ? 'rtl' : 'ltr';
  const align = he ? 'right' : 'left';
  const opp = he ? 'left' : 'right';
  const name = (input.customerName || '').trim();
  const amt = money(input.amountIls, he);
  const card = input.cardLast4 ? `•••• ${esc(input.cardLast4)}` : (he ? 'כרטיס אשראי' : 'Credit card');

  const t = he
    ? {
        subject: `התשלום התקבל · ₪${amt.whole}.${amt.cents}`,
        preheader: `אישור תשלום מ־PetWash על סך ₪${amt.whole}.${amt.cents}.`,
        eyebrow: 'אישור תשלום',
        title: 'התשלום התקבל.',
        greeting: name ? `${esc(name)}, תודה.` : 'תודה.',
        lead: 'החיוב הושלם בהצלחה. פרטי העסקה שמורים אצלנו, וכאן לעיונך.',
        date: 'מועד', method: 'אמצעי תשלום', item: 'עבור', ref: 'אסמכתא',
        button: input.buttonText ? esc(input.buttonText) : input.documentLabel ? `לצפייה ב${esc(input.documentLabel)}` : 'לצפייה במסמך',
        noDoc: 'המסמך החשבונאי יישלח אליך בנפרד עם השלמת השירות.',
        help: 'שאלה על החיוב? נשמח לעזור',
        legal: `${LEGAL_NAME_HE} · ח.פ. ${COMPANY_TAX_ID} · ${COMPANY_ADDRESS_HE}`,
        why: 'הודעה זו נשלחה כי בוצע תשלום בחשבונך. אין צורך להשיב.',
      }
    : {
        subject: `Payment received · ₪${amt.whole}.${amt.cents}`,
        preheader: `Your PetWash payment of ₪${amt.whole}.${amt.cents} is confirmed.`,
        eyebrow: 'Payment confirmation',
        title: 'Payment received.',
        greeting: name ? `Thank you, ${esc(name)}.` : 'Thank you.',
        lead: 'Your payment went through. The details are kept on file and set out below.',
        date: 'Date', method: 'Paid with', item: 'For', ref: 'Reference',
        button: input.buttonText ? esc(input.buttonText) : input.documentLabel ? `View ${esc(input.documentLabel)}` : 'View document',
        noDoc: 'Your tax document will follow separately once the service is complete.',
        help: 'A question about this payment? We are here',
        legal: `${LEGAL_NAME_EN} · Company No. ${COMPANY_TAX_ID} · ${COMPANY_ADDRESS_EN}`,
        why: 'You are receiving this because a payment was made on your account. No reply is needed.',
      };

  const row = (label: string, value: string, last = false) => `
          <tr>
            <td bgcolor="${WHITE}" align="${align}" style="padding:14px 0;${last ? '' : `border-bottom:1px solid ${RULE};`}font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};white-space:nowrap;">${label}</td>
            <td bgcolor="${WHITE}" align="${opp}" style="padding:14px 0;${last ? '' : `border-bottom:1px solid ${RULE};`}font-family:${SANS};font-size:15px;color:${INK};">${value}</td>
          </tr>`;

  const cta = input.documentUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr><td bgcolor="${WHITE}" style="border:1px solid ${INK};">
            <a href="${esc(input.documentUrl)}" style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:${INK};text-decoration:none;">${t.button}</a>
          </td></tr>
        </table>`
    : `<p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.7;color:${MUTED};text-align:center;">${t.noDoc}</p>`;

  const html = `<!doctype html>
<html lang="${he ? 'he' : 'en'}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${t.subject}</title>
</head>
<body style="margin:0;padding:0;background:${WHITE};" bgcolor="${WHITE}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${WHITE};">${t.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${WHITE}" dir="${dir}">
  <tr><td bgcolor="${WHITE}" align="center" style="padding:48px 20px 56px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${WHITE}" style="max-width:560px;">

      <tr><td bgcolor="${WHITE}" align="center" style="padding:0 0 36px;">
        <img src="${PETWASH_LOGO_BASE64}" width="148" alt="PetWash" style="display:block;width:148px;max-width:148px;height:auto;border:0;">
      </td></tr>

      <tr><td bgcolor="${WHITE}" align="center" style="padding:0 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="${GOLD}" width="56" height="1" style="font-size:0;line-height:0;height:1px;">&nbsp;</td>
        </tr></table>
      </td></tr>

      <tr><td bgcolor="${WHITE}" align="center" style="padding:0 0 18px;font-family:${SANS};font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${MUTED};">${t.eyebrow}</td></tr>

      <tr><td bgcolor="${WHITE}" align="center" style="padding:0 0 28px;font-family:${SERIF};font-size:34px;line-height:1.2;font-weight:400;color:${INK};">${t.title}</td></tr>

      <tr><td bgcolor="${WHITE}" align="center" style="padding:0 0 6px;" dir="ltr">
        <span style="font-family:${SERIF};font-size:22px;color:${GOLD};vertical-align:top;line-height:1.9;">₪</span><span style="font-family:${SERIF};font-size:56px;line-height:1;color:${INK};letter-spacing:-1px;">${amt.whole}</span><span style="font-family:${SERIF};font-size:22px;color:${INK};vertical-align:top;line-height:1.9;">.${amt.cents}</span>
      </td></tr>

      <tr><td bgcolor="${WHITE}" align="center" style="padding:28px 24px 8px;font-family:${SERIF};font-size:18px;color:${INK};">${t.greeting}</td></tr>
      <tr><td bgcolor="${WHITE}" align="center" style="padding:0 32px 40px;font-family:${SANS};font-size:14px;line-height:1.75;color:${MUTED};">${t.lead}</td></tr>

      <tr><td bgcolor="${WHITE}" style="padding:0 0 44px;border-top:1px solid ${INK};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${WHITE}" dir="${dir}">
          ${row(t.date, esc(when(input.paidAt, he)))}
          ${row(t.method, `<span dir="ltr">${card}</span>`)}
          ${row(t.item, esc(input.itemDescription))}
          ${row(t.ref, `<span dir="ltr" style="font-family:'Courier New',Courier,monospace;font-size:13px;letter-spacing:1px;">${esc(input.reference)}</span>`, true)}
        </table>
      </td></tr>

      <tr><td bgcolor="${WHITE}" align="center" style="padding:0 0 56px;">${cta}</td></tr>

      <tr><td bgcolor="${WHITE}" align="center" style="padding:0 0 10px;font-family:${SANS};font-size:13px;color:${INK};">
        ${t.help} · <a href="mailto:${SUPPORT_EMAIL}" style="color:${INK};text-decoration:underline;text-decoration-color:${GOLD};">${SUPPORT_EMAIL}</a>
      </td></tr>

      <tr><td bgcolor="${WHITE}" align="center" style="padding:28px 0 0;border-top:1px solid ${RULE};font-family:${SANS};font-size:11px;line-height:1.8;color:${MUTED};">
        ${esc(t.legal)}<br>${t.why}
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    t.title,
    `₪${amt.whole}.${amt.cents}`,
    '',
    `${t.date}: ${when(input.paidAt, he)}`,
    `${t.method}: ${input.cardLast4 ? `**** ${input.cardLast4}` : card}`,
    `${t.item}: ${input.itemDescription}`,
    `${t.ref}: ${input.reference}`,
    input.documentUrl ? `${t.button}: ${input.documentUrl}` : t.noDoc,
    '',
    `${t.help}: ${SUPPORT_EMAIL}`,
    t.legal,
  ].join('\n');

  return { subject: t.subject, html, text };
}
