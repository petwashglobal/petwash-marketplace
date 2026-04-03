import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { sendClubWelcomeEmail, sendLuxuryEmail } from '../email/luxury-email-service';
import { verifyCaptchaToken } from '../lib/verifyCaptcha';
import multer from 'multer';
import admin from '../lib/firebase-admin';
import crypto from 'crypto';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

// ── One-time table initialisation (runs at module load, not per-request) ───────
const _tableReady: Promise<void> = (async () => {
  try {
    // Backward compat: rename legacy table name if it exists
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vito_loyalty_members')
           AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'privilege_members') THEN
          ALTER TABLE vito_loyalty_members RENAME TO privilege_members;
        END IF;
      END $$
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS privilege_members (
        id SERIAL PRIMARY KEY,
        member_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50) NOT NULL,
        dob DATE,
        gender VARCHAR(30),
        country VARCHAR(100),
        city VARCHAR(100),
        address TEXT,
        pets JSONB DEFAULT '[]',
        id_type VARCHAR(50),
        id_number VARCHAR(100),
        id_document_url TEXT,
        id_verified BOOLEAN DEFAULT FALSE,
        referral_source VARCHAR(100),
        referral_code VARCHAR(100),
        marketing_consent BOOLEAN DEFAULT TRUE,
        sms_consent BOOLEAN DEFAULT TRUE,
        terms_consent BOOLEAN DEFAULT TRUE,
        terms_consent_at TIMESTAMPTZ DEFAULT NOW(),
        language VARCHAR(10) DEFAULT 'en',
        tier VARCHAR(20) DEFAULT 'bronze',
        points INTEGER DEFAULT 0,
        status VARCHAR(30) DEFAULT 'active',
        firebase_uid VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    logger.info('[Privilege] privilege_members table ready');
  } catch (err) {
    logger.error('[Privilege] Table init failed', err);
  }
})();

router.post('/register', upload.single('idDocument'), async (req: Request, res: Response) => {
  try {
    const {
      firstName, lastName, email, phone, dob, gender,
      country, city, address,
      pets, idType, idNumber,
      referralSource, referralCode,
      marketingConsent, smsConsent, termsConsent,
      language, captchaToken, traceId
    } = req.body;

    logger.info('[Privilege Register] Processing', { traceId, email });

    if (!firstName || !lastName || !email || !phone || !dob || !termsConsent) {
      return res.status(400).json({ error: 'Missing required fields', errorCode: 'MISSING_FIELDS' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address', errorCode: 'INVALID_EMAIL' });
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-()]/g, ''))) {
      return res.status(400).json({ error: 'Invalid phone number', errorCode: 'INVALID_PHONE' });
    }

    // ── reCAPTCHA verification (soft-fail: log score, only hard-block clear bots) ──
    if (captchaToken && captchaToken !== 'captcha_unavailable') {
      try {
        const captchaResult = await verifyCaptchaToken(captchaToken, 'privilege_register');
        logger.info('[Privilege] reCAPTCHA result', { traceId, valid: captchaResult.valid, score: captchaResult.score, source: captchaResult.source });
        // Hard-block only unambiguous bots (score < 0.1) in production
        if (!captchaResult.valid && captchaResult.score !== undefined && captchaResult.score < 0.1 && process.env.NODE_ENV === 'production') {
          return res.status(403).json({ error: 'Security verification failed. Please refresh and try again.', errorCode: 'CAPTCHA_FAILED' });
        }
      } catch (captchaErr) {
        logger.warn('[Privilege] reCAPTCHA verification error (non-blocking)', { captchaErr });
      }
    } else {
      logger.warn('[Privilege] No captcha token provided or captcha unavailable', { traceId, captchaToken: captchaToken || 'missing' });
    }

    // Ensure table is ready (module-level init already ran; this just awaits it)
    await _tableReady;

    const existingCheck = await db.execute(sql`
      SELECT id FROM privilege_members WHERE email = ${email.trim().toLowerCase()} LIMIT 1
    `);
    if (existingCheck.rows && existingCheck.rows.length > 0) {
      return res.status(409).json({ error: 'This email is already registered in PetWash Privilege', errorCode: 'ALREADY_REGISTERED' });
    }

    let idDocumentUrl: string | null = null;
    if (req.file) {
      try {
        const bucket = admin.storage().bucket(process.env.BIOMETRIC_BUCKET_NAME || 'signinpetwash.firebasestorage.app');
        const prefix = process.env.BIOMETRIC_PREFIX || 'privilege-id-documents';
        const ext = req.file.originalname.split('.').pop() || 'jpg';
        const hash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
        const fileName = `${prefix}/${hash}_${Date.now()}.${ext}`;
        const file = bucket.file(fileName);

        await file.save(req.file.buffer, {
          metadata: {
            contentType: req.file.mimetype,
            metadata: {
              uploadedBy: 'privilege-registration',
              email: email.trim().toLowerCase(),
              idType: idType || 'unknown',
            },
          },
        });

        idDocumentUrl = `gs://${bucket.name}/${fileName}`;
        logger.info('[Privilege] ID document uploaded', { fileName, size: req.file.size });
      } catch (uploadErr) {
        logger.error('[Privilege] ID document upload failed', uploadErr);
      }
    }

    let parsedPets: any[] = [];
    try {
      parsedPets = typeof pets === 'string' ? JSON.parse(pets) : (pets || []);
    } catch {
      parsedPets = [];
    }

    const memberId = `PWP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    await db.execute(sql`
      INSERT INTO privilege_members (
        member_id, first_name, last_name, email, phone, dob, gender,
        country, city, address, pets,
        id_type, id_number, id_document_url,
        referral_source, referral_code,
        marketing_consent, sms_consent, terms_consent,
        language
      ) VALUES (
        ${memberId},
        ${firstName.trim()},
        ${lastName.trim()},
        ${email.trim().toLowerCase()},
        ${phone.trim()},
        ${dob || null},
        ${gender || null},
        ${country || 'Israel'},
        ${city || null},
        ${address || null},
        ${JSON.stringify(parsedPets)}::jsonb,
        ${idType || null},
        ${idNumber || null},
        ${idDocumentUrl},
        ${referralSource || null},
        ${referralCode || null},
        ${marketingConsent === 'true' || marketingConsent === true},
        ${smsConsent === 'true' || smsConsent === true},
        ${termsConsent === 'true' || termsConsent === true},
        ${language || 'en'}
      )
    `);

    logger.info('[Privilege] New member registered', {
      memberId,
      email: email.trim().toLowerCase(),
      country: country || 'Israel',
      hasIdDocument: !!idDocumentUrl,
      petsCount: parsedPets.length,
    });

    // ── Gemini platform monitor ───────────────────────────────────────────────
    try {
      const { geminiPlatformMonitor } = await import('../services/GeminiPlatformSecurityMonitor');
      geminiPlatformMonitor.recordRegistration('prestige');
    } catch {}

    // ── FCM push notification to the new member (if they have an FCM token) ──
    try {
      const { FCMService } = await import('../services/FCMService');
      const firebaseUidForFCM = (req as any).user?.uid || null;
      if (firebaseUidForFCM) {
        const isHe = (language || 'en') === 'he';
        await FCMService.sendToUser({
          userId: firebaseUidForFCM,
          title: isHe ? '🐾 ברוך הבא ל-Prestige Club!' : '🐾 Welcome to Prestige Club!',
          body: isHe
            ? `היי ${firstName.trim()}, הצטרפת בהצלחה! מספר החבר שלך: ${memberId}`
            : `Hi ${firstName.trim()}, you're in! Your member ID: ${memberId}`,
          data: { memberId, tier: 'bronze', type: 'prestige_welcome', click_action: '/prestige' },
        });
        logger.info('[Privilege] Welcome push notification sent', { memberId, firebaseUidForFCM });
      }
    } catch (fcmErr) {
      logger.warn('[Privilege] FCM notification failed (non-blocking)', { fcmErr });
    }

    // ── EventBus: fire platform event for Octopus control panel ──────────────
    try {
      const { eventBus } = await import('../services/EventBus');
      await eventBus.publish({
        eventType: 'member.registered',
        timestamp: new Date().toISOString(),
        platform: 'prestige',
        data: {
          memberId,
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          country: country || 'Israel',
          tier: 'bronze',
          petsCount: parsedPets.length,
          hasIdDocument: !!idDocumentUrl,
          language: language || 'en',
        },
      });
      logger.info('[Privilege] EventBus member.registered fired', { memberId });
    } catch (busErr) {
      logger.warn('[Privilege] EventBus publish failed (non-blocking)', { busErr });
    }


    try {
      const memberLang = (language === 'he' ? 'he' : 'en') as 'he' | 'en';
      await sendClubWelcomeEmail(email.trim().toLowerCase(), firstName.trim(), {
        tier: 'bronze',
        points: 0,
        language: memberLang,
      });
      logger.info('[Privilege] Club welcome email sent', { email: email.trim().toLowerCase() });
    } catch (emailErr) {
      logger.error('[Privilege] Failed to send welcome email (non-blocking)', { emailErr });
    }

    // Notify admin of new Privilege registration
    try {
      const petsDisplay = Array.isArray(parsedPets) && parsedPets.length
        ? parsedPets.map((p: any) => `${p.name || '?'} (${p.type || '?'})`).join(', ')
        : 'None';
      const adminHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <div style="background:#1a1a1a;padding:24px;text-align:center">
            <h1 style="color:#c9a96e;font-size:22px;margin:0">🐾 Pet Wash™ Prestige — New Member Registration</h1>
          </div>
          <div style="padding:28px">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px">Member ID</td><td style="padding:8px 0;font-weight:bold">${memberId}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Name</td><td style="padding:8px 0">${firstName} ${lastName}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td><td style="padding:8px 0"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Phone</td><td style="padding:8px 0">${phone}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">City</td><td style="padding:8px 0">${city || '—'}, ${country || 'Israel'}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Date of Birth</td><td style="padding:8px 0">${dob || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Pets</td><td style="padding:8px 0">${petsDisplay}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">ID Type</td><td style="padding:8px 0">${idType || '—'} ${idNumber ? `(${idNumber})` : ''}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">ID Document</td><td style="padding:8px 0">${idDocumentUrl ? '✅ Uploaded' : '❌ Not uploaded'}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Referral</td><td style="padding:8px 0">${referralSource || '—'} ${referralCode ? `(code: ${referralCode})` : ''}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Language</td><td style="padding:8px 0">${language || 'en'}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Registered At</td><td style="padding:8px 0">${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} (Israel)</td></tr>
            </table>
            <div style="margin-top:20px;text-align:center">
              <a href="https://petwash.co.il/admin" style="display:inline-block;background:#c9a96e;color:#1a1a1a;padding:12px 28px;border-radius:4px;font-weight:bold;text-decoration:none;font-size:14px">View in Admin Dashboard →</a>
            </div>
          </div>
          <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#9ca3af">
            Pet Wash™ Prestige Club System · ח.פ. 517145033
          </div>
        </div>`;
      await sendLuxuryEmail({
        to: 'nirhadad1@gmail.com',
        subject: `[Pet Wash™ Prestige] New Member — ${firstName} ${lastName} (${memberId})`,
        html: adminHtml,
        from: { email: 'noreply@petwash.co.il', name: 'Pet Wash™ System' },
      });
      logger.info('[Privilege] Admin notification sent', { memberId });
    } catch (adminEmailErr) {
      logger.error('[Privilege] Failed to send admin notification', { adminEmailErr });
    }

    res.status(201).json({
      ok: true,
      memberId,
      message: 'Welcome to PetWash Privilege!',
    });
  } catch (error: any) {
    let errMsg: string;
    try {
      errMsg = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } catch { errMsg = String(error); }
    logger.error(`[Privilege] Registration failed: ${errMsg}`, { traceId: req.body?.traceId });
    if (errMsg?.includes('duplicate key') || errMsg?.includes('unique constraint')) {
      return res.status(409).json({ error: 'This email is already registered in PetWash Privilege', errorCode: 'ALREADY_REGISTERED' });
    }
    res.status(500).json({ error: 'Registration failed. Please try again.', errorCode: 'REGISTRATION_FAILED' });
  }
});

router.get('/check/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const result = await db.execute(sql`
      SELECT member_id, tier, status FROM privilege_members
      WHERE email = ${email.trim().toLowerCase()} LIMIT 1
    `);
    if (result.rows && result.rows.length > 0) {
      return res.json({ exists: true, member: result.rows[0] });
    }
    res.json({ exists: false });
  } catch (error) {
    res.status(500).json({ error: 'Check failed', errorCode: 'CHECK_FAILED' });
  }
});

export default router;
