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

const MAX_SMS_PER_PHONE_PER_DAY = 5;
const phoneDailySendCount = new Map<string, { count: number; resetAt: number }>();

const MAX_GLOBAL_SMS_PER_DAY = 150;
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

const ALPHA_SENDER_BLOCKED_COUNTRIES = new Set([
  '1',
]);

class TwilioSMSService {
  private client: twilio.Twilio | null = null;
  private fromPhone: string | null = null;
  private messagingServiceSid: string | null = null;
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    if (accountSid && authToken && (fromPhone || messagingServiceSid)) {
      try {
        this.client = twilio(accountSid, authToken);
        this.fromPhone = fromPhone || null;
        this.messagingServiceSid = messagingServiceSid || null;
        this.isConfigured = true;
        if (this.messagingServiceSid) {
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
    if (this.messagingServiceSid) {
      return { body, to: toPhone, messagingServiceSid: this.messagingServiceSid };
    }
    if (!this.fromPhone) {
      throw new Error('No fromPhone or messagingServiceSid configured');
    }
    const cleaned = toPhone.replace(/[^0-9]/g, '');
    let sender = ALPHA_SENDER_ID;
    for (const prefix of ALPHA_SENDER_BLOCKED_COUNTRIES) {
      if (cleaned.startsWith(prefix)) {
        sender = this.fromPhone;
        break;
      }
    }
    return { body, to: toPhone, from: sender };
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

  async sendVerificationCode(phone: string, language: string = 'he', callerIp?: string): Promise<{
    success: boolean;
    message: string;
    expiresIn?: number;
    messageId?: string;
  }> {
    if (await smsAbuseDetector.isKillSwitchActive()) {
      logger.warn('[TwilioSMS] 🚨 Kill switch active — all SMS blocked', { phone: phone.slice(-4) });
      return { success: false, message: this.t('smsUnavailable', language) };
    }
    if (!checkGlobalDailyCap()) {
      logger.error('[TwilioSMS] 🚨 Global daily cap reached — blocking verification SMS');
      return { success: false, message: this.t('smsUnavailable', language) };
    }
    if (!this.isReady()) {
      return {
        success: false,
        message: this.t('smsUnavailable', language)
      };
    }

    const formattedPhone = this.formatPhoneNumber(phone);

    // Track IP→phone mapping for enumeration attack detection
    if (callerIp) {
      smsAbuseDetector.trackIpPhoneCombo(callerIp, formattedPhone).catch(err =>
        logger.error('[TwilioSMS] trackIpPhoneCombo failed', { error: err?.message })
      );
    }
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);
    const OTP_TTL = VERIFICATION_CODE_EXPIRY_MINUTES * 60;

    // Store in memory (immediate fallback if Redis is unavailable)
    verificationCodes.set(formattedPhone, {
      code,
      phone: formattedPhone,
      expiresAt,
      attempts: 0
    });

    // ── Primary store: Redis (survives server restarts, shared across instances) ──
    // Store HMAC of code — never raw code. Key: otp:login:code:{phone}
    const hmacSecret = process.env.APP_SESSION_SECRET || process.env.COOKIE_SECRET || 'petwash-otp-hmac';
    const codeHmac = crypto.createHmac('sha256', hmacSecret).update(code).digest('hex');
    redis.set(
      `otp:login:code:${formattedPhone}`,
      { codeHmac, attempts: 0, expiresAtMs: expiresAt.getTime() },
      OTP_TTL,
    ).catch((err: any) =>
      logger.warn('[TwilioSMS] Redis OTP store failed — memory fallback active', { error: err?.message })
    );
    // ─────────────────────────────────────────────────────────────────────────────

    const messageBody = this.smsBody(code, language);

    try {
      const params = this.getSendParams(formattedPhone, messageBody);
      let usedSender = params.messagingServiceSid ? 'MessagingService' : (params.from || 'unknown');
      let twilioMsg: { sid?: string };
      try {
        twilioMsg = await this.client!.messages.create(params);
      } catch (alphaErr: any) {
        if (!params.messagingServiceSid && this.fromPhone && params.from !== this.fromPhone && (alphaErr.code === 21612 || alphaErr.code === 21659)) {
          logger.warn('[TwilioSMS] Alphanumeric sender not supported, falling back to phone number');
          usedSender = this.fromPhone;
          twilioMsg = await this.client!.messages.create({
            body: messageBody,
            from: this.fromPhone,
            to: formattedPhone
          });
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
        message: this.t('sendFailed', language)
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
    const hmacSecret = process.env.APP_SESSION_SECRET || process.env.COOKIE_SECRET || 'petwash-otp-hmac';
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
      // ── Redis miss — fall back to in-memory Map (Redis was down during send) ──
      logger.warn('[TwilioSMS] Redis miss — using in-memory OTP fallback', { phone: formattedPhone.slice(0, 6) + '****' });
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
    const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET || 'petwash-sms-verify-fallback';
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

  validateVerificationToken(token: string): { valid: boolean; phone?: string } {
    if (!token) return { valid: false };
    try {
      const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET || 'petwash-sms-verify-fallback';
      const decoded = jwt.verify(token, secret) as { phone?: string; type?: string };
      if (decoded.type !== 'sms-verified' || !decoded.phone) return { valid: false };
      logger.info('[TwilioSMS] JWT verification token validated', {
        phone: decoded.phone.slice(0, 6) + '****'
      });
      return { valid: true, phone: decoded.phone };
    } catch {
      return { valid: false };
    }
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
