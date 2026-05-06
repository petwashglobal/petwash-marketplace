// KYC API Routes
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { storage, auth, db as firestoreDb } from '../lib/firebase-admin';
import { db } from '../db';
import { kycQuarantineObjects, kycEvents } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { isBiometricDocType } from '../../shared/kycDocTypes';
import {
  hashIdNumber,
  checkDuplicateId,
  getKYCDocument,
  updateKYCDocument,
  validateKYCFile,
  getPendingKYCSubmissions,
  approveKYC,
  rejectKYC,
  isTrustedCountry,
  TRUSTED_COUNTRIES,
  type KYCType
} from '../kyc';
import { logger } from '../lib/logger';
import { loadUserRole, checkAccessLevel, type AuthenticatedRequest } from '../middleware/rbac';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { petWashOrchestrator } from '../services/PetWashOperationsOrchestrator';
import { logAuditEvent } from '../middleware/auditLog';

/** PR-W34p: kyc admin audit. */
function emitKycAdminAudit(params: {
  actionType: string;
  actorUserId: string | null | undefined;
  targetType: string;
  targetId: string | number | null | undefined;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}): void {
  setImmediate(() => {
    logAuditEvent({
      actorUserId: params.actorUserId ?? undefined,
      actorRole: 'admin',
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId != null ? String(params.targetId) : undefined,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: params.metadata ?? {},
    }).catch(() => {});
  });
}

const router = Router();

// SECURITY FIX: Use RBAC instead of hardcoded email check
// Admin authentication middleware - requires level 8+ access (admin/executive)
const requireAdmin = [
  validateFirebaseToken, // Verify Firebase token and email_verified
  loadUserRole,           // Load user role from RBAC system
  checkAccessLevel(8),    // Require minimum access level 8 (admin/executive)
  // Propagate verified admin UID to req.body for downstream handlers
  (req: Request, res: Response, next: Function) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.firebaseUser?.uid) {
      req.body.adminUid = authReq.firebaseUser.uid;
    }
    next();
  }
];

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Upload KYC document  
// SECURITY: Requires Firebase authentication - users can only upload their own KYC
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    // SECURITY: Verify Firebase authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    let authenticatedUid: string;
    
    try {
      const decodedToken = await auth.verifyIdToken(token, true);
      authenticatedUid = decodedToken.uid;
    } catch (authError) {
      logger.error('KYC upload auth error', authError);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
    const { uid } = req.body;
    const { type, countryCode, idNumber, nameOnDoc, dob } = req.body;
    const file = req.file;

    if (!uid || !type || !file) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // SECURITY: Users can only upload KYC for their own account
    if (uid !== authenticatedUid) {
      logger.warn('KYC upload attempt for different user', { authenticatedUid, requestedUid: uid });
      return res.status(403).json({ error: 'Forbidden - Can only upload KYC for your own account' });
    }

    // Validate country code for international documents
    if (countryCode) {
      const upperCountryCode = countryCode.toUpperCase();
      if (!isTrustedCountry(upperCountryCode)) {
        return res.status(400).json({ 
          error: `Document verification is currently available only for the following countries: ${TRUSTED_COUNTRIES.join(', ')}`,
          code: 'UNTRUSTED_COUNTRY'
        });
      }
    }

    // Validate file
    const validation = validateKYCFile({ mimetype: file.mimetype, size: file.size });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Hash ID number if provided
    let idHash = '';
    if (countryCode && idNumber) {
      idHash = hashIdNumber(countryCode, idNumber);

      // Check for duplicates
      const duplicate = await checkDuplicateId(idHash);
      if (duplicate.exists && duplicate.uid !== uid) {
        return res.status(409).json({ 
          error: 'This ID has already been verified with another account',
          code: 'DUPLICATE_ID'
        });
      }
    }

    // Upload to Firebase Storage — random filename: no document type, timestamp, or original name
    const bucket = storage.bucket();
    const fileName = `users/${uid}/kyc/${nanoid(24)}`;
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    logger.info(`KYC file uploaded: ${fileName}`);

    // Register file in quarantine — must be deleted within 24h
    const deleteBy = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      await db.insert(kycQuarantineObjects).values({
        objectKey: fileName,
        userId: uid,
        documentType: type,
        storageSystem: 'firebase_storage',
        deleteBy,
      });
    } catch (qErr) {
      logger.error('[KYC] Quarantine insert failed — file uploaded but not tracked:', qErr);
    }

    // Audit event
    try {
      await db.insert(kycEvents).values({
        userId: uid,
        eventType: 'upload',
        actor: uid,
        result: 'success',
        sourceIp: req.ip ?? null,
      });
    } catch (aErr) {
      logger.warn('[KYC] Audit event insert failed on upload:', aErr);
    }

    // Create/update KYC document in Firestore
    const kycData = {
      type: type as KYCType,
      status: 'pending' as const,
      submittedAt: new Date(),
      reviewedAt: null,
      reviewerUid: null,
      docPaths: [fileName],
      idHash,
      nameOnDoc: nameOnDoc || undefined,
      dob: dob || undefined,
      countryCode: countryCode?.toUpperCase() || undefined,
      documentNumber: undefined, // Never store raw document numbers
      expiresAt: null,
      notes: ''
    };

    await updateKYCDocument(uid, kycData);

    logger.info(`KYC document created for user ${uid}`);

    res.json({
      success: true,
      message: 'Document uploaded successfully. Under review.',
      filePath: fileName
    });

    setImmediate(() => petWashOrchestrator.handleKYCSubmission({
      userId: uid,
      fullName: nameOnDoc || uid,
      email: 'noreply@petwash.co.il',
      docType: type,
      countryCode: countryCode?.toUpperCase() || 'IL',
      idNumber: idNumber ? '[hashed]' : undefined,
      idDocUrl: fileName,
      status: 'submitted',
      source: 'kyc_v1',
    }).catch(e => logger.warn('[KYC] Orchestrator hook error', e)));
  } catch (error: any) {
    logger.error('KYC upload error', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// Get user's KYC status — requires Firebase auth; users can only query their own UID
router.get('/status/:uid', async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;

    // Authenticate — extract and verify Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    let callerUid: string;
    try {
      const decoded = await auth.verifyIdToken(authHeader.split('Bearer ')[1], true);
      callerUid = decoded.uid;
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Users can only check their own KYC status; admins can check any
    // (admin check relies on the separate /admin/* routes with requireAdmin)
    if (callerUid !== uid) {
      return res.status(403).json({ error: 'Forbidden — you can only check your own KYC status' });
    }

    const kycDoc = await getKYCDocument(uid);
    
    if (!kycDoc) {
      return res.json({ status: null });
    }

    // Don't send sensitive data to client
    const safeDoc = {
      type: kycDoc.type,
      status: kycDoc.status,
      submittedAt: kycDoc.submittedAt,
      reviewedAt: kycDoc.reviewedAt,
      expiresAt: kycDoc.expiresAt,
      rejectionReason: kycDoc.rejectionReason
    };

    res.json(safeDoc);
  } catch (error: any) {
    logger.error('Get KYC status error', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get pending submissions
router.get('/admin/pending', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const pending = await getPendingKYCSubmissions(limit);

    res.json({ submissions: pending });
  } catch (error: any) {
    logger.error('Get pending submissions error', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Approve KYC
router.post('/admin/approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { uid, expiryYears, adminUid } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use verified admin UID from middleware
    const reviewerUid = adminUid;

    // Calculate expiry date if provided
    let expiresAt: Date | undefined;
    if (expiryYears) {
      expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + parseInt(expiryYears));
    }

    // Get docPaths before approving (approveKYC does not clear them)
    const kycDocBeforeApprove = await getKYCDocument(uid);
    const docPathsToDelete = kycDocBeforeApprove?.docPaths || [];

    await approveKYC(uid, reviewerUid, expiresAt);

    // Immediately delete raw identity files from Firebase Storage
    const kycBucket = storage.bucket();
    for (const filePath of docPathsToDelete) {
      try {
        await kycBucket.file(filePath).delete();
        logger.info(`[KYC] Deleted file on approve: ${filePath}`);
      } catch (delErr: any) {
        if (delErr.code !== 404) {
          logger.warn(`[KYC] Failed to delete ${filePath} on approve:`, delErr);
        }
      }
    }

    // Clear Firestore docPaths and mark documents as deleted
    try {
      await firestoreDb.collection('users').doc(uid).update({
        'kyc.docPaths': [],
        'kyc.documentsDeleted': true,
      });
    } catch (fsErr) {
      logger.warn(`[KYC] Firestore docPaths clear failed for uid=${uid}:`, fsErr);
    }

    // Mark quarantine rows as completed
    try {
      await db
        .update(kycQuarantineObjects)
        .set({ deletionStatus: 'completed', deletedAt: new Date() })
        .where(and(eq(kycQuarantineObjects.userId, uid), eq(kycQuarantineObjects.deletionStatus, 'pending')));
    } catch (qErr) {
      logger.warn('[KYC] Quarantine update failed on approve:', qErr);
    }

    // Audit event
    try {
      await db.insert(kycEvents).values({
        userId: uid,
        eventType: 'approved',
        actor: reviewerUid,
        result: 'success',
        reason: `Files deleted: ${docPathsToDelete.length}`,
        sourceIp: req.ip ?? null,
      });
    } catch (aErr) {
      logger.warn('[KYC] Audit event insert failed on approve:', aErr);
    }

    logger.info(`KYC approved for user ${uid} by ${reviewerUid}`);

    emitKycAdminAudit({
      actionType: 'KYC_APPROVE',
      actorUserId: reviewerUid,
      targetType: 'kyc_subject',
      targetId: uid,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { expiresAt: expiresAt?.toISOString() ?? null, deletedFileCount: docPathsToDelete.length },
    });

    res.json({ success: true, message: 'KYC approved successfully' });
  } catch (error: any) {
    logger.error('Approve KYC error', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Reject KYC
router.post('/admin/reject', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { uid, reason, adminUid } = req.body;

    if (!uid || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use verified admin UID from middleware
    const reviewerUid = adminUid;

    // Get docPaths before rejecting (rejectKYC does not clear them)
    const kycDocBeforeReject = await getKYCDocument(uid);
    const docPathsToDeleteOnReject = kycDocBeforeReject?.docPaths || [];

    await rejectKYC(uid, reviewerUid, reason);

    // Immediately delete raw identity files from Firebase Storage
    const kycBucketReject = storage.bucket();
    for (const filePath of docPathsToDeleteOnReject) {
      try {
        await kycBucketReject.file(filePath).delete();
        logger.info(`[KYC] Deleted file on reject: ${filePath}`);
      } catch (delErr: any) {
        if (delErr.code !== 404) {
          logger.warn(`[KYC] Failed to delete ${filePath} on reject:`, delErr);
        }
      }
    }

    // Clear Firestore docPaths and mark documents as deleted
    try {
      await firestoreDb.collection('users').doc(uid).update({
        'kyc.docPaths': [],
        'kyc.documentsDeleted': true,
      });
    } catch (fsErr) {
      logger.warn(`[KYC] Firestore docPaths clear failed for uid=${uid}:`, fsErr);
    }

    // Mark quarantine rows as completed
    try {
      await db
        .update(kycQuarantineObjects)
        .set({ deletionStatus: 'completed', deletedAt: new Date() })
        .where(and(eq(kycQuarantineObjects.userId, uid), eq(kycQuarantineObjects.deletionStatus, 'pending')));
    } catch (qErr) {
      logger.warn('[KYC] Quarantine update failed on reject:', qErr);
    }

    // Audit event
    try {
      await db.insert(kycEvents).values({
        userId: uid,
        eventType: 'rejected',
        actor: reviewerUid,
        result: 'rejected',
        reason,
        sourceIp: req.ip ?? null,
      });
    } catch (aErr) {
      logger.warn('[KYC] Audit event insert failed on reject:', aErr);
    }

    logger.info(`KYC rejected for user ${uid} by ${reviewerUid}: ${reason}`);

    emitKycAdminAudit({
      actionType: 'KYC_REJECT',
      actorUserId: reviewerUid,
      targetType: 'kyc_subject',
      targetId: uid,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      metadata: { reason, deletedFileCount: docPathsToDeleteOnReject.length },
    });

    res.json({ success: true, message: 'KYC rejected' });
  } catch (error: any) {
    logger.error('Reject KYC error', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get signed URL for viewing document
router.get('/admin/document/:uid', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    
    const kycDoc = await getKYCDocument(uid);

    if (!kycDoc) {
      return res.status(404).json({ error: 'No KYC submission found' });
    }

    // Documents have already been deleted after review
    if ((kycDoc as any).documentsDeleted === true || !kycDoc.docPaths || kycDoc.docPaths.length === 0) {
      return res.json({ deleted: true });
    }

    // Generate signed URLs for viewing (max 15 minutes — temporary review only)
    const bucket = storage.bucket();
    const urls: string[] = [];

    for (const path of kycDoc.docPaths) {
      const file = bucket.file(path);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      });
      urls.push(url);
    }

    res.json({ urls });
  } catch (error: any) {
    logger.error('Get document URL error', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete KYC data (GDPR compliance)
// SECURITY: Users can delete their own KYC data, or admins (access level 8+) can delete any
router.delete('/delete/:uid', validateFirebaseToken, loadUserRole, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const authenticatedUid = authReq.firebaseUser?.uid;
    const { uid } = req.params;
    
    if (!authenticatedUid) {
      return res.status(401).json({ error: 'Unauthorized - Authentication required' });
    }
    
    // Check if user is deleting their own data OR is an admin
    const isSelfDelete = uid === authenticatedUid;
    const isAdmin = authReq.userRole && authReq.userRole.assignment.accessLevel >= 8;
    
    if (!isSelfDelete && !isAdmin) {
      logger.warn('KYC delete attempt for different user', { authenticatedUid, requestedUid: uid, isAdmin });
      return res.status(403).json({ error: 'Forbidden - Can only delete your own KYC data' });
    }
    
    logger.info(`KYC delete authorized for user ${uid} by ${isSelfDelete ? 'self' : 'admin'} ${authenticatedUid}`);
    
    // Get KYC document
    const kycDoc = await getKYCDocument(uid);
    
    if (kycDoc) {
      // Delete files from Storage
      const bucket = storage.bucket();
      for (const path of kycDoc.docPaths) {
        try {
          await bucket.file(path).delete();
          logger.info(`️ Deleted KYC file: ${path}`);
        } catch (error) {
          logger.error(`Failed to delete file ${path}:`, error);
        }
      }

      // Mark as deleted in Firestore (keep hash for duplicate prevention)
      await updateKYCDocument(uid, {
        status: 'deleted',
        docPaths: [],
        nameOnDoc: undefined,
        dob: undefined,
        notes: isAdmin && !isSelfDelete
          ? `Admin ${authenticatedUid} deleted KYC data` 
          : 'User requested data deletion'
      });

      logger.info(`KYC data deleted for user ${uid}`);
    }

    res.json({ success: true, message: 'KYC data deleted successfully' });
  } catch (error: any) {
    logger.error('Delete KYC error', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
