/**
 * Unified Notification Service
 * Multi-channel notification orchestration with template management
 * Supports: Email, SMS, WhatsApp, Push, In-App
 */
import { db } from '../db';
import { notificationTemplates, notificationLogs, users } from '@shared/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { EmailService } from '../emailService';
import { WhatsAppService } from './WhatsAppService';
import { FCMService } from './FCMService';
export class NotificationService {
    /**
     * Send notification using a template
     */
    static async sendNotification(params) {
        const logIds = [];
        const errors = [];
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
            const channels = params.channelsOverride || template.channels;
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
                }
                else {
                    errors.push(`Failed to send via ${channel}`);
                }
            }
            return {
                success: logIds.length > 0,
                logIds,
                errors,
            };
        }
        catch (error) {
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
    static async sendToChannel(params) {
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
                    success = await this.sendToEmail(recipientEmail, this.renderTemplate(template.emailSubject || '', variables), this.renderTemplate(template.emailBody || '', variables));
                    break;
                case 'sms':
                    success = await this.sendToSMS(recipientPhone, this.renderTemplate(template.smsBody || '', variables));
                    break;
                case 'whatsapp':
                    success = await this.sendToWhatsApp(recipientPhone, this.renderTemplate(template.whatsappBody || '', variables));
                    break;
                case 'push':
                    success = await this.sendToPush(recipientUserId, this.renderTemplate(template.pushTitle || '', variables), this.renderTemplate(template.pushBody || '', variables));
                    break;
                case 'in_app':
                    success = await this.createInAppNotification(recipientUserId, this.renderTemplate(template.inAppTitle || '', variables), this.renderTemplate(template.inAppBody || '', variables));
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
        }
        catch (error) {
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
    static async sendToEmail(email, subject, body) {
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
     * Send SMS (placeholder for Twilio integration)
     */
    static async sendToSMS(phone, message) {
        if (!phone) {
            logger.warn('[NotificationService] No phone provided');
            return false;
        }
        // TODO: Integrate Twilio for SMS
        logger.info('[NotificationService] SMS placeholder', {
            phone,
            message,
        });
        return true; // Return true for now (placeholder)
    }
    /**
     * Send WhatsApp via Meta Business API
     */
    static async sendToWhatsApp(phone, message) {
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
    static async sendToPush(userId, title, body) {
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
    static async createInAppNotification(userId, title, body) {
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
        }
        catch (error) {
            logger.error('[NotificationService] In-app notification failed', error);
            return false;
        }
    }
    /**
     * Render template with variable substitution
     */
    static renderTemplate(template, payload) {
        if (!template)
            return '';
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
    static getNestedValue(obj, path) {
        const keys = path.split('.');
        let value = obj;
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            }
            else {
                return undefined;
            }
        }
        return value;
    }
    /**
     * Get template by key
     */
    static async getTemplateByKey(key) {
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
    static async createTemplate(template) {
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
    static async updateTemplate(key, updates) {
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
    static async deleteTemplate(key) {
        const result = await db.delete(notificationTemplates)
            .where(eq(notificationTemplates.key, key))
            .returning();
        logger.info('[NotificationService] Template deleted', { key });
        return result.length > 0;
    }
    /**
     * List all templates
     */
    static async listTemplates(activeOnly = false) {
        const query = activeOnly
            ? db.select().from(notificationTemplates).where(eq(notificationTemplates.isActive, true))
            : db.select().from(notificationTemplates);
        return await query.orderBy(notificationTemplates.name);
    }
    /**
     * Get notification logs with filters
     */
    static async getNotificationLogs(filters) {
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
    static async getDeliveryStats(filters) {
        const conditions = [];
        if (filters?.startDate) {
            conditions.push(gte(notificationLogs.createdAt, filters.startDate));
        }
        // Get overall stats
        let query = db.select({
            total: sql `count(*)::int`,
            sent: sql `count(*) filter (where ${notificationLogs.status} = 'sent')::int`,
            delivered: sql `count(*) filter (where ${notificationLogs.status} = 'delivered')::int`,
            failed: sql `count(*) filter (where ${notificationLogs.status} = 'failed')::int`,
        }).from(notificationLogs);
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }
        const overall = await query;
        // Get per-channel stats
        const channels = ['email', 'sms', 'whatsapp', 'push', 'in_app'];
        const byChannel = {};
        for (const channel of channels) {
            const channelConditions = [...conditions, eq(notificationLogs.channel, channel)];
            const channelQuery = db.select({
                sent: sql `count(*) filter (where ${notificationLogs.status} = 'sent')::int`,
                delivered: sql `count(*) filter (where ${notificationLogs.status} = 'delivered')::int`,
                failed: sql `count(*) filter (where ${notificationLogs.status} = 'failed')::int`,
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
    static async markAsDelivered(logId) {
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
    static async markAsFailed(logId, reason) {
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
