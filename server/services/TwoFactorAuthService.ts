import { logger } from '../lib/logger';
import { twilioSMSService } from './TwilioSMSService';
import { sendLuxuryEmail } from '../email/luxury-email-service';
import { PETWASH_LOGO_BASE64 } from '../email/templates/logo-base64';
import crypto from 'crypto';

interface EmailOTP {
  code: string;
  email: string;
  expiresAt: Date;
  attempts: number;
}

interface TwoFactorSession {
  userId: string;
  method: 'sms' | 'email' | 'both';
  phone?: string;
  email?: string;
  verified: { sms: boolean; email: boolean };
  createdAt: Date;
  expiresAt: Date;
}

const emailOTPs = new Map<string, EmailOTP>();
const twoFactorSessions = new Map<string, TwoFactorSession>();
const CODE_EXPIRY_MINUTES = 10;
const MAX_EMAIL_ATTEMPTS = 5;

function generateCode(): string {
  return Math.floor(100000 + crypto.randomInt(900000)).toString();
}

function generate2FAEmailHtml(code: string, firstName: string, language: 'he' | 'en'): string {
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Georgia', serif;">
  <div style="max-width: 520px; margin: 0 auto; padding: 32px 16px;">
    <div style="background: #ffffff; border-radius: 2px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding: 40px; text-align: center; position: relative;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #dcc07a, #c9a96e);"></div>
        <img src="${PETWASH_LOGO_BASE64}" alt="Pet Wash™" style="max-width: 120px; height: auto; margin-bottom: 16px;" />
        <h1 style="color: #ffffff; font-size: 22px; font-weight: 400; margin: 0; font-family: 'Georgia', serif;">
          ${isHebrew ? 'אימות דו-שלבי' : 'Two-Factor Verification'}
        </h1>
      </div>
      <div style="height: 2px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #dcc07a, #e8d5a3, #c9a96e);"></div>
      <div style="padding: 44px;">
        <p style="font-size: 15px; color: #475569; margin: 0 0 24px; text-align: ${isHebrew ? 'right' : 'left'}; line-height: 1.8;">
          ${isHebrew ? `שלום ${firstName}, הנה קוד האימות שלך:` : `Hi ${firstName}, here is your verification code:`}
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 2px solid #c9a96e; border-radius: 2px; padding: 20px 40px; font-size: 36px; font-weight: 700; letter-spacing: 12px; color: #0f172a; font-family: 'Courier New', monospace;">
            ${code}
          </div>
        </div>
        <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 24px 0 0;">
          ${isHebrew ? `תוקף: ${CODE_EXPIRY_MINUTES} דקות. לא ביקשת קוד זה? התעלם מהודעה זו.` : `Valid for ${CODE_EXPIRY_MINUTES} minutes. Didn't request this? Ignore this email.`}
        </p>
      </div>
      <div style="background: #0f172a; padding: 24px; text-align: center;">
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 0;">© ${new Date().getFullYear()} Pet Wash™</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

class TwoFactorAuthService {
  async sendCode(
    userId: string,
    method: 'sms' | 'email' | 'both',
    contact: { phone?: string; email?: string; firstName?: string },
    language: string = 'he'
  ): Promise<{ success: boolean; message: string; sentVia: string[] }> {
    const sentVia: string[] = [];

    if ((method === 'sms' || method === 'both') && contact.phone) {
      const smsResult = await twilioSMSService.sendVerificationCode(contact.phone, language);
      if (smsResult.success) {
        sentVia.push('sms');
      } else {
        logger.warn('[2FA] SMS send failed', { userId });
      }
    }

    if ((method === 'email' || method === 'both') && contact.email) {
      const code = generateCode();
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);
      
      emailOTPs.set(userId, {
        code,
        email: contact.email,
        expiresAt,
        attempts: 0,
      });

      const lang: 'he' | 'en' = language === 'he' ? 'he' : 'en';
      const html = generate2FAEmailHtml(code, contact.firstName || '', lang);
      const sent = await sendLuxuryEmail({
        to: contact.email,
        subject: lang === 'he' ? `קוד אימות דו-שלבי — Pet Wash™` : `Two-Factor Verification Code — Pet Wash™`,
        html,
      });
      if (sent) {
        sentVia.push('email');
      } else {
        logger.warn('[2FA] Email send failed', { userId });
      }
    }

    if (sentVia.length === 0) {
      return {
        success: false,
        message: language === 'he' ? 'שליחת קוד האימות נכשלה' : 'Failed to send verification code',
        sentVia: [],
      };
    }

    twoFactorSessions.set(userId, {
      userId,
      method,
      phone: contact.phone,
      email: contact.email,
      verified: { sms: false, email: false },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000),
    });

    return {
      success: true,
      message: language === 'he' ? 'קוד אימות נשלח בהצלחה' : 'Verification code sent successfully',
      sentVia,
    };
  }

  verifySmsCode(
    userId: string,
    phone: string,
    code: string,
    language: string = 'he'
  ): { success: boolean; message: string; fullyVerified?: boolean } {
    const session = twoFactorSessions.get(userId);
    if (!session) {
      return { success: false, message: language === 'he' ? 'אין אימות פעיל' : 'No active verification session' };
    }

    if (session.phone && phone !== session.phone) {
      return { success: false, message: language === 'he' ? 'מספר טלפון לא תואם' : 'Phone number does not match session' };
    }

    const result = twilioSMSService.verifyCode(phone, code, language);
    if (!result.success) {
      return { success: false, message: result.message };
    }

    session.verified.sms = true;
    return this.checkFullVerification(userId, language);
  }

  verifyEmailCode(
    userId: string,
    code: string,
    language: string = 'he'
  ): { success: boolean; message: string; fullyVerified?: boolean } {
    const session = twoFactorSessions.get(userId);
    if (!session) {
      return { success: false, message: language === 'he' ? 'אין אימות פעיל' : 'No active verification session' };
    }

    const otp = emailOTPs.get(userId);
    if (!otp) {
      return { success: false, message: language === 'he' ? 'לא נמצא קוד אימות' : 'No email code found' };
    }

    if (new Date() > otp.expiresAt) {
      emailOTPs.delete(userId);
      return { success: false, message: language === 'he' ? 'הקוד פג תוקף' : 'Code expired' };
    }

    if (otp.attempts >= MAX_EMAIL_ATTEMPTS) {
      emailOTPs.delete(userId);
      return { success: false, message: language === 'he' ? 'חריגה ממספר ניסיונות' : 'Too many attempts' };
    }

    if (otp.code !== code) {
      otp.attempts++;
      const remaining = MAX_EMAIL_ATTEMPTS - otp.attempts;
      return {
        success: false,
        message: language === 'he' ? `קוד שגוי. נותרו ${remaining} ניסיונות.` : `Invalid code. ${remaining} attempts remaining.`,
      };
    }

    emailOTPs.delete(userId);
    session.verified.email = true;
    return this.checkFullVerification(userId, language);
  }

  private checkFullVerification(
    userId: string,
    language: string
  ): { success: boolean; message: string; fullyVerified: boolean } {
    const session = twoFactorSessions.get(userId);
    if (!session) {
      return { success: false, message: 'Session not found', fullyVerified: false };
    }

    const needsSms = session.method === 'sms' || session.method === 'both';
    const needsEmail = session.method === 'email' || session.method === 'both';
    const fullyVerified =
      (!needsSms || session.verified.sms) &&
      (!needsEmail || session.verified.email);

    if (fullyVerified) {
      twoFactorSessions.delete(userId);
      return {
        success: true,
        message: language === 'he' ? 'אימות דו-שלבי הושלם בהצלחה!' : 'Two-factor verification complete!',
        fullyVerified: true,
      };
    }

    const pending = [];
    if (needsSms && !session.verified.sms) pending.push(language === 'he' ? 'SMS' : 'SMS');
    if (needsEmail && !session.verified.email) pending.push(language === 'he' ? 'אימייל' : 'email');

    return {
      success: true,
      message: language === 'he'
        ? `אומת בהצלחה. נא להשלים אימות גם ב: ${pending.join(', ')}`
        : `Verified. Please also verify via: ${pending.join(', ')}`,
      fullyVerified: false,
    };
  }

  hasPendingVerification(userId: string): boolean {
    const session = twoFactorSessions.get(userId);
    if (!session) return false;
    if (new Date() > session.expiresAt) {
      twoFactorSessions.delete(userId);
      return false;
    }
    return true;
  }

  getSessionStatus(userId: string): {
    active: boolean;
    method?: string;
    verified?: { sms: boolean; email: boolean };
  } {
    const session = twoFactorSessions.get(userId);
    if (!session || new Date() > session.expiresAt) {
      return { active: false };
    }
    return {
      active: true,
      method: session.method,
      verified: session.verified,
    };
  }
}

export const twoFactorAuth = new TwoFactorAuthService();
