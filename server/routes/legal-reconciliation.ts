/**
 * GET /api/admin/legal-reconciliation
 *
 * READ-ONLY reconciliation endpoint over the views defined in
 * migration 0129_legal_reconciliation_view.sql (CEO 2026-08-26 §7).
 *
 * MEASURES divergence — does NOT change any acceptance status.
 * Correction pass #2 §3-4: a cron that reads this NEVER "promotes"
 * a document from DUAL-WRITE-SHADOW to DUAL-WRITE-RECONCILED because
 * N days passed. Promotion requires the definitions in the registry's
 * MigrationStatus docstring to hold for the tested population/window,
 * and that judgement is a separate operational decision.
 *
 * Returns counts per (source, document_key) of:
 *   • legacyMissingCanonical — a legacy acceptance row has no
 *                              matching canonical row.
 *   • canonicalMissingLegacy — a canonical row exists but no legacy
 *                              source (should be near-zero; > 0
 *                              means the legacy write failed after
 *                              the canonical succeeded, so a
 *                              legacy-driven reconciliation would
 *                              miss it).
 *   • duplicates             — should always be 0 (partial unique
 *                              index enforces this); > 0 is a
 *                              schema regression.
 *
 * Admin-only. Never mutates any row. Never mutates status. Never
 * mutates provider gates.
 */

import { Router, type Request, type Response } from 'express';
import { pool } from '../db';
import { isSuperAdminVerified } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { LEGAL_DOCUMENTS, legalDocumentStats } from '@shared/lib/legalDocumentRegistry';

const router = Router();

router.get('/legal-reconciliation', async (req: Request, res: Response) => {
  // #240 migration: paired shape — allowlist + email_verified.
  if (!isSuperAdminVerified(req as any)) {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }

  try {
    const [legacyMissing, canonicalOrphans, duplicates] = await Promise.all([
      pool.query(`
        SELECT src, document_key, COUNT(*)::int AS n
          FROM v_legacy_missing_canonical
         WHERE document_key IS NOT NULL
         GROUP BY src, document_key
         ORDER BY n DESC, document_key
      `),
      pool.query(`
        SELECT document_key, COUNT(*)::int AS n
          FROM v_canonical_missing_legacy
         GROUP BY document_key
         ORDER BY n DESC, document_key
      `),
      pool.query(`
        SELECT document_key, doc_version, dup_count
          FROM v_legal_acceptance_duplicates
         ORDER BY dup_count DESC, document_key
      `),
    ]);

    // Registry-driven header — CEO §22 wants "34 total keys / X per
    // scope / X per status" surfaced honestly on every report.
    const stats = legalDocumentStats();

    return res.json({
      ok: true,
      composedAt: new Date().toISOString(),
      registry: {
        total: stats.total,
        byActor: stats.byActor,
        byScope: stats.byScope,
        byStatus: stats.byStatus,
        // scope × migrationStatus grid for the admin "migration progress"
        // dashboard — every cell present and zero-filled so the client
        // never has to guess a missing (scope, status) pair.
        byMigrationStatus: stats.byMigrationStatus,
      },
      documents: LEGAL_DOCUMENTS.map((d) => ({
        key: d.key, actor: d.actor, scope: d.scope,
        currentVersion: d.currentVersion,
        migrationStatus: d.migrationStatus,
        provenance: d.provenance,
      })),
      legacyMissingCanonical: legacyMissing.rows,
      canonicalMissingLegacy: canonicalOrphans.rows,
      duplicates: duplicates.rows,
    });
  } catch (err: any) {
    // Migration 0129 may not have run yet in this environment — return
    // a structured "not yet migrated" response instead of a 500 so the
    // admin dashboard can show "reconciliation view pending".
    if (String(err?.code || '') === '42P01') {
      return res.status(200).json({
        ok: true,
        composedAt: new Date().toISOString(),
        migrationPending: 'migrations/0129_legal_reconciliation_view.sql',
        registry: { total: legalDocumentStats().total },
        legacyMissingCanonical: [],
        canonicalMissingLegacy: [],
        duplicates: [],
      });
    }
    logger.error('[LegalReconciliation] read failed', { err: String(err?.message ?? err) });
    return res.status(500).json({ ok: false, error: 'reconciliation_error' });
  }
});

export default router;
