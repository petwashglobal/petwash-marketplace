/**
 * Backfill the historical Nayax K9000 washes into the product database.
 *
 * WHY THIS EXISTS
 * ───────────────
 * On 2026-09-06 the Pet Wash product held ZERO rows for the K9000 bays:
 *   k9000_wash_events        0
 *   nayax_transaction_events 0
 *   kiosk_machines           0
 * …while SUMIT held 481 real tax invoices and the Nayax export held 513 real
 * transactions worth ₪20,945. The money was genuine, the fiscal record was
 * genuine, and none of it was visible in the admin backend. This script closes
 * that gap and can be re-run whenever a fresher Nayax export arrives.
 *
 * WHAT IT IS NOT
 * ──────────────
 * It is RECORD-ONLY, exactly like services/nayaxEventImport.ts:
 *   • never awards loyalty points, never touches a wallet
 *   • never issues, edits or voids a fiscal document — `sumit_document_id` is a
 *     REFERENCE to the document SUMIT already owns. SUMIT + the ITA remain the
 *     single write authority over fiscal truth; this table is a mirror for
 *     reporting, and must never become a second one.
 *
 * SAFETY
 * ──────
 *   • Dry run by default. `--confirm` is required to write.
 *   • Idempotent: every insert is guarded by the UNIQUE idempotency_key
 *     ('NAYAX:<transactionId>') with ON CONFLICT DO NOTHING, so re-running a
 *     report can never double-count a wash.
 *   • Currency is carried through verbatim. A non-ILS row is stored with its own
 *     currency so no reader can sum it into a shekel total — the mistake Nayax's
 *     own report footer makes.
 *   • Only settled rows (Nayax status 12) are marked 'completed'; everything
 *     else is 'failed' and contributes no revenue.
 *
 * USAGE
 *   tsx scripts/backfill-nayax-history.ts <reconciled.json>            # dry run
 *   tsx scripts/backfill-nayax-history.ts <reconciled.json> --confirm  # write
 *
 * The input is the reconciled Nayax ↔ fiscal-ledger ↔ SUMIT join produced by the
 * fiscal bridge (petwash-nayax-sumit-fiscal). Each row carries: transactionId,
 * machineId, iso, settlementValue, currency, statusId, sumitDocId, classification.
 */
import fs from 'node:fs';
import { sql } from 'drizzle-orm';
import { db } from '../server/db';
import { NAYAX_TERMINALS, terminalForMachine } from '../server/services/nayaxTerminals';

interface ReconciledRow {
  transactionId: string;
  machineId: string;
  iso: string;
  settlementValue: number | null;
  currency: string;
  statusId: number | string;
  sumitDocId?: string;
  classification?: string;
}

/** Nayax transaction status 12 = settled. Anything else moved no money. */
const NAYAX_STATUS_SETTLED = 12;

async function main(): Promise<void> {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const confirm = process.argv.includes('--confirm');
  if (!file) throw new Error('usage: backfill-nayax-history.ts <reconciled.json> [--confirm]');

  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows: ReconciledRow[] = Array.isArray(parsed) ? parsed : parsed.rows;
  if (!Array.isArray(rows)) throw new Error('input must be an array or { rows: [...] }');

  // Refuse to guess: an unregistered machine means nayaxTerminals.ts is stale and
  // the wash would land with no station label, which is how a third of revenue
  // went unattributed before 2026-09-06.
  const unknown = [...new Set(rows.map((r) => r.machineId).filter((m) => !terminalForMachine(m)))];
  if (unknown.length) {
    throw new Error(
      `machine(s) ${unknown.join(', ')} are not in NAYAX_TERMINALS ` +
      `(registered: ${Object.keys(NAYAX_TERMINALS).join(', ')}). Add them before backfilling.`,
    );
  }

  const settled = rows.filter((r) => Number(r.statusId) === NAYAX_STATUS_SETTLED);
  const ils = settled.filter((r) => r.currency === 'ILS');
  console.log(`rows              : ${rows.length}`);
  console.log(`settled           : ${settled.length}`);
  console.log(`settled ILS       : ${ils.length}  ₪${ils.reduce((a, r) => a + (r.settlementValue ?? 0), 0)}`);
  console.log(`settled non-ILS   : ${settled.length - ils.length}  (never summed into ₪)`);
  console.log(`with SUMIT doc    : ${rows.filter((r) => r.sumitDocId).length}`);
  if (!confirm) { console.log('\nDRY RUN — pass --confirm to write.'); return; }

  let inserted = 0;
  for (const r of rows) {
    const t = terminalForMachine(r.machineId)!;
    const res = await db.execute(sql`
      insert into k9000_wash_events
        (transaction_source, redemption_source, nayax_transaction_id, nayax_terminal_id,
         station_id, bay_side, platform, product, amount_cents, currency, status,
         idempotency_key, sumit_document_id, created_at)
      values ('nayax', 'nayax', ${r.transactionId}, ${r.machineId},
              ${t.stationId}, ${t.bay.toLowerCase()}, 'k9000',
              ${r.classification ?? 'K9000 self-service wash'},
              ${Math.round((r.settlementValue ?? 0) * 100)}, ${r.currency || 'ILS'},
              ${Number(r.statusId) === NAYAX_STATUS_SETTLED ? 'completed' : 'failed'},
              ${`NAYAX:${r.transactionId}`}, ${r.sumitDocId ?? null}, ${r.iso})
      on conflict (idempotency_key) do nothing
      returning id`);
    if ((res as unknown as { rowCount?: number }).rowCount) inserted++;
  }
  console.log(`inserted ${inserted} new wash event(s); ${rows.length - inserted} already present`);
}

main().catch((e) => { console.error(`[backfill-nayax-history] ${e.message}`); process.exit(1); });
