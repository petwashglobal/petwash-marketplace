import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { sendClubWelcomeEmail } from '../email/luxury-email-service';
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

    // Backward compatibility: rename old table if it exists, otherwise create new one
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

    try {
      const { geminiPlatformMonitor } = await import('../services/GeminiPlatformSecurityMonitor');
      geminiPlatformMonitor.recordRegistration('prestige');
    } catch {}


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
