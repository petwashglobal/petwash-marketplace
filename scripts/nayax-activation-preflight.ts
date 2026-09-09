/**
 * Activation pre-flight — READ ONLY.
 *
 *   npx tsx scripts/nayax-activation-preflight.ts
 *
 * Answers one question: may the K9000 fiscal rail be switched on? It writes
 * nothing, issues nothing and flips nothing. Exits 0 only when every check
 * passes; a check that could not be performed exits non-zero exactly like a
 * failure, because "we couldn't tell" is not permission to issue tax documents.
 */
import { inspect } from 'node:util';
import { bridgeWired, fiscalCutoverAt } from '../server/services/nayaxSumitBridge';
import { NAYAX_TERMINALS } from '../server/services/nayaxTerminals';
import {
  runPreflight, formatPreflight, preflightVerdict, type PreflightInputs,
} from '../server/services/nayaxActivationPreflight';

async function readSchemaState(): Promise<Pick<
  PreflightInputs, 'tablesPresent' | 'claimUniqueIndexPresent' | 'unresolvedClaims'
>> {
  // Every failure path below returns null (UNKNOWN), never false — an
  // unreachable database tells us nothing about what the schema contains.
  try {
    const { pool } = await import('../server/db');
    const t = await pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name = ANY($1)`,
      [['nayax_sale_issuance_attempts', 'nayax_refund_events', 'nayax_fiscal_document_links']],
    );
    const have = new Set(t.rows.map((r: any) => r.table_name));
    const tablesPresent = {
      nayax_sale_issuance_attempts: have.has('nayax_sale_issuance_attempts'),
      nayax_refund_events: have.has('nayax_refund_events'),
      nayax_fiscal_document_links: have.has('nayax_fiscal_document_links'),
    };

    let claimUniqueIndexPresent: boolean | null = null;
    if (tablesPresent.nayax_sale_issuance_attempts) {
      const idx = await pool.query(
        `SELECT indexname FROM pg_indexes
          WHERE tablename='nayax_sale_issuance_attempts' AND indexname='uq_nayax_sale_issuance'`,
      );
      claimUniqueIndexPresent = idx.rows.length > 0;
    }

    let unresolvedClaims: PreflightInputs['unresolvedClaims'] = null;
    if (tablesPresent.nayax_sale_issuance_attempts) {
      const c = await pool.query(
        `SELECT state, count(*)::int AS n FROM nayax_sale_issuance_attempts
          WHERE state IN ('PENDING_LOOKUP','NEEDS_RECONCILIATION') GROUP BY state`,
      );
      const get = (s: string) => Number(c.rows.find((r: any) => r.state === s)?.n ?? 0);
      unresolvedClaims = {
        pendingLookup: get('PENDING_LOOKUP'),
        needsReconciliation: get('NEEDS_RECONCILIATION'),
      };
    }
    return { tablesPresent, claimUniqueIndexPresent, unresolvedClaims };
  } catch (err) {
    // Print something an operator can act on. String(err) on a thrown object
    // yields "[object Object]", which tells nobody anything.
    // JSON.stringify on a non-Error throwable yields "{}" (no enumerable props),
    // which is as useless as "[object Object]". util.inspect shows the real shape.
    const why = err instanceof Error
      ? err.message
      : inspect(err, { depth: 2, breakLength: 120 });
    console.error(`[preflight] database unreachable — schema checks are UNKNOWN: ${why}`);
    return { tablesPresent: null, claimUniqueIndexPresent: null, unresolvedClaims: null };
  }
}

async function readFeedState(machineIds: string[]): Promise<boolean | null> {
  try {
    const { LynxClient } = await import('../server/services/LynxClient');
    // LynxResult = { ok, status, wired, error, ... }. Read it precisely:
    //   not wired            → definite NO  (no feed is configured at all)
    //   ok                   → YES
    //   401 / 403            → definite NO  (credential or permission missing —
    //                          the 403-on-all-machines state we are actually in)
    //   anything else        → UNKNOWN, never a pass
    const r = await LynxClient.getLastSales(machineIds[0]);
    if (r.wired === false) return false;
    if (r.ok === true) return true;
    if (r.status === 401 || r.status === 403) return false;
    return null;
  } catch {
    return null;
  }
}

(async () => {
  const expected = Object.keys(NAYAX_TERMINALS);
  const schema = await readSchemaState();
  const results = runPreflight({
    wired: bridgeWired(),
    cutoverAt: fiscalCutoverAt(),
    now: new Date(),
    expectedMachineIds: expected,
    registeredMachineIds: Object.keys(NAYAX_TERMINALS),
    continuousFeed: await readFeedState(expected),
    ...schema,
  });

  console.log('\nK9000 fiscal rail — activation pre-flight (read-only)\n');
  console.log(formatPreflight(results));
  console.log('');
  process.exit(preflightVerdict(results).ready ? 0 : 1);
})();
