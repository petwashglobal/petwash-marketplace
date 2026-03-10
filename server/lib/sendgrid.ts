import sgMail from '@sendgrid/mail';
import { MailService } from '@sendgrid/mail';

const rawKey = process.env.SENDGRID_API_KEY || '';
const SENDGRID_API_KEY = rawKey.trim().replace(/[\x00-\x1F\x7F]/g, '');

let initialized = false;

console.log('[SendGrid] 🔍 API Key Diagnostics:');
console.log(`  SENDGRID_API_KEY present: ${!!rawKey}`);
console.log(`  startsWithSG: ${SENDGRID_API_KEY.startsWith('SG.')}`);
console.log(`  rawLength: ${rawKey.length}`);
console.log(`  cleanLength: ${SENDGRID_API_KEY.length}`);

if (rawKey && rawKey !== SENDGRID_API_KEY) {
  console.warn(`[SendGrid] ⚠️ API key sanitized: trimmed whitespace/control characters (original length: ${rawKey.length}, clean length: ${SENDGRID_API_KEY.length})`);
}

if (SENDGRID_API_KEY && SENDGRID_API_KEY.startsWith('SG.')) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  initialized = true;
  console.log('[SendGrid] ✅ Configured and ready');
} else if (SENDGRID_API_KEY) {
  console.warn(`[SendGrid] ❌ API key present (${SENDGRID_API_KEY.length} chars) but does NOT start with "SG." - key format is WRONG`);
} else if (rawKey) {
  console.warn(`[SendGrid] ❌ API key was set but sanitization reduced it to empty - re-enter SENDGRID_API_KEY`);
} else {
  console.warn('[SendGrid] ❌ SENDGRID_API_KEY not configured - email functionality disabled');
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
