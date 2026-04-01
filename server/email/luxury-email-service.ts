/**
 * Luxury Email Service - 2025
 * High-end email sending with beautiful templates
 */
import crypto from 'crypto';

import { MailService } from '@sendgrid/mail';
import { logger } from '../lib/logger';
import { generateBackendTeamInvitation } from './templates/backend-team-invitation-2025';
import { generatePartnerInvitation } from './templates/partner-invitation-2025';
import { generatePartnerInvitationHebrew } from './templates/partner-invitation-hebrew-2025';
import { generateWorkflowNotification } from './templates/workflow-notification-2025';
import { generateLuxuryLaunchEmail } from './templates/luxury-launch-2025';
import { generateInvestorLaunchEventEmail } from './templates/luxury-investor-launch-event-2025';
import { generateLuxuryWelcomeEmail } from './templates/welcome-luxury-2026';
import { createMailService, isSendGridConfigured } from '../lib/sendgrid';
import { emailSpendGuard } from '../services/EmailSpendGuard';

const FROM_EMAIL = 'noreply@petwash.co.il';
const FROM_NAME = 'Pet Wash™';

let sgMail: MailService | null = isSendGridConfigured() ? createMailService() : null;

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

  const guard = emailSpendGuard.check('LuxuryEmail', options.to);
  if (!guard.allowed) {
    logger.error('[Luxury Email] 🔴 Send BLOCKED by EmailSpendGuard', { reason: guard.reason, to: options.to });
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
    await emailSpendGuard.record('LuxuryEmail', options.to, options.subject);
    
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
 * Send Luxury Welcome Email (2026 Design)
 * Unified template for both customer and provider signups
 */
export async function sendLuxuryWelcomeCustomer(
  email: string,
  firstName: string,
  language: 'he' | 'en' = 'he'
): Promise<boolean> {
  const { subject, html } = generateLuxuryWelcomeEmail({
    firstName,
    variant: 'customer',
    language,
  });

  logger.info('[Luxury Email] Sending customer welcome (2026)', { email, firstName });
  return sendLuxuryEmail({ to: email, subject, html });
}

export async function sendLuxuryWelcomeProvider(
  email: string,
  firstName: string,
  options?: {
    language?: 'he' | 'en';
    membershipNumber?: string;
    serviceTypes?: string[];
  }
): Promise<boolean> {
  const { subject, html } = generateLuxuryWelcomeEmail({
    firstName,
    variant: 'provider',
    language: options?.language || 'he',
    membershipNumber: options?.membershipNumber,
    serviceTypes: options?.serviceTypes,
  });

  logger.info('[Luxury Email] Sending provider welcome (2026)', { email, firstName, membershipNumber: options?.membershipNumber });
  return sendLuxuryEmail({ to: email, subject, html });
}

/**
 * Send Welcome Email to New Customer
 * Upgraded to 2026 luxury template — 2025 template retired
 */
export async function sendWelcomeEmail(
  email: string,
  firstName: string,
  petName?: string,
  petType?: string,
  language?: 'he' | 'en'
): Promise<boolean> {
  const { subject, html } = generateLuxuryWelcomeEmail({
    firstName,
    variant: 'customer',
    language: language || 'he',
  });

  logger.info('[Luxury Email] Sending customer welcome (2026 via sendWelcomeEmail)', { email, firstName });
  return sendLuxuryEmail({ to: email, subject, html });
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
    originator: options?.originator || '⁦Pet Wash™⁩ System',
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

// ========================================
// REGISTRATION CONFIRMATION EMAILS
// ========================================

import {
  generateNewUserConfirmationEmail,
  generateLoyaltyEnrollmentEmail,
  generateProviderEnrollmentEmail
} from './templates/registration-confirmation-2025';
import { generateFranchiseApplicationEmail } from './templates/welcome-franchise-application-2026';
import { generateMembershipConfirmationEmail } from './templates/membership-confirmation-2026';
import { generateEGiftActivationEmail } from './templates/egift-activation-2026';
import { generateLuxuryClubEmail, type ClubEmailEventKind, type LuxuryClubEmailParams } from './templates/luxury-club-2026';
import { TIER_CONFIGS, type LoyaltyTier } from '../../shared/schema-loyalty';

/**
 * Send New User Registration Confirmation Email
 */
export async function sendNewUserConfirmation(
  email: string,
  firstName: string,
  language: 'he' | 'en' = 'he'
): Promise<boolean> {
  const { subject, html } = generateNewUserConfirmationEmail({
    firstName,
    email,
    language
  });

  logger.info('[Registration Email] Sending new user confirmation', { email, firstName });
  return sendLuxuryEmail({ to: email, subject, html });
}

/**
 * Send Loyalty Program Enrollment Confirmation Email
 */
export async function sendLoyaltyEnrollmentConfirmation(
  email: string,
  firstName: string,
  tier: string = 'bronze',
  points: number = 0,
  language: 'he' | 'en' = 'he'
): Promise<boolean> {
  const { subject, html } = generateLoyaltyEnrollmentEmail({
    firstName,
    email,
    tier,
    points,
    language
  });

  logger.info('[Registration Email] Sending loyalty enrollment confirmation', { email, firstName, tier });
  return sendLuxuryEmail({ to: email, subject, html });
}

/**
 * Send Provider/Subcontractor Enrollment Confirmation Email
 */
export async function sendProviderEnrollmentConfirmation(
  email: string,
  firstName: string,
  lastName: string,
  serviceTypes: string[],
  applicationId: number,
  language: 'he' | 'en' = 'he'
): Promise<boolean> {
  const { subject, html } = generateProviderEnrollmentEmail({
    firstName,
    lastName,
    email,
    serviceTypes,
    applicationId,
    language
  });

  logger.info('[Registration Email] Sending provider enrollment confirmation', { 
    email, 
    firstName, 
    applicationId,
    serviceTypes 
  });
  return sendLuxuryEmail({ to: email, subject, html });
}

export async function sendFranchiseApplicationConfirmation(
  email: string,
  firstName: string,
  lastName: string,
  options?: {
    companyName?: string;
    country?: string;
    investmentRange?: string;
    applicationId?: string | number;
    language?: 'he' | 'en';
  }
): Promise<boolean> {
  const { subject, html } = generateFranchiseApplicationEmail({
    firstName,
    lastName,
    email,
    language: options?.language || 'he',
    companyName: options?.companyName,
    country: options?.country,
    investmentRange: options?.investmentRange,
    applicationId: options?.applicationId,
  });

  logger.info('[Registration Email] Sending franchise application confirmation', { email, firstName });
  return sendLuxuryEmail({ to: email, subject, html });
}

export async function sendMembershipConfirmation(
  email: string,
  firstName: string,
  options?: {
    membershipId?: string;
    tier?: string;
    points?: number;
    language?: 'he' | 'en';
  }
): Promise<boolean> {
  const membershipId = options?.membershipId || `PWM-${Date.now().toString(36).toUpperCase()}`;
  const { subject, html } = generateMembershipConfirmationEmail({
    firstName,
    email,
    membershipId,
    tier: options?.tier || 'bronze',
    points: options?.points || 100,
    language: options?.language || 'he'
  });

  logger.info('[Membership Email] Sending membership confirmation', { email, firstName, membershipId });
  return sendLuxuryEmail({ to: email, subject, html });
}

export async function sendEGiftActivation(
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  options?: {
    giftValue?: number;
    currency?: string;
    giftCode?: string;
    serialNumber?: string;
    personalMessage?: string;
    expiresAt?: string;
    language?: 'he' | 'en';
  }
): Promise<boolean> {
  const giftCode = options?.giftCode || `PW-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const serialNumber = options?.serialNumber || `PWG${Date.now().toString(36).substring(0, 8).toUpperCase()}`;
  const expiresAt = options?.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(
    options?.language === 'he' ? 'he-IL' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const { subject, html } = generateEGiftActivationEmail({
    recipientName,
    recipientEmail,
    senderName,
    giftValue: options?.giftValue || 200,
    currency: options?.currency || 'ILS',
    giftCode,
    serialNumber,
    personalMessage: options?.personalMessage,
    expiresAt,
    language: options?.language || 'he'
  });

  logger.info('[EGift Email] Sending e-gift activation', { recipientEmail, recipientName, senderName, giftCode });
  return sendLuxuryEmail({ to: recipientEmail, subject, html });
}

export async function sendClubWelcomeEmail(
  email: string,
  recipientName: string,
  options?: {
    tier?: LoyaltyTier;
    points?: number;
    language?: 'he' | 'en';
  }
): Promise<boolean> {
  const tier = options?.tier || 'bronze';
  const lang = options?.language || 'he';
  const points = options?.points || 100;

  const { subject, html } = generateLuxuryClubEmail({
    kind: 'welcome',
    recipientName,
    recipientEmail: email,
    language: lang,
    tier,
    walletBalanceText: `${points} ${lang === 'he' ? 'נקודות' : 'points'}`,
    memberSinceText: lang === 'he'
      ? `חבר מועדון מאז ${new Date().getFullYear()}`
      : `Member since ${new Date().getFullYear()}`,
  });

  logger.info('[Club Email] Sending welcome email', { email, recipientName, tier });
  return sendLuxuryEmail({ to: email, subject, html });
}

export async function sendTierUpgradeEmail(
  email: string,
  recipientName: string,
  previousTier: LoyaltyTier,
  newTier: LoyaltyTier,
  options?: {
    points?: number;
    language?: 'he' | 'en';
  }
): Promise<boolean> {
  const lang = options?.language || 'he';
  const points = options?.points || 0;

  const { subject, html } = generateLuxuryClubEmail({
    kind: 'tier_upgrade',
    recipientName,
    recipientEmail: email,
    language: lang,
    tier: newTier,
    previousTier,
    newTier,
    walletBalanceText: points > 0 ? `${points} ${lang === 'he' ? 'נקודות' : 'points'}` : undefined,
    memberSinceText: lang === 'he'
      ? `חבר מועדון מאז ${new Date().getFullYear()}`
      : `Member since ${new Date().getFullYear()}`,
  });

  logger.info('[Club Email] Sending tier upgrade email', { email, recipientName, previousTier, newTier });
  return sendLuxuryEmail({ to: email, subject, html });
}

export async function sendPurchaseRewardEmail(
  email: string,
  recipientName: string,
  pointsEarned: number,
  newBalance: number,
  options?: {
    tier?: LoyaltyTier;
    language?: 'he' | 'en';
  }
): Promise<boolean> {
  const lang = options?.language || 'he';

  const { subject, html } = generateLuxuryClubEmail({
    kind: 'purchase_reward',
    recipientName,
    recipientEmail: email,
    language: lang,
    tier: options?.tier || 'bronze',
    pointsEarned,
    newPoints: newBalance,
    walletBalanceText: `${newBalance} ${lang === 'he' ? 'נקודות' : 'points'}`,
  });

  logger.info('[Club Email] Sending purchase reward email', { email, recipientName, pointsEarned, newBalance });
  return sendLuxuryEmail({ to: email, subject, html });
}

export async function sendClubEventEmail(
  email: string,
  recipientName: string,
  options?: {
    heroTitle?: string;
    heroSubtitle?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    tier?: LoyaltyTier;
    language?: 'he' | 'en';
    benefits?: { title: string; desc: string }[];
    moments?: { label: string; desc: string }[];
  }
): Promise<boolean> {
  const lang = options?.language || 'he';

  const { subject, html } = generateLuxuryClubEmail({
    kind: 'club_event',
    recipientName,
    recipientEmail: email,
    language: lang,
    tier: options?.tier || 'bronze',
    heroTitle: options?.heroTitle,
    heroSubtitle: options?.heroSubtitle,
    primaryCtaLabel: options?.ctaLabel,
    primaryCtaUrl: options?.ctaUrl,
    benefits: options?.benefits,
    moments: options?.moments,
  });

  logger.info('[Club Email] Sending club event email', { email, recipientName });
  return sendLuxuryEmail({ to: email, subject, html });
}

export function detectTierUpgrade(previousLifetimePoints: number, newLifetimePoints: number): { upgraded: boolean; previousTier: LoyaltyTier; newTier: LoyaltyTier } {
  const tiers = TIER_CONFIGS
    .map(t => ({ id: t.id as LoyaltyTier, threshold: t.threshold }))
    .sort((a, b) => b.threshold - a.threshold);

  const previousTier = tiers.find(t => previousLifetimePoints >= t.threshold)?.id || 'bronze';
  const newTier = tiers.find(t => newLifetimePoints >= t.threshold)?.id || 'bronze';

  return {
    upgraded: previousTier !== newTier,
    previousTier,
    newTier,
  };
}
