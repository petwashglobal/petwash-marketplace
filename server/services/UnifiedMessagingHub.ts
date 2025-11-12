/**
 * 📱 Unified Messaging Hub
 * Centralized notification and messaging system for all platforms
 * Supports WhatsApp, Email, SMS, Push Notifications
 */

import { logger } from '../lib/logger';
import { eventBus } from './EventBus';
import { notificationRepository } from '../repositories/NotificationRepository';

export interface Message {
  userId: string;
  channel: 'whatsapp' | 'email' | 'sms' | 'push' | 'in-app';
  template: string;
  data: Record<string, any>;
  language?: 'he' | 'en' | 'ar' | 'ru' | 'fr' | 'es';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  platform?: string;
}

export interface NotificationPreferences {
  userId: string;
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  platforms: {
    'walk-my-pet': boolean;
    'sitter-suite': boolean;
    'pettrek': boolean;
    'academy': boolean;
    'wash-hub': boolean;
  };
}

export class UnifiedMessagingHub {
  /**
   * Send a message through the appropriate channel
   */
  async sendMessage(message: Message): Promise<boolean> {
    try {
      // Check user preferences
      const preferences = await this.getPreferences(message.userId);
      
      if (!this.shouldSend(message.channel, preferences, message.platform)) {
        logger.info('[Messaging Hub] Message blocked by user preferences', {
          userId: message.userId,
          channel: message.channel,
          platform: message.platform
        });
        return false;
      }

      // Generate content from template
      const content = this.renderTemplate(message.template, message.data, message.language || 'he');
      const subject = message.data.subject || this.getDefaultSubject(message.template);

      // Route to appropriate service
      switch (message.channel) {
        case 'whatsapp':
          await this.sendWhatsApp(message, content);
          break;
        case 'email':
          await this.sendEmail(message, subject, content);
          break;
        case 'sms':
          await this.sendSMS(message, content);
          break;
        case 'push':
          await this.sendPush(message, content);
          break;
        case 'in-app':
          await this.sendInApp(message, subject, content);
          break;
      }

      // Record notification
      await notificationRepository.recordNotification({
        userId: message.userId,
        channel: message.channel,
        template: message.template,
        platform: message.platform,
        subject,
        content,
        metadata: message.data,
        status: 'sent'
      });

      logger.info('[Messaging Hub] Message sent', {
        userId: message.userId,
        channel: message.channel,
        template: message.template
      });

      return true;
    } catch (error) {
      logger.error('[Messaging Hub] Failed to send message', { error, message });
      throw error;
    }
  }

  /**
   * Send multi-channel notification
   */
  async sendMultiChannel(message: Omit<Message, 'channel'>, channels: Message['channel'][]): Promise<void> {
    const promises = channels.map(channel =>
      this.sendMessage({ ...message, channel })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Send WhatsApp message
   */
  private async sendWhatsApp(message: Message, content: string): Promise<void> {
    try {
      // TODO: Integrate with WhatsApp Business API
      logger.info('[WhatsApp] Message sent', { userId: message.userId, content: content.substring(0, 50) });
    } catch (error) {
      logger.error('[WhatsApp] Failed to send', { error });
      throw error;
    }
  }

  /**
   * Send Email
   */
  private async sendEmail(message: Message, subject: string, content: string): Promise<void> {
    try {
      // TODO: Integrate with SendGrid/SES
      logger.info('[Email] Message sent', { userId: message.userId, subject });
    } catch (error) {
      logger.error('[Email] Failed to send', { error });
      throw error;
    }
  }

  /**
   * Send SMS
   */
  private async sendSMS(message: Message, content: string): Promise<void> {
    try {
      // TODO: Integrate with Twilio
      logger.info('[SMS] Message sent', { userId: message.userId });
    } catch (error) {
      logger.error('[SMS] Failed to send', { error });
      throw error;
    }
  }

  /**
   * Send Push Notification
   */
  private async sendPush(message: Message, content: string): Promise<void> {
    try {
      // TODO: Integrate with Firebase Cloud Messaging
      logger.info('[Push] Notification sent', { userId: message.userId });
    } catch (error) {
      logger.error('[Push] Failed to send', { error });
      throw error;
    }
  }

  /**
   * Send In-App Notification
   */
  private async sendInApp(message: Message, subject: string, content: string): Promise<void> {
    try {
      logger.info('[In-App] Notification created', { userId: message.userId, subject });
      
      // Publish event for real-time delivery via WebSocket
      await eventBus.publish({
        eventType: 'notification.in_app',
        timestamp: new Date().toISOString(),
        platform: message.platform || 'system',
        userId: message.userId,
        data: {
          template: message.template,
          subject,
          content,
          data: message.data
        }
      });
    } catch (error) {
      logger.error('[In-App] Failed to send', { error });
      throw error;
    }
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      let preferences = await notificationRepository.getPreferences(userId);
      
      if (!preferences) {
        preferences = await notificationRepository.createPreferences(userId);
      }

      return {
        userId: preferences.userId,
        whatsapp: preferences.whatsapp,
        email: preferences.email,
        sms: preferences.sms,
        push: preferences.push,
        inApp: preferences.inApp,
        platforms: preferences.platformPreferences as any
      };
    } catch (error) {
      logger.error('[Messaging Hub] Failed to get preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(userId: string, updates: Partial<NotificationPreferences>): Promise<void> {
    try {
      await notificationRepository.updatePreferences(userId, updates as any);
      logger.info('[Messaging Hub] Preferences updated', { userId });
    } catch (error) {
      logger.error('[Messaging Hub] Failed to update preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Check if message should be sent based on preferences
   */
  private shouldSend(channel: Message['channel'], preferences: NotificationPreferences, platform?: string): boolean {
    // Check channel preference
    if (!preferences[channel]) {
      return false;
    }

    // Check platform preference
    if (platform && preferences.platforms[platform as keyof typeof preferences.platforms] === false) {
      return false;
    }

    return true;
  }

  /**
   * Get notification history
   */
  async getHistory(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      return await notificationRepository.getHistory(userId, limit, offset);
    } catch (error) {
      logger.error('[Messaging Hub] Failed to get history', { error, userId });
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await notificationRepository.getUnreadCount(userId);
    } catch (error) {
      logger.error('[Messaging Hub] Failed to get unread count', { error, userId });
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await notificationRepository.markRead(notificationId);
      logger.info('[Messaging Hub] Notification marked as read', { notificationId });
    } catch (error) {
      logger.error('[Messaging Hub] Failed to mark as read', { error, notificationId });
      throw error;
    }
  }

  /**
   * Render template with data
   */
  private renderTemplate(template: string, data: Record<string, any>, language: string): string {
    // Simple template rendering - in production, use a proper template engine
    const templates: Record<string, Record<string, string>> = {
      welcome: {
        he: `ברוכים הבאים ל-Pet Wash! ${data.name || 'שלום'}`,
        en: `Welcome to Pet Wash! ${data.name || 'Hello'}`
      },
      booking_confirmed: {
        he: `ההזמנה שלך אושרה! מספר הזמנה: ${data.bookingId}`,
        en: `Your booking is confirmed! Booking #${data.bookingId}`
      },
      thank_you: {
        he: `תודה רבה על השירות! נשמח לשמוע את חוות דעתך`,
        en: `Thank you for using our service! We'd love your feedback`
      }
    };

    return templates[template]?.[language] || `Message: ${template}`;
  }

  /**
   * Get default subject for template
   */
  private getDefaultSubject(template: string): string {
    const subjects: Record<string, string> = {
      welcome: 'Welcome to Pet Wash',
      booking_confirmed: 'Booking Confirmed',
      thank_you: 'Thank You',
      abandoned_booking_reminder: 'Complete Your Booking',
      win_back: 'We Miss You!'
    };

    return subjects[template] || 'Pet Wash Notification';
  }
}

// Singleton instance
export const messagingHub = new UnifiedMessagingHub();
