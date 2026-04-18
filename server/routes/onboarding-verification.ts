import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { twilioSMSService } from '../services/TwilioSMSService';
import { EmailService } from '../emailService';
import { logger } from '../lib/logger';
import { verifyCaptchaToken } from '../lib/verifyCaptcha';
import crypto from 'crypto';
import { db } from '../db';
import { users } from '../../shared/schema';
import {
  markMobileVerified,
  markEmailVerified,
  getActivationState,
} from '../services/ActivationService';
import { buildActivationEmail } from '../lib/luxuryActivationEmail';
import { redis } from '../services/redis';

// ── Redis key helpers ────────────────────────────────────────────────────────
const K_EMAIL_CODE    = (e: string) => `email:verify:code:${e}`;
const K_LINK_TOKEN    = (t: string) => `email:verify:link:${t}`;
const K_EMAIL_LOCKOUT = (e: string) => `email:verify:lockout:${e}`;
const K_PHONE_RATE    = (p: string) => `sms:rate:${p}`;

// ── In-memory fallback Maps — used only when Redis is unavailable ─────────────
// These ensure the service still works on single-instance deployments without Redis.
// On multi-instance or after restart they cannot share state — Redis is the source
// of truth when available.
const _memEmailCodes    = new Map<string, { code: string; email: string; expiresAt: Date; attempts: number; linkToken: string; linkVerified: boolean }>();
const _memLinkTokens    = new Map<string, string>(); // linkToken → email
const _memEmailLockouts = new Map<string, number>();  // email → lockout expiry epoch ms
const _memPhoneRates    = new Map<string, number[]>(); // phone → send timestamps

const SMS_PER_PHONE_MAX = 3;
const SMS_PER_PHONE_WINDOW_MS = 60 * 60 * 1000;

async function checkPhoneSmsCooldown(phone: string): Promise<{ blocked: boolean; message: string }> {
  const now = Date.now();
  const windowSec = Math.floor(SMS_PER_PHONE_WINDOW_MS / 1000);

  // Redis primary path: use an incrementing counter per phone per hour window
  if (redis.isConnected()) {
    const key = K_PHONE_RATE(phone);
    const count = await redis.incr(key);
    if (count === 1) {
      // First send in window — set expiry
      await redis.expire(key, windowSec);
    }
    if (count > SMS_PER_PHONE_MAX) {
      const remainSec = await redis.ttl(key).catch(() => windowSec);
      const remainMin = Math.ceil(Math.max(remainSec, 0) / 60);
      return { blocked: true, message: `Too many SMS sent to this number. Please wait ${remainMin > 1 ? `${remainMin} minutes` : 'a moment'} before requesting again.` };
    }
    return { blocked: false, message: '' };
  }

  // Memory fallback
  const timestamps = (_memPhoneRates.get(phone) || []).filter(t => now - t < SMS_PER_PHONE_WINDOW_MS);
  if (timestamps.length >= SMS_PER_PHONE_MAX) {
    return { blocked: true, message: 'Too many SMS sent to this number. Please wait before requesting again.' };
  }
  timestamps.push(now);
  _memPhoneRates.set(phone, timestamps);
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

const EMAIL_CODE_EXPIRY_MINUTES = 5;
const MAX_EMAIL_ATTEMPTS = 5;
const EMAIL_TOKEN_EXPIRY_MINUTES = 30;
const EMAIL_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const EMAIL_LOCKOUT_DURATION_SEC = 15 * 60;

// ── Redis-backed email verification helpers ──────────────────────────────────

async function getEmailCode(email: string): Promise<EmailVerificationCode | null> {
  const redisEntry = await redis.get<EmailVerificationCode>(K_EMAIL_CODE(email)).catch(() => null);
  if (redisEntry) {
    return { ...redisEntry, expiresAt: new Date(redisEntry.expiresAt) };
  }
  // Memory fallback
  return _memEmailCodes.get(email) ?? null;
}

async function setEmailCode(email: string, entry: EmailVerificationCode): Promise<void> {
  const ttlSec = Math.ceil((entry.expiresAt.getTime() - Date.now()) / 1000);
  if (ttlSec <= 0) {
    // Entry has already expired — do not write it to Redis
    return;
  }
  const ok = await redis.set(K_EMAIL_CODE(email), entry, ttlSec).catch((err) => {
    logger.warn('[Verification] Redis set email code failed — using memory fallback', { email: email.slice(0, 3) + '***', error: String(err) });
    return false;
  });
  if (!ok) {
    logger.debug('[Verification] Redis unavailable — email code stored in memory only');
  }
  _memEmailCodes.set(email, entry); // memory fallback mirror
}

async function deleteEmailCode(email: string, linkToken?: string): Promise<void> {
  await redis.del(K_EMAIL_CODE(email)).catch((err) => {
    logger.warn('[Verification] Redis del email code failed', { email: email.slice(0, 3) + '***', error: String(err) });
  });
  _memEmailCodes.delete(email);
  if (linkToken) {
    await redis.del(K_LINK_TOKEN(linkToken)).catch((err) => {
      logger.warn('[Verification] Redis del link token failed', { error: String(err) });
    });
    _memLinkTokens.delete(linkToken);
  }
}

async function getLinkEmail(linkToken: string): Promise<string | null> {
  const redisEmail = await redis.getRaw(K_LINK_TOKEN(linkToken)).catch(() => null);
  if (redisEmail) return redisEmail;
  return _memLinkTokens.get(linkToken) ?? null;
}

async function setLinkToken(linkToken: string, email: string, ttlSec: number): Promise<void> {
  await redis.setRaw(K_LINK_TOKEN(linkToken), email, ttlSec).catch((err) => {
    logger.warn('[Verification] Redis set link token failed — using memory fallback', { error: String(err) });
  });
  _memLinkTokens.set(linkToken, email);
}

async function deleteLinkToken(linkToken: string): Promise<void> {
  await redis.del(K_LINK_TOKEN(linkToken)).catch((err) => {
    logger.warn('[Verification] Redis del link token failed', { error: String(err) });
  });
  _memLinkTokens.delete(linkToken);
}

async function getEmailLockout(email: string): Promise<number | null> {
  const redisTtl = await redis.ttl(K_EMAIL_LOCKOUT(email)).catch(() => -2);
  if (redisTtl > 0) return Date.now() + redisTtl * 1000;
  const memExpiry = _memEmailLockouts.get(email);
  if (memExpiry && Date.now() < memExpiry) return memExpiry;
  return null;
}

async function setEmailLockout(email: string): Promise<void> {
  await redis.setRaw(K_EMAIL_LOCKOUT(email), '1', EMAIL_LOCKOUT_DURATION_SEC).catch((err) => {
    logger.warn('[Verification] Redis set email lockout failed — using memory fallback', { email: email.slice(0, 3) + '***', error: String(err) });
  });
  _memEmailLockouts.set(email, Date.now() + EMAIL_LOCKOUT_DURATION_MS);
}

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
  const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET;
  if (!secret) throw new Error('Email verification secret not configured — set JWT_SECRET');
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

    if (!email || !/^[^@\s]{1,64}@[^@\s.]{1,63}(?:\.[^@\s.]{1,63})+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const lockExpiry = await getEmailLockout(normalizedEmail);
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
    const ttlSec = EMAIL_CODE_EXPIRY_MINUTES * 60;

    await setEmailCode(normalizedEmail, {
      code,
      email: normalizedEmail,
      expiresAt,
      attempts: 0,
      linkToken,
      linkVerified: false,
    });

    await setLinkToken(linkToken, normalizedEmail, ttlSec);

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
      return res.status(503).json({
        success: false,
        message: isHebrew
          ? 'שירות האימייל אינו זמין כרגע. נסו שוב מאוחר יותר.'
          : 'Email service temporarily unavailable. Please try again later.',
        retryAfter: 30,
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

    const email = await getLinkEmail(token);
    if (!email) {
      return res.status(400).send(renderLinkResultPage(false, isHebrew
        ? 'הקישור פג תוקף או כבר נעשה בו שימוש'
        : 'Link expired or already used', isHebrew));
    }

    const stored = await getEmailCode(email);
    if (!stored || stored.linkToken !== token) {
      await deleteLinkToken(token);
      return res.status(400).send(renderLinkResultPage(false, isHebrew
        ? 'הקישור פג תוקף או כבר נעשה בו שימוש'
        : 'Link expired or already used', isHebrew));
    }

    if (new Date() > stored.expiresAt) {
      await deleteEmailCode(email, token);
      return res.status(400).send(renderLinkResultPage(false, isHebrew
        ? 'הקישור פג תוקף. בקשו קוד חדש.'
        : 'Link expired. Request a new code.', isHebrew));
    }

    // Mark verified and clean up: delete the link token and the code entry.
    // The linkVerified flag is only needed for the polling path (/check-email-link-status).
    // We set it in a short-lived temp record so the poll can pick it up, then delete.
    // This prevents the same link from being used twice.
    stored.linkVerified = true;
    // Write back briefly so the polling endpoint can confirm within its next interval,
    // then schedule deletion after 30 seconds to cover the polling window.
    await setEmailCode(email, { ...stored, expiresAt: new Date(Date.now() + 30_000) });
    await deleteLinkToken(token);

    logger.info('[Verification] Email verified via link', { email: email.slice(0, 3) + '***' });

    // ── Write email_verified_at + advance activation state machine ──────────
    // Look up user by email and call markEmailVerified so DB is updated
    // immediately on link click — no second round-trip required.
    try {
      const [dbUser] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (dbUser) {
        await markEmailVerified(dbUser.id, { acceptTerms: true });
        logger.info('[Verification] email_verified_at written via link click', {
          userId: dbUser.id,
          email: email.slice(0, 3) + '***',
        });
      } else {
        logger.warn('[Verification] verify-email-link: no user found for email — DB write skipped', {
          email: email.slice(0, 3) + '***',
        });
      }
    } catch (dbErr: any) {
      // Non-fatal — in-memory flag still set, poll path remains as fallback
      logger.error('[Verification] verify-email-link DB write failed (non-fatal)', {
        email: email.slice(0, 3) + '***',
        error: dbErr.message,
      });
    }

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
    const stored = await getEmailCode(normalizedEmail);

    if (!stored) {
      return res.json({ verified: false });
    }

    if (stored.linkVerified) {
      await deleteEmailCode(normalizedEmail, stored.linkToken);
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
    const lockExpiry = await getEmailLockout(normalizedEmail);
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

    const stored = await getEmailCode(normalizedEmail);

    if (!stored) {
      return res.status(400).json({
        success: false,
        message: isHebrew ? 'לא נמצא קוד אימות. בקשו קוד חדש.' : 'No verification code found. Request a new one.',
      });
    }

    if (new Date() > stored.expiresAt) {
      await deleteEmailCode(normalizedEmail, stored.linkToken);
      return res.status(400).json({
        success: false,
        message: isHebrew ? 'קוד האימות פג תוקף. בקשו קוד חדש.' : 'Code expired. Request a new one.',
      });
    }

    if (stored.attempts >= MAX_EMAIL_ATTEMPTS) {
      await deleteEmailCode(normalizedEmail, stored.linkToken);
      await setEmailLockout(normalizedEmail);
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
      await setEmailCode(normalizedEmail, stored);
      const remaining = MAX_EMAIL_ATTEMPTS - stored.attempts;
      return res.status(400).json({
        success: false,
        message: isHebrew ? `קוד שגוי. נותרו ${remaining} ניסיונות.` : `Invalid code. ${remaining} attempts remaining.`,
      });
    }

    await deleteEmailCode(normalizedEmail, stored.linkToken);

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

    const phoneCooldown = await checkPhoneSmsCooldown(phone);
    if (phoneCooldown.blocked) {
      logger.warn('[Verification] SMS blocked — per-phone rate limit', { phone: phone.slice(0, 6) });
      return res.status(429).json({ success: false, message: phoneCooldown.message });
    }

    const lockResult = await twilioSMSService.checkPhoneLockout(phone, language);
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
    const lockResult = await twilioSMSService.checkPhoneLockout(phone, language);
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

    const result = await twilioSMSService.verifyCode(phone, code, language);
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
    const { emailToken, smsToken, userId } = req.body;

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

    // If userId provided, persist activation state to DB
    let activationState: Awaited<ReturnType<typeof getActivationState>> | null = null;
    if (userId && typeof userId === 'string') {
      try {
        if (phoneValid) {
          await markMobileVerified(userId);
        }
        if (emailValid) {
          await markEmailVerified(userId, { acceptTerms: true });
        }
        activationState = await getActivationState(userId);
      } catch (activationErr: any) {
        // Non-fatal — token validation result still returned
        logger.warn('[Verification] Activation write failed (non-fatal)', {
          userId,
          error: activationErr.message,
        });
      }
    }

    return res.json({
      success: emailValid && phoneValid,
      emailVerified: emailValid,
      phoneVerified: phoneValid,
      email: emailAddress,
      phone: phoneNumber,
      ...(activationState ? {
        activationStatus: activationState.activationStatus,
        isFullyActive: activationState.isFullyActive,
        accountActivatedAt: activationState.accountActivatedAt,
        missingSteps: activationState.missingSteps,
      } : {}),
    });
  } catch (error: any) {
    logger.error('[Verification] Token validation error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/onboarding-verification/activation-status?userId=xxx
router.get('/activation-status', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ success: false, message: 'userId required' });
    }
    const state = await getActivationState(userId);
    return res.json({ success: true, ...state });
  } catch (error: any) {
    logger.error('[Verification] Activation status error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/onboarding-verification/send-activation-email
// Sends the luxury PetWash™ activation email to a user
router.post('/send-activation-email', async (req: Request, res: Response) => {
  try {
    const { userId, email, firstName, language = 'en' } = req.body;
    if (!email || !firstName) {
      return res.status(400).json({ success: false, message: 'email and firstName required' });
    }

    // Build activation link (re-uses existing email verification flow)
    // We create a verification token and send the email
    const baseUrl = (() => {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers['host'] || req.hostname;
      return `${proto}://${host}`;
    })();

    // Issue a link token for this email
    const linkToken = crypto.randomBytes(32).toString('hex');
    const verifyUrl = `${baseUrl}/api/onboarding-verification/verify-email-link?token=${linkToken}&lang=${language}`;

    // Store the email code using the Redis-backed helper (same mechanism as send-email-code).
    // 24h TTL for activation links.
    const normalizedEmail = email.toLowerCase().trim();
    const emailCode = {
      code: String(Math.floor(100000 + crypto.randomInt(900000))),
      email: normalizedEmail,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      attempts: 0,
      linkToken,
      linkVerified: false,
    };
    await setEmailCode(normalizedEmail, emailCode);
    await setLinkToken(linkToken, normalizedEmail, 24 * 60 * 60);

    // Update last sent timestamp in DB if userId provided
    if (userId && typeof userId === 'string') {
      try {
        await db.update(users)
          .set({ lastActivationEmailSentAt: new Date() })
          .where(eq(users.id, userId));
      } catch { /* non-fatal */ }
    }

    // Build and send luxury email
    const { subject, html } = buildActivationEmail({
      firstName,
      activationUrl: verifyUrl,
      language: language as 'he' | 'en',
    });

    await EmailService.send({ to: normalizedEmail, subject, html });

    logger.info('[Verification] Luxury activation email sent', {
      email: normalizedEmail.slice(0, 3) + '***',
      userId,
    });

    return res.json({ success: true });
  } catch (error: any) {
    logger.error('[Verification] Send activation email error', { error: error.message });
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
    const secret = process.env.JWT_SECRET || process.env.COOKIE_SECRET;
    if (!secret) return { valid: false };
    const decoded = jwt.verify(token, secret) as { email?: string; type?: string };
    if (decoded.type !== 'email-verified' || !decoded.email) return { valid: false };
    return { valid: true, email: decoded.email };
  } catch {
    return { valid: false };
  }
}

export default router;
