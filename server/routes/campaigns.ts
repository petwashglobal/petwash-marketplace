/**
 * 📧 MARKETING CAMPAIGNS API
 * Send bulk personalized emails/SMS to customers using templates
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  crmEmailTemplates, 
  crmSmsTemplates,
  crmCommunicationLogs,
  customers,
  users
} from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { EmailService } from '../emailService';
import { GoogleMessagingService } from '../services/GoogleMessagingService';
import { replaceTemplates, validateTemplate, type TemplateContext } from '../lib/template-engine';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const router = Router();

// SMART SCHEMA (2025 Pattern) - Using .describe() for AI context
const sendCampaignSchema = z.object({
  templateId: z.number().int().positive()
    .describe('Email or SMS template ID from respective templates table'),
  channel: z.enum(['email', 'sms'])
    .describe('Communication channel (email/SMS have separate template IDs)'),
  segment: z.enum(['all', 'loyal_customers', 'new_customers', 'club_members', 'custom'])
    .describe('Customer segment to target'),
  customRecipients: z.array(z.string().email()).optional()
    .describe('Custom email list (only used when segment is custom)'),
  testMode: z.boolean().optional().default(false)
    .describe('Test mode sends to single contact instead of mass send'),
  testEmail: z.string().email().optional()
    .describe('Test email address for email campaign testing'),
  testPhone: z.string().optional()
    .describe('Test phone number for SMS campaign testing'),
  locale: z.enum(['he', 'en']).optional().default('he')
    .describe('Language for email/SMS content (Hebrew or English)'),
});

type SendCampaignRequest = z.infer<typeof sendCampaignSchema>;

/**
 * POST /api/campaigns/send
 * Send personalized campaign to customer segment
 * 
 * NOTE: Email and SMS templates have SEPARATE IDs in different tables.
 * To send both email and SMS, make two separate API calls with different templateIds.
 */
router.post('/send', async (req: Request, res: Response) => {
  const correlationId = nanoid();
  
  try {
    // Use safeParse to check data without crashing the app
    const result = sendCampaignSchema.safeParse(req.body);
    
    if (!result.success) {
      logger.warn(`[Campaign ${correlationId}] Validation failed`, result.error.format());
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.format(),
      });
    }
    
    const campaign = result.data;
    
    logger.info(`[Campaign ${correlationId}] Starting campaign send`, {
      templateId: campaign.templateId,
      channel: campaign.channel,
      segment: campaign.segment,
      testMode: campaign.testMode,
    });
    
    // ====================================
    // 1. FETCH TEMPLATE (CHANNEL-SPECIFIC)
    // ====================================
    let emailTemplate: any = null;
    let smsTemplate: any = null;
    
    // CRITICAL FIX: Separate template lookups by channel
    // Email and SMS templates have different IDs in different tables
    
    if (campaign.channel === 'email') {
      // EMAIL-ONLY: Fetch from email templates table
      const [template] = await db
        .select()
        .from(crmEmailTemplates)
        .where(
          and(
            eq(crmEmailTemplates.id, campaign.templateId),
            eq(crmEmailTemplates.isActive, true)
          )
        )
        .limit(1);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Email template not found or inactive',
        });
      }
      
      // Validate template syntax
      const validation = validateTemplate(template.htmlContent);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Template has invalid syntax',
          details: validation.errors,
        });
      }
      
      emailTemplate = template;
      
    } else if (campaign.channel === 'sms') {
      // SMS-ONLY: Fetch from SMS templates table
      const [template] = await db
        .select()
        .from(crmSmsTemplates)
        .where(
          and(
            eq(crmSmsTemplates.id, campaign.templateId),
            eq(crmSmsTemplates.isActive, true)
          )
        )
        .limit(1);
      
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'SMS template not found or inactive',
        });
      }
      
      smsTemplate = template;
    }
    
    // ====================================
    // 2. GET RECIPIENT LIST
    // ====================================
    let recipients: Array<{
      email: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      loyaltyTier?: string;
      loyaltyPoints?: number;
      customerId?: number;
      userId?: string;
    }> = [];
    
    if (campaign.testMode) {
      // TEST MODE: Send to test contact only
      if (campaign.channel === 'email' && campaign.testEmail) {
        recipients = [{
          email: campaign.testEmail,
          phone: campaign.testPhone,
          firstName: 'Test',
          lastName: 'User',
          loyaltyTier: 'gold',
          loyaltyPoints: 150,
        }];
        logger.info(`[Campaign ${correlationId}] TEST MODE - Email to ${campaign.testEmail}`);
      } else if (campaign.channel === 'sms' && campaign.testPhone) {
        recipients = [{
          email: 'test@example.com', // Placeholder
          phone: campaign.testPhone,
          firstName: 'Test',
          lastName: 'User',
          loyaltyTier: 'gold',
          loyaltyPoints: 150,
        }];
        logger.info(`[Campaign ${correlationId}] TEST MODE - SMS to ${campaign.testPhone}`);
      } else {
        return res.status(400).json({
          success: false,
          error: `Test mode requires ${campaign.channel === 'email' ? 'testEmail' : 'testPhone'} parameter`,
        });
      }
      
    } else if (campaign.segment === 'custom' && campaign.customRecipients) {
      // CUSTOM SEGMENT: Use provided email list
      for (const email of campaign.customRecipients) {
        // Try to fetch customer data
        const [customer] = await db
          .select({
            customerId: customers.customerId,
            email: customers.email,
            phone: customers.phone,
            firstName: customers.firstName,
            lastName: customers.lastName,
            loyaltyTier: customers.loyaltyTier,
            loyaltyPoints: customers.loyaltyPoints,
          })
          .from(customers)
          .where(eq(customers.email, email))
          .limit(1);
        
        if (customer) {
          recipients.push(customer);
        } else {
          // Not in customers table, check users table
          const [user] = await db
            .select({
              userId: users.id,
              email: users.email,
              phone: users.phone,
              firstName: users.firstName,
              lastName: users.lastName,
              loyaltyTier: users.loyaltyTier,
              loyaltyPoints: users.loyaltyPoints,
            })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
          
          if (user) {
            recipients.push(user as any);
          }
        }
      }
      
    } else {
      // SEGMENT-BASED: Query database
      let query = db
        .select({
          customerId: customers.customerId,
          email: customers.email,
          phone: customers.phone,
          firstName: customers.firstName,
          lastName: customers.lastName,
          loyaltyTier: customers.loyaltyTier,
          loyaltyPoints: customers.loyaltyPoints,
        })
        .from(customers)
        .where(sql`${customers.email} IS NOT NULL`);
      
      // Apply segment filters
      if (campaign.segment === 'loyal_customers') {
        query = query.where(
          inArray(customers.loyaltyTier, ['silver', 'gold', 'platinum', 'diamond'])
        ) as any;
      } else if (campaign.segment === 'new_customers') {
        query = query.where(eq(customers.loyaltyTier, 'new')) as any;
      } else if (campaign.segment === 'club_members') {
        query = query.where(eq(customers.isClubMember, true)) as any;
      }
      
      recipients = await query;
    }
    
    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No recipients found for selected segment',
      });
    }
    
    logger.info(`[Campaign ${correlationId}] Found ${recipients.length} recipients`);
    
    // ====================================
    // 3. SEND PERSONALIZED MESSAGES
    // ====================================
    const results = {
      totalRecipients: recipients.length,
      emailsSent: 0,
      emailsFailed: 0,
      smsSent: 0,
      smsFailed: 0,
      errors: [] as string[],
    };
    
    for (const recipient of recipients) {
      try {
        // Build template context for personalization
        const context: TemplateContext = {
          customerId: recipient.customerId,
          userId: recipient.userId,
          firstName: recipient.firstName || '',
          lastName: recipient.lastName || '',
          email: recipient.email,
          phone: recipient.phone || '',
          loyaltyTier: recipient.loyaltyTier || 'new',
          loyaltyPoints: recipient.loyaltyPoints || 0,
        };
        
        // ===== SEND EMAIL =====
        if (emailTemplate && recipient.email) {
          try {
            // Personalize subject and content
            const personalizedSubject = replaceTemplates(emailTemplate.subject, context, campaign.locale);
            const personalizedContent = replaceTemplates(emailTemplate.htmlContent, context, campaign.locale);
            
            // Send email
            const sent = await EmailService.sendEmail(
              recipient.email,
              personalizedSubject,
              personalizedContent
            );
            
            if (sent) {
              results.emailsSent++;
              
              // Log communication
              await db.insert(crmCommunicationLogs).values({
                customerId: recipient.customerId || null,
                userId: recipient.userId || null,
                email: recipient.email,
                channel: 'email',
                direction: 'outbound',
                subject: personalizedSubject,
                bodyPreview: personalizedContent.substring(0, 200),
                emailTemplateId: emailTemplate.id,
                deliveryStatus: 'sent',
                deliveryProvider: 'sendgrid',
              });
              
              logger.info(`[Campaign ${correlationId}] Email sent to ${recipient.email}`);
            } else {
              results.emailsFailed++;
              results.errors.push(`Email failed for ${recipient.email}`);
            }
          } catch (emailError: any) {
            results.emailsFailed++;
            results.errors.push(`Email error for ${recipient.email}: ${emailError.message}`);
            logger.error(`[Campaign ${correlationId}] Email error`, emailError, { email: recipient.email });
          }
        }
        
        // ===== SEND SMS =====
        if (smsTemplate && recipient.phone) {
          try {
            // Personalize SMS content
            const personalizedSms = replaceTemplates(smsTemplate.content, context, campaign.locale);
            
            // Send SMS via Google Messaging Service (WhatsApp)
            const smsResult = await GoogleMessagingService.sendWhatsAppMessage(
              recipient.phone,
              personalizedSms
            );
            
            if (smsResult.success) {
              results.smsSent++;
              
              // Log communication
              await db.insert(crmCommunicationLogs).values({
                customerId: recipient.customerId || null,
                userId: recipient.userId || null,
                phone: recipient.phone,
                channel: 'sms',
                direction: 'outbound',
                bodyPreview: personalizedSms,
                smsTemplateId: smsTemplate.id,
                deliveryStatus: 'sent',
                deliveryProvider: 'google_fcm',
              });
              
              logger.info(`[Campaign ${correlationId}] SMS sent to ${recipient.phone}`);
            } else {
              results.smsFailed++;
              results.errors.push(`SMS failed for ${recipient.phone}`);
            }
          } catch (smsError: any) {
            results.smsFailed++;
            results.errors.push(`SMS error for ${recipient.phone}: ${smsError.message}`);
            logger.error(`[Campaign ${correlationId}] SMS error`, smsError, { phone: recipient.phone });
          }
        }
        
      } catch (recipientError: any) {
        logger.error(`[Campaign ${correlationId}] Error processing recipient`, recipientError, {
          recipient: recipient.email });
        results.errors.push(`Recipient ${recipient.email}: ${recipientError.message}`);
      }
    }
    
    // ====================================
    // 4. UPDATE TEMPLATE USAGE
    // ====================================
    if (emailTemplate && results.emailsSent > 0) {
      await db
        .update(crmEmailTemplates)
        .set({
          timesUsed: sql`${crmEmailTemplates.timesUsed} + ${results.emailsSent}`,
          lastUsed: new Date(),
        })
        .where(eq(crmEmailTemplates.id, emailTemplate.id));
    }
    
    if (smsTemplate && results.smsSent > 0) {
      await db
        .update(crmSmsTemplates)
        .set({
          timesUsed: sql`${crmSmsTemplates.timesUsed} + ${results.smsSent}`,
          lastUsed: new Date(),
        })
        .where(eq(crmSmsTemplates.id, smsTemplate.id));
    }
    
    // ====================================
    // 5. RETURN RESULTS
    // ====================================
    logger.info(`[Campaign ${correlationId}] Campaign completed`, results);
    
    res.json({
      success: true,
      message: 'Campaign sent successfully',
      correlationId,
      results,
    });
    
  } catch (error: any) {
    logger.error(`[Campaign ${correlationId}] Campaign failed`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Campaign sending failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/campaigns/preview
 * Preview personalized template with sample data
 */
router.get('/preview', async (req: Request, res: Response) => {
  try {
    const { templateId, channel } = req.query;
    
    if (!templateId || !channel) {
      return res.status(400).json({
        success: false,
        error: 'templateId and channel are required',
      });
    }
    
    // Sample customer context for preview
    const sampleContext: TemplateContext = {
      firstName: 'Sarah',
      lastName: 'Cohen',
      email: 'sarah.cohen@example.com',
      phone: '+972549999999',
      loyaltyTier: 'gold',
      loyaltyPoints: 250,
      totalWashes: 15,
      petName: 'Max',
      petBreed: 'Golden Retriever',
    };
    
    if (channel === 'email') {
      const [template] = await db
        .select()
        .from(crmEmailTemplates)
        .where(eq(crmEmailTemplates.id, Number(templateId)))
        .limit(1);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      const previewSubject = replaceTemplates(template.subject, sampleContext, 'he');
      const previewContent = replaceTemplates(template.htmlContent, sampleContext, 'he');
      
      res.json({
        success: true,
        preview: {
          subject: previewSubject,
          content: previewContent,
          sampleData: sampleContext,
        },
      });
      
    } else if (channel === 'sms') {
      const [template] = await db
        .select()
        .from(crmSmsTemplates)
        .where(eq(crmSmsTemplates.id, Number(templateId)))
        .limit(1);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      const previewContent = replaceTemplates(template.content, sampleContext, 'he');
      
      res.json({
        success: true,
        preview: {
          content: previewContent,
          characterCount: previewContent.length,
          sampleData: sampleContext,
        },
      });
    }
    
  } catch (error: any) {
    logger.error('Campaign preview failed', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
