/**
 * PetWash™ — "Please confirm end of stay" email (2026-08-18)
 *
 * Sent to the owner the moment the provider marks a booking as done
 * (booking_requests.status = 'provider_marked_complete'). Mirrors the
 * Rover / Mad Paws / WhatIDog benchmark: a single, prominent CTA that
 * deep-links to /booking/confirmation/:requestId where the owner
 * confirms the end of service and is then prompted to leave a review.
 *
 * Contract:
 *   • The CTA is the ONLY strong action on the page (no rebook, no upsell).
 *   • Bilingual HE + EN in one block; HE is primary per Israeli law.
 *   • No unsubscribe — this is a transactional booking-approval email.
 *   • Fail-soft: if the owner does nothing for 24h, the auto-approve cron
 *     (server/cron/auto-approve-completions.ts) fires the same money path.
 */

import { wrapEmailShell, DESIGN, BRAND_NAME } from '../brand-identity';

export interface ConfirmEndOfStayParams {
  language?: 'he' | 'en';
  bookingRef: string;
  firstName: string;
  providerName: string;
  serviceLabelHe: string;
  serviceLabelEn: string;
  petName?: string;
  /** e.g. '18 באוגוסט 2026' */
  endDateHe: string;
  /** e.g. 'Aug 18, 2026' */
  endDateEn: string;
  confirmUrl: string;
  autoApproveHours?: number;
}

export function buildConfirmEndOfStayEmail(p: ConfirmEndOfStayParams): string {
  const isHe = (p.language ?? 'he') === 'he';
  const autoApproveHours = p.autoApproveHours ?? 24;
  const align = isHe ? 'right' : 'left';

  const t = isHe
    ? {
        preheader: `${p.providerName} דיווח שהשירות עבור ${p.petName || 'חיית המחמד שלך'} הושלם — נשמח שתאשר/י`,
        headline: `ההזמנה שלך עם ${p.providerName} הסתיימה — נכון?`,
        lead: `כדי לסיים את ההזמנה, אנא אשר/י את סיום השירות. אישור זה ישחרר את התשלום ל${p.providerName}.`,
        ctaLabel: 'אשר/י סיום שירות',
        whatNextTitle: 'מה קורה עכשיו?',
        step1: `לחץ/י על "אשר/י סיום שירות" למטה.`,
        step2: `תוזמן/י לתת דירוג כוכבים וביקורת קצרה — זה עוזר להורי חיות אחרים לבחור את ${p.providerName}.`,
        autoNote: `אם לא נשמע ממך תוך ${autoApproveHours} שעות, ההזמנה תאושר אוטומטית ותשלום ישוחרר.`,
        detailsTitle: 'פרטי ההזמנה',
        service: 'שירות',
        pet: 'חיית המחמד',
        completedOn: 'תאריך סיום',
        ref: 'מזהה הזמנה',
        needHelpTitle: 'צריכ/ה עזרה?',
        needHelpBody: 'צוות PetWash™ זמין ב-support@petwash.co.il לכל שאלה או מחלוקת.',
      }
    : {
        preheader: `${p.providerName} marked ${p.petName || 'your pet'}'s service as done — please confirm`,
        headline: `Your booking with ${p.providerName} is complete — right?`,
        lead: `To finalise the booking, please confirm the end of service. This step will release the payment to ${p.providerName}.`,
        ctaLabel: 'Confirm end of service',
        whatNextTitle: 'What happens next?',
        step1: `Tap "Confirm end of service" below.`,
        step2: `You'll be asked to leave a star rating and a short review — it helps other pet parents choose ${p.providerName}.`,
        autoNote: `If we don't hear from you within ${autoApproveHours} hours, the booking is auto-approved and payment is released.`,
        detailsTitle: 'Booking details',
        service: 'Service',
        pet: 'Pet',
        completedOn: 'End date',
        ref: 'Booking ref',
        needHelpTitle: 'Need help?',
        needHelpBody: `PetWash™ support is available at support@petwash.co.il for any question or dispute.`,
      };

  const serviceLabel = isHe ? p.serviceLabelHe : p.serviceLabelEn;
  const endDate = isHe ? p.endDateHe : p.endDateEn;

  const bodyHtml = `
<!-- preheader (hidden preview text) -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:transparent;">
  ${t.preheader}
</div>

<h1 style="font-family:${DESIGN.fontStack};font-size:22px;line-height:1.35;color:${DESIGN.black};
           margin:0 0 12px;text-align:${align};font-weight:600;">
  ${t.headline}
</h1>

<p style="font-family:${DESIGN.fontStack};font-size:14px;line-height:1.7;color:${DESIGN.black};
          margin:0 0 24px;text-align:${align};">
  ${isHe ? 'שלום' : 'Hi'} ${p.firstName || (isHe ? 'הורה יקר' : 'there')},
</p>

<p style="font-family:${DESIGN.fontStack};font-size:14px;line-height:1.7;color:${DESIGN.black};
          margin:0 0 28px;text-align:${align};">
  ${t.lead}
</p>

<!-- CTA button -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 32px;">
  <tr>
    <td align="center" style="border-radius:2px;background:${DESIGN.ctaBg};">
      <a href="${p.confirmUrl}"
         style="display:inline-block;padding:16px 40px;font-family:${DESIGN.fontStack};
                font-size:14px;font-weight:600;color:${DESIGN.ctaText};text-decoration:none;
                letter-spacing:1px;text-transform:uppercase;">
        ${t.ctaLabel}
      </a>
    </td>
  </tr>
</table>

<!-- What happens next -->
<div style="background:#fafaf6;border-left:3px solid ${DESIGN.gold};padding:20px 24px;
            margin:0 0 24px;text-align:${align};">
  <p style="font-family:${DESIGN.fontStack};font-size:12px;font-weight:700;color:${DESIGN.black};
            margin:0 0 12px;letter-spacing:1px;text-transform:uppercase;">
    ${t.whatNextTitle}
  </p>
  <ol style="font-family:${DESIGN.fontStack};font-size:13px;line-height:1.7;color:${DESIGN.black};
             margin:0;padding-${isHe ? 'right' : 'left'}:20px;">
    <li style="margin-bottom:6px;">${t.step1}</li>
    <li>${t.step2}</li>
  </ol>
  <p style="font-family:${DESIGN.fontStack};font-size:12px;color:${DESIGN.grey};
            margin:14px 0 0;line-height:1.6;">
    ${t.autoNote}
  </p>
</div>

<!-- Booking details -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border-top:1px solid ${DESIGN.divider};margin-top:8px;">
  <tr>
    <td style="padding:20px 0 8px;font-family:${DESIGN.fontStack};font-size:11px;
               font-weight:700;color:${DESIGN.grey};letter-spacing:1px;text-transform:uppercase;
               text-align:${align};">
      ${t.detailsTitle}
    </td>
  </tr>
  <tr>
    <td style="padding:4px 0;font-family:${DESIGN.fontStack};font-size:13px;
               color:${DESIGN.black};text-align:${align};">
      <strong style="color:${DESIGN.grey};font-weight:500;">${t.service}:</strong> ${serviceLabel}
    </td>
  </tr>
  ${p.petName
    ? `<tr>
        <td style="padding:4px 0;font-family:${DESIGN.fontStack};font-size:13px;
                   color:${DESIGN.black};text-align:${align};">
          <strong style="color:${DESIGN.grey};font-weight:500;">${t.pet}:</strong> ${p.petName}
        </td>
      </tr>`
    : ''}
  <tr>
    <td style="padding:4px 0;font-family:${DESIGN.fontStack};font-size:13px;
               color:${DESIGN.black};text-align:${align};">
      <strong style="color:${DESIGN.grey};font-weight:500;">${t.completedOn}:</strong> ${endDate}
    </td>
  </tr>
  <tr>
    <td style="padding:4px 0 20px;font-family:${DESIGN.fontStack};font-size:13px;
               color:${DESIGN.black};text-align:${align};">
      <strong style="color:${DESIGN.grey};font-weight:500;">${t.ref}:</strong>
      <span style="font-family:'Courier New',monospace;">${p.bookingRef}</span>
    </td>
  </tr>
</table>

<!-- Need help -->
<div style="background:#fff;border:1px solid ${DESIGN.divider};padding:16px 20px;
            border-radius:2px;margin-top:8px;text-align:${align};">
  <p style="font-family:${DESIGN.fontStack};font-size:12px;font-weight:700;color:${DESIGN.black};
            margin:0 0 6px;letter-spacing:0.5px;">
    ${t.needHelpTitle}
  </p>
  <p style="font-family:${DESIGN.fontStack};font-size:12px;line-height:1.6;color:${DESIGN.grey};
            margin:0;">
    ${t.needHelpBody}
  </p>
</div>
`;

  return wrapEmailShell({
    title: t.headline,
    bodyHtml,
    language: isHe ? 'he' : 'en',
    footerOptions: { includeUnsubscribe: false },
  });
}
