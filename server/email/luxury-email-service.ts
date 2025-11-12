/**
 * Luxury Email Service - 2025
 * High-end email sending with beautiful templates
 */

import { MailService } from '@sendgrid/mail';
import { logger } from '../lib/logger';
import { generateBackendTeamInvitation } from './templates/backend-team-invitation-2025';
import { generateWelcomeEmail } from './templates/welcome-new-customer-2025';
import { generatePartnerInvitation } from './templates/partner-invitation-2025';
import { generatePartnerInvitationHebrew } from './templates/partner-invitation-hebrew-2025';
import { generateWorkflowNotification } from './templates/workflow-notification-2025';
import { generateLuxuryLaunchEmail } from './templates/luxury-launch-2025';
import { generateInvestorLaunchEventEmail } from './templates/luxury-investor-launch-event-2025';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'Support@PetWash.co.il';
const FROM_NAME = 'Pet Wash™ Team';

let sgMail: MailService | null = null;

if (SENDGRID_API_KEY) {
  sgMail = new MailService();
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface EmailOptions {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  from?: {
    email: string;
    name: string;
  };
}

/**
 * Send luxury email with beautiful design
 */
export async function sendLuxuryEmail(options: EmailOptions): Promise<boolean> {
  if (!sgMail) {
    logger.error('[Luxury Email] SendGrid not configured');
    console.log('\n📧 EMAIL PREVIEW (SendGrid not configured):\n');
    console.log(`To: ${options.to}`);
    if (options.cc) console.log(`CC: ${options.cc.join(', ')}`);
    console.log(`Subject: ${options.subject}`);
    console.log('HTML content ready (not sent)\n');
    return false;
  }

  try {
    const msg = {
      to: options.to,
      cc: options.cc,
      from: options.from || {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: options.subject,
      html: options.html
    };

    await sgMail.send(msg);
    
    logger.info('[Luxury Email] Sent successfully', {
      to: options.to,
      cc: options.cc,
      subject: options.subject
    });
    
    return true;
  } catch (error) {
    logger.error('[Luxury Email] Failed to send', error);
    return false;
  }
}

/**
 * Send Backend Team Invitation Email
 */
export async function sendBackendTeamInvitation(
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  senderEmail: string,
  personalMessage?: string,
  ccEmails?: string[]
): Promise<boolean> {
  const { subject, html } = generateBackendTeamInvitation({
    recipientName,
    recipientEmail,
    senderName,
    senderEmail,
    personalMessage
  });

  return sendLuxuryEmail({
    to: recipientEmail,
    cc: ccEmails,
    subject,
    html,
    from: {
      email: senderEmail,
      name: senderName
    }
  });
}

/**
 * Send Welcome Email to New Customer
 */
export async function sendWelcomeEmail(
  email: string,
  firstName: string,
  petName?: string,
  petType?: string,
  language?: 'he' | 'en'
): Promise<boolean> {
  const { subject, html } = generateWelcomeEmail({
    firstName,
    email,
    petName,
    petType,
    language: language || 'en'
  });

  return sendLuxuryEmail({
    to: email,
    subject,
    html
  });
}

/**
 * Send Partner Invitation Email with Investor Presentation Access
 */
export async function sendPartnerInvitation(
  partnerEmail: string,
  partnerName: string,
  role: string,
  ccEmails?: string[]
): Promise<boolean> {
  const presentationUrl = 'https://petwash.co.il/investor-presentation';
  
  const { subject, html } = generatePartnerInvitation({
    partnerName,
    partnerEmail,
    role,
    presentationUrl,
    language: 'en'
  });

  return sendLuxuryEmail({
    to: partnerEmail,
    cc: ccEmails,
    subject,
    html
  });
}

/**
 * Send Partner Invitation Email in Hebrew with Investor Presentation Access
 */
export async function sendPartnerInvitationHebrew(
  partnerEmail: string,
  partnerName: string,
  role: string,
  ccEmails?: string[]
): Promise<boolean> {
  const presentationUrl = 'https://petwash.co.il/investor-presentation';
  
  const { subject, html } = generatePartnerInvitationHebrew({
    partnerName,
    partnerEmail,
    role,
    presentationUrl
  });

  return sendLuxuryEmail({
    to: partnerEmail,
    cc: ccEmails,
    subject,
    html
  });
}

/**
 * Send Workflow Notification Email
 * Premium dark-mode compatible template for admin/management notifications
 */
export async function sendWorkflowNotification(
  recipientEmail: string,
  recipientName: string,
  actionTitle: string,
  actionBody: string,
  approvalLink: string,
  options?: {
    priority?: 'high' | 'medium' | 'low';
    deadline?: string;
    originator?: string;
    logoUrl?: string;
    ccEmails?: string[];
  }
): Promise<boolean> {
  const { subject, html } = generateWorkflowNotification({
    recipientName,
    actionTitle,
    actionBody,
    priority: options?.priority || 'medium',
    deadline: options?.deadline,
    originator: options?.originator || 'Pet Wash™ System',
    approvalLink,
    logoUrl: options?.logoUrl
  });

  return sendLuxuryEmail({
    to: recipientEmail,
    cc: options?.ccEmails,
    subject,
    html
  });
}

/**
 * Send Luxury Brand Launch Email
 * Ultra-premium animated template for brand launches and special announcements
 */
export async function sendLuxuryLaunchEmail(
  recipientEmail: string,
  recipientName: string,
  language?: 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es'
): Promise<boolean> {
  const { subject, html } = generateLuxuryLaunchEmail({
    recipientName,
    recipientEmail,
    language
  });

  return sendLuxuryEmail({
    to: recipientEmail,
    subject,
    html
  });
}

/**
 * Send Investor Launch Event Email
 * Special event invitation with pure white background and location details
 */
export async function sendInvestorLaunchEventEmail(
  recipientEmail: string,
  recipientName: string,
  language?: 'he' | 'en',
  ccEmails?: string[]
): Promise<boolean> {
  const { subject, html } = generateInvestorLaunchEventEmail({
    recipientName,
    recipientEmail,
    language
  });

  return sendLuxuryEmail({
    to: recipientEmail,
    cc: ccEmails,
    subject,
    html
  });
}
