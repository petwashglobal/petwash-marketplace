/**
 * Biometric Certificate Verification API Routes
 * תעודת נכה, גימלאים, תעודת זהות, רשיון נהיגה
 * 
 * Complete document verification flow with biometric matching
 */

import { Router, Request, Response } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { certificateVerification, type DocumentType } from '../services/CertificateVerificationService';
import { consentService } from '../services/ConsentService';
import { logger } from '../lib/logger';
import multer from 'multer';
import { storage } from '../lib/firebase-admin';
import crypto from 'crypto';
import path from 'path';

const router = Router();

/**
 * Schedule cleanup of biometric files
 * SECURITY: Delete raw biometric images after processing
 * Retention: 24 hours for legal audit, then permanent deletion
 */
async function scheduleFileCleanup(
  bucket: any,
  userId: string,
  timestamp: number,
  randomId: string
): Promise<void> {
  // Delete files after 24 hours (legal retention period)
  const RETENTION_HOURS = 24;
  const deleteAfter = RETENTION_HOURS * 60 * 60 * 1000;

  setTimeout(async () => {
    try {
      const prefix = `biometric-certificates/${userId}/`;
      const [files] = await bucket.getFiles({ prefix });

      // Delete only files from this upload session (matching timestamp + randomId)
      const filesToDelete = files.filter((file: any) => 
        file.name.includes(`_${timestamp}_${randomId}`)
      );

      for (const file of filesToDelete) {
        await file.delete();
        logger.info('[BiometricCertificates] Cleanup: deleted file', { 
          userId, 
          filename: file.name 
        });
      }

      logger.info('[BiometricCertificates] Cleanup completed', { 
        userId, 
        filesDeleted: filesToDelete.length 
      });

    } catch (error) {
      logger.error('[BiometricCertificates] Cleanup failed', { userId, error });
    }
  }, deleteAfter);

  logger.info('[BiometricCertificates] Cleanup scheduled', { 
    userId, 
    deleteAfterHours: RETENTION_HOURS 
  });
}

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and HEIC images are allowed.'));
    }
  }
});

/**
 * Upload certificate documents for verification
 * 
 * POST /api/biometric-certificates/upload
 * 
 * Requires:
 * - documentFront: Image file (front of ID/certificate)
 * - selfie: Image file (current selfie for biometric matching)
 * - documentBack (optional): Image file (back of ID, if applicable)
 * - documentType: 'national_id' | 'drivers_license' | 'disability_certificate' | 'retirement_certificate' | 'club_membership'
 * - documentCountry: ISO country code (IL, US, GB, etc.)
 */
router.post(
  '/upload',
  validateFirebaseToken,
  upload.fields([
    { name: 'documentFront', maxCount: 1 },
    { name: 'documentBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }
  ]),
  async (req: Request, res: Response) => {
    try {
      const { uid, email } = req.firebaseUser!;
      const { documentType, documentCountry } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Validation
      if (!files.documentFront || !files.selfie) {
        return res.status(400).json({ 
          error: 'Missing required files: documentFront and selfie are required' 
        });
      }

      if (!documentType || !documentCountry) {
        return res.status(400).json({ 
          error: 'Missing required fields: documentType and documentCountry' 
        });
      }

      const validDocTypes: DocumentType[] = [
        'national_id',
        'drivers_license',
        'disability_certificate',
        'retirement_certificate',
        'club_membership'
      ];

      if (!validDocTypes.includes(documentType)) {
        return res.status(400).json({ 
          error: `Invalid document type. Must be one of: ${validDocTypes.join(', ')}` 
        });
      }

      // SECURITY: Validate double consent BEFORE processing
      const consentValidation = await consentService.validateConsentForProcessing(uid, true);
      if (!consentValidation.valid) {
        logger.warn('[BiometricCertificates] Upload rejected - missing consent', { 
          uid, 
          reason: consentValidation.reason 
        });
        return res.status(403).json({ 
          error: 'Consent required',
          message: 'You must provide consent for document and biometric processing before uploading',
          reason: consentValidation.reason
        });
      }

      logger.info('[BiometricCertificates] Upload started', { 
        uid, 
        email, 
        documentType, 
        documentCountry 
      });

      // Upload files to Firebase Storage (PRIVATE - not public)
      const bucket = storage.bucket();
      const timestamp = Date.now();
      const randomId = crypto.randomBytes(8).toString('hex');

      try {
        const uploadFile = async (file: Express.Multer.File, prefix: string): Promise<string> => {
          const ext = path.extname(file.originalname);
          const filename = `biometric-certificates/${uid}/${prefix}_${timestamp}_${randomId}${ext}`;
          const fileRef = bucket.file(filename);

          await fileRef.save(file.buffer, {
            metadata: {
              contentType: file.mimetype,
              metadata: {
                userId: uid,
                documentType,
                uploadedAt: new Date().toISOString()
              }
            }
          });

          // SECURITY FIX: DO NOT make public - use signed URLs for limited access
          // Raw biometric data must remain private
          const [signedUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 2 * 60 * 60 * 1000, // 2 hours - enough for verification
          });

          return signedUrl;
        };

        // Upload all files in parallel
        const [documentFrontUrl, selfieUrl, documentBackUrl] = await Promise.all([
          uploadFile(files.documentFront[0], 'document_front'),
          uploadFile(files.selfie[0], 'selfie'),
          files.documentBack ? uploadFile(files.documentBack[0], 'document_back') : Promise.resolve(undefined)
        ]);

        logger.info('[BiometricCertificates] Files uploaded to Firebase Storage', { 
          uid, 
          documentFrontUrl, 
          selfieUrl 
        });

        try {
          // Run verification process
          const result = await certificateVerification.verifyDocument(
            uid,
            documentType as DocumentType,
            documentCountry,
            {
              frontUrl: documentFrontUrl,
              backUrl: documentBackUrl,
              selfieUrl
            },
            req.ip,
            req.headers['user-agent']
          );

          // Verification successful - schedule cleanup (24 hour retention)
          scheduleFileCleanup(bucket, uid, timestamp, randomId).catch(err => {
            logger.error('[BiometricCertificates] Cleanup scheduling failed', err);
          });

          // Return result
          res.json({
            success: true,
            verification: {
              id: result.verificationId,
              status: result.status,
              biometricMatchScore: result.biometricMatchScore,
              message: result.message,
              requiresManualReview: result.requiresManualReview
            }
          });

        } catch (verificationError: any) {
          // SECURITY CRITICAL: Verification failed - delete files IMMEDIATELY (no retention)
          logger.warn('[BiometricCertificates] Verification failed - deleting files immediately', verificationError);
          
          try {
            const prefix = `biometric-certificates/${uid}/`;
            const [files] = await bucket.getFiles({ prefix });
            const filesToDelete = files.filter((file: any) => 
              file.name.includes(`_${timestamp}_${randomId}`)
            );
            
            await Promise.all(filesToDelete.map((file: any) => file.delete()));
            logger.info('[BiometricCertificates] Biometric files deleted immediately after verification failure', {
              uid,
              filesDeleted: filesToDelete.length
            });
          } catch (cleanupError) {
            logger.error('[BiometricCertificates] Emergency cleanup failed', cleanupError);
          }

          res.status(500).json({ 
            error: 'Verification failed',
            details: verificationError.message 
          });
        }

      } catch (uploadError: any) {
        // Upload failed - delete any partial uploads IMMEDIATELY
        logger.error('[BiometricCertificates] Upload failed - cleaning up partial uploads', uploadError);
        
        try {
          const prefix = `biometric-certificates/${uid}/`;
          const [files] = await bucket.getFiles({ prefix });
          const filesToDelete = files.filter((file: any) => 
            file.name.includes(`_${timestamp}_${randomId}`)
          );
          
          if (filesToDelete.length > 0) {
            await Promise.all(filesToDelete.map((file: any) => file.delete()));
            logger.info('[BiometricCertificates] Partial uploads deleted after upload failure', {
              uid,
              filesDeleted: filesToDelete.length
            });
          }
        } catch (cleanupError) {
          logger.error('[BiometricCertificates] Partial upload cleanup failed', cleanupError);
        }

        res.status(500).json({ 
          error: 'Upload failed',
          details: uploadError.message 
        });
      }

    } catch (error: any) {
      // Validation or middleware error - no files uploaded
      logger.error('[BiometricCertificates] Request failed', error);
      res.status(500).json({ 
        error: 'Request failed', 
        details: error.message 
      });
    }
  }
);

/**
 * Get list of approved countries for document verification
 * 
 * GET /api/biometric-certificates/approved-countries
 */
router.get(
  '/approved-countries',
  async (req: Request, res: Response) => {
    try {
      const countries = await certificateVerification.getApprovedCountries();

      res.json({
        success: true,
        countries: countries.map(c => ({
          code: c.countryCode,
          nameEn: c.countryName,
          nameHe: c.countryNameHe,
          acceptsNationalId: c.acceptsNationalId,
          acceptsDriversLicense: c.acceptsDriversLicense,
          acceptsPassport: c.acceptsPassport
        }))
      });

    } catch (error: any) {
      logger.error('[BiometricCertificates] Failed to get approved countries', error);
      res.status(500).json({ error: 'Failed to retrieve approved countries' });
    }
  }
);

/**
 * Get user's verification history
 * 
 * GET /api/biometric-certificates/history
 */
router.get(
  '/history',
  validateFirebaseToken,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.firebaseUser!;

      const verifications = await certificateVerification.getUserVerifications(uid);

      res.json({
        success: true,
        verifications: verifications.map(v => ({
          id: v.id,
          documentType: v.documentType,
          documentCountry: v.documentCountry,
          verificationStatus: v.verificationStatus,
          biometricMatchScore: v.biometricMatchScore,
          verifiedAt: v.verifiedAt,
          createdAt: v.createdAt,
          isDisabilityVerified: v.isDisabilityVerified,
          isRetirementVerified: v.isRetirementVerified,
          isClubMemberVerified: v.isClubMemberVerified
        }))
      });

    } catch (error: any) {
      logger.error('[BiometricCertificates] Failed to get history', error);
      res.status(500).json({ error: 'Failed to retrieve verification history' });
    }
  }
);

/**
 * Get verification status by ID
 * 
 * GET /api/biometric-certificates/:id
 */
router.get(
  '/:id',
  validateFirebaseToken,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.firebaseUser!;
      const verificationId = parseInt(req.params.id);

      if (isNaN(verificationId)) {
        return res.status(400).json({ error: 'Invalid verification ID' });
      }

      const verifications = await certificateVerification.getUserVerifications(uid);
      const verification = verifications.find(v => v.id === verificationId);

      if (!verification) {
        return res.status(404).json({ error: 'Verification not found' });
      }

      res.json({
        success: true,
        verification: {
          id: verification.id,
          documentType: verification.documentType,
          documentCountry: verification.documentCountry,
          verificationStatus: verification.verificationStatus,
          biometricMatchStatus: verification.biometricMatchStatus,
          biometricMatchScore: verification.biometricMatchScore,
          ocrConfidence: verification.ocrConfidence,
          verifiedAt: verification.verifiedAt,
          rejectionReason: verification.rejectionReason,
          createdAt: verification.createdAt,
          isDisabilityVerified: verification.isDisabilityVerified,
          isRetirementVerified: verification.isRetirementVerified,
          isClubMemberVerified: verification.isClubMemberVerified
        }
      });

    } catch (error: any) {
      logger.error('[BiometricCertificates] Failed to get verification', error);
      res.status(500).json({ error: 'Failed to retrieve verification' });
    }
  }
);

/**
 * Admin: Get pending verifications for review
 * 
 * GET /api/biometric-certificates/admin/pending
 */
router.get(
  '/admin/pending',
  validateFirebaseToken,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.firebaseUser!;

      // TODO: Add admin role check
      // For now, allow any authenticated user (add proper RBAC later)

      const pendingVerifications = await certificateVerification.getPendingVerifications();

      res.json({
        success: true,
        count: pendingVerifications.length,
        verifications: pendingVerifications.map(v => ({
          id: v.id,
          userId: v.userId,
          documentType: v.documentType,
          documentCountry: v.documentCountry,
          documentFrontUrl: v.documentFrontUrl,
          documentBackUrl: v.documentBackUrl,
          selfiePhotoUrl: v.selfiePhotoUrl,
          biometricMatchScore: v.biometricMatchScore,
          ocrConfidence: v.ocrConfidence,
          detectedFields: v.detectedFields,
          createdAt: v.createdAt
        }))
      });

    } catch (error: any) {
      logger.error('[BiometricCertificates] Failed to get pending verifications', error);
      res.status(500).json({ error: 'Failed to retrieve pending verifications' });
    }
  }
);

/**
 * Admin: Approve verification manually
 * 
 * POST /api/biometric-certificates/admin/:id/approve
 */
router.post(
  '/admin/:id/approve',
  validateFirebaseToken,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.firebaseUser!;
      const verificationId = parseInt(req.params.id);
      const { notes } = req.body;

      if (isNaN(verificationId)) {
        return res.status(400).json({ error: 'Invalid verification ID' });
      }

      // TODO: Add admin role check

      await certificateVerification.approveVerification(
        verificationId,
        uid,
        notes
      );

      logger.info('[BiometricCertificates] Admin approved verification', { 
        verificationId, 
        adminUid: uid 
      });

      res.json({
        success: true,
        message: 'Verification approved successfully'
      });

    } catch (error: any) {
      logger.error('[BiometricCertificates] Failed to approve verification', error);
      res.status(500).json({ error: 'Failed to approve verification', details: error.message });
    }
  }
);

/**
 * Admin: Reject verification manually
 * 
 * POST /api/biometric-certificates/admin/:id/reject
 */
router.post(
  '/admin/:id/reject',
  validateFirebaseToken,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.firebaseUser!;
      const verificationId = parseInt(req.params.id);
      const { reason } = req.body;

      if (isNaN(verificationId)) {
        return res.status(400).json({ error: 'Invalid verification ID' });
      }

      if (!reason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      // TODO: Add admin role check

      await certificateVerification.rejectVerification(
        verificationId,
        uid,
        reason
      );

      logger.info('[BiometricCertificates] Admin rejected verification', { 
        verificationId, 
        adminUid: uid,
        reason 
      });

      res.json({
        success: true,
        message: 'Verification rejected'
      });

    } catch (error: any) {
      logger.error('[BiometricCertificates] Failed to reject verification', error);
      res.status(500).json({ error: 'Failed to reject verification', details: error.message });
    }
  }
);

/**
 * Record double consent for sensitive data processing
 * אישור כפול: מסמכים + ביומטריה
 * 
 * POST /api/biometric-certificates/consent
 */
router.post(
  '/consent',
  validateFirebaseToken,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.firebaseUser!;
      const { 
        verificationId,
        consentDocumentProcessing,
        consentBiometricProcessing,
        deviceFingerprint 
      } = req.body;

      if (typeof consentDocumentProcessing !== 'boolean' || typeof consentBiometricProcessing !== 'boolean') {
        return res.status(400).json({ error: 'Both consent flags are required' });
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      const consentId = await consentService.recordConsent({
        userId: uid,
        verificationId: verificationId ? parseInt(verificationId) : undefined,
        consentDocumentProcessing,
        consentBiometricProcessing,
        ipAddress,
        userAgent,
        deviceFingerprint
      });

      res.json({
        success: true,
        consentId,
        message: 'Consent recorded successfully'
      });

    } catch (error: any) {
      logger.error('[BiometricCertificates] Failed to record consent', error);
      res.status(500).json({ error: 'Failed to record consent' });
    }
  }
);

/**
 * Get user's consent status
 * 
 * GET /api/biometric-certificates/consent/status
 */
router.get(
  '/consent/status',
  validateFirebaseToken,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.firebaseUser!;
      const { verificationId } = req.query;

      const status = await consentService.getConsentStatus(
        uid,
        verificationId ? parseInt(verificationId as string) : undefined
      );

      res.json({
        success: true,
        consent: status
      });

    } catch (error: any) {
      logger.error('[BiometricCertificates] Failed to get consent status', error);
      res.status(500).json({ error: 'Failed to get consent status' });
    }
  }
);

/**
 * Revoke consent (GDPR compliance)
 * 
 * DELETE /api/biometric-certificates/consent
 */
router.delete(
  '/consent',
  validateFirebaseToken,
  async (req: Request, res: Response) => {
    try {
      const { uid } = req.firebaseUser!;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Revocation reason is required' });
      }

      await consentService.revokeConsent(uid, reason);

      res.json({
        success: true,
        message: 'Consent revoked successfully'
      });

    } catch (error: any) {
      logger.error('[BiometricCertificates] Failed to revoke consent', error);
      res.status(500).json({ error: 'Failed to revoke consent' });
    }
  }
);

export default router;
