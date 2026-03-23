/**
 * Unified Notification Service
 * Multi-channel notification orchestration with template management
 * Supports: Email, SMS, WhatsApp, Push, In-App
 */

import { db } from '../db';
import { notificationTemplates, notificationLogs, users } from '@shared/schema';
import type { NotificationTemplate, InsertNotificationTemplate, NotificationLog } from '@shared/schema';
import { eq, and, desc, gte, sql, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { EmailService } from '../emailService';
import { WhatsAppService } from './WhatsAppService';
import { FCMService } from './FCMService';
import { twilioSMSService } from './TwilioSMSService';

type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';

interface NotificationPayload {
  templateKey: string;
  userId?: string;
  email?: string;
  phone?: string;
  channelsOverride?: NotificationChannel[];
  variables?: Record<string, any>;
}

interface DeliveryStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  byChannel: Record<NotificationChannel, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
}

export class NotificationService {
  
  /**
   * Send notification using a template
   */
  static async sendNotification(params: NotificationPayload): Promise<{
    success: boolean;
    logIds: number[];
    errors: string[];
  }> {
    const logIds: number[] = [];
    const errors: string[] = [];
    
    try {
      // Get template
      const template = await this.getTemplateByKey(params.templateKey);
      if (!template) {
        throw new Error(`Template not found: ${params.templateKey}`);
      }
      
      if (!template.isActive) {
        throw new Error(`Template is inactive: ${params.templateKey}`);
      }
      
      // Determine channels to use
      const channels = params.channelsOverride || (template.channels as NotificationChannel[]);
      
      // Get recipient info
      let recipientEmail = params.email;
      let recipientPhone = params.phone;
      let recipientUserId = params.userId;
      
      if (params.userId && (!recipientEmail || !recipientPhone)) {
        const userRecords = await db
          .select()
          .from(users)
          .where(eq(users.id, params.userId))
          .limit(1);
        
        if (userRecords.length > 0) {
          const user = userRecords[0];
          recipientEmail = recipientEmail || user.email || undefined;
          recipientPhone = recipientPhone || user.phone || undefined;
        }
      }
      
      // Send to each channel
      for (const channel of channels) {
        const logId = await this.sendToChannel({
          channel,
          template,
          recipientUserId,
          recipientEmail,
          recipientPhone,
          variables: params.variables || {},
        });
        
        if (logId) {
          logIds.push(logId);
        } else {
          errors.push(`Failed to send via ${channel}`);
        }
      }
      
      return {
        success: logIds.length > 0,
        logIds,
        errors,
      };
      
    } catch (error: any) {
      logger.error('[NotificationService] sendNotification failed', {
        error: error.message,
        templateKey: params.templateKey,
      });
      
      return {
        success: false,
        logIds,
        errors: [...errors, error.message],
      };
    }
  }
  
  /**
   * Send to a specific channel
   */
  private static async sendToChannel(params: {
    channel: NotificationChannel;
    template: NotificationTemplate;
    recipientUserId?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    variables: Record<string, any>;
  }): Promise<number | null> {
    const { channel, template, recipientUserId, recipientEmail, recipientPhone, variables } = params;
    
    // Create log entry
    const logResult = await db.insert(notificationLogs).values({
      templateKey: template.key,
      channel,
      recipientUserId: recipientUserId || null,
      recipientEmail: recipientEmail || null,
      recipientPhone: recipientPhone || null,
      status: 'pending',
      payload: variables,
    }).returning({ id: notificationLogs.id });
    
    const logId = logResult[0].id;
    
    try {
      let success = false;
      
      switch (channel) {
        case 'email':
          success = await this.sendToEmail(
            recipientEmail!,
            this.renderTemplate(template.emailSubject || '', variables),
            this.renderTemplate(template.emailBody || '', variables)
          );
          break;
          
        case 'sms':
          success = await this.sendToSMS(
            recipientPhone!,
            this.renderTemplate(template.smsBody || '', variables)
          );
          break;
          
        case 'whatsapp':
          success = await this.sendToWhatsApp(
            recipientPhone!,
            this.renderTemplate(template.whatsappBody || '', variables)
          );
          break;
          
        case 'push':
          success = await this.sendToPush(
            recipientUserId!,
            this.renderTemplate(template.pushTitle || '', variables),
            this.renderTemplate(template.pushBody || '', variables)
          );
          break;
          
        case 'in_app':
          success = await this.createInAppNotification(
            recipientUserId!,
            this.renderTemplate(template.inAppTitle || '', variables),
            this.renderTemplate(template.inAppBody || '', variables)
          );
          break;
      }
      
      // Update log
      await db.update(notificationLogs)
        .set({
          status: success ? 'sent' : 'failed',
          sentAt: success ? new Date() : null,
          failureReason: success ? null : 'Delivery failed',
        })
        .where(eq(notificationLogs.id, logId));
      
      return success ? logId : null;
      
    } catch (error: any) {
      logger.error(`[NotificationService] ${channel} delivery failed`, {
        error: error.message,
        templateKey: template.key,
      });
      
      // Update log with failure
      await db.update(notificationLogs)
        .set({
          status: 'failed',
          failureReason: error.message,
        })
        .where(eq(notificationLogs.id, logId));
      
      return null;
    }
  }
  
  /**
   * Send email via SendGrid
   */
  static async sendToEmail(email: string, subject: string, body: string): Promise<boolean> {
    if (!email) {
      logger.warn('[NotificationService] No email provided');
      return false;
    }
    
    return await EmailService.send({
      to: email,
      subject,
      html: body,
    });
  }
  
  /**
   * Send SMS via Twilio (live integration)
   */
  static async sendToSMS(phone: string, message: string): Promise<boolean> {
    if (!phone) {
      logger.warn('[NotificationService] No phone provided for SMS');
      return false;
    }

    try {
      const result = await twilioSMSService.sendSMS(phone, message);
      if (!result.success) {
        logger.warn('[NotificationService] SMS send failed', { phone: phone.slice(0, 6) + '****', error: result.error });
      }
      return result.success;
    } catch (err: any) {
      logger.error('[NotificationService] SMS dispatch error', { error: err?.message });
      return false;
    }
  }
  
  /**
   * Send WhatsApp via Meta Business API
   */
  static async sendToWhatsApp(phone: string, message: string): Promise<boolean> {
    if (!phone) {
      logger.warn('[NotificationService] No phone provided');
      return false;
    }
    
    return await WhatsAppService.sendMessage({
      to: phone,
      message,
    });
  }
  
  /**
   * Send push notification via FCM
   */
  static async sendToPush(userId: string, title: string, body: string): Promise<boolean> {
    if (!userId) {
      logger.warn('[NotificationService] No userId provided');
      return false;
    }
    
    return await FCMService.sendToUser({
      userId,
      title,
      body,
    });
  }
  
  /**
   * Create in-app notification (stored in database)
   */
  static async createInAppNotification(userId: string, title: string, body: string): Promise<boolean> {
    if (!userId) {
      logger.warn('[NotificationService] No userId provided');
      return false;
    }
    
    try {
      // Store in notification_logs as a special in-app type
      // Frontend can query these to display in-app notifications
      logger.info('[NotificationService] In-app notification created', {
        userId,
        title,
      });
      
      return true;
    } catch (error: any) {
      logger.error('[NotificationService] In-app notification failed', error);
      return false;
    }
  }
  
  /**
   * Render template with variable substitution
   */
  static renderTemplate(template: string, payload: Record<string, any>): string {
    if (!template) return '';
    
    let rendered = template;
    
    // Replace {{variable}} with values
    // Supports nested properties: {{user.name}}, {{station.location}}
    const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
    
    for (const match of matches) {
      const key = match.replace(/\{\{|\}\}/g, '').trim();
      const value = this.getNestedValue(payload, key);
      rendered = rendered.replace(match, value !== undefined ? String(value) : '');
    }
    
    return rendered;
  }
  
  /**
   * Get nested value from object (supports dot notation)
   */
  private static getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
  
  /**
   * Get template by key
   */
  static async getTemplateByKey(key: string): Promise<NotificationTemplate | null> {
    const templates = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.key, key))
      .limit(1);
    
    return templates[0] || null;
  }
  
  /**
   * Create new template
   */
  static async createTemplate(template: InsertNotificationTemplate): Promise<NotificationTemplate> {
    const result = await db.insert(notificationTemplates)
      .values(template)
      .returning();
    
    logger.info('[NotificationService] Template created', {
      key: template.key,
    });
    
    return result[0];
  }
  
  /**
   * Update template
   */
  static async updateTemplate(key: string, updates: Partial<InsertNotificationTemplate>): Promise<NotificationTemplate | null> {
    const result = await db.update(notificationTemplates)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(notificationTemplates.key, key))
      .returning();
    
    if (result.length === 0) {
      return null;
    }
    
    logger.info('[NotificationService] Template updated', { key });
    
    return result[0];
  }
  
  /**
   * Delete template
   */
  static async deleteTemplate(key: string): Promise<boolean> {
    const result = await db.delete(notificationTemplates)
      .where(eq(notificationTemplates.key, key))
      .returning();
    
    logger.info('[NotificationService] Template deleted', { key });
    
    return result.length > 0;
  }
  
  /**
   * List all templates
   */
  static async listTemplates(activeOnly: boolean = false): Promise<NotificationTemplate[]> {
    const query = activeOnly
      ? db.select().from(notificationTemplates).where(eq(notificationTemplates.isActive, true))
      : db.select().from(notificationTemplates);
    
    return await query.orderBy(notificationTemplates.name);
  }
  
  /**
   * Get notification logs with filters
   */
  static async getNotificationLogs(filters: {
    userId?: string;
    channel?: NotificationChannel;
    status?: string;
    templateKey?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<NotificationLog[]> {
    const conditions = [];
    
    if (filters.userId) {
      conditions.push(eq(notificationLogs.recipientUserId, filters.userId));
    }
    
    if (filters.channel) {
      conditions.push(eq(notificationLogs.channel, filters.channel));
    }
    
    if (filters.status) {
      conditions.push(eq(notificationLogs.status, filters.status));
    }
    
    if (filters.templateKey) {
      conditions.push(eq(notificationLogs.templateKey, filters.templateKey));
    }
    
    if (filters.startDate) {
      conditions.push(gte(notificationLogs.createdAt, filters.startDate));
    }
    
    let query = db.select().from(notificationLogs);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(notificationLogs.createdAt));
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    return await query;
  }
  
  /**
   * Get delivery statistics
   */
  static async getDeliveryStats(filters?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<DeliveryStats> {
    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(gte(notificationLogs.createdAt, filters.startDate));
    }
    
    // Get overall stats
    let query = db.select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${notificationLogs.status} = 'sent')::int`,
      delivered: sql<number>`count(*) filter (where ${notificationLogs.status} = 'delivered')::int`,
      failed: sql<number>`count(*) filter (where ${notificationLogs.status} = 'failed')::int`,
    }).from(notificationLogs);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const overall = await query;
    
    // Get per-channel stats
    const channels: NotificationChannel[] = ['email', 'sms', 'whatsapp', 'push', 'in_app'];
    const byChannel: DeliveryStats['byChannel'] = {} as any;
    
    for (const channel of channels) {
      const channelConditions = [...conditions, eq(notificationLogs.channel, channel)];
      
      const channelQuery = db.select({
        sent: sql<number>`count(*) filter (where ${notificationLogs.status} = 'sent')::int`,
        delivered: sql<number>`count(*) filter (where ${notificationLogs.status} = 'delivered')::int`,
        failed: sql<number>`count(*) filter (where ${notificationLogs.status} = 'failed')::int`,
      }).from(notificationLogs).where(and(...channelConditions));
      
      const channelStats = await channelQuery;
      
      byChannel[channel] = {
        sent: channelStats[0].sent || 0,
        delivered: channelStats[0].delivered || 0,
        failed: channelStats[0].failed || 0,
      };
    }
    
    return {
      total: overall[0].total || 0,
      sent: overall[0].sent || 0,
      delivered: overall[0].delivered || 0,
      failed: overall[0].failed || 0,
      byChannel,
    };
  }
  
  /**
   * Mark notification as delivered (webhook callback)
   */
  static async markAsDelivered(logId: number): Promise<void> {
    await db.update(notificationLogs)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
      })
      .where(eq(notificationLogs.id, logId));
    
    logger.info('[NotificationService] Notification marked as delivered', { logId });
  }
  
  /**
   * Mark notification as failed
   */
  static async markAsFailed(logId: number, reason: string): Promise<void> {
    await db.update(notificationLogs)
      .set({
        status: 'failed',
        failureReason: reason,
      })
      .where(eq(notificationLogs.id, logId));
    
    logger.info('[NotificationService] Notification marked as failed', { logId, reason });
  }
}

export default NotificationService;
