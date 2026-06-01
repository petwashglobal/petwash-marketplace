/**
 * PetWash™ — Shop Order Confirmation Email 2026
 * Triggered: immediately after successful shop checkout
 * Audience: customer (buyer) — TRANSACTIONAL, no unsubscribe
 * Design: Apple-receipt luxury — white body, gold accents, no purple
 */

import { PETWASH_LOGO_BASE64 } from './logo-base64';
import { SUPPORT_EMAIL, SUPPORT_PHONE as SUPPORT_PHONE_CONST, SUPPORT_WHATSAPP_URL } from '@shared/support-contact';
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

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
const VAT_RATE    = ISRAEL_VAT_RATE;
const BUSINESS_HE = 'פט ווש בע"מ';
const BUSINESS_EN = 'Pet Wash Ltd';
const COMPANY_REG = '515895671';

function formatILS(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' });
}

const DELIVERY_LABELS: Record<string, { he: string; en: string }> = {
  delivery:       { he: 'משלוח לבית',          en: 'Home delivery' },
  pickup_station: { he: 'איסוף מתחנת K9000',   en: 'Pickup at K9000 station' },
  pickup_groomer: { he: 'איסוף מגרומר',         en: 'Pickup at groomer' },
};
const PAYMENT_LABELS: Record<string, { he: string; en: string }> = {
  wallet:      { he: 'ארנק Pet Wash™', en: 'Pet Wash™ Wallet' },
  nayax:       { he: 'Nayax',          en: 'Nayax' },
  credit_card: { he: 'כרטיס אשראי',   en: 'Credit card' },
};

export interface ShopOrderConfirmationParams {
  orderId: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    name_he: string;
    name_en?: string;
    sku?: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
    variant_name_he?: string;
    images?: string[];
  }>;
  subtotalCents: number;
  discountCents: number;
  deliveryCents: number;
  giftWrapCents: number;
  netCents: number;
  vatCents: number;
  totalCents: number;
  paymentMethod: string;
  deliveryMethod: string;
  estimatedDelivery?: string;
  deliveryAddress?: { fullName: string; street: string; city: string; zipCode?: string; phone?: string } | null;
  couponCode?: string;
  language?: string;
  orderDate: string;
}

export function shopOrderConfirmation(p: ShopOrderConfirmationParams): string {
  const lang = p.language ?? 'he';
  const isHe = lang === 'he';
  const deliveryLabel = DELIVERY_LABELS[p.deliveryMethod] ?? { he: p.deliveryMethod, en: p.deliveryMethod };
  const paymentLabel  = PAYMENT_LABELS[p.paymentMethod]  ?? { he: p.paymentMethod,  en: p.paymentMethod };

  const itemRows = p.items.map((item, i) => {
    const bg = i % 2 === 0 ? BODY_BG : STRIPE_BG;
    return `
    <tr style="background:${bg}">
      <td style="padding:12px 8px;vertical-align:middle;direction:rtl">
        <div style="font-size:14px;font-weight:600;color:${TEXT_PRI}">${item.name_he}</div>
        ${item.name_en ? `<div style="font-size:11px;color:${TEXT_DIM}">${item.name_en}</div>` : ''}
        ${item.variant_name_he ? `<div style="font-size:11px;color:${TEXT_SEC}">• ${item.variant_name_he}</div>` : ''}
      </td>
      <td align="center" style="padding:12px 8px;width:48px">
        <span style="font-size:13px;color:${TEXT_SEC};border:1px solid ${DIVIDER};padding:2px 8px">${item.quantity}</span>
      </td>
      <td style="padding:12px 8px;white-space:nowrap;width:80px">
        <span style="font-size:13px;color:${TEXT_PRI}">${formatILS(item.unit_price_cents)}</span>
      </td>
      <td style="padding:12px 8px;white-space:nowrap;width:80px">
        <span style="font-size:14px;font-weight:700;color:${BLACK}">${formatILS(item.line_total_cents)}</span>
      </td>
    </tr>`;
  }).join('');

  const addrBlock = p.deliveryAddress ? `
    <div style="margin-top:16px;padding:16px;background:${STRIPE_BG};border:1px solid ${DIVIDER};direction:rtl">
      <div style="font-size:12px;font-weight:700;color:${TEXT_DIM};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
        ${isHe ? 'כתובת למשלוח' : 'Delivery Address'}
      </div>
      <div style="font-size:14px;color:${TEXT_PRI};line-height:1.6">
        ${p.deliveryAddress.fullName}<br/>
        ${p.deliveryAddress.street}<br/>
        ${p.deliveryAddress.city}${p.deliveryAddress.zipCode ? ', ' + p.deliveryAddress.zipCode : ''}
      </div>
    </div>` : '';

  const couponRow = (p.couponCode && p.discountCents > 0) ? `
    <tr>
      <td style="padding:8px 0;direction:rtl"><span style="font-size:13px;color:${SUCCESS_GRN}">
        ${isHe ? 'קופון' : 'Coupon'}: ${p.couponCode}</span></td>
      <td style="padding:8px 0"><span style="font-size:13px;color:${SUCCESS_GRN}">− ${formatILS(p.discountCents)}</span></td>
    </tr>` : '';

  const giftRow = p.giftWrapCents > 0 ? `
    <tr>
      <td style="padding:8px 0;direction:rtl"><span style="font-size:13px;color:${TEXT_SEC}">🎁 ${isHe ? 'עטיפת מתנה' : 'Gift wrap'}</span></td>
      <td style="padding:8px 0"><span style="font-size:13px">${formatILS(p.giftWrapCents)}</span></td>
    </tr>` : '';

  const deliveryRow = `
    <tr>
      <td style="padding:8px 0;direction:rtl"><span style="font-size:13px;color:${TEXT_SEC}">${isHe ? deliveryLabel.he : deliveryLabel.en}</span></td>
      <td style="padding:8px 0"><span style="font-size:13px">${p.deliveryCents === 0 ? `<span style="color:${SUCCESS_GRN}">חינם / Free</span>` : formatILS(p.deliveryCents)}</span></td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="${lang}" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${isHe ? `אישור הזמנה #${p.orderId}` : `Order Confirmation #${p.orderId}`} — Pet Wash™</title>
</head>
<body style="margin:0;padding:0;background:${BODY_BG}">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="${BODY_BG}">
<tr><td align="center" style="padding:24px 8px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;border:1px solid ${DIVIDER}">

  <!-- HEADER -->
  <tr>
    <td bgcolor="${HEADER_BG}" style="padding:28px 32px;text-align:center">
      <img src="${PETWASH_LOGO_BASE64}" width="140" alt="Pet Wash™" style="display:block;margin:0 auto 16px"/>
      <div style="color:#fff;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px">
        ${isHe ? 'אישור הזמנה' : 'ORDER CONFIRMATION'}
      </div>
      <div style="color:${GOLD_HERO};font-size:22px;font-weight:700;letter-spacing:1px">#${p.orderId}</div>
      <div style="color:#aaa;font-size:12px;margin-top:6px">${formatDate(p.orderDate)}</div>
    </td>
  </tr>

  <!-- STATUS PILL -->
  <tr>
    <td style="padding:20px 32px;text-align:center">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto">
        <tr><td style="background:${SUCCESS_GRN};border-radius:24px;padding:10px 28px">
          <span style="color:#fff;font-size:14px;font-weight:700;letter-spacing:1px">✓ ${isHe ? 'הזמנה אושרה' : 'ORDER CONFIRMED'}</span>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- GREETING -->
  <tr>
    <td style="padding:0 32px 24px;direction:rtl">
      <p style="font-size:16px;font-weight:600;color:${TEXT_PRI};margin:0 0 8px">
        ${isHe ? `שלום ${p.customerName}! 🐾` : `Hello ${p.customerName}! 🐾`}
      </p>
      <p style="font-size:14px;color:${TEXT_SEC};line-height:1.6;margin:0">
        ${isHe ? 'ההזמנה שלך התקבלה בהצלחה ואנו כבר מכינים אותה לשילוח.' : 'Your order has been confirmed and we are already preparing it for shipment.'}
      </p>
    </td>
  </tr>

  <!-- ITEMS TABLE -->
  <tr>
    <td style="padding:0 32px 24px">
      <div style="font-size:12px;font-weight:700;color:${TEXT_DIM};letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;direction:rtl">
        ${isHe ? 'פריטים שהוזמנו' : 'ITEMS ORDERED'}
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${DIVIDER}">
        <tr bgcolor="${HEADER_BG}">
          <td style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase;direction:rtl">${isHe ? 'פריט' : 'ITEM'}</td>
          <td align="center" width="48" style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase">${isHe ? 'כמות' : 'QTY'}</td>
          <td width="80" style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase">${isHe ? 'יחידה' : 'UNIT'}</td>
          <td width="80" style="padding:10px 8px;font-size:11px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase">${isHe ? 'סה"כ' : 'TOTAL'}</td>
        </tr>
        ${itemRows}
      </table>
    </td>
  </tr>

  <!-- TOTALS -->
  <tr>
    <td style="padding:0 32px 24px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${DIVIDER};padding-top:16px">
        <tr>
          <td style="padding:8px 0;direction:rtl"><span style="font-size:13px;color:${TEXT_SEC}">${isHe ? 'סכום ביניים' : 'Subtotal'}</span></td>
          <td style="padding:8px 0"><span style="font-size:13px;color:${TEXT_PRI}">${formatILS(p.subtotalCents)}</span></td>
        </tr>
        ${couponRow}${deliveryRow}${giftRow}
        <tr>
          <td style="padding:8px 0;direction:rtl">
            <span style="font-size:12px;color:${TEXT_DIM}">${isHe ? `מע"מ (${Math.round(VAT_RATE*100)}%)` : `VAT (${Math.round(VAT_RATE*100)}%)`}</span>
            <br/><span style="font-size:10px;color:${TEXT_DIM}">${isHe ? 'כלול במחיר' : 'included'}</span>
          </td>
          <td style="padding:8px 0"><span style="font-size:12px;color:${TEXT_DIM}">${formatILS(p.vatCents)}</span></td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0;border-top:1px solid ${DIVIDER}"></td></tr>
        <tr style="background:${GOLD_FADE}">
          <td style="padding:14px 12px;direction:rtl">
            <span style="font-size:15px;font-weight:700;color:${BLACK}">${isHe ? 'סה"כ לתשלום' : 'TOTAL CHARGED'}</span>
          </td>
          <td style="padding:14px 12px">
            <span style="font-size:18px;font-weight:700;color:${GOLD}">${formatILS(p.totalCents)}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- PAYMENT & DELIVERY -->
  <tr>
    <td style="padding:0 32px 28px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${DIVIDER}">
        <tr>
          <td width="50%" style="padding:14px 16px;border-bottom:1px solid ${DIVIDER};border-left:1px solid ${DIVIDER};direction:rtl;vertical-align:top">
            <div style="font-size:11px;font-weight:700;color:${TEXT_DIM};letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">${isHe ? 'אמצעי תשלום' : 'Payment'}</div>
            <div style="font-size:13px;color:${TEXT_PRI}">${isHe ? paymentLabel.he : paymentLabel.en}</div>
          </td>
          <td width="50%" style="padding:14px 16px;border-bottom:1px solid ${DIVIDER};direction:rtl;vertical-align:top">
            <div style="font-size:11px;font-weight:700;color:${TEXT_DIM};letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">${isHe ? 'שיטת משלוח' : 'Delivery'}</div>
            <div style="font-size:13px;color:${TEXT_PRI}">${isHe ? deliveryLabel.he : deliveryLabel.en}</div>
          </td>
        </tr>
        ${p.estimatedDelivery ? `<tr><td colspan="2" style="padding:12px 16px;direction:rtl">
          <span style="font-size:13px;color:${SUCCESS_GRN};font-weight:600">📅 ${isHe ? 'תאריך אספקה משוער' : 'Estimated delivery'}: ${p.estimatedDelivery}</span>
        </td></tr>` : ''}
      </table>
      ${addrBlock}
    </td>
  </tr>

  <!-- SUPPORT CTA -->
  <tr>
    <td style="padding:0 32px 28px;text-align:center">
      <table cellpadding="0" cellspacing="0" style="margin:0 auto">
        <tr><td style="background:${BLACK}">
          <a href="${SUPPORT_WHATSAPP_URL}" style="display:inline-block;padding:14px 32px;color:${GOLD};font-size:13px;font-weight:700;text-decoration:none;letter-spacing:2px;text-transform:uppercase">
            ${isHe ? '💬 שירות לקוחות' : '💬 CUSTOMER SUPPORT'}
          </a>
        </td></tr>
      </table>
      <p style="margin:12px 0 0;font-size:12px;color:${TEXT_DIM}">${SUPPORT_EMAIL} | ${SUPPORT_PHONE_CONST}</p>
    </td>
  </tr>

  <!-- LEGAL FOOTER -->
  <tr>
    <td bgcolor="${HEADER_BG}" style="padding:20px 32px;text-align:center">
      <p style="margin:0 0 6px;font-size:11px;color:#888;direction:rtl">
        ${BUSINESS_HE} | ${BUSINESS_EN} | ח.פ. ${COMPANY_REG}
      </p>
      <p style="margin:0 0 6px;font-size:11px;color:#666">noreply@petwash.co.il | petwash.co.il</p>
      <p style="margin:0;font-size:10px;color:#555;direction:rtl">
        ${isHe ? 'זוהי הודעה עסקית. אין צורך בביטול הרשמה.' : 'Transactional message. No unsubscribe required.'}
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
                                                                                }
