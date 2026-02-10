/**
 * Email Privacy Controls
 * Manages SendGrid tracking pixel opt-out
 * PRIVACY: Tracking pixels disabled by default
 */

import sgMail from './sendgrid';
import { logger } from './logger';

export interface EmailOptions {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  userId?: string;
}

/**
 * Check if user has consented to email tracking (open tracking, click tracking)
 */
async function hasEmailTrackingConsent(userId?: string): Promise<boolean> {
  // PRIVACY FIX: Email tracking disabled by default
  if (!userId) {
    return false; // No consent for anonymous users
  }
  
  try {
    const { db } = await import('./db');
    const { users } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const [user] = await db
      .select({ emailTrackingConsent: users.emailTrackingConsent })
      .from(users)
      .where(eq(users.id, userId));
    
    return user?.emailTrackingConsent ?? false;
  } catch (error) {
    logger.error('[Email] Failed to check email tracking consent', error);
    return false; // Default to NO TRACKING on error
  }
}

/**
 * Send email with privacy-respecting settings
 * PRIVACY: Disables tracking pixels unless user consents
 */
export async function sendPrivacyRespectingEmail(options: EmailOptions): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn('[Email] SendGrid API key not configured');
    return false;
  }

  try {
    const hasConsent = await hasEmailTrackingConsent(options.userId);

    // Build email message
    const msg: any = {
      to: options.to,
      from: options.from,
      subject: options.subject,
      text: options.text,
      html: options.html,
      templateId: options.templateId,
      dynamicTemplateData: options.dynamicTemplateData,
      
      // PRIVACY: Disable tracking unless user consented
      trackingSettings: {
        clickTracking: {
          enable: hasConsent,
          enableText: hasConsent,
        },
        openTracking: {
          enable: hasConsent,
        },
        subscriptionTracking: {
          enable: false, // Always disable subscription tracking footer
        },
      },
    };

    await sgMail.send(msg);

    logger.info('[Email] Sent email', {
      to: options.to,
      subject: options.subject,
      trackingEnabled: hasConsent,
    });

    return true;
  } catch (error) {
    logger.error('[Email] Failed to send email', error);
    return false;
  }
}

