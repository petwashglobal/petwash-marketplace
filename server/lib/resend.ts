/**
 * Resend transactional-email adapter (FLAG-OFF until keys exist).
 *
 * Why: SendGrid retired its free tier (now ~$20/mo minimum). Resend sends 3,000
 * emails/month free — plenty for pre-launch OTPs + receipts. This adapter is a
 * drop-in alternate transport for EmailService: it does NOTHING until BOTH
 *   EMAIL_PROVIDER=resend  AND  RESEND_API_KEY=...
 * are set. Default behaviour (no env) is unchanged — SendGrid stays primary.
 *
 * No SDK dependency: talks to the Resend REST API over fetch, so adopting it is
 * just setting two env vars + verifying the petwash.co.il domain in Resend
 * (SPF/DKIM/DMARC — the same DNS records that fix Israeli inbox deliverability).
 *
 * Deliverability note: set the From to a verified petwash.co.il sender. Resend
 * rejects unverified domains, which is a feature — it forces correct DNS.
 */
import { logger } from './logger';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** True only when the operator has explicitly opted into Resend with a key. */
export function isResendConfigured(): boolean {
  return (
    (process.env.EMAIL_PROVIDER || '').trim().toLowerCase() === 'resend' &&
    !!(process.env.RESEND_API_KEY || '').trim()
  );
}

export interface ResendMessage {
  to: string | string[];
  from: string;
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

/**
 * Send one email via Resend. Returns true on success, false on any failure
 * (caller should fall back to the existing SendGrid path). Never throws.
 */
export async function sendViaResend(msg: ResendMessage): Promise<boolean> {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return false;
  try {
    const body: Record<string, unknown> = {
      from: msg.from,
      to: Array.isArray(msg.to) ? msg.to : [msg.to],
      subject: msg.subject,
      html: msg.html,
    };
    if (msg.cc) body.cc = msg.cc;
    if (msg.bcc) body.bcc = msg.bcc;
    if (msg.replyTo) body.reply_to = msg.replyTo;

    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error('[Resend] send failed', { status: res.status, body: text.slice(0, 300), subject: msg.subject });
      return false;
    }
    logger.info('[Resend] email sent', { subject: msg.subject });
    return true;
  } catch (err: any) {
    logger.error('[Resend] send threw', { error: err?.message, subject: msg.subject });
    return false;
  }
}
