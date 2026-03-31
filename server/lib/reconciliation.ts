import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface ReconciliationResult {
  status: 'matched' | 'partial' | 'unmatched';
  expected: number;
  actual: number;
  difference: number;
  bankTransactionId: number | null;
}

// Tolerance for partial match — within 1% or 100 cents (₪1), whichever is larger
function withinTolerance(expected: number, actual: number): boolean {
  const diff = Math.abs(expected - actual);
  const tolerance = Math.max(100, Math.round(expected * 0.01));
  return diff <= tolerance;
}

export async function reconcileBatch(batchId: number): Promise<ReconciliationResult> {
  // Load the batch
  const batchRaw = await db.execute(sql`
    SELECT id, batch_id, total_net_cents, status FROM payout_batches WHERE id = ${batchId}
  `);
  const batch = batchRaw.rows[0] as any;
  if (!batch) throw new Error(`Batch ${batchId} not found`);

  const expected = batch.total_net_cents as number;
  const batchRef = batch.batch_id as string;

  // Find matching bank transaction:
  // 1. By reference_number matching batch_ref
  // 2. Or by debit_amount within tolerance (outgoing = debit)
  const matchByRef = await db.execute(sql`
    SELECT id, debit_amount, credit_amount, reference_number
    FROM bank_transactions
    WHERE reference_number = ${batchRef}
    ORDER BY id DESC LIMIT 1
  `);

  let bankTx = matchByRef.rows[0] as any;

  if (!bankTx) {
    // Try amount match — debit side (payout = money going out)
    const matchByAmount = await db.execute(sql`
      SELECT id, debit_amount, credit_amount, reference_number
      FROM bank_transactions
      WHERE ABS(COALESCE(debit_amount, 0) * 100 - ${expected}) <= GREATEST(100, ${Math.round(expected * 0.01)})
        AND reconciliation_status IS DISTINCT FROM 'matched'
      ORDER BY ABS(COALESCE(debit_amount, 0) * 100 - ${expected}) ASC
      LIMIT 1
    `);
    bankTx = matchByAmount.rows[0] as any;
  }

  let result: ReconciliationResult;

  if (!bankTx) {
    result = { status: 'unmatched', expected, actual: 0, difference: expected, bankTransactionId: null };
  } else {
    // bank stores amounts in ILS (not cents) — convert
    const actualCents = Math.round(parseFloat(bankTx.debit_amount ?? bankTx.credit_amount ?? '0') * 100);
    const diff = expected - actualCents;

    if (diff === 0) {
      result = { status: 'matched', expected, actual: actualCents, difference: 0, bankTransactionId: bankTx.id };
    } else if (withinTolerance(expected, actualCents)) {
      result = { status: 'partial', expected, actual: actualCents, difference: diff, bankTransactionId: bankTx.id };
    } else {
      result = { status: 'unmatched', expected, actual: actualCents, difference: diff, bankTransactionId: bankTx.id };
    }
  }

  // Upsert reconciliation_results
  await db.execute(sql`
    INSERT INTO reconciliation_results
      (batch_id, bank_transaction_id, status, amount_expected, amount_actual, difference_cents)
    VALUES
      (${batchId}, ${result.bankTransactionId}, ${result.status}, ${result.expected}, ${result.actual}, ${result.difference})
    ON CONFLICT DO NOTHING
  `);

  // If matched or partial, mark bank tx as matched
  if (result.bankTransactionId && result.status !== 'unmatched') {
    await db.execute(sql`
      UPDATE bank_transactions SET reconciliation_status = 'matched' WHERE id = ${result.bankTransactionId}
    `);
  }

  // Update batch status
  if (result.status === 'matched') {
    await db.execute(sql`
      UPDATE payout_batches SET status = 'reconciled', reconciled_at = NOW() WHERE id = ${batchId}
    `);
  } else if (result.status === 'unmatched') {
    // Insert failure if not already present
    const existingFail = await db.execute(sql`
      SELECT id FROM payout_failures WHERE batch_id = ${batchId} AND resolved = false LIMIT 1
    `);
    if (!existingFail.rows[0]) {
      await db.execute(sql`
        INSERT INTO payout_failures (batch_id, reason)
        VALUES (${batchId}, 'No matching bank transaction found — amount or reference mismatch')
      `);
    }
  }

  return result;
}

export async function runReconciliationSweep(): Promise<{
  processed: number;
  matched: number;
  partial: number;
  unmatched: number;
}> {
  // Find all paid batches that are not yet reconciled and have no result
  const unreconciled = await db.execute(sql`
    SELECT pb.id
    FROM payout_batches pb
    WHERE pb.status IN ('paid', 'submitted')
      AND pb.id NOT IN (SELECT DISTINCT batch_id FROM reconciliation_results WHERE batch_id IS NOT NULL)
    LIMIT 50
  `);

  let matched = 0, partial = 0, unmatched = 0;

  for (const row of unreconciled.rows as any[]) {
    try {
      const r = await reconcileBatch(row.id);
      if (r.status === 'matched') matched++;
      else if (r.status === 'partial') partial++;
      else unmatched++;
    } catch {
      unmatched++;
    }
  }

  return { processed: unreconciled.rows.length, matched, partial, unmatched };
}
