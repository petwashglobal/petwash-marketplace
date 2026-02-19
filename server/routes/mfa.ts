import { Router, Request, Response, NextFunction } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { totpService } from '../services/TOTPService';
import { twoFactorAuth } from '../services/TwoFactorAuthService';
import { logger } from '../lib/logger';

const mfaRouter = Router();

const MFA_RATE_LIMIT_MAX = 5;
const MFA_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MFA_RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const mfaRateLimitMap = new Map<string, { attempts: number; windowStart: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of mfaRateLimitMap) {
    if (now - entry.windowStart > MFA_RATE_LIMIT_WINDOW_MS) {
      mfaRateLimitMap.delete(userId);
    }
  }
}, MFA_RATE_LIMIT_CLEANUP_INTERVAL_MS);

function mfaRateLimiter(req: Request, res: Response, next: NextFunction) {
  const uid = req.firebaseUser?.uid;
  if (!uid) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const now = Date.now();
  const entry = mfaRateLimitMap.get(uid);

  if (entry) {
    if (now - entry.windowStart > MFA_RATE_LIMIT_WINDOW_MS) {
      mfaRateLimitMap.set(uid, { attempts: 1, windowStart: now });
      return next();
    }

    if (entry.attempts >= MFA_RATE_LIMIT_MAX) {
      const retryAfterSec = Math.ceil((MFA_RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000);
      logger.warn(`[MFA-RateLimit] User ${uid} exceeded MFA verify rate limit`);
      return res.status(429).json({
        error: 'MFA_RATE_LIMITED',
        message: 'Too many verification attempts. Please try again later.',
        retryAfterSeconds: retryAfterSec,
      });
    }

    entry.attempts += 1;
  } else {
    mfaRateLimitMap.set(uid, { attempts: 1, windowStart: now });
  }

  return next();
}

mfaRouter.get('/status', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const enrollments = await totpService.getUserEnrollments(uid);
    res.json({
      enrolled: enrollments.some(e => e.isActive && e.verified),
      enrollments: enrollments.map(e => ({
        id: e.id,
        method: e.method,
        isActive: e.isActive,
        verified: e.verified,
        enrolledAt: e.enrolledAt,
        lastUsedAt: e.lastUsedAt,
      })),
    });
  } catch (error) {
    logger.error('[MFA-API] Status error:', error);
    res.status(500).json({ error: 'Failed to load MFA status' });
  }
});

mfaRouter.post('/enroll/totp', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const email = req.firebaseUser!.email || '';

    const result = await totpService.enrollUser({
      userId: uid,
      userEmail: email,
      method: 'totp',
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      enrollmentId: result.enrollmentId,
      secret: result.totpSecret,
      qrUri: result.totpUri,
      message: 'Scan the QR code with your authenticator app, then verify with a code.',
    });
  } catch (error) {
    logger.error('[MFA-API] TOTP enroll error:', error);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

mfaRouter.post('/enroll/sms', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const email = req.firebaseUser!.email || '';
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const result = await totpService.enrollUser({
      userId: uid,
      userEmail: email,
      method: 'sms',
      phone,
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      enrollmentId: result.enrollmentId,
      message: 'SMS MFA enrolled successfully.',
    });
  } catch (error) {
    logger.error('[MFA-API] SMS enroll error:', error);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

mfaRouter.post('/enroll/email', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const email = req.firebaseUser!.email || '';

    const result = await totpService.enrollUser({
      userId: uid,
      userEmail: email,
      method: 'email',
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      enrollmentId: result.enrollmentId,
      message: 'Email MFA enrolled successfully.',
    });
  } catch (error) {
    logger.error('[MFA-API] Email enroll error:', error);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

mfaRouter.post('/verify-enrollment', validateFirebaseToken, mfaRateLimiter, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { code } = req.body;

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ error: 'Valid 6-digit code required' });
    }

    const result = await totpService.verifyEnrollment(uid, code);

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ verified: true, message: 'TOTP enrollment verified. MFA is now active.' });
  } catch (error) {
    logger.error('[MFA-API] Verify enrollment error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

mfaRouter.post('/verify', validateFirebaseToken, mfaRateLimiter, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { code, method } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code required' });
    }

    if (method === 'sms' || method === 'email') {
      const sessionId = req.body.sessionId;
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required for SMS/Email OTP' });
      }
      const result = method === 'sms'
        ? await twoFactorAuth.verifySmsCode(uid, sessionId, code)
        : await twoFactorAuth.verifyEmailCode(uid, sessionId, code);
      return res.json(result);
    }

    const result = await totpService.verifyUserMfa(uid, code, method);

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ verified: true });
  } catch (error) {
    logger.error('[MFA-API] Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

mfaRouter.post('/send-otp', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { method, phone, email, firstName, language } = req.body;

    if (!method || !['sms', 'email', 'both'].includes(method)) {
      return res.status(400).json({ error: 'Valid method required (sms, email, both)' });
    }

    const result = await twoFactorAuth.sendCode(uid, method, { phone, email, firstName }, language || 'he');
    res.json(result);
  } catch (error) {
    logger.error('[MFA-API] Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

mfaRouter.delete('/enrollment/:id', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const enrollmentId = parseInt(req.params.id);

    if (isNaN(enrollmentId)) {
      return res.status(400).json({ error: 'Invalid enrollment ID' });
    }

    const { adminAuth } = await import('../lib/firebase-admin');
    const userRecord = await adminAuth.getUser(uid);
    const claims = (userRecord.customClaims || {}) as Record<string, any>;
    const role = claims.role || '';

    const MFA_MANDATORY_ROLES = ['admin', 'super_admin', 'management', 'hr', 'finance'];
    if (MFA_MANDATORY_ROLES.includes(role) || claims.kycStaff || claims.kycAdmin || claims.financeAccess) {
      const enrollments = await totpService.getUserEnrollments(uid);
      const activeVerified = enrollments.filter(e => e.isActive && e.verified && e.id !== enrollmentId);
      if (activeVerified.length === 0) {
        return res.status(403).json({
          error: 'MFA_CANNOT_DISABLE',
          message: 'Your role requires at least one active MFA method. You cannot remove your last MFA enrollment.',
        });
      }
    }

    const result = await totpService.removeEnrollment(uid, enrollmentId);

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ removed: true });
  } catch (error) {
    logger.error('[MFA-API] Remove enrollment error:', error);
    res.status(500).json({ error: 'Removal failed' });
  }
});

export default mfaRouter;
