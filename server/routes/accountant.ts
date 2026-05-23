/**
 * Accountant routes — Mission-8.
 *
 * Read-mostly surface for an accountant role (level 5) sitting between
 * staff (4) and admin (6). The accountant can:
 *   - GET /api/accountant/queue            — list invoices waiting for SUMIT entry
 *   - GET /api/accountant/invoices/:id     — read a single invoice + its checks
 *   - POST /api/accountant/invoices/:id/mark-entered-in-sumit
 *                                          — close the loop when the accountant has
 *                                            manually entered the doc in SUMIT
 *
 * The accountant role CANNOT:
 *   - upload invoices (admin/finance)
 *   - approve / reject invoices (admin/finance, four-eyes guarded)
 *   - see /admin/sumit control panel (super-admin only per Mission-4 follow-up)
 *   - touch wallet, escrow, or any money rail
 *
 * Gated by ff.supplier_invoice_control.enabled (same flag as the parent
 * surface). Every mark-entered action writes a recordAuditEvent line.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { supplierInvoices, supplierInvoiceChecks } from '../../shared/schema';
import { systemConfig } from '../services/SystemConfig';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { loadUserRole, type AuthenticatedRequest } from '../middleware/rbac';
import { recordAuditEvent } from '../utils/auditSignature';
import { logger } from '../lib/logger';

const router = Router();

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!systemConfig.get('ff.supplier_invoice_control.enabled')) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

/**
 * Accept role >= 5 (accountant or higher). Admin and super-admin can also
 * use these endpoints; that's intentional — the queue is useful to anyone
 * who already has finance access. The point of the role is to LIMIT what
 * a pure-accountant account can do, not gate-keep admins out.
 */
function requireAccountantOrAbove(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userRole = (req as AuthenticatedRequest).userRole;
  if (!userRole || typeof userRole.role !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Use the role string itself + the level number that loadUserRole attaches.
  const level = (userRole as any).assignment?.level ?? 0;
  const role = userRole.role;
  if (role === 'super_admin' || level >= 5) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden — accountant role required' });
}

const requireAccountantChain = [
  flagGate,
  validateFirebaseToken,
  loadUserRole,
  requireAccountantOrAbove,
];

function readActorEmail(authReq: AuthenticatedRequest): string {
  const f = (authReq as unknown as { firebaseUser?: { email?: string; uid?: string } }).firebaseUser;
  return f?.email ?? f?.uid ?? 'unknown';
}

/**
 * GET /api/accountant/queue
 * Returns invoices the accountant should action — anything that has reached
 * 'ready_for_accountant' status AND has not already been confirmed in SUMIT.
 */
router.get('/queue', ...requireAccountantChain, async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(supplierInvoices)
      .where(eq(supplierInvoices.status, 'ready_for_accountant'));

    // Filter out already-confirmed-in-SUMIT invoices in app code so the
    // query stays a single eq() on the indexed status column.
    const pending = rows.filter(
      (r) => r.sumitStatus !== 'sent' && r.sumitStatus !== 'confirmed',
    );

    pending.sort((a, b) => {
      const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aT - bT; // oldest first — accountant works the queue front-to-back
    });

    return res.json({ rows: pending });
  } catch (err) {
    logger.error('[AccountantRoutes] queue failed', err);
    return res.status(500).json({ error: 'Queue read failed' });
  }
});

/**
 * GET /api/accountant/invoices/:id
 * Single-invoice read with checks. Same shape as the admin route so the
 * accountant page can reuse the existing TypeScript types in the client.
 */
router.get('/invoices/:id', ...requireAccountantChain, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [invoice] = await db
      .select()
      .from(supplierInvoices)
      .where(eq(supplierInvoices.id, id))
      .limit(1);
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    const checks = await db
      .select()
      .from(supplierInvoiceChecks)
      .where(eq(supplierInvoiceChecks.invoiceId, id));
    return res.json({ invoice, checks });
  } catch (err) {
    logger.error('[AccountantRoutes] get failed', err);
    return res.status(500).json({ error: 'Read failed' });
  }
});

/**
 * POST /api/accountant/invoices/:id/mark-entered-in-sumit
 * Body: { sumitDocumentId?: string, note?: string }
 *
 * Closes the loop when the accountant has manually entered an invoice in
 * SUMIT (typical for sumit.mode='email' or sumit.mode='off' workflows
 * where the actual SUMIT entry happens out-of-band). Flips
 * sumit_status from anything-else → 'confirmed' and persists the SUMIT
 * document id the accountant types in.
 *
 * Always writes a recordAuditEvent for traceability.
 */
router.post(
  '/invoices/:id/mark-entered-in-sumit',
  ...requireAccountantChain,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const uid = authReq.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const sumitDocumentId =
      typeof req.body?.sumitDocumentId === 'string' && req.body.sumitDocumentId.trim()
        ? req.body.sumitDocumentId.trim()
        : null;
    const note =
      typeof req.body?.note === 'string' && req.body.note.trim() ? req.body.note.trim() : null;

    try {
      const [existing] = await db
        .select()
        .from(supplierInvoices)
        .where(eq(supplierInvoices.id, id))
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (existing.status !== 'ready_for_accountant') {
        return res.status(409).json({
          error: `Invoice status is '${existing.status}', expected 'ready_for_accountant'`,
        });
      }

      const now = new Date();
      const [updated] = await db
        .update(supplierInvoices)
        .set({
          sumitDocumentId: sumitDocumentId ?? existing.sumitDocumentId,
          sumitStatus: 'confirmed',
          sumitConfirmedAt: now,
          sumitSentAt: existing.sumitSentAt ?? now,
          sumitLastError: null,
          updatedAt: now,
        })
        .where(eq(supplierInvoices.id, id))
        .returning();

      await recordAuditEvent({
        eventType: 'supplier_invoice_marked_entered_in_sumit',
        customerUid: uid,
        metadata: {
          invoiceId: id,
          supplierId: existing.supplierId,
          previousSumitStatus: existing.sumitStatus,
          newSumitStatus: 'confirmed',
          sumitDocumentId: sumitDocumentId ?? existing.sumitDocumentId ?? null,
          note,
          actorEmail: readActorEmail(authReq),
          actorRole: 'accountant',
          source: 'manual_mark_entered',
        },
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
      });

      return res.json(updated);
    } catch (err) {
      logger.error('[AccountantRoutes] mark-entered failed', err);
      return res.status(500).json({ error: 'Mark-entered failed' });
    }
  },
);

export default router;
