/**
 * Meta WhatsApp Cloud API Service
 * Direct integration with Meta (Facebook) WhatsApp Business Platform
 * 
 * Business Phone: +972549833355 (PetWash Ltd Israel Support)
 * 
 * Setup Instructions:
 * 1. Create Meta Business Account: https://business.facebook.com
 * 2. Add WhatsApp Business Account
 * 3. Get Phone Number ID and Access Token
 * 4. Add to Replit Secrets:
 *    - META_WHATSAPP_ACCESS_TOKEN
 *    - META_WHATSAPP_PHONE_NUMBER_ID
 *    - META_WHATSAPP_BUSINESS_PHONE (default: +972549833355)
 */

import { logger } from '../lib/logger';

interface WhatsAppTextMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: {
    preview_url: boolean;
    body: string;
  };
}

interface MetaAPIResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

export class WhatsAppMetaService {
  private static readonly API_VERSION = 'v21.0';
  private static readonly BASE_URL = 'https://graph.facebook.com';
  
  /**
   * Get Meta WhatsApp credentials from environment
   */
  private static getCredentials() {
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const businessPhone = process.env.META_WHATSAPP_BUSINESS_PHONE || '+972549833355';

    if (!accessToken || !phoneNumberId) {
      throw new Error(
        'Meta WhatsApp credentials missing. Please configure META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID in Replit Secrets.'
      );
    }

    return { accessToken, phoneNumberId, businessPhone };
  }

  /**
   * Send WhatsApp message via Meta Cloud API
   * @param to - Recipient's WhatsApp number (E.164 format: +972XXXXXXXXX)
   * @param message - Message text (max 4096 characters)
   */
  private static async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      const { accessToken, phoneNumberId } = this.getCredentials();
      
      const url = `${this.BASE_URL}/${this.API_VERSION}/${phoneNumberId}/messages`;
      
      const payload: WhatsAppTextMessage = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace(/\s/g, ''), // Remove any spaces
        type: 'text',
        text: {
          preview_url: true, // Enable URL previews
          body: message.substring(0, 4096), // Meta limit: 4096 chars
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        logger.error('[Meta WhatsApp] API error', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          recipient: to.substring(0, 8) + '***', // Privacy
        });
        return false;
      }

      const data: MetaAPIResponse = await response.json();
      
      logger.info('[Meta WhatsApp] Message sent successfully', {
        messageId: data.messages?.[0]?.id,
        recipient: to.substring(0, 8) + '***',
      });

      return true;
    } catch (error) {
      logger.error('[Meta WhatsApp] Failed to send message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        recipient: to.substring(0, 8) + '***',
      });
      return false;
    }
  }

  /**
   * Send expense approval notification via WhatsApp
   * @param supervisorPhone - Supervisor's WhatsApp number (E.164 format: +972XXXXXXXXX)
   * @param employeeName - Employee who submitted the expense
   * @param expenseId - Expense ID
   * @param amount - Total amount in ILS
   * @param category - Expense category
   * @param description - Expense description
   * @param language - Message language ('he' | 'en')
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

    const success = await this.sendMessage(params.supervisorPhone, message);

    if (success) {
      logger.info('[Meta WhatsApp] Expense approval notification sent', {
        expenseId: params.expenseId,
        supervisorPhone: params.supervisorPhone.substring(0, 8) + '***',
      });
    }

    return success;
  }

  /**
   * Send expense status update to employee
   * @param employeePhone - Employee's WhatsApp number (E.164 format)
   * @param expenseId - Expense ID
   * @param status - 'approved' | 'rejected'
   * @param approverName - Name of approver
   * @param rejectionReason - Optional rejection reason
   * @param language - Message language ('he' | 'en')
   */
  static async sendExpenseStatusUpdate(params: {
    employeePhone: string;
    expenseId: string;
    status: 'approved' | 'rejected';
    approverName: string;
    rejectionReason?: string;
    language?: 'he' | 'en';
  }): Promise<boolean> {
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

    const success = await this.sendMessage(params.employeePhone, message);

    if (success) {
      logger.info('[Meta WhatsApp] Expense status update sent', {
        expenseId: params.expenseId,
        status: params.status,
        employeePhone: params.employeePhone.substring(0, 8) + '***',
      });
    }

    return success;
  }

  /**
   * Send general team notification
   * @param recipients - Array of WhatsApp numbers (E.164 format)
   * @param message - Message to send
   */
  static async sendTeamNotification(params: {
    recipients: string[];
    message: string;
  }): Promise<boolean> {
    try {
      // Send to all recipients in parallel
      const sendPromises = params.recipients.map((recipient) =>
        this.sendMessage(recipient, params.message)
      );

      const results = await Promise.all(sendPromises);
      const successCount = results.filter((r) => r).length;

      logger.info('[Meta WhatsApp] Team notification sent', {
        totalRecipients: params.recipients.length,
        successCount,
        failedCount: params.recipients.length - successCount,
      });

      return successCount > 0; // Return true if at least one message sent
    } catch (error) {
      logger.error('[Meta WhatsApp] Failed to send team notification', error);
      return false;
    }
  }

  /**
   * Send launch event invitation
   * @param phoneNumber - Recipient's WhatsApp number
   * @param language - Message language ('he' | 'en')
   * @param recipientName - Optional recipient name for personalization
   */
  static async sendLaunchEventInvitation(params: {
    phoneNumber: string;
    language?: 'he' | 'en';
    recipientName?: string;
  }): Promise<boolean> {
    const lang = params.language || 'he';
    const name = params.recipientName || '';

    const messageHebrew = `
🎉 *PetWash™ - אירוע השקה חגיגי!* 🐾

שלום ${name},

אנו נרגשים להזמין אותך לאירוע ההשקה הראשון בישראל! 🇮🇱

🏛️ *בשיתוף עיריית כפר סבא*

📍 **פרטי האירוע:**
• 🏢 מיקום: רח' החושן 2, כפר סבא
• 🗓️ תאריך: בקרוב - הודעה נוספת תישלח
• ⭐ טכנולוגיה: K9000 Twin - עמדות שטיפה חכמות

🌟 **הפיילוט הראשון:**
• שטיפה אורגנית פרימיום
• טכנולוגיה מתקדמת מארה"ב
• חוויה ייחודית לחיות המחמד שלכם

💎 *Premium Organic Pet Care Platform*

✨ הצטרף אלינו למהפכה בטיפול בחיות מחמד בישראל!

_PetWash Ltd - Where Innovation Meets Pet Care_ 🐕

---
לפרטים נוספים: www.petwash.co.il
מוקד תמיכה: +972549833355
    `.trim();

    const messageEnglish = `
🎉 *PetWash™ - Grand Launch Event!* 🐾

Hello ${name},

We're thrilled to invite you to Israel's first pilot launch! 🇮🇱

🏛️ *In Partnership with Kfar Saba Municipality*

📍 **Event Details:**
• 🏢 Location: 2 HaChoshen St, Kfar Saba
• 🗓️ Date: Coming Soon - Further notice to follow
• ⭐ Technology: K9000 Twin - Smart Wash Stations

🌟 **Israel's First Pilot:**
• Premium organic washing
• Advanced technology from USA
• Unique experience for your pets

💎 *Premium Organic Pet Care Platform*

✨ Join us for the revolution in pet care in Israel!

_PetWash Ltd - Where Innovation Meets Pet Care_ 🐕

---
For more info: www.petwash.co.il
Support Center: +972549833355
    `.trim();

    const message = lang === 'en' ? messageEnglish : messageHebrew;

    return await this.sendMessage(params.phoneNumber, message);
  }

  /**
   * Validate WhatsApp phone number format
   * @param phoneNumber - Phone number to validate
   * @returns true if valid E.164 format
   */
  static isValidPhoneNumber(phoneNumber: string): boolean {
    // E.164 format: +[country code][number]
    // Israel: +972XXXXXXXXX (9 digits after country code)
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    const israelRegex = /^\+972\d{9}$/;
    
    return e164Regex.test(phoneNumber) || israelRegex.test(phoneNumber);
  }
}
