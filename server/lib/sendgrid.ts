import sgMail from '@sendgrid/mail';
import { MailService } from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';

let initialized = false;

if (SENDGRID_API_KEY && SENDGRID_API_KEY.startsWith('SG.')) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  initialized = true;
} else if (SENDGRID_API_KEY) {
  console.warn('[SendGrid] API key is set but does not start with "SG." - emails disabled until valid key is provided');
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
