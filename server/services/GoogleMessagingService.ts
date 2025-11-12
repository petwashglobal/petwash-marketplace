/**
 * Google Messaging Service
 * Replaces Twilio with Google Firebase Cloud Messaging (FCM) and SendGrid
 * Handles SMS (via FCM), push notifications, and email
 */

import { logger } from '../lib/logger';
import { FCMService } from './FCMService';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

interface MessagePayload {
  userId: string;
  phone?: string;
  email?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  type: 'push' | 'email' | 'both';
}

export class GoogleMessagingService {
  
  /**
   * Send notification via FCM push notification
   */
  static async sendPushNotification(payload: MessagePayload): Promise<boolean> {
    try {
      return await FCMService.sendToUser({
        userId: payload.userId,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        imageUrl: payload.imageUrl,
      });
    } catch (error) {
      logger.error('[GoogleMessaging] Failed to send push notification', error);
      return false;
    }
  }
  
  /**
   * Send email via SendGrid
   */
  static async sendEmail(payload: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  }): Promise<boolean> {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        logger.warn('[GoogleMessaging] SendGrid not configured - skipping email');
        return false;
      }
      
      await sgMail.send({
        to: payload.to,
        from: payload.from || 'Support@PetWash.co.il',
        subject: payload.subject,
        html: payload.html,
      });
      
      logger.info('[GoogleMessaging] Email sent successfully', { to: payload.to });
      return true;
    } catch (error) {
      logger.error('[GoogleMessaging] Failed to send email', error);
      return false;
    }
  }
  
  /**
   * Send multi-channel notification (push + email)
   */
  static async sendNotification(payload: MessagePayload): Promise<{
    pushSuccess: boolean;
    emailSuccess: boolean;
  }> {
    const results = {
      pushSuccess: false,
      emailSuccess: false,
    };
    
    if (payload.type === 'push' || payload.type === 'both') {
      results.pushSuccess = await this.sendPushNotification(payload);
    }
    
    if ((payload.type === 'email' || payload.type === 'both') && payload.email) {
      results.emailSuccess = await this.sendEmail({
        to: payload.email,
        subject: payload.title,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; }
                .content { padding: 30px; background: #f9f9f9; border-radius: 10px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>${payload.title}</h1>
                </div>
                <div class="content">
                  <p>${payload.body}</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });
    }
    
    return results;
  }
  
  /**
   * Send appointment reminder (replaces Twilio SMS)
   */
  static async sendAppointmentReminder(params: {
    userId: string;
    email: string;
    appointmentDate: Date;
    location: string;
    serviceType: string;
  }): Promise<boolean> {
    const formattedDate = new Date(params.appointmentDate).toLocaleDateString('he-IL');
    const formattedTime = new Date(params.appointmentDate).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    return await this.sendNotification({
      userId: params.userId,
      email: params.email,
      title: '🐾 Pet Wash™ Reminder',
      body: `Your ${params.serviceType} appointment is scheduled for ${formattedDate} at ${formattedTime}. Location: ${params.location}`,
      type: 'both',
      data: {
        type: 'appointment_reminder',
        appointmentDate: params.appointmentDate.toISOString(),
        location: params.location,
      },
    }).then(results => results.pushSuccess || results.emailSuccess);
  }
  
  /**
   * Send insurance expiration alert (replaces Twilio SMS)
   */
  static async sendInsuranceExpirationAlert(params: {
    userId: string;
    email: string;
    contractorName: string;
    daysUntilExpiry: number;
    policyNumber: string;
  }): Promise<boolean> {
    const alertType = params.daysUntilExpiry <= 7 ? 'CRITICAL' : 'WARNING';
    
    return await this.sendNotification({
      userId: params.userId,
      email: params.email,
      title: `🚨 Insurance ${alertType}: ${params.contractorName}`,
      body: `Insurance policy ${params.policyNumber} expires in ${params.daysUntilExpiry} days. Please renew immediately.`,
      type: 'both',
      data: {
        type: 'insurance_expiration',
        daysUntilExpiry: String(params.daysUntilExpiry),
        policyNumber: params.policyNumber,
      },
    }).then(results => results.pushSuccess || results.emailSuccess);
  }
  
  /**
   * Send expense approval notification (replaces Twilio WhatsApp)
   */
  static async sendExpenseApprovalNotification(params: {
    supervisorUserId: string;
    supervisorEmail: string;
    employeeName: string;
    expenseId: string;
    amount: number;
    category: string;
    description: string;
  }): Promise<boolean> {
    return await this.sendNotification({
      userId: params.supervisorUserId,
      email: params.supervisorEmail,
      title: '💰 Expense Approval Required',
      body: `${params.employeeName} submitted a ${params.category} expense for ₪${params.amount}. Description: ${params.description}`,
      type: 'both',
      data: {
        type: 'expense_approval',
        expenseId: params.expenseId,
        amount: String(params.amount),
        category: params.category,
      },
    }).then(results => results.pushSuccess || results.emailSuccess);
  }
}
