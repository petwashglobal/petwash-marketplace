import twilio from 'twilio';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger';
import crypto from 'crypto';
import { smsAbuseDetector } from './SmsAbuseDetector';

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
    const bodies: Record<string, string> = {
      en: `PetWash verification code:\n\n${code}\n\nExpires in ${mins} minutes.\nDo not share this code.`,
      he: `PetWash קוד אימות:\n\n${code}\n\nתקף ל-${mins} דקות.\nאל תשתפו קוד זה.`,
      ar: `PetWash رمز التحقق:\n\n${code}\n\nصالح لمدة ${mins} دقائق.\nلا تشارك هذا الرمز.`,
      es: `PetWash codigo de verificacion:\n\n${code}\n\nExpira en ${mins} minutos.\nNo compartas este codigo.`,
      fr: `PetWash code de verification:\n\n${code}\n\nExpire dans ${mins} minutes.\nNe partagez pas ce code.`,
      ru: `PetWash код подтверждения:\n\n${code}\n\nДействителен ${mins} минут.\nНе сообщайте этот код.`,
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
  }> {
    if (this.isEmergencyDisabled()) {
      logger.warn('[TwilioSMS] 🚨 SMS_EMERGENCY_DISABLED=true — all SMS blocked', { phone: phone.slice(-4) });
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
      smsAbuseDetector.trackIpPhoneCombo(callerIp, formattedPhone);
    }
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    verificationCodes.set(formattedPhone, {
      code,
      phone: formattedPhone,
      expiresAt,
      attempts: 0
    });

    const messageBody = this.smsBody(code, language);

    try {
      const params = this.getSendParams(formattedPhone, messageBody);
      let usedSender = params.messagingServiceSid ? 'MessagingService' : (params.from || 'unknown');
      try {
        await this.client!.messages.create(params);
      } catch (alphaErr: any) {
        if (!params.messagingServiceSid && this.fromPhone && params.from !== this.fromPhone && (alphaErr.code === 21612 || alphaErr.code === 21659)) {
          logger.warn('[TwilioSMS] Alphanumeric sender not supported, falling back to phone number');
          usedSender = this.fromPhone;
          await this.client!.messages.create({
            body: messageBody,
            from: this.fromPhone,
            to: formattedPhone
          });
        } else {
          throw alphaErr;
        }
      }

      logger.info('[TwilioSMS] Verification code sent', { 
        phone: formattedPhone.slice(0, 6) + '****',
        from: usedSender,
        expiresAt 
      });

      this.incrementDailyPhoneCount(phone);
      // Global circuit breaker: track this SMS against global hourly/daily limits
      smsAbuseDetector.recordSent().catch(err =>
        logger.error('[TwilioSMS] AbuseDetector.recordSent failed', { error: err?.message })
      );

      return {
        success: true,
        message: this.t('codeSent', language),
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
        message: this.t('sendFailed', language)
      };
    }
  }

  checkPhoneLockout(phone: string, language: string = 'he'): {
    success: false;
    message: string;
    lockedUntil: number;
  } | null {
    const formattedPhone = this.formatPhoneNumber(phone);
    const lockExpiry = phoneLockouts.get(formattedPhone);
    if (lockExpiry && Date.now() < lockExpiry) {
      const remainMin = Math.ceil((lockExpiry - Date.now()) / 60000);
      const lockMsg: Record<string, string> = {
        en: `Account locked. Try again in ${remainMin} minutes.`,
        he: `החשבון נעול. נסו שוב בעוד ${remainMin} דקות.`,
        ar: `الحساب مقفل. حاول مرة أخرى بعد ${remainMin} دقائق.`,
        es: `Cuenta bloqueada. Intente de nuevo en ${remainMin} minutos.`,
        fr: `Compte verrouillé. Réessayez dans ${remainMin} minutes.`,
        ru: `Аккаунт заблокирован. Попробуйте через ${remainMin} минут.`,
      };
      return {
        success: false,
        message: lockMsg[language] || lockMsg.en,
        lockedUntil: lockExpiry,
      };
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

  verifyCode(phone: string, code: string, language: string = 'he'): {
    success: boolean;
    message: string;
    verificationToken?: string;
    lockedUntil?: number;
  } {
    const formattedPhone = this.formatPhoneNumber(phone);

    const lockExpiry = phoneLockouts.get(formattedPhone);
    if (lockExpiry && Date.now() < lockExpiry) {
      const remainMin = Math.ceil((lockExpiry - Date.now()) / 60000);
      const lockMsg: Record<string, string> = {
        en: `Account locked. Try again in ${remainMin} minutes.`,
        he: `החשבון נעול. נסו שוב בעוד ${remainMin} דקות.`,
        ar: `الحساب مقفل. حاول مرة أخرى بعد ${remainMin} دقائق.`,
        es: `Cuenta bloqueada. Intente de nuevo en ${remainMin} minutos.`,
        fr: `Compte verrouillé. Réessayez dans ${remainMin} minutes.`,
        ru: `Аккаунт заблокирован. Попробуйте через ${remainMin} минут.`,
      };
      logger.warn('[TwilioSMS] Phone locked out', { phone: formattedPhone.slice(0, 6) + '****', remainMin });
      return {
        success: false,
        message: lockMsg[language] || lockMsg.en,
        lockedUntil: lockExpiry,
      };
    }

    const stored = verificationCodes.get(formattedPhone);

    if (!stored) {
      return {
        success: false,
        message: this.t('noCode', language)
      };
    }

    if (new Date() > stored.expiresAt) {
      verificationCodes.delete(formattedPhone);
      return {
        success: false,
        message: this.t('codeExpired', language)
      };
    }

    if (stored.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      verificationCodes.delete(formattedPhone);
      phoneLockouts.set(formattedPhone, Date.now() + LOCKOUT_DURATION_MS);
      logger.warn('[TwilioSMS] Max attempts reached, locking phone for 15min', { phone: formattedPhone.slice(0, 6) + '****' });
      const lockMsg: Record<string, string> = {
        en: 'Too many attempts. Locked for 15 minutes.',
        he: 'חרגתם ממספר הניסיונות. נעול ל-15 דקות.',
        ar: 'محاولات كثيرة. مقفل لمدة 15 دقيقة.',
        es: 'Demasiados intentos. Bloqueado por 15 minutos.',
        fr: 'Trop de tentatives. Verrouillé pour 15 minutes.',
        ru: 'Слишком много попыток. Заблокировано на 15 минут.',
      };
      return {
        success: false,
        message: lockMsg[language] || lockMsg.en,
        lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
      };
    }

    const codeMatch = stored.code.length === code.length &&
      crypto.timingSafeEqual(Buffer.from(stored.code), Buffer.from(code));
    if (!codeMatch) {
      stored.attempts++;
      return {
        success: false,
        message: this.invalidCodeMsg(MAX_VERIFICATION_ATTEMPTS - stored.attempts, language)
      };
    }

    verificationCodes.delete(formattedPhone);

    const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET || 'petwash-sms-verify-fallback';
    const verificationToken = jwt.sign(
      { phone: formattedPhone, type: 'sms-verified', nonce: crypto.randomBytes(8).toString('hex') },
      secret,
      { expiresIn: `${VERIFICATION_TOKEN_EXPIRY_MINUTES}m` }
    );

    logger.info('[TwilioSMS] Phone verified successfully, JWT token issued', {
      phone: formattedPhone.slice(0, 6) + '****'
    });

    return {
      success: true,
      message: this.t('verified', language),
      verificationToken
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
    if (this.isEmergencyDisabled()) {
      logger.warn('[TwilioSMS] 🚨 SMS_EMERGENCY_DISABLED=true — WhatsApp blocked', { to: to.slice(-4) });
      return { success: false, error: 'SMS service temporarily suspended' };
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

  async sendSMS(to: string, body: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    if (this.isEmergencyDisabled()) {
      logger.warn('[TwilioSMS] 🚨 SMS_EMERGENCY_DISABLED=true — sendSMS blocked', { to: to.slice(-4) });
      return { success: false, error: 'SMS service temporarily suspended' };
    }
    if (!this.isReady()) {
      return {
        success: false,
        error: 'SMS service not configured'
      };
    }

    const formattedPhone = this.formatPhoneNumber(to);

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
