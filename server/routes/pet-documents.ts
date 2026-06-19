/**
 * Pet Passport — Document Vault (Phase 1, 2026-06-20)
 * =====================================================
 * Owner-uploaded pet documents (vaccine card, pedigree, insurance, microchip
 * certificate, etc.). Reuses the contractor-documents security pattern but is
 * Firestore-backed (pets live in Firestore: users/{uid}/pets/{petId}).
 *
 * STRICT GUARANTEES (per Phase-1 spec + Israeli Privacy Protection Law):
 *  - PRIVATE storage: files are stored in GCS WITHOUT makePublic(). They are
 *    only reachable through a short-lived (15 min) signed view URL.
 *  - ACCESS LOGGED: every signed-URL issuance is written to an append-only
 *    accessLog subcollection (who / when / action) AND to the audit_events
 *    table. There is no un-logged read path.
 *  - OWNER-DECLARED wording only: the API never asserts a document is legally
 *    valid, verified, or authentic. status is informational ('active' /
 *    'expired') and titles/types are owner-declared.
 *  - Ownership enforced: validateFirebaseToken + the document is namespaced
 *    under the caller's own uid; no cross-user path is reachable.
 *
 * No SQL migration: storage is Firestore (schemaless) + GCS. The file hash
 * (sha256) is stored for integrity, not as a legal-validity claim.
 */
import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import admin, { db as firestore } from '../lib/firebase-admin';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { FIRESTORE_PATHS } from '@shared/firestore-schema';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../middleware/auditLog';
import { getClientIP } from '../services/alerts';

const router = Router();

// Owner-declared document types. 'other' is the catch-all. These are labels the
// owner picks — they carry NO verification or legal meaning.
const DOC_TYPES = [
  'vaccine_card',
  'pedigree',
  'insurance',
  'microchip_certificate',
  'vet_record',
  'adoption_paper',
  'other',
] as const;

// Document visibility. Default owner_only. provider_if_booking is a future-facing
// flag (Phase 1 never auto-exposes anything to a provider); admin_only is for
// records the owner wants kept but not surfaced to providers.
const VISIBILITIES = ['owner_only', 'provider_if_booking', 'admin_only'] as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WEBP and PDF files are allowed'));
  },
});

function gcsBucket() {
  return admin.storage().bucket();
}

/** Verify the pet belongs to the caller. Returns the pet name, or null if absent. */
async function getOwnedPetName(uid: string, petId: string): Promise<string | null> {
  const doc = await firestore.doc(FIRESTORE_PATHS.PETS(uid, petId)).get();
  if (!doc.exists || doc.data()?.deletedAt) return null;
  return (doc.data()?.name as string) || 'Pet';
}

// ───────────────────────────────────────────────────────────────────────────
// POST /api/pet-documents/:petId  — upload a document (PRIVATE)
// ───────────────────────────────────────────────────────────────────────────
router.post('/:petId', validateFirebaseToken, (req, res, next) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      const msg = err?.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum size is 15MB.'
        : (err.message || 'Invalid file');
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId } = req.params;
    const { documentType, title, issueDate, expiryDate, visibility } = req.body;

    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    if (!documentType || !DOC_TYPES.includes(documentType)) {
      return res.status(400).json({ error: 'Invalid documentType' });
    }
    if (!title || String(title).trim().length === 0) {
      return res.status(400).json({ error: 'A title is required' });
    }
    const vis = VISIBILITIES.includes(visibility) ? visibility : 'owner_only';

    const petName = await getOwnedPetName(uid, petId);
    if (petName === null) return res.status(404).json({ error: 'Pet not found' });

    // sha256 of the bytes — integrity reference only, NOT a legal-validity claim.
    const fileHashSha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    const ext = req.file.mimetype === 'application/pdf' ? 'pdf'
      : req.file.mimetype === 'image/png' ? 'png'
      : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const fileId = `${Date.now()}_${nanoid(10)}`;
    // PRIVATE path — namespaced under the owner uid; never made public.
    const objectPath = `pet-documents/${uid}/${petId}/${fileId}.${ext}`;

    await gcsBucket().file(objectPath).save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          uploadedBy: uid,
          petId,
          documentType,
          uploadedAt: new Date().toISOString(),
          // Make it explicit at the storage layer too: owner-declared, not verified.
          ownerDeclared: 'true',
          fileHashSha256,
        },
      },
    });

    const docRef = firestore.collection(FIRESTORE_PATHS.PET_DOCUMENTS(uid, petId)).doc();
    const record = {
      id: docRef.id,
      petId,
      uid,
      documentType,
      title: String(title).trim().slice(0, 160),
      issueDate: issueDate || null,
      expiryDate: expiryDate || null,
      // 'active' / 'expired' are derived from expiryDate at read time. No
      // 'verified' state exists — these are OWNER-DECLARED documents.
      ownerDeclared: true,
      visibility: vis,
      objectPath,                 // private GCS path; never returned to the client
      fileMime: req.file.mimetype,
      fileSizeBytes: req.file.size,
      fileHashSha256,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    await docRef.set(record);

    await logAuditEvent({
      actorUserId: uid,
      actionType: 'PET_DOCUMENT_UPLOAD',
      targetType: 'pet_document',
      targetId: docRef.id,
      ip: getClientIP(req),
      userAgent: req.headers['user-agent'] || '',
      metadata: { petId, documentType, visibility: vis, fileHashSha256 },
    });

    logger.info('[PetDocuments] Document uploaded', { uid, petId, docId: docRef.id, documentType });
    // Never leak objectPath to the client.
    const { objectPath: _omit, ...safe } = record;
    return res.status(201).json({ success: true, document: safe });
  } catch (error) {
    logger.error('[PetDocuments] Upload failed', error);
    return res.status(500).json({ error: 'Failed to upload document' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /api/pet-documents/:petId  — list documents (metadata only, no file URL)
// ───────────────────────────────────────────────────────────────────────────
router.get('/:petId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId } = req.params;

    const petName = await getOwnedPetName(uid, petId);
    if (petName === null) return res.status(404).json({ error: 'Pet not found' });

    const snap = await firestore
      .collection(FIRESTORE_PATHS.PET_DOCUMENTS(uid, petId))
      .orderBy('createdAt', 'desc')
      .get();

    const now = Date.now();
    const documents = snap.docs
      .map((d) => d.data())
      .filter((d) => !d.deletedAt)
      .map((d: any) => {
        const expired = d.expiryDate ? new Date(d.expiryDate).getTime() < now : false;
        const { objectPath, uid: _u, ...rest } = d; // strip private path
        return { ...rest, status: expired ? 'expired' : 'active' };
      });

    return res.json({ documents });
  } catch (error) {
    logger.error('[PetDocuments] List failed', error);
    return res.status(500).json({ error: 'Failed to list documents' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /api/pet-documents/:petId/:docId/view-url  — short-lived signed URL.
// ACCESS-LOGGED: every issuance is recorded (accessLog subcollection + audit).
// ───────────────────────────────────────────────────────────────────────────
router.get('/:petId/:docId/view-url', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId, docId } = req.params;

    const petName = await getOwnedPetName(uid, petId);
    if (petName === null) return res.status(404).json({ error: 'Pet not found' });

    const docRef = firestore.doc(FIRESTORE_PATHS.PET_DOCUMENTS(uid, petId, docId));
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.deletedAt) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const data = doc.data()!;

    // Short-lived (15 min) inline signed URL — the ONLY way to read the file.
    const [url] = await gcsBucket().file(data.objectPath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
      responseDisposition: 'inline',
    });

    // Append-only access log entry — who/when/action.
    const ip = getClientIP(req);
    const ua = req.headers['user-agent'] || '';
    await firestore
      .collection(FIRESTORE_PATHS.PET_DOCUMENT_ACCESS_LOG(uid, petId, docId))
      .add({ accessedBy: uid, action: 'view', at: new Date(), ip, userAgent: ua });

    await logAuditEvent({
      actorUserId: uid,
      actionType: 'PET_DOCUMENT_VIEW',
      targetType: 'pet_document',
      targetId: docId,
      ip,
      userAgent: ua,
      metadata: { petId, documentType: data.documentType },
    });

    logger.info('[PetDocuments] View URL issued', { uid, petId, docId });
    return res.json({ url, expiresInSeconds: 900 });
  } catch (error) {
    logger.error('[PetDocuments] View URL failed', error);
    return res.status(500).json({ error: 'Failed to issue view URL' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// PATCH /api/pet-documents/:petId/:docId  — edit owner-declared metadata
// ───────────────────────────────────────────────────────────────────────────
router.patch('/:petId/:docId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId, docId } = req.params;

    const petName = await getOwnedPetName(uid, petId);
    if (petName === null) return res.status(404).json({ error: 'Pet not found' });

    const docRef = firestore.doc(FIRESTORE_PATHS.PET_DOCUMENTS(uid, petId, docId));
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.deletedAt) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (typeof req.body.title === 'string') updates.title = req.body.title.trim().slice(0, 160);
    if (req.body.documentType && DOC_TYPES.includes(req.body.documentType)) updates.documentType = req.body.documentType;
    if ('issueDate' in req.body) updates.issueDate = req.body.issueDate || null;
    if ('expiryDate' in req.body) updates.expiryDate = req.body.expiryDate || null;
    if (req.body.visibility && VISIBILITIES.includes(req.body.visibility)) updates.visibility = req.body.visibility;

    await docRef.update(updates);

    await logAuditEvent({
      actorUserId: uid,
      actionType: 'PET_DOCUMENT_UPDATE',
      targetType: 'pet_document',
      targetId: docId,
      ip: getClientIP(req),
      userAgent: req.headers['user-agent'] || '',
      metadata: { petId, fields: Object.keys(updates) },
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('[PetDocuments] Update failed', error);
    return res.status(500).json({ error: 'Failed to update document' });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// DELETE /api/pet-documents/:petId/:docId  — soft-delete + remove the file
// ───────────────────────────────────────────────────────────────────────────
router.delete('/:petId/:docId', validateFirebaseToken, async (req, res) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { petId, docId } = req.params;

    const petName = await getOwnedPetName(uid, petId);
    if (petName === null) return res.status(404).json({ error: 'Pet not found' });

    const docRef = firestore.doc(FIRESTORE_PATHS.PET_DOCUMENTS(uid, petId, docId));
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.deletedAt) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const data = doc.data()!;

    // Remove the underlying private file (best-effort), then soft-delete the record.
    try {
      await gcsBucket().file(data.objectPath).delete();
    } catch (e) {
      logger.warn('[PetDocuments] Could not delete GCS object', { docId, e });
    }
    await docRef.update({ deletedAt: new Date(), updatedAt: new Date() });

    await logAuditEvent({
      actorUserId: uid,
      actionType: 'PET_DOCUMENT_DELETE',
      targetType: 'pet_document',
      targetId: docId,
      ip: getClientIP(req),
      userAgent: req.headers['user-agent'] || '',
      metadata: { petId },
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('[PetDocuments] Delete failed', error);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
