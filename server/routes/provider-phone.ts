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
import { twilioSMSService } from '../services/TwilioSMSService';
import { logger } from '../lib/logger';

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

    const normalizedPhone = phone.replace(/\s+/g, '').replace(/^00/, '+');

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const otpId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in Firestore
    await db.collection('provider_phone_otps').doc(otpId).set({
      uid,
      phone: normalizedPhone,
      code,
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

    const result = await twilioSMSService.sendSMS(normalizedPhone, message, {
      userId: uid,
      ip: req.ip,
      ua: req.headers['user-agent'],
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

    // Already verified
    if (otpData.verified) {
      return res.json({ success: true, alreadyVerified: true, phone: otpData.phone });
    }

    // Expired
    if (new Date() > otpData.expiresAt.toDate()) {
      return res.status(410).json({ error: 'OTP_EXPIRED', message: language === 'he' ? 'הקוד פג תוקף, שלח קוד חדש' : 'Code expired, please request a new one' });
    }

    // Too many attempts (max 5)
    if ((otpData.attempts || 0) >= 5) {
      return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS', message: language === 'he' ? 'יותר מדי ניסיונות, שלח קוד חדש' : 'Too many attempts, request a new code' });
    }

    // Wrong code
    if (otpData.code !== code) {
      await db.collection('provider_phone_otps').doc(otpId).update({
        attempts: (otpData.attempts || 0) + 1,
      });
      return res.status(400).json({
        error: 'WRONG_CODE',
        attemptsLeft: 5 - ((otpData.attempts || 0) + 1),
        message: language === 'he' ? 'קוד שגוי' : 'Wrong code',
      });
    }

    // Mark verified
    await db.collection('provider_phone_otps').doc(otpId).update({ verified: true });

    // Save verified phone to user Firestore doc + Firestore users collection
    await db.collection('users').doc(uid).set({
      phone: otpData.phone,
      phoneVerified: true,
      phoneVerifiedAt: new Date(),
    }, { merge: true });

    logger.info('[ProviderPhone] Phone verified', { uid, phone: otpData.phone.slice(-4) });
    res.json({ success: true, phone: otpData.phone, message: language === 'he' ? '✅ הטלפון אומת בהצלחה!' : '✅ Phone verified successfully!' });

  } catch (err) {
    logger.error('[ProviderPhone] verify-otp error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export { router as providerPhoneRouter, COUNTRY_CODES };
