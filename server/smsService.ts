import type { CrmSmsTemplate, CrmCommunicationLog, InsertCrmCommunicationLog } from '@shared/schema';
import { storage } from './storage';
import { nanoid } from 'nanoid';
import { logger } from './lib/logger';
import { replaceTemplates, type TemplateContext } from './lib/template-engine';

// Twilio configuration - supports both Auth Token and API Key methods
let twilioClient: any = null;
let twilioConfigured = false;

if (process.env.TWILIO_ACCOUNT_SID) {
  try {
    const twilio = require('twilio');
    
    // Preferred: API Key authentication (more secure, revocable)
    if (process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET) {
      twilioClient = twilio(
        process.env.TWILIO_API_KEY,
        process.env.TWILIO_API_SECRET,
        { accountSid: process.env.TWILIO_ACCOUNT_SID }
      );
      twilioConfigured = true;
      logger.info('✅ Twilio SMS configured successfully (API Key authentication)');
    }
    // Fallback: Auth Token authentication
    else if (process.env.TWILIO_AUTH_TOKEN) {
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      twilioConfigured = true;
      logger.info('✅ Twilio SMS configured successfully (Auth Token authentication)');
    }
    else {
      logger.warn('Twilio API Key or Auth Token required - SMS functionality will be disabled');
    }
  } catch (error) {
    logger.warn('Twilio SDK not available, SMS functionality will be simulated');
  }
} else {
  logger.warn('Twilio Account SID not found - SMS functionality will be disabled');
}

export class SmsService {
  private static readonly FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+972549833355'; // Pet Wash™ WhatsApp business line
  private static readonly SUPPORT_EMAIL = 'Support@PetWash.co.il';
  
  // Rate limiting for SMS sends (more restrictive than email)
  private static sendCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private static readonly RATE_LIMIT_HOUR = 20; // SMS per hour per recipient
  private static readonly RATE_LIMIT_DAY = 50; // SMS per day per recipient
  
  // Cost estimates (in ILS, will be updated with real Twilio pricing)
  private static readonly COST_PER_SMS = 0.15; // Estimated cost per SMS in Israel
  private static readonly COST_PER_SEGMENT = 0.15;

  /**
   * Check rate limiting for SMS sending
   */
  private static checkRateLimit(phoneNumber: string): boolean {
    const now = Date.now();
    const hourKey = `${phoneNumber}-hour`;
    const dayKey = `${phoneNumber}-day`;
    
    // Check hourly limit
    const hourData = this.sendCounts.get(hourKey);
    if (hourData) {
      if (now < hourData.resetTime) {
        if (hourData.count >= this.RATE_LIMIT_HOUR) {
          return false;
        }
      } else {
        this.sendCounts.delete(hourKey);
      }
    }
    
    // Check daily limit
    const dayData = this.sendCounts.get(dayKey);
    if (dayData) {
      if (now < dayData.resetTime) {
        if (dayData.count >= this.RATE_LIMIT_DAY) {
          return false;
        }
      } else {
        this.sendCounts.delete(dayKey);
      }
    }
    
    return true;
  }

  /**
   * Update rate limiting counters
   */
  private static updateRateLimit(phoneNumber: string): void {
    const now = Date.now();
    const hourKey = `${phoneNumber}-hour`;
    const dayKey = `${phoneNumber}-day`;
    
    // Update hourly counter
    const hourData = this.sendCounts.get(hourKey);
    if (hourData && now < hourData.resetTime) {
      hourData.count++;
    } else {
      this.sendCounts.set(hourKey, {
        count: 1,
        resetTime: now + (60 * 60 * 1000) // 1 hour
      });
    }
    
    // Update daily counter
    const dayData = this.sendCounts.get(dayKey);
    if (dayData && now < dayData.resetTime) {
      dayData.count++;
    } else {
      this.sendCounts.set(dayKey, {
        count: 1,
        resetTime: now + (24 * 60 * 60 * 1000) // 24 hours
      });
    }
  }

  /**
   * Check if current time is within quiet hours (Israeli business hours)
   */
  private static isQuietHours(): boolean {
    const now = new Date();
    const israelTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
    const hour = israelTime.getHours();
    const day = israelTime.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Quiet hours: 9 PM - 9 AM (21:00 - 09:00) - more restrictive for SMS
    // Also respect Shabbat: Friday 6 PM - Saturday 10 PM
    const isNightHours = hour >= 21 || hour < 9;
    const isShabbat = (day === 5 && hour >= 18) || (day === 6 && hour < 22);
    
    return isNightHours || isShabbat;
  }

  /**
   * Validate and format Israeli phone number
   */
  private static formatPhoneNumber(phoneNumber: string): string | null {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Israeli phone number patterns
    if (digits.startsWith('972')) {
      // International format
      if (digits.length === 12) {
        return '+' + digits;
      }
    } else if (digits.startsWith('05') || digits.startsWith('02') || digits.startsWith('03') || digits.startsWith('04') || digits.startsWith('08') || digits.startsWith('09')) {
      // National format
      if (digits.length === 10) {
        return '+972' + digits.substring(1);
      }
    } else if (digits.startsWith('5') && digits.length === 9) {
      // Mobile without leading 0
      return '+972' + digits;
    }
    
    return null; // Invalid format
  }

  /**
   * Calculate SMS segments and cost
   */
  private static calculateSmsMetrics(content: string): {
    characterCount: number;
    segments: number;
    estimatedCost: number;
  } {
    const characterCount = content.length;
    
    // SMS segment calculation (Hebrew and English support)
    let segments = 1;
    if (characterCount <= 70) {
      segments = 1; // Hebrew SMS limit
    } else if (characterCount <= 160) {
      segments = 1; // English SMS limit
    } else {
      // Multi-part SMS (67 chars per segment for Hebrew, 153 for English)
      segments = Math.ceil(characterCount / 67); // Use Hebrew limit as default
    }
    
    const estimatedCost = segments * this.COST_PER_SEGMENT;
    
    return {
      characterCount,
      segments,
      estimatedCost
    };
  }

  /**
   * Replace template variables in SMS content using centralized template engine
   */
  private static replaceTemplateVariables(
    content: string, 
    variables: Record<string, any>,
    customerData?: any
  ): string {
    // Build template context from customer data and variables
    const context: TemplateContext = {
      ...variables,
      ...customerData,
      // Ensure proper field mapping
      firstName: customerData?.firstName || variables.firstName,
      lastName: customerData?.lastName || variables.lastName,
      email: customerData?.email || variables.email,
      phone: customerData?.phone || variables.phone,
      loyaltyTier: customerData?.loyaltyTier || variables.loyaltyTier,
      loyaltyPoints: customerData?.loyaltyPoints || variables.loyaltyPoints,
    };
    
    return replaceTemplates(content, context, 'he');
  }

  /**
   * Send SMS using template with full tracking
   */
  static async sendTemplateSms({
    templateId,
    recipientPhone,
    recipientName,
    variables = {},
    customerData,
    communicationId,
    skipQuietHours = false,
    dryRun = false
  }: {
    templateId: number;
    recipientPhone: string;
    recipientName?: string;
    variables?: Record<string, any>;
    customerData?: any;
    communicationId?: number;
    skipQuietHours?: boolean;
    dryRun?: boolean;
  }): Promise<{
    success: boolean;
    messageId?: string;
    logId?: number;
    error?: string;
    estimatedCost?: number;
  }> {
    try {
      // Format phone number
      const formattedPhone = this.formatPhoneNumber(recipientPhone);
      if (!formattedPhone) {
        throw new Error('Invalid phone number format');
      }
      
      // Check rate limiting
      if (!dryRun && !this.checkRateLimit(formattedPhone)) {
        throw new Error('Rate limit exceeded for recipient');
      }
      
      // Check quiet hours
      if (!dryRun && !skipQuietHours && this.isQuietHours()) {
        throw new Error('Cannot send SMS during quiet hours (9 PM - 9 AM or Shabbat)');
      }
      
      // Get SMS template
      const template = await storage.getSmsTemplate(templateId);
      if (!template || !template.isActive) {
        throw new Error('SMS template not found or inactive');
      }
      
      // Process template content
      let content = this.replaceTemplateVariables(
        template.content, variables, customerData
      );
      
      // Calculate SMS metrics
      const metrics = this.calculateSmsMetrics(content);
      
      if (dryRun) {
        return {
          success: true,
          messageId: `dry-run-${nanoid()}`,
          logId: undefined,
          estimatedCost: metrics.estimatedCost
        };
      }
      
      if (!twilioConfigured) {
        logger.info('Twilio not configured - would send SMS:', {
          templateId,
          recipientPhone: formattedPhone,
          content: content.substring(0, 50) + '...',
          estimatedCost: metrics.estimatedCost
        });
        return {
          success: true,
          messageId: `dev-${nanoid()}`,
          logId: undefined,
          estimatedCost: metrics.estimatedCost
        };
      }
      
      // Send SMS (placeholder for Twilio integration)
      const messageId = nanoid();
      
      // Simulate Twilio send
      logger.info('SMS would be sent via Twilio:', {
        from: this.FROM_NUMBER,
        to: formattedPhone,
        body: content,
        segments: metrics.segments,
        cost: metrics.estimatedCost
      });
      
      // TODO: Replace with actual Twilio sending when SDK is available
      /*
      const message = await twilioClient.messages.create({
        from: this.FROM_NUMBER,
        to: formattedPhone,
        body: content
      });
      const messageId = message.sid;
      */
      
      // Update rate limiting
      this.updateRateLimit(formattedPhone);
      
      // Update template usage
      await storage.updateSmsTemplate(templateId, {
        timesUsed: (template.timesUsed || 0) + 1,
        lastUsed: new Date()
      });
      
      // Create communication log if communicationId provided
      let logId: string | undefined;
      if (communicationId) {
        const logData: InsertCrmCommunicationLog = {
          communicationId: String(communicationId),
          smsTemplateId: String(templateId),
          deliveryStatus: 'sent',
          deliveryProvider: 'twilio',
          externalMessageId: messageId,
          estimatedCost: metrics.estimatedCost
        };
        const log = await storage.createCommunicationLog(logData);
        logId = log.id;
      }
      
      logger.info(`Template SMS sent: ${messageId} to ${formattedPhone}`);
      
      return {
        success: true,
        messageId,
        logId,
        estimatedCost: metrics.estimatedCost
      };
      
    } catch (error) {
      logger.error('Failed to send template SMS', error);
      
      // Log error if communicationId provided
      if (communicationId) {
        try {
          await storage.createCommunicationLog({
            communicationId: String(communicationId),
            smsTemplateId: String(templateId),
            deliveryStatus: 'failed',
            deliveryProvider: 'twilio',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
        } catch (logError) {
          logger.error('Failed to log SMS error', logError);
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send bulk SMS with proper rate limiting and safeguards
   */
  static async sendBulkSms({
    templateId,
    recipients,
    variables = {},
    skipQuietHours = false,
    dryRun = false,
    batchSize = 5, // Smaller batches for SMS
    delayBetweenBatches = 2000 // Longer delay for SMS
  }: {
    templateId: number;
    recipients: Array<{
      phone: string;
      name?: string;
      customerId?: number;
      userId?: string;
      variables?: Record<string, any>;
    }>;
    variables?: Record<string, any>;
    skipQuietHours?: boolean;
    dryRun?: boolean;
    batchSize?: number;
    delayBetweenBatches?: number;
  }): Promise<{
    totalSent: number;
    totalFailed: number;
    totalCost: number;
    results: Array<{
      phone: string;
      success: boolean;
      messageId?: string;
      error?: string;
      cost?: number;
    }>;
  }> {
    const results: Array<{
      phone: string;
      success: boolean;
      messageId?: string;
      error?: string;
      cost?: number;
    }> = [];
    
    let totalSent = 0;
    let totalFailed = 0;
    let totalCost = 0;
    
    // Process in batches
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (recipient) => {
        try {
          // Get customer data if available
          let customerData;
          if (recipient.customerId) {
            customerData = await storage.getCustomer(recipient.customerId);
          } else if (recipient.userId) {
            customerData = await storage.getUser(recipient.userId);
          }
          
          // Check customer preferences for SMS (skip opt-out check for now - not all customers have this field)
          // if (customerData && !customerData.reminders && !skipQuietHours) {
          //   return {
          //     phone: recipient.phone,
          //     success: false,
          //     error: 'Customer opted out of SMS notifications',
          //     cost: 0
          //   };
          // }
          
          const mergedVariables = { ...variables, ...recipient.variables };
          
          const result = await this.sendTemplateSms({
            templateId,
            recipientPhone: recipient.phone,
            recipientName: recipient.name,
            variables: mergedVariables,
            customerData,
            skipQuietHours,
            dryRun
          });
          
          return {
            phone: recipient.phone,
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            cost: result.estimatedCost || 0
          };
          
        } catch (error) {
          return {
            phone: recipient.phone,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            cost: 0
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Count results and costs
      batchResults.forEach(result => {
        if (result.success) {
          totalSent++;
        } else {
          totalFailed++;
        }
        totalCost += result.cost || 0;
      });
      
      // Delay between batches (except for last batch)
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
    
    logger.info(`Bulk SMS completed: ${totalSent} sent, ${totalFailed} failed, ₪${totalCost.toFixed(2)} total cost`);
    
    return {
      totalSent,
      totalFailed,
      totalCost,
      results
    };
  }

  /**
   * Send appointment reminder SMS
   */
  static async sendAppointmentReminder({
    reminderId,
    customerData,
    appointmentData,
    dryRun = false
  }: {
    reminderId: string;
    customerData: any;
    appointmentData: any;
    dryRun?: boolean;
  }): Promise<boolean> {
    try {
      const reminder = await storage.getAppointmentReminder(reminderId);
      if (!reminder || reminder.isCancelled) {
        return false;
      }
      
      // Check if SMS should be sent
      if (reminder.reminderType !== 'sms' && reminder.reminderType !== 'both') {
        return true; // Not an SMS reminder
      }
      
      if (reminder.smsSent) {
        return true; // Already sent
      }
      
      if (!customerData.phone) {
        await storage.updateAppointmentReminder(reminderId, {
          status: 'failed',
          lastError: 'Customer phone number not available'
        });
        return false;
      }
      
      // Get SMS template if specified
      let template;
      if (reminder.smsTemplateId) {
        template = await storage.getSmsTemplate(reminder.smsTemplateId);
      }
      
      // Use default template if none specified
      if (!template) {
        // Use built-in appointment reminder template
        const defaultContent = `🐾 Pet Wash™ Reminder: Your appointment is scheduled for {{appointment_date}} at {{appointment_time}}. Location: {{location}}. See you soon!`;
        
        const variables = {
          appointment_date: new Date(appointmentData.appointmentDate).toLocaleDateString('he-IL'),
          appointment_time: new Date(appointmentData.appointmentDate).toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          location: appointmentData.location || 'Pet Wash™ Station'
        };
        
        let content = this.replaceTemplateVariables(defaultContent, variables, customerData);
        
        if (dryRun) {
          logger.info('Dry run - would send appointment reminder SMS to:', customerData.phone);
          return true;
        }
        
        if (!twilioConfigured) {
          logger.info('Twilio not configured - would send appointment reminder SMS:', {
            phone: customerData.phone,
            content,
            appointment: appointmentData.appointmentDate
          });
          return true;
        }
        
        // Send SMS (placeholder)
        logger.info('SMS appointment reminder would be sent:', {
          from: this.FROM_NUMBER,
          to: this.formatPhoneNumber(customerData.phone),
          body: content
        });
        
        // Update reminder status
        await storage.updateAppointmentReminder(reminderId, {
          smsSent: true,
          smsSentAt: new Date(),
          status: 'sent'
        });
        
        logger.info(`Appointment reminder SMS sent to ${customerData.phone}`);
        return true;
      }
      
      // Use template-based sending
      const variables = {
        appointment_date: new Date(appointmentData.appointmentDate).toLocaleDateString('he-IL'),
        appointment_time: new Date(appointmentData.appointmentDate).toLocaleTimeString('he-IL', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        service_type: appointmentData.serviceType || 'Pet Wash Service',
        location: appointmentData.location || 'Pet Wash™ Station',
        booking_reference: reminder.bookingReference
      };
      
      const result = await this.sendTemplateSms({
        templateId: reminder.smsTemplateId!,
        recipientPhone: customerData.phone,
        recipientName: `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim(),
        variables,
        customerData,
        skipQuietHours: true, // Appointment reminders can be sent during quiet hours
        dryRun
      });
      
      if (result.success) {
        await storage.updateAppointmentReminder(reminderId, {
          smsSent: true,
          smsSentAt: new Date(),
          status: 'sent'
        });
      } else {
        await storage.updateAppointmentReminder(reminderId, {
          status: 'failed',
          lastError: result.error || 'Unknown error',
          retryCount: (reminder.retryCount || 0) + 1
        });
      }
      
      return result.success;
      
    } catch (error) {
      logger.error('Failed to send appointment reminder SMS', error);
      
      // Update error status
      try {
        await storage.updateAppointmentReminder(reminderId, {
          status: 'failed',
          lastError: error instanceof Error ? error.message : 'Unknown error',
          retryCount: (await storage.getAppointmentReminder(reminderId))?.retryCount || 0 + 1
        });
      } catch (updateError) {
        logger.error('Failed to update reminder error status', updateError);
      }
      
      return false;
    }
  }

  /**
   * Process webhook from Twilio for SMS delivery status
   */
  static async processWebhook(events: any[]): Promise<void> {
    for (const event of events) {
      try {
        const messageId = event.MessageSid || event.SmsSid;
        
        if (!messageId) {
          continue;
        }
        
        // Find communication log by external message ID
        // This would need to be implemented in storage
        // const log = await storage.getCrmCommunicationLogByExternalId(messageId);
        
        // Update based on event status
        const updates: Partial<CrmCommunicationLog> = {};
        
        switch (event.MessageStatus || event.SmsStatus) {
          case 'delivered':
            updates.deliveryStatus = 'delivered';
            break;
          case 'failed':
          case 'undelivered':
            updates.deliveryStatus = 'failed';
            updates.errorMessage = event.ErrorMessage || 'SMS delivery failed';
            updates.errorCode = event.ErrorCode;
            break;
        }
        
        // Update actual cost if available
        if (event.Price) {
          updates.actualCost = String(Math.abs(parseFloat(event.Price)));
        }
        
        // This would need to be implemented in storage
        // if (Object.keys(updates).length > 0) {
        //   await storage.updateCrmCommunicationLog(log.id, updates);
        // }
        
      } catch (error) {
        logger.error('Error processing SMS webhook event', error, event);
      }
    }
  }
}