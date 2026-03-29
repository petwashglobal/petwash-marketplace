/**
 * PetWash™ Luxury Activation Email
 * 2026 premium welcome + account activation template.
 * Pure white, editorial spacing, prestige typography.
 */

export interface ActivationEmailParams {
  firstName: string;
  activationUrl: string;
  language?: 'he' | 'en';
}

export function buildActivationEmail(params: ActivationEmailParams): {
  subject: string;
  html: string;
} {
  const { firstName, activationUrl, language = 'en' } = params;
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  const fontStack = `'Helvetica Neue', Helvetica, Arial, sans-serif`;

  const copy = isHebrew
    ? {
        subject: `ברוכים הבאים ל-PetWash™ — אמתו את חשבונכם`,
        preheader: 'אחד צעד קטן לעולם חיות המחמד הפרמיום שלנו.',
        eyebrow: 'חברות פרמיום',
        headline: `ברוכים הבאים, ${firstName}`,
        body: 'חשבונכם ב-PetWash™ נוצר. כדי להשלים את ההרשמה ולהפעיל את הארנק, ההטבות וחברות הפרסטיג׳ שלכם, לחצו על הכפתור למטה.',
        cta: 'הפעילו את חשבוני',
        agreementLine: 'בלחיצה על הכפתור, אתם מאשרים את תנאי השירות ומדיניות הפרטיות של PetWash™.',
        footerNote: 'לא ביקשתם חשבון? התעלמו מהודעה זו.',
        supportLine: 'לתמיכה: support@petwash.co.il',
        expiryNote: 'הקישור תקף ל-24 שעות.',
      }
    : {
        subject: `Welcome to PetWash™ — Activate your account`,
        preheader: 'One step into our premium pet care world.',
        eyebrow: 'Premium Membership',
        headline: `Welcome, ${firstName}`,
        body: 'Your PetWash™ account has been created. To complete your registration and unlock your wallet, benefits, and Prestige membership, activate your account below.',
        cta: 'Activate My Account',
        agreementLine: 'By activating, you confirm acceptance of the PetWash™ Terms of Service and Privacy Policy.',
        footerNote: "Didn't request an account? You can safely ignore this email.",
        supportLine: 'Support: support@petwash.co.il',
        expiryNote: 'This link is valid for 24 hours.',
      };

  const html = `<!DOCTYPE html>
<html lang="${isHebrew ? 'he' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${copy.subject}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #ffffff;
      font-family: ${fontStack};
      -webkit-font-smoothing: antialiased;
      color: #1a1a1a;
    }
    a { color: inherit; text-decoration: none; }
  </style>
</head>
<body>
  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#ffffff; min-height:100vh;">
    <tr>
      <td align="center" style="padding: 0 16px;">

        <!-- Card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px; width:100%; margin:0 auto;">

          <!-- Spacer top -->
          <tr><td style="height:56px;"></td></tr>

          <!-- Brand mark -->
          <tr>
            <td align="${isHebrew ? 'right' : 'left'}" style="padding-bottom:48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="
                    background:#1a1a1a;
                    padding:10px 18px;
                    border-radius:2px;
                  ">
                    <span style="
                      font-family:${fontStack};
                      font-size:13px;
                      font-weight:700;
                      letter-spacing:3px;
                      color:#c9a96e;
                      text-transform:uppercase;
                    ">PetWash™</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Eyebrow -->
          <tr>
            <td style="
              font-size:11px;
              letter-spacing:3px;
              text-transform:uppercase;
              color:#c9a96e;
              font-weight:600;
              padding-bottom:16px;
              text-align:${isHebrew ? 'right' : 'left'};
            ">${copy.eyebrow}</td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="
              font-size:36px;
              font-weight:300;
              letter-spacing:-0.5px;
              line-height:1.2;
              color:#1a1a1a;
              padding-bottom:32px;
              text-align:${isHebrew ? 'right' : 'left'};
            ">${copy.headline}</td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding-bottom:32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="48">
                <tr><td style="height:2px; background:#1a1a1a;"></td></tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="
              font-size:16px;
              line-height:1.8;
              color:#3a3a3a;
              font-weight:300;
              padding-bottom:48px;
              max-width:480px;
              text-align:${isHebrew ? 'right' : 'left'};
            ">${copy.body}</td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="${isHebrew ? 'right' : 'left'}" style="padding-bottom:48px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <a href="${activationUrl}" target="_blank" style="
                      display:inline-block;
                      background:#1a1a1a;
                      color:#ffffff;
                      font-family:${fontStack};
                      font-size:13px;
                      font-weight:600;
                      letter-spacing:2px;
                      text-transform:uppercase;
                      text-decoration:none;
                      padding:18px 36px;
                      border-radius:2px;
                    ">${copy.cta}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td style="
              font-size:12px;
              color:#999;
              padding-bottom:8px;
              text-align:${isHebrew ? 'right' : 'left'};
            ">${copy.expiryNote}</td>
          </tr>

          <!-- Agreement -->
          <tr>
            <td style="
              font-size:12px;
              color:#999;
              line-height:1.6;
              padding-bottom:64px;
              text-align:${isHebrew ? 'right' : 'left'};
            ">${copy.agreementLine}</td>
          </tr>

          <!-- Hairline divider -->
          <tr>
            <td style="border-top:1px solid #f0f0f0; padding-bottom:32px;"></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              font-size:11px;
              color:#bbb;
              line-height:1.8;
              padding-bottom:56px;
              text-align:${isHebrew ? 'right' : 'left'};
            ">
              ${copy.footerNote}<br>
              ${copy.supportLine}<br>
              PetWash™ &mdash; Israel&apos;s Premium Pet Care Platform
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: copy.subject, html };
}
