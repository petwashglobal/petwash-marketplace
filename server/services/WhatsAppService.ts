import twilio from 'twilio';
import { logger } from '../lib/logger';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
    throw new Error('Twilio not connected');
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  return twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

/**
 * WhatsApp Service for Employee Communication
 * Preferred communication method for all PetWash employees globally
 */
export class WhatsAppService {
  /**
   * Send expense approval notification via WhatsApp
   * @param supervisorPhone - Supervisor's WhatsApp number (E.164 format: +972XXXXXXXXX)
   * @param employeeName - Employee who submitted the expense
   * @param expenseId - Expense ID
   * @param amount - Total amount in ILS
   * @param category - Expense category
   * @param description - Expense description
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
    try {
      const client = await getTwilioClient();
      const fromNumber = await getTwilioFromPhoneNumber();
      
      // WhatsApp numbers need 'whatsapp:' prefix
      const from = `whatsapp:${fromNumber}`;
      const to = `whatsapp:${params.supervisorPhone}`;
      
      // Bilingual message - Hebrew primary with English brand touches
      const messageHebrew = `
🐾 *PetWash™ - אישור הוצאה נדרש*

שלום! הוצאה חדשה ממתינה לאישורך.

📋 *פרטי ההוצאה:*
• מספר: ${params.expenseId}
• עובד: ${params.employeeName}
• קטגוריה: ${params.category}
• תיאור: ${params.description}
• סכום: ₪${params.amount.toFixed(2)}

✅ אנא היכנס למערכת לאישור או דחיה.

_PetWash Ltd - Premium Organic Pet Care Platform_ 🐕
      `.trim();
      
      const messageEnglish = `
🐾 *PetWash™ - Expense Approval Required*

Hello! A new expense is awaiting your approval.

📋 *Expense Details:*
• ID: ${params.expenseId}
• Employee: ${params.employeeName}
• Category: ${params.category}
• Description: ${params.description}
• Amount: ₪${params.amount.toFixed(2)}

✅ Please log in to approve or reject.

_PetWash Ltd - Premium Organic Pet Care Platform_ 🐕
      `.trim();
      
      const message = params.language === 'en' ? messageEnglish : messageHebrew;
      
      await client.messages.create({
        from,
        to,
        body: message,
      });
      
      logger.info('[WhatsApp] Expense approval notification sent', {
        expenseId: params.expenseId,
        supervisorPhone: params.supervisorPhone.substring(0, 8) + '***', // Log partial phone for privacy
      });
      
      return true;
    } catch (error) {
      logger.error('[WhatsApp] Failed to send expense notification', error);
      return false;
    }
  }

  /**
   * Send expense status update to employee
   * @param employeePhone - Employee's WhatsApp number (E.164 format)
   * @param expenseId - Expense ID
   * @param status - 'approved' | 'rejected'
   * @param approverName - Name of approver
   * @param rejectionReason - Optional rejection reason
   */
  static async sendExpenseStatusUpdate(params: {
    employeePhone: string;
    expenseId: string;
    status: 'approved' | 'rejected';
    approverName: string;
    rejectionReason?: string;
    language?: 'he' | 'en';
  }): Promise<boolean> {
    try {
      const client = await getTwilioClient();
      const fromNumber = await getTwilioFromPhoneNumber();
      
      const from = `whatsapp:${fromNumber}`;
      const to = `whatsapp:${params.employeePhone}`;
      
      const statusEmoji = params.status === 'approved' ? '✅' : '❌';
      const statusTextHe = params.status === 'approved' ? 'אושרה' : 'נדחתה';
      const statusTextEn = params.status === 'approved' ? 'Approved' : 'Rejected';
      
      const messageHebrew = `
${statusEmoji} *PetWash™ - עדכון סטטוס הוצאה*

ההוצאה שלך ${statusTextHe}!

📋 מספר הוצאה: ${params.expenseId}
👤 אושר על ידי: ${params.approverName}
${params.rejectionReason ? `📝 סיבה: ${params.rejectionReason}` : ''}

_PetWash Ltd - Premium Organic Pet Care Platform_ 🐕
      `.trim();
      
      const messageEnglish = `
${statusEmoji} *PetWash™ - Expense Status Update*

Your expense has been ${statusTextEn.toLowerCase()}!

📋 Expense ID: ${params.expenseId}
👤 Approved by: ${params.approverName}
${params.rejectionReason ? `📝 Reason: ${params.rejectionReason}` : ''}

_PetWash Ltd - Premium Organic Pet Care Platform_ 🐕
      `.trim();
      
      const message = params.language === 'en' ? messageEnglish : messageHebrew;
      
      await client.messages.create({
        from,
        to,
        body: message,
      });
      
      logger.info('[WhatsApp] Expense status update sent', {
        expenseId: params.expenseId,
        status: params.status,
        employeePhone: params.employeePhone.substring(0, 8) + '***',
      });
      
      return true;
    } catch (error) {
      logger.error('[WhatsApp] Failed to send status update', error);
      return false;
    }
  }

  /**
   * Send general team notification
   * @param recipients - Array of WhatsApp numbers
   * @param message - Message to send
   */
  static async sendTeamNotification(params: {
    recipients: string[];
    message: string;
  }): Promise<boolean> {
    try {
      const client = await getTwilioClient();
      const fromNumber = await getTwilioFromPhoneNumber();
      const from = `whatsapp:${fromNumber}`;
      
      // Send to all recipients
      const sendPromises = params.recipients.map(async (recipient) => {
        const to = `whatsapp:${recipient}`;
        await client.messages.create({
          from,
          to,
          body: params.message,
        });
      });
      
      await Promise.all(sendPromises);
      
      logger.info('[WhatsApp] Team notification sent', {
        recipientCount: params.recipients.length,
      });
      
      return true;
    } catch (error) {
      logger.error('[WhatsApp] Failed to send team notification', error);
      return false;
    }
  }
}
