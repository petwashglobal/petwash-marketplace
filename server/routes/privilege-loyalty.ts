import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { sendClubWelcomeEmail, sendLuxuryEmail } from '../email/luxury-email-service';
import { verifyCaptchaToken } from '../lib/verifyCaptcha';
import { verifyTurnstileToken } from '../lib/verifyTurnstile';
// HubSpot removed 2026-08-21 (CEO): hubspot.ts has been a no-op since the
// Replit connector was cut in June. Prestige-join CRM sync now sits in the
// Google Sheets logRegistration + audit_events trail; no external CRM push
// until a direct HubSpot integration is wired.
import multer from 'multer';
import admin from '../lib/firebase-admin';
import crypto from 'crypto';
import { encryptField } from '../services/secretFieldCrypto';
import { claimBusinessOnce, finalizeBusinessClaim } from '../lib/businessIdempotency';

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
// Table creation moved to migration 0112 (CTO P1-8 — no phantom tables). privilege_members
// is now declared in shared/schema.ts + migrations/0112_privilege_members.sql and applied by
// the migration runner, NOT created at request time. Kept as a resolved promise so the
// existing `await _tableReady` call sites stay valid (harmless no-op).
const _tableReady: Promise<void> = Promise.resolve();

router.post('/register', upload.single('idDocument'), async (req: Request, res: Response) => {
  // CEO FLY MODE II §17 (2026-08-29) — deprecation observability on
  // the unauthenticated identity-creation path. This endpoint used to
  // be the ONLY Prestige enrolment surface, hit anonymously with an
  // email + phone. The canonical direction (§16) is:
  //   authenticated PetWash human → server derives UID → collect only
  //   the Prestige-specific fields → membership linked to UID.
  //
  // We do NOT retire /register today (§17 forbids immediate kill —
  // measure first). Instead, every hit without a resolvable Firebase
  // identity is beaconed at WARN so on-call can watch the fade curve
  // as the canonical /api/privilege/link surface rolls out.
  const authHeader = req.headers.authorization;
  const hasBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
  const hasSessionCookie = !!(req as any).cookies?.pw_session;
  if (!hasBearer && !hasSessionCookie) {
    try {
      const { recordDeprecationHit } = await import('../lib/deprecationTelemetry');
      recordDeprecationHit(req, '/api/privilege/register:anonymous');
    } catch {
      // Never break the handler because telemetry choked.
    }
  }

  // Task 23 — atomic business-idempotency guard around Prestige enrolment.
  // Two simultaneous /register submits with the same email cannot both
  // create a privilege_members row.
  //
  // D12 firewall: RESPONSE-ONLY dedup — no accounting / balance /
  // membership-benefit change. Same helper the provider + staff
  // application POSTs use (fail-closed, no auto-steal).
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
  const normalisedEmail = rawEmail.trim().toLowerCase();
  const idempKey = normalisedEmail ? `prestige_join:${normalisedEmail}` : null;
  let claimSucceeded = false;
  if (idempKey) {
    const claim = await claimBusinessOnce(idempKey, 'POST /api/privilege/register');
    if (claim === 'DB_ERROR') {
      return res.status(503).json({
        error: 'IDEMPOTENCY_UNAVAILABLE',
        errorCode: 'IDEMPOTENCY_UNAVAILABLE',
        message: 'Registration service temporarily unavailable. Please retry.',
      });
    }
    if (claim === 'IN_FLIGHT') {
      return res.status(409).json({
        error: 'DUPLICATE_REGISTRATION_IN_FLIGHT',
        errorCode: 'DUPLICATE_REGISTRATION_IN_FLIGHT',
        message: 'A registration is already being processed for this email.',
      });
    }
    if (claim === 'DONE') {
      return res.status(409).json({
        error: 'ALREADY_REGISTERED',
        errorCode: 'ALREADY_REGISTERED',
        message: 'This email is already registered in PetWash Privilege.',
      });
    }
    claimSucceeded = true;
  }
  try {
    const {
      firstName, lastName, email, phone, dob, gender,
      country, city, address,
      pets, idType, idNumber,
      referralSource, referralCode,
      marketingConsent, smsConsent, termsConsent,
      language, captchaToken, turnstileToken, traceId
    } = req.body;

    logger.info('[Privilege Register] Processing', { traceId, email });

    if (!firstName || !lastName || !email || !phone || !dob || !termsConsent) {
      if (idempKey && claimSucceeded) await finalizeBusinessClaim(idempKey, false);
      return res.status(400).json({ error: 'Missing required fields', errorCode: 'MISSING_FIELDS' });
    }

    const emailRegex = /^[^@\s]{1,64}@[^@\s.]{1,63}(?:\.[^@\s.]{1,63})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address', errorCode: 'INVALID_EMAIL' });
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-()]/g, ''))) {
      return res.status(400).json({ error: 'Invalid phone number', errorCode: 'INVALID_PHONE' });
    }

    // ── Bot gate (soft-fail: only hard-block unambiguous bots in prod) ──
    // Turnstile is the canonical check; legacy reCAPTCHA still accepted during
    // migration so existing clients don't break.
    if (turnstileToken) {
      try {
        const ts = await verifyTurnstileToken(turnstileToken, req.ip);
        logger.info('[Privilege] Turnstile result', { traceId, valid: ts.valid, reason: ts.reason });
        if (!ts.valid && process.env.NODE_ENV === 'production') {
          return res.status(403).json({ error: 'Security verification failed. Please refresh and try again.', errorCode: 'CAPTCHA_FAILED' });
        }
      } catch (tsErr) {
        logger.warn('[Privilege] Turnstile verification error (non-blocking)', { tsErr });
      }
    } else if (captchaToken && captchaToken !== 'captcha_unavailable') {
      try {
        const captchaResult = await verifyCaptchaToken(captchaToken, 'privilege_register');
        logger.info('[Privilege] reCAPTCHA (legacy) result', { traceId, valid: captchaResult.valid, score: captchaResult.score, source: captchaResult.source });
        // Hard-block only unambiguous bots (score < 0.1) in production
        if (!captchaResult.valid && captchaResult.score !== undefined && captchaResult.score < 0.1 && process.env.NODE_ENV === 'production') {
          return res.status(403).json({ error: 'Security verification failed. Please refresh and try again.', errorCode: 'CAPTCHA_FAILED' });
        }
      } catch (captchaErr) {
        logger.warn('[Privilege] reCAPTCHA verification error (non-blocking)', { captchaErr });
      }
    } else {
      logger.warn('[Privilege] No bot-check token provided', { traceId });
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
        ${idNumber ? encryptField(String(idNumber)) : null},
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

    // HubSpot sync removed 2026-08-21 (see import comment).
    // Prestige-member capture lives in Google Sheets logLoyaltyEnrollment
    // (see server/services/googleSheetsIntegration.ts) plus the audit_events
    // trail — no external CRM push until direct HubSpot integration lands.

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
            <h1 style="color:#c9a96e;font-size:22px;margin:0">🐾 PetWash™ Prestige — New Member Registration</h1>
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
              <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">ID Type</td><td style="padding:8px 0">${idType || '—'} ${idNumber ? '(on file — encrypted)' : ''}</td></tr>
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
        subject: `[PetWash™ Prestige] New Member — ${firstName} ${lastName} (${memberId})`,
        html: adminHtml,
        from: { email: 'noreply@petwash.co.il', name: 'PetWash™ System' },
      });
      logger.info('[Privilege] Admin notification sent', { memberId });
    } catch (adminEmailErr) {
      logger.error('[Privilege] Failed to send admin notification', { adminEmailErr });
    }

    if (idempKey && claimSucceeded) await finalizeBusinessClaim(idempKey, true);
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
      // A prior successful registration; leave the marker as done so future
      // replays keep returning 409 without touching the DB again.
      if (idempKey && claimSucceeded) await finalizeBusinessClaim(idempKey, true);
      return res.status(409).json({ error: 'This email is already registered in PetWash Privilege', errorCode: 'ALREADY_REGISTERED' });
    }
    // Unknown failure — release the claim so the user can safely retry.
    if (idempKey && claimSucceeded) await finalizeBusinessClaim(idempKey, false);
    res.status(500).json({ error: 'Registration failed. Please try again.', errorCode: 'REGISTRATION_FAILED' });
  }
});

router.get('/check/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    // SECURITY 2026-06-25: this endpoint is unauthenticated. It previously returned
    // member_id + tier + status for any email → membership enumeration / PII leak.
    // Return ONLY a boolean existence flag (the signup flow's only real need); no
    // member_id/tier is exposed. (Rate-limited at mount.)
    const result = await db.execute(sql`
      SELECT 1 FROM privilege_members
      WHERE email = ${email.trim().toLowerCase()} LIMIT 1
    `);
    res.json({ exists: !!(result.rows && result.rows.length > 0) });
  } catch (error) {
    res.status(500).json({ error: 'Check failed', errorCode: 'CHECK_FAILED' });
  }
});

/**
 * CEO FLY MODE II §14 + §17 (2026-08-29) — canonical Prestige linking.
 *
 * POST /api/privilege/link
 *   Requires: Firebase session cookie OR Bearer ID token.
 *   Effect: attempts the §14 safe-legacy-claim on the caller's
 *     verified email; on success stamps privilege_members.firebase_uid.
 *   Body: none required — the identity comes from the auth context.
 *
 * Success (200): { ok: true, outcome, memberId, firebaseUid }.
 * Conflicts (409): { ok: false, reason } — never auto-merge, never
 *   force. A conflict here means a human operator has to reconcile.
 * Not linked (404): { ok: false, reason: 'NO_LEGACY_MEMBER' } — the
 *   caller can proceed to canonical /register with their UID stamped
 *   from the auth context.
 * Unauth (401): body-supplied email/UID is refused (§15).
 * Unavailable (503): LOOKUP_FAILED — fail-CLOSED.
 *
 * This surface intentionally does NOT create a new membership. It
 * ONLY links an existing legacy row to the authenticated caller. New
 * enrolment continues to go through /register today; a follow-up
 * consolidates the two surfaces once §17 telemetry confirms the
 * anonymous path is dead.
 */
router.post('/link', async (req: Request, res: Response) => {
  try {
    const { verifySessionCookie, SESSION_COOKIE_NAME } = await import('../lib/sessionCookies');
    const fbAdminAuth = admin.auth();
    const sessionCookie = (req as any).cookies?.[SESSION_COOKIE_NAME];
    const authHeader = req.headers.authorization;
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    let decoded: any = null;
    if (sessionCookie) {
      try { decoded = await verifySessionCookie(sessionCookie, false); } catch { /* fall through */ }
    }
    if (!decoded && bearerToken) {
      try { decoded = await fbAdminAuth.verifyIdToken(bearerToken, true); } catch { /* fall through */ }
    }
    if (!decoded?.uid) {
      return res.status(401).json({ ok: false, error: 'AUTHENTICATION_REQUIRED' });
    }

    // BOTH email + email_verified are read from the decoded auth
    // context — NEVER from the request body. §15 forbids body-supplied
    // identity.
    const emailFromAuthContext = (decoded.email ?? null) as string | null;
    const emailVerified = decoded.email_verified === true;

    const { linkPrestigeMembershipToFirebaseUid } = await import('../services/prestigeIdentityLink');
    const result = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: decoded.uid,
      emailFromAuthContext,
      emailVerified,
    });

    if (result.ok) {
      return res.status(200).json({
        ok: true,
        outcome: result.outcome,
        memberId: result.memberId,
        firebaseUid: result.firebaseUid,
      });
    }

    // Map refusal reasons to sensible HTTP statuses.
    switch (result.reason) {
      case 'NO_LEGACY_MEMBER':
        return res.status(404).json({ ok: false, reason: result.reason });
      case 'EMAIL_NOT_VERIFIED':
      case 'MISSING_EMAIL':
        return res.status(400).json({ ok: false, reason: result.reason });
      case 'UID_ALREADY_LINKED_TO_DIFFERENT_MEMBER':
      case 'MEMBER_ALREADY_LINKED_TO_DIFFERENT_UID':
        return res.status(409).json({ ok: false, reason: result.reason });
      case 'RACE_ON_LINK':
        return res.status(409).json({ ok: false, reason: result.reason, retryable: true });
      case 'MISSING_UID':
        return res.status(401).json({ ok: false, reason: result.reason });
      case 'LOOKUP_FAILED':
      default:
        return res.status(503).json({ ok: false, reason: result.reason });
    }
  } catch (err: any) {
    logger.error('[PrestigeLink] /link handler crashed', { error: err?.message });
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
  }
});

export default router;
