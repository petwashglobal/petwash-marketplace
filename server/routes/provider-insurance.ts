/**
 * Provider insurance + health-declaration endpoints (legal shield, migration 0051).
 *
 * Providers are the PRIMARY risk-bearers (Rover/Mad Paws model). Before a provider
 * is payout-ready we must hold valid, in-date proof: liability insurance + a signed
 * health/liability declaration. These endpoints let a provider submit those docs,
 * let an admin verify them, and expose a single clearance gate the activation /
 * payout flow checks.
 *
 * Privacy: we store METADATA + a private GCS file ref + a SHA-256 hash of the doc —
 * never the document body inline. Files go to the private bucket (signed-URL access
 * is the existing admin-gated path).
 */
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { providerInsuranceDocuments } from '@shared/schema';
import { requireAuth } from '../customAuth';
import { requireAdmin } from '../adminAuth';
import { requireValidFileContent } from '../lib/fileMagicValidation';
import { storage } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

const router = Router();

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const DOC_TYPES = [
  'liability_insurance', 'professional_indemnity', 'health_declaration',
  'bituach_leumi', 'liability_acknowledgment', 'police_check_cert', 'other',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, HEIC, PDF allowed'));
  },
});

/**
 * Clearance gate — true only when the provider holds an ACTIVE, non-expired
 * liability cover AND a health/liability declaration. The activation / payout
 * flow calls this so an uninsured provider can't be made payout-ready.
 */
export async function isProviderInsuranceCleared(providerId: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(providerInsuranceDocuments)
    .where(eq(providerInsuranceDocuments.providerId, providerId));
  const now = Date.now();
  const active = (types: string[]) =>
    rows.some(
      (r) =>
        types.includes(r.docType) &&
        r.status === 'active' &&
        (!r.expiresAt || new Date(r.expiresAt).getTime() > now),
    );
  const hasLiability = active(['liability_insurance', 'professional_indemnity']);
  const hasDeclaration = active(['health_declaration', 'liability_acknowledgment']);
  return hasLiability && hasDeclaration;
}

// POST /api/provider/insurance-docs — provider submits an insurance/health doc.
router.post('/provider/insurance-docs', requireAuth, upload.single('file'), requireValidFileContent(ALLOWED_MIMES), async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user?.uid;
    if (!providerId) return res.status(401).json({ error: 'Authentication required' });

    const { docType, insurer, policyNumber, issuedAt, expiresAt } = req.body || {};
    if (!DOC_TYPES.includes(docType)) {
      return res.status(400).json({ error: `docType must be one of ${DOC_TYPES.join(', ')}` });
    }

    let fileRef: string | null = null;
    let declarationHash: string | null = null;
    const file = (req as any).file;
    if (file?.buffer) {
      // SHA-256 of the doc (tamper-evidence, no PII payload stored).
      declarationHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      // Private bucket, provider-scoped path. Access is via the existing
      // admin-gated signed-URL flow — never public.
      const ext = (file.mimetype.split('/')[1] || 'bin').replace('jpeg', 'jpg');
      fileRef = `providers/${providerId}/insurance/${docType}_${Date.now()}.${ext}`;
      try {
        await storage.bucket().file(fileRef).save(file.buffer, {
          metadata: { contentType: file.mimetype },
          resumable: false,
        });
      } catch (uploadErr: any) {
        logger.error('[ProviderInsurance] file upload failed', { providerId, error: uploadErr?.message });
        return res.status(502).json({ error: 'Document storage failed, please retry' });
      }
    }

    const [row] = await db.insert(providerInsuranceDocuments).values({
      providerId,
      docType,
      status: 'pending',
      insurer: insurer || null,
      policyNumber: policyNumber || null,
      fileRef,
      declarationHash,
      issuedAt: issuedAt ? new Date(issuedAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();

    logger.info('[ProviderInsurance] doc submitted', { providerId, docType, id: row?.id });
    res.json({ success: true, id: row?.id, status: 'pending' });
  } catch (error: any) {
    logger.error('[ProviderInsurance] submit failed', { error: error.message });
    res.status(500).json({ error: 'Failed to submit document' });
  }
});

// GET /api/provider/insurance-docs — the provider's own docs + status + clearance.
router.get('/provider/insurance-docs', requireAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).user?.uid;
    if (!providerId) return res.status(401).json({ error: 'Authentication required' });
    const rows = await db
      .select()
      .from(providerInsuranceDocuments)
      .where(eq(providerInsuranceDocuments.providerId, providerId))
      .orderBy(desc(providerInsuranceDocuments.createdAt));
    // Don't leak the raw file path to the client.
    const docs = rows.map(({ fileRef, ...rest }) => ({ ...rest, hasFile: Boolean(fileRef) }));
    res.json({ success: true, cleared: await isProviderInsuranceCleared(providerId), docs });
  } catch (error: any) {
    logger.error('[ProviderInsurance] list failed', { error: error.message });
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

// GET /api/admin/provider-insurance?status=&providerId= — admin review queue.
router.get('/admin/provider-insurance', requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const providerId = typeof req.query.providerId === 'string' ? req.query.providerId : undefined;
    const conds = [
      status ? eq(providerInsuranceDocuments.status, status) : undefined,
      providerId ? eq(providerInsuranceDocuments.providerId, providerId) : undefined,
    ].filter(Boolean) as any[];
    const rows = await db
      .select()
      .from(providerInsuranceDocuments)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(providerInsuranceDocuments.createdAt))
      .limit(500);
    res.json({ success: true, count: rows.length, docs: rows });
  } catch (error: any) {
    logger.error('[ProviderInsurance] admin list failed', { error: error.message });
    res.status(500).json({ error: 'Failed to load review queue' });
  }
});

// PATCH /api/admin/provider-insurance/:id  { status, notes? } — verify/reject.
router.patch('/admin/provider-insurance/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const ALLOWED = ['pending', 'active', 'expired', 'rejected'];
    const { status, notes } = req.body || {};
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${ALLOWED.join(', ')}` });
    }
    const reviewer = (req as any).user?.email || (req as any).user?.uid || 'admin';
    const patch: any = { status, verifiedBy: reviewer, verifiedAt: new Date(), updatedAt: new Date() };
    if (typeof notes === 'string' && notes.trim()) patch.notes = notes.trim().slice(0, 500);
    const [updated] = await db
      .update(providerInsuranceDocuments)
      .set(patch)
      .where(eq(providerInsuranceDocuments.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Document not found' });
    logger.info('[ProviderInsurance] doc reviewed', { id, status, reviewer });
    res.json({ success: true, doc: updated });
  } catch (error: any) {
    logger.error('[ProviderInsurance] review failed', { error: error.message });
    res.status(500).json({ error: 'Failed to update document' });
  }
});

export default router;
