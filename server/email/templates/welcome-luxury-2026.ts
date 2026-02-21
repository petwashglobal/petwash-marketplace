import { PETWASH_LOGO_BASE64 } from './logo-base64';

type EmailVariant = 'customer' | 'provider';

interface LuxuryWelcomeEmailData {
  firstName: string;
  variant: EmailVariant;
  language: 'he' | 'en';
  membershipNumber?: string;
  serviceTypes?: string[];
}

const CONTENT: Record<EmailVariant, Record<'en' | 'he', {
  preheader: string;
  subtitle: string;
  intro: string;
  nextStep: string;
  ctaLabel: string;
  ctaUrl: string;
  accountLabel: string;
  accountDesc: string;
  accountUrl: string;
  helpLabel: string;
  helpDesc: string;
  helpUrl: string;
  quickAccess: string;
  subject: (name: string) => string;
}>> = {
  customer: {
    en: {
      preheader: 'Welcome to PetWash \u2014 your account is ready. Complete your profile to unlock services.',
      subtitle: 'WELCOME TO PETWASH',
      intro: 'Your account is created. Complete your profile in under 2 minutes to unlock bookings, rewards, and secure payments.',
      nextStep: 'Complete your profile details, then verify your email or phone to activate full access.',
      ctaLabel: 'Complete my profile',
      ctaUrl: 'https://petwash.co.il/complete-profile',
      accountLabel: 'Account:',
      accountDesc: 'update details, security, preferences',
      accountUrl: 'https://petwash.co.il/my-account',
      helpLabel: 'Help:',
      helpDesc: 'FAQs, contact, troubleshooting',
      helpUrl: 'https://petwash.co.il/help',
      quickAccess: 'Quick access',
      subject: (name) => `Welcome to Pet Wash\u2122, ${name} \u2014 Your Account is Ready`,
    },
    he: {
      preheader: '\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC-PetWash \u2014 \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA \u05DE\u05D5\u05DB\u05DF. \u05D4\u05E9\u05DC\u05DD \u05D0\u05EA \u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05E9\u05DC\u05DA.',
      subtitle: '\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC-PETWASH',
      intro: '\u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA \u05E0\u05D5\u05E6\u05E8. \u05D4\u05E9\u05DC\u05DD \u05D0\u05EA \u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05E9\u05DC\u05DA \u05EA\u05D5\u05DA \u05E4\u05D7\u05D5\u05EA \u05DE-2 \u05D3\u05E7\u05D5\u05EA \u05DB\u05D3\u05D9 \u05DC\u05E4\u05EA\u05D5\u05D7 \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA, \u05EA\u05D2\u05DE\u05D5\u05DC\u05D9\u05DD \u05D5\u05EA\u05E9\u05DC\u05D5\u05DE\u05D9\u05DD \u05DE\u05D0\u05D5\u05D1\u05D8\u05D7\u05D9\u05DD.',
      nextStep: '\u05D4\u05E9\u05DC\u05DD \u05D0\u05EA \u05E4\u05E8\u05D8\u05D9 \u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05E9\u05DC\u05DA, \u05DC\u05D0\u05D7\u05E8 \u05DE\u05DB\u05DF \u05D0\u05DE\u05EA \u05D0\u05EA \u05D4\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05D0\u05D5 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05E9\u05DC\u05DA \u05DC\u05D2\u05D9\u05E9\u05D4 \u05DE\u05DC\u05D0\u05D4.',
      ctaLabel: '\u05D4\u05E9\u05DC\u05DE\u05EA \u05E4\u05E8\u05D5\u05E4\u05D9\u05DC',
      ctaUrl: 'https://petwash.co.il/complete-profile',
      accountLabel: '\u05D7\u05E9\u05D1\u05D5\u05DF:',
      accountDesc: '\u05E2\u05D3\u05DB\u05D5\u05DF \u05E4\u05E8\u05D8\u05D9\u05DD, \u05D0\u05D1\u05D8\u05D7\u05D4, \u05D4\u05E2\u05D3\u05E4\u05D5\u05EA',
      accountUrl: 'https://petwash.co.il/my-account',
      helpLabel: '\u05E2\u05D6\u05E8\u05D4:',
      helpDesc: '\u05E9\u05D0\u05DC\u05D5\u05EA \u05E0\u05E4\u05D5\u05E6\u05D5\u05EA, \u05D9\u05E6\u05D9\u05E8\u05EA \u05E7\u05E9\u05E8, \u05E4\u05EA\u05E8\u05D5\u05DF \u05D1\u05E2\u05D9\u05D5\u05EA',
      helpUrl: 'https://petwash.co.il/help',
      quickAccess: '\u05D2\u05D9\u05E9\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4',
      subject: (name) => `\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC-Pet Wash\u2122, ${name} \u2014 \u05D4\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA \u05DE\u05D5\u05DB\u05DF`,
    },
  },
  provider: {
    en: {
      preheader: 'Welcome to PetWash \u2014 your provider account is created. Complete onboarding to go live.',
      subtitle: 'WELCOME TO PETWASH',
      intro: 'Welcome. Your provider account is created. To go live, complete onboarding and identity verification.',
      nextStep: 'Add your service area, profile photo, availability, and upload your ID for verification.',
      ctaLabel: 'Start provider onboarding',
      ctaUrl: 'https://petwash.co.il/provider-onboarding',
      accountLabel: 'Account:',
      accountDesc: 'update details, security, availability',
      accountUrl: 'https://petwash.co.il/provider/settings',
      helpLabel: 'Help:',
      helpDesc: 'provider FAQs, policies, support',
      helpUrl: 'https://petwash.co.il/help/providers',
      quickAccess: 'Quick access',
      subject: (name) => `Welcome to Pet Wash\u2122 Team, ${name} \u2014 Provider Account Created`,
    },
    he: {
      preheader: '\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC-PetWash \u2014 \u05D7\u05E9\u05D1\u05D5\u05DF \u05D4\u05E1\u05E4\u05E7 \u05E9\u05DC\u05DA \u05E0\u05D5\u05E6\u05E8. \u05D4\u05E9\u05DC\u05DD \u05D0\u05EA \u05EA\u05D4\u05DC\u05D9\u05DA \u05D4\u05E7\u05DC\u05D9\u05D8\u05D4.',
      subtitle: '\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC-PETWASH',
      intro: '\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD. \u05D7\u05E9\u05D1\u05D5\u05DF \u05D4\u05E1\u05E4\u05E7 \u05E9\u05DC\u05DA \u05E0\u05D5\u05E6\u05E8. \u05DB\u05D3\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05DC\u05E2\u05D1\u05D5\u05D3, \u05D4\u05E9\u05DC\u05DD \u05D0\u05EA \u05EA\u05D4\u05DC\u05D9\u05DA \u05D4\u05E7\u05DC\u05D9\u05D8\u05D4 \u05D5\u05D0\u05D9\u05DE\u05D5\u05EA \u05D6\u05D4\u05D5\u05EA.',
      nextStep: '\u05D4\u05D5\u05E1\u05E3 \u05D0\u05D6\u05D5\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA, \u05EA\u05DE\u05D5\u05E0\u05EA \u05E4\u05E8\u05D5\u05E4\u05D9\u05DC, \u05D6\u05DE\u05D9\u05E0\u05D5\u05EA, \u05D5\u05D4\u05E2\u05DC\u05D4 \u05EA\u05E2\u05D5\u05D3\u05EA \u05D6\u05D4\u05D5\u05EA \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA.',
      ctaLabel: '\u05D4\u05EA\u05D7\u05DC\u05EA \u05EA\u05D4\u05DC\u05D9\u05DA \u05E7\u05DC\u05D9\u05D8\u05D4',
      ctaUrl: 'https://petwash.co.il/provider-onboarding',
      accountLabel: '\u05D7\u05E9\u05D1\u05D5\u05DF:',
      accountDesc: '\u05E2\u05D3\u05DB\u05D5\u05DF \u05E4\u05E8\u05D8\u05D9\u05DD, \u05D0\u05D1\u05D8\u05D7\u05D4, \u05D6\u05DE\u05D9\u05E0\u05D5\u05EA',
      accountUrl: 'https://petwash.co.il/provider/settings',
      helpLabel: '\u05E2\u05D6\u05E8\u05D4:',
      helpDesc: '\u05E9\u05D0\u05DC\u05D5\u05EA \u05E0\u05E4\u05D5\u05E6\u05D5\u05EA \u05DC\u05E1\u05E4\u05E7\u05D9\u05DD, \u05DE\u05D3\u05D9\u05E0\u05D9\u05D5\u05EA, \u05EA\u05DE\u05D9\u05DB\u05D4',
      helpUrl: 'https://petwash.co.il/help/providers',
      quickAccess: '\u05D2\u05D9\u05E9\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4',
      subject: (name) => `\u05D1\u05E8\u05D5\u05DB\u05D9\u05DD \u05D4\u05D1\u05D0\u05D9\u05DD \u05DC\u05E6\u05D5\u05D5\u05EA Pet Wash\u2122, ${name} \u2014 \u05D7\u05E9\u05D1\u05D5\u05DF \u05E1\u05E4\u05E7 \u05E0\u05D5\u05E6\u05E8`,
    },
  },
};

const SERVICE_TYPE_LABELS: Record<string, { en: string; he: string }> = {
  sitter_suite: { en: 'The Sitter Suite\u2122', he: '\u05E9\u05DE\u05E8\u05D8\u05E4\u05D5\u05EA' },
  walk_my_pet: { en: 'Walk My Pet\u2122', he: '\u05D8\u05D9\u05D5\u05DC\u05D9 \u05DB\u05DC\u05D1\u05D9\u05DD' },
  wash_academy: { en: 'Pet Wash Academy\u2122', he: '\u05D0\u05E7\u05D3\u05DE\u05D9\u05D9\u05EA \u05E9\u05D8\u05D9\u05E4\u05D4' },
  pet_sitting: { en: 'Pet Sitting', he: '\u05E9\u05DE\u05E8\u05D8\u05E4\u05D5\u05EA' },
  dog_walking: { en: 'Dog Walking', he: '\u05D8\u05D9\u05D5\u05DC\u05D9 \u05DB\u05DC\u05D1\u05D9\u05DD' },
  grooming: { en: 'Grooming', he: '\u05D8\u05D9\u05E4\u05D5\u05D7' },
  training: { en: 'Training', he: '\u05D0\u05D9\u05DC\u05D5\u05E3' },
};

function buildServiceBadges(serviceTypes: string[], lang: 'he' | 'en'): string {
  if (!serviceTypes || serviceTypes.length === 0) return '';
  const badges = serviceTypes.map(type => {
    const label = SERVICE_TYPE_LABELS[type]?.[lang] || type;
    return `<span style="display:inline-block;background:#fffaf0;border:1px solid #efe6cf;border-radius:8px;padding:6px 14px;font-size:12px;color:#92710a;font-weight:600;margin:3px;">${label}</span>`;
  }).join('');
  return `<div style="margin-top:12px;">${badges}</div>`;
}

export function generateLuxuryWelcomeEmail(data: LuxuryWelcomeEmailData): { subject: string; html: string } {
  const { firstName, variant, language, membershipNumber, serviceTypes } = data;
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  const align = isHebrew ? 'right' : 'left';
  const c = CONTENT[variant][language];
  const name = firstName || (isHebrew ? '\u05E9\u05DC\u05D5\u05DD' : 'there');
  const year = new Date().getFullYear();
  const logoUrl = PETWASH_LOGO_BASE64;
  const termsUrl = 'https://petwash.co.il/terms';
  const privacyUrl = 'https://petwash.co.il/privacy';

  const membershipBlock = membershipNumber ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #efe6cf;border-radius:14px;background:#fffaf0;margin-top:12px;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;line-height:20px;color:#2a2a2f;text-align:${align};">
                            <strong style="color:#0b0b0c;">${isHebrew ? '\u05DE\u05E1\u05E4\u05E8 \u05D7\u05D1\u05E8\u05D5\u05EA:' : 'Membership #:'}</strong>
                            <span style="color:#92710a;font-weight:700;letter-spacing:0.05em;font-size:15px;margin-${isHebrew ? 'right' : 'left'}:6px;">${membershipNumber}</span>
                          </div>
                        </td>
                      </tr>
                    </table>` : '';

  const servicesBlock = variant === 'provider' && serviceTypes?.length
    ? `<div style="padding:8px 0 0 0;text-align:${align};">${buildServiceBadges(serviceTypes, language)}</div>`
    : '';

  const providerChecklist = variant === 'provider' ? `
                <tr>
                  <td class="px" style="padding:6px 30px 0 30px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;line-height:22px;color:#2a2a2f;text-align:${align};">
                            <strong style="color:#0b0b0c;font-size:14px;">${isHebrew ? '\u05DE\u05D4 \u05DC\u05D4\u05DB\u05D9\u05DF:' : 'What you need to prepare:'}</strong>
                            <div style="margin-top:8px;">
                              ${isHebrew ? `
                              \u25CB \u05EA\u05DE\u05D5\u05E0\u05EA \u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9\u05EA<br/>
                              \u25CB \u05EA\u05E2\u05D5\u05D3\u05EA \u05D6\u05D4\u05D5\u05EA (\u05EA.\u05D6. / \u05D3\u05E8\u05DB\u05D5\u05DF)<br/>
                              \u25CB \u05DB\u05EA\u05D5\u05D1\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA \u05D5\u05D0\u05D6\u05D5\u05E8\u05D9 \u05D6\u05DE\u05D9\u05E0\u05D5\u05EA<br/>
                              \u25CB \u05EA\u05D9\u05D0\u05D5\u05E8 \u05E7\u05E6\u05E8 \u05E2\u05DC \u05E2\u05E6\u05DE\u05DA (\u05D1\u05D9\u05D5\u05D2\u05E8\u05E4\u05D9\u05D4)
                              ` : `
                              \u25CB Professional profile photo<br/>
                              \u25CB Government-issued ID (passport / ID card)<br/>
                              \u25CB Service area and availability schedule<br/>
                              \u25CB Short bio about yourself
                              `}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>` : '';

  const securityNote = isHebrew
    ? 'Pet Wash\u2122 \u05DC\u05E2\u05D5\u05DC\u05DD \u05DC\u05D0 \u05D9\u05D1\u05E7\u05E9 \u05D0\u05EA \u05D4\u05E1\u05D9\u05E1\u05DE\u05D4 \u05E9\u05DC\u05DA \u05D1\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC.'
    : 'Security note: PetWash will never ask for your password by email.';

  const footerTerms = isHebrew
    ? `\u05D1\u05E9\u05D9\u05DE\u05D5\u05E9 \u05D1-PetWash \u05D0\u05EA\u05D4 \u05DE\u05E1\u05DB\u05D9\u05DD \u05DC<a href="${termsUrl}" style="color:#7a7a86;text-decoration:underline;">\u05EA\u05E0\u05D0\u05D9 \u05D4\u05E9\u05D9\u05DE\u05D5\u05E9</a> \u05D5\u05DC<a href="${privacyUrl}" style="color:#7a7a86;text-decoration:underline;">\u05DE\u05D3\u05D9\u05E0\u05D9\u05D5\u05EA \u05D4\u05E4\u05E8\u05D8\u05D9\u05D5\u05EA</a>.`
    : `By using PetWash you agree to our <a href="${termsUrl}" style="color:#7a7a86;text-decoration:underline;">Terms</a> and <a href="${privacyUrl}" style="color:#7a7a86;text-decoration:underline;">Privacy Policy</a>.`;

  const footerHelp = isHebrew
    ? `\u05E6\u05E8\u05D9\u05DB\u05D9\u05DD \u05E2\u05D6\u05E8\u05D4? \u05E9\u05DC\u05D7\u05D5 \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05DC-<a href="mailto:support@petwash.co.il" style="color:#7a7a86;text-decoration:underline;">support@petwash.co.il</a>`
    : `Need help? Email <a href="mailto:support@petwash.co.il" style="color:#7a7a86;text-decoration:underline;">support@petwash.co.il</a>`;

  const openSettings = isHebrew ? '\u05E4\u05EA\u05D7 \u05D4\u05D2\u05D3\u05E8\u05D5\u05EA' : 'Open settings';
  const supportCenter = isHebrew ? '\u05DE\u05E8\u05DB\u05D6 \u05EA\u05DE\u05D9\u05DB\u05D4' : 'Support center';
  const fallbackLink = isHebrew ? '\u05D0\u05DD \u05D4\u05DB\u05E4\u05EA\u05D5\u05E8 \u05DC\u05D0 \u05E2\u05D5\u05D1\u05D3, \u05D4\u05E2\u05EA\u05D9\u05E7\u05D5 \u05D0\u05EA \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8:' : 'If the button does not work, copy and paste this link:';

  const subject = c.subject(name);

  const html = `<!doctype html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${subject}</title>
  <style>
    html, body { margin:0 !important; padding:0 !important; height:100% !important; width:100% !important; }
    * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    a { text-decoration:none; }
    @media (prefers-color-scheme: dark) {
      .bg { background:#0b0b0c !important; }
      .card { background:#111114 !important; border-color:#26262b !important; }
      .muted { color:#b9b9c1 !important; }
      .text { color:#f2f2f5 !important; }
      .line { background:#26262b !important; }
      .highlight-box { background:#1a1815 !important; border-color:#3d3729 !important; }
      .checklist-box { background:#12141a !important; border-color:#26262b !important; }
      .link-card { border-color:#26262b !important; }
    }
    @media screen and (max-width: 600px) {
      .container { width:100% !important; }
      .px { padding-left:18px !important; padding-right:18px !important; }
      .h1 { font-size:26px !important; line-height:34px !important; }
      .h2 { font-size:18px !important; line-height:26px !important; }
      .btn { width:100% !important; }
    }
  </style>
</head>

<body class="bg" style="background:#f6f6f7; margin:0; padding:0;">
  <div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    ${c.preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px;">

          <tr>
            <td align="center" style="padding:8px 0 18px 0;">
              <img src="${logoUrl}" width="140" alt="Pet Wash\u2122" style="display:block; width:140px; height:auto;" />
            </td>
          </tr>

          <tr>
            <td class="card" style="background:#ffffff; border:1px solid #e9e9ee; border-radius:18px; overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="line" style="background:linear-gradient(90deg, #c9a96e, #e8d5a3, #dcc07a, #c9a96e); height:4px; line-height:4px; font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="px" style="padding:26px 30px 8px 30px;">
                    <div class="muted" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#6b6b76; text-align:${align};">
                      ${c.subtitle}
                    </div>
                    <div class="h1 text" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size:30px; line-height:38px; font-weight:700; color:#0b0b0c; margin-top:10px; text-align:${align};">
                      ${isHebrew ? `\u05E9\u05DC\u05D5\u05DD ${name},` : `Hi ${name},`}
                    </div>

                    <div class="text" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size:15px; line-height:24px; color:#0b0b0c; margin-top:10px; text-align:${align};">
                      ${c.intro}
                    </div>
                    ${servicesBlock}
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:12px 30px 0 30px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="highlight-box" style="border:1px solid #efe6cf; border-radius:14px; background:#fffaf0;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size:13px; line-height:20px; color:#2a2a2f; text-align:${align};">
                            <strong style="color:#0b0b0c;">${isHebrew ? '\u05D4\u05E9\u05DC\u05D1 \u05D4\u05D1\u05D0:' : 'Your next step:'}</strong>
                            <span style="color:#2a2a2f;"> ${c.nextStep}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                    ${membershipBlock}
                  </td>
                </tr>

                ${providerChecklist}

                <tr>
                  <td class="px" style="padding:18px 30px 6px 30px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" class="btn" style="${isHebrew ? 'margin-right:0;margin-left:auto;' : ''}">
                      <tr>
                        <td align="center" bgcolor="#0b0b0c" style="border-radius:12px;">
                          <a href="${c.ctaUrl}"
                             style="display:inline-block; padding:14px 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; font-size:14px; font-weight:700; letter-spacing:0.02em; color:#ffffff;">
                            ${c.ctaLabel}
                          </a>
                        </td>
                      </tr>
                    </table>
                    <div class="muted" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; font-size:12px; line-height:18px; color:#6b6b76; margin-top:10px; text-align:${align};">
                      ${fallbackLink}
                      <br />
                      <a href="${c.ctaUrl}" style="color:#6b6b76; text-decoration:underline;">${c.ctaUrl}</a>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:10px 30px 22px 30px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-top:6px;">
                          <div class="h2 text" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; font-size:16px; line-height:24px; font-weight:700; color:#0b0b0c; text-align:${align};">
                            ${c.quickAccess}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top:10px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td class="link-card" style="padding:10px 12px; border:1px solid #e9e9ee; border-radius:12px;">
                                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; font-size:13px; line-height:20px; color:#0b0b0c; text-align:${align};">
                                  <strong>${c.accountLabel}</strong> <a href="${c.accountUrl}" style="color:#0b0b0c; text-decoration:underline;">${openSettings}</a>
                                  <span class="muted" style="color:#6b6b76;"> - ${c.accountDesc}</span>
                                </div>
                              </td>
                            </tr>
                            <tr><td style="height:8px;"></td></tr>
                            <tr>
                              <td class="link-card" style="padding:10px 12px; border:1px solid #e9e9ee; border-radius:12px;">
                                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; font-size:13px; line-height:20px; color:#0b0b0c; text-align:${align};">
                                  <strong>${c.helpLabel}</strong> <a href="${c.helpUrl}" style="color:#0b0b0c; text-decoration:underline;">${supportCenter}</a>
                                  <span class="muted" style="color:#6b6b76;"> - ${c.helpDesc}</span>
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 6px 0 6px;">
              <div class="muted" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; font-size:11px; line-height:16px; color:#7a7a86; text-align:center;">
                ${footerTerms}
                <br />
                ${securityNote}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 6px 24px 6px;">
              <div class="muted" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; font-size:11px; line-height:16px; color:#7a7a86; text-align:center;">
                \u00A9 ${year} Pet Wash Ltd. All rights reserved.
                <br />
                ${footerHelp}
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
