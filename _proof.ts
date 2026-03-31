import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function main() {
  // === T004: Read reconciliation proof ===
  const recon = await db.execute(sql`
    SELECT report_id, discrepancy_count, critical_issues, status,
           payload
    FROM pw_reconciliation_reports
    WHERE report_id = 'RECON-2026-03-29-XQKLZC'`);
  const row = recon.rows[0] as any;
  console.log(`\n=== RECONCILIATION REPORT PROOF ===`);
  console.log(`Report: ${row.report_id} | discrepancies=${row.discrepancy_count} | criticals=${row.critical_issues} | status=${row.status}`);
  
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  const discrepancies = payload?.discrepancies || [];
  console.log(`\nFull discrepancy list (${discrepancies.length} items):`);
  for (const d of discrepancies) {
    console.log(`  [${(d.severity||'').toUpperCase()}] ${d.type} | payment:${d.paymentId||'n/a'} | ${d.detail}`);
  }
  
  // Clean up proof data
  await db.execute(sql`DELETE FROM pw_payments WHERE payment_id LIKE 'PROOF-%'`);
  console.log('\nStress data cleaned.');

  // === T003: Full payout failure + retry lifecycle ===
  console.log(`\n=== PAYOUT FAILURE + RETRY LIFECYCLE ===`);
  
  // Create batch for failure test
  const batchResult = await db.execute(sql`
    INSERT INTO payout_batches 
      (batch_id, owner_scope, total_net_cents, currency, status, notes, created_by_uid, total_providers)
    VALUES 
      ('BATCH-FAIL-TEST-001', 'company', 20000, 'ILS', 'submitted', 'Failure simulation batch', 'admin', 1)
    RETURNING id, batch_id, status`);
  const batch = batchResult.rows[0] as any;
  console.log(`Batch created: id=${batch.id} batch_id=${batch.batch_id} status=${batch.status}`);

  // Simulate bank rejection — inject failure record
  const failResult = await db.execute(sql`
    INSERT INTO payout_failures (batch_id, reason, retry_count, resolved)
    VALUES (${batch.id}, 'BANK_REJECTED: Invalid IBAN for station owner. BSP error 0x34F2.', 0, false)
    RETURNING id`);
  const failureId = (failResult.rows[0] as any).id;
  
  // Mark batch as failed
  await db.execute(sql`
    UPDATE payout_batches SET status = 'failed', failed_at = NOW() WHERE id = ${batch.id}`);
  
  const afterFail = await db.execute(sql`
    SELECT pf.id as failure_id, pf.reason, pf.retry_count, pf.resolved, pb.status as batch_status
    FROM payout_failures pf JOIN payout_batches pb ON pb.id = pf.batch_id
    WHERE pf.id = ${failureId}`);
  console.log(`Failure state: ${JSON.stringify(afterFail.rows[0])}`);

  // RETRY: reset batch to submitted, increment retry count
  await db.execute(sql`
    UPDATE payout_batches SET status = 'submitted', failed_at = NULL WHERE id = ${batch.id}`);
  await db.execute(sql`
    UPDATE payout_failures SET retry_count = retry_count + 1, last_retry_at = NOW() WHERE id = ${failureId}`);
  
  const afterRetry = await db.execute(sql`
    SELECT pf.retry_count, pf.last_retry_at, pb.status as batch_status
    FROM payout_failures pf JOIN payout_batches pb ON pb.id = pf.batch_id
    WHERE pf.id = ${failureId}`);
  console.log(`After retry: ${JSON.stringify(afterRetry.rows[0])}`);

  // RESOLVE: mark batch paid, resolve failure
  await db.execute(sql`
    UPDATE payout_batches SET status = 'paid', paid_at = NOW() WHERE id = ${batch.id}`);
  await db.execute(sql`
    UPDATE payout_failures SET resolved = true WHERE id = ${failureId}`);

  const final = await db.execute(sql`
    SELECT pb.id, pb.batch_id, pb.status, pb.paid_at::date as paid_date,
           pf.resolved as failure_resolved, pf.retry_count
    FROM payout_batches pb JOIN payout_failures pf ON pf.batch_id = pb.id
    WHERE pb.id = ${batch.id}`);
  console.log(`FINAL STATE: ${JSON.stringify(final.rows[0])}`);
}
main();
