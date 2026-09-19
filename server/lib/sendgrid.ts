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

// Loud production guard: a misconfigured key means the app boots fine but every
// send silently no-ops (bookings, receipts, gift cards never arrive). Make that
// impossible to miss at deploy time — this is the silent-blackout failure mode.
if (!initialized && process.env.NODE_ENV === 'production') {
  console.error(
    '[SendGrid] 🔴🔴 CRITICAL: EMAIL DISABLED IN PRODUCTION — SENDGRID_API_KEY missing or malformed. ' +
    'Customers will receive NO emails and sends will SILENTLY no-op. Fix SENDGRID_API_KEY immediately.'
  );
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

/**
 * The address SendGrid is told the mail is FROM.
 *
 * 2026-09-19 live delivery test: inbox and SMS delivered, email came back
 * HTTP 400 from SendGrid. A 400 is "the request is malformed", not "sender
 * unverified" (that is 403). The API key above is already stripped of
 * whitespace and control characters because a secret once arrived with a
 * trailing newline; SENDGRID_FROM_EMAIL was read raw at four call sites and
 * never cleaned. A from address of "noreply@petwash.co.il\n" is a 400 on
 * every send, for every email the dispatcher sends.
 *
 * Accepts a bare address or "Display Name <address>"; returns the bare
 * address. Anything that is not an address falls back to the caller's
 * default, so a broken secret degrades to the code default instead of a
 * guaranteed 400.
 */
export function cleanSenderAddress(raw: string | null | undefined, fallback: string): string {
  const s = (raw ?? '').replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!s) return fallback;
  const m = s.match(/<([^<>]+)>/);
  const addr = (m ? m[1] : s).trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(addr) ? addr : fallback;
}

/**
 * A PII-safe description of a sender secret for diagnostics: its shape, never
 * its local part. Prints in the delivery-test workflow so a bad secret names
 * itself without anyone reading the value.
 */
export function describeSenderAddress(raw: string | null | undefined): {
  present: boolean;
  length: number;
  trailingWhitespace: boolean;
  controlChars: boolean;
  angleBrackets: boolean;
  looksLikeEmail: boolean;
  domain: string | null;
} {
  const v = raw ?? '';
  const cleaned = cleanSenderAddress(v, '');
  return {
    present: v.length > 0,
    length: v.length,
    trailingWhitespace: v !== v.trimEnd(),
    controlChars: /[\x00-\x1F\x7F]/.test(v),
    angleBrackets: /<[^<>]+>/.test(v),
    looksLikeEmail: cleaned !== '',
    domain: cleaned ? cleaned.split('@')[1] : null,
  };
}

export { sgMail };
export default sgMail;
