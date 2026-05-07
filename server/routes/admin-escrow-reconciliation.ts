/**
 * Admin Escrow Reconciliation — Phase 1: dual-read view
 *
 * The system has two escrow ledgers that must stay in sync:
 *   • Firestore  `escrow_payments`  — real-time state, auto-release timer, dispute freeze
 *   • PostgreSQL `escrow_holdings`  — financial audit ledger, dispute resolution, payouts
 *
 * This router exposes an admin-only read-model that shows both systems side by side
 * for every bookingId so that operators can detect drift before it becomes a dispute
 * or payout error.
 *
 * Drift examples that must be visible:
 *   – Firestore says "released" but PG says "held"  → auto-release ran but PG job missed
 *   – PG says "disputed" but Firestore autoReleaseBlocked = false → cron could double-release
 *   – Record exists in only one system → creation race condition
 *
 * Mounted at: /api/admin/escrow
 * All routes require: requireAuth + admin claim (enforced by RBAC gate in routes.ts)
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { escrowHoldings } from '@shared/schema';
import admin from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { desc, eq, gte, lte, and, or } from 'drizzle-orm';
import { requireAuth } from '../middleware/gates';
import { logAuditEvent } from '../middleware/auditLog';
import { isSuperAdmin } from '../middleware/rbac';

const router = Router();
const firestore = admin.firestore();

// Issue #153 — escrow role-check shape fix.
// The previous inline checks read `req.user.admin` / `req.user.role`, but
// `bridgeFirebaseUser()` only populates `req.user.{uid,id,email}` —
// neither `.admin` nor `.role`. Result: legitimate admins received 403.
// We now read the role from the canonical source `req.firebaseUser.claims.role`
// (populated by `validateFirebaseToken` on the mount) and consult
// `isSuperAdmin(email)` for the super-admin email allowlist. The split
// between read-endpoints (allow 'finance') and the sync mutation
// (admin/super_admin only) is preserved exactly.
function callerHasRole(req: Request, allowedRoles: readonly string[]): boolean {
  const fb = (req as any).firebaseUser;
  const claims = fb?.claims || {};
  const email = (fb?.email || '').toLowerCase();
  if (email && isSuperAdmin(email)) return true;
  const role = typeof claims.role === 'string' ? claims.role : undefined;
  if (role && allowedRoles.includes(role)) return true;
  return false;
}

const READ_ROLES = ['super_admin', 'admin', 'finance'] as const;
const SYNC_ROLES = ['super_admin', 'admin'] as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Map statuses from both systems to a canonical set for drift comparison */
function canonicalStatus(raw: string | null | undefined): string {
  if (!raw) return 'unknown';
  const s = raw.toLowerCase().trim();
  if (s === 'pending' || s === 'pending_payment') return 'pending';
  if (s === 'held' || s === 'holding') return 'held';
  if (s === 'releasing') return 'releasing';
  if (s === 'released') return 'released';
  if (s === 'refunded') return 'refunded';
  if (s === 'disputed') return 'disputed';
  return s;
}

type DriftLevel = 'ok' | 'warn' | 'critical';

function assessDrift(pgStatus: string | null, fsStatus: string | null, fsAutoReleaseBlocked?: boolean): DriftLevel {
  const pg = canonicalStatus(pgStatus);
  const fs = canonicalStatus(fsStatus);

  if (!pgStatus && !fsStatus) return 'ok';

  // One-sided existence is always critical
  if (!pgStatus && fsStatus) return 'critical';
  if (pgStatus && !fsStatus) return 'warn'; // PG exists, FS missing — older record or FS deleted

  // Statuses match — check for dangerous edge cases
  if (pg === fs) {
    // PG says disputed but Firestore autoReleaseBlocked is false → cron could double-release
    if (pg === 'disputed' && fsAutoReleaseBlocked === false) return 'critical';
    return 'ok';
  }

  // Critical mismatches (money could move incorrectly)
  const critical = new Set([
    'released:held',
    'released:pending',
    'released:releasing',
    'refunded:held',
    'disputed:released',
    'disputed:refunded',
  ]);
  const key = `${fs}:${pg}`;
  if (critical.has(key)) return 'critical';

  return 'warn';
}

// ─── GET /api/admin/escrow/reconciliation ────────────────────────────────────
/**
 * Returns up to `limit` rows (default 100, max 500) from PostgreSQL escrow_holdings,
 * enriched with the matching Firestore document where found.
 * Each row includes a `drift` field: 'ok' | 'warn' | 'critical'.
 */
router.get('/reconciliation', requireAuth, async (req: Request, res: Response) => {
  if (!callerHasRole(req, READ_ROLES)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
  }

  try {
    const rawLimit  = Math.min(parseInt(String(req.query.limit  || 100), 10), 500);
    const rawOffset = Math.max(parseInt(String(req.query.offset || 0),   10), 0);
    const filterDrift = req.query.drift as string | undefined; // 'ok'|'warn'|'critical'
    const filterStatus = req.query.status as string | undefined;

    // ── Step 1: Pull from PostgreSQL ─────────────────────────────────────────
    const pgRows = await db
      .select()
      .from(escrowHoldings)
      .orderBy(desc(escrowHoldings.createdAt))
      .limit(rawLimit + 50) // over-fetch so we can filter by drift client-side after FS join
      .offset(rawOffset);

    if (pgRows.length === 0) {
      return res.json({ rows: [], total: 0, offset: rawOffset, limit: rawLimit });
    }

    // ── Step 2: Fetch matching Firestore documents ────────────────────────────
    // We index by escrowId (Firestore doc ID = escrowId stored in PG)
    const escrowIds = pgRows.map(r => r.escrowId).filter(Boolean);

    // Firestore `in` queries support max 30 items; batch if needed
    const fsMap = new Map<string, any>();
    const CHUNK = 30;
    for (let i = 0; i < escrowIds.length; i += CHUNK) {
      const chunk = escrowIds.slice(i, i + CHUNK);
      const snap = await firestore
        .collection('escrow_payments')
        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
        .get();
      snap.docs.forEach(doc => fsMap.set(doc.id, doc.data()));
    }

    // Also fetch Firestore records indexed by bookingId to find FS-only records
    const bookingIds = [...new Set(pgRows.map(r => r.bookingId).filter(Boolean))];
    const fsByBooking = new Map<string, any[]>();
    for (let i = 0; i < bookingIds.length; i += CHUNK) {
      const chunk = bookingIds.slice(i, i + CHUNK);
      const snap = await firestore
        .collection('escrow_payments')
        .where('bookingId', 'in', chunk)
        .get();
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (!fsByBooking.has(d.bookingId)) fsByBooking.set(d.bookingId, []);
        fsByBooking.get(d.bookingId)!.push({ id: doc.id, ...d });
      });
    }

    // ── Step 3: Build reconciled rows ─────────────────────────────────────────
    const rows = pgRows.map(pg => {
      const fsDoc = fsMap.get(pg.escrowId) || null;
      const drift = assessDrift(
        pg.status,
        fsDoc?.status ?? null,
        fsDoc?.autoReleaseBlocked,
      );

      return {
        bookingId:   pg.bookingId,
        customerId:  pg.customerId,
        providerId:  pg.providerId,

        pg: {
          escrowId:            pg.escrowId,
          status:              pg.status,
          grossAmountCents:    pg.grossAmountCents,
          netProviderCents:    pg.netProviderAmountCents,
          platformFeeCents:    pg.platformFeeCents,
          vatCents:            pg.vatCents,
          capturedAt:          pg.capturedAt,
          releaseEligibleAt:   pg.releaseEligibleAt,
          releasedAt:          pg.releasedAt,
          disputeOpenedAt:     pg.disputeOpenedAt,
          disputeResolvedAt:   pg.disputeResolvedAt,
          disputeResolution:   pg.disputeResolution,
          refundAmountCents:   pg.refundAmountCents,
          createdAt:           pg.createdAt,
        },

        fs: fsDoc ? {
          escrowId:           fsDoc.id ?? pg.escrowId,
          status:             fsDoc.status ?? null,
          amount:             fsDoc.amount ?? null,
          currency:           fsDoc.currency ?? 'ILS',
          holdUntil:          fsDoc.holdUntil?.toDate?.() ?? null,
          autoReleaseBlocked: fsDoc.autoReleaseBlocked ?? false,
          createdAt:          fsDoc.createdAt?.toDate?.() ?? null,
          releasedAt:         fsDoc.releasedAt?.toDate?.() ?? null,
          refundedAt:         fsDoc.refundedAt?.toDate?.() ?? null,
          nayaxTransactionId: fsDoc.nayaxTransactionId ?? null,
        } : null,

        fsOnly: false,
        drift,
        driftDetail: drift !== 'ok' ? buildDriftDetail(pg.status, fsDoc) : null,
      };
    });

    // ── Step 4: Find Firestore-only records (no PG row) ───────────────────────
    const pgEscrowIds = new Set(pgRows.map(r => r.escrowId));
    const fsOnlyRows: any[] = [];
    for (const [bookingId, fsDocs] of fsByBooking) {
      for (const fsDoc of fsDocs) {
        if (!pgEscrowIds.has(fsDoc.id)) {
          fsOnlyRows.push({
            bookingId,
            customerId:  fsDoc.customerId ?? null,
            providerId:  fsDoc.providerId ?? null,
            pg:          null,
            fs: {
              escrowId:           fsDoc.id,
              status:             fsDoc.status ?? null,
              amount:             fsDoc.amount ?? null,
              currency:           fsDoc.currency ?? 'ILS',
              holdUntil:          fsDoc.holdUntil?.toDate?.() ?? null,
              autoReleaseBlocked: fsDoc.autoReleaseBlocked ?? false,
              createdAt:          fsDoc.createdAt?.toDate?.() ?? null,
              releasedAt:         fsDoc.releasedAt?.toDate?.() ?? null,
              refundedAt:         fsDoc.refundedAt?.toDate?.() ?? null,
              nayaxTransactionId: fsDoc.nayaxTransactionId ?? null,
            },
            fsOnly: true,
            drift:       'critical' as DriftLevel,
            driftDetail: 'Firestore record exists but no matching PostgreSQL escrow_holdings row — payout pipeline blind to this escrow',
          });
        }
      }
    }

    const allRows = [...rows, ...fsOnlyRows];

    // Apply optional drift filter
    const filtered = filterDrift
      ? allRows.filter(r => r.drift === filterDrift)
      : allRows;

    // Apply optional status filter (checks pg.status)
    const statusFiltered = filterStatus
      ? filtered.filter(r => (r.pg?.status ?? r.fs?.status) === filterStatus)
      : filtered;

    const summary = {
      total:    allRows.length,
      ok:       allRows.filter(r => r.drift === 'ok').length,
      warn:     allRows.filter(r => r.drift === 'warn').length,
      critical: allRows.filter(r => r.drift === 'critical').length,
      fsOnly:   fsOnlyRows.length,
    };

    logger.info('[EscrowRecon] Reconciliation view served', {
      callerId: (req as any).firebaseUser?.uid,
      rowsReturned: statusFiltered.length,
      criticalDrift: summary.critical,
    });

    return res.json({
      summary,
      rows:   statusFiltered.slice(0, rawLimit),
      offset: rawOffset,
      limit:  rawLimit,
    });

  } catch (err: any) {
    logger.error('[EscrowRecon] Failed to build reconciliation view', { error: err.message });
    return res.status(500).json({ error: 'RECON_FAILED', message: err.message });
  }
});

// ─── GET /api/admin/escrow/reconciliation/booking/:bookingId ─────────────────
/**
 * Detailed reconciliation for a single booking — shows all escrow records across
 * both systems associated with this bookingId, including any orphaned FS records.
 */
router.get('/reconciliation/booking/:bookingId', requireAuth, async (req: Request, res: Response) => {
  if (!callerHasRole(req, READ_ROLES)) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const { bookingId } = req.params;

  try {
    const [pgRows, fsDocs] = await Promise.all([
      db.select().from(escrowHoldings).where(eq(escrowHoldings.bookingId, bookingId)),
      firestore.collection('escrow_payments').where('bookingId', '==', bookingId).get()
        .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    ]);

    const fsById = new Map(fsDocs.map(d => [d.id, d]));
    const pgByEscrowId = new Map(pgRows.map(r => [r.escrowId, r]));

    const paired = pgRows.map(pg => {
      const fsDoc = fsById.get(pg.escrowId) || null;
      const drift = assessDrift(pg.status, fsDoc?.status ?? null, fsDoc?.autoReleaseBlocked);
      return {
        bookingId,
        pg,
        fs: fsDoc,
        drift,
        driftDetail: drift !== 'ok' ? buildDriftDetail(pg.status, fsDoc) : null,
      };
    });

    // FS-only records
    const fsOnly = fsDocs
      .filter(fs => !pgByEscrowId.has(fs.id))
      .map(fs => ({
        bookingId,
        pg: null,
        fs,
        drift: 'critical' as DriftLevel,
        driftDetail: 'Firestore-only record — payout pipeline cannot see this escrow',
      }));

    return res.json({
      bookingId,
      paired,
      fsOnly,
      hasDrift: [...paired, ...fsOnly].some(r => r.drift !== 'ok'),
    });

  } catch (err: any) {
    logger.error('[EscrowRecon] Booking reconciliation failed', { bookingId, error: err.message });
    return res.status(500).json({ error: 'RECON_FAILED', message: err.message });
  }
});

// ─── POST /api/admin/escrow/reconciliation/sync/:escrowId ────────────────────
/**
 * Force-sync a specific Firestore escrow record into PostgreSQL.
 * Use when a Firestore record exists but PG row is missing.
 * This is idempotent — if the PG row already exists, it updates status only.
 *
 * SAFETY: This only propagates status transitions in one direction (FS → PG).
 * It never overrides a "released" PG record with a lesser FS status.
 */
router.post('/reconciliation/sync/:escrowId', requireAuth, async (req: Request, res: Response) => {
  if (!callerHasRole(req, SYNC_ROLES)) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const { escrowId } = req.params;

  try {
    const fsDoc = await firestore.collection('escrow_payments').doc(escrowId).get();
    if (!fsDoc.exists) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Firestore escrow document not found' });
    }

    const fs = fsDoc.data()!;
    const pgRows = await db
      .select()
      .from(escrowHoldings)
      .where(eq(escrowHoldings.escrowId, escrowId));

    if (pgRows.length === 0) {
      // Create missing PG row from Firestore data
      const amountCents = Math.round((fs.amount ?? 0) * 100);
      const commissionPct = 0.15;
      const platformFeeCents = Math.round(amountCents * commissionPct);
      const vatCents = Math.round(platformFeeCents * 0.18);
      const netProviderCents = amountCents - platformFeeCents;

      await db.insert(escrowHoldings).values({
        escrowId,
        bookingId:             fs.bookingId,
        customerId:            fs.customerId,
        providerId:            fs.providerId,
        grossAmountCents:      amountCents,
        platformFeeCents,
        vatCents,
        netProviderAmountCents: netProviderCents,
        status:                fs.status ?? 'held',
        capturedAt:            fs.createdAt?.toDate?.() ?? new Date(),
        releasedAt:            fs.releasedAt?.toDate?.() ?? null,
        paymentIntentId:       fs.nayaxTransactionId ?? null,
      });

      logger.warn('[EscrowRecon] ⚠ Created missing PG escrow_holdings row from Firestore', {
        escrowId,
        bookingId: fs.bookingId,
        syncedBy: (req as any).firebaseUser?.uid,
      });

      // Issue #148/#153 P5: canonical audit row for this money-path mutation.
      // Money math is unchanged — we only observe and record the sync action.
      setImmediate(() => {
        logAuditEvent({
          actorUserId: (req as any).firebaseUser?.uid,
          actorRole: 'admin',
          actionType: 'ESCROW_RECONCILIATION_SYNC_CREATE',
          targetType: 'escrow_holding',
          targetId: String(escrowId),
          ip: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
          metadata: { bookingId: fs.bookingId, source: 'firestore' },
        }).catch(() => {});
      });

      return res.json({ synced: true, action: 'created', escrowId, bookingId: fs.bookingId });
    }

    // Update status only — never downgrade a released/refunded record
    const pg = pgRows[0];
    const pgCanonical = canonicalStatus(pg.status);
    const fsCanonical = canonicalStatus(fs.status);

    const DOWNGRADE_PROTECTED = new Set(['released', 'refunded']);
    if (DOWNGRADE_PROTECTED.has(pgCanonical)) {
      return res.json({
        synced: false,
        action: 'skipped',
        reason: `PG status is '${pg.status}' — will not overwrite with Firestore '${fs.status}'`,
        escrowId,
      });
    }

    await db
      .update(escrowHoldings)
      .set({
        status:     fs.status ?? pg.status,
        releasedAt: fs.releasedAt?.toDate?.() ?? pg.releasedAt,
        updatedAt:  new Date(),
      })
      .where(eq(escrowHoldings.escrowId, escrowId));

    logger.warn('[EscrowRecon] ⚠ Status-synced PG escrow row from Firestore', {
      escrowId,
      from:    pg.status,
      to:      fs.status,
      syncedBy: (req as any).firebaseUser?.uid,
    });

    // Issue #148/#153 P5: canonical audit row for this money-path mutation.
    // Money math is unchanged — only the status column moves to match FS.
    setImmediate(() => {
      logAuditEvent({
        actorUserId: (req as any).firebaseUser?.uid,
        actorRole: 'admin',
        actionType: 'ESCROW_RECONCILIATION_SYNC_UPDATE',
        targetType: 'escrow_holding',
        targetId: String(escrowId),
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        metadata: { from: pg.status, to: fs.status, source: 'firestore' },
      }).catch(() => {});
    });

    return res.json({ synced: true, action: 'updated', from: pg.status, to: fs.status, escrowId });

  } catch (err: any) {
    logger.error('[EscrowRecon] Sync failed', { escrowId, error: err.message });
    return res.status(500).json({ error: 'SYNC_FAILED', message: err.message });
  }
});

// ─── T06: Scheduled escrow drift monitor ─────────────────────────────────────
/**
 * Runs once after startup (60s delay) then every 30 minutes.
 * Compares the 50 most recent PG escrow holdings against Firestore to surface drift.
 * Logs WARN for each drifted record so alerts / log aggregation can pick it up.
 * To escalate to PagerDuty/email, wire this function to your alerting pipeline.
 */
export async function startEscrowDriftMonitor(): Promise<void> {
  const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  const check = async () => {
    try {
      const pgRows = await db
        .select({ escrowId: escrowHoldings.escrowId, status: escrowHoldings.status, bookingId: escrowHoldings.bookingId })
        .from(escrowHoldings)
        .orderBy(desc(escrowHoldings.createdAt))
        .limit(50);

      if (!pgRows.length) return;

      const escrowIds = pgRows.map(r => r.escrowId).filter(Boolean) as string[];
      const CHUNK = 10;
      const fsMap = new Map<string, any>();

      for (let i = 0; i < escrowIds.length; i += CHUNK) {
        const chunk = escrowIds.slice(i, i + CHUNK);
        const snaps = await firestore
          .collection('escrow_payments')
          .where('__name__', 'in', chunk)
          .get();
        snaps.docs.forEach(d => fsMap.set(d.id, d.data()));
      }

      let driftCount = 0;
      for (const row of pgRows) {
        if (!row.escrowId) continue;
        const fsDoc = fsMap.get(row.escrowId);
        const pgNorm = canonicalStatus(row.status);
        const fsNorm = canonicalStatus(fsDoc?.status);
        if (pgNorm !== fsNorm) {
          driftCount++;
          logger.warn('[EscrowDriftMonitor] Drift detected', {
            escrowId: row.escrowId,
            bookingId: row.bookingId,
            pgStatus: row.status,
            fsStatus: fsDoc?.status ?? 'MISSING',
          });
        }
      }

      if (driftCount === 0) {
        logger.info('[EscrowDriftMonitor] Clean — no drift in last 50 holdings');
      } else {
        logger.error(`[EscrowDriftMonitor] ${driftCount} drifted escrow records — run /api/admin/escrow/reconciliation to investigate`);
      }
    } catch (err: any) {
      logger.error('[EscrowDriftMonitor] Check failed', { error: err.message });
    }
  };

  // Startup delay so DB is warm, then recurring
  setTimeout(async () => {
    await check();
    setInterval(check, CHECK_INTERVAL_MS);
  }, 60_000);

  logger.info('[EscrowDriftMonitor] Scheduled — first check in 60 s, then every 30 min');
}

// ─── helper ──────────────────────────────────────────────────────────────────
function buildDriftDetail(pgStatus: string | null, fsDoc: any | null): string {
  if (!fsDoc) return `PostgreSQL record exists (status: ${pgStatus}) but no matching Firestore document`;
  const fsStatus = fsDoc.status ?? 'unknown';
  const autoReleaseBlocked = fsDoc.autoReleaseBlocked ?? false;
  let detail = `PG: ${pgStatus} | FS: ${fsStatus}`;
  if (fsStatus === 'disputed' && !autoReleaseBlocked) {
    detail += ' | DANGER: disputed but autoReleaseBlocked=false — cron may release disputed funds';
  }
  if (fsStatus === 'released' && pgStatus !== 'released') {
    detail += ' | Firestore auto-release ran but PG ledger not updated — payout may not trigger';
  }
  return detail;
}

export default router;
