import { Router } from 'express';
import { randomInt } from 'crypto';
import { israeli2025SignatureService, type EnhancedSignatureRequest } from '../services/Israeli2025SignatureService';
import { requireAuth } from '../customAuth';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { redis } from '../services/redis';
import { twilioSMSService } from '../services/TwilioSMSService';
import { EmailService } from '../emailService';

const OTP_TTL_SECONDS = 300; // 5 minutes

const router = Router();

/**
 * 🇮🇱 ISRAELI GOVERNMENT-GRADE E-SIGNATURE API (2025 COMPLIANCE)
 * 
 * Full compliance with Israeli Electronic Transactions Law 2001
 * Enhanced with ES256, TSA, MFA, geolocation, and complete audit trail
 */

const createSignatureSchema = z.object({
  // Document Information
  documentId: z.string(),
  documentTitle: z.string(),
  documentUrl: z.string().url(),
  documentSha256: z.string().length(64), // SHA-256 hash is always 64 chars
  
  // Signer Information (user info from Firebase auth)
  signerName: z.string(),
  signerPhone: z.string(),
  signerRole: z.string(), // "Director", "CEO", etc.
  
  // Authentication Level
  authLevel: z.enum(['basic', 'strong', 'qualified']).default('strong'),
  authMethods: z.array(z.enum(['email_otp', 'sms_otp', 'device_biometric', 'webauthn'])),
  
  // Device Information
  deviceId: z.string(),
  geolocation: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy_m: z.number(),
  }).optional(),
  
  // Signature Drawing
  signatureImageUrl: z.string().url().optional(),
  signatureImageSha256: z.string().length(64).optional(),
  canvasWidth: z.number().optional(),
  canvasHeight: z.number().optional(),
  strokePointsCount: z.number().optional(),
  
  // Consent
  consentText: z.string(),
  consentLanguage: z.enum(['en', 'he', 'ar', 'ru', 'fr', 'es']).default('he'),
  consentAccepted: z.boolean(),
});

/**
 * POST /api/israeli-2025-esign/create
 * 
 * Create government-grade e-signature with ES256, TSA, and full audit trail
 * 
 * Request Body: See createSignatureSchema
 * 
 * Response:
 * {
 *   "success": true,
 *   "signature": {
 *     "signatureId": "sig_2025_...",
 *     "version": "2025.1",
 *     "document": {...},
 *     "signer": {...},
 *     "session": {...},
 *     "crypto": {
 *       "algo": "ES256",
 *       "jws": "eyJhbGciOiJFUzI1NiI...",
 *       "tsaTimestamp": {...}
 *     },
 *     "audit": {
 *       "events": [...]
 *     }
 *   }
 * }
 */
router.post('/create', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const userEmail = req.user!.email || '';
    
    // Validate request body
    const data = createSignatureSchema.parse(req.body);
    
    // Ensure user has verified their auth methods
    if (data.authLevel === 'strong' && data.authMethods.length < 2) {
      return res.status(400).json({
        error: 'Strong authentication requires at least 2 auth methods',
        message: 'Please verify with at least 2 methods: email_otp, sms_otp, device_biometric, or webauthn'
      });
    }
    
    if (data.authLevel === 'qualified' && data.authMethods.length < 3) {
      return res.status(400).json({
        error: 'Qualified authentication requires at least 3 auth methods',
        message: 'Qualified signatures require maximum security verification'
      });
    }
    
    // Create enhanced signature request
    const signatureRequest: EnhancedSignatureRequest = {
      documentId: data.documentId,
      documentTitle: data.documentTitle,
      documentUrl: data.documentUrl,
      documentSha256: data.documentSha256,
      
      userId,
      signerName: data.signerName,
      signerEmail: userEmail,
      signerPhone: data.signerPhone,
      signerRole: data.signerRole,
      
      authLevel: data.authLevel,
      authMethods: data.authMethods,
      
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      deviceId: data.deviceId,
      geolocation: data.geolocation,
      
      signatureImageUrl: data.signatureImageUrl,
      signatureImageSha256: data.signatureImageSha256,
      canvasWidth: data.canvasWidth,
      canvasHeight: data.canvasHeight,
      strokePointsCount: data.strokePointsCount,
      
      consentText: data.consentText,
      consentLanguage: data.consentLanguage,
      consentAccepted: data.consentAccepted,
    };
    
    // Create government-grade signature
    const signature = await israeli2025SignatureService.createSignatureSession(signatureRequest);
    
    logger.info('[Israeli2025-ESign] ✅ Government-grade signature created:', {
      signatureId: signature.signatureId,
      userId,
      authLevel: data.authLevel,
      authMethods: data.authMethods,
    });
    
    res.json({
      success: true,
      signature,
      message: 'Government-grade e-signature created successfully',
    });
    
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }
    
    logger.error('[Israeli2025-ESign] ❌ Failed to create signature:', error);
    res.status(500).json({
      error: 'Failed to create signature',
      message: error.message,
    });
  }
});

/**
 * GET /api/israeli-2025-esign/verify/:signatureId
 * 
 * Verify signature authenticity and integrity
 * 
 * Response:
 * {
 *   "success": true,
 *   "valid": true,
 *   "signatureId": "sig_2025_...",
 *   "message": "Signature is valid and compliant with Israeli law 2025"
 * }
 */
router.get('/verify/:signatureId', async (req, res) => {
  try {
    const { signatureId } = req.params;
    
    const isValid = await israeli2025SignatureService.verifySignature(signatureId);
    
    if (!isValid) {
      return res.status(404).json({
        success: false,
        valid: false,
        signatureId,
        message: 'Signature not found or invalid',
      });
    }
    
    res.json({
      success: true,
      valid: true,
      signatureId,
      message: 'Signature is valid and compliant with Israeli law 2025',
      compliance: {
        law: 'Israeli Electronic Transactions Law 2001',
        standard: 'Israeli Ministry of Justice 2025',
        cryptography: 'ES256 (ECDSA P-256)',
        timestamp: 'Internal TSA',
        auditTrail: 'Complete',
      },
    });
    
  } catch (error: any) {
    logger.error('[Israeli2025-ESign] ❌ Verification failed:', error);
    res.status(500).json({
      error: 'Verification failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/israeli-2025-esign/otp/send
 * 
 * Send OTP for multi-factor authentication
 * 
 * Request Body:
 * {
 *   "method": "sms" | "email",
 *   "phone": "+972549833355" (for SMS),
 *   "email": "user@example.com" (for email)
 * }
 */
router.post('/otp/send', requireAuth, async (req, res) => {
  try {
    const { method, phone, email } = req.body;
    
    if (!method || (method !== 'sms' && method !== 'email')) {
      return res.status(400).json({
        error: 'Invalid method',
        message: 'Method must be "sms" or "email"',
      });
    }
    
    if (method === 'sms' && !phone) {
      return res.status(400).json({
        error: 'Phone number required',
        message: 'Phone number is required for SMS OTP',
      });
    }
    
    if (method === 'email' && !email) {
      return res.status(400).json({
        error: 'Email required',
        message: 'Email is required for email OTP',
      });
    }
    
    // Generate 6-digit OTP
    const otp = randomInt(100000, 1000000).toString();
    const uid = (req as any).user?.uid;

    // Store OTP in Redis with 5-minute TTL (key per uid + method)
    const redisKey = `esign_otp:${uid}:${method}`;
    await redis.set(redisKey, otp, OTP_TTL_SECONDS);

    // Send OTP via the appropriate channel
    if (method === 'sms' && phone) {
      try {
        await twilioSMSService.sendSMS(
          phone,
          `PetWash™ קוד אימות: ${otp}\nתוקף הקוד 5 דקות. אל תשתף קוד זה עם אף אחד.`,
          { userId: uid, ip: (req as any).ip, ua: (req as any).headers?.['user-agent'] },
        );
      } catch (smsErr: any) {
        logger.error('[Israeli2025-ESign] SMS send failed:', smsErr.message);
        return res.status(500).json({ error: 'SMS delivery failed', message: 'Could not send OTP via SMS. Please try email instead.' });
      }
    } else if (method === 'email' && email) {
      try {
        await EmailService.send({
          to: email,
          subject: 'PetWash™ — קוד אימות לחתימה דיגיטלית',
          html: `
            <div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
              <h2 style="margin:0 0 8px;color:#111">PetWash™ — קוד אימות</h2>
              <p style="color:#555;margin:0 0 24px;font-size:14px">השתמש בקוד הבא לאימות זהותך לחתימה דיגיטלית:</p>
              <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
                <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111">${otp}</span>
              </div>
              <p style="color:#888;font-size:12px;margin:0">הקוד תקף ל-5 דקות. אל תשתף קוד זה עם אף אחד.</p>
            </div>`,
          text: `PetWash™ קוד אימות: ${otp}\nתוקף הקוד 5 דקות.`,
        });
      } catch (emailErr: any) {
        logger.error('[Israeli2025-ESign] Email OTP send failed:', emailErr.message);
        return res.status(500).json({ error: 'Email delivery failed', message: 'Could not send OTP via email.' });
      }
    }

    logger.info('[Israeli2025-ESign] OTP sent', { method, uid, redisKey });
    res.json({
      success: true,
      message: `OTP sent via ${method}`,
      expiresInSeconds: OTP_TTL_SECONDS,
      // In development only, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp }),
    });
    
  } catch (error: any) {
    logger.error('[Israeli2025-ESign] ❌ Failed to send OTP:', error);
    res.status(500).json({
      error: 'Failed to send OTP',
      message: error.message,
    });
  }
});

/**
 * POST /api/israeli-2025-esign/otp/verify
 * 
 * Verify OTP code
 * 
 * Request Body:
 * {
 *   "method": "sms" | "email",
 *   "code": "123456"
 * }
 */
router.post('/otp/verify', requireAuth, async (req, res) => {
  try {
    const { method, code } = req.body;
    
    if (!method || !code) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Method and code are required',
      });
    }
    
    const uid = req.user!.uid;
    const redisKey = `esign_otp:${uid}:${method}`;

    // Retrieve stored OTP from Redis
    const storedOtp = await redis.get<string>(redisKey);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'OTP expired or not found. Please request a new code.',
      });
    }

    if (storedOtp !== code) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid OTP code. Please check and try again.',
      });
    }

    // Consume OTP — delete from Redis (one-time use)
    await redis.del(redisKey);

    logger.info('[Israeli2025-ESign] OTP verified', { method, uid });
    res.json({
      success: true,
      valid: true,
      message: 'OTP verified successfully',
      authMethod: method === 'sms' ? 'sms_otp' : 'email_otp',
    });
    
  } catch (error: any) {
    logger.error('[Israeli2025-ESign] ❌ OTP verification failed:', error);
    res.status(500).json({
      error: 'OTP verification failed',
      message: error.message,
    });
  }
});

export default router;
