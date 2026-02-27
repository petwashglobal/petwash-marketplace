import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { twilioSMSService } from '../services/TwilioSMSService';
import { EmailService } from '../emailService';
import { logger } from '../lib/logger';
import { verifyCaptchaToken } from '../lib/verifyCaptcha';
import crypto from 'crypto';

const phoneSmsSentAt = new Map<string, number[]>();
const SMS_PER_PHONE_MAX = 3;
const SMS_PER_PHONE_WINDOW_MS = 60 * 60 * 1000;

function checkPhoneSmsCooldown(phone: string): { blocked: boolean; message: string } {
  const now = Date.now();
  const timestamps = (phoneSmsSentAt.get(phone) || []).filter(t => now - t < SMS_PER_PHONE_WINDOW_MS);
  if (timestamps.length >= SMS_PER_PHONE_MAX) {
    return { blocked: true, message: 'Too many SMS sent to this number. Please wait before requesting again.' };
  }
  timestamps.push(now);
  phoneSmsSentAt.set(phone, timestamps);
  return { blocked: false, message: '' };
}

const router = Router();

interface EmailVerificationCode {
  code: string;
  email: string;
  expiresAt: Date;
  attempts: number;
  linkToken: string;
  linkVerified: boolean;
}

interface EmailVerificationToken {
  email: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}

const emailVerificationCodes = new Map<string, EmailVerificationCode>();
const emailVerificationTokens = new Map<string, EmailVerificationToken>();
const linkTokenToEmail = new Map<string, string>();

const EMAIL_CODE_EXPIRY_MINUTES = 5;
const MAX_EMAIL_ATTEMPTS = 5;
const EMAIL_TOKEN_EXPIRY_MINUTES = 30;
const EMAIL_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const emailLockouts = new Map<string, number>();

const verificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const lang = req.body?.language || 'he';
    const msgs: Record<string, string> = {
      en: 'Too many verification requests. Please wait 5 minutes.',
      he: 'יותר מדי בקשות אימות. אנא המתינו 5 דקות.',
      ar: 'طلبات تحقق كثيرة جدًا. يرجى الانتظار 5 دقائق.',
      es: 'Demasiadas solicitudes de verificación. Espere 5 minutos.',
      fr: 'Trop de demandes de vérification. Veuillez patienter 5 minutes.',
      ru: 'Слишком много запросов на проверку. Подождите 5 минут.',
    };
    res.status(429).json({ success: false, message: msgs[lang] || msgs.en });
  },
});

function generateCode(): string {
  return String(Math.floor(100000 + crypto.randomInt(900000)));
}

function getBaseUrl(req: Request): string {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || req.hostname;
  return `${proto}://${host}`;
}

function getEmailHtml(code: string, language: string, verifyLinkUrl: string): string {
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  const title = isHebrew ? 'קוד האימות שלך' : 'Your Verification Code';
  const subtitle = isHebrew
    ? 'הזינו את הקוד הבא כדי לאמת את כתובת האימייל שלכם'
    : 'Enter the following code to verify your email address';
  const orClickLink = isHebrew
    ? 'או לחצו על הכפתור למטה לאימות מיידי'
    : 'Or click the button below for instant verification';
  const verifyBtnText = isHebrew ? 'אמתו את האימייל שלי' : 'Verify My Email';
  const expiry = isHebrew
    ? `הקוד תקף ל-${EMAIL_CODE_EXPIRY_MINUTES} דקות`
    : `This code is valid for ${EMAIL_CODE_EXPIRY_MINUTES} minutes`;
  const noRequest = isHebrew
    ? 'אם לא ביקשתם קוד זה, אנא התעלמו מאימייל זה.'
    : 'If you did not request this code, please ignore this email.';

  return `
    <!DOCTYPE html>
    <html dir="${dir}" lang="${language}">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background-color:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;padding:40px 20px;">
        <tr><td align="center">
          <table width="100%" style="max-width:480px;background:#ffffff;border-radius:2px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            <tr><td style="background:linear-gradient(135deg,#1a1a1a,#2d2d2d);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#c9a96e;font-size:24px;font-weight:600;letter-spacing:0.5px;">⁦Pet Wash™⁩</h1>
            </td></tr>
            <tr><td style="padding:40px 32px;text-align:center;">
              <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:600;">${title}</h2>
              <p style="margin:0 0 32px;color:#666;font-size:14px;line-height:1.5;">${subtitle}</p>
              <div style="background:#f8f9fa;border:2px solid #e8e8e8;border-radius:2px;padding:20px;margin:0 auto;max-width:260px;">
                <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a1a;font-family:'Courier New',monospace;">${code}</span>
              </div>
              <div style="margin:28px 0 0;padding:24px 0 0;border-top:1px solid #eee;">
                <p style="margin:0 0 16px;color:#888;font-size:13px;">${orClickLink}</p>
                <a href="${verifyLinkUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#1a1a1a,#374151);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:2px;font-size:16px;font-weight:600;letter-spacing:0.3px;">${verifyBtnText}</a>
              </div>
              <p style="margin:24px 0 0;color:#999;font-size:12px;">${expiry}</p>
            </td></tr>
            <tr><td style="padding:0 32px 32px;text-align:center;">
              <p style="margin:0;color:#bbb;font-size:11px;line-height:1.4;">${noRequest}</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

function issueEmailVerificationToken(normalizedEmail: string): string {
  const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET || 'petwash-email-verify-fallback';
  const token = jwt.sign(
    { email: normalizedEmail, type: 'email-verified', nonce: crypto.randomBytes(8).toString('hex') },
    secret,
    { expiresIn: `${EMAIL_TOKEN_EXPIRY_MINUTES}m` }
  );
  return token;
}

router.post('/send-email-code', verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { email, language = 'he' } = req.body;
    const isHebrew = language === 'he';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const lockExpiry = emailLockouts.get(normalizedEmail);
    if (lockExpiry && Date.now() < lockExpiry) {
      const remainMin = Math.ceil((lockExpiry - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: isHebrew
          ? `האימייל נעול. נסו שוב בעוד ${remainMin} דקות.`
          : `Email locked. Try again in ${remainMin} minutes.`,
        lockedUntil: lockExpiry,
      });
    }
    const code = generateCode();
    const linkToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EMAIL_CODE_EXPIRY_MINUTES * 60 * 1000);

    emailVerificationCodes.set(normalizedEmail, {
      code,
      email: normalizedEmail,
      expiresAt,
      attempts: 0,
      linkToken,
      linkVerified: false,
    });

    linkTokenToEmail.set(linkToken, normalizedEmail);

    const baseUrl = getBaseUrl(req);
    const verifyLinkUrl = `${baseUrl}/api/onboarding-verification/verify-email-link?token=${linkToken}&lang=${language}`;

    const subject = isHebrew ? `⁦Pet Wash™⁩ - קוד אימות` : `⁦Pet Wash™⁩ - Verification Code`;

    const sent = await EmailService.send({
      to: normalizedEmail,
      subject,
      html: getEmailHtml(code, language, verifyLinkUrl),
    });

    if (sent) {
      logger.info('[Verification] Email code sent', { email: normalizedEmail.slice(0, 3) + '***' });
      return res.json({
        success: true,
        message: isHebrew ? 'קוד אימות נשלח לאימייל שלך' : 'Verification code sent to your email',
        expiresIn: EMAIL_CODE_EXPIRY_MINUTES * 60,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: isHebrew ? 'שגיאה בשליחת קוד האימות' : 'Failed to send verification code',
      });
    }
  } catch (error: any) {
    logger.error('[Verification] Email code error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/verify-email-link', async (req: Request, res: Response) => {
  try {
    const { token, lang = 'he' } = req.query;
    const isHebrew = lang === 'he';

    if (!token || typeof token !== 'string') {
      return res.status(400).send(renderLinkResultPage(false, isHebrew
        ? 'קישור לא תקין'
        : 'Invalid verification link', isHebrew));
    }

    const email = linkTokenToEmail.get(token);
    if (!email) {
      return res.status(400).send(renderLinkResultPage(false, isHebrew
        ? 'הקישור פג תוקף או כבר נעשה בו שימוש'
        : 'Link expired or already used', isHebrew));
    }

    const stored = emailVerificationCodes.get(email);
    if (!stored || stored.linkToken !== token) {
      linkTokenToEmail.delete(token);
      return res.status(400).send(renderLinkResultPage(false, isHebrew
        ? 'הקישור פג תוקף או כבר נעשה בו שימוש'
        : 'Link expired or already used', isHebrew));
    }

    if (new Date() > stored.expiresAt) {
      emailVerificationCodes.delete(email);
      linkTokenToEmail.delete(token);
      return res.status(400).send(renderLinkResultPage(false, isHebrew
        ? 'הקישור פג תוקף. בקשו קוד חדש.'
        : 'Link expired. Request a new code.', isHebrew));
    }

    stored.linkVerified = true;
    linkTokenToEmail.delete(token);

    logger.info('[Verification] Email verified via link', { email: email.slice(0, 3) + '***' });

    return res.send(renderLinkResultPage(true, isHebrew
      ? 'האימייל אומת בהצלחה! חזרו לאפליקציה להמשך.'
      : 'Email verified successfully! Return to the app to continue.', isHebrew));
  } catch (error: any) {
    logger.error('[Verification] Email link verify error', { error: error.message });
    return res.status(500).send(renderLinkResultPage(false, 'Something went wrong', false));
  }
});

router.post('/check-email-link-status', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ verified: false });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const stored = emailVerificationCodes.get(normalizedEmail);

    if (!stored) {
      return res.json({ verified: false });
    }

    if (stored.linkVerified) {
      emailVerificationCodes.delete(normalizedEmail);
      const verificationToken = issueEmailVerificationToken(normalizedEmail);

      logger.info('[Verification] Email link verification confirmed via poll', { email: normalizedEmail.slice(0, 3) + '***' });

      return res.json({
        verified: true,
        verificationToken,
      });
    }

    return res.json({ verified: false });
  } catch (error: any) {
    logger.error('[Verification] Check link status error', { error: error.message });
    return res.status(500).json({ verified: false });
  }
});

router.post('/verify-email-code', async (req: Request, res: Response, next) => {
  const { email, language = 'he' } = req.body;
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    const lockExpiry = emailLockouts.get(normalizedEmail);
    if (lockExpiry && Date.now() < lockExpiry) {
      const remainMin = Math.ceil((lockExpiry - Date.now()) / 60000);
      const isHebrew = language === 'he';
      return res.status(429).json({
        success: false,
        message: isHebrew
          ? `האימייל נעול. נסו שוב בעוד ${remainMin} דקות.`
          : `Email locked. Try again in ${remainMin} minutes.`,
        lockedUntil: lockExpiry,
      });
    }
  }
  next();
}, verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { email, code, language = 'he' } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();
    const isHebrew = language === 'he';

    if (!normalizedEmail || !code) {
      return res.status(400).json({ success: false, message: 'Email and code required' });
    }

    const stored = emailVerificationCodes.get(normalizedEmail);

    if (!stored) {
      return res.status(400).json({
        success: false,
        message: isHebrew ? 'לא נמצא קוד אימות. בקשו קוד חדש.' : 'No verification code found. Request a new one.',
      });
    }

    if (new Date() > stored.expiresAt) {
      emailVerificationCodes.delete(normalizedEmail);
      if (stored.linkToken) linkTokenToEmail.delete(stored.linkToken);
      return res.status(400).json({
        success: false,
        message: isHebrew ? 'קוד האימות פג תוקף. בקשו קוד חדש.' : 'Code expired. Request a new one.',
      });
    }

    if (stored.attempts >= MAX_EMAIL_ATTEMPTS) {
      emailVerificationCodes.delete(normalizedEmail);
      if (stored.linkToken) linkTokenToEmail.delete(stored.linkToken);
      emailLockouts.set(normalizedEmail, Date.now() + EMAIL_LOCKOUT_DURATION_MS);
      logger.warn('[Verification] Email max attempts reached, locking for 15min', { email: normalizedEmail.slice(0, 3) + '***' });
      return res.status(429).json({
        success: false,
        message: isHebrew ? 'חרגתם ממספר הניסיונות. נעול ל-15 דקות.' : 'Too many attempts. Locked for 15 minutes.',
        lockedUntil: Date.now() + EMAIL_LOCKOUT_DURATION_MS,
      });
    }

    const codeMatch = stored.code.length === code.length &&
      crypto.timingSafeEqual(Buffer.from(stored.code), Buffer.from(code));
    if (!codeMatch) {
      stored.attempts++;
      const remaining = MAX_EMAIL_ATTEMPTS - stored.attempts;
      return res.status(400).json({
        success: false,
        message: isHebrew ? `קוד שגוי. נותרו ${remaining} ניסיונות.` : `Invalid code. ${remaining} attempts remaining.`,
      });
    }

    emailVerificationCodes.delete(normalizedEmail);
    if (stored.linkToken) linkTokenToEmail.delete(stored.linkToken);

    const verificationToken = issueEmailVerificationToken(normalizedEmail);

    logger.info('[Verification] Email verified via code', { email: normalizedEmail.slice(0, 3) + '***' });

    return res.json({
      success: true,
      message: isHebrew ? 'אימייל אומת בהצלחה!' : 'Email verified successfully!',
      verificationToken,
    });
  } catch (error: any) {
    logger.error('[Verification] Email verify error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/send-sms-code', verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, language = 'he', captchaToken } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number required' });
    }

    if (!captchaToken) {
      logger.warn('[Verification] SMS send blocked — no captchaToken', { phone: phone.slice(0, 6) });
      return res.status(400).json({ success: false, message: 'Security verification required' });
    }

    const captchaResult = await verifyCaptchaToken(captchaToken, 'send_sms');
    if (!captchaResult.valid) {
      logger.warn('[Verification] SMS send blocked by reCAPTCHA', { phone: phone.slice(0, 6), reason: captchaResult.reason });
      return res.status(403).json({ success: false, message: 'Security check failed. Please refresh and try again.' });
    }

    const phoneCooldown = checkPhoneSmsCooldown(phone);
    if (phoneCooldown.blocked) {
      logger.warn('[Verification] SMS blocked — per-phone rate limit', { phone: phone.slice(0, 6) });
      return res.status(429).json({ success: false, message: phoneCooldown.message });
    }

    const lockResult = twilioSMSService.checkPhoneLockout(phone, language);
    if (lockResult) {
      return res.status(429).json(lockResult);
    }

    const result = await twilioSMSService.sendVerificationCode(phone, language);
    return res.json(result);
  } catch (error: any) {
    logger.error('[Verification] SMS code error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/verify-sms-code', async (req: Request, res: Response, next) => {
  const { phone, language = 'he' } = req.body;
  if (phone) {
    const lockResult = twilioSMSService.checkPhoneLockout(phone, language);
    if (lockResult) {
      return res.status(429).json(lockResult);
    }
  }
  next();
}, verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, code, language = 'he' } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and code required' });
    }

    const result = twilioSMSService.verifyCode(phone, code, language);
    if (!result.success && result.lockedUntil) {
      return res.status(429).json(result);
    }
    return res.json(result);
  } catch (error: any) {
    logger.error('[Verification] SMS verify error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/validate-tokens', async (req: Request, res: Response) => {
  try {
    const { emailToken, smsToken } = req.body;

    let emailValid = false;
    let emailAddress: string | undefined;
    let phoneValid = false;
    let phoneNumber: string | undefined;

    if (emailToken) {
      const check = peekEmailVerificationToken(emailToken);
      if (check.valid && check.email) {
        emailValid = true;
        emailAddress = check.email;
      }
    }

    if (smsToken) {
      const result = twilioSMSService.validateVerificationToken(smsToken);
      phoneValid = result.valid;
      phoneNumber = result.phone;
    }

    return res.json({
      success: emailValid && phoneValid,
      emailVerified: emailValid,
      phoneVerified: phoneValid,
      email: emailAddress,
      phone: phoneNumber,
    });
  } catch (error: any) {
    logger.error('[Verification] Token validation error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

function renderLinkResultPage(success: boolean, message: string, isHebrew: boolean): string {
  const dir = isHebrew ? 'rtl' : 'ltr';
  const title = success
    ? (isHebrew ? 'אימות הושלם' : 'Verification Complete')
    : (isHebrew ? 'שגיאה באימות' : 'Verification Failed');
  const icon = success ? '✓' : '✗';
  const iconColor = success ? '#16a34a' : '#dc2626';
  const iconBg = success ? '#dcfce7' : '#fee2e2';
  const closeText = isHebrew ? 'ניתן לסגור חלון זה' : 'You can close this window';

  return `
    <!DOCTYPE html>
    <html dir="${dir}" lang="${isHebrew ? 'he' : 'en'}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Pet Wash™</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .card { background: #fff; border-radius: 2px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 420px; width: 100%; overflow: hidden; text-align: center; }
        .header { background: linear-gradient(135deg, #1a1a1a, #2d2d2d); padding: 28px; }
        .header h1 { color: #c9a96e; font-size: 22px; font-weight: 600; letter-spacing: 0.5px; }
        .content { padding: 48px 32px; }
        .icon { width: 72px; height: 72px; border-radius: 50%; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 700; margin: 0 auto 24px; }
        .title { font-size: 20px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px; }
        .message { font-size: 15px; color: #666; line-height: 1.5; margin-bottom: 24px; }
        .close-hint { font-size: 12px; color: #aaa; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header"><h1>⁦Pet Wash™⁩</h1></div>
        <div class="content">
          <div class="icon">${icon}</div>
          <div class="title">${title}</div>
          <div class="message">${message}</div>
          <div class="close-hint">${closeText}</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function peekEmailVerificationToken(token: string): { valid: boolean; email?: string } {
  if (!token) return { valid: false };
  try {
    const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET || 'petwash-email-verify-fallback';
    const decoded = jwt.verify(token, secret) as { email?: string; type?: string };
    if (decoded.type !== 'email-verified' || !decoded.email) return { valid: false };
    return { valid: true, email: decoded.email };
  } catch {
    return { valid: false };
  }
}

export default router;
