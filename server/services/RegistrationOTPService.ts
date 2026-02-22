import crypto from 'crypto';
import { db } from '../db';
import { otpEvents, smsEvidence } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { redis } from './redis';
import { twilioSMSService } from './TwilioSMSService';

const OTP_TTL_SEC = 300;
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SEC = 60;
const OTP_PHONE_MAX_PER_HOUR = 5;
const OTP_IP_MAX_PER_10MIN = 10;

const memoryStore = new Map<string, { value: string; expiresAt: number }>();
const memoryCounters = new Map<string, { count: number; expiresAt: number }>();

function memGet(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memoryStore.delete(key); return null; }
  return entry.value;
}
function memSet(key: string, value: string, ttlSec: number) {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}
function memDel(key: string) { memoryStore.delete(key); }
function memTtl(key: string): number {
  const entry = memoryStore.get(key);
  if (!entry) return -1;
  const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : -1;
}
function memIncr(key: string, ttlSec: number): number {
  const entry = memoryCounters.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    memoryCounters.set(key, { count: 1, expiresAt: Date.now() + ttlSec * 1000 });
    return 1;
  }
  entry.count++;
  return entry.count;
}

function isRedisEnabled(): boolean {
  return redis.getStatus().enabled;
}
async function cacheGet(key: string): Promise<string | null> {
  if (isRedisEnabled()) return redis.getRaw(key);
  return memGet(key);
}
async function cacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  if (isRedisEnabled()) { await redis.setRaw(key, value, ttlSec); return; }
  memSet(key, value, ttlSec);
}
async function cacheDel(key: string): Promise<void> {
  if (isRedisEnabled()) { await redis.del(key); return; }
  memDel(key);
}
async function cacheTtl(key: string): Promise<number> {
  return memTtl(key);
}
async function cacheIncr(key: string, ttlSec: number): Promise<number> {
  if (isRedisEnabled()) {
    const val = await redis.incr(key);
    if (val === 1) await redis.expire(key, ttlSec);
    return val;
  }
  return memIncr(key, ttlSec);
}

export type UserTypeIntent = 'PUBLIC' | 'PROVIDER' | 'STAFF_REQUEST';
export type OTPChannel = 'sms' | 'whatsapp';

interface SendOTPResult {
  success: boolean;
  otpId: string;
  expiresIn: number;
  channel?: OTPChannel;
  error?: string;
  cooldownRemaining?: number;
}

interface VerifyOTPResult {
  success: boolean;
  otpId: string;
  error?: string;
  remainingAttempts?: number;
  metadata?: { phoneE164: string; userTypeIntent: UserTypeIntent; userId?: string };
}

function generateSecureOTP(): string {
  return String(Math.floor(100000 + crypto.randomInt(900000)));
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizePhone(phone: string): string {
  const trimmed = String(phone || '').trim();
  if (trimmed.startsWith('+')) return trimmed;
  return '+' + trimmed.replace(/[^\d]/g, '');
}

function otpRedisKey(otpId: string): string {
  return `reg_otp:${otpId}`;
}

function cooldownKey(phone: string): string {
  return `reg_otp:cooldown:${phone}`;
}

function phoneRateKey(phone: string): string {
  return `reg_otp:phone_rate:${phone}`;
}

function ipRateKey(ip: string): string {
  return `reg_otp:ip_rate:${ip}`;
}

function extractCountryCode(phoneE164: string): string {
  if (phoneE164.startsWith('+972')) return 'IL';
  if (phoneE164.startsWith('+61')) return 'AU';
  if (phoneE164.startsWith('+1')) return 'US';
  if (phoneE164.startsWith('+44')) return 'GB';
  if (phoneE164.startsWith('+33')) return 'FR';
  if (phoneE164.startsWith('+49')) return 'DE';
  if (phoneE164.startsWith('+34')) return 'ES';
  if (phoneE164.startsWith('+39')) return 'IT';
  if (phoneE164.startsWith('+31')) return 'NL';
  if (phoneE164.startsWith('+32')) return 'BE';
  if (phoneE164.startsWith('+41')) return 'CH';
  if (phoneE164.startsWith('+43')) return 'AT';
  if (phoneE164.startsWith('+46')) return 'SE';
  if (phoneE164.startsWith('+47')) return 'NO';
  if (phoneE164.startsWith('+45')) return 'DK';
  if (phoneE164.startsWith('+353')) return 'IE';
  if (phoneE164.startsWith('+351')) return 'PT';
  if (phoneE164.startsWith('+30')) return 'GR';
  if (phoneE164.startsWith('+48')) return 'PL';
  if (phoneE164.startsWith('+420')) return 'CZ';
  if (phoneE164.startsWith('+36')) return 'HU';
  if (phoneE164.startsWith('+40')) return 'RO';
  if (phoneE164.startsWith('+359')) return 'BG';
  if (phoneE164.startsWith('+358')) return 'FI';
  return 'XX';
}

export class RegistrationOTPService {

  async sendOTP(
    phone: string,
    userTypeIntent: UserTypeIntent,
    opts: { userId?: string; ip?: string; userAgent?: string; deviceId?: string; traceId?: string; language?: 'he' | 'en'; channel?: OTPChannel }
  ): Promise<SendOTPResult> {
    const phoneE164 = normalizePhone(phone);
    const otpId = crypto.randomUUID();
    const traceId = opts.traceId || crypto.randomUUID().slice(0, 8);

    try {
      const cooldown = await cacheTtl(cooldownKey(phoneE164));
      if (cooldown > 0) {
        logger.warn('[RegistrationOTP] Cooldown active', { phoneE164: phoneE164.slice(0, 6) + '****', cooldown, traceId });
        return { success: false, otpId, expiresIn: 0, error: 'COOLDOWN_ACTIVE', cooldownRemaining: cooldown };
      }

      const phoneCount = await cacheIncr(phoneRateKey(phoneE164), 3600);
      if (phoneCount > OTP_PHONE_MAX_PER_HOUR) {
        logger.warn('[RegistrationOTP] Phone rate limit exceeded', { phoneE164: phoneE164.slice(0, 6) + '****', traceId });
        return { success: false, otpId, expiresIn: 0, error: 'PHONE_RATE_LIMIT' };
      }

      if (opts.ip) {
        const ipCount = await cacheIncr(ipRateKey(opts.ip), 600);
        if (ipCount > OTP_IP_MAX_PER_10MIN) {
          logger.warn('[RegistrationOTP] IP rate limit exceeded', { ip: opts.ip, traceId });
          return { success: false, otpId, expiresIn: 0, error: 'IP_RATE_LIMIT' };
        }
      }

      const code = generateSecureOTP();
      const codeHash = sha256(code);
      const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000);
      const countryCode = extractCountryCode(phoneE164);

      await cacheSet(otpRedisKey(otpId), JSON.stringify({
        codeHash,
        phoneE164,
        userTypeIntent,
        userId: opts.userId,
        attempts: 0,
        expiresAt: expiresAt.toISOString(),
      }), OTP_TTL_SEC);
      await cacheSet(cooldownKey(phoneE164), '1', OTP_COOLDOWN_SEC);

      const isHebrew = opts.language === 'he' || countryCode === 'IL';
      const smsBody = isHebrew
        ? `🐾 Pet Wash™\n\nקוד האימות שלך:\n${code}\n\nתקף ל-5 דקות.\nלעולם אל תשתפו קוד זה.\n\npetwash.co.il`
        : `🐾 Pet Wash™\n\nYour verification code is:\n${code}\n\nValid for 5 minutes.\nNever share this code with anyone.\n\npetwash.co.il`;

      const channel: OTPChannel = opts.channel || 'sms';
      let providerMessageId: string | undefined;
      let sendResult: { success: boolean; messageId?: string; error?: string };

      if (channel === 'whatsapp') {
        sendResult = await twilioSMSService.sendWhatsApp(phoneE164, smsBody);
      } else {
        sendResult = await twilioSMSService.sendSMS(phoneE164, smsBody);
      }
      if (sendResult.success && sendResult.messageId) {
        providerMessageId = sendResult.messageId;
      }

      const providerLabel = channel === 'whatsapp' ? 'twilio_whatsapp' : 'twilio';

      await db.insert(otpEvents).values({
        otpId,
        eventType: 'OTP_SENT',
        phoneE164,
        userId: opts.userId || null,
        userTypeIntent,
        otpHash: codeHash,
        expiresAt,
        attemptsCount: 0,
        provider: providerLabel,
        providerMessageId: providerMessageId || null,
        ip: opts.ip || null,
        userAgent: opts.userAgent || null,
        deviceId: opts.deviceId || null,
        countryCode,
        traceId,
      });

      await db.insert(smsEvidence).values({
        userId: opts.userId || null,
        messageType: 'OTP',
        templateId: channel === 'whatsapp' ? 'registration_otp_whatsapp_v1' : 'registration_otp_v1',
        templateVersion: '1.0',
        toPhone: phoneE164,
        renderedText: smsBody,
        contentHash: sha256(smsBody),
        provider: providerLabel,
        providerMessageId: providerMessageId || null,
        status: sendResult.success ? 'sent' : 'failed',
        failureReason: sendResult.success ? null : (sendResult.error || 'Unknown'),
        ip: opts.ip || null,
        userAgent: opts.userAgent || null,
        traceId,
      });

      logger.info('[RegistrationOTP] OTP sent', {
        otpId,
        phoneE164: phoneE164.slice(0, 6) + '****',
        userTypeIntent,
        channel,
        countryCode,
        traceId,
        deliverySuccess: sendResult.success,
      });

      return { success: true, otpId, expiresIn: OTP_TTL_SEC, channel };

    } catch (error: any) {
      const errDetail = error instanceof Error
        ? { message: error.message, stack: error.stack?.split('\n').slice(0, 3) }
        : { raw: String(error) };
      logger.error('[RegistrationOTP] Failed to send OTP', { ...errDetail, otpId, traceId });
      return { success: false, otpId, expiresIn: 0, error: 'INTERNAL_ERROR' };
    }
  }

  async verifyOTP(
    otpId: string,
    code: string,
    opts: { ip?: string; userAgent?: string; traceId?: string }
  ): Promise<VerifyOTPResult> {
    const traceId = opts.traceId || crypto.randomUUID().slice(0, 8);

    try {
      const raw = await cacheGet(otpRedisKey(otpId));
      if (!raw) {
        await this.logVerificationEvent(otpId, 'OTP_EXPIRED', null, traceId, opts);
        return { success: false, otpId, error: 'OTP_EXPIRED' };
      }

      const record = JSON.parse(raw);
      record.attempts = (record.attempts || 0) + 1;

      if (record.attempts > OTP_MAX_ATTEMPTS) {
        await cacheDel(otpRedisKey(otpId));
        await this.logVerificationEvent(otpId, 'OTP_FAILED', 'max_attempts', traceId, opts);
        return { success: false, otpId, error: 'MAX_ATTEMPTS_EXCEEDED', remainingAttempts: 0 };
      }

      await cacheSet(otpRedisKey(otpId), JSON.stringify(record), OTP_TTL_SEC);

      const submittedHash = sha256(code);
      if (!constantTimeEqual(submittedHash, record.codeHash)) {
        const remaining = OTP_MAX_ATTEMPTS - record.attempts;
        await this.logVerificationEvent(otpId, 'OTP_FAILED', 'invalid_code', traceId, opts);
        logger.warn('[RegistrationOTP] Invalid code', {
          otpId,
          attempt: record.attempts,
          remaining,
          traceId,
        });
        return { success: false, otpId, error: 'INVALID_CODE', remainingAttempts: remaining };
      }

      const metadata = {
        phoneE164: record.phoneE164 as string,
        userTypeIntent: record.userTypeIntent as UserTypeIntent,
        userId: record.userId as string | undefined,
      };

      await cacheDel(otpRedisKey(otpId));

      await this.logVerificationEvent(otpId, 'OTP_VERIFIED', 'success', traceId, opts);

      logger.info('[RegistrationOTP] OTP verified successfully', {
        otpId,
        phoneE164: metadata.phoneE164.slice(0, 6) + '****',
        userTypeIntent: metadata.userTypeIntent,
        traceId,
      });

      return { success: true, otpId, metadata };

    } catch (error) {
      logger.error('[RegistrationOTP] Verification error', { error, otpId, traceId });
      return { success: false, otpId, error: 'INTERNAL_ERROR' };
    }
  }

  async resendOTP(
    otpId: string,
    channel: OTPChannel,
    opts: { ip?: string; userAgent?: string; traceId?: string; language?: 'he' | 'en' }
  ): Promise<SendOTPResult> {
    const traceId = opts.traceId || crypto.randomUUID().slice(0, 8);

    try {
      const raw = await cacheGet(otpRedisKey(otpId));
      if (!raw) {
        return { success: false, otpId, expiresIn: 0, error: 'OTP_EXPIRED' };
      }

      const record = JSON.parse(raw);
      const phoneE164 = record.phoneE164 as string;

      const cooldown = await cacheTtl(cooldownKey(phoneE164));
      if (cooldown > 0) {
        return { success: false, otpId, expiresIn: 0, error: 'COOLDOWN_ACTIVE', cooldownRemaining: cooldown };
      }

      const code = generateSecureOTP();
      const codeHash = sha256(code);
      const ttlRemaining = await cacheTtl(otpRedisKey(otpId));
      const newTtl = ttlRemaining > 0 ? ttlRemaining : OTP_TTL_SEC;

      record.codeHash = codeHash;
      record.attempts = 0;
      await cacheSet(otpRedisKey(otpId), JSON.stringify(record), newTtl);
      await cacheSet(cooldownKey(phoneE164), '1', OTP_COOLDOWN_SEC);

      const isHebrew = opts.language === 'he' || extractCountryCode(phoneE164) === 'IL';
      const smsBody = isHebrew
        ? `🐾 Pet Wash™\n\nקוד האימות שלך:\n${code}\n\nתקף ל-5 דקות.\nלעולם אל תשתפו קוד זה.\n\npetwash.co.il`
        : `🐾 Pet Wash™\n\nYour verification code is:\n${code}\n\nValid for 5 minutes.\nNever share this code with anyone.\n\npetwash.co.il`;

      let sendResult: { success: boolean; messageId?: string; error?: string };
      if (channel === 'whatsapp') {
        sendResult = await twilioSMSService.sendWhatsApp(phoneE164, smsBody);
      } else {
        sendResult = await twilioSMSService.sendSMS(phoneE164, smsBody);
      }

      const providerLabel = channel === 'whatsapp' ? 'twilio_whatsapp' : 'twilio';

      await db.insert(otpEvents).values({
        otpId: `${otpId}_resend_${Date.now()}`,
        eventType: 'OTP_RESENT',
        phoneE164,
        userId: record.userId || null,
        userTypeIntent: record.userTypeIntent,
        otpHash: codeHash,
        expiresAt: new Date(Date.now() + newTtl * 1000),
        attemptsCount: 0,
        provider: providerLabel,
        providerMessageId: sendResult.messageId || null,
        ip: opts.ip || null,
        userAgent: opts.userAgent || null,
        countryCode: extractCountryCode(phoneE164),
        traceId,
      });

      await db.insert(smsEvidence).values({
        userId: record.userId || null,
        messageType: 'OTP',
        templateId: channel === 'whatsapp' ? 'registration_otp_whatsapp_v1' : 'registration_otp_v1',
        templateVersion: '1.0',
        toPhone: phoneE164,
        renderedText: smsBody,
        contentHash: sha256(smsBody),
        provider: providerLabel,
        providerMessageId: sendResult.messageId || null,
        status: sendResult.success ? 'sent' : 'failed',
        failureReason: sendResult.success ? null : (sendResult.error || 'Unknown'),
        ip: opts.ip || null,
        userAgent: opts.userAgent || null,
        traceId,
      });

      logger.info('[RegistrationOTP] OTP resent', {
        otpId,
        channel,
        phoneE164: phoneE164.slice(0, 6) + '****',
        traceId,
        deliverySuccess: sendResult.success,
      });

      return { success: true, otpId, expiresIn: newTtl, channel };
    } catch (error: any) {
      const errDetail = error instanceof Error
        ? { message: error.message, stack: error.stack?.split('\n').slice(0, 3) }
        : { raw: String(error) };
      logger.error('[RegistrationOTP] Failed to resend OTP', { ...errDetail, otpId, traceId });
      return { success: false, otpId, expiresIn: 0, error: 'INTERNAL_ERROR' };
    }
  }

  async getOTPMetadata(otpId: string): Promise<{ phoneE164: string; userTypeIntent: UserTypeIntent; userId?: string } | null> {
    const raw = await cacheGet(otpRedisKey(otpId));
    if (!raw) {
      const [event] = await db
        .select({ phoneE164: otpEvents.phoneE164, userTypeIntent: otpEvents.userTypeIntent, userId: otpEvents.userId })
        .from(otpEvents)
        .where(eq(otpEvents.otpId, otpId))
        .limit(1);
      if (event) {
        return { phoneE164: event.phoneE164, userTypeIntent: event.userTypeIntent as UserTypeIntent, userId: event.userId || undefined };
      }
      return null;
    }
    const record = JSON.parse(raw);
    return { phoneE164: record.phoneE164, userTypeIntent: record.userTypeIntent, userId: record.userId };
  }

  private async logVerificationEvent(
    otpId: string,
    eventType: string,
    result: string | null,
    traceId: string,
    opts: { ip?: string; userAgent?: string }
  ) {
    try {
      await db.insert(otpEvents).values({
        otpId: `${otpId}_${eventType.toLowerCase()}_${Date.now()}`,
        eventType,
        phoneE164: 'N/A',
        userTypeIntent: 'PUBLIC',
        result,
        ip: opts.ip || null,
        userAgent: opts.userAgent || null,
        traceId,
        verifiedAt: eventType === 'OTP_VERIFIED' ? new Date() : null,
      });
    } catch (err) {
      logger.error('[RegistrationOTP] Failed to log verification event', { err, otpId, eventType });
    }
  }
}

export const registrationOTPService = new RegistrationOTPService();
