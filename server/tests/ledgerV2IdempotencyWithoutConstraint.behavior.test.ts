/**
 * LEDGER V2 MUST BE IDEMPOTENT WITHOUT THE UNIQUE INDEX.
 *
 * Both write paths leaned on a database constraint that DOES NOT EXIST in
 * production. `ledger_v2_transactions.idempotency_key` and
 * `ledger_v2_pending_transfers.idempotency_key` are declared UNIQUE in
 * shared/schema.ts and are among 20 declared uniques missing from prod (staged
 * in migrations/0166, deliberately unapplied — CREATE UNIQUE INDEX fails on
 * pre-existing duplicates and blocks every deploy). So the second insert
 * SUCCEEDS and the catch that was supposed to convert it into an idempotent
 * replay never fires.
 *
 *   postMovement  pre-checked the key OUTSIDE its transaction. Two deliveries
 *                 both passed, then queued on the same account locks; the
 *                 loser woke up still believing the key was unseen and wrote a
 *                 SECOND envelope — two transactions for one business event,
 *                 in the table that is meant to be the money authority.
 *   openPending   had no transaction and no lock at all: bare SELECT, insert,
 *                 `catch {}`.
 *
 * Both are latent today — LEDGER_V2_ENABLED / LEDGER_V2_DUAL_WRITE both default
 * false and neither is set in petwash-ci.yml — which is precisely why this is
 * the moment to fix them, before those flags are ever turned on.
 *
 * STRUCTURAL, deliberately. pglite runs a SINGLE connection, so a behavioural
 * race test cannot fail here whatever the code does (proved on the refund cap:
 * the lock was deleted and the "race" tests still passed). The guarantee is
 * pinned on the source, where breaking it does fail.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '..', 'services', 'LedgerService.ts'), 'utf8');
/** One function's source, ending where the next top-level declaration begins. */
const fnBody = (name: string): string => {
  const at = src.indexOf(name);
  expect(at, `${name} not found`).toBeGreaterThan(-1);
  const rest = src.slice(at + name.length);
  const next = rest.search(/\n(?:export )?(?:async )?function |\nexport const /);
  return src.slice(at, next === -1 ? src.length : at + name.length + next);
};

describe('postMovement re-checks the key UNDER the account locks', () => {
  const fn = fnBody('async function realPostMovement');

  it('the authoritative check comes AFTER the FOR UPDATE locks', () => {
    const lock = fn.indexOf('FOR UPDATE');
    const check = fn.indexOf('SELECT transaction_id FROM ledger_v2_transactions WHERE idempotency_key', lock);
    expect(lock).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(lock);
  });

  it('and BEFORE the envelope is written', () => {
    const lock = fn.indexOf('FOR UPDATE');
    const check = fn.indexOf('SELECT transaction_id FROM ledger_v2_transactions WHERE idempotency_key', lock);
    const insert = fn.indexOf('insert(ledgerTransactions)', lock);
    expect(insert).toBeGreaterThan(check);
  });

  it('a key already present returns the WINNER as an idempotent replay', () => {
    expect(fn).toMatch(/if \(underLockRows\.length > 0\) return String\(underLockRows\[0\]\.transaction_id\)/);
    expect(fn).toMatch(/if \(existingTransactionId\) \{/);
  });

  it('the unique index is no longer described as the guard', () => {
    // It used to read: "UNIQUE(idempotency_key) is the double-post kill".
    expect(fn).not.toMatch(/UNIQUE\(idempotency_key\) is the double-post kill/);
    expect(fn).toMatch(/NOT PRESENT IN\s*\n\s*\/\/ PRODUCTION/);
  });
});

describe('openPending checks and inserts under ONE lock', () => {
  const fn = fnBody('async function realOpenPending');

  it('there is a transaction, and the lock is taken inside it', () => {
    const tx = fn.indexOf('db as any).transaction(');
    const lock = fn.indexOf('pg_advisory_xact_lock', tx);
    expect(tx).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(tx);
  });

  it('the duplicate check and the insert both sit after that lock', () => {
    const lock = fn.indexOf('pg_advisory_xact_lock');
    const check = fn.indexOf('SELECT pending_id, open_entry_txn FROM ledger_v2_pending_transfers', lock);
    const insert = fn.indexOf('insert(ledgerPendingTransfers)', lock);
    expect(check).toBeGreaterThan(lock);
    expect(insert).toBeGreaterThan(check);
  });

  it('a concurrent open returns the existing hold instead of opening a second', () => {
    expect(fn).toMatch(/if \(wonRace\) return \{ pendingId: wonRace\.pendingId/);
  });

  it('the catch is demoted to belt-and-braces, not the guard', () => {
    expect(fn).not.toMatch(/Concurrent open won the UNIQUE\(idempotency_key\)/);
    expect(fn).toMatch(/belt-and-braces/i);
  });
});

describe('these paths are still OFF', () => {
  it('both flags default false and must be opted into explicitly', () => {
    expect(src).toMatch(/LEDGER_V2_ENABLED = process\.env\.LEDGER_V2_ENABLED === 'true'/);
    expect(src).toMatch(/LEDGER_V2_DUAL_WRITE = process\.env\.LEDGER_V2_DUAL_WRITE === 'true'/);
  });
});
