import { logger } from '../lib/logger';
import { redis } from './redis';
import { sendLuxuryEmail } from '../email/luxury-email-service';
import { PETWASH_LOGO_BASE64 } from '../email/templates/logo-base64';
import crypto from 'crypto';

const OTP_TTL_SEC = 300;
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SEC = 30;
const IP_MAX_REQUESTS_PER_10MIN = 40;

function generateOtp6(): string {
  return String(Math.floor(100000 + crypto.randomInt(900000)));
}

function constantTimeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
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

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function isHebrewLocale(locale?: string): boolean {
  return String(locale || '').toLowerCase().startsWith('he');
}

function otpKey(userId: string, sessionId: string): string {
  return `2fa:otp:${userId}:${sessionId}`;
}

function attemptKey(userId: string, sessionId: string): string {
  return `2fa:attempts:${userId}:${sessionId}`;
}

function cooldownKey(userId: string): string {
  return `rl:userCooldown:${userId}`;
}

function ipRateLimitKey(ip: string): string {
  return `rl:ip:${ip}`;
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
        <img src="${PETWASH_LOGO_BASE64}" alt="⁦Pet Wash™⁩" style="max-width: 120px; height: auto; margin-bottom: 16px;" />
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
          ${isHebrew ? `תוקף: 5 דקות. לא ביקשת קוד זה? התעלם מהודעה זו.` : `Valid for 5 minutes. Didn't request this? Ignore this email.`}
        </p>
      </div>
      <div style="background: #0f172a; padding: 24px; text-align: center;">
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 0;">© ${new Date().getFullYear()} ⁦Pet Wash™⁩</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export interface SessionRecord {
  sessionId: string;
  userId: string;
  method: 'sms' | 'email' | 'both';
  locale: 'he' | 'en';
  createdAt: string;
  verified2fa: boolean;
  verifiedAt?: string;
  ip?: string;
  deviceId?: string;
  deviceTrusted?: boolean;
  meta?: Record<string, any>;
}

async function stampSessionToFirestore(rec: SessionRecord): Promise<void> {
  try {
    const { db } = await import('../lib/firebase-admin');
    await db.collection('sessions').doc(rec.sessionId).set(rec, { merge: false });
    logger.info('[2FA-Octopus] Session stamped to Firestore', { sessionId: rec.sessionId, userId: rec.userId });
  } catch (error) {
    logger.error('[2FA-Octopus] Firestore session stamp failed', error);
  }
}

async function markSessionVerifiedInFirestore(userId: string, sessionId: string): Promise<void> {
  try {
    const { db } = await import('../lib/firebase-admin');
    await db.collection('sessions').doc(sessionId).set(
      { userId, verified2fa: true, verifiedAt: new Date().toISOString() },
      { merge: true }
    );
    logger.info('[2FA-Octopus] Session marked verified in Firestore', { sessionId, userId });
  } catch (error) {
    logger.error('[2FA-Octopus] Firestore verify stamp failed', error);
  }
}

async function setTrustedDeviceInFirestore(userId: string, deviceId: string): Promise<void> {
  try {
    const { db } = await import('../lib/firebase-admin');
    await db.collection('trustedDevices').doc(`${userId}:${deviceId}`).set(
      { userId, deviceId, trusted: true, trustedAt: new Date().toISOString() },
      { merge: true }
    );
    logger.info('[2FA-Octopus] Device trusted in Firestore', { userId, deviceId });
  } catch (error) {
    logger.error('[2FA-Octopus] Firestore device trust failed', error);
  }
}

class OctopusTwoFactorService {

  async checkIpRateLimit(ip: string): Promise<boolean> {
    const key = ipRateLimitKey(ip);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 600);
    }
    return count <= IP_MAX_REQUESTS_PER_10MIN;
  }

  async checkUserCooldown(userId: string): Promise<boolean> {
    const key = cooldownKey(userId);
    const exists = await redis.getRaw(key);
    if (exists) return false;
    await redis.setRaw(key, '1', OTP_COOLDOWN_SEC);
    return true;
  }

  private isRedisAvailable(): boolean {
    const status = redis.getStatus();
    return status.enabled && status.connected;
  }

  async requestOtp(args: {
    userId: string;
    method: 'sms' | 'email' | 'both';
    phone?: string;
    email?: string;
    firstName?: string;
    locale?: string;
    deviceId?: string;
    ip?: string;
    meta?: Record<string, any>;
  }): Promise<{ ok: boolean; sessionId?: string; ttlSec?: number; error?: string; sentVia?: string[] }> {
    const { userId, method, locale: rawLocale, deviceId, ip, meta } = args;
    const locale: 'he' | 'en' = isHebrewLocale(rawLocale) ? 'he' : 'en';

    if (!userId) return { ok: false, error: 'missing_userId' };
    if (!['sms', 'email', 'both'].includes(method)) return { ok: false, error: 'invalid_method' };

    if (!this.isRedisAvailable()) {
      logger.error('[2FA-Octopus] Redis unavailable - cannot process OTP request');
      return { ok: false, error: 'service_unavailable' };
    }

    if (ip) {
      const ipOk = await this.checkIpRateLimit(ip);
      if (!ipOk) return { ok: false, error: 'rate_limited_ip' };
    }

    const cooldownOk = await this.checkUserCooldown(userId);
    if (!cooldownOk) return { ok: false, error: 'cooldown_active' };

    const phone = args.phone ? normalizePhone(args.phone) : '';
    const email = args.email ? normalizeEmail(args.email) : '';
    const firstName = String(args.firstName || '').trim();

    if ((method === 'sms' || method === 'both') && !phone.startsWith('+')) {
      return { ok: false, error: 'invalid_phone' };
    }
    if ((method === 'email' || method === 'both') && !email.includes('@')) {
      return { ok: false, error: 'invalid_email' };
    }

    const sessionId = crypto.randomUUID();
    const code = generateOtp6();

    await redis.setRaw(otpKey(userId, sessionId), code, OTP_TTL_SEC);

    const sentVia: string[] = [];

    if (method === 'sms' || method === 'both') {
      try {
        const { twilioSMSService } = await import('./TwilioSMSService');
        const smsBody = locale === 'he'
          ? `קוד האימות שלך ל-⁦Pet Wash™⁩ הוא: ${code}`
          : `Your ⁦Pet Wash™⁩ verification code is: ${code}`;
        const result = await twilioSMSService.sendSMS(phone, smsBody);
        if (result.success) {
          sentVia.push('sms');
        } else {
          logger.warn('[2FA-Octopus] SMS send failed', { userId, error: result.error });
        }
      } catch (error) {
        logger.error('[2FA-Octopus] SMS send exception', error);
      }
    }

    if (method === 'email' || method === 'both') {
      try {
        const html = generate2FAEmailHtml(code, firstName, locale);
        const subject = locale === 'he' ? `קוד אימות דו-שלבי — ⁦Pet Wash™⁩` : `Two-Factor Verification Code — ⁦Pet Wash™⁩`;
        const sent = await sendLuxuryEmail({ to: email, subject, html });
        if (sent) {
          sentVia.push('email');
        } else {
          logger.warn('[2FA-Octopus] Email send failed', { userId });
        }
      } catch (error) {
        logger.error('[2FA-Octopus] Email send exception', error);
      }
    }

    if (sentVia.length === 0) {
      await redis.del(otpKey(userId, sessionId));
      return { ok: false, error: 'delivery_failed' };
    }

    await stampSessionToFirestore({
      sessionId,
      userId,
      method,
      locale,
      createdAt: new Date().toISOString(),
      verified2fa: false,
      ip: ip || undefined,
      deviceId: deviceId || undefined,
      deviceTrusted: false,
      meta: {
        firstName: firstName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        sentVia,
        platform: meta?.platform || undefined,
      },
    });

    logger.info('[2FA-Octopus] OTP requested', {
      userId,
      sessionId,
      method,
      sentVia,
      ttl: OTP_TTL_SEC,
    });

    return { ok: true, sessionId, ttlSec: OTP_TTL_SEC, sentVia };
  }

  async verifyOtp(args: {
    userId: string;
    sessionId: string;
    code: string;
    trustThisDevice?: boolean;
    deviceId?: string;
  }): Promise<{ ok: boolean; error?: string; fullyVerified?: boolean }> {
    const { userId, sessionId, code, trustThisDevice, deviceId } = args;

    if (!userId || !sessionId || !code) {
      return { ok: false, error: 'missing_fields' };
    }

    if (!this.isRedisAvailable()) {
      logger.error('[2FA-Octopus] Redis unavailable - cannot verify OTP');
      return { ok: false, error: 'service_unavailable' };
    }

    const attKey = attemptKey(userId, sessionId);
    const attempts = await redis.incr(attKey);
    if (attempts === 1) {
      await redis.expire(attKey, OTP_TTL_SEC);
    }
    if (attempts > OTP_MAX_ATTEMPTS) {
      return { ok: false, error: 'too_many_attempts' };
    }

    const stored = await redis.getRaw(otpKey(userId, sessionId));
    if (!stored) {
      return { ok: false, error: 'expired_or_missing' };
    }

    const valid = constantTimeEq(stored, String(code).trim());
    if (!valid) {
      const remaining = OTP_MAX_ATTEMPTS - attempts;
      return { ok: false, error: `invalid_code`, fullyVerified: false };
    }

    await redis.del(otpKey(userId, sessionId));
    await redis.del(attKey);

    await markSessionVerifiedInFirestore(userId, sessionId);

    if (trustThisDevice && deviceId) {
      await setTrustedDeviceInFirestore(userId, deviceId);
    }

    logger.info('[2FA-Octopus] OTP verified successfully', { userId, sessionId });

    return { ok: true, fullyVerified: true };
  }

  async getSessionStatus(userId: string, sessionId?: string): Promise<{
    active: boolean;
    method?: string;
    verified?: boolean;
  }> {
    if (!sessionId) return { active: false };

    const otpPending = await redis.getRaw(otpKey(userId, sessionId));
    if (otpPending) {
      return { active: true, verified: false };
    }

    try {
      const { db } = await import('../lib/firebase-admin');
      const sessionDoc = await db.collection('sessions').doc(sessionId).get();
      if (sessionDoc.exists) {
        const data = sessionDoc.data();
        if (data?.userId === userId) {
          return {
            active: false,
            method: data.method,
            verified: data.verified2fa === true,
          };
        }
      }
    } catch (error) {
      logger.error('[2FA-Octopus] Firestore status check failed', error);
    }

    return { active: false, verified: false };
  }

  async sendCode(
    userId: string,
    method: 'sms' | 'email' | 'both',
    contact: { phone?: string; email?: string; firstName?: string },
    language: string = 'he'
  ): Promise<{ success: boolean; message: string; sentVia: string[]; sessionId?: string }> {
    const result = await this.requestOtp({
      userId,
      method,
      phone: contact.phone,
      email: contact.email,
      firstName: contact.firstName,
      locale: language,
    });

    if (!result.ok) {
      const errorMessages: Record<string, Record<string, string>> = {
        cooldown_active: { he: 'אנא המתינו לפני שליחת קוד נוסף', en: 'Please wait before requesting another code' },
        rate_limited_ip: { he: 'יותר מדי בקשות. נסו שוב מאוחר יותר', en: 'Too many requests. Try again later' },
        delivery_failed: { he: 'שליחת קוד האימות נכשלה', en: 'Failed to send verification code' },
        invalid_phone: { he: 'מספר טלפון לא תקין', en: 'Invalid phone number' },
        invalid_email: { he: 'כתובת אימייל לא תקינה', en: 'Invalid email address' },
        service_unavailable: { he: 'שירות האימות לא זמין כרגע', en: 'Verification service temporarily unavailable' },
      };
      const locale = isHebrewLocale(language) ? 'he' : 'en';
      const msg = errorMessages[result.error || '']?.[locale] || (locale === 'he' ? 'שגיאה בשליחת קוד' : 'Error sending code');
      return { success: false, message: msg, sentVia: [] };
    }

    const locale = isHebrewLocale(language) ? 'he' : 'en';
    return {
      success: true,
      message: locale === 'he' ? 'קוד אימות נשלח בהצלחה' : 'Verification code sent successfully',
      sentVia: result.sentVia || [],
      sessionId: result.sessionId,
    };
  }

  async verifySmsCode(
    userId: string,
    sessionId: string,
    code: string,
    language: string = 'he'
  ): Promise<{ success: boolean; message: string; fullyVerified?: boolean }> {
    return this.verifyChannel(userId, sessionId, code, language);
  }

  async verifyEmailCode(
    userId: string,
    sessionId: string,
    code: string,
    language: string = 'he'
  ): Promise<{ success: boolean; message: string; fullyVerified?: boolean }> {
    return this.verifyChannel(userId, sessionId, code, language);
  }

  private async verifyChannel(
    userId: string,
    sessionId: string,
    code: string,
    language: string
  ): Promise<{ success: boolean; message: string; fullyVerified?: boolean }> {
    const locale = isHebrewLocale(language) ? 'he' : 'en';

    if (!sessionId) {
      return {
        success: false,
        message: locale === 'he' ? 'אין אימות פעיל' : 'No active verification session',
      };
    }

    const result = await this.verifyOtp({ userId, sessionId, code });

    if (!result.ok) {
      const errorMessages: Record<string, Record<string, string>> = {
        too_many_attempts: { he: 'חרגתם ממספר הניסיונות המותר', en: 'Too many attempts' },
        expired_or_missing: { he: 'הקוד פג תוקף או לא נמצא', en: 'Code expired or not found' },
        invalid_code: { he: 'קוד שגוי', en: 'Invalid code' },
        missing_fields: { he: 'חסרים שדות נדרשים', en: 'Missing required fields' },
        service_unavailable: { he: 'שירות האימות לא זמין כרגע', en: 'Verification service temporarily unavailable' },
      };
      const msg = errorMessages[result.error || '']?.[locale] || (locale === 'he' ? 'אימות נכשל' : 'Verification failed');
      return { success: false, message: msg, fullyVerified: false };
    }

    return {
      success: true,
      message: locale === 'he' ? 'אימות דו-שלבי הושלם בהצלחה!' : 'Two-factor verification complete!',
      fullyVerified: true,
    };
  }

  hasPendingVerification(userId: string): boolean {
    return false;
  }
}

export const twoFactorAuth = new OctopusTwoFactorService();
