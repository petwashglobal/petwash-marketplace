// KYC API Routes
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { storage, auth } from '../lib/firebase-admin';
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

const router = Router();

const ADMIN_EMAIL = 'nirhadad1@gmail.com';

// Admin authentication middleware
async function requireAdmin(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    if (decodedToken.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    req.body.adminUid = decodedToken.uid;
    next();
  } catch (error) {
    logger.error('Admin auth error', error);
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
}

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
      const decodedToken = await auth.verifyIdToken(token);
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

    // Upload to Firebase Storage
    const bucket = storage.bucket('gs://signinpetwash.firebasestorage.app');
    const fileName = `users/${uid}/kyc/${type}_${Date.now()}_${file.originalname}`;
    const fileUpload = bucket.file(fileName);

    await fileUpload.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    logger.info(`KYC file uploaded: ${fileName}`);

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
  } catch (error: any) {
    logger.error('KYC upload error', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// Get user's KYC status
router.get('/status/:uid', async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    
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

    await approveKYC(uid, reviewerUid, expiresAt);

    logger.info(`KYC approved for user ${uid} by ${reviewerUid}`);

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

    await rejectKYC(uid, reviewerUid, reason);

    logger.info(`KYC rejected for user ${uid} by ${reviewerUid}: ${reason}`);

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
    
    if (!kycDoc || !kycDoc.docPaths || kycDoc.docPaths.length === 0) {
      return res.status(404).json({ error: 'No documents found' });
    }

    // Generate signed URLs for viewing
    const bucket = storage.bucket('gs://signinpetwash.firebasestorage.app');
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
// SECURITY: Users can delete their own KYC data, or admins can delete any
router.delete('/delete/:uid', async (req: Request, res: Response) => {
  try {
    // SECURITY: Verify Firebase authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    let authenticatedUid: string;
    let isAdmin = false;
    
    try {
      const decodedToken = await auth.verifyIdToken(token);
      authenticatedUid = decodedToken.uid;
      isAdmin = decodedToken.email === ADMIN_EMAIL;
    } catch (authError) {
      logger.error('KYC delete auth error', authError);
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
    const { uid } = req.params;
    
    // SECURITY: Users can only delete their own KYC, admins can delete any
    if (uid !== authenticatedUid && !isAdmin) {
      logger.warn('KYC delete attempt for different user', { authenticatedUid, requestedUid: uid, isAdmin });
      return res.status(403).json({ error: 'Forbidden - Can only delete your own KYC data' });
    }
    
    // Get KYC document
    const kycDoc = await getKYCDocument(uid);
    
    if (kycDoc) {
      // Delete files from Storage
      const bucket = storage.bucket('gs://signinpetwash.firebasestorage.app');
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
        notes: 'User requested data deletion'
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
