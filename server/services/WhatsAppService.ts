/**
 * WhatsApp Service for Employee Communication
 * Uses Meta WhatsApp Business API (NOT Twilio)
 * Preferred communication method for all PetWash employees globally
 */

import { logger } from '../lib/logger';

export class WhatsAppService {
  private static readonly WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
  private static readonly PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  private static readonly ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN;
  
  /**
   * Send WhatsApp message via Meta Business API
   */
  static async sendMessage(params: {
    to: string;
    message: string;
    language?: 'he' | 'en';
  }): Promise<boolean> {
    try {
      if (!this.PHONE_NUMBER_ID || !this.ACCESS_TOKEN) {
        logger.warn('[WhatsApp] Meta WhatsApp not configured - skipping message');
        return false;
      }
      
      const response = await fetch(
        `${this.WHATSAPP_API_URL}/${this.PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: params.to,
            type: 'text',
            text: {
              body: params.message,
            },
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.statusText}`);
      }
      
      logger.info('[WhatsApp] Message sent successfully', { to: params.to });
      return true;
    } catch (error) {
      logger.error('[WhatsApp] Failed to send message', error);
      return false;
    }
  }
  
  /**
   * Send expense approval notification via WhatsApp
   */
  static async sendExpenseApprovalNotification(params: {
    supervisorPhone: string;
    employeeName: string;
    expenseId: string;
    amount: number;
    category: string;
    description: string;
    language?: 'he' | 'en';
  }): Promise<boolean> {
    const message = params.language === 'he'
      ? `🐾 *Pet Wash™ - אישור הוצאה נדרש*\n\n` +
        `עובד: ${params.employeeName}\n` +
        `קטגוריה: ${params.category}\n` +
        `סכום: ₪${params.amount.toFixed(2)}\n` +
        `תיאור: ${params.description}\n\n` +
        `מזהה הוצאה: ${params.expenseId}`
      : `🐾 *Pet Wash™ - Expense Approval Required*\n\n` +
        `Employee: ${params.employeeName}\n` +
        `Category: ${params.category}\n` +
        `Amount: ₪${params.amount.toFixed(2)}\n` +
        `Description: ${params.description}\n\n` +
        `Expense ID: ${params.expenseId}`;
    
    return await this.sendMessage({
      to: params.supervisorPhone,
      message,
      language: params.language,
    });
  }
  
  /**
   * Send booking confirmation via WhatsApp
   */
  static async sendBookingConfirmation(params: {
    customerPhone: string;
    bookingId: string;
    serviceType: string;
    appointmentDate: Date;
    location: string;
    language?: 'he' | 'en';
  }): Promise<boolean> {
    const formattedDate = params.appointmentDate.toLocaleDateString(params.language === 'he' ? 'he-IL' : 'en-US');
    const formattedTime = params.appointmentDate.toLocaleTimeString(params.language === 'he' ? 'he-IL' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const message = params.language === 'he'
      ? `🐾 *Pet Wash™ - אישור הזמנה*\n\n` +
        `תודה על ההזמנה!\n\n` +
        `שירות: ${params.serviceType}\n` +
        `תאריך: ${formattedDate}\n` +
        `שעה: ${formattedTime}\n` +
        `מיקום: ${params.location}\n\n` +
        `מספר הזמנה: ${params.bookingId}`
      : `🐾 *Pet Wash™ - Booking Confirmation*\n\n` +
        `Thank you for your booking!\n\n` +
        `Service: ${params.serviceType}\n` +
        `Date: ${formattedDate}\n` +
        `Time: ${formattedTime}\n` +
        `Location: ${params.location}\n\n` +
        `Booking ID: ${params.bookingId}`;
    
    return await this.sendMessage({
      to: params.customerPhone,
      message,
      language: params.language,
    });
  }
  
  /**
   * Send insurance expiration alert via WhatsApp
   */
  static async sendInsuranceExpirationAlert(params: {
    contractorPhone: string;
    contractorName: string;
    daysUntilExpiry: number;
    policyNumber: string;
    language?: 'he' | 'en';
  }): Promise<boolean> {
    const message = params.language === 'he'
      ? `🚨 *Pet Wash™ - תזכורת ביטוח*\n\n` +
        `שלום ${params.contractorName},\n\n` +
        `פוליסת הביטוח שלך (${params.policyNumber}) תפוג בעוד ${params.daysUntilExpiry} ימים.\n\n` +
        `אנא חדש את הביטוח מיד כדי להמשיך לעבוד עם Pet Wash™.`
      : `🚨 *Pet Wash™ - Insurance Reminder*\n\n` +
        `Hello ${params.contractorName},\n\n` +
        `Your insurance policy (${params.policyNumber}) expires in ${params.daysUntilExpiry} days.\n\n` +
        `Please renew immediately to continue working with Pet Wash™.`;
    
    return await this.sendMessage({
      to: params.contractorPhone,
      message,
      language: params.language,
    });
  }
}
