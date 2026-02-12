import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import multer from 'multer';
import admin from 'firebase-admin';
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
      language, captchaToken
    } = req.body;

    if (!firstName || !lastName || !email || !phone || !dob || !termsConsent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-()]/g, ''))) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vito_loyalty_members (
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
      SELECT id FROM vito_loyalty_members WHERE email = ${email.trim().toLowerCase()} LIMIT 1
    `);
    if (existingCheck.rows && existingCheck.rows.length > 0) {
      return res.status(409).json({ error: 'This email is already registered in the Vito™ Club' });
    }

    let idDocumentUrl: string | null = null;
    if (req.file) {
      try {
        const bucket = admin.storage().bucket(process.env.BIOMETRIC_BUCKET_NAME || 'signinpetwash.firebasestorage.app');
        const prefix = process.env.BIOMETRIC_PREFIX || 'vito-id-documents';
        const ext = req.file.originalname.split('.').pop() || 'jpg';
        const hash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
        const fileName = `${prefix}/${hash}_${Date.now()}.${ext}`;
        const file = bucket.file(fileName);

        await file.save(req.file.buffer, {
          metadata: {
            contentType: req.file.mimetype,
            metadata: {
              uploadedBy: 'vito-loyalty-registration',
              email: email.trim().toLowerCase(),
              idType: idType || 'unknown',
            },
          },
        });

        idDocumentUrl = `gs://${bucket.name}/${fileName}`;
        logger.info('[Vito] ID document uploaded', { fileName, size: req.file.size });
      } catch (uploadErr) {
        logger.error('[Vito] ID document upload failed', { error: uploadErr });
      }
    }

    let parsedPets: any[] = [];
    try {
      parsedPets = typeof pets === 'string' ? JSON.parse(pets) : (pets || []);
    } catch {
      parsedPets = [];
    }

    const memberId = `VITO-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    await db.execute(sql`
      INSERT INTO vito_loyalty_members (
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

    logger.info('[Vito] New member registered', {
      memberId,
      email: email.trim().toLowerCase(),
      country: country || 'Israel',
      hasIdDocument: !!idDocumentUrl,
      petsCount: parsedPets.length,
    });

    res.status(201).json({
      ok: true,
      memberId,
      message: 'Welcome to the Vito™ Family!',
    });
  } catch (error: any) {
    let errMsg: string;
    try {
      errMsg = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } catch { errMsg = String(error); }
    logger.error(`[Vito] Registration failed: ${errMsg}`);
    if (errMsg?.includes('duplicate key') || errMsg?.includes('unique constraint')) {
      return res.status(409).json({ error: 'This email is already registered in the Vito™ Club' });
    }
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.get('/check/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const result = await db.execute(sql`
      SELECT member_id, tier, status FROM vito_loyalty_members
      WHERE email = ${email.trim().toLowerCase()} LIMIT 1
    `);
    if (result.rows && result.rows.length > 0) {
      return res.json({ exists: true, member: result.rows[0] });
    }
    res.json({ exists: false });
  } catch (error) {
    res.status(500).json({ error: 'Check failed' });
  }
});

export default router;
