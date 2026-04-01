/**
 * PetWash™ Unified Brand Identity & Email Compliance Module
 *
 * Single source of truth for:
 *   - Legal entity names (Hebrew + English)
 *   - Sender identity matrix
 *   - Legal footer builder (transactional / finance / marketing / internal)
 *   - Finance document header builder
 *   - Unsubscribe policy enforcement
 *
 * Israel 2026 compliance:
 *   - Protection of Privacy Law 5741-1981
 *   - Spam Protection Law (Unauthorized Electronic Mail) 5768-2008
 *   - Consumer Protection Law 5741-1981
 *   - VAT Law 5735-1975 (invoices must show issuer, tax ID, date, amounts)
 *   - Accessibility Regulations 5768-2008
 */

// ─── Legal entity ─────────────────────────────────────────────────────────────

/** Registered Hebrew name — exact legal form as in ח.פ. registry */
export const LEGAL_NAME_HE = 'פט ווש בע"מ';

/** Registered English name */
export const LEGAL_NAME_EN = 'PetWash Ltd';

/** Brand display name (trademark symbol, no RTL embedding) */
export const BRAND_NAME = 'Pet Wash™';

/** Company registration number (ח.פ.) issued by Israel Companies Registrar */
export const COMPANY_TAX_ID = '516047073';

/** Registered address */
export const COMPANY_ADDRESS_HE = 'ישראל';
export const COMPANY_ADDRESS_EN = 'Israel';

// ─── Sender identity matrix ───────────────────────────────────────────────────

/**
 * Sender matrix — one entry per email stream.
 *
 * Rule: All streams use noreply@petwash.co.il as the technical FROM address.
 * The FROM_NAME differentiates stream identity for inbox display.
 * reply-to is set where human response is expected.
 */
export const SENDERS = {
  /** Customer-facing transactional (bookings, activations, receipts) */
  transactional: {
    email: 'noreply@petwash.co.il',
    name: 'Pet Wash™',
    replyTo: 'support@petwash.co.il',
  },
  /** Finance/tax documents (invoices, VAT, wallet statements) */
  finance: {
    email: 'noreply@petwash.co.il',
    name: 'Pet Wash™ Finance',
    replyTo: 'support@petwash.co.il',
  },
  /** Provider/partner onboarding and workflow */
  provider: {
    email: 'noreply@petwash.co.il',
    name: 'Pet Wash™ Providers',
    replyTo: 'support@petwash.co.il',
  },
  /** Support-initiated messages (admin to applicant) */
  support: {
    email: 'noreply@petwash.co.il',
    name: 'Pet Wash™ Support',
    replyTo: 'support@petwash.co.il',
  },
  /** Marketing / loyalty / club (requires unsubscribe) */
  marketing: {
    email: 'noreply@petwash.co.il',
    name: 'Pet Wash™',
    replyTo: 'support@petwash.co.il',
  },
  /** Internal ops / reports (no customer involvement) */
  internal: {
    email: 'noreply@petwash.co.il',
    name: 'Pet Wash™ System',
    replyTo: undefined,
  },
} as const;

export type SenderStream = keyof typeof SENDERS;

/** Known internal recipient addresses */
export const INTERNAL_RECIPIENTS = {
  support: 'support@petwash.co.il',
  ceo: 'nir.h@petwash.co.il',
  nod: 'ido.s@petwash.co.il', // National Operations Director
  reports: process.env.REPORTS_EMAIL_TO ?? 'support@petwash.co.il',
} as const;

// ─── Unsubscribe policy ───────────────────────────────────────────────────────

/**
 * Email types that MUST NOT include an unsubscribe link or header.
 *
 * Under Israeli law (Spam Protection Law 5768-2008 §2(5)(a) and Consumer
 * Protection Regulations), the following categories are required communications
 * — adding unsubscribe implies they are commercial/promotional, which
 * misrepresents the document type and may invalidate it as a legal document:
 *
 *   - Tax invoices (חשבונית מס)
 *   - Payment receipts (קבלה)
 *   - Booking confirmations
 *   - Account activation
 *   - Password reset / security alerts
 *   - Wallet / payment confirmations
 *   - E-gift delivery (recipient side)
 *   - KYC status updates (required by FATF/banking regulations)
 */
export const NO_UNSUBSCRIBE_TYPES = new Set([
  'tax_invoice',
  'booking_receipt',
  'booking_confirmation',
  'payment_confirmation',
  'wallet_confirmation',
  'account_activation',
  'password_reset',
  'security_alert',
  'egift_delivery',
  'kyc_status',
  'provider_workflow',
  'internal',
  'finance',
]);

/**
 * Returns true if this email type must NOT carry unsubscribe headers/links.
 */
export function mustOmitUnsubscribe(emailType: string): boolean {
  return NO_UNSUBSCRIBE_TYPES.has(emailType);
}

// ─── Design tokens ────────────────────────────────────────────────────────────

export const DESIGN = {
  /** Primary surface — pure white. Never off-white or grey for body. */
  white: '#ffffff',
  /** Text primary — near-black for maximum contrast (WCAG AA 7:1 on white) */
  black: '#1a1a1a',
  /** Text secondary */
  grey: '#6b7280',
  /** Text tertiary / footnotes */
  lightGrey: '#9ca3af',
  /** Gold accent — brand prestige marker */
  gold: '#c9a96e',
  /** Hairline divider */
  divider: '#f0f0f0',
  /** CTA button background */
  ctaBg: '#1a1a1a',
  /** CTA button text */
  ctaText: '#ffffff',
  /** Font stack — web-safe, Hebrew-friendly */
  fontStack: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  /** Max content width */
  maxWidth: '600px',
} as const;

// ─── Legal footer builder ─────────────────────────────────────────────────────

export interface LegalFooterOptions {
  language?: 'he' | 'en';
  /** Include unsubscribe link — only for marketing emails */
  includeUnsubscribe?: boolean;
  /** Signed unsubscribe token for this recipient */
  unsubscribeToken?: string;
  /** Include accessibility statement link */
  includeAccessibility?: boolean;
  /** Stream context for BCC logic */
  stream?: SenderStream;
  year?: number;
}

const SITE = 'https://petwash.co.il';
const SUPPORT_EMAIL = 'support@petwash.co.il';

/**
 * Builds a legally-compliant bilingual footer block.
 *
 * Hebrew is always the primary language (mandatory for Israeli consumers).
 * English is always secondary.
 */
export function buildLegalFooter(opts: LegalFooterOptions = {}): string {
  const {
    language = 'he',
    includeUnsubscribe = false,
    unsubscribeToken,
    includeAccessibility = true,
    year = new Date().getFullYear(),
  } = opts;

  const isRTL = language === 'he';

  const unsubscribeHtml = includeUnsubscribe && unsubscribeToken
    ? `<tr>
        <td style="padding:8px 0 0;font-size:10px;color:#bbb;text-align:${isRTL ? 'right' : 'left'};">
          <a href="${SITE}/unsubscribe?token=${unsubscribeToken}"
             style="color:#bbb;text-decoration:underline;">
            ${language === 'he' ? 'הסרה מרשימת תפוצה / Unsubscribe' : 'Unsubscribe / הסרה מרשימת תפוצה'}
          </a>
        </td>
      </tr>`
    : '';

  const accessibilityHtml = includeAccessibility
    ? `<a href="${SITE}/accessibility" style="color:#bbb;text-decoration:none;margin:0 4px;">
        ${language === 'he' ? 'הצהרת נגישות' : 'Accessibility'}
      </a>
      <span style="color:#444;">·</span>`
    : '';

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="border-top:1px solid ${DESIGN.divider};margin-top:32px;">
  <tr>
    <td style="padding:24px 0 8px;font-size:11px;color:#bbb;line-height:1.8;
               font-family:${DESIGN.fontStack};text-align:${isRTL ? 'right' : 'left'};">
      <strong style="color:#999;">${BRAND_NAME}</strong> &mdash; ${LEGAL_NAME_HE} / ${LEGAL_NAME_EN}<br>
      ח.פ. / Company No. ${COMPANY_TAX_ID}<br>
      <a href="${SITE}" style="color:#bbb;text-decoration:none;">${SITE.replace('https://', '')}</a>
      &nbsp;·&nbsp;
      <a href="mailto:${SUPPORT_EMAIL}" style="color:#bbb;text-decoration:none;">${SUPPORT_EMAIL}</a>
    </td>
  </tr>
  <tr>
    <td style="padding:0 0 8px;font-size:10px;color:#bbb;font-family:${DESIGN.fontStack};
               text-align:${isRTL ? 'right' : 'left'};">
      ${accessibilityHtml}
      <a href="${SITE}/privacy" style="color:#bbb;text-decoration:none;margin:0 4px;">
        ${language === 'he' ? 'פרטיות' : 'Privacy'}
      </a>
      <span style="color:#444;">·</span>
      <a href="${SITE}/terms" style="color:#bbb;text-decoration:none;margin:0 4px;">
        ${language === 'he' ? 'תנאי שימוש' : 'Terms'}
      </a>
    </td>
  </tr>
  ${unsubscribeHtml}
  <tr>
    <td style="padding:4px 0 24px;font-size:10px;color:#bbb;font-family:${DESIGN.fontStack};
               text-align:${isRTL ? 'right' : 'left'};">
      &copy; ${year} ${LEGAL_NAME_HE}. ${language === 'he' ? 'כל הזכויות שמורות.' : 'All rights reserved.'}
    </td>
  </tr>
</table>`;
}

// ─── Finance document header builder ─────────────────────────────────────────

export interface FinanceHeaderOptions {
  documentType: 'tax_invoice' | 'receipt' | 'wallet_statement' | 'vat_report' | 'booking_receipt';
  documentNumber?: string;
  issuedAt?: Date;
  language?: 'he' | 'en';
}

const FINANCE_DOC_LABELS: Record<string, { he: string; en: string }> = {
  tax_invoice:       { he: 'חשבונית מס',          en: 'Tax Invoice' },
  receipt:           { he: 'קבלה',                en: 'Receipt' },
  wallet_statement:  { he: 'דוח ארנק',             en: 'Wallet Statement' },
  vat_report:        { he: 'דוח מע"מ',             en: 'VAT Report' },
  booking_receipt:   { he: 'אישור הזמנה ותשלום',   en: 'Booking & Payment Confirmation' },
};

/**
 * Builds the standardised finance document header block.
 *
 * Israeli VAT Law (§4(a)) requires every חשבונית מס to prominently display:
 *   - Issuer name and registered address
 *   - Issuer tax ID (ח.פ.)
 *   - Document type
 *   - Document number
 *   - Issue date
 */
export function buildFinanceHeader(opts: FinanceHeaderOptions): string {
  const {
    documentType,
    documentNumber,
    issuedAt = new Date(),
    language = 'he',
  } = opts;

  const isRTL = language === 'he';
  const label = FINANCE_DOC_LABELS[documentType] ?? { he: documentType, en: documentType };
  const issuedDateStr = issuedAt.toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jerusalem',
  });

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#000;padding:28px 36px;margin-bottom:0;">
  <tr>
    <td>
      <!-- Brand mark -->
      <div style="display:inline-block;padding:8px 16px;border:1px solid #333;border-radius:2px;margin-bottom:16px;">
        <span style="font-family:${DESIGN.fontStack};font-size:12px;font-weight:700;
                     letter-spacing:3px;color:${DESIGN.gold};text-transform:uppercase;">
          ${BRAND_NAME}
        </span>
      </div>
      <!-- Company identity (legally required) -->
      <div style="font-family:${DESIGN.fontStack};font-size:11px;color:#888;line-height:1.8;
                  text-align:${isRTL ? 'right' : 'left'};">
        ${LEGAL_NAME_HE} / ${LEGAL_NAME_EN}<br>
        ח.פ. ${COMPANY_TAX_ID}
      </div>
    </td>
    <td style="text-align:${isRTL ? 'left' : 'right'};vertical-align:top;">
      <!-- Document type + number -->
      <div style="font-family:${DESIGN.fontStack};color:#fff;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${DESIGN.gold};
                    margin-bottom:4px;">
          ${label.he} / ${label.en}
        </div>
        ${documentNumber
          ? `<div style="font-size:16px;font-weight:600;letter-spacing:1px;font-family:'Courier New',monospace;">
               #${documentNumber}
             </div>`
          : ''}
        <div style="font-size:11px;color:#666;margin-top:4px;">${issuedDateStr}</div>
      </div>
    </td>
  </tr>
</table>`;
}

// ─── Template wrapper ─────────────────────────────────────────────────────────

/**
 * Wraps body content in the canonical PetWash email shell:
 *   - Pure white background
 *   - 600px max-width card
 *   - Optional finance header (black bar with company identity)
 *   - Legal footer
 *   - Full RTL/LTR support
 */
export function wrapEmailShell(params: {
  title: string;
  bodyHtml: string;
  language?: 'he' | 'en';
  financeHeader?: FinanceHeaderOptions;
  footerOptions?: LegalFooterOptions;
}): string {
  const { title, bodyHtml, language = 'he', financeHeader, footerOptions = {} } = params;
  const isRTL = language === 'he';

  const headerBlock = financeHeader ? buildFinanceHeader({ ...financeHeader, language }) : `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#000;padding:24px 36px;">
  <tr>
    <td>
      <div style="display:inline-block;padding:8px 16px;border:1px solid #333;border-radius:2px;">
        <span style="font-family:${DESIGN.fontStack};font-size:12px;font-weight:700;
                     letter-spacing:3px;color:${DESIGN.gold};text-transform:uppercase;">
          ${BRAND_NAME}
        </span>
      </div>
      <div style="font-family:${DESIGN.fontStack};font-size:10px;color:#555;margin-top:6px;">
        ${LEGAL_NAME_HE} | ח.פ. ${COMPANY_TAX_ID}
      </div>
    </td>
  </tr>
</table>`;

  const footer = buildLegalFooter({ language, ...footerOptions });

  return `<!DOCTYPE html>
<html lang="${isRTL ? 'he' : 'en'}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#f5f5f0; font-family:${DESIGN.fontStack}; -webkit-font-smoothing:antialiased; color:${DESIGN.black}; }
    a { color:inherit; text-decoration:none; }
    @media (prefers-color-scheme:dark) { body { background:#0a0a0a; } }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f5f5f0;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#fff;border-radius:2px;
                      overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,.06);">
          <tr><td>${headerBlock}</td></tr>
          <tr><td style="padding:40px 36px;">${bodyHtml}</td></tr>
          <tr><td style="padding:0 36px;">${footer}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
