import sgMail from '@sendgrid/mail';
import { MailService } from '@sendgrid/mail';

const rawKey = process.env.SENDGRID_API_KEY || '';
const SENDGRID_API_KEY = rawKey.trim().replace(/[\x00-\x1F\x7F]/g, '');

let initialized = false;

if (rawKey && rawKey !== SENDGRID_API_KEY) {
  console.warn(`[SendGrid] API key sanitized: trimmed whitespace/control characters (original length: ${rawKey.length}, clean length: ${SENDGRID_API_KEY.length})`);
}

if (SENDGRID_API_KEY && SENDGRID_API_KEY.startsWith('SG.')) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  initialized = true;
  console.log('[SendGrid] ✅ Configured and ready');
} else if (SENDGRID_API_KEY) {
  console.warn(`[SendGrid] API key present (${SENDGRID_API_KEY.length} chars) but does not start with "SG." - check the key format`);
} else if (rawKey) {
  console.warn(`[SendGrid] API key was set but sanitization reduced it to empty - key may contain only invalid characters. Re-enter the SENDGRID_API_KEY secret with a valid SendGrid key starting with "SG."`);
} else {
  console.warn('[SendGrid] SENDGRID_API_KEY not configured - email functionality disabled');
}

export function getSendGridClient(): typeof sgMail {
  return sgMail;
}

export function createMailService(): MailService {
  const service = new MailService();
  if (SENDGRID_API_KEY && SENDGRID_API_KEY.startsWith('SG.')) {
    service.setApiKey(SENDGRID_API_KEY);
  }
  return service;
}

export function isSendGridConfigured(): boolean {
  return initialized;
}

export { sgMail };
export default sgMail;
