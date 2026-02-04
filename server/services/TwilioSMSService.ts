import twilio from 'twilio';
import { logger } from '../lib/logger';
import crypto from 'crypto';

interface VerificationCode {
  code: string;
  phone: string;
  expiresAt: Date;
  attempts: number;
}

interface VerificationToken {
  phone: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}

const verificationCodes = new Map<string, VerificationCode>();
const verificationTokens = new Map<string, VerificationToken>();

const VERIFICATION_CODE_EXPIRY_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 3;
const VERIFICATION_TOKEN_EXPIRY_MINUTES = 5;

class TwilioSMSService {
  private client: twilio.Twilio | null = null;
  private fromPhone: string | null = null;
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && fromPhone) {
      try {
        this.client = twilio(accountSid, authToken);
        this.fromPhone = fromPhone;
        this.isConfigured = true;
        logger.info('[TwilioSMS] ✅ Initialized successfully');
      } catch (error) {
        logger.error('[TwilioSMS] Failed to initialize', { error });
        this.isConfigured = false;
      }
    } else {
      logger.warn('[TwilioSMS] ⚠️ Not configured - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER missing');
      this.isConfigured = false;
    }
  }

  isReady(): boolean {
    return this.isConfigured && this.client !== null;
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '972' + cleaned.substring(1);
    }
    
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  async sendVerificationCode(phone: string, language: 'he' | 'en' = 'he'): Promise<{
    success: boolean;
    message: string;
    expiresIn?: number;
  }> {
    if (!this.isReady()) {
      return {
        success: false,
        message: language === 'he' 
          ? 'שירות ה-SMS לא זמין כרגע'
          : 'SMS service is not available at the moment'
      };
    }

    const formattedPhone = this.formatPhoneNumber(phone);
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    verificationCodes.set(formattedPhone, {
      code,
      phone: formattedPhone,
      expiresAt,
      attempts: 0
    });

    const messageBody = language === 'he'
      ? `קוד האימות שלך ל-Pet Wash™ הוא: ${code}\nתוקף: ${VERIFICATION_CODE_EXPIRY_MINUTES} דקות`
      : `Your Pet Wash™ verification code is: ${code}\nValid for ${VERIFICATION_CODE_EXPIRY_MINUTES} minutes`;

    try {
      await this.client!.messages.create({
        body: messageBody,
        from: this.fromPhone!,
        to: formattedPhone
      });

      logger.info('[TwilioSMS] Verification code sent', { 
        phone: formattedPhone.slice(0, 6) + '****',
        expiresAt 
      });

      return {
        success: true,
        message: language === 'he'
          ? 'קוד אימות נשלח בהצלחה'
          : 'Verification code sent successfully',
        expiresIn: VERIFICATION_CODE_EXPIRY_MINUTES * 60
      };
    } catch (error: any) {
      const errorDetails = {
        message: error.message || 'Unknown error',
        code: error.code,
        status: error.status,
        moreInfo: error.moreInfo,
        details: error.details,
        phone: formattedPhone.slice(0, 6) + '****'
      };
      logger.error('[TwilioSMS] Failed to send verification code', errorDetails);
      console.error('[TwilioSMS] Full error:', JSON.stringify(error, null, 2));

      return {
        success: false,
        message: language === 'he'
          ? 'שגיאה בשליחת קוד האימות. נסה שוב.'
          : 'Failed to send verification code. Please try again.'
      };
    }
  }

  verifyCode(phone: string, code: string, language: 'he' | 'en' = 'he'): {
    success: boolean;
    message: string;
    verificationToken?: string;
  } {
    const formattedPhone = this.formatPhoneNumber(phone);
    const stored = verificationCodes.get(formattedPhone);

    if (!stored) {
      return {
        success: false,
        message: language === 'he'
          ? 'לא נמצא קוד אימות. בקש קוד חדש.'
          : 'No verification code found. Request a new code.'
      };
    }

    if (new Date() > stored.expiresAt) {
      verificationCodes.delete(formattedPhone);
      return {
        success: false,
        message: language === 'he'
          ? 'קוד האימות פג תוקף. בקש קוד חדש.'
          : 'Verification code expired. Request a new code.'
      };
    }

    if (stored.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      verificationCodes.delete(formattedPhone);
      return {
        success: false,
        message: language === 'he'
          ? 'חרגת ממספר הניסיונות המותר. בקש קוד חדש.'
          : 'Too many attempts. Request a new code.'
      };
    }

    if (stored.code !== code) {
      stored.attempts++;
      return {
        success: false,
        message: language === 'he'
          ? `קוד שגוי. נותרו ${MAX_VERIFICATION_ATTEMPTS - stored.attempts} ניסיונות.`
          : `Invalid code. ${MAX_VERIFICATION_ATTEMPTS - stored.attempts} attempts remaining.`
      };
    }

    verificationCodes.delete(formattedPhone);
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MINUTES * 60 * 1000);
    
    verificationTokens.set(verificationToken, {
      phone: formattedPhone,
      token: verificationToken,
      expiresAt,
      used: false
    });
    
    logger.info('[TwilioSMS] Phone verified successfully, token issued', { 
      phone: formattedPhone.slice(0, 6) + '****'
    });

    return {
      success: true,
      message: language === 'he'
        ? 'הטלפון אומת בהצלחה!'
        : 'Phone verified successfully!',
      verificationToken
    };
  }

  validateVerificationToken(token: string): { valid: boolean; phone?: string } {
    const stored = verificationTokens.get(token);
    
    if (!stored) {
      return { valid: false };
    }

    if (stored.used) {
      verificationTokens.delete(token);
      return { valid: false };
    }

    if (new Date() > stored.expiresAt) {
      verificationTokens.delete(token);
      return { valid: false };
    }

    stored.used = true;
    verificationTokens.delete(token);
    
    logger.info('[TwilioSMS] Verification token validated and consumed', { 
      phone: stored.phone.slice(0, 6) + '****'
    });

    return { valid: true, phone: stored.phone };
  }

  async sendSMS(to: string, body: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (!this.isReady()) {
      return {
        success: false,
        error: 'SMS service not configured'
      };
    }

    const formattedPhone = this.formatPhoneNumber(to);

    try {
      const message = await this.client!.messages.create({
        body,
        from: this.fromPhone!,
        to: formattedPhone
      });

      logger.info('[TwilioSMS] SMS sent', { 
        to: formattedPhone.slice(0, 6) + '****',
        messageId: message.sid
      });

      return {
        success: true,
        messageId: message.sid
      };
    } catch (error: any) {
      logger.error('[TwilioSMS] Failed to send SMS', { 
        error: error.message,
        to: formattedPhone.slice(0, 6) + '****'
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const twilioSMSService = new TwilioSMSService();
