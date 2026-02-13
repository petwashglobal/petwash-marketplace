import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { twilioSMSService } from '../services/TwilioSMSService';
import { EmailService } from '../emailService';
import { logger } from '../lib/logger';
import crypto from 'crypto';

const router = Router();

interface EmailVerificationCode {
  code: string;
  email: string;
  expiresAt: Date;
  attempts: number;
}

interface EmailVerificationToken {
  email: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}

const emailVerificationCodes = new Map<string, EmailVerificationCode>();
const emailVerificationTokens = new Map<string, EmailVerificationToken>();

const EMAIL_CODE_EXPIRY_MINUTES = 10;
const MAX_EMAIL_ATTEMPTS = 3;
const EMAIL_TOKEN_EXPIRY_MINUTES = 30;

const verificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification requests. Please wait 5 minutes.' },
});

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getEmailHtml(code: string, language: string): string {
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  const title = isHebrew ? 'קוד האימות שלך' : 'Your Verification Code';
  const subtitle = isHebrew
    ? 'הזינו את הקוד הבא כדי לאמת את כתובת האימייל שלכם'
    : 'Enter the following code to verify your email address';
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

router.post('/send-email-code', verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { email, language = 'he' } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const code = generateCode();
    const expiresAt = new Date(Date.now() + EMAIL_CODE_EXPIRY_MINUTES * 60 * 1000);

    emailVerificationCodes.set(normalizedEmail, {
      code,
      email: normalizedEmail,
      expiresAt,
      attempts: 0,
    });

    const isHebrew = language === 'he';
    const subject = isHebrew ? `⁦Pet Wash™⁩ - קוד אימות: ${code}` : `⁦Pet Wash™⁩ - Verification Code: ${code}`;

    const sent = await EmailService.send({
      to: normalizedEmail,
      subject,
      html: getEmailHtml(code, language),
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

router.post('/verify-email-code', verificationLimiter, async (req: Request, res: Response) => {
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
      return res.status(400).json({
        success: false,
        message: isHebrew ? 'קוד האימות פג תוקף. בקשו קוד חדש.' : 'Code expired. Request a new one.',
      });
    }

    if (stored.attempts >= MAX_EMAIL_ATTEMPTS) {
      emailVerificationCodes.delete(normalizedEmail);
      return res.status(400).json({
        success: false,
        message: isHebrew ? 'חרגתם ממספר הניסיונות. בקשו קוד חדש.' : 'Too many attempts. Request a new code.',
      });
    }

    if (stored.code !== code) {
      stored.attempts++;
      const remaining = MAX_EMAIL_ATTEMPTS - stored.attempts;
      return res.status(400).json({
        success: false,
        message: isHebrew ? `קוד שגוי. נותרו ${remaining} ניסיונות.` : `Invalid code. ${remaining} attempts remaining.`,
      });
    }

    emailVerificationCodes.delete(normalizedEmail);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + EMAIL_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    emailVerificationTokens.set(verificationToken, {
      email: normalizedEmail,
      token: verificationToken,
      expiresAt: tokenExpiry,
      used: false,
    });

    logger.info('[Verification] Email verified', { email: normalizedEmail.slice(0, 3) + '***' });

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
    const { phone, language = 'he' } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number required' });
    }

    const result = await twilioSMSService.sendVerificationCode(phone, language);
    return res.json(result);
  } catch (error: any) {
    logger.error('[Verification] SMS code error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/verify-sms-code', verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, code, language = 'he' } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and code required' });
    }

    const result = twilioSMSService.verifyCode(phone, code, language);
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
      const stored = emailVerificationTokens.get(emailToken);
      if (stored && !stored.used && new Date() <= stored.expiresAt) {
        emailValid = true;
        emailAddress = stored.email;
        stored.used = true;
        emailVerificationTokens.delete(emailToken);
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

export default router;
