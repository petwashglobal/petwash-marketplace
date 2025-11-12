/**
 * Passport Verification API
 * KYC verification for loyalty members using Google Vision API
 * Compliant with Israeli Privacy Law 2025 + GDPR
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../db';
import { passportVerifications } from '../../shared/schema';
import { passportOCRService } from '../services/PassportOCRService';
import { logger } from '../lib/logger';
import { eq } from 'drizzle-orm';

const router = Router();

// Configure multer for image uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * POST /api/passport/verify
 * Upload and verify passport using Google Vision API
 */
router.post('/verify', upload.single('passport'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    // Check consent
    const consentGiven = req.body.consent === 'true' || req.body.consent === true;
    if (!consentGiven) {
      return res.status(400).json({
        success: false,
        error: 'User consent required for passport verification'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No passport image provided'
      });
    }

    logger.info('[PassportAPI] Processing passport verification', {
      userId: user.uid,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    // Extract passport data using Google Vision API
    const result = await passportOCRService.extractPassportData(req.file.buffer);

    if (!result.success || !result.data) {
      logger.warn('[PassportAPI] Passport verification failed', {
        userId: user.uid,
        error: result.error,
        warnings: result.warnings
      });

      return res.status(400).json({
        success: false,
        error: result.error,
        warnings: result.warnings
      });
    }

    const passportData = result.data;

    // Check if passport is from approved country (if list provided)
    const approvedCountries = req.body.approvedCountries 
      ? JSON.parse(req.body.approvedCountries) 
      : [];
    
    if (approvedCountries.length > 0) {
      const isApproved = passportOCRService.isApprovedCountry(
        passportData.countryCode,
        approvedCountries
      );

      if (!isApproved) {
        return res.status(403).json({
          success: false,
          error: `Passports from ${passportData.countryCode} are not accepted`,
          countryCode: passportData.countryCode
        });
      }
    }

    // Check if passport already verified for this user
    const existing = await db
      .select()
      .from(passportVerifications)
      .where(eq(passportVerifications.userId, user.uid))
      .limit(1);

    if (existing.length > 0) {
      // SECURITY: Never log PII (passport numbers, names, etc.)
      logger.info('[PassportAPI] User already has verified passport', {
        userId: user.uid,
        verificationId: existing[0].id
      });

      return res.status(409).json({
        success: false,
        error: 'User already has a passport on file',
        existingVerification: {
          id: existing[0].id,
          status: existing[0].verificationStatus,
          countryCode: existing[0].countryCode,
          verifiedAt: existing[0].verifiedAt
        }
      });
    }

    // Check if passport is expired
    const expiryDate = new Date(passportData.expiryDate);
    const isExpired = expiryDate < new Date();

    // Save to database
    const [verification] = await db
      .insert(passportVerifications)
      .values({
        userId: user.uid,
        documentType: passportData.documentType,
        passportNumber: passportData.passportNumber,
        countryCode: passportData.countryCode,
        nationality: passportData.nationality,
        surname: passportData.surname,
        givenNames: passportData.givenNames,
        dateOfBirth: passportData.dateOfBirth,
        sex: passportData.sex,
        expiryDate: passportData.expiryDate,
        isExpired,
        rawMRZ: passportData.rawMRZ,
        mrzConfidence: passportData.confidence.toString(),
        verificationStatus: isExpired ? 'rejected' : 'pending',
        rejectionReason: isExpired ? 'Passport has expired' : null,
        consentGiven,
        consentTimestamp: new Date(),
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      } as any)
      .returning();

    // SECURITY: Never log PII (passport numbers, names, DOB, etc.)
    logger.info('[PassportAPI] ✅ Passport verification saved', {
      userId: user.uid,
      verificationId: verification.id,
      countryCode: passportData.countryCode,
      documentType: passportData.documentType,
      status: verification.verificationStatus
    });

    // Return sanitized response (no personal details in API response for security)
    return res.json({
      success: true,
      verification: {
        id: verification.id,
        status: verification.verificationStatus,
        countryCode: verification.countryCode,
        documentType: verification.documentType,
        isExpired: verification.isExpired,
        createdAt: verification.createdAt,
        warnings: result.warnings
      },
      message: isExpired 
        ? 'Passport has expired - verification rejected'
        : 'Passport submitted successfully - pending admin approval'
    });

  } catch (error: any) {
    logger.error('[PassportAPI] ❌ Passport verification error', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process passport verification'
    });
  }
});

/**
 * GET /api/passport/status
 * Get user's passport verification status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }

    const verification = await db
      .select({
        id: passportVerifications.id,
        status: passportVerifications.verificationStatus,
        countryCode: passportVerifications.countryCode,
        documentType: passportVerifications.documentType,
        isExpired: passportVerifications.isExpired,
        verifiedAt: passportVerifications.verifiedAt,
        rejectionReason: passportVerifications.rejectionReason,
        createdAt: passportVerifications.createdAt,
      })
      .from(passportVerifications)
      .where(eq(passportVerifications.userId, user.uid))
      .limit(1);

    if (verification.length === 0) {
      return res.json({
        success: true,
        hasVerification: false,
        message: 'No passport verification on file'
      });
    }

    return res.json({
      success: true,
      hasVerification: true,
      verification: verification[0]
    });

  } catch (error: any) {
    logger.error('[PassportAPI] Failed to get verification status', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve verification status'
    });
  }
});

export default router;
