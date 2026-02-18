import crypto from 'crypto';
import { logger } from '../lib/logger';
import { redis } from './redis';
import { twilioSMSService } from './TwilioSMSService';
import { sendLuxuryEmail } from '../email/luxury-email-service';
import { PETWASH_LOGO_BASE64 } from '../email/templates/logo-base64';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const TX_OTP_TTL_SEC = 300;
const TX_OTP_MAX_ATTEMPTS = 5;
const TX_OTP_COOLDOWN_SEC = 30;
const TX_IP_MAX_REQUESTS_10MIN = 20;
const TX_USER_MAX_REQUESTS_HOUR = 10;

export type TransactionType =
  | 'egift_purchase'
  | 'wallet_topup'
  | 'payment_method_change'
  | 'large_booking'
  | 'loyalty_redemption'
  | 'password_change'
  | 'email_change'
  | 'provider_payout'
  | 'bank_details_change'
  | 'profile_phone_change';

interface TransactionOTPRecord {
  code: string;
  userId: string;
  transactionType: TransactionType;
  amount?: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  ip?: string;
}

const TRANSACTION_LABELS: Record<TransactionType, { he: string; en: string }> = {
  egift_purchase: { he: 'רכישת כרטיס מתנה דיגיטלי', en: 'E-Gift Card Purchase' },
  wallet_topup: { he: 'טעינת ארנק דיגיטלי', en: 'Wallet Top-Up' },
  payment_method_change: { he: 'שינוי אמצעי תשלום', en: 'Payment Method Change' },
  large_booking: { he: 'הזמנה בסכום גבוה', en: 'Large Booking' },
  loyalty_redemption: { he: 'מימוש נקודות נאמנות', en: 'Loyalty Points Redemption' },
  password_change: { he: 'שינוי סיסמה', en: 'Password Change' },
  email_change: { he: 'שינוי כתובת אימייל', en: 'Email Address Change' },
  provider_payout: { he: 'בקשת תשלום לספק', en: 'Provider Payout Request' },
  bank_details_change: { he: 'שינוי פרטי חשבון בנק', en: 'Bank Details Change' },
  profile_phone_change: { he: 'שינוי מספר טלפון', en: 'Phone Number Change' },
};

function generateSecureOTP(): string {
  return String(Math.floor(100000 + crypto.randomInt(900000)));
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizePhone(phone: string): string {
  let cleaned = String(phone || '').trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '+972' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

function txOtpKey(userId: string, sessionId: string): string {
  return `txotp:code:${userId}:${sessionId}`;
}

function txMetaKey(userId: string, sessionId: string): string {
  return `txotp:meta:${userId}:${sessionId}`;
}

function txAttemptKey(userId: string, sessionId: string): string {
  return `txotp:attempts:${userId}:${sessionId}`;
}

function txCooldownKey(userId: string): string {
  return `txotp:cooldown:${userId}`;
}

function txIpRateKey(ip: string): string {
  return `txotp:ip:${ip}`;
}

function txUserHourlyKey(userId: string): string {
  return `txotp:hourly:${userId}`;
}

function txPhoneRateKey(phone: string): string {
  return `txotp:phone:${phone}`;
}

const TX_PHONE_MAX_REQUESTS_HOUR = 5;

function generateTransactionOTPEmailHtml(
  code: string,
  firstName: string,
  transactionType: TransactionType,
  amount: string | undefined,
  currency: string | undefined,
  language: 'he' | 'en'
): string {
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';
  const label = TRANSACTION_LABELS[transactionType]?.[language] || transactionType;
  const amountText = amount && currency ? ` (${currency} ${amount})` : '';

  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Georgia', serif;">
  <div style="max-width: 520px; margin: 0 auto; padding: 32px 16px;">
    <div style="background: #ffffff; border-radius: 2px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding: 40px; text-align: center; position: relative;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #dcc07a, #c9a96e);"></div>
        <img src="${PETWASH_LOGO_BASE64}" alt="\u2066Pet Wash\u2122\u2069" style="max-width: 120px; height: auto; margin-bottom: 16px;" />
        <h1 style="color: #ffffff; font-size: 20px; font-weight: 400; margin: 0; font-family: 'Georgia', serif;">
          ${isHebrew ? 'אימות פעולה מאובטח' : 'Secure Transaction Verification'}
        </h1>
      </div>
      <div style="height: 2px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #dcc07a, #e8d5a3, #c9a96e);"></div>
      <div style="padding: 44px;">
        <p style="font-size: 15px; color: #475569; margin: 0 0 12px; text-align: ${isHebrew ? 'right' : 'left'}; line-height: 1.8;">
          ${isHebrew ? `שלום ${firstName},` : `Hi ${firstName},`}
        </p>
        <p style="font-size: 15px; color: #475569; margin: 0 0 24px; text-align: ${isHebrew ? 'right' : 'left'}; line-height: 1.8;">
          ${isHebrew
            ? `קיבלנו בקשה ל<strong>${label}</strong>${amountText}. הזינו את הקוד הבא לאישור הפעולה:`
            : `We received a request for <strong>${label}</strong>${amountText}. Enter the code below to confirm:`}
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 2px solid #c9a96e; border-radius: 2px; padding: 20px 40px; font-size: 36px; font-weight: 700; letter-spacing: 12px; color: #0f172a; font-family: 'Courier New', monospace;">
            ${code}
          </div>
        </div>
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 12px 16px; margin: 24px 0;">
          <p style="font-size: 13px; color: #92400e; margin: 0; text-align: ${isHebrew ? 'right' : 'left'};">
            ${isHebrew
              ? '⚠️ לעולם אל תשתפו קוד זה עם אף אחד. צוות \u2066Pet Wash\u2122\u2069 לעולם לא יבקש ממכם קוד אימות.'
              : '⚠️ Never share this code with anyone. \u2066Pet Wash\u2122\u2069 team will never ask for your verification code.'}
          </p>
        </div>
        <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 24px 0 0;">
          ${isHebrew
            ? 'תוקף הקוד: 5 דקות. לא ביצעתם פעולה זו? התעלמו מהודעה זו ושנו את הסיסמה שלכם.'
            : 'This code expires in 5 minutes. Didn\'t make this request? Ignore this email and change your password.'}
        </p>
      </div>
      <div style="background: #0f172a; padding: 24px; text-align: center;">
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 0;">\u00a9 ${new Date().getFullYear()} \u2066Pet Wash\u2122\u2069</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildSmsBody(
  code: string,
  transactionType: TransactionType,
  amount: string | undefined,
  currency: string | undefined,
  language: 'he' | 'en'
): string {
  const label = TRANSACTION_LABELS[transactionType]?.[language] || transactionType;
  const amountText = amount && currency ? ` (${currency} ${amount})` : '';
  const expiry = Math.floor(TX_OTP_TTL_SEC / 60);

  if (language === 'he') {
    return `Pet Wash\u2122 - קוד אימות לפעולת ${label}${amountText}: ${code}\nתוקף: ${expiry} דקות. אל תשתפו קוד זה.\n@petwash.co.il #${code}`;
  }
  return `Pet Wash\u2122 - Your ${label}${amountText} verification code: ${code}\nExpires in ${expiry} min. Never share this code.\n@petwash.co.il #${code}`;
}

class TransactionOTPService {
  private isRedisAvailable(): boolean {
    const status = redis.getStatus();
    return status.enabled && status.connected;
  }

  async sendTransactionOTP(args: {
    userId: string;
    transactionType: TransactionType;
    amount?: string;
    currency?: string;
    language?: string;
    ip?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    sessionId?: string;
    sentVia?: string[];
    expiresIn?: number;
    error?: string;
    message: string;
  }> {
    const {
      userId,
      transactionType,
      amount,
      currency,
      ip,
      metadata,
    } = args;
    const language: 'he' | 'en' = String(args.language || '').startsWith('he') ? 'he' : 'en';

    if (!userId) {
      return { success: false, message: language === 'he' ? 'משתמש לא מזוהה' : 'User not identified', error: 'missing_userId' };
    }

    let phone = '';
    let email = '';
    let firstName = '';
    try {
      const [user] = await db.select({
        phone: users.phone,
        email: users.email,
        firstName: users.firstName,
      }).from(users).where(eq(users.id, userId)).limit(1);

      if (user) {
        phone = user.phone ? normalizePhone(user.phone) : '';
        email = user.email ? String(user.email).trim().toLowerCase() : '';
        firstName = String(user.firstName || '').trim();
      }
    } catch (err) {
      logger.error('[TransactionOTP] Failed to fetch user profile', err);
    }

    if (!phone && !email) {
      return { success: false, message: language === 'he' ? 'לא נמצא מספר טלפון או אימייל מאומת בחשבון שלכם' : 'No verified phone or email found on your account', error: 'no_verified_channel' };
    }

    if (!this.isRedisAvailable()) {
      logger.error('[TransactionOTP] Redis unavailable');
      return { success: false, message: language === 'he' ? 'שירות האימות לא זמין כרגע' : 'Verification service temporarily unavailable', error: 'service_unavailable' };
    }

    if (ip) {
      const ipKey = txIpRateKey(ip);
      const ipCount = await redis.incr(ipKey);
      if (ipCount === 1) await redis.expire(ipKey, 600);
      if (ipCount > TX_IP_MAX_REQUESTS_10MIN) {
        logger.warn('[TransactionOTP] IP rate limit exceeded', { ip: ip.slice(0, 8) + '***' });
        return { success: false, message: language === 'he' ? 'יותר מדי בקשות. נסו שוב מאוחר יותר' : 'Too many requests. Please try again later', error: 'rate_limited_ip' };
      }
    }

    const hourlyKey = txUserHourlyKey(userId);
    const hourlyCount = await redis.incr(hourlyKey);
    if (hourlyCount === 1) await redis.expire(hourlyKey, 3600);
    if (hourlyCount > TX_USER_MAX_REQUESTS_HOUR) {
      logger.warn('[TransactionOTP] User hourly limit exceeded', { userId });
      return { success: false, message: language === 'he' ? 'חרגתם ממכסת האימותים. נסו שוב בעוד שעה' : 'Verification limit reached. Try again in an hour', error: 'rate_limited_user' };
    }

    if (phone) {
      const phoneKey = txPhoneRateKey(phone);
      const phoneCount = await redis.incr(phoneKey);
      if (phoneCount === 1) await redis.expire(phoneKey, 3600);
      if (phoneCount > TX_PHONE_MAX_REQUESTS_HOUR) {
        logger.warn('[TransactionOTP] Phone rate limit exceeded', { phone: phone.slice(0, 6) + '****' });
        return { success: false, message: language === 'he' ? 'יותר מדי בקשות למספר זה. נסו שוב מאוחר יותר' : 'Too many requests for this number. Try again later', error: 'rate_limited_phone' };
      }
    }

    const cooldownExists = await redis.getRaw(txCooldownKey(userId));
    if (cooldownExists) {
      return { success: false, message: language === 'he' ? 'אנא המתינו 30 שניות לפני בקשת קוד נוסף' : 'Please wait 30 seconds before requesting another code', error: 'cooldown_active' };
    }
    await redis.setRaw(txCooldownKey(userId), '1', TX_OTP_COOLDOWN_SEC);

    const sessionId = crypto.randomUUID();
    const code = generateSecureOTP();

    await redis.setRaw(txOtpKey(userId, sessionId), code, TX_OTP_TTL_SEC);

    const record: TransactionOTPRecord = {
      code: '***',
      userId,
      transactionType,
      amount,
      currency,
      metadata,
      createdAt: new Date().toISOString(),
      ip: ip ? ip.slice(0, 8) + '***' : undefined,
    };
    await redis.setRaw(txMetaKey(userId, sessionId), JSON.stringify(record), TX_OTP_TTL_SEC + 60);

    const sentVia: string[] = [];

    if (phone && phone.startsWith('+')) {
      try {
        const smsBody = buildSmsBody(code, transactionType, amount, currency, language);
        const result = await twilioSMSService.sendSMS(phone, smsBody);
        if (result.success) {
          sentVia.push('sms');
        } else {
          logger.warn('[TransactionOTP] SMS send failed', { userId, error: result.error });
        }
      } catch (error) {
        logger.error('[TransactionOTP] SMS exception', error);
      }
    }

    if (email && email.includes('@')) {
      try {
        const html = generateTransactionOTPEmailHtml(code, firstName, transactionType, amount, currency, language);
        const subject = language === 'he'
          ? `קוד אימות פעולה — \u2066Pet Wash\u2122\u2069`
          : `Transaction Verification Code — \u2066Pet Wash\u2122\u2069`;
        const sent = await sendLuxuryEmail({ to: email, subject, html });
        if (sent) {
          sentVia.push('email');
        } else {
          logger.warn('[TransactionOTP] Email send failed', { userId });
        }
      } catch (error) {
        logger.error('[TransactionOTP] Email exception', error);
      }
    }

    if (sentVia.length === 0) {
      await redis.del(txOtpKey(userId, sessionId));
      await redis.del(txMetaKey(userId, sessionId));
      return { success: false, message: language === 'he' ? 'שליחת קוד האימות נכשלה. נסו שנית' : 'Failed to send verification code. Please try again', error: 'delivery_failed' };
    }

    logger.info('[TransactionOTP] OTP sent', {
      userId,
      sessionId,
      transactionType,
      sentVia,
      amount: amount || 'n/a',
    });

    return {
      success: true,
      sessionId,
      sentVia,
      expiresIn: TX_OTP_TTL_SEC,
      message: language === 'he' ? 'קוד אימות נשלח בהצלחה' : 'Verification code sent successfully',
    };
  }

  async verifyTransactionOTP(args: {
    userId: string;
    sessionId: string;
    code: string;
    language?: string;
  }): Promise<{
    success: boolean;
    verified: boolean;
    transactionToken?: string;
    error?: string;
    message: string;
    remainingAttempts?: number;
  }> {
    const { userId, sessionId, code } = args;
    const language: 'he' | 'en' = String(args.language || '').startsWith('he') ? 'he' : 'en';

    if (!userId || !sessionId || !code) {
      return { success: false, verified: false, message: language === 'he' ? 'חסרים שדות נדרשים' : 'Missing required fields', error: 'missing_fields' };
    }

    if (!this.isRedisAvailable()) {
      return { success: false, verified: false, message: language === 'he' ? 'שירות האימות לא זמין כרגע' : 'Service temporarily unavailable', error: 'service_unavailable' };
    }

    const attKey = txAttemptKey(userId, sessionId);
    const attempts = await redis.incr(attKey);
    if (attempts === 1) await redis.expire(attKey, TX_OTP_TTL_SEC);

    if (attempts > TX_OTP_MAX_ATTEMPTS) {
      await redis.del(txOtpKey(userId, sessionId));
      await redis.del(txMetaKey(userId, sessionId));
      logger.warn('[TransactionOTP] Max attempts exceeded', { userId, sessionId });
      return {
        success: false,
        verified: false,
        message: language === 'he' ? 'חרגתם ממספר הניסיונות המותר. בקשו קוד חדש' : 'Too many attempts. Please request a new code',
        error: 'too_many_attempts',
        remainingAttempts: 0,
      };
    }

    const stored = await redis.getRaw(txOtpKey(userId, sessionId));
    if (!stored) {
      return {
        success: false,
        verified: false,
        message: language === 'he' ? 'הקוד פג תוקף או לא נמצא. בקשו קוד חדש' : 'Code expired or not found. Request a new one',
        error: 'expired_or_missing',
      };
    }

    const valid = constantTimeEqual(stored, String(code).trim());
    if (!valid) {
      const remaining = TX_OTP_MAX_ATTEMPTS - attempts;
      logger.info('[TransactionOTP] Invalid code attempt', { userId, sessionId, remaining });
      return {
        success: false,
        verified: false,
        message: language === 'he' ? `קוד שגוי. נותרו ${remaining} ניסיונות` : `Invalid code. ${remaining} attempts remaining`,
        error: 'invalid_code',
        remainingAttempts: remaining,
      };
    }

    await redis.del(txOtpKey(userId, sessionId));
    await redis.del(attKey);

    const transactionToken = crypto.randomBytes(32).toString('hex');
    const tokenKey = `txotp:token:${transactionToken}`;
    const metaRaw = await redis.getRaw(txMetaKey(userId, sessionId));
    await redis.setRaw(tokenKey, JSON.stringify({
      userId,
      sessionId,
      verifiedAt: new Date().toISOString(),
      meta: metaRaw ? JSON.parse(metaRaw) : {},
    }), 600);
    await redis.del(txMetaKey(userId, sessionId));

    logger.info('[TransactionOTP] Verified successfully', { userId, sessionId });

    return {
      success: true,
      verified: true,
      transactionToken,
      message: language === 'he' ? 'אימות הושלם בהצלחה!' : 'Verification complete!',
    };
  }

  async validateTransactionToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    transactionType?: TransactionType;
  }> {
    if (!token) return { valid: false };

    const tokenKey = `txotp:token:${token}`;
    const raw = await redis.getRaw(tokenKey);
    if (!raw) return { valid: false };

    try {
      const data = JSON.parse(raw);
      await redis.del(tokenKey);
      return {
        valid: true,
        userId: data.userId,
        transactionType: data.meta?.transactionType,
      };
    } catch {
      return { valid: false };
    }
  }

  async getSessionStatus(userId: string, sessionId: string): Promise<{
    active: boolean;
    remainingSeconds?: number;
  }> {
    if (!this.isRedisAvailable()) return { active: false };

    const exists = await redis.getRaw(txOtpKey(userId, sessionId));
    if (!exists) return { active: false };

    return { active: true, remainingSeconds: TX_OTP_TTL_SEC };
  }

  getTransactionLabel(type: TransactionType, language: 'he' | 'en' = 'he'): string {
    return TRANSACTION_LABELS[type]?.[language] || type;
  }

  getTransactionTypes(): { value: TransactionType; labelHe: string; labelEn: string }[] {
    return Object.entries(TRANSACTION_LABELS).map(([value, labels]) => ({
      value: value as TransactionType,
      labelHe: labels.he,
      labelEn: labels.en,
    }));
  }
}

export const transactionOTPService = new TransactionOTPService();
