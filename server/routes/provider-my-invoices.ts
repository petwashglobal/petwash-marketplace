/**
 * Provider self-service "my invoices" — Mission-7 v1.
 *
 * Read-only filter: each authenticated provider sees ONLY supplier_invoices
 * where uploadedBy matches their own Firebase UID. They see the screening
 * status, the SUMIT status, and any error reason — but cannot upload,
 * approve, reject, or send to SUMIT from this surface.
 *
 *   GET /api/provider/my-invoices
 *
 * Filter semantics:
 *   - uploadedBy === currentUser.uid (provider's own uploads OR uploads
 *     an admin made tagged with this provider's uid).
 *   - Optional ?limit + ?offset for pagination (cap 100 per page).
 *   - Newest first.
 *
 * What this PR does NOT do:
 *   - No provider-side upload endpoint (separate PR if desired).
 *   - No mapping from supplier_id to provider_uid (those are different
 *     tables; that's a future schema-migration PR).
 *   - No money / payout / wallet access.
 *
 * Gated by ff.supplier_invoice_control.enabled. Provider role required
 * (level >= 2 with role='provider', NOT admins — admins use /admin/...).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { supplierInvoices } from '../../shared/schema';
import { systemConfig } from '../services/SystemConfig';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { loadUserRole, type AuthenticatedRequest } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!systemConfig.get('ff.supplier_invoice_control.enabled')) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

function requireProviderRole(req: Request, res: Response, next: NextFunction) {
  const userRole = (req as AuthenticatedRequest).userRole;
  if (!userRole || typeof userRole.role !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Accept provider, OR any admin-level role (so an admin can see what a
  // provider would see — useful for debugging "provider says they can't
  // find their invoice" tickets). Public users still 403.
  const role = userRole.role;
  const level = (userRole as any).assignment?.level ?? 0;
  if (role === 'provider' || level >= 5) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden — provider role required' });
}

const requireProviderChain = [
  flagGate,
  validateFirebaseToken,
  loadUserRole,
  requireProviderRole,
];

router.get('/my-invoices', ...requireProviderChain, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const uid = authReq.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 25, 1), 100);
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);

  try {
    const rows = await db
      .select({
        // Explicit projection — never leak fraud-engine raw flags or the
        // full ocr_raw_text to the provider. They see what's about them,
        // not the internal screening guts.
        id: supplierInvoices.id,
        supplierId: supplierInvoices.supplierId,
        ocrSupplierName: supplierInvoices.ocrSupplierName,
        ocrInvoiceNumber: supplierInvoices.ocrInvoiceNumber,
        ocrInvoiceDate: supplierInvoices.ocrInvoiceDate,
        ocrTotalAmount: supplierInvoices.ocrTotalAmount,
        ocrCurrency: supplierInvoices.ocrCurrency,
        status: supplierInvoices.status,
        riskLevel: supplierInvoices.riskLevel,
        sumitDocumentId: supplierInvoices.sumitDocumentId,
        sumitStatus: supplierInvoices.sumitStatus,
        sumitSentAt: supplierInvoices.sumitSentAt,
        sumitConfirmedAt: supplierInvoices.sumitConfirmedAt,
        rejectionReason: supplierInvoices.rejectionReason,
        createdAt: supplierInvoices.createdAt,
      })
      .from(supplierInvoices)
      .where(eq(supplierInvoices.uploadedBy, uid))
      .limit(limit)
      .offset(offset);

    rows.sort((a, b) => {
      const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bT - aT;
    });

    return res.json({ rows, limit, offset });
  } catch (err) {
    logger.error('[ProviderMyInvoices] list failed', err);
    return res.status(500).json({ error: 'List failed' });
  }
});

export default router;
