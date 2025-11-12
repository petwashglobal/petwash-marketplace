import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and, desc, sql, or } from 'drizzle-orm';
import {
  documentCategories,
  secureDocuments,
  documentAccessLog,
  insertSecureDocumentSchema,
  type SecureDocument
} from '../../shared/schema-enterprise';
import { 
  loadUserRole, 
  checkPermission, 
  checkAccessLevel,
  type AuthenticatedRequest 
} from '../middleware/rbac';
import { logger } from '../lib/logger';
import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import { nanoid } from 'nanoid';

const router = Router();

// Configure Google Cloud Storage
let storage: Storage;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    storage = new Storage({ credentials });
  } else {
    storage = new Storage(); // Use default credentials in production
  }
} catch (error) {
  logger.error('Failed to initialize Google Cloud Storage:', error);
  storage = new Storage();
}

const GCS_BUCKET = 'petwash-secure-documents';

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// Apply authentication middleware to all routes
router.use(loadUserRole);

/**
 * Log document access attempt
 */
async function logAccess(
  documentId: number,
  userId: string,
  userEmail: string,
  userName: string | null,
  accessType: string,
  accessGranted: boolean,
  denialReason?: string,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await db.insert(documentAccessLog).values({
      documentId,
      userId,
      userEmail,
      userName,
      accessType,
      accessGranted,
      denialReason,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    logger.error('Failed to log document access:', error);
  }
}

/**
 * Check if user has access to a document
 */
function canAccessDocument(
  doc: SecureDocument,
  req: AuthenticatedRequest
): { granted: boolean; reason?: string } {
  const { userRole, firebaseUser } = req;

  if (!userRole || !firebaseUser) {
    return { granted: false, reason: 'Not authenticated' };
  }

  // Super admins can access everything
  if (userRole.isSuperAdmin) {
    return { granted: true };
  }

  // Check access level
  if (userRole.role.accessLevel < (doc.accessLevel || 0)) {
    return { 
      granted: false, 
      reason: `Insufficient access level (required: ${doc.accessLevel}, has: ${userRole.role.accessLevel})` 
    };
  }

  // Check if document is confidential and user has legal access
  if (doc.isConfidential && !userRole.role.canAccessLegal) {
    return { granted: false, reason: 'Document is confidential' };
  }

  // Check allowed roles
  if (doc.allowedRoles) {
    const allowedRoles = doc.allowedRoles as string[];
    if (!allowedRoles.includes(userRole.role.roleCode)) {
      return { granted: false, reason: 'Role not in allowed list' };
    }
  }

  // Check allowed user IDs
  if (doc.allowedUserIds) {
    const allowedUserIds = doc.allowedUserIds as string[];
    if (!allowedUserIds.includes(firebaseUser.uid)) {
      return { granted: false, reason: 'User ID not in allowed list' };
    }
  }

  // Check franchisee ownership
  if (doc.franchiseeId && userRole.assignment.franchiseeId !== doc.franchiseeId) {
    return { granted: false, reason: 'Document belongs to different franchisee' };
  }

  return { granted: true };
}

/**
 * GET /api/documents/categories - List document categories
 */
router.get('/categories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await db.select().from(documentCategories);
    
    // Filter categories based on user's department access
    const accessibleCategories = categories.filter(cat => {
      if (req.userRole?.isSuperAdmin) return true;
      
      const userDept = req.userRole?.role.department;
      return cat.department === userDept || cat.department === 'executive';
    });

    res.json({ categories: accessibleCategories });
  } catch (error) {
    logger.error('Error fetching document categories:', error);
    res.status(500).json({ error: 'Failed to fetch document categories' });
  }
});

/**
 * POST /api/documents/upload - Upload a new document
 */
router.post(
  '/upload',
  upload.single('file'),
  checkPermission('upload_documents'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Validate request body with Zod schema
      const documentData = insertSecureDocumentSchema.safeParse({
        categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : undefined,
        documentType: req.body.documentType,
        title: req.body.title,
        titleHe: req.body.titleHe || undefined,
        description: req.body.description || undefined,
        fileName: req.file.originalname,
        fileType: req.file.originalname.split('.').pop() || 'unknown',
        fileSize: req.file.size,
        fileMimeType: req.file.mimetype,
        franchiseeId: req.body.franchiseeId ? parseInt(req.body.franchiseeId) : undefined,
        stationId: req.body.stationId ? parseInt(req.body.stationId) : undefined,
        supplierId: req.body.supplierId || undefined,
        invoiceNumber: req.body.invoiceNumber || undefined,
        invoiceDate: req.body.invoiceDate || undefined,
        invoiceAmount: req.body.invoiceAmount || undefined,
        invoiceCurrency: req.body.invoiceCurrency || undefined,
        paymentStatus: req.body.paymentStatus || undefined,
        tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
        isConfidential: req.body.isConfidential === 'true' || req.body.isConfidential === true,
        accessLevel: req.body.accessLevel ? parseInt(req.body.accessLevel) : 5,
        allowedRoles: req.body.allowedRoles ? JSON.parse(req.body.allowedRoles) : undefined,
        allowedUserIds: req.body.allowedUserIds ? JSON.parse(req.body.allowedUserIds) : undefined,
        uploadedBy: req.firebaseUser!.uid,
        uploadedByEmail: req.firebaseUser!.email!,
        status: 'active',
      });

      if (!documentData.success) {
        logger.warn('Document upload validation failed:', documentData.error);
        return res.status(400).json({ 
          error: 'Invalid document data',
          details: documentData.error.errors
        });
      }

      const {
        categoryId,
        documentType,
        title,
        titleHe,
        description,
        supplierId,
        franchiseeId,
        stationId,
        invoiceNumber,
        invoiceDate,
        invoiceAmount,
        invoiceCurrency,
        paymentStatus,
        tags,
        isConfidential,
        accessLevel,
        allowedRoles,
        allowedUserIds,
      } = documentData.data;

      // Generate unique document number
      const documentNumber = `DOC-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;
      
      // Generate unique filename
      const fileExtension = req.file.originalname.split('.').pop();
      const uniqueFilename = `${documentNumber}-${nanoid(10)}.${fileExtension}`;

      // Upload to Google Cloud Storage
      const bucket = storage.bucket(GCS_BUCKET);
      const blob = bucket.file(`documents/${new Date().getFullYear()}/${uniqueFilename}`);
      
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: req.file.mimetype,
          metadata: {
            uploadedBy: req.firebaseUser?.email,
            originalName: req.file.originalname,
            documentNumber,
          },
        },
      });

      // Upload file to GCS
      await new Promise((resolve, reject) => {
        blobStream.on('error', reject);
        blobStream.on('finish', resolve);
        blobStream.end(req.file!.buffer);
      });

      // Make file private (not publicly accessible)
      await blob.makePrivate();

      // Get signed URL for access
      const [gcsUrl] = await blob.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      });

      // Create backup copy
      const backupBlob = bucket.file(`documents/backups/${uniqueFilename}`);
      await blob.copy(backupBlob);
      
      const [backupGcsUrl] = await backupBlob.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });

      // Insert document record
      const [newDocument] = await db.insert(secureDocuments).values({
        documentNumber,
        categoryId: categoryId!,
        documentType,
        title,
        titleHe: titleHe || undefined,
        description: description || undefined,
        fileName: req.file.originalname,
        fileType: fileExtension!,
        fileSize: req.file.size,
        fileMimeType: req.file.mimetype,
        gcsUrl,
        backupGcsUrl: backupGcsUrl,
        localPath: undefined,
        franchiseeId,
        stationId,
        supplierId,
        invoiceNumber,
        invoiceDate,
        invoiceAmount,
        invoiceCurrency,
        paymentStatus,
        tags,
        relatedDocumentIds: undefined,
        isConfidential,
        accessLevel,
        allowedRoles,
        allowedUserIds,
        uploadedBy: req.firebaseUser!.uid,
        uploadedByEmail: req.firebaseUser!.email!,
        version: 1,
        previousVersionId: undefined,
        status: 'active',
      }).returning();

      // Log document creation
      await logAccess(
        newDocument.id,
        req.firebaseUser!.uid,
        req.firebaseUser!.email!,
        null, // displayName not available in minimal user type
        'upload',
        true,
        undefined,
        req.ip,
        req.get('user-agent')
      );

      logger.info(`Document uploaded: ${documentNumber} by ${req.firebaseUser?.email}`);
      
      res.status(201).json({ 
        document: newDocument,
        message: 'Document uploaded and backed up successfully'
      });
    } catch (error) {
      logger.error('Error uploading document:', error);
      
      // Log failed upload attempt if we have user info
      if (req.firebaseUser) {
        await logAccess(
          0, // No document ID yet
          req.firebaseUser.uid,
          req.firebaseUser.email!,
          null,
          'upload',
          false,
          error instanceof Error ? error.message : 'Upload failed',
          req.ip,
          req.get('user-agent')
        ).catch(err => logger.error('Failed to log upload error:', err));
      }
      
      res.status(500).json({ error: 'Failed to upload document' });
    }
  }
);

/**
 * GET /api/documents - List documents (with filtering and access control)
 */
router.get('/', checkPermission('view_documents'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { 
      categoryId, 
      documentType, 
      status, 
      supplierId,
      franchiseeId,
      search,
      limit = 50,
      offset = 0
    } = req.query;

    let query = db
      .select({
        document: secureDocuments,
        category: documentCategories,
      })
      .from(secureDocuments)
      .leftJoin(documentCategories, eq(secureDocuments.categoryId, documentCategories.id))
      .where(eq(secureDocuments.status, 'active'));

    // Apply filters
    const conditions: any[] = [eq(secureDocuments.status, status as string || 'active')];

    if (categoryId) {
      conditions.push(eq(secureDocuments.categoryId, parseInt(categoryId as string)));
    }
    if (documentType) {
      conditions.push(eq(secureDocuments.documentType, documentType as string));
    }
    if (supplierId) {
      conditions.push(eq(secureDocuments.supplierId, supplierId as string));
    }
    if (franchiseeId) {
      conditions.push(eq(secureDocuments.franchiseeId, parseInt(franchiseeId as string)));
    }
    
    // For non-super-admins, only show documents they have access to
    if (!req.userRole?.isSuperAdmin) {
      if (req.userRole?.assignment.franchiseeId) {
        conditions.push(
          or(
            eq(secureDocuments.franchiseeId, req.userRole.assignment.franchiseeId),
            sql`${secureDocuments.franchiseeId} IS NULL`
          )
        );
      }
    }

    const results = await db
      .select({
        document: secureDocuments,
        category: documentCategories,
      })
      .from(secureDocuments)
      .leftJoin(documentCategories, eq(secureDocuments.categoryId, documentCategories.id))
      .where(and(...conditions))
      .orderBy(desc(secureDocuments.uploadedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Filter based on access control
    const accessibleDocuments = results.filter(({ document }) => {
      const access = canAccessDocument(document, req);
      return access.granted;
    });

    res.json({ 
      documents: accessibleDocuments,
      total: accessibleDocuments.length
    });
  } catch (error) {
    logger.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * GET /api/documents/:id - Get specific document details
 */
router.get('/:id', checkPermission('view_documents'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = parseInt(req.params.id);

    const [result] = await db
      .select({
        document: secureDocuments,
        category: documentCategories,
      })
      .from(secureDocuments)
      .leftJoin(documentCategories, eq(secureDocuments.categoryId, documentCategories.id))
      .where(eq(secureDocuments.id, documentId))
      .limit(1);

    if (!result) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access
    const access = canAccessDocument(result.document, req);
    
    // Log access attempt
    await logAccess(
      documentId,
      req.firebaseUser!.uid,
      req.firebaseUser!.email!,
      null, // displayName not available in minimal user type
      'view',
      access.granted,
      access.reason,
      req.ip,
      req.get('user-agent')
    );

    if (!access.granted) {
      return res.status(403).json({ 
        error: 'Access denied',
        reason: access.reason
      });
    }

    res.json({ document: result.document, category: result.category });
  } catch (error) {
    logger.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

/**
 * GET /api/documents/:id/download - Download document
 */
router.get('/:id/download', checkPermission('view_documents'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = parseInt(req.params.id);

    const [doc] = await db
      .select()
      .from(secureDocuments)
      .where(eq(secureDocuments.id, documentId))
      .limit(1);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access
    const access = canAccessDocument(doc, req);
    
    // Log access attempt
    await logAccess(
      documentId,
      req.firebaseUser!.uid,
      req.firebaseUser!.email!,
      null, // displayName not available in minimal user type
      'download',
      access.granted,
      access.reason,
      req.ip,
      req.get('user-agent')
    );

    if (!access.granted) {
      return res.status(403).json({ 
        error: 'Access denied',
        reason: access.reason
      });
    }

    // Return the signed URL for download
    res.json({ 
      downloadUrl: doc.gcsUrl,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.fileMimeType
    });
  } catch (error) {
    logger.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

/**
 * DELETE /api/documents/:id - Delete document (soft delete)
 */
router.delete('/:id', checkPermission('delete_documents'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const documentId = parseInt(req.params.id);

    const [doc] = await db
      .select()
      .from(secureDocuments)
      .where(eq(secureDocuments.id, documentId))
      .limit(1);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access
    const access = canAccessDocument(doc, req);
    
    // Log access attempt
    await logAccess(
      documentId,
      req.firebaseUser!.uid,
      req.firebaseUser!.email!,
      null, // displayName not available in minimal user type
      'delete',
      access.granted,
      access.reason,
      req.ip,
      req.get('user-agent')
    );

    if (!access.granted) {
      return res.status(403).json({ 
        error: 'Access denied',
        reason: access.reason
      });
    }

    // Soft delete
    await db
      .update(secureDocuments)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(secureDocuments.id, documentId));

    logger.info(`Document deleted: ${doc.documentNumber} by ${req.firebaseUser?.email}`);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

/**
 * GET /api/documents/:id/access-log - Get document access history
 */
router.get(
  '/:id/access-log',
  checkAccessLevel(8),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);

      const logs = await db
        .select()
        .from(documentAccessLog)
        .where(eq(documentAccessLog.documentId, documentId))
        .orderBy(desc(documentAccessLog.accessedAt))
        .limit(100);

      res.json({ logs });
    } catch (error) {
      logger.error('Error fetching access log:', error);
      res.status(500).json({ error: 'Failed to fetch access log' });
    }
  }
);

export default router;
