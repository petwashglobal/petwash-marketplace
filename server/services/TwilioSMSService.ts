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

const VERIFICATION_CODE_EXPIRY_MINUTES = 5;
const MAX_VERIFICATION_ATTEMPTS = 3;
const VERIFICATION_TOKEN_EXPIRY_MINUTES = 5;

const ALPHA_SENDER_ID = 'PetWash';

const ALPHA_SENDER_BLOCKED_COUNTRIES = new Set([
  '1',
]);

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
        logger.error('[TwilioSMS] Failed to initialize', error);
        this.isConfigured = false;
      }
    } else {
      logger.warn('[TwilioSMS] ⚠️ Not configured - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER missing');
      this.isConfigured = false;
    }
  }

  private getSenderForDestination(toPhone: string): string {
    const cleaned = toPhone.replace(/[^0-9]/g, '');
    for (const prefix of ALPHA_SENDER_BLOCKED_COUNTRIES) {
      if (cleaned.startsWith(prefix)) {
        return this.fromPhone!;
      }
    }
    return ALPHA_SENDER_ID;
  }

  isReady(): boolean {
    return this.isConfigured && this.client !== null;
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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
      en: `Pet Wash™ verification code:\n${code}\nExpires in ${mins} minutes. Do not share.`,
      he: `Pet Wash™ קוד אימות:\n${code}\nתקף ל-${mins} דקות. אל תשתפו.`,
      ar: `Pet Wash™ رمز التحقق:\n${code}\nصالح لمدة ${mins} دقائق. لا تشاركه.`,
      es: `Pet Wash™ código de verificación:\n${code}\nExpira en ${mins} minutos. No compartas.`,
      fr: `Pet Wash™ code de vérification:\n${code}\nExpire dans ${mins} minutes. Ne partagez pas.`,
      ru: `Pet Wash™ код подтверждения:\n${code}\nДействителен ${mins} минут. Не делитесь.`,
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

  async sendVerificationCode(phone: string, language: string = 'he'): Promise<{
    success: boolean;
    message: string;
    expiresIn?: number;
  }> {
    if (!this.isReady()) {
      return {
        success: false,
        message: this.t('smsUnavailable', language)
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

    const messageBody = this.smsBody(code, language);

    try {
      const sender = this.getSenderForDestination(formattedPhone);
      let usedSender = sender;
      try {
        await this.client!.messages.create({
          body: messageBody,
          from: sender,
          to: formattedPhone
        });
      } catch (alphaErr: any) {
        if (sender !== this.fromPhone! && (alphaErr.code === 21612 || alphaErr.code === 21659)) {
          logger.warn('[TwilioSMS] Alphanumeric sender not supported, falling back to phone number');
          usedSender = this.fromPhone!;
          await this.client!.messages.create({
            body: messageBody,
            from: this.fromPhone!,
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

  verifyCode(phone: string, code: string, language: string = 'he'): {
    success: boolean;
    message: string;
    verificationToken?: string;
  } {
    const formattedPhone = this.formatPhoneNumber(phone);
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
      return {
        success: false,
        message: this.t('tooMany', language)
      };
    }

    if (stored.code !== code) {
      stored.attempts++;
      return {
        success: false,
        message: this.invalidCodeMsg(MAX_VERIFICATION_ATTEMPTS - stored.attempts, language)
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
      message: this.t('verified', language),
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

  async sendWhatsApp(to: string, body: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
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
    if (!this.isReady()) {
      return {
        success: false,
        error: 'SMS service not configured'
      };
    }

    const formattedPhone = this.formatPhoneNumber(to);

    try {
      const sender = this.getSenderForDestination(formattedPhone);
      let message;
      let usedSender = sender;
      try {
        message = await this.client!.messages.create({
          body,
          from: sender,
          to: formattedPhone
        });
      } catch (alphaErr: any) {
        if (sender !== this.fromPhone! && (alphaErr.code === 21612 || alphaErr.code === 21659)) {
          usedSender = this.fromPhone!;
          message = await this.client!.messages.create({
            body,
            from: this.fromPhone!,
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
