/**
 * Supplier-Invoice Screening — First Safe PR routes.
 *
 * All routes are gated by SystemConfig flag `ff.supplier_invoice_control.enabled`
 * (default OFF). When OFF, every endpoint returns 404 — production behaviour
 * is unchanged.
 *
 * Routes:
 *   POST /api/supplier-invoices          (admin) — upload an invoice for a supplier
 *   GET  /api/supplier-invoices/:id      (admin) — read an invoice + its checks
 *   POST /api/supplier-invoices/:id/approve  (admin/finance) — four-eyes + risk-tier guarded
 *   POST /api/supplier-invoices/:id/reject   (admin/finance) — four-eyes guarded
 *
 * Out of scope for PR1: provider-facing upload, SUMIT send, payment, Masav.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { systemConfig } from '../services/SystemConfig';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { loadUserRole, checkAccessLevel, type AuthenticatedRequest } from '../middleware/rbac';
import { supplierInvoiceScreeningService } from '../services/SupplierInvoiceScreeningService';
import { supplierInvoiceSumitSendService } from '../services/SupplierInvoiceSumitSendService';
import { logger } from '../lib/logger';
import { assertOperatingControl } from '../lib/petwashOperatingControlGateway';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB; supplier invoices can be slightly larger PDFs than KYC IDs.
});

// Flag gate — closed (404) when the feature flag is OFF. This is the second
// line of defence; the router is also conditionally mounted in routes.ts.
function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!systemConfig.get('ff.supplier_invoice_control.enabled')) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

// PR-S4 SUMIT-send second gate. Closed unless BOTH parent flag AND
// sumit_send flag are ON. Returns 404 (not 503) so the existence of the
// route is not leaked when the feature is disabled.
function sumitSendFlagGate(_req: Request, res: Response, next: NextFunction) {
  if (
    !systemConfig.get('ff.supplier_invoice_control.enabled') ||
    !systemConfig.get('ff.supplier_invoice_control.sumit_send.enabled')
  ) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

// Admin-level gate (re-uses the existing chain from server/routes/kyc.ts).
const requireFinanceOrAdmin = [
  flagGate,
  validateFirebaseToken,
  loadUserRole,
  checkAccessLevel(8),
];

/** Best-effort role read for the per-invoice four-eyes / RED-override gate. */
function readActorRole(authReq: AuthenticatedRequest): string {
  const any = authReq as unknown as Record<string, unknown>;
  return (
    (any.userRole as string | undefined) ??
    ((any.user as { role?: string } | undefined)?.role) ??
    ((any.role as string | undefined)) ??
    'admin'
  );
}

function readActorEmail(authReq: AuthenticatedRequest): string {
  const f = (authReq as unknown as { firebaseUser?: { email?: string; uid?: string } }).firebaseUser;
  return f?.email ?? f?.uid ?? 'unknown';
}

// POST /api/supplier-invoices — admin uploads an invoice PDF/image for a supplier
router.post('/', ...requireFinanceOrAdmin, upload.single('file'), async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Missing file' });

    const rawSupplierId = req.body.supplierId;
    const supplierId =
      rawSupplierId == null || rawSupplierId === ''
        ? null
        : Number(rawSupplierId);
    if (supplierId != null && (!Number.isInteger(supplierId) || supplierId <= 0)) {
      return res.status(400).json({ error: 'Invalid supplierId' });
    }

    const uid = authReq.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const result = await supplierInvoiceScreeningService.ingest({
      fileBuffer: file.buffer,
      fileName: file.originalname,
      contentType: file.mimetype,
      supplierId,
      uploadedByUid: uid,
      uploadedByEmail: readActorEmail(authReq),
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    return res.status(201).json({
      id: result.invoice.id,
      status: result.invoice.status,
      riskLevel: result.invoice.riskLevel,
      riskScore: result.invoice.riskScore,
      checks: result.checks,
    });
  } catch (err) {
    logger.error('[SupplierInvoices] upload failed', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/supplier-invoices — admin list with optional filters
router.get('/', ...requireFinanceOrAdmin, async (req: Request, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Number.isFinite(rawLimit) ? rawLimit : undefined;
    const offset = Number.isFinite(rawOffset) ? rawOffset : undefined;
    const riskLevel = typeof req.query.riskLevel === 'string'
      ? (req.query.riskLevel as 'green' | 'yellow' | 'red')
      : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const out = await supplierInvoiceScreeningService.list({ limit, offset, riskLevel, status });
    return res.json(out);
  } catch (err) {
    logger.error('[SupplierInvoices] list failed', err);
    return res.status(500).json({ error: 'List failed' });
  }
});

// GET /api/supplier-invoices/:id
router.get('/:id', ...requireFinanceOrAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  try {
    const out = await supplierInvoiceScreeningService.get(id);
    if (!out) return res.status(404).json({ error: 'Not found' });
    return res.json(out);
  } catch (err) {
    logger.error('[SupplierInvoices] get failed', err);
    return res.status(500).json({ error: 'Read failed' });
  }
});

// POST /api/supplier-invoices/:id/approve  — four-eyes + RED-override + YELLOW-needs-note
router.post('/:id/approve', ...requireFinanceOrAdmin, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  const uid = authReq.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await supplierInvoiceScreeningService.approve({
      invoiceId: id,
      actorUid: uid,
      actorEmail: readActorEmail(authReq),
      actorRole: readActorRole(authReq),
      note: typeof req.body?.note === 'string' ? req.body.note : undefined,
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });
    return res.json(result);
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === 'APPROVAL_DENIED') return res.status(403).json({ error: (err as Error).message });
    if (code === 'NOT_FOUND') return res.status(404).json({ error: 'Not found' });
    if (code === 'INVALID_STATE') return res.status(409).json({ error: (err as Error).message });
    logger.error('[SupplierInvoices] approve failed', err);
    return res.status(500).json({ error: 'Approve failed' });
  }
});

// POST /api/supplier-invoices/:id/reject — four-eyes guarded
router.post('/:id/reject', ...requireFinanceOrAdmin, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  const uid = authReq.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
  try {
    const result = await supplierInvoiceScreeningService.reject({
      invoiceId: id,
      actorUid: uid,
      actorEmail: readActorEmail(authReq),
      actorRole: readActorRole(authReq),
      reason,
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });
    return res.json(result);
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === 'APPROVAL_DENIED') return res.status(403).json({ error: (err as Error).message });
    if (code === 'NOT_FOUND') return res.status(404).json({ error: 'Not found' });
    if (code === 'INVALID_STATE') return res.status(409).json({ error: (err as Error).message });
    logger.error('[SupplierInvoices] reject failed', err);
    return res.status(500).json({ error: 'Reject failed' });
  }
});

// PR-S4: POST /api/supplier-invoices/:id/send-to-sumit
// Double-gated (parent flag + sumit_send flag). Admin click only — no
// autonomous AI path. Returns 200 + {sent:true, sumitDocumentId} on success;
// 200 + {sent:false, wired:false, reason} when SUMIT env is not configured;
// 409 when invoice status is not 'ready_for_accountant' or it has already
// been sent.
const requireFinanceOrAdminForSumitSend = [
  sumitSendFlagGate,
  validateFirebaseToken,
  loadUserRole,
  checkAccessLevel(8),
];
router.post(
  '/:id/send-to-sumit',
  ...requireFinanceOrAdminForSumitSend,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const uid = authReq.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!assertOperatingControl(req, res, {
      actionType: 'SUMIT_OFFICIAL_POSTING',
      route: 'POST /api/supplier-invoices/:id/send-to-sumit',
      targetId: `supplier-invoice:${id}`,
      facts: {
        sourceEvidenceExists: true,
        idempotencyKeyExists: true,
      },
    })) {
      return;
    }
    try {
      const result = await supplierInvoiceSumitSendService.send({
        invoiceId: id,
        actorUid: uid,
        actorEmail: readActorEmail(authReq),
        actorRole: readActorRole(authReq),
        ipAddress: req.ip || '',
        userAgent: req.get('user-agent') || '',
      });
      return res.json(result);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === 'NOT_FOUND') return res.status(404).json({ error: 'Not found' });
      if (code === 'INVALID_STATE') return res.status(409).json({ error: (err as Error).message });
      logger.error('[SupplierInvoices] send-to-sumit failed', err);
      return res.status(500).json({ error: 'SUMIT send failed' });
    }
  }
);

export default router;
