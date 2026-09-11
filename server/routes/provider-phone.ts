/**
 * Provider Phone Verification Routes
 * 
 * Allows authenticated providers to verify their phone number via OTP
 * without requiring reCAPTCHA (they're already signed in via Firebase).
 * 
 * POST /api/provider/phone/send-otp   — send 6-digit code to phone
 * POST /api/provider/phone/verify-otp — verify code, mark phone as verified
 */

import express from 'express';
import crypto from 'crypto';
import { db, auth as firebaseAuth } from '../lib/firebase-admin';
import { claimVerifiedPhone } from '../lib/phoneClaim';
import { twilioSMSService } from '../services/TwilioSMSService';
import { hashOtpCode, verifyOtpCode } from '../lib/otpHmac';
import { logger } from '../lib/logger';
import { SMS_PURPOSES } from '../lib/perUidSmsBudget';
import { normalizePhoneE164, isE164 } from '../lib/phoneE164';

const router = express.Router();

const COUNTRY_CODES: Record<string, string> = {
  '+972': 'Israel',
  '+1':   'USA / Canada',
  '+44':  'UK',
  '+61':  'Australia',
  '+49':  'Germany',
  '+33':  'France',
  '+7':   'Russia',
  '+86':  'China',
  '+91':  'India',
  '+55':  'Brazil',
};

async function getFirebaseUid(req: express.Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await firebaseAuth.verifyIdToken(authHeader.split('Bearer ')[1], true);
      return decoded.uid;
    } catch { return null; }
  }
  const session = (req as any).session;
  return session?.user?.uid || null;
}

/**
 * POST /api/provider/phone/send-otp
 * Requires Firebase auth. Sends 6-digit OTP via SMS/WhatsApp.
 */
router.post('/send-otp', async (req, res) => {
  try {
    const uid = await getFirebaseUid(req);
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const { phone, channel = 'sms' } = req.body as { phone?: string; channel?: 'sms' | 'whatsapp' };
    if (!phone || phone.trim().length < 8) {
      return res.status(400).json({ error: 'INVALID_PHONE', message: 'Valid phone number required (include country code)' });
    }

    // CANONICAL normalisation — server/lib/phoneE164.ts, the one normaliser
    // every writer of users.phone imports. The ad-hoc version that used to
    // live here (strip spaces, 00 -> +) left the Israeli national form
    // untouched, so '0541234567' and '+972541234567' reached a UNIQUE
    // users.phone as two rows for one subscriber. Now that verify-otp
    // actually writes that column, that shape would mint the duplicate
    // account this route exists to prevent.
    const normalizedPhone = normalizePhoneE164(phone);
    // Reject a number we could not attach BEFORE spending an SMS on it.
    // verify-otp hands this string to admin.auth().updateUser(), which
    // requires E.164; a non-E.164 number can only fail there, after the
    // provider has already paid attention to a code we sent them.
    if (!isE164(normalizedPhone)) {
      return res.status(400).json({
        error: 'INVALID_PHONE',
        message: 'Valid phone number required (include country code)',
      });
    }

    // Generate 6-digit code. Persist ONLY its HMAC — never the raw code.
    // The plaintext code is sent over SMS and then discarded.
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHmac = hashOtpCode(code);
    const otpId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in Firestore (HMAC only — no plaintext OTP at rest)
    await db.collection('provider_phone_otps').doc(otpId).set({
      uid,
      phone: normalizedPhone,
      codeHmac,
      expiresAt,
      verified: false,
      attempts: 0,
      createdAt: new Date(),
    });

    // Send SMS
    const language = req.headers['accept-language']?.includes('he') ? 'he' : 'en';
    const message = language === 'he'
      ? `קוד האימות של PetWash™: ${code}\nתוקף: 10 דקות\nאין לשתף קוד זה עם איש.`
      : `Your PetWash™ verification code: ${code}\nExpires in 10 minutes. Never share this code.`;

    // AUDIT-SMS-5 (#221): pass purpose so per-UID daily budget applies.
    const result = await twilioSMSService.sendSMS(normalizedPhone, message, {
      userId: uid,
      ip: req.ip,
      ua: req.headers['user-agent'],
      purpose: SMS_PURPOSES.PROVIDER_PHONE,
    });

    if (!result.success) {
      await db.collection('provider_phone_otps').doc(otpId).delete();
      return res.status(500).json({ error: 'SMS_FAILED', message: language === 'he' ? 'שליחת קוד האימות נכשלה' : 'Failed to send verification code' });
    }

    logger.info('[ProviderPhone] OTP sent', { uid, phone: normalizedPhone.slice(-4), otpId });
    res.json({ success: true, otpId, expiresIn: 600, channel });

  } catch (err) {
    logger.error('[ProviderPhone] send-otp error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/**
 * Attach an OTP-attested number to a Firebase account, and say what happened.
 *
 * "PERSISTED" IN THIS REPO IS TWO QUESTIONS — Postgres AND the Firebase auth
 * record. Firebase owns phone IDENTITY: POST /api/auth/phone-session resolves
 * accounts through getUserByPhoneNumber(), and POST /api/provider/onboarding
 * reads the phone_number ID-token claim that only the auth record produces. A
 * number that never reaches that record cannot log its owner in and does not
 * satisfy the gate on the very next screen of this wizard.
 *
 * Because the two writes cannot be one transaction, a Firebase-succeeded /
 * Postgres-failed attempt is reachable, and the provider's RETRY then
 * re-attaches a number their own uid already holds. Whether Identity Toolkit
 * no-ops or raises there is decided server-side and is not knowable from the
 * SDK, so this must not depend on the answer: on "already exists" ask WHO OWNS
 * IT rather than assuming a stranger does. A blind 409 would tell the provider
 * their own number belongs to another account and wedge them out of onboarding
 * permanently. Established in #2322 for /api/onboarding-verification/
 * validate-tokens and in #2327 for /api/auth/verify-signup-mobile; the
 * reasoning is identical on this third route into the same claim.
 *
 * A branch may only say what it has ESTABLISHED. A probe that throws, or that
 * names nobody (auth/user-not-found CONTRADICTS the error that triggered it),
 * has not established a second owner — that is 'unresolved' (retryable), never
 * 'in_use_by_other' (terminal).
 */
type PhoneAttachOutcome = 'attached' | 'already_ours' | 'in_use_by_other' | 'unresolved';

// Shared with publicAuthRoutes.ts and profile-settings.ts — lib/phoneClaim
// also RECLAIMS a number held by a phone-only orphan account (see its header).
async function attachVerifiedPhoneToFirebase(uid: string, phone: string): Promise<PhoneAttachOutcome> {
  const outcome = await claimVerifiedPhone(firebaseAuth, uid, phone, '[ProviderPhone]');
  return outcome === 'reclaimed_from_orphan' ? 'attached' : outcome;
}

/**
 * POST /api/provider/phone/verify-otp
 * Verifies the 6-digit code and marks the phone as verified on the user profile.
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const uid = await getFirebaseUid(req);
    if (!uid) return res.status(401).json({ error: 'Authentication required' });

    const { otpId, code } = req.body as { otpId?: string; code?: string };
    const language = req.headers['accept-language']?.includes('he') ? 'he' : 'en';

    if (!otpId || !code || code.length !== 6) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: language === 'he' ? 'יש להזין קוד בן 6 ספרות' : '6-digit code required' });
    }

    const otpDoc = await db.collection('provider_phone_otps').doc(otpId).get();
    if (!otpDoc.exists) {
      return res.status(404).json({ error: 'OTP_NOT_FOUND', message: language === 'he' ? 'קוד לא נמצא' : 'Code not found' });
    }

    const otpData = otpDoc.data()!;

    // Owner check
    if (otpData.uid !== uid) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    // EXPIRY bounds the window in which an UNPROVEN code can be guessed. Once
    // the code has been proven that window has done its job, and a retry
    // presenting the SAME correct code is the heal path below — time-boxing it
    // would strand a provider whose first attempt landed one store and failed
    // at the next. The attempt cap still applies either way; it only ever
    // counts WRONG codes, so healing never trips it.
    if (!otpData.verified && new Date() > otpData.expiresAt.toDate()) {
      return res.status(410).json({ error: 'OTP_EXPIRED', message: language === 'he' ? 'הקוד פג תוקף, שלח קוד חדש' : 'Code expired, please request a new one' });
    }

    // Too many attempts (max 5)
    if ((otpData.attempts || 0) >= 5) {
      return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS', message: language === 'he' ? 'יותר מדי ניסיונות, שלח קוד חדש' : 'Too many attempts, request a new code' });
    }

    // Wrong code — timing-safe HMAC comparison (never plaintext)
    if (!verifyOtpCode(code, otpData.codeHmac)) {
      await db.collection('provider_phone_otps').doc(otpId).update({
        attempts: (otpData.attempts || 0) + 1,
      });
      return res.status(400).json({
        error: 'WRONG_CODE',
        attemptsLeft: 5 - ((otpData.attempts || 0) + 1),
        message: language === 'he' ? 'קוד שגוי' : 'Wrong code',
      });
    }

    // The code is proven. Spend the proof BEFORE touching any store, so this
    // doc can never serve as a FRESH proof again — but do NOT return here.
    // The old handler answered { success: true, alreadyVerified: true } off
    // this flag alone, before any persistence ran; with the writes below made
    // fail-closed, that short-circuit would turn the retry that is supposed to
    // HEAL a half-landed verification into a rubber stamp for a row still
    // holding nothing. Possession is re-proved on every pass (owner uid +
    // correct code), so falling through is not a weaker check.
    if (!otpData.verified) {
      await db.collection('provider_phone_otps').doc(otpId).update({ verified: true });
    }

    // Re-normalise on read: docs minted before send-otp adopted the canonical
    // normaliser hold whatever the client typed, and this string is about to
    // reach a UNIQUE column and an E.164-only Firebase API.
    const verifiedPhone = normalizePhoneE164(otpData.phone);
    if (!isE164(verifiedPhone)) {
      logger.error('[ProviderPhone] stored number is not E.164 — refusing to persist', { uid });
      return res.status(400).json({
        error: 'INVALID_PHONE',
        message: language === 'he' ? 'מספר הטלפון אינו תקין, שלח קוד חדש' : 'That number is not valid — please request a new code',
      });
    }

    // ── TWO STORES, OR NO CLAIM ────────────────────────────────────────────
    // What follows used to be: Firestore write, then a BEST-EFFORT Postgres
    // mirror of `phone_verified` + `phone_e164`, and a 200 either way. Three
    // things were wrong with that, and they compound.
    //
    // 1. IT NEVER TOUCHED THE FIREBASE AUTH RECORD. Firebase owns phone
    //    identity. /api/auth/phone-session resolves accounts through
    //    getUserByPhoneNumber(), so this provider's number could not log them
    //    in and signing in by it minted a SECOND account (#2322). And
    //    /api/provider/onboarding — the very next step of this wizard — gates
    //    on the phone_number ID-token claim OR users.mobile_verified_at, so
    //    the applicant was bounced with PHONE_NOT_VERIFIED and told to go do
    //    the thing they had just done.
    //
    // 2. IT WROTE THE FLAG, NOT THE CONTACT. users.phone stayed NULL while
    //    phone_verified said true — the exact claim #2327 fixed on the signup
    //    routes, reached a third way. /api/auth/login/2fa/start resolves the
    //    challenge number from users.phone with a fallback to the Firebase
    //    record; neither held anything, so a provider who opted into 2-step
    //    login was told "no phone on file" and the control they chose
    //    switched itself off silently.
    //
    // 3. IT REPORTED SUCCESS REGARDLESS. A mirror failure only logged
    //    PROVIDER_PHONE_MIRROR_FAILED while the provider was told verification
    //    succeeded. Best-effort is defensible for a convenience; it is not
    //    defensible for the answer the customer is given.
    //
    // WHY users.phone AND NOT phone_e164 (the alternative this deliberately
    // rejects): users.phone is UNIQUE and is what every identity reader
    // consults. users.phone_e164 has exactly ONE reader in the repository —
    // server/backgroundJobs.ts's pet-birthday SMS — and it already spells
    // `phone_e164 || phone`, so writing users.phone satisfies it. No migration
    // under migrations/ ever creates users.phone_e164; it arrived as drizzle
    // schema drift. Teaching the identity readers about it would make a
    // second, non-unique, unmigrated column co-authoritative while Firebase —
    // which cannot be taught a second column — keeps resolving on the real
    // number. That widens the split-brain instead of closing it, so the column
    // stays written and is demoted to what it already is: a convenience.
    const attach = await attachVerifiedPhoneToFirebase(uid, verifiedPhone);
    if (attach === 'in_use_by_other') {
      return res.status(409).json({
        error: 'PHONE_IN_USE',
        message: language === 'he' ? 'מספר הטלפון הזה כבר משויך לחשבון אחר' : 'This mobile number is already linked to another account.',
      });
    }
    if (attach === 'unresolved') {
      return res.status(500).json({
        error: 'PHONE_ATTACH_FAILED',
        message: language === 'he' ? 'הטלפון אומת אך לא ניתן לשייך אותו לחשבון. נסה שוב.' : 'Your mobile was verified but could not be linked to your account. Please try again.',
      });
    }

    const { db: pg } = await import('../db');
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    // THE CONTACT — fail-closed. Firebase has accepted the number for THIS
    // uid, so a 23505 means a stale users row squats it with no auth record
    // behind it: drift, not a rival owner. Say 409, never a raw constraint 500.
    try {
      await pg.update(users).set({ phone: verifiedPhone }).where(eq(users.id, uid));
    } catch (dbErr: any) {
      const unique = String(dbErr?.code) === '23505' || /unique|duplicate key/i.test(dbErr?.message || '');
      logger.error('PROVIDER_PHONE_PERSIST_FAILED', {
        signal: 'PROVIDER_PHONE_PERSIST_FAILED', uid, unique, errorMessage: dbErr?.message ?? String(dbErr),
      });
      return res.status(unique ? 409 : 500).json({
        error: unique ? 'PHONE_IN_USE' : 'PHONE_PERSIST_FAILED',
        message: unique
          ? (language === 'he' ? 'מספר הטלפון הזה כבר משויך לחשבון אחר' : 'This mobile number is already linked to another account.')
          : (language === 'he' ? 'הטלפון אומת אך לא הצלחנו לשמור אותו. נסה שוב.' : 'Your mobile was verified but we could not save it. Please try again.'),
      });
    }

    // THE FLAG — through markMobileVerified, never a bare boolean. It writes
    // mobile_verified_at, phone_verified and activation_status TOGETHER; the
    // bare `phoneVerified: true` this route used to send is precisely the
    // drift that function's own comment was added to heal, and it is the arm
    // of the provider-onboarding gate that was missing.
    try {
      const { markMobileVerified } = await import('../services/ActivationService');
      await markMobileVerified(uid);
    } catch (actErr: any) {
      logger.error('PROVIDER_PHONE_ACTIVATION_FAILED', {
        signal: 'PROVIDER_PHONE_ACTIVATION_FAILED', uid, errorMessage: actErr?.message ?? String(actErr),
      });
      return res.status(503).json({
        error: 'ACTIVATION_UNAVAILABLE',
        message: language === 'he' ? 'הטלפון אומת אך לא ניתן היה להשלים את ההפעלה. נסה שוב.' : 'Your mobile was verified but activation could not complete. Please try again.',
      });
    }

    // THE CONVENIENCE — the one thing here that stays best-effort, and only
    // because it is the one thing nothing depends on. Its single reader falls
    // back to users.phone, which is now written, and no migration creates the
    // column: folding it into the fail-closed write above would let a column
    // that may not exist take provider verification down entirely.
    try {
      await pg.update(users).set({ phoneE164: verifiedPhone }).where(eq(users.id, uid));
    } catch (e164Err: any) {
      logger.warn('PROVIDER_PHONE_E164_SHADOW_WRITE_FAILED', {
        signal: 'PROVIDER_PHONE_E164_SHADOW_WRITE_FAILED', uid, errorMessage: e164Err?.message ?? String(e164Err),
      });
    }

    // THE MIRROR — last, and fail-closed. Ordering it after the authoritative
    // stores is what keeps a failure honest: the Firestore doc can no longer
    // hold `phoneVerified: true` for a request that answered failure, and a
    // failure here leaves only the mirror behind, which the retry heals.
    try {
      await db.collection('users').doc(uid).set({
        phone: verifiedPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
      }, { merge: true });
    } catch (fsErr: any) {
      logger.error('PROVIDER_PHONE_MIRROR_FAILED', {
        signal: 'PROVIDER_PHONE_MIRROR_FAILED', uid, errorMessage: fsErr?.message ?? String(fsErr),
      });
      return res.status(500).json({
        error: 'PHONE_PERSIST_FAILED',
        message: language === 'he' ? 'הטלפון אומת אך לא הצלחנו לשמור אותו. נסה שוב.' : 'Your mobile was verified but we could not save it. Please try again.',
      });
    }

    logger.info('[ProviderPhone] Phone verified', { uid, phone: verifiedPhone.slice(-4) });
    res.json({ success: true, phone: verifiedPhone, message: language === 'he' ? '✅ הטלפון אומת בהצלחה!' : '✅ Phone verified successfully!' });

  } catch (err) {
    logger.error('[ProviderPhone] verify-otp error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export { router as providerPhoneRouter, COUNTRY_CODES };
