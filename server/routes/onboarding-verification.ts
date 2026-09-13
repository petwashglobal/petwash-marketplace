import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { eq, sql } from 'drizzle-orm';
import { twilioSMSService } from '../services/TwilioSMSService';
import { EmailService } from '../emailService';
import { logger } from '../lib/logger';
import { verifyCaptchaToken } from '../lib/verifyCaptcha';
import { verifyTurnstileToken } from '../lib/verifyTurnstile';
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
import { reserveOtpAttempt } from '../lib/otpAttemptReservation';
import { consumeOneShotProof } from '../lib/oneShotProof';

/**
 * How long a spent email-proof marker must live. The email verification JWT is
 * minted with a 10-minute life elsewhere in this file; the marker is sized to
 * outlive it (oneShotProof adds its own clock-skew slack on top).
 */
const EMAIL_PROOF_ONE_SHOT_TTL_SECONDS = 15 * 60;

/** Contacts compare normalised, so casing or spacing is never a mismatch. */
function normaliseEmail(e: string | null | undefined): string {
  return (e ?? '').trim().toLowerCase();
}

/**
 * E.164-ish comparison key. Deliberately lossy-but-consistent: both sides of
 * every comparison go through it, so '+972-50 123' and '+97250123' are ONE
 * number rather than two, and a stored local-format value cannot masquerade as
 * a different subscriber.
 */
function normalisePhone(p: string | null | undefined): string {
  const raw = (p ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? `+${digits}` : '';
}

// ── Auth helper — derive the current user from Bearer OR pw_session cookie ────
// Never trust a request-body / query-string userId for anything that returns
// user-scoped state; the previous /activation-status accepted ?userId=x from
// any caller. Mirrors the pattern used by publicAuthRoutes.getFirebaseUserFromRequest,
// scoped locally so this route file has no extra shared-module coupling. Returns
// null on any auth failure — the route decides whether to 401 or fall through.
async function resolveActivationUid(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.authorization;
    const sessionCookie = (req as any).cookies?.pw_session;
    if (!authHeader?.startsWith('Bearer ') && !sessionCookie) return null;
    const { auth: fbAdmin } = await import('../lib/firebase-admin');
    let decoded: any = null;
    if (authHeader?.startsWith('Bearer ')) {
      decoded = await fbAdmin.verifyIdToken(authHeader.substring(7), true);
    } else if (sessionCookie) {
      decoded = await fbAdmin.verifySessionCookie(sessionCookie, true);
    }
    return decoded?.uid ?? null;
  } catch (err) {
    logger.debug('[Verification] resolveActivationUid failed', { error: (err as any)?.message });
    return null;
  }
}

// ── Redis key helpers ────────────────────────────────────────────────────────
const K_EMAIL_CODE    = (e: string) => `email:verify:code:${e}`;
const K_LINK_TOKEN    = (t: string) => `email:verify:link:${t}`;
const K_EMAIL_LOCKOUT = (e: string) => `email:verify:lockout:${e}`;
const K_EMAIL_ATTEMPTS = (e: string) => `email:verify:attempts:${e}`;
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
  // The attempt counter dies with the code it was counting (see reserveOtpAttempt).
  await redis.del(K_EMAIL_ATTEMPTS(email)).catch(() => {});
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
              <h1 style="margin:0;color:#c9a96e;font-size:24px;font-weight:600;letter-spacing:0.5px;">⁦PetWash™⁩</h1>
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
    // A new code starts with a clean attempt budget (see reserveOtpAttempt).
    await redis.del(K_EMAIL_ATTEMPTS(normalizedEmail)).catch(() => {});

    await setLinkToken(linkToken, normalizedEmail, ttlSec);

    const baseUrl = getBaseUrl(req);
    const verifyLinkUrl = `${baseUrl}/api/onboarding-verification/verify-email-link?token=${linkToken}&lang=${language}`;

    const subject = isHebrew ? `⁦PetWash™⁩ - קוד אימות` : `⁦PetWash™⁩ - Verification Code`;

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

    // Write back a short-lived (30s) record with linkVerified=true so the polling endpoint
    // (/check-email-link-status) can confirm within its next poll interval.
    // Create a new object — do not mutate `stored` — then delete after polling window passes.
    await setEmailCode(email, { ...stored, linkVerified: true, expiresAt: new Date(Date.now() + 30_000) });
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

    // SECURITY 2026-09-13: reserve the attempt atomically BEFORE comparing. The
    // blob's `attempts` is read-then-written and cannot bound parallel guesses.
    // Only when Redis is connected — with no Redis the code lives in this process's
    // memory fallback, which is single-instance by definition.
    let reservedAttempt: number | null = null;
    if (redis.isConnected()) {
      const ttlSec = Math.max(1, Math.ceil((stored.expiresAt.getTime() - Date.now()) / 1000));
      const reservation = await reserveOtpAttempt(redis, K_EMAIL_ATTEMPTS(normalizedEmail), MAX_EMAIL_ATTEMPTS, ttlSec);
      if (!reservation.ok) {
        if (reservation.reason === 'exhausted') {
          await deleteEmailCode(normalizedEmail, stored.linkToken);
          await setEmailLockout(normalizedEmail);
          logger.warn('[Verification] Email attempt budget exhausted, locking for 15min', { email: normalizedEmail.slice(0, 3) + '***' });
          return res.status(429).json({
            success: false,
            message: isHebrew ? 'חרגתם ממספר הניסיונות. נעול ל-15 דקות.' : 'Too many attempts. Locked for 15 minutes.',
            lockedUntil: Date.now() + EMAIL_LOCKOUT_DURATION_MS,
          });
        }
        // Could not reserve → fail CLOSED, never compare a code we cannot count.
        logger.error('[Verification] Could not reserve an email-code attempt — refusing to compare', { email: normalizedEmail.slice(0, 3) + '***' });
        return res.status(503).json({
          success: false,
          message: isHebrew ? 'לא ניתן לאמת כרגע. נסו שוב בעוד רגע.' : 'Could not verify right now. Please try again in a moment.',
        });
      }
      reservedAttempt = reservation.attempt;
    }

    const codeMatch = stored.code.length === code.length &&
      crypto.timingSafeEqual(Buffer.from(stored.code), Buffer.from(code));
    if (!codeMatch) {
      stored.attempts = reservedAttempt !== null ? Math.max(stored.attempts + 1, reservedAttempt) : stored.attempts + 1;
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

    // ── PERSIST email_verified (2026-07-25 wiring fix) ──────────────────────
    // The code path validated the OTP but never wrote emailVerified to the user
    // record / activation state machine — only the LINK path did. Result: the UI
    // showed "verified ✓" while users.emailVerified stayed false ("sort of
    // working, didn't verify fully"). Mirror the link path so the code path
    // actually completes verification. Non-fatal — never fail a valid code.
    try {
      const [dbUser] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);
      if (dbUser) {
        await markEmailVerified(dbUser.id, { acceptTerms: true });
        logger.info('[Verification] email_verified_at written via code', { userId: dbUser.id });
      } else {
        logger.warn('[Verification] verify-email-code: no user row for email yet — DB write skipped (token still returned)');
      }
    } catch (dbErr: any) {
      logger.error('[Verification] verify-email-code DB write failed (non-fatal)', { error: dbErr?.message });
    }

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
    const { phone, language = 'he', captchaToken, turnstileToken } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number required' });
    }

    // Bot gate — Turnstile is the canonical check (Cloudflare, free, no Enterprise/
    // domain tangle). Legacy reCAPTCHA tokens are still accepted during migration so
    // no client breaks; once all callers send Turnstile, reCAPTCHA can be retired.
    if (turnstileToken) {
      const ts = await verifyTurnstileToken(turnstileToken, req.ip);
      if (!ts.valid) {
        logger.warn('[Verification] SMS send blocked by Turnstile', { phone: phone.slice(0, 6), reason: ts.reason });
        return res.status(403).json({ success: false, message: 'Security check failed. Please refresh and try again.' });
      }
    } else if (captchaToken) {
      const captchaResult = await verifyCaptchaToken(captchaToken, 'send_sms');
      if (!captchaResult.valid) {
        logger.warn('[Verification] SMS send blocked by reCAPTCHA (legacy)', { phone: phone.slice(0, 6), reason: captchaResult.reason });
        return res.status(403).json({ success: false, message: 'Security check failed. Please refresh and try again.' });
      }
    } else {
      logger.warn('[Verification] SMS send blocked — no bot-check token', { phone: phone.slice(0, 6) });
      return res.status(400).json({ success: false, message: 'Security verification required' });
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

    // ── PERSIST phone_verified (2026-07-25 wiring fix) ──────────────────────
    // Twilio confirmed the code, but the endpoint never wrote phoneVerified to
    // the user record / activation state machine — so the mobile "verified ✓" in
    // the UI didn't stick and the account stayed unverified. Look the user up by
    // phone and complete the verification. Non-fatal — never fail a valid code.
    if (result.success) {
      try {
        // Match on the last 9 digits of the digits-only phone so a stored
        // "+972501234567" still matches an incoming "0501234567" (and vice
        // versa) — country-code / prefix differences must not break the write.
        const last9 = String(phone).replace(/\D/g, '').slice(-9);
        const rows = last9.length === 9
          ? await db.select({ id: users.id }).from(users)
              .where(sql`right(regexp_replace(${users.phone}, '[^0-9]', '', 'g'), 9) = ${last9}`)
              .limit(1)
          : await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
        const dbUser = rows[0];
        if (dbUser) {
          await markMobileVerified(dbUser.id);
          logger.info('[Verification] mobile_verified_at written via code', { userId: dbUser.id });
        } else {
          logger.warn('[Verification] verify-sms-code: no user row for phone yet — DB write skipped');
        }
      } catch (dbErr: any) {
        logger.error('[Verification] verify-sms-code DB write failed (non-fatal)', { error: dbErr?.message });
      }
    }

    return res.json(result);
  } catch (error: any) {
    logger.error('[Verification] SMS verify error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/onboarding-verification/validate-tokens
 *
 * SECURITY REWRITE 2026-09-08. This route MUTATES verified identity state, and
 * it used to decide whose state to mutate from a `userId` in the request body,
 * on a mount that has no authentication. A verification token answers exactly
 * one question — "does the bearer control THIS phone / THIS email?" — and says
 * nothing about WHICH ACCOUNT that applies to. The route treated the two as the
 * same fact, so an attacker's own valid token plus a victim's UID mutated the
 * victim.
 *
 * It was never a decorative flag either: markMobileVerified / markEmailVerified
 * run computeStatus(), and with AUTH_REQUIRE_BOTH_CONTACTS unset (production,
 * verified 2026-09-08) ONE verified contact yields 'active' — stamping
 * accountActivatedAt and firing _onFullActivation: wallet seeding, a loyalty
 * profile with a 100-point join bonus, and domain events.
 *
 * The sibling GET /activation-status on this very file had already been fixed
 * for the read side of this exact defect (PR-AUTH-CONTACTS-3). The write side
 * was missed.
 *
 * FOUR THINGS ARE NOW TRUE, in this order:
 *
 *   1. AUTHENTICATED. The subject is derived from the verified Firebase token
 *      or pw_session cookie. A body `userId` carries NO authority; if it
 *      disagrees with the authenticated subject the request is refused rather
 *      than quietly acted on, so a stale client fails loudly.
 *
 *   2. BOUND. The verified contact must belong to THIS account. Authentication
 *      alone is not enough — being signed in as yourself does not entitle you
 *      to mark someone else's phone as your verified one. An account with no
 *      phone on file may attach the verified number, subject to a uniqueness
 *      check, which is how the activation journey legitimately adds a mobile.
 *
 *   3. ONE-USE. This is a mutation boundary, not an inspection. Inspection may
 *      be replayed across a multi-step journey; authority to mutate may not.
 *      The proof is burned through the shared one-shot store BEFORE the write,
 *      and an unreachable store fails CLOSED (503, no mutation).
 *
 *   4. NOT CONSENT. markEmailVerified no longer receives { acceptTerms: true }.
 *      Controlling an email address proves control of that address. It is not
 *      an affirmative agreement to the Terms, and it must not write
 *      acceptedTermsAt. Terms acceptance needs its own explicit act, with a
 *      version and its own evidence.
 *
 * STILL OWED (deliberately not built here): the phone binding is enforced at
 * REDEMPTION, not at issuance. The stronger shape is a server-recorded pending
 * phone-change target bound to the UID when the challenge is created. That is a
 * flow change, and this is the security fix.
 */
router.post('/validate-tokens', async (req: Request, res: Response) => {
  try {
    // 1. WHO — from the verified session only, never the body.
    const uid = await resolveActivationUid(req);
    if (!uid) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required' });
    }

    const { emailToken, smsToken, userId: bodyUserId } = req.body || {};
    if (bodyUserId && typeof bodyUserId === 'string' && bodyUserId !== uid) {
      logger.warn('[Verification] validate-tokens body userId != authenticated subject — refused', { uid });
      return res.status(403).json({
        success: false, code: 'SUBJECT_MISMATCH',
        message: 'This verification does not belong to the signed-in account.',
      });
    }

    if (!emailToken && !smsToken) {
      return res.status(400).json({ success: false, code: 'NO_TOKEN', message: 'A verification token is required' });
    }

    const [account] = await db
      .select({ id: users.id, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    if (!account) {
      return res.status(404).json({ success: false, code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    }

    let emailValid = false;
    let emailAddress: string | undefined;
    let phoneValid = false;
    let phoneNumber: string | undefined;
    let phoneToAttach: string | null = null;

    // 2. BIND — the proof must be about THIS account's contact.
    if (emailToken) {
      const check = peekEmailVerificationToken(emailToken);
      if (!check.valid || !check.email) {
        return res.status(401).json({ success: false, code: 'VERIFICATION_INVALID', message: 'Email verification is invalid or expired' });
      }
      const proved = normaliseEmail(check.email);
      const onFile = normaliseEmail(account.email);
      if (!onFile || onFile !== proved) {
        logger.warn('[Verification] email proof does not match the account on file — refused', { uid });
        return res.status(403).json({
          success: false, code: 'CONTACT_MISMATCH',
          message: 'That verification is for a different email address.',
        });
      }
      emailValid = true;
      emailAddress = proved;
    }

    if (smsToken) {
      const result = twilioSMSService.validateVerificationToken(smsToken);
      if (!result.valid || !result.phone) {
        return res.status(401).json({ success: false, code: 'VERIFICATION_INVALID', message: 'Mobile verification is invalid or expired' });
      }
      const proved = normalisePhone(result.phone);
      const onFile = normalisePhone(account.phone);
      if (onFile) {
        if (onFile !== proved) {
          logger.warn('[Verification] phone proof does not match the account on file — refused', { uid });
          return res.status(403).json({
            success: false, code: 'CONTACT_MISMATCH',
            message: 'That verification is for a different mobile number.',
          });
        }
      } else {
        // No phone on file: attaching the verified number IS the activation
        // journey. Still refuse a number that already belongs to someone else,
        // or one account could claim another's identifier.
        const [taken] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.phone, proved))
          .limit(1);
        if (taken && taken.id !== uid) {
          return res.status(409).json({
            success: false, code: 'PHONE_IN_USE',
            message: 'This mobile number is already linked to another account.',
          });
        }
        phoneToAttach = proved;
      }

      // 3. ONE-USE — burn before the write. A replay is 401; a store we cannot
      //    reach is 503 and changes nothing.
      const burn = await twilioSMSService.consumeVerificationNonce(result.nonce || '');
      if (!burn.ok) {
        const unavailable = burn.reason === 'store_unavailable';
        logger.warn('[Verification] mobile proof refused at the mutation boundary', { uid, reason: burn.reason });
        return res.status(unavailable ? 503 : 401).json({
          success: false,
          code: unavailable ? 'VERIFICATION_UNAVAILABLE' : 'VERIFICATION_ALREADY_USED',
          message: unavailable
            ? 'Could not complete verification right now — please try again in a moment.'
            : 'This verification was already used — request a new code.',
        });
      }
      phoneValid = true;
      phoneNumber = proved;
    }

    if (emailToken && emailValid) {
      // The email proof JWT carries no nonce, so it is burned by content hash:
      // unique per distinct token, and two identical strings ARE the same
      // credential. Same fail-closed rules as every other proof.
      const burn = await consumeOneShotProof({
        scope: 'emailverifyjwt',
        id: crypto.createHash('sha256').update(String(emailToken)).digest('hex'),
        ttlSeconds: EMAIL_PROOF_ONE_SHOT_TTL_SECONDS,
        context: { route: 'validate-tokens' },
      });
      if (!burn.ok) {
        const unavailable = burn.reason === 'store_unavailable';
        logger.warn('[Verification] email proof refused at the mutation boundary', { uid, reason: burn.reason });
        return res.status(unavailable ? 503 : 401).json({
          success: false,
          code: unavailable ? 'VERIFICATION_UNAVAILABLE' : 'VERIFICATION_ALREADY_USED',
          message: unavailable
            ? 'Could not complete verification right now — please try again in a moment.'
            : 'This verification was already used — request a new code.',
        });
      }
    }

    // 4. ATTACH — write the attested number where the rest of the platform
    //    actually reads it. Persisting only users.phone left the two stores
    //    disagreeing: Firebase owns the phone identifier, and POST
    //    /api/auth/phone-session resolves the account through
    //    fbAdminAuth.getUserByPhoneNumber(). An email-first member (Google /
    //    Apple / email signup, which is exactly the population
    //    AccountActivation serves — it prompts for a number because
    //    user.phoneNumber is null) finished activation with phone_verified
    //    true and users.phone set, while their Firebase record still had NO
    //    phone. Signing in by that number then missed them, took the
    //    new-user branch, and minted a SECOND account for the same person —
    //    their wallet, loyalty and history stranded on the first one.
    //
    //    Firebase is also the AUTHORITATIVE uniqueness check. The SELECT above
    //    is a courtesy that races; updateUser is atomic and yields the same
    //    409 PHONE_IN_USE the sibling routes return, so a raw UPDATE can no
    //    longer inherit a bare unique-constraint 500 on users.phone.
    //
    //    The attach lives HERE, in the route, and NOT inside
    //    markMobileVerified: the service takes a userId and no contact, and
    //    its other callers (verify-signup-mobile, phone-session,
    //    authBootstrap, verify-sms-code) have each already written the
    //    contact — or derived the account FROM it — before calling. Only the
    //    caller holds the proof that says which number may be attached; a
    //    service-side write would be guessing at one.
    //
    //    Email needs no equivalent: the binding above requires the proved
    //    address to already equal users.email, so there is never an address
    //    to attach on this route.
    if (phoneToAttach) {
      const { auth: fbAdmin } = await import('../lib/firebase-admin');
      try {
        await fbAdmin.updateUser(uid, { phoneNumber: phoneToAttach });
      } catch (attachErr: any) {
        if (attachErr?.code === 'auth/phone-number-already-exists') {
          // "Already exists" does NOT mean "belongs to someone else". This
          // route returns between the two stores, so a Firebase-succeeded /
          // Postgres-failed attempt leaves the number on THIS uid's Firebase
          // record with no flag flipped and no users.phone. The member
          // retries — and if Identity Toolkit raises rather than no-ops when
          // the same uid re-sets the same number, a blind 409 would tell them
          // their OWN number belongs to another account and wedge them out of
          // activation permanently.
          //
          // Whether it no-ops is decided server-side and is not knowable from
          // the SDK, so do not depend on the answer: ASK who owns the number.
          // Firebase is the right store to ask — in exactly this failure mode
          // users.phone is still NULL, so re-reading Postgres would find
          // nothing and confirm the wrong thing.
          let ownerUid: string | null = null;
          try {
            ownerUid = (await fbAdmin.getUserByPhoneNumber(phoneToAttach))?.uid ?? null;
          } catch (probeErr: any) {
            logger.error('[Verification] phone ownership probe FAILED', { uid, code: probeErr?.code, error: probeErr?.message });
          }
          if (!ownerUid) {
            // Ownership NOT established — the probe was unreadable, or it
            // contradicted itself (auth/user-not-found: Firebase said the
            // number exists, then said nobody holds it — a delete/merge race).
            // Either way we have not shown the number belongs to someone else,
            // so we do not say so. "Try again" is the only honest answer, and
            // it is retryable where the 409 is terminal.
            logger.warn('[Verification] phone ownership unresolved — not claiming it is taken', { uid });
            return res.status(500).json({
              success: false, code: 'PHONE_ATTACH_FAILED',
              message: 'Your mobile was verified but could not be linked to your account. Please try again.',
            });
          }
          if (ownerUid !== uid) {
            logger.warn('[Verification] phone attach refused — number belongs to another account', { uid });
            return res.status(409).json({
              success: false, code: 'PHONE_IN_USE',
              message: 'This mobile number is already linked to another account.',
            });
          }
          // Already attached to THIS account — the retry case. Fall through and
          // finish the half of the job that did not land.
          logger.info('[Verification] phone already attached to this account — healing', { uid });
        } else {
          logger.error('[Verification] phone attach FAILED', { uid, error: attachErr?.message });
          return res.status(500).json({
            success: false, code: 'PHONE_ATTACH_FAILED',
            message: 'Your mobile was verified but could not be linked to your account. Please try again.',
          });
        }
      }

      // Firebase has accepted the number, so a UNIQUE violation here means a
      // stale users row holds it with no matching Firebase record — drift,
      // not a legitimate second owner. Say 409, never a raw constraint 500.
      try {
        await db.update(users).set({ phone: phoneToAttach }).where(eq(users.id, uid));
      } catch (dbErr: any) {
        const unique = String(dbErr?.code) === '23505' || /unique|duplicate key/i.test(dbErr?.message || '');
        logger.error('[Verification] phone persist FAILED', { uid, unique, error: dbErr?.message });
        return res.status(unique ? 409 : 500).json({
          success: false,
          code: unique ? 'PHONE_IN_USE' : 'PHONE_ATTACH_FAILED',
          message: unique
            ? 'This mobile number is already linked to another account.'
            : 'Your mobile was verified but could not be linked to your account. Please try again.',
        });
      }
    }

    // 5. MUTATE — only now, and only ever on the authenticated subject.
    //    A failed write is NOT reported as success; the previous code swallowed
    //    it as "non-fatal" and answered 200 for a change that never landed.
    let activationState: Awaited<ReturnType<typeof getActivationState>> | null = null;
    try {
      if (phoneValid) {
        await markMobileVerified(uid);
      }
      if (emailValid) {
        // NO acceptTerms. Possession of an address is not consent to the Terms.
        await markEmailVerified(uid);
      }
      activationState = await getActivationState(uid);
    } catch (activationErr: any) {
      logger.error('[Verification] Activation write FAILED', { uid, error: activationErr?.message });
      return res.status(500).json({
        success: false, code: 'ACTIVATION_WRITE_FAILED',
        message: 'Verification succeeded but your account could not be updated. Please try again.',
      });
    }

    return res.json({
      success: true,
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

// GET /api/onboarding-verification/activation-status
// Returns the current user's activation state. Auth-derived only — the previous
// ?userId=xxx query variant let any caller read any user's verification state
// (an enumeration + PII disclosure defect). Accepts a Bearer id token OR the
// pw_session cookie so the AccountActivation page + ActivationBanner can query
// with the same header the rest of the client uses. (PR-AUTH-CONTACTS-3)
router.get('/activation-status', async (req: Request, res: Response) => {
  try {
    const uid = await resolveActivationUid(req);
    if (!uid) return res.status(401).json({ success: false, message: 'Authentication required' });
    const state = await getActivationState(uid);
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
      <title>${title} - PetWash™</title>
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
        <div class="header"><h1>⁦PetWash™⁩</h1></div>
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
