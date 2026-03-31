import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { reconcileBatch, runReconciliationSweep } from '../lib/reconciliation';
import {
  forecastSnapshot,
  reserveAgeing,
  liquidityPressure,
  payoutCalendarForecast,
  riskComparison,
  treasuryWarnings,
  forecastVsActual,
} from '../lib/treasury-forecast';

const router = Router();

// ---------------------------------------------------------------------------
// T171 — Payout batch management
// ---------------------------------------------------------------------------

// GET /api/treasury/batches
router.get('/batches', async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query as Record<string, string>;
    const limitN = Math.min(parseInt(limit, 10), 200);
    const offsetN = parseInt(offset, 10);

    let result;
    if (status) {
      result = await db.execute(sql`
        SELECT pb.*,
          COUNT(pbi.id)::int AS item_count,
          COALESCE(rr.status, 'pending') AS recon_status,
          rr.difference_cents,
          CASE WHEN pf.id IS NOT NULL AND pf.resolved = false THEN true ELSE false END AS has_open_failure
        FROM payout_batches pb
        LEFT JOIN payout_batch_items pbi ON pbi.batch_id = pb.id
        LEFT JOIN reconciliation_results rr ON rr.batch_id = pb.id
        LEFT JOIN payout_failures pf ON pf.batch_id = pb.id
        WHERE pb.status = ${status}
        GROUP BY pb.id, rr.status, rr.difference_cents, pf.id
        ORDER BY pb.created_at DESC
        LIMIT ${limitN} OFFSET ${offsetN}
      `);
    } else {
      result = await db.execute(sql`
        SELECT pb.*,
          COUNT(pbi.id)::int AS item_count,
          COALESCE(rr.status, 'pending') AS recon_status,
          rr.difference_cents,
          CASE WHEN pf.id IS NOT NULL AND pf.resolved = false THEN true ELSE false END AS has_open_failure
        FROM payout_batches pb
        LEFT JOIN payout_batch_items pbi ON pbi.batch_id = pb.id
        LEFT JOIN reconciliation_results rr ON rr.batch_id = pb.id
        LEFT JOIN payout_failures pf ON pf.batch_id = pb.id
        GROUP BY pb.id, rr.status, rr.difference_cents, pf.id
        ORDER BY pb.created_at DESC
        LIMIT ${limitN} OFFSET ${offsetN}
      `);
    }
    return res.json({ batches: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/treasury/batches  — create a new payout batch
router.post('/batches', async (req: Request, res: Response) => {
  try {
    const { owner_scope = 'company', owner_id = null, settlement_ids = [], notes = null } = req.body;

    if (!settlement_ids.length) {
      return res.status(400).json({ error: 'settlement_ids required' });
    }

    // Sum up the settlements
    const ids = settlement_ids.map(Number).filter(Boolean);
    const settlements = await db.execute(sql`
      SELECT id, station_amount_cents, held_in_reserve, payout_hold_reason
      FROM station_settlements
      WHERE id = ANY(${ids}::int[])
    `);

    const blocked = (settlements.rows as any[]).filter(s => s.held_in_reserve || s.payout_hold_reason);
    if (blocked.length) {
      return res.status(400).json({
        error: 'Cannot batch settlements with active holds or reserves',
        blocked: blocked.map(b => ({ id: b.id, reason: b.payout_hold_reason ?? 'held_in_reserve' })),
      });
    }

    const total = (settlements.rows as any[]).reduce((sum, s) => sum + (s.station_amount_cents ?? 0), 0);
    const batchRef = `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const batchRaw = await db.execute(sql`
      INSERT INTO payout_batches
        (batch_id, owner_scope, owner_id, total_net_cents, currency, status, notes, created_by_uid, total_providers)
      VALUES
        (${batchRef}, ${owner_scope}, ${owner_id}, ${total}, 'ILS', 'pending', ${notes}, NULL, ${ids.length})
      RETURNING *
    `);
    const batch = batchRaw.rows[0] as any;

    // Insert batch items
    for (const s of settlements.rows as any[]) {
      await db.execute(sql`
        INSERT INTO payout_batch_items (batch_id, settlement_id, amount_cents)
        VALUES (${batch.id}, ${s.id}, ${s.station_amount_cents})
      `);
    }

    return res.status(201).json({ batch, items: settlements.rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/treasury/batches/:id/submit
router.post('/batches/:id/submit', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.execute(sql`
      UPDATE payout_batches SET status = 'submitted', submitted_at = NOW()
      WHERE id = ${id} AND status = 'approved'
      RETURNING *
    `);
    if (!result.rows[0]) {
      return res.status(400).json({ error: 'Batch not found or not in approved state' });
    }
    await db.execute(sql`
      UPDATE payout_batch_items SET status = 'submitted' WHERE batch_id = ${id}
    `);
    return res.json({ batch: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/treasury/batches/:id/mark-paid
router.post('/batches/:id/mark-paid', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.execute(sql`
      UPDATE payout_batches SET status = 'paid', paid_at = NOW()
      WHERE id = ${id} AND status = 'submitted'
      RETURNING *
    `);
    if (!result.rows[0]) {
      return res.status(400).json({ error: 'Batch not found or not in submitted state' });
    }
    await db.execute(sql`
      UPDATE payout_batch_items SET status = 'paid' WHERE batch_id = ${id}
    `);
    // Trigger reconciliation immediately
    try { await reconcileBatch(id); } catch { /* reconciliation runs async — non-blocking */ }
    return res.json({ batch: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T172 — Bank transaction import
// ---------------------------------------------------------------------------

// POST /api/treasury/import-bank-transactions
router.post('/import-bank-transactions', async (req: Request, res: Response) => {
  try {
    const { transactions } = req.body as {
      transactions: Array<{
        bank_ref?: string;
        amount_cents: number;
        currency?: string;
        direction: 'outgoing' | 'incoming';
        reference?: string;
        raw_description?: string;
        value_date?: string;
      }>;
    };

    if (!Array.isArray(transactions) || !transactions.length) {
      return res.status(400).json({ error: 'transactions array required' });
    }

    let imported = 0, skipped = 0;

    for (const tx of transactions) {
      // Map to existing bank_transactions schema
      const amountILS = tx.amount_cents / 100;
      const debit = tx.direction === 'outgoing' ? amountILS : null;
      const credit = tx.direction === 'incoming' ? amountILS : null;

      if (tx.bank_ref) {
        // Deduplicate by reference_number
        const existing = await db.execute(sql`
          SELECT id FROM bank_transactions WHERE reference_number = ${tx.bank_ref} LIMIT 1
        `);
        if (existing.rows[0]) { skipped++; continue; }
      }

      // Resolve default import account (upsert once per server lifecycle)
      const acctRes = await db.execute(sql`
        SELECT id FROM bank_accounts WHERE account_number = '000-000000' LIMIT 1
      `);
      let acctId = (acctRes.rows[0] as any)?.id ?? null;
      if (!acctId) {
        const newAcct = await db.execute(sql`
          INSERT INTO bank_accounts (account_number, account_name, bank_name, branch_name, currency, is_active, created_at)
          VALUES ('000-000000', 'PetWash Treasury (Import)', 'Bank Hapoalim', 'Main Branch', 'ILS', true, NOW())
          RETURNING id
        `);
        acctId = (newAcct.rows[0] as any)?.id;
      }

      await db.execute(sql`
        INSERT INTO bank_transactions
          (account_id, reference_number, debit_amount, credit_amount, description, currency,
           transaction_date, value_date, reconciliation_status, import_batch_id, imported_at)
        VALUES
          (${acctId}, ${tx.bank_ref ?? null}, ${debit ?? 0}, ${credit ?? 0},
           ${tx.raw_description ?? tx.reference ?? 'Bank import'},
           ${tx.currency ?? 'ILS'},
           ${tx.value_date ?? new Date().toISOString().slice(0, 10)},
           ${tx.value_date ?? new Date().toISOString().slice(0, 10)},
           'pending', ${'IMPORT-' + Date.now()}, NOW())
      `);
      imported++;
    }

    return res.json({ imported, skipped, total: transactions.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/treasury/bank-transactions
router.get('/bank-transactions', async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0', reconciled } = req.query as Record<string, string>;
    const limitN = Math.min(parseInt(limit, 10), 200);
    const offsetN = parseInt(offset, 10);

    let result;
    if (reconciled === 'false') {
      result = await db.execute(sql`
        SELECT id, reference_number, debit_amount, credit_amount, description,
               currency, transaction_date, value_date, reconciliation_status, imported_at
        FROM bank_transactions
        WHERE reconciliation_status IS DISTINCT FROM 'matched'
        ORDER BY imported_at DESC NULLS LAST
        LIMIT ${limitN} OFFSET ${offsetN}
      `);
    } else {
      result = await db.execute(sql`
        SELECT id, reference_number, debit_amount, credit_amount, description,
               currency, transaction_date, value_date, reconciliation_status, imported_at
        FROM bank_transactions
        ORDER BY imported_at DESC NULLS LAST
        LIMIT ${limitN} OFFSET ${offsetN}
      `);
    }
    return res.json({ transactions: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T173 — Reconciliation
// ---------------------------------------------------------------------------

// POST /api/treasury/reconcile/:batchId
router.post('/reconcile/:batchId', async (req: Request, res: Response) => {
  try {
    const batchId = parseInt(req.params.batchId, 10);
    const result = await reconcileBatch(batchId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/treasury/reconcile-sweep  — manual trigger for sweep
router.post('/reconcile-sweep', async (req: Request, res: Response) => {
  try {
    const result = await runReconciliationSweep();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/treasury/reconciliation-results
router.get('/reconciliation-results', async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT rr.*, pb.batch_id AS batch_ref, pb.total_net_cents AS batch_amount,
             bt.reference_number, bt.description AS bank_description
      FROM reconciliation_results rr
      LEFT JOIN payout_batches pb ON pb.id = rr.batch_id
      LEFT JOIN bank_transactions bt ON bt.id = rr.bank_transaction_id
      ORDER BY rr.created_at DESC
      LIMIT 100
    `);
    return res.json({ results: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T174 — Failure handling
// ---------------------------------------------------------------------------

// GET /api/treasury/failures
router.get('/failures', async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT pf.*, pb.batch_id AS batch_ref, pb.total_net_cents, pb.status AS batch_status
      FROM payout_failures pf
      LEFT JOIN payout_batches pb ON pb.id = pf.batch_id
      WHERE pf.resolved = false
      ORDER BY pf.created_at DESC
    `);
    return res.json({ failures: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/treasury/failures/:id/retry
router.post('/failures/:id/retry', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const failure = await db.execute(sql`
      SELECT pf.*, pb.status AS batch_status
      FROM payout_failures pf
      LEFT JOIN payout_batches pb ON pb.id = pf.batch_id
      WHERE pf.id = ${id}
    `);
    const f = failure.rows[0] as any;
    if (!f) return res.status(404).json({ error: 'Failure not found' });

    // Reset batch to submitted for retry
    await db.execute(sql`
      UPDATE payout_batches SET status = 'submitted', failed_at = NULL WHERE id = ${f.batch_id}
    `);
    await db.execute(sql`
      UPDATE payout_failures SET retry_count = retry_count + 1, last_retry_at = NOW() WHERE id = ${id}
    `);
    await db.execute(sql`
      DELETE FROM reconciliation_results WHERE batch_id = ${f.batch_id}
    `);

    return res.json({ ok: true, message: 'Batch reset to submitted — run reconciliation again' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/treasury/failures/:id/resolve
router.post('/failures/:id/resolve', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.execute(sql`UPDATE payout_failures SET resolved = true WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T175 — Treasury status
// ---------------------------------------------------------------------------

// GET /api/treasury/status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const totals = await db.execute(sql`
      SELECT
        COUNT(*)                                                                          AS total_batches,
        COALESCE(SUM(total_net_cents), 0)                                                AS total_amount_cents,
        COALESCE(SUM(CASE WHEN status = 'pending'     THEN total_net_cents ELSE 0 END), 0) AS pending_cents,
        COALESCE(SUM(CASE WHEN status = 'approved'    THEN total_net_cents ELSE 0 END), 0) AS approved_cents,
        COALESCE(SUM(CASE WHEN status = 'submitted'   THEN total_net_cents ELSE 0 END), 0) AS submitted_cents,
        COALESCE(SUM(CASE WHEN status = 'paid'        THEN total_net_cents ELSE 0 END), 0) AS paid_cents,
        COALESCE(SUM(CASE WHEN status = 'failed'      THEN total_net_cents ELSE 0 END), 0) AS failed_cents,
        COALESCE(SUM(CASE WHEN status = 'reconciled'  THEN total_net_cents ELSE 0 END), 0) AS reconciled_cents,
        COUNT(CASE WHEN status = 'pending'    THEN 1 END)                                AS pending_count,
        COUNT(CASE WHEN status = 'submitted'  THEN 1 END)                                AS submitted_count,
        COUNT(CASE WHEN status = 'paid'       THEN 1 END)                                AS paid_count,
        COUNT(CASE WHEN status = 'failed'     THEN 1 END)                                AS failed_count,
        COUNT(CASE WHEN status = 'reconciled' THEN 1 END)                                AS reconciled_count
      FROM payout_batches
    `);

    const reconStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'matched')   AS matched,
        COUNT(*) FILTER (WHERE status = 'partial')   AS partial,
        COUNT(*) FILTER (WHERE status = 'unmatched') AS unmatched,
        COUNT(*)                                     AS total
      FROM reconciliation_results
    `);

    const failureCount = await db.execute(sql`
      SELECT COUNT(*) AS open_failures FROM payout_failures WHERE resolved = false
    `);

    const bankUnlinked = await db.execute(sql`
      SELECT COUNT(*) AS unlinked FROM bank_transactions
      WHERE reconciliation_status IS DISTINCT FROM 'matched'
    `);

    const recon = reconStats.rows[0] as any;
    const totalRecon = parseInt(recon?.total ?? '0');
    const matchedRecon = parseInt(recon?.matched ?? '0') + parseInt(recon?.partial ?? '0');
    const reconHealthPct = totalRecon > 0 ? Math.round((matchedRecon / totalRecon) * 100) : null;

    return res.json({
      totals: totals.rows[0],
      reconciliation: {
        ...reconStats.rows[0],
        health_pct: reconHealthPct,
      },
      open_failures: parseInt((failureCount.rows[0] as any)?.open_failures ?? '0'),
      unlinked_bank_transactions: parseInt((bankUnlinked.rows[0] as any)?.unlinked ?? '0'),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T179 — End-to-end settlement trace
// ---------------------------------------------------------------------------

// GET /api/treasury/trace/:settlementId
router.get('/trace/:settlementId', async (req: Request, res: Response) => {
  try {
    const settlementId = parseInt(req.params.settlementId, 10);

    // Settlement
    const settlementRaw = await db.execute(sql`
      SELECT * FROM station_settlements WHERE id = ${settlementId}
    `);
    const settlement = settlementRaw.rows[0] as any;
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

    // Batch item → batch
    const batchItemRaw = await db.execute(sql`
      SELECT pbi.*, pb.batch_id AS batch_ref, pb.status AS batch_status,
             pb.total_net_cents, pb.submitted_at, pb.paid_at, pb.reconciled_at
      FROM payout_batch_items pbi
      LEFT JOIN payout_batches pb ON pb.id = pbi.batch_id
      WHERE pbi.settlement_id = ${settlementId}
      LIMIT 1
    `);
    const batchItem = batchItemRaw.rows[0] as any ?? null;

    // Approval log
    const approvalRaw = await db.execute(sql`
      SELECT * FROM financial_approval_log
      WHERE case_type = 'payout_release' AND case_ref_id = ${String(settlementId)}
      ORDER BY created_at DESC LIMIT 1
    `);
    const approval = approvalRaw.rows[0] ?? null;

    // Reconciliation
    let recon = null;
    let bankTx = null;
    if (batchItem) {
      const reconRaw = await db.execute(sql`
        SELECT rr.*, bt.reference_number, bt.debit_amount, bt.description AS bank_description
        FROM reconciliation_results rr
        LEFT JOIN bank_transactions bt ON bt.id = rr.bank_transaction_id
        WHERE rr.batch_id = ${batchItem.batch_id}
        LIMIT 1
      `);
      recon = reconRaw.rows[0] ?? null;
      if (recon && (recon as any).bank_transaction_id) {
        const btRaw = await db.execute(sql`
          SELECT id, reference_number, debit_amount, description, transaction_date, reconciliation_status
          FROM bank_transactions WHERE id = ${(recon as any).bank_transaction_id}
        `);
        bankTx = btRaw.rows[0] ?? null;
      }
    }

    return res.json({
      settlement,
      batchItem,
      approvalLog: approval,
      reconciliation: recon,
      bankTransaction: bankTx,
      traceComplete: !!(settlement && batchItem && recon && bankTx),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Phase 12.18 — Forecasting, Liquidity & Reserve Planning
// ---------------------------------------------------------------------------

// T181 — GET /api/treasury/forecast-snapshot
router.get('/forecast-snapshot', async (req: Request, res: Response) => {
  try {
    const result = await forecastSnapshot();
    return res.json({ windows: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// T182 — GET /api/treasury/reserve-ageing
router.get('/reserve-ageing', async (req: Request, res: Response) => {
  try {
    const result = await reserveAgeing();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// T183 — GET /api/treasury/liquidity-pressure
router.get('/liquidity-pressure', async (req: Request, res: Response) => {
  try {
    const result = await liquidityPressure();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// T184 — GET /api/treasury/payout-calendar-forecast
router.get('/payout-calendar-forecast', async (req: Request, res: Response) => {
  try {
    const result = await payoutCalendarForecast();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// T185 — GET /api/treasury/risk-comparison
router.get('/risk-comparison', async (req: Request, res: Response) => {
  try {
    const result = await riskComparison();
    return res.json({ entities: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// T186 — GET /api/treasury/warnings
router.get('/warnings', async (req: Request, res: Response) => {
  try {
    const result = await treasuryWarnings();
    return res.json({ warnings: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// T187 — GET /api/treasury/forecast-vs-actual
router.get('/forecast-vs-actual', async (req: Request, res: Response) => {
  try {
    const result = await forecastVsActual();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

// ---------------------------------------------------------------------------
// T177 — Scheduled reconciliation sweep (called from server startup)
// ---------------------------------------------------------------------------
export function startReconciliationScheduler() {
  const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  setInterval(async () => {
    try {
      const result = await runReconciliationSweep();
      if (result.processed > 0) {
        console.log(`[TreasuryRecon] Sweep complete — processed:${result.processed} matched:${result.matched} partial:${result.partial} unmatched:${result.unmatched}`);
      }
    } catch (err) {
      console.error('[TreasuryRecon] Sweep error:', err);
    }
  }, INTERVAL_MS);
  console.log('[TreasuryRecon] Scheduler started — sweeps every 15 min');
}
