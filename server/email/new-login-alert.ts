/**
 * Pet Wash™ New-Login Alert Email
 *
 * Branded transactional email sent to the user whenever a login is detected
 * from a new device, new browser, new location, or high-risk IP.
 *
 * Privacy rules enforced:
 *   - No raw IP address in the email
 *   - No tokens, session data, or passwords
 *   - No internal IDs
 *   - Only safe metadata: time, approximate location, device, browser, OS
 */

import { logger } from '../lib/logger';
import { isSendGridConfigured, createMailService } from '../lib/sendgrid';
import { wrapEmailShell, DESIGN, buildLegalFooter } from './brand-identity';
import { emailSpendGuard } from '../services/EmailSpendGuard';

const FROM_EMAIL = process.env.SUPPORT_EMAIL || 'support@petwash.co.il';
const SITE       = 'https://petwash.co.il';

export interface NewLoginAlertParams {
  to: string;
  timestamp: Date;
  city: string;
  country: string;
  device: string;
  browser: string;
  os: string;
  riskFlags: string[];
}

/**
 * Build the HTML body for the new-login alert.
 * Language is English (international audience) with Hebrew footer.
 */
function buildBodyHtml(p: NewLoginAlertParams): string {
  const timeStr = p.timestamp.toLocaleString('en-GB', {
    timeZone:    'UTC',
    year:        'numeric',
    month:       'long',
    day:         'numeric',
    hour:        '2-digit',
    minute:      '2-digit',
    timeZoneName: 'short',
  });

  const locationStr = [p.city, p.country]
    .filter((s) => s && s !== 'Unknown')
    .join(', ') || 'Unknown location';

  const deviceDisplay  = p.device  || 'Unknown';
  const browserDisplay = p.browser || 'Unknown';
  const osDisplay      = p.os      || 'Unknown';

  const ctaUrl = `${SITE}/account/security`;

  const rowStyle = `
    padding:10px 0;
    border-bottom:1px solid ${DESIGN.divider};
    font-family:${DESIGN.fontStack};
  `;
  const labelStyle = `
    font-size:12px;
    color:${DESIGN.grey};
    text-transform:uppercase;
    letter-spacing:1px;
    width:130px;
    vertical-align:top;
    padding-right:12px;
  `;
  const valueStyle = `
    font-size:14px;
    color:${DESIGN.black};
    font-weight:500;
    vertical-align:top;
  `;

  return `
<!-- Greeting -->
<p style="font-family:${DESIGN.fontStack};font-size:16px;color:${DESIGN.black};margin-bottom:24px;line-height:1.6;">
  Hi,<br><br>
  We noticed a new sign-in to your <strong>Pet Wash™</strong> account.
  Here are the details:
</p>

<!-- Login details table -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="margin-bottom:28px;border-top:1px solid ${DESIGN.divider};">
  <tr style="${rowStyle}">
    <td style="${labelStyle}">Time</td>
    <td style="${valueStyle}">${timeStr}</td>
  </tr>
  <tr style="${rowStyle}">
    <td style="${labelStyle}">Location</td>
    <td style="${valueStyle}">${locationStr}</td>
  </tr>
  <tr style="${rowStyle}">
    <td style="${labelStyle}">Device</td>
    <td style="${valueStyle}">${deviceDisplay.charAt(0).toUpperCase() + deviceDisplay.slice(1)}</td>
  </tr>
  <tr style="${rowStyle}">
    <td style="${labelStyle}">Browser</td>
    <td style="${valueStyle}">${browserDisplay}</td>
  </tr>
  <tr style="${rowStyle}">
    <td style="${labelStyle}">Operating System</td>
    <td style="${valueStyle}">${osDisplay}</td>
  </tr>
</table>

<!-- Safe message -->
<p style="font-family:${DESIGN.fontStack};font-size:14px;color:${DESIGN.grey};
           line-height:1.7;margin-bottom:28px;">
  If this was you, no action is needed — you're all set.
  <br><br>
  If this was <strong style="color:${DESIGN.black};">not you</strong>, please secure your account immediately
  by clicking the button below.
</p>

<!-- CTA button -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
  <tr>
    <td style="border-radius:2px;background:${DESIGN.ctaBg};">
      <a href="${ctaUrl}"
         style="display:inline-block;padding:14px 32px;font-family:${DESIGN.fontStack};
                font-size:14px;font-weight:600;letter-spacing:0.5px;
                color:${DESIGN.ctaText};text-decoration:none;">
        Secure my account
      </a>
    </td>
  </tr>
</table>

<!-- Sign-off -->
<p style="font-family:${DESIGN.fontStack};font-size:13px;color:${DESIGN.grey};line-height:1.6;">
  Stay safe,<br>
  <strong style="color:${DESIGN.black};">Pet Wash™ Security Team</strong>
</p>
`;
}

/**
 * Send the new-login branded alert to the user.
 * Uses the EmailSpendGuard to prevent runaway sends.
 * Silently no-ops if SendGrid is not configured.
 */
export async function sendNewLoginAlert(params: NewLoginAlertParams): Promise<void> {
  if (!isSendGridConfigured()) {
    logger.info('[NewLoginAlert] SendGrid not configured — skipping email', { to: params.to });
    return;
  }

  const guard = emailSpendGuard.check('NewLoginAlert', params.to);
  if (!guard.allowed) {
    logger.warn('[NewLoginAlert] Blocked by EmailSpendGuard', { reason: guard.reason, to: params.to });
    return;
  }

  try {
    const bodyHtml = buildBodyHtml(params);
    const html = wrapEmailShell({
      title:    'New login detected on your Pet Wash™ account',
      bodyHtml,
      language: 'en',
      footerOptions: { language: 'en', includeUnsubscribe: false },
    });

    const mailService = createMailService();
    await mailService.send({
      to:      params.to,
      from:    { email: FROM_EMAIL, name: 'Pet Wash™ Security' },
      subject: 'New login detected on your Pet Wash™ account',
      html,
    });

    await emailSpendGuard.record('NewLoginAlert', params.to, 'New login detected on your Pet Wash™ account');

    logger.info('[NewLoginAlert] Alert sent', {
      to:     params.to,
      flags:  params.riskFlags,
    });
  } catch (err: any) {
    logger.error('[NewLoginAlert] Failed to send alert', {
      error:   err?.message,
      to:      params.to,
    });
    throw err;
  }
}
