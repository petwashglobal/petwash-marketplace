/**
 * PetWash™ Provider Workflow Email Templates
 *
 * All 9 provider workflow emails — built on the unified brand shell.
 * Uses wrapEmailShell() from brand-identity.ts for consistent luxury white
 * rendering, legal footer, and ח.פ. compliance.
 *
 * Email family: provider_workflow — UNSUBSCRIBE FORBIDDEN on all.
 * Sender: SENDERS.provider — 'Pet Wash™ Providers' / noreply@petwash.co.il
 * Reply-To: support@petwash.co.il
 *
 * Templates:
 *   1. buildAdminReviewAlertEmail       — internal → support team (action required)
 *   2. buildResubmissionNeededEmail     — KYC auto → applicant (docs needed)
 *   3. buildKycApprovedEmail            — KYC auto → applicant (approved)
 *   4. buildKycRejectedEmail            — KYC auto → applicant (rejected)
 *   5. buildAdminApprovedEmail          — admin manual → applicant (approved)
 *   6. buildAdminRejectedEmail          — admin manual → applicant (rejected)
 *   7. buildAdminResubmitRequestEmail   — admin manual → applicant (resubmit request)
 *   8. buildSupportMessageEmail         — admin → applicant (support message)
 *   9. buildDocumentsReceivedEmail      — system → applicant (docs received ack)
 */

import {
  wrapEmailShell,
  SENDERS,
  DESIGN,
  LEGAL_NAME_HE,
  LEGAL_NAME_EN,
  COMPANY_TAX_ID,
  BRAND_NAME,
} from '../brand-identity';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const PROVIDER_FOOTER_OPTS = {
  includeUnsubscribe: false,
  includeAccessibility: true,
};

/** Gold category label used in all provider emails */
function categoryLabel(text: string): string {
  return `<p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;
    color:${DESIGN.gold};font-weight:600;margin:0 0 12px;
    font-family:${DESIGN.fontStack};">${text}</p>`;
}

/** Standard greeting block */
function greeting(firstName: string, language: 'he' | 'en' = 'he'): string {
  return `<p style="font-size:18px;font-weight:300;color:${DESIGN.black};
    margin:0 0 16px;font-family:${DESIGN.fontStack};line-height:1.4;">
    ${language === 'he' ? `שלום ${firstName},` : `Hello ${firstName},`}
  </p>`;
}

/** Standard body paragraph */
function para(text: string): string {
  return `<p style="font-size:15px;color:#4a4a4a;line-height:1.8;
    margin:0 0 14px;font-family:${DESIGN.fontStack};">${text}</p>`;
}

/** Monospace reference pill (application ID, provider ID) */
function refPill(label: string, value: string): string {
  return `<div style="display:inline-block;background:#f5f5f0;padding:6px 14px;
    border-radius:2px;margin:4px 0;font-family:'Courier New',monospace;
    font-size:12px;color:${DESIGN.black};">
    <span style="color:${DESIGN.grey};font-size:10px;text-transform:uppercase;
      letter-spacing:1px;">${label}:</span>
    &nbsp;${value}
  </div>`;
}

/** Black CTA button */
function ctaButton(label: string, href: string): string {
  return `<div style="margin:28px 0;">
    <a href="${href}"
       style="display:inline-block;background:${DESIGN.black};color:${DESIGN.gold};
              padding:14px 32px;font-size:12px;font-weight:600;letter-spacing:2px;
              text-transform:uppercase;text-decoration:none;border-radius:0;
              font-family:${DESIGN.fontStack};">
      ${label}
    </a>
  </div>`;
}

/** Support contact footer line */
function supportLine(language: 'he' | 'en' = 'he'): string {
  const text = language === 'he'
    ? 'שאלות? פנו אלינו בכתובת'
    : 'Questions? Contact us at';
  return `<p style="font-size:13px;color:${DESIGN.grey};margin:16px 0 0;
    font-family:${DESIGN.fontStack};">
    ${text} <a href="mailto:support@petwash.co.il"
    style="color:${DESIGN.grey};">support@petwash.co.il</a>
  </p>`;
}

/** Two-column data table used in KYC admin notifications */
function dataRow(label: string, value: string, shaded: boolean): string {
  const bg = shaded ? '#f9fafb' : '#ffffff';
  return `<tr>
    <td style="padding:10px 12px;background:${bg};font-weight:600;width:180px;
      font-size:13px;color:${DESIGN.black};font-family:${DESIGN.fontStack};
      border-bottom:1px solid ${DESIGN.divider};">${label}</td>
    <td style="padding:10px 12px;background:${bg};font-size:13px;
      color:#4a4a4a;font-family:${DESIGN.fontStack};
      border-bottom:1px solid ${DESIGN.divider};">${value}</td>
  </tr>`;
}

// ─── 1. Admin review alert (internal → support team) ─────────────────────────

export interface AdminReviewAlertParams {
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  phoneNumber: string;
  providerTypeLabel: string;
  faceScore: number;
  livenessScore: number;
  livenessPass: boolean;
  ocrConfidence: number;
  ocrFields: { nameDetected: boolean; birthDateDetected: boolean; expiryDateDetected: boolean; idNumberDetected: boolean };
  fraudRiskLevel: string;
  flagsHtml: string;
  reviewUrl: string;
}

export function buildAdminReviewAlertEmail(p: AdminReviewAlertParams): { subject: string; html: string } {
  const subject = `[ACTION REQUIRED] Provider review — ${p.applicantName} / ${p.applicationId}`;

  const fraudColor =
    p.fraudRiskLevel === 'low' ? '#059669' :
    p.fraudRiskLevel === 'medium' ? '#d97706' : '#dc2626';

  const ocrSummary = [
    `Name: ${p.ocrFields.nameDetected ? '✓' : '✗'}`,
    `DOB: ${p.ocrFields.birthDateDetected ? '✓' : '✗'}`,
    `Expiry: ${p.ocrFields.expiryDateDetected ? '✓' : '✗'}`,
    `ID#: ${p.ocrFields.idNumberDetected ? '✓' : '✗'}`,
  ].join(' &nbsp;|&nbsp; ');

  const bodyHtml = `
    ${categoryLabel('KYC2026 — Pending Review')}
    <p style="font-size:15px;color:#4a4a4a;line-height:1.8;margin:0 0 20px;font-family:${DESIGN.fontStack};">
      A provider application requires manual review. Please assess and take action within 48 hours.
    </p>

    <p style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${DESIGN.grey};
       font-weight:600;margin:0 0 6px;font-family:${DESIGN.fontStack};">Applicant</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid ${DESIGN.divider};margin-bottom:20px;">
      ${dataRow('Name', p.applicantName, false)}
      ${dataRow('Email', p.applicantEmail, true)}
      ${dataRow('Mobile', p.phoneNumber, false)}
      ${dataRow('Provider Type', p.providerTypeLabel, true)}
      ${dataRow('Application ID', `<span style="font-family:'Courier New',monospace;">${p.applicationId}</span>`, false)}
    </table>

    <p style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${DESIGN.grey};
       font-weight:600;margin:0 0 6px;font-family:${DESIGN.fontStack};">KYC Score Summary</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid ${DESIGN.divider};margin-bottom:20px;">
      ${dataRow('Face Match Score', `<strong>${p.faceScore.toFixed(1)}/100</strong>`, false)}
      ${dataRow('Liveness Score', `<strong>${p.livenessScore.toFixed(0)}%</strong> — ${p.livenessPass ? '&#10003; Passed' : '&#10007; Failed'}`, true)}
      ${dataRow('OCR Confidence', `<strong>${p.ocrConfidence.toFixed(0)}%</strong>`, false)}
      ${dataRow('OCR Fields', ocrSummary, true)}
      ${dataRow('Fraud Risk', `<strong style="color:${fraudColor};">${p.fraudRiskLevel.toUpperCase()}</strong>`, false)}
    </table>

    <p style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${DESIGN.grey};
       font-weight:600;margin:0 0 8px;font-family:${DESIGN.fontStack};">Review Flags</p>
    <ul style="margin:0 0 20px;padding-right:20px;font-size:13px;color:#4a4a4a;
       font-family:${DESIGN.fontStack};">${p.flagsHtml}</ul>

    ${ctaButton('Review Application', p.reviewUrl)}

    <p style="font-size:11px;color:${DESIGN.lightGrey};margin:20px 0 0;font-family:${DESIGN.fontStack};">
      Automated notification from the Pet Wash™ KYC2026 engine.
      ${LEGAL_NAME_HE} / ${LEGAL_NAME_EN} &mdash; ח.פ. ${COMPANY_TAX_ID}
    </p>`;

  const html = wrapEmailShell({
    title: subject,
    bodyHtml,
    language: 'en',
    footerOptions: PROVIDER_FOOTER_OPTS,
  });

  return { subject, html };
}

// ─── 2. Resubmission needed (KYC auto → applicant) ───────────────────────────

export interface ResubmissionNeededParams {
  firstName: string;
  applicationId: string;
  qualityIssues: string[];
  /** 1-based attempt count (1..3). Omit to hide the counter. */
  resubmissionCount?: number;
  language?: 'he' | 'en';
}

export function buildResubmissionNeededEmail(p: ResubmissionNeededParams): { subject: string; html: string } {
  const lang = p.language ?? 'he';
  const subject = lang === 'he'
    ? `נדרשים מסמכים נוספים — בקשה ${p.applicationId}`
    : `Additional documents needed — Application ${p.applicationId}`;

  const issuesList = p.qualityIssues.map(i =>
    `<li style="font-size:14px;color:#4a4a4a;line-height:1.8;font-family:${DESIGN.fontStack};">${i}</li>`
  ).join('');

  const bodyHtml = lang === 'he' ? `
    ${categoryLabel('עדכון בקשת ספק')}
    ${greeting(p.firstName, 'he')}
    ${para(`לא הצלחנו לאמת את בקשתך אוטומטית — תמונות המסמכים שהועלו לא היו ברורות מספיק.`)}
    ${para(`<strong>בעיות שזוהו:</strong>`)}
    <ul style="margin:0 0 16px;padding-right:20px;">${issuesList}</ul>
    ${para(`אנא העלה תמונות חדשות וברורות יותר של מסמך הזהות והסלפי שלך. ודא:`)}
    <ul style="margin:0 0 16px;padding-right:20px;">
      <li style="font-size:14px;color:#4a4a4a;line-height:1.8;font-family:${DESIGN.fontStack};">תאורה טובה — ללא צלליות או בוהק</li>
      <li style="font-size:14px;color:#4a4a4a;line-height:1.8;font-family:${DESIGN.fontStack};">הפנים שלך גלויים לחלוטין בסלפי</li>
      <li style="font-size:14px;color:#4a4a4a;line-height:1.8;font-family:${DESIGN.fontStack};">מסמך הזהות שטוח וכל הטקסט קריא</li>
    </ul>
    ${p.resubmissionCount !== undefined ? para(`ניסיון ${p.resubmissionCount} מתוך 3.`) : ''}
    ${refPill('מזהה בקשה', p.applicationId)}
    ${supportLine('he')}
  ` : `
    ${categoryLabel('Provider Application Update')}
    ${greeting(p.firstName, 'en')}
    ${para(`We were unable to process your provider application automatically — the uploaded document images were not clear enough.`)}
    ${para(`<strong>Issues detected:</strong>`)}
    <ul style="margin:0 0 16px;padding-left:20px;">${issuesList}</ul>
    ${para(`Please log back in and upload clearer photos of your ID document and selfie. Make sure:`)}
    <ul style="margin:0 0 16px;padding-left:20px;">
      <li style="font-size:14px;color:#4a4a4a;line-height:1.8;font-family:${DESIGN.fontStack};">Good lighting — no shadows or glare</li>
      <li style="font-size:14px;color:#4a4a4a;line-height:1.8;font-family:${DESIGN.fontStack};">Your full face is clearly visible in the selfie</li>
      <li style="font-size:14px;color:#4a4a4a;line-height:1.8;font-family:${DESIGN.fontStack};">The ID document is flat and all text is readable</li>
    </ul>
    ${p.resubmissionCount !== undefined ? para(`Attempt ${p.resubmissionCount} of 3.`) : ''}
    ${refPill('Application ID', p.applicationId)}
    ${supportLine('en')}
  `;

  const html = wrapEmailShell({
    title: subject,
    bodyHtml,
    language: lang,
    footerOptions: PROVIDER_FOOTER_OPTS,
  });

  return { subject, html };
}

// ─── 3. KYC auto-approved (→ applicant) ──────────────────────────────────────

export interface KycApprovedParams {
  firstName: string;
  applicationId: string;
  providerTypeLabel: string;
  language?: 'he' | 'en';
}

export function buildKycApprovedEmail(p: KycApprovedParams): { subject: string; html: string } {
  const lang = p.language ?? 'he';
  const subject = lang === 'he'
    ? 'בקשת הספק שלך אושרה — ברוך הבא ל-Pet Wash™'
    : 'Your provider application has been approved — Welcome to Pet Wash™';

  const bodyHtml = lang === 'he' ? `
    ${categoryLabel('בקשת ספק אושרה')}
    ${greeting(p.firstName, 'he')}
    ${para(`שמחים לבשר לך! בקשת הספק שלך כ<strong>${p.providerTypeLabel}</strong> ב-Pet Wash™ אושרה.`)}
    ${para(`חשבונך פעיל כעת. תוכל להתחבר ולהתחיל להגדיר את פרופיל הספק שלך.`)}
    ${refPill('מזהה בקשה', p.applicationId)}
    ${supportLine('he')}
  ` : `
    ${categoryLabel('Provider Application Approved')}
    ${greeting(p.firstName, 'en')}
    ${para(`Great news — your provider application as a <strong>${p.providerTypeLabel}</strong> on Pet Wash™ has been approved.`)}
    ${para(`Your account is now active. You can log in and start setting up your provider profile.`)}
    ${refPill('Application ID', p.applicationId)}
    ${supportLine('en')}
  `;

  const html = wrapEmailShell({
    title: subject,
    bodyHtml,
    language: lang,
    footerOptions: PROVIDER_FOOTER_OPTS,
  });

  return { subject, html };
}

// ─── 4. KYC auto-rejected (→ applicant) ──────────────────────────────────────

export interface KycRejectedParams {
  firstName: string;
  applicationId: string;
  language?: 'he' | 'en';
}

export function buildKycRejectedEmail(p: KycRejectedParams): { subject: string; html: string } {
  const lang = p.language ?? 'he';
  const subject = lang === 'he'
    ? 'עדכון על בקשת הספק שלך'
    : 'Update on your provider application';

  const bodyHtml = lang === 'he' ? `
    ${categoryLabel('עדכון בקשת ספק')}
    ${greeting(p.firstName, 'he')}
    ${para(`לאחר בחינת בקשת הספק שלך, לא הצלחנו לאשר אותה בשלב זה.`)}
    ${para(`אם אתה סבור שמדובר בטעות, או שברצונך להגיש מחדש עם מסמכים מעודכנים, צור עמנו קשר.`)}
    ${refPill('מזהה בקשה', p.applicationId)}
    ${supportLine('he')}
  ` : `
    ${categoryLabel('Provider Application Update')}
    ${greeting(p.firstName, 'en')}
    ${para(`After reviewing your provider application, we were unable to approve it at this time.`)}
    ${para(`If you believe this is an error or would like to reapply with updated documents, please contact us.`)}
    ${refPill('Application ID', p.applicationId)}
    ${supportLine('en')}
  `;

  const html = wrapEmailShell({
    title: subject,
    bodyHtml,
    language: lang,
    footerOptions: PROVIDER_FOOTER_OPTS,
  });

  return { subject, html };
}

// ─── 5. Admin manual approval (→ applicant) ──────────────────────────────────

export interface AdminApprovedParams {
  firstName: string;
  applicationId: string;
  providerId: string;
  providerTypeLabel: string;
  language?: 'he' | 'en';
}

export function buildAdminApprovedEmail(p: AdminApprovedParams): { subject: string; html: string } {
  const lang = p.language ?? 'he';
  const subject = lang === 'he'
    ? 'בקשת הספק שלך אושרה — ברוך הבא ל-Pet Wash™'
    : 'Your provider application has been approved — Welcome to Pet Wash™';

  const bodyHtml = lang === 'he' ? `
    ${categoryLabel('בקשת ספק אושרה')}
    ${greeting(p.firstName, 'he')}
    ${para(`שמחים לבשר לך! צוות Pet Wash™ אישר את בקשת הספק שלך כ<strong>${p.providerTypeLabel}</strong>.`)}
    ${para(`חשבונך פעיל כעת. תוכל להתחבר ולהתחיל להגדיר את פרופיל הספק שלך.`)}
    <div style="margin:16px 0;">
      ${refPill('מזהה בקשה', p.applicationId)}&nbsp;
      ${refPill('מזהה ספק', p.providerId)}
    </div>
    ${supportLine('he')}
  ` : `
    ${categoryLabel('Provider Application Approved')}
    ${greeting(p.firstName, 'en')}
    ${para(`Your provider application as a <strong>${p.providerTypeLabel}</strong> on Pet Wash™ has been approved by our team.`)}
    ${para(`Your account is now active. You can log in and start setting up your provider profile.`)}
    <div style="margin:16px 0;">
      ${refPill('Application ID', p.applicationId)}&nbsp;
      ${refPill('Provider ID', p.providerId)}
    </div>
    ${supportLine('en')}
  `;

  const html = wrapEmailShell({
    title: subject,
    bodyHtml,
    language: lang,
    footerOptions: PROVIDER_FOOTER_OPTS,
  });

  return { subject, html };
}

// ─── 6. Admin manual rejection (→ applicant) ─────────────────────────────────

export interface AdminRejectedParams {
  firstName: string;
  applicationId: string;
  rejectionReason?: string;
  language?: 'he' | 'en';
}

export function buildAdminRejectedEmail(p: AdminRejectedParams): { subject: string; html: string } {
  const lang = p.language ?? 'he';
  const subject = lang === 'he'
    ? 'עדכון על בקשת הספק שלך'
    : 'Update on your provider application';

  const reasonBlock = p.rejectionReason
    ? (lang === 'he'
        ? para(`<strong>סיבה:</strong> ${p.rejectionReason}`)
        : para(`<strong>Reason:</strong> ${p.rejectionReason}`))
    : '';

  const bodyHtml = lang === 'he' ? `
    ${categoryLabel('עדכון בקשת ספק')}
    ${greeting(p.firstName, 'he')}
    ${para(`לאחר בחינת בקשת הספק שלך על ידי הצוות שלנו, לא הצלחנו לאשר אותה בשלב זה.`)}
    ${reasonBlock}
    ${para(`אם אתה סבור שמדובר בטעות, או שברצונך להגיש מחדש עם מסמכים מעודכנים, צור עמנו קשר.`)}
    ${refPill('מזהה בקשה', p.applicationId)}
    ${supportLine('he')}
  ` : `
    ${categoryLabel('Provider Application Update')}
    ${greeting(p.firstName, 'en')}
    ${para(`After reviewing your provider application, our team was unable to approve it at this time.`)}
    ${reasonBlock}
    ${para(`If you believe this is an error or would like to reapply with updated documents, please contact us.`)}
    ${refPill('Application ID', p.applicationId)}
    ${supportLine('en')}
  `;

  const html = wrapEmailShell({
    title: subject,
    bodyHtml,
    language: lang,
    footerOptions: PROVIDER_FOOTER_OPTS,
  });

  return { subject, html };
}

// ─── 7. Admin resubmit request (admin manual → applicant) ────────────────────

export interface AdminResubmitRequestParams {
  firstName: string;
  applicationId: string;
  reasons: string[];
  uploadUrl: string;
  resubmissionCount: number;
  language?: 'he' | 'en';
}

export function buildAdminResubmitRequestEmail(p: AdminResubmitRequestParams): { subject: string; html: string } {
  const lang = p.language ?? 'he';
  const subject = lang === 'he'
    ? `נדרשים מסמכים מעודכנים — בקשה ${p.applicationId}`
    : `Updated documents required — Application ${p.applicationId}`;

  const reasonsList = p.reasons.map(r =>
    `<li style="font-size:14px;color:#4a4a4a;line-height:1.8;font-family:${DESIGN.fontStack};">${r}</li>`
  ).join('');

  const bodyHtml = lang === 'he' ? `
    ${categoryLabel('נדרש עדכון מסמכים')}
    ${greeting(p.firstName, 'he')}
    ${para(`הצוות שלנו בחן את בקשתך וזקוק לקבצים מוגדרים יותר.`)}
    ${para(`<strong>סיבות:</strong>`)}
    <ul style="margin:0 0 16px;padding-right:20px;">${reasonsList}</ul>
    ${para(`אנא העלה מסמכים מעודכנים באמצעות הקישור למטה. קישור זה תקף ל-5 ימים.`)}
    ${ctaButton('העלה מסמכים מעודכנים', p.uploadUrl)}
    ${para(`ניסיון ${p.resubmissionCount} מתוך 3.`)}
    ${refPill('מזהה בקשה', p.applicationId)}
    ${supportLine('he')}
  ` : `
    ${categoryLabel('Documents Update Required')}
    ${greeting(p.firstName, 'en')}
    ${para(`Our team has reviewed your provider application and needs you to re-upload clearer files.`)}
    ${para(`<strong>Reasons:</strong>`)}
    <ul style="margin:0 0 16px;padding-left:20px;">${reasonsList}</ul>
    ${para(`Please upload your updated documents using the link below. This link expires in 5 days.`)}
    ${ctaButton('Upload Updated Documents', p.uploadUrl)}
    ${para(`Attempt ${p.resubmissionCount} of 3.`)}
    ${refPill('Application ID', p.applicationId)}
    ${supportLine('en')}
  `;

  const html = wrapEmailShell({
    title: subject,
    bodyHtml,
    language: lang,
    footerOptions: PROVIDER_FOOTER_OPTS,
  });

  return { subject, html };
}

// ─── 8. Support message (admin → applicant) ───────────────────────────────────

export interface SupportMessageParams {
  firstName?: string;
  body: string;
  applicationId?: string;
  language?: 'he' | 'en';
}

export function buildSupportMessageEmail(p: SupportMessageParams): { subject: string; html: string } {
  const lang = p.language ?? 'he';
  const subject = lang === 'he'
    ? 'עדכון על בקשת הספק שלך'
    : 'Update on your provider application';

  const greetingBlock = p.firstName ? greeting(p.firstName, lang) : '';
  const refBlock = p.applicationId ? refPill(lang === 'he' ? 'מזהה בקשה' : 'Application ID', p.applicationId) : '';

  const bodyHtml = `
    ${categoryLabel(lang === 'he' ? 'עדכון מתמיכה' : 'Support Update')}
    ${greetingBlock}
    <div style="font-size:15px;color:#4a4a4a;line-height:1.8;margin:0 0 16px;
      font-family:${DESIGN.fontStack};">${p.body}</div>
    ${refBlock}
    ${supportLine(lang)}
  `;

  const html = wrapEmailShell({
    title: subject,
    bodyHtml,
    language: lang,
    footerOptions: PROVIDER_FOOTER_OPTS,
  });

  return { subject, html };
}

// ─── 9. Documents received acknowledgment (→ applicant) ──────────────────────

export interface DocumentsReceivedParams {
  firstName: string;
  applicationId: string;
  language?: 'he' | 'en';
}

export function buildDocumentsReceivedEmail(p: DocumentsReceivedParams): { subject: string; html: string } {
  const lang = p.language ?? 'he';
  const subject = lang === 'he'
    ? `מסמכים התקבלו — בקשה ${p.applicationId}`
    : `Documents received — Application ${p.applicationId}`;

  const bodyHtml = lang === 'he' ? `
    ${categoryLabel('מסמכים התקבלו')}
    ${greeting(p.firstName, 'he')}
    ${para(`קיבלנו את המסמכים המעודכנים שלך והתחלנו לאמת מחדש את בקשתך.`)}
    ${para(`נחזור אליך תוך 24 שעות.`)}
    ${refPill('מזהה בקשה', p.applicationId)}
    ${supportLine('he')}
  ` : `
    ${categoryLabel('Documents Received')}
    ${greeting(p.firstName, 'en')}
    ${para(`We received your updated documents and have begun re-verifying your application.`)}
    ${para(`You will hear from us within 24 hours.`)}
    ${refPill('Application ID', p.applicationId)}
    ${supportLine('en')}
  `;

  const html = wrapEmailShell({
    title: subject,
    bodyHtml,
    language: lang,
    footerOptions: PROVIDER_FOOTER_OPTS,
  });

  return { subject, html };
}

// ─── Sender identity exports ──────────────────────────────────────────────────

/** Use for all applicant-facing provider workflow emails */
export const PROVIDER_SENDER = SENDERS.provider;

/** Use for internal / support-facing emails */
export const PROVIDER_INTERNAL_SENDER = SENDERS.internal;
