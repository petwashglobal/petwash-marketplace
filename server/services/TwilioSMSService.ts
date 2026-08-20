import twilio from 'twilio';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger';
import crypto from 'crypto';
import { smsAbuseDetector } from './SmsAbuseDetector';
import { redis } from './redis';

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

const VERIFICATION_CODE_EXPIRY_MINUTES = 5;
const MAX_VERIFICATION_ATTEMPTS = 5;
const VERIFICATION_TOKEN_EXPIRY_MINUTES = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const phoneLockouts = new Map<string, number>();
// Single-use guard for sms-verified proof tokens (nonce -> expiry epoch ms). See
// consumeVerificationNonce(). Pruned lazily; entries live at most the token TTL.
const consumedVerificationNonces = new Map<string, number>();

// LAUNCH-SAFETY 2026-06-18: was 5 — a user who mistypes their number or hits a
// carrier delay burns 5 sends and is locked out until midnight. Raised + env-tunable.
const MAX_SMS_PER_PHONE_PER_DAY = parseInt(process.env.SMS_PER_PHONE_DAILY_CAP || '10', 10);
const phoneDailySendCount = new Map<string, { count: number; resetAt: number }>();

const RESEND_COOLDOWN_SECONDS = 60;
const phoneLastSentAt = new Map<string, number>(); // phone → epoch ms of last send

/**
 * Resolve the HMAC secret used for OTP code storage.
 *
 * Fail-closed in production: if neither APP_SESSION_SECRET nor COOKIE_SECRET
 * is set, throw at first use — never allow the previous public literal
 * fallback ('petwash-otp-hmac') to run in production, because it is public
 * knowledge (this source file) and would let an attacker who reads leaked
 * Redis contents forge/verify OTP HMACs.
 */
function resolveOtpHmacSecret(): string {
  const secret = process.env.APP_SESSION_SECRET || process.env.COOKIE_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[TwilioSMSService] APP_SESSION_SECRET or COOKIE_SECRET must be set in production ' +
      '— OTP HMAC storage cannot fall back to a hardcoded literal.'
    );
  }
  // Dev-only fallback so local development without env vars keeps working.
  return 'petwash-otp-hmac-dev-only';
}

// LAUNCH-SAFETY 2026-06-18: was 150 and PER-INSTANCE in-memory — it reset on every
// deploy, behaved differently across Cloud Run instances ("SMS randomly stops"), and
// fired BELOW the real Redis-backed abuse detector (SmsAbuseDetector). Raised well
// above the abuse threshold so the Redis detector is the real global guard; this stays
// only as a per-instance backstop. env-tunable.
const MAX_GLOBAL_SMS_PER_DAY = parseInt(process.env.SMS_INSTANCE_DAILY_CAP || '8000', 10);
let globalDailySmsCount = 0;
let globalDailyResetAt = Date.now() + 24 * 60 * 60 * 1000;

const ALLOWED_COUNTRY_PREFIXES = [
  '972',  // Israel
  '61',   // Australia
  '1',    // US / Canada
  '44',   // UK
  '33',   // France
  '49',   // Germany
  '34',   // Spain
  '39',   // Italy
  '31',   // Netherlands
  '32',   // Belgium
  '41',   // Switzerland
  '43',   // Austria
  '46',   // Sweden
  '47',   // Norway
  '45',   // Denmark
  '353',  // Ireland
  '351',  // Portugal
  '30',   // Greece
  '48',   // Poland
  '420',  // Czech Republic
  '36',   // Hungary
  '40',   // Romania
  '359',  // Bulgaria
  '358',  // Finland
];

function isAllowedCountry(phone: string): boolean {
  const digits = phone.replace(/[^0-9]/g, '');
  for (const prefix of ALLOWED_COUNTRY_PREFIXES) {
    if (digits.startsWith(prefix)) return true;
  }
  return false;
}

function checkGlobalDailyCap(): boolean {
  const now = Date.now();
  if (now > globalDailyResetAt) {
    globalDailySmsCount = 0;
    globalDailyResetAt = now + 24 * 60 * 60 * 1000;
  }
  if (globalDailySmsCount >= MAX_GLOBAL_SMS_PER_DAY) {
    logger.error(`[TwilioSMS] 🚨 GLOBAL DAILY CAP REACHED (${MAX_GLOBAL_SMS_PER_DAY}/day) - blocking SMS to prevent fraud`);
    return false;
  }
  globalDailySmsCount++;
  return true;
}

const ALPHA_SENDER_ID = 'PetWash';

// A usable Twilio sender number must be real E.164: a leading '+', a non-zero country
// code, then 6–14 more digits. This rejects unset values AND placeholder junk like
// '+972XXXXXXXXX' / '+1XXXXXXXXXX' — a real 2026-07-31 incident where the region-number
// secrets were created with the literal X placeholders. Returning null on a bad value
// makes the sender FALL BACK to the safe number instead of failing every SMS with an
// "invalid From" (Twilio 21212).
function validSenderNumber(n: string | undefined | null): string | null {
  const v = (n || '').trim();
  return /^\+[1-9]\d{6,14}$/.test(v) ? v : null;
}

const ALPHA_SENDER_BLOCKED_COUNTRIES = new Set([
  '1',   // US/Canada — alpha sender not supported
  '61',  // Australia — alpha sender not enabled on this account; attempting it causes a duplicate
         // deliver (carrier accepts before Twilio returns 21612) then fallback also sends.
         // Re-enable '61' only after Twilio alphanumeric sender for AU is registered.
  '972', // ISRAEL — 2026-07-31 incident: the 'PetWash' alphanumeric sender is NOT registered
         // for Israel, so Twilio routed the OTP through a random FOREIGN long-code (a +855
         // Cambodia number reached the CEO) AND the fallback delivered a SECOND SMS ("SMS keeps
         // coming"). Skipping the alpha attempt makes Israeli OTPs send deterministically from
         // the Messaging Service / Israeli fromPhone — one message, no foreign number.
         // Re-enable '972' ONLY after the 'PetWash' alpha sender ID is registered for Israel in
         // the Twilio console (and the sender must be an Israeli number — see ops note).
]);

export type SmsSendFailureCode =
  | 'SMS_PROVIDER_CONFIG_ERROR'
  | 'SMS_PROVIDER_GEO_BLOCKED'
  | 'SMS_PROVIDER_SENDER_ERROR'
  | 'SMS_PROVIDER_RATE_LIMITED'
  | 'SMS_PROVIDER_ERROR'
  | 'SMS_PROVIDER_DISABLED'
  | 'SMS_RATE_LIMITED'
  | 'SMS_OTP_STORE_ERROR';

export interface SmsSendFailureMeta {
  code: SmsSendFailureCode;
  providerCode?: string;
  retryable: boolean;
  status: number;
}

export interface SmsVerificationSendResult extends Partial<SmsSendFailureMeta> {
  success: boolean;
  message: string;
  expiresIn?: number;
  messageId?: string;
}

function providerCode(error: any): string | undefined {
  return error?.code === undefined || error?.code === null ? undefined : String(error.code);
}

export function classifyTwilioSmsError(error: any): SmsSendFailureMeta {
  const code = providerCode(error);
  const numericCode = Number(code);
  const httpStatus = Number(error?.status);

  if (numericCode === 20003 || numericCode === 20404) {
    return { code: 'SMS_PROVIDER_CONFIG_ERROR', providerCode: code, retryable: false, status: 503 };
  }
  if (numericCode === 60605 || numericCode === 21408) {
    return { code: 'SMS_PROVIDER_GEO_BLOCKED', providerCode: code, retryable: false, status: 422 };
  }
  if (numericCode >= 63000 && numericCode < 64000) {
    return { code: 'SMS_PROVIDER_SENDER_ERROR', providerCode: code, retryable: false, status: 503 };
  }
  if (numericCode === 60202 || httpStatus === 429) {
    return { code: 'SMS_PROVIDER_RATE_LIMITED', providerCode: code, retryable: true, status: 429 };
  }
  if (numericCode === 60200) {
    return { code: 'SMS_PROVIDER_ERROR', providerCode: code, retryable: false, status: 422 };
  }

  return {
    code: 'SMS_PROVIDER_ERROR',
    providerCode: code,
    retryable: !httpStatus || httpStatus >= 500,
    status: httpStatus >= 400 && httpStatus < 600 ? httpStatus : 503,
  };
}

class TwilioSMSService {
  private client: twilio.Twilio | null = null;
  private fromPhone: string | null = null;
  private messagingServiceSid: string | null = null;
  // Per-region sender numbers (CEO 2026-07-31): Israel → the Israeli number bought from
  // Twilio; everyone outside Israel → the US number. Guarantees an Israeli user never
  // sees a foreign sender, and keeps the two markets on their own numbers.
  private ilPhone: string | null = null;
  private usPhone: string | null = null;
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    // Per-region sender numbers: IL for +972 recipients, US for everyone else. Optional —
    // when unset the code falls back to the Messaging Service / fromPhone below.
    const ilPhone = process.env.TWILIO_PHONE_NUMBER_IL;
    const usPhone = process.env.TWILIO_PHONE_NUMBER_US;

    // GUARD: a real Twilio Account SID always starts with "AC". A malformed SID
    // (paste error / wrong secret) once 503'd ALL SMS silently. Catch it here and
    // log a CLEAR cause instead of a generic init failure. No value is logged —
    // only the boolean fact that the prefix is wrong.
    if (accountSid && !accountSid.startsWith('AC')) {
      logger.error('[TwilioSMS] ❌ TWILIO_ACCOUNT_SID is malformed — it must start with "AC". SMS/OTP is DISABLED until the secret is fixed.');
      this.isConfigured = false;
      return;
    }

    if (accountSid && authToken && (fromPhone || messagingServiceSid || validSenderNumber(ilPhone) || validSenderNumber(usPhone))) {
      try {
        this.client = twilio(accountSid, authToken);
        this.fromPhone = fromPhone || null;
        this.messagingServiceSid = messagingServiceSid || null;
        this.ilPhone = validSenderNumber(ilPhone);
        this.usPhone = validSenderNumber(usPhone);
        if (ilPhone && !this.ilPhone) logger.warn('[TwilioSMS] TWILIO_PHONE_NUMBER_IL is set but is NOT a valid E.164 number (e.g. a "+972XXXXXXXXX" placeholder) — ignoring it and falling back to the safe sender.');
        if (usPhone && !this.usPhone) logger.warn('[TwilioSMS] TWILIO_PHONE_NUMBER_US is set but is NOT a valid E.164 number — ignoring it and falling back to the safe sender.');
        this.isConfigured = true;
        if (this.ilPhone || this.usPhone) {
          logger.info('[TwilioSMS] ✅ Initialized with per-region sender numbers', {
            hasIsraelNumber: !!this.ilPhone, hasUsNumber: !!this.usPhone,
          });
        } else if (this.messagingServiceSid) {
          logger.info('[TwilioSMS] ✅ Initialized with Messaging Service (branded sender)');
        } else {
          logger.info('[TwilioSMS] ✅ Initialized with phone number');
        }
      } catch (error) {
        logger.error('[TwilioSMS] Failed to initialize', error);
        this.isConfigured = false;
      }
    } else {
      logger.warn('[TwilioSMS] ⚠️ Not configured - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER/TWILIO_MESSAGING_SERVICE_SID missing');
      this.isConfigured = false;
    }
  }

  private getSendParams(toPhone: string, body: string): { body: string; to: string; from?: string; messagingServiceSid?: string } {
    const cleaned = toPhone.replace(/[^0-9]/g, '');

    // EXPLICIT per-region sender (CEO 2026-07-31): Israeli recipients get the Israeli
    // number we bought from Twilio; everyone OUTSIDE Israel gets the US number. This is
    // the deterministic rule that guarantees an Israeli user never sees a foreign (+855)
    // sender. If a region's number isn't configured yet, we fall through to the
    // alpha/Messaging-Service logic below (for Israel that path is alpha-blocked → the
    // Messaging Service / fromPhone), so this is safe to ship before both numbers exist.
    const isIsrael = cleaned.startsWith('972');
    if (isIsrael && this.ilPhone) {
      return { body, to: toPhone, from: this.ilPhone };
    }
    if (!isIsrael && this.usPhone) {
      return { body, to: toPhone, from: this.usPhone };
    }

    // Check if this country prefix is blocked from using alphanumeric sender.
    // Blocked = either carrier doesn't support it, or the Twilio account hasn't registered
    // alphanumeric sender for that country.  Attempting alpha sender in a blocked country
    // can result in TWO delivered messages (carrier accepts before Twilio returns 21612,
    // then the catch-block fallback also delivers) — so we skip it entirely.
    const isAlphaBlocked = Array.from(ALPHA_SENDER_BLOCKED_COUNTRIES)
      .some(prefix => cleaned.startsWith(prefix));

    if (isAlphaBlocked) {
      if (this.messagingServiceSid) {
        return { body, to: toPhone, messagingServiceSid: this.messagingServiceSid };
      }
      if (this.fromPhone) {
        return { body, to: toPhone, from: this.fromPhone };
      }
      throw new Error(`No Messaging Service or fromPhone configured for alpha-blocked country (${toPhone})`);
    }

    // All other international numbers (IL, UK, EU, etc.): use alphanumeric sender 'PetWash'.
    // This delivers as "PetWash" in the recipient's SMS app (no phone number shown).
    // Fallback to Messaging Service is handled in the catch block for unexpected 21612/21659.
    return { body, to: toPhone, from: ALPHA_SENDER_ID };
  }

  isReady(): boolean {
    return this.isConfigured && this.client !== null;
  }

  isEmergencyDisabled(): boolean {
    const flag = (process.env.SMS_EMERGENCY_DISABLED || '').toLowerCase();
    return flag === 'true' || flag === '1';
  }

  private generateCode(): string {
    return String(Math.floor(100000 + crypto.randomInt(900000)));
  }

  private formatPhoneNumber(phone: string): string {
    const trimmed = (phone || '').trim();
    if (trimmed.startsWith('+')) return trimmed;
    return '+' + trimmed.replace(/[^\d]/g, '');
  }

  private t(key: string, language: string): string {
    const translations: Record<string, Record<string, string>> = {
      smsUnavailable: {
        en: 'SMS service is not available at the moment',
        he: 'שירות ה-SMS לא זמין כרגע',
        ar: 'خدمة الرسائل القصيرة غير متوفرة حاليًا',
        es: 'El servicio de SMS no está disponible en este momento',
        fr: 'Le service SMS n\'est pas disponible pour le moment',
        ru: 'Служба SMS в настоящее время недоступна',
      },
      codeSent: {
        en: 'Verification code sent successfully',
        he: 'קוד אימות נשלח בהצלחה',
        ar: 'تم إرسال رمز التحقق بنجاح',
        es: 'Código de verificación enviado con éxito',
        fr: 'Code de vérification envoyé avec succès',
        ru: 'Код подтверждения успешно отправлен',
      },
      sendFailed: {
        en: 'Failed to send verification code. Please try again.',
        he: 'שגיאה בשליחת קוד האימות. נסו שוב.',
        ar: 'فشل في إرسال رمز التحقق. يرجى المحاولة مرة أخرى.',
        es: 'Error al enviar el código de verificación. Inténtelo de nuevo.',
        fr: 'Échec de l\'envoi du code. Veuillez réessayer.',
        ru: 'Не удалось отправить код. Попробуйте снова.',
      },
      noCode: {
        en: 'No verification code found. Request a new code.',
        he: 'לא נמצא קוד אימות. בקשו קוד חדש.',
        ar: 'لم يتم العثور على رمز التحقق. اطلب رمزًا جديدًا.',
        es: 'No se encontró código de verificación. Solicite uno nuevo.',
        fr: 'Code de vérification introuvable. Demandez un nouveau code.',
        ru: 'Код подтверждения не найден. Запросите новый код.',
      },
      codeExpired: {
        en: 'Verification code expired. Request a new code.',
        he: 'קוד האימות פג תוקף. בקשו קוד חדש.',
        ar: 'انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا.',
        es: 'El código de verificación expiró. Solicite uno nuevo.',
        fr: 'Le code de vérification a expiré. Demandez un nouveau code.',
        ru: 'Срок действия кода истёк. Запросите новый код.',
      },
      tooMany: {
        en: 'Too many attempts. Request a new code.',
        he: 'חרגתם ממספר הניסיונות המותר. בקשו קוד חדש.',
        ar: 'محاولات كثيرة جدًا. اطلب رمزًا جديدًا.',
        es: 'Demasiados intentos. Solicite un nuevo código.',
        fr: 'Trop de tentatives. Demandez un nouveau code.',
        ru: 'Слишком много попыток. Запросите новый код.',
      },
      verified: {
        en: 'Phone verified successfully!',
        he: 'הטלפון אומת בהצלחה!',
        ar: 'تم التحقق من الهاتف بنجاح!',
        es: 'Teléfono verificado con éxito.',
        fr: 'Téléphone vérifié avec succès !',
        ru: 'Телефон успешно подтверждён!',
      },
    };
    return translations[key]?.[language] || translations[key]?.en || key;
  }

  private smsBody(code: string, language: string): string {
    const mins = VERIFICATION_CODE_EXPIRY_MINUTES;
    // The last line (@petwash.co.il #CODE) is the WebOTP / WHATWG SMS OTP format.
    // iOS Safari reads it and shows the code above the keyboard as a one-tap suggestion.
    // Chrome on Android uses navigator.credentials.get({ otp }) to intercept it automatically.
    const hint = `\n@petwash.co.il #${code}`;
    const bodies: Record<string, string> = {
      en: `PetWash verification code:\n\n${code}\n\nExpires in ${mins} minutes.\nDo not share this code.${hint}`,
      he: `PetWash קוד אימות:\n\n${code}\n\nתקף ל-${mins} דקות.\nאל תשתפו קוד זה.${hint}`,
      ar: `PetWash رمز التحقق:\n\n${code}\n\nصالح لمدة ${mins} دقائق.\nلا تشارك هذا الرمز.${hint}`,
      es: `PetWash codigo de verificacion:\n\n${code}\n\nExpira en ${mins} minutos.\nNo compartas este codigo.${hint}`,
      fr: `PetWash code de verification:\n\n${code}\n\nExpire dans ${mins} minutes.\nNe partagez pas ce code.${hint}`,
      ru: `PetWash код подтверждения:\n\n${code}\n\nДействителен ${mins} минут.\nНе сообщайте этот код.${hint}`,
    };
    return bodies[language] || bodies.en;
  }

  private invalidCodeMsg(remaining: number, language: string): string {
    const msgs: Record<string, string> = {
      en: `Invalid code. ${remaining} attempts remaining.`,
      he: `קוד שגוי. נותרו ${remaining} ניסיונות.`,
      ar: `رمز غير صالح. ${remaining} محاولات متبقية.`,
      es: `Código inválido. ${remaining} intentos restantes.`,
      fr: `Code invalide. ${remaining} tentatives restantes.`,
      ru: `Неверный код. Осталось попыток: ${remaining}.`,
    };
    return msgs[language] || msgs.en;
  }

  async sendVerificationCode(phone: string, language: string = 'he', callerIp?: string): Promise<SmsVerificationSendResult> {
    if (await smsAbuseDetector.isKillSwitchActive()) {
      logger.warn('[TwilioSMS] 🚨 Kill switch active — all SMS blocked', { phone: phone.slice(-4) });
      return { success: false, message: this.t('smsUnavailable', language), code: 'SMS_PROVIDER_DISABLED', retryable: false, status: 503 };
    }
    if (!checkGlobalDailyCap()) {
      logger.error('[TwilioSMS] 🚨 Global daily cap reached — blocking verification SMS');
      return { success: false, message: this.t('smsUnavailable', language), code: 'SMS_PROVIDER_DISABLED', retryable: true, status: 503 };
    }
    if (!this.isReady()) {
      return {
        success: false,
        message: this.t('smsUnavailable', language),
        code: 'SMS_PROVIDER_CONFIG_ERROR',
        retryable: false,
        status: 503,
      };
    }

    const formattedPhone = this.formatPhoneNumber(phone);

    // ── Per-phone resend cooldown ─────────────────────────────────────────────
    // Block sending a second code to the same number within RESEND_COOLDOWN_SECONDS.
    // This ensures users receive exactly one SMS per explicit request and prevents
    // accidental or automated rapid-fire sends from any IP.
    const lastSent = phoneLastSentAt.get(formattedPhone);
    if (lastSent) {
      const elapsedSec = Math.floor((Date.now() - lastSent) / 1000);
      if (elapsedSec < RESEND_COOLDOWN_SECONDS) {
        const waitSec = RESEND_COOLDOWN_SECONDS - elapsedSec;
        const cooldownMsgs: Record<string, string> = {
          en: `Please wait ${waitSec} seconds before requesting a new code.`,
          he: `יש להמתין ${waitSec} שניות לפני בקשת קוד חדש.`,
          ar: `يرجى الانتظار ${waitSec} ثانية قبل طلب رمز جديد.`,
          es: `Espere ${waitSec} segundos antes de solicitar un nuevo código.`,
          fr: `Veuillez attendre ${waitSec} secondes avant de demander un nouveau code.`,
          ru: `Подождите ${waitSec} секунд перед повторным запросом кода.`,
        };
        logger.warn('[TwilioSMS] Resend cooldown active', {
          phone: formattedPhone.slice(0, 6) + '****',
          waitSec,
        });
        return { success: false, message: cooldownMsgs[language] || cooldownMsgs.en, code: 'SMS_RATE_LIMITED', retryable: true, status: 429 };
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Track IP→phone mapping for enumeration attack detection
    if (callerIp) {
      smsAbuseDetector.trackIpPhoneCombo(callerIp, formattedPhone).catch(err =>
        logger.error('[TwilioSMS] trackIpPhoneCombo failed', { error: err?.message })
      );
    }
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);
    const OTP_TTL = VERIFICATION_CODE_EXPIRY_MINUTES * 60;

    // ── Primary store: Redis (survives restarts, shared across all instances) ──
    // HMAC of the code is stored — never the raw code.
    const hmacSecret = resolveOtpHmacSecret();
    const codeHmac = crypto.createHmac('sha256', hmacSecret).update(code).digest('hex');

    if (redis.isConnected()) {
      // Redis available: use it as the ONLY store. Do NOT write to memory.
      // If the Redis write fails, refuse to send the code — a code stored only in
      // memory would fail silently for any verify request hitting a different instance.
      const stored = await redis.set(
        `otp:login:code:${formattedPhone}`,
        { codeHmac, attempts: 0, expiresAtMs: expiresAt.getTime() },
        OTP_TTL,
      ).catch((err: any) => {
        logger.error('[TwilioSMS] Redis OTP store failed — refusing to send code without durable storage', { error: err?.message });
        return false;
      });
      if (!stored) {
        return { success: false, message: this.t('sendFailed', language), code: 'SMS_OTP_STORE_ERROR', retryable: true, status: 503 };
      }
    } else {
      // Redis not configured — single-instance in-memory fallback.
      // This is only safe in single-process dev environments.
      // In production (Cloud Run) REDIS_URL must be set.
      logger.warn('[TwilioSMS] Redis unavailable — storing OTP in-memory (unsafe for multi-instance; set REDIS_URL in production)');
      verificationCodes.set(formattedPhone, { code, phone: formattedPhone, expiresAt, attempts: 0 });
    }

    const messageBody = this.smsBody(code, language);

    try {
      const params = this.getSendParams(formattedPhone, messageBody);
      let usedSender = params.messagingServiceSid ? 'MessagingService' : (params.from || 'unknown');
      let twilioMsg: { sid?: string };
      try {
        twilioMsg = await this.client!.messages.create(params);
      } catch (alphaErr: any) {
        // Alpha sender rejected by carrier (21612 = alphanumeric not allowed, 21659 = not registered)
        if (params.from === ALPHA_SENDER_ID && (alphaErr.code === 21612 || alphaErr.code === 21659)) {
          logger.warn('[TwilioSMS] Alphanumeric sender not supported for this country — falling back', {
            to: formattedPhone.slice(0, 6) + '****',
            code: alphaErr.code,
          });
          if (this.messagingServiceSid) {
            usedSender = 'MessagingService(fallback)';
            twilioMsg = await this.client!.messages.create({
              body: messageBody,
              messagingServiceSid: this.messagingServiceSid,
              to: formattedPhone,
            });
          } else if (this.fromPhone) {
            usedSender = this.fromPhone;
            twilioMsg = await this.client!.messages.create({
              body: messageBody,
              from: this.fromPhone,
              to: formattedPhone,
            });
          } else {
            throw alphaErr;
          }
        } else {
          throw alphaErr;
        }
      }

      const messageId = twilioMsg?.sid || undefined;

      logger.info('[TwilioSMS] Verification code sent', { 
        phone: formattedPhone.slice(0, 6) + '****',
        from: usedSender,
        expiresAt,
        sid: messageId,
      });

      this.incrementDailyPhoneCount(phone);
      phoneLastSentAt.set(formattedPhone, Date.now()); // stamp cooldown timer
      smsAbuseDetector.recordSent().catch(err =>
        logger.error('[TwilioSMS] AbuseDetector.recordSent failed', { error: err?.message })
      );

      return {
        success: true,
        message: this.t('codeSent', language),
        expiresIn: VERIFICATION_CODE_EXPIRY_MINUTES * 60,
        messageId,
      };
    } catch (error: any) {
      const failure = classifyTwilioSmsError(error);
      const errorDetails = {
        message: error.message || 'Unknown error',
        code: failure.code,
        providerCode: failure.providerCode,
        status: failure.status,
        retryable: failure.retryable,
        moreInfo: error.moreInfo,
        phone: formattedPhone.slice(0, 6) + '****'
      };
      logger.error('[TwilioSMS] Failed to send verification code', errorDetails);

      return {
        success: false,
        message: this.t('sendFailed', language),
        ...failure,
      };
    }
  }

  async checkPhoneLockout(phone: string, language: string = 'he'): Promise<{
    success: false;
    message: string;
    lockedUntil: number;
  } | null> {
    const formattedPhone = this.formatPhoneNumber(phone);
    const lockMsgFor = (remainMin: number): string => {
      const msgs: Record<string, string> = {
        en: `Account locked. Try again in ${remainMin} minutes.`,
        he: `החשבון נעול. נסו שוב בעוד ${remainMin} דקות.`,
        ar: `الحساب مقفل. حاول مرة أخرى بعد ${remainMin} دقائق.`,
        es: `Cuenta bloqueada. Intente de nuevo en ${remainMin} minutos.`,
        fr: `Compte verrouillé. Réessayez dans ${remainMin} minutes.`,
        ru: `Аккаунт заблокирован. Попробуйте через ${remainMin} минут.`,
      };
      return msgs[language] || msgs.en;
    };

    // Redis lockout check (persists across restarts)
    const redisLockTtl = await redis.ttl(`otp:login:lockout:${formattedPhone}`).catch(() => -1);
    if (redisLockTtl > 0) {
      const remainMin = Math.ceil(redisLockTtl / 60);
      return { success: false, message: lockMsgFor(remainMin), lockedUntil: Date.now() + redisLockTtl * 1000 };
    }

    // Memory fallback
    const lockExpiry = phoneLockouts.get(formattedPhone);
    if (lockExpiry && Date.now() < lockExpiry) {
      const remainMin = Math.ceil((lockExpiry - Date.now()) / 60000);
      return { success: false, message: lockMsgFor(remainMin), lockedUntil: lockExpiry };
    }

    return null;
  }

  checkDailyPhoneCap(phone: string, language: string = 'he'): { success: false; message: string } | null {
    const formattedPhone = this.formatPhoneNumber(phone);
    const now = Date.now();
    const entry = phoneDailySendCount.get(formattedPhone);
    if (entry && now < entry.resetAt) {
      if (entry.count >= MAX_SMS_PER_PHONE_PER_DAY) {
        const capMsg: Record<string, string> = {
          en: `Daily SMS limit reached for this number. Try again tomorrow.`,
          he: `הגעתם למגבלת ה-SMS היומית. נסו שוב מחר.`,
          ar: `تم الوصول إلى الحد اليومي لرسائل SMS. حاول مرة أخرى غدًا.`,
          es: `Límite diario de SMS alcanzado. Intente mañana.`,
          fr: `Limite quotidienne de SMS atteinte. Réessayez demain.`,
          ru: `Достигнут дневной лимит SMS. Попробуйте завтра.`,
        };
        logger.warn('[TwilioSMS] Daily SMS cap reached', { phone: formattedPhone.slice(0, 6) + '****', count: entry.count });
        return { success: false, message: capMsg[language] || capMsg.en };
      }
    }
    return null;
  }

  incrementDailyPhoneCount(phone: string): void {
    const formattedPhone = this.formatPhoneNumber(phone);
    const now = Date.now();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const resetAt = midnight.getTime();
    const entry = phoneDailySendCount.get(formattedPhone);
    if (!entry || now >= entry.resetAt) {
      phoneDailySendCount.set(formattedPhone, { count: 1, resetAt });
    } else {
      entry.count++;
    }
  }

  async verifyCode(phone: string, code: string, language: string = 'he'): Promise<{
    success: boolean;
    message: string;
    verificationToken?: string;
    lockedUntil?: number;
  }> {
    const formattedPhone = this.formatPhoneNumber(phone);
    const hmacSecret = resolveOtpHmacSecret();
    const LOCKOUT_TTL = Math.floor(LOCKOUT_DURATION_MS / 1000);

    const lockMsg = (remainMin: number): string => {
      const msgs: Record<string, string> = {
        en: `Account locked. Try again in ${remainMin} minutes.`,
        he: `החשבון נעול. נסו שוב בעוד ${remainMin} דקות.`,
        ar: `الحساب مقفل. حاول مرة أخرى بعد ${remainMin} دقائق.`,
        es: `Cuenta bloqueada. Intente de nuevo en ${remainMin} minutos.`,
        fr: `Compte verrouillé. Réessayez dans ${remainMin} minutes.`,
        ru: `Аккаунт заблокирован. Попробуйте через ${remainMin} минут.`,
      };
      return msgs[language] || msgs.en;
    };

    // ── 1. Check lockout — Redis first, memory fallback ───────────────────────
    const redisLockTtl = await redis.ttl(`otp:login:lockout:${formattedPhone}`).catch(() => -1);
    if (redisLockTtl > 0) {
      const remainMin = Math.ceil(redisLockTtl / 60);
      logger.warn('[TwilioSMS] Redis lockout active', { phone: formattedPhone.slice(0, 6) + '****', remainMin });
      return { success: false, message: lockMsg(remainMin), lockedUntil: Date.now() + redisLockTtl * 1000 };
    }
    const memLockExpiry = phoneLockouts.get(formattedPhone);
    if (memLockExpiry && Date.now() < memLockExpiry) {
      const remainMin = Math.ceil((memLockExpiry - Date.now()) / 60000);
      logger.warn('[TwilioSMS] Memory lockout active', { phone: formattedPhone.slice(0, 6) + '****', remainMin });
      return { success: false, message: lockMsg(remainMin), lockedUntil: memLockExpiry };
    }

    // ── 2. Resolve code entry — Redis primary, memory Map fallback ────────────
    type RedisEntry = { codeHmac: string; attempts: number; expiresAtMs: number };
    const redisEntry = await redis.get<RedisEntry>(`otp:login:code:${formattedPhone}`).catch(() => null);

    if (redisEntry) {
      // Redis path — survives restarts
      if (Date.now() > redisEntry.expiresAtMs) {
        await redis.del(`otp:login:code:${formattedPhone}`).catch(() => {});
        verificationCodes.delete(formattedPhone);
        return { success: false, message: this.t('codeExpired', language) };
      }

      if (redisEntry.attempts >= MAX_VERIFICATION_ATTEMPTS) {
        await redis.del(`otp:login:code:${formattedPhone}`).catch(() => {});
        verificationCodes.delete(formattedPhone);
        await redis.setRaw(`otp:login:lockout:${formattedPhone}`, '1', LOCKOUT_TTL).catch(() => {});
        phoneLockouts.set(formattedPhone, Date.now() + LOCKOUT_DURATION_MS);
        logger.warn('[TwilioSMS] Max attempts — phone locked 15 min (Redis)', { phone: formattedPhone.slice(0, 6) + '****' });
        const lockMsgs: Record<string, string> = {
          en: 'Too many attempts. Locked for 15 minutes.',
          he: 'חרגתם ממספר הניסיונות. נעול ל-15 דקות.',
          ar: 'محاولات كثيرة. مقفل لمدة 15 دقيقة.',
          es: 'Demasiados intentos. Bloqueado por 15 minutos.',
          fr: 'Trop de tentatives. Verrouillé pour 15 minutes.',
          ru: 'Слишком много попыток. Заблокировано на 15 минут.',
        };
        return { success: false, message: lockMsgs[language] || lockMsgs.en, lockedUntil: Date.now() + LOCKOUT_DURATION_MS };
      }

      const inputHmac = crypto.createHmac('sha256', hmacSecret).update(code).digest('hex');
      const hmacA = Buffer.from(redisEntry.codeHmac, 'hex');
      const hmacB = Buffer.from(inputHmac, 'hex');
      const codeMatch = hmacA.length === hmacB.length && crypto.timingSafeEqual(hmacA, hmacB);

      if (!codeMatch) {
        redisEntry.attempts++;
        await redis.set(
          `otp:login:code:${formattedPhone}`,
          redisEntry,
          Math.ceil((redisEntry.expiresAtMs - Date.now()) / 1000),
        ).catch(() => {});
        // Mirror attempt count to memory fallback
        const memEntry = verificationCodes.get(formattedPhone);
        if (memEntry) memEntry.attempts = redisEntry.attempts;
        return { success: false, message: this.invalidCodeMsg(MAX_VERIFICATION_ATTEMPTS - redisEntry.attempts, language) };
      }

      // Correct code — delete from both stores
      await redis.del(`otp:login:code:${formattedPhone}`).catch(() => {});
      verificationCodes.delete(formattedPhone);

    } else {
      // ── Redis miss ────────────────────────────────────────────────────────────
      if (redis.isConnected()) {
        // Redis is up but returned no entry. This means:
        // - the code expired, OR
        // - it was already used and deleted, OR
        // - (in a previous deployment) this code was stored in memory on another instance
        // In all cases: reject — do not fall back to memory (memory is per-instance and unreliable).
        logger.warn('[TwilioSMS] Redis miss during verify — code expired, already used, or not found', {
          phone: formattedPhone.slice(0, 6) + '****',
        });
        return { success: false, message: this.t('noCode', language) };
      }

      // Redis not configured — fall back to the in-memory Map (single-instance dev only).
      logger.warn('[TwilioSMS] Redis not configured — using in-memory OTP verify (single-instance only)', {
        phone: formattedPhone.slice(0, 6) + '****',
      });
      const stored = verificationCodes.get(formattedPhone);

      if (!stored) {
        return { success: false, message: this.t('noCode', language) };
      }
      if (new Date() > stored.expiresAt) {
        verificationCodes.delete(formattedPhone);
        return { success: false, message: this.t('codeExpired', language) };
      }
      if (stored.attempts >= MAX_VERIFICATION_ATTEMPTS) {
        verificationCodes.delete(formattedPhone);
        phoneLockouts.set(formattedPhone, Date.now() + LOCKOUT_DURATION_MS);
        await redis.setRaw(`otp:login:lockout:${formattedPhone}`, '1', LOCKOUT_TTL).catch(() => {});
        const lockMsgs: Record<string, string> = {
          en: 'Too many attempts. Locked for 15 minutes.',
          he: 'חרגתם ממספר הניסיונות. נעול ל-15 דקות.',
          ar: 'محاولات كثيرة. مقفل لمدة 15 دقيقة.',
          es: 'Demasiados intentos. Bloqueado por 15 minutos.',
          fr: 'Trop de tentatives. Verrouillé pour 15 minutes.',
          ru: 'Слишком много попыток. Заблокировано на 15 минут.',
        };
        return { success: false, message: lockMsgs[language] || lockMsgs.en, lockedUntil: Date.now() + LOCKOUT_DURATION_MS };
      }

      const codeMatch = stored.code.length === code.length &&
        crypto.timingSafeEqual(Buffer.from(stored.code), Buffer.from(code));
      if (!codeMatch) {
        stored.attempts++;
        return { success: false, message: this.invalidCodeMsg(MAX_VERIFICATION_ATTEMPTS - stored.attempts, language) };
      }

      verificationCodes.delete(formattedPhone);
    }

    // ── Success — issue JWT verification token ────────────────────────────────
    const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET;
    if (!secret) throw new Error('SMS verification secret not configured — set JWT_SECRET');
    const verificationToken = jwt.sign(
      { phone: formattedPhone, type: 'sms-verified', nonce: crypto.randomBytes(8).toString('hex') },
      secret,
      { expiresIn: `${VERIFICATION_TOKEN_EXPIRY_MINUTES}m` },
    );

    logger.info('[TwilioSMS] Phone verified successfully (Redis primary)', {
      phone: formattedPhone.slice(0, 6) + '****',
    });

    return {
      success: true,
      message: this.t('verified', language),
      verificationToken,
    };
  }

  validateVerificationToken(token: string): { valid: boolean; phone?: string; nonce?: string } {
    if (!token) return { valid: false };
    try {
      const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET;
      if (!secret) return { valid: false };
      const decoded = jwt.verify(token, secret) as { phone?: string; type?: string; nonce?: string };
      if (decoded.type !== 'sms-verified' || !decoded.phone) return { valid: false };
      logger.info('[TwilioSMS] JWT verification token validated', {
        phone: decoded.phone.slice(0, 6) + '****'
      });
      return { valid: true, phone: decoded.phone, nonce: decoded.nonce };
    } catch {
      return { valid: false };
    }
  }

  /**
   * SECURITY (single-use proof token, sweep 2026-07-13): mark a verification-token
   * nonce as consumed. Returns true on FIRST consume, false if the nonce was already
   * used — the caller (session-minting) rejects a replay so a captured token can't be
   * re-POSTed within its 5-min TTL to mint multiple sessions. In-memory (single-instance;
   * the 5-min TTL keeps the set tiny). Scoped to session minting so multi-step signup
   * flows that re-validate the same token are unaffected.
   */
  consumeVerificationNonce(nonce: string): boolean {
    if (!nonce) return true; // legacy token without a nonce — nothing to dedupe
    const now = Date.now();
    for (const [n, exp] of consumedVerificationNonces) {
      if (exp <= now) consumedVerificationNonces.delete(n);
    }
    if (consumedVerificationNonces.has(nonce)) return false;
    consumedVerificationNonces.set(nonce, now + VERIFICATION_TOKEN_EXPIRY_MINUTES * 60 * 1000);
    return true;
  }

  async sendWhatsApp(to: string, body: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (await smsAbuseDetector.isKillSwitchActive()) {
      logger.warn('[TwilioSMS] 🚨 Kill switch active — WhatsApp blocked', { to: to.slice(-4) });
      return { success: false, error: 'SMS service temporarily suspended' };
    }
    if (!checkGlobalDailyCap()) {
      return { success: false, error: 'Daily SMS limit reached — service suspended until midnight' };
    }
    if (!this.isReady()) {
      return { success: false, error: 'WhatsApp service not configured' };
    }

    const formattedPhone = this.formatPhoneNumber(to);

    try {
      const message = await this.client!.messages.create({
        body,
        from: `whatsapp:${this.fromPhone!}`,
        to: `whatsapp:${formattedPhone}`,
      });

      logger.info('[TwilioWhatsApp] Message sent', {
        to: formattedPhone.slice(0, 6) + '****',
        messageId: message.sid,
      });

      return { success: true, messageId: message.sid };
    } catch (error: any) {
      logger.error('[TwilioWhatsApp] Failed to send message', {
        error: error.message,
        code: error.code,
        to: formattedPhone.slice(0, 6) + '****',
      });

      return { success: false, error: error.message };
    }
  }

  async sendSMS(to: string, body: string, meta?: { userId?: string; ip?: string; ua?: string }): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const auditCtx = { to: to.slice(0, 6) + '****', userId: meta?.userId, ip: meta?.ip, ua: meta?.ua?.slice(0, 80) };

    if (await smsAbuseDetector.isKillSwitchActive()) {
      logger.warn('[TwilioSMS] 🚨 Kill switch active — sendSMS blocked', auditCtx);
      return { success: false, error: 'SMS service temporarily suspended' };
    }

    const formattedPhone = this.formatPhoneNumber(to);
    if (!isAllowedCountry(formattedPhone)) {
      logger.error('[TwilioSMS] 🚫 BLOCKED: destination country not in allowlist', { ...auditCtx, formattedPhone: formattedPhone.slice(0, 6) + '****' });
      return { success: false, error: 'Destination country not permitted' };
    }

    if (!checkGlobalDailyCap()) {
      logger.error('[TwilioSMS] 🚨 Global daily cap reached — sendSMS blocked', auditCtx);
      return { success: false, error: 'Daily SMS limit reached — service suspended until midnight' };
    }
    if (!this.isReady()) {
      return {
        success: false,
        error: 'SMS service not configured'
      };
    }

    logger.info('[TwilioSMS] sendSMS attempt', auditCtx);

    try {
      const params = this.getSendParams(formattedPhone, body);
      let message;
      let usedSender = params.messagingServiceSid ? 'MessagingService' : (params.from || 'unknown');
      try {
        message = await this.client!.messages.create(params);
      } catch (alphaErr: any) {
        if (!params.messagingServiceSid && this.fromPhone && params.from !== this.fromPhone && (alphaErr.code === 21612 || alphaErr.code === 21659)) {
          usedSender = this.fromPhone;
          message = await this.client!.messages.create({
            body,
            from: this.fromPhone,
            to: formattedPhone
          });
        } else {
          throw alphaErr;
        }
      }

      logger.info('[TwilioSMS] SMS sent', {
        to: formattedPhone.slice(0, 6) + '****',
        from: usedSender,
        messageId: message.sid
      });

      // Feed the global SMS-abuse counters / kill-switch on EVERY successful
      // send. Without this, sendSMS was the dead path for the cost ceiling:
      // recordSent() was only invoked by the legacy sendVerificationCode, so
      // hourly/daily thresholds and the auto-kill-switch never engaged for
      // OTPs routed through RegistrationOTPService → sendSMS (the primary
      // signup flow). Fire-and-forget; failures are logged, never thrown,
      // because losing the counter must not also lose the user's OTP.
      smsAbuseDetector.recordSent().catch(err =>
        logger.error('[TwilioSMS] AbuseDetector.recordSent failed (non-fatal)', { error: err?.message })
      );

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
