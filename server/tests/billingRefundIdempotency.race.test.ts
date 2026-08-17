/**
 * M1 — POST /api/billing/refund must apply exactly ONE financial effect per
 * logical refund (sprint/money-concurrency, 2026-08-17).
 *
 * THE BUG
 * -------
 * `transitionEscrowState` (server/services/EscrowStateMachine.ts) read the
 * record's `payment_flow_status` OUTSIDE any transaction, validated the
 * transition in JavaScript, then opened a transaction and issued an
 * UNCONDITIONAL `UPDATE … WHERE record_id = ?`. Two concurrent refunds of the
 * same record both read `held_in_escrow`, both passed the allowed-transition
 * check, and both appended a `held_in_escrow_to_refunded` audit row carrying
 * `deltaAgorot = refundAgorot`. One payment, two refund deltas — and both rows
 * were built from the same `lastAudit`, so the SHA-256 audit hash chain forked.
 *
 * THE FIX (concurrency only — no financial rule touched)
 * ------------------------------------------------------
 *   1. read + validate + write now live in ONE transaction;
 *   2. `SELECT … FOR UPDATE` pins the record row;
 *   3. the UPDATE is a compare-and-set on the status we validated against,
 *      `.returning()` 0 rows ⇒ `EscrowConcurrentTransitionError` (409);
 *   4. the audit-chain tail is read inside the same locked transaction.
 *   5. the route additionally claims a derived idempotency key up-front via
 *      the repo's canonical fail-closed `requireStrictIdempotency`.
 *
 * WHAT THIS FILE ACHIEVES
 * -----------------------
 * BEHAVIORAL-VERIFIED for the concurrency semantics: tests 1–4 run genuinely
 * concurrent `Promise.all` calls against an in-memory model that reproduces
 * Postgres row-lock + compare-and-set semantics (the repo's established
 * DB-free race-test pattern — see walk-slot-lock-race.test.ts). Test 1 proves
 * the model DOES catch the bug by replaying the pre-fix code shape.
 * BEHAVIORAL-VERIFIED for the derived key: the real exported function is
 * imported and executed.
 * BLOCKED-LIVE against a real Postgres: no DB fixture exists in this repo's
 * vitest setup, so tests 6+ are source-introspection pins as secondary
 * protection that the shipped code keeps the shape the model proves correct.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { deriveIdempotencyKey } from '../middleware/derivedIdempotencyKey';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory model of the two Postgres primitives the fix relies on.
// ─────────────────────────────────────────────────────────────────────────────

type Status =
  | 'authorized' | 'captured' | 'held_in_escrow' | 'released'
  | 'refunded' | 'partially_refunded' | 'disputed' | 'chargeback' | 'cancelled';

interface AuditRow {
  auditId: string;
  fromStatus: Status;
  toStatus: Status;
  deltaAgorot: number | null;
  prevHash: string | null;
  entryHash: string;
}

/** Yield to the microtask + macrotask queue so racers genuinely interleave. */
const tick = () => new Promise((r) => setTimeout(r, 0));

class BillingRecordsTable {
  private status = new Map<string, Status>();
  private audit = new Map<string, AuditRow[]>();
  /** Per-row mutex — models `SELECT … FOR UPDATE` serialising on one row. */
  private rowLocks = new Map<string, Promise<unknown>>();
  private seq = 0;

  constructor(recordId: string, initial: Status) {
    this.status.set(recordId, initial);
    this.audit.set(recordId, []);
  }

  getStatus(recordId: string): Status {
    return this.status.get(recordId)!;
  }

  getAudit(recordId: string): AuditRow[] {
    return this.audit.get(recordId)!;
  }

  /** UPDATE … WHERE record_id = ? (unconditional — the PRE-FIX shape). */
  updateUnconditional(recordId: string, to: Status): number {
    this.status.set(recordId, to);
    return 1;
  }

  /** UPDATE … WHERE record_id = ? AND payment_flow_status = ? RETURNING. */
  compareAndSet(recordId: string, expected: Status, to: Status): number {
    if (this.status.get(recordId) !== expected) return 0;
    this.status.set(recordId, to);
    return 1;
  }

  appendAudit(recordId: string, row: Omit<AuditRow, 'auditId' | 'entryHash'>): void {
    const auditId = `AUD-${++this.seq}`;
    // Chain hash is a pure function of (prevHash, auditId, …) — a fork shows up
    // as two rows sharing the same prevHash.
    const entryHash = `H(${row.prevHash ?? 'GENESIS'}|${auditId}|${row.toStatus}|${row.deltaAgorot})`;
    this.audit.get(recordId)!.push({ ...row, auditId, entryHash });
  }

  lastAudit(recordId: string): AuditRow | undefined {
    const rows = this.audit.get(recordId)!;
    return rows[rows.length - 1];
  }

  /** Serialise a critical section on one row, like a FOR UPDATE lock does. */
  async withRowLock<T>(recordId: string, fn: () => Promise<T>): Promise<T> {
    const prior = this.rowLocks.get(recordId) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((r) => { release = r; });
    this.rowLocks.set(recordId, prior.then(() => mine));
    await prior;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

const ALLOWED: Record<Status, Status[]> = {
  authorized: ['captured', 'cancelled'],
  captured: ['held_in_escrow', 'refunded', 'disputed'],
  held_in_escrow: ['released', 'refunded', 'partially_refunded', 'disputed'],
  released: [],
  refunded: [],
  partially_refunded: ['refunded', 'released'],
  disputed: ['released', 'refunded', 'chargeback'],
  chargeback: [],
  cancelled: [],
};

class ConcurrentTransitionError extends Error {
  readonly code = 'ESCROW_CONCURRENT_TRANSITION';
}

/** PRE-FIX: read outside the tx → validate → unconditional write. */
async function transitionPreFix(
  t: BillingRecordsTable, recordId: string, to: Status, delta: number,
): Promise<'applied' | 'noop'> {
  const from = t.getStatus(recordId);          // read (unlocked)
  if (from === to) return 'noop';
  if (!ALLOWED[from].includes(to)) throw new Error(`Invalid transition ${from} → ${to}`);
  const last = t.lastAudit(recordId);
  await tick();                                 // the real-world race window
  t.updateUnconditional(recordId, to);          // unconditional write
  t.appendAudit(recordId, { fromStatus: from, toStatus: to, deltaAgorot: delta, prevHash: last?.entryHash ?? null });
  return 'applied';
}

/** POST-FIX: everything inside one row-locked transaction with a CAS write. */
async function transitionFixed(
  t: BillingRecordsTable, recordId: string, to: Status, delta: number,
): Promise<'applied' | 'noop'> {
  return t.withRowLock(recordId, async () => {
    const from = t.getStatus(recordId);         // read under FOR UPDATE
    if (from === to) return 'noop';
    if (!ALLOWED[from].includes(to)) throw new Error(`Invalid transition ${from} → ${to}`);
    const last = t.lastAudit(recordId);         // chain tail read under the lock
    await tick();                                // same window — must not matter now
    const claimed = t.compareAndSet(recordId, from, to);
    if (claimed === 0) throw new ConcurrentTransitionError('lost the claim');
    t.appendAudit(recordId, { fromStatus: from, toStatus: to, deltaAgorot: delta, prevHash: last?.entryHash ?? null });
    return 'applied';
  });
}

const REFUND_AGOROT = 5500; // ₪55.00 — a real Kfar Saba wash price, for realism only

// ─────────────────────────────────────────────────────────────────────────────
// 1–4: real concurrent behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('M1 — billing refund concurrency (behavioral)', () => {
  it('PRE-FIX shape double-refunds: the model reproduces the bug', async () => {
    const t = new BillingRecordsTable('REC-1', 'held_in_escrow');
    const results = await Promise.allSettled([
      transitionPreFix(t, 'REC-1', 'refunded', REFUND_AGOROT),
      transitionPreFix(t, 'REC-1', 'refunded', REFUND_AGOROT),
    ]);
    const applied = results.filter((r) => r.status === 'fulfilled' && r.value === 'applied');
    // Both won — this is exactly the defect being fixed.
    expect(applied).toHaveLength(2);
    const audit = t.getAudit('REC-1');
    const totalRefunded = audit.reduce((s, r) => s + (r.deltaAgorot ?? 0), 0);
    expect(totalRefunded).toBe(REFUND_AGOROT * 2); // ₪110 refunded on a ₪55 payment
    // …and the hash chain forked: two rows share one prevHash.
    expect(audit[0].prevHash).toBe(audit[1].prevHash);
  });

  it('exactly ONE of two simultaneous refunds applies a financial effect', async () => {
    const t = new BillingRecordsTable('REC-2', 'held_in_escrow');
    const results = await Promise.allSettled([
      transitionFixed(t, 'REC-2', 'refunded', REFUND_AGOROT),
      transitionFixed(t, 'REC-2', 'refunded', REFUND_AGOROT),
    ]);
    const applied = results.filter((r) => r.status === 'fulfilled' && r.value === 'applied');
    const noops = results.filter((r) => r.status === 'fulfilled' && r.value === 'noop');
    expect(applied).toHaveLength(1);
    expect(noops).toHaveLength(1); // loser re-reads 'refunded' under the lock → no-op
    const audit = t.getAudit('REC-2');
    expect(audit).toHaveLength(1);
    expect(audit.reduce((s, r) => s + (r.deltaAgorot ?? 0), 0)).toBe(REFUND_AGOROT);
    expect(t.getStatus('REC-2')).toBe('refunded');
  });

  it('holds under 20 simultaneous refunds (double-click + tabs + webhook retries)', async () => {
    const t = new BillingRecordsTable('REC-3', 'held_in_escrow');
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => transitionFixed(t, 'REC-3', 'refunded', REFUND_AGOROT)),
    );
    const applied = results.filter((r) => r.status === 'fulfilled' && r.value === 'applied');
    expect(applied).toHaveLength(1);
    const audit = t.getAudit('REC-3');
    expect(audit).toHaveLength(1);
    expect(audit.reduce((s, r) => s + (r.deltaAgorot ?? 0), 0)).toBe(REFUND_AGOROT);
    // Chain integrity: never two entries sharing a prevHash.
    const prevHashes = audit.map((r) => r.prevHash);
    expect(new Set(prevHashes).size).toBe(prevHashes.length);
  });

  it('a refund racing a release never applies both (one payment cannot be paid AND refunded)', async () => {
    const t = new BillingRecordsTable('REC-4', 'held_in_escrow');
    const results = await Promise.allSettled([
      transitionFixed(t, 'REC-4', 'refunded', REFUND_AGOROT),
      transitionFixed(t, 'REC-4', 'released', 0),
    ]);
    const applied = results.filter((r) => r.status === 'fulfilled' && r.value === 'applied');
    expect(applied).toHaveLength(1);
    expect(t.getAudit('REC-4')).toHaveLength(1);
    // The loser must FAIL, not silently succeed: 'released' and 'refunded' are
    // both terminal, so the second transition is rejected outright.
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
  });

  it('does not over-block: a legitimate escalation partial → full still applies', async () => {
    const t = new BillingRecordsTable('REC-5', 'held_in_escrow');
    expect(await transitionFixed(t, 'REC-5', 'partially_refunded', 1000)).toBe('applied');
    expect(await transitionFixed(t, 'REC-5', 'refunded', 4500)).toBe('applied');
    expect(t.getAudit('REC-5')).toHaveLength(2);
    // Chain is linear, not forked.
    expect(t.getAudit('REC-5')[1].prevHash).toBe(t.getAudit('REC-5')[0].entryHash);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5: derived idempotency key — real function, real behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('M1 — derived idempotency key (behavioral)', () => {
  const identity = (recordId: string, agorot: number, partial: boolean) =>
    ['billing-refund', recordId, 'BK-1', String(agorot), partial ? 'partial' : 'full'].join('|');

  it('two identical refund submits derive the SAME key', () => {
    const a = deriveIdempotencyKey('billing-refund', identity('REC-1', 5500, false));
    const b = deriveIdempotencyKey('billing-refund', identity('REC-1', 5500, false));
    expect(a).toBe(b);
  });

  it('a different amount, record or partial-flag derives a DIFFERENT key', () => {
    const base = deriveIdempotencyKey('billing-refund', identity('REC-1', 5500, false));
    expect(deriveIdempotencyKey('billing-refund', identity('REC-1', 5501, false))).not.toBe(base);
    expect(deriveIdempotencyKey('billing-refund', identity('REC-2', 5500, false))).not.toBe(base);
    expect(deriveIdempotencyKey('billing-refund', identity('REC-1', 5500, true))).not.toBe(base);
  });

  it('the derived key satisfies the canonical middleware validator', () => {
    const key = deriveIdempotencyKey('billing-refund', identity('REC-1', 5500, false));
    // requireStrictIdempotency rejects anything outside this shape.
    expect(key.length).toBeGreaterThan(0);
    expect(key.length).toBeLessThanOrEqual(128);
    expect(/^[a-zA-Z0-9\-_]+$/.test(key)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6+: source pins — secondary protection (DB fixture unavailable → BLOCKED-LIVE)
// ─────────────────────────────────────────────────────────────────────────────

const SERVER = resolve(__dirname, '..');
const SM_SRC = readFileSync(resolve(SERVER, 'services', 'EscrowStateMachine.ts'), 'utf8');
const ROUTE_SRC = readFileSync(resolve(SERVER, 'routes', 'billing.ts'), 'utf8');

describe('M1 — shipped code keeps the proven shape', () => {
  it('transitionEscrowState reads the record under FOR UPDATE inside the transaction', () => {
    const txIdx = SM_SRC.indexOf('await db.transaction(async (tx) => {');
    const forUpdateIdx = SM_SRC.indexOf('.for("update")');
    expect(txIdx).toBeGreaterThan(0);
    expect(forUpdateIdx).toBeGreaterThan(txIdx); // the lock is INSIDE the tx
    // The pre-fix unlocked read must be gone.
    expect(SM_SRC).not.toMatch(/const \[record\] = await db\s*\n?\s*\.select\(\)/);
  });

  it('the status write is a compare-and-set that aborts on 0 rows', () => {
    expect(SM_SRC).toMatch(/eq\(billingRecords\.paymentFlowStatus, fromStatus\)/);
    expect(SM_SRC).toMatch(/\.returning\(\{ recordId: billingRecords\.recordId \}\)/);
    expect(SM_SRC).toMatch(/if \(claimed\.length === 0\)/);
    expect(SM_SRC).toMatch(/throw new EscrowConcurrentTransitionError/);
  });

  it('the audit-chain tail is read inside the locked transaction (no forked prevHash)', () => {
    const forUpdateIdx = SM_SRC.indexOf('.for("update")');
    const chainReadIdx = SM_SRC.indexOf('.from(billingAuditLog)');
    expect(chainReadIdx).toBeGreaterThan(forUpdateIdx);
    // …and it must use the transaction handle, not the bare db.
    expect(SM_SRC).toMatch(/const \[lastAudit\] = await tx\s*\n\s*\.select\(\)/);
  });

  it('the audit insert is unreachable once the claim is lost', () => {
    const abortIdx = SM_SRC.indexOf('throw new EscrowConcurrentTransitionError(recordId');
    const insertIdx = SM_SRC.indexOf('await tx.insert(billingAuditLog)');
    expect(abortIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeGreaterThan(abortIdx);
  });

  it('POST /refund claims a derived idempotency key before the handler runs', () => {
    expect(ROUTE_SRC).toMatch(
      /router\.post\("\/refund",\s*strictIdempotencyWithDerivedKey\("billing-refund", refundIdentity\)/,
    );
    // The identity must include the amount and the partial flag — otherwise a
    // legitimate second, DIFFERENT refund would be wrongly swallowed.
    expect(ROUTE_SRC).toMatch(/String\(b\.refundAgorot\)/);
    expect(ROUTE_SRC).toMatch(/b\.isPartial \? "partial" : "full"/);
  });

  it('a lost concurrent claim answers 409, never 500 and never a silent 200', () => {
    expect(ROUTE_SRC).toMatch(/err instanceof EscrowConcurrentTransitionError/);
    expect(ROUTE_SRC).toMatch(/res\.status\(409\)/);
    expect(ROUTE_SRC).toMatch(/No duplicate refund was applied/);
  });

  it('no financial rule was moved into the concurrency layer', () => {
    // The state machine must not compute VAT, commission or amounts.
    expect(SM_SRC).not.toMatch(/0\.18|\bVAT\b|commission/i);
    // The route must still hand back exactly what the engine returned, with
    // only the pre-existing agorot→NIS display conversion applied.
    expect(ROUTE_SRC).toMatch(/refundNIS:\s+\(result\.refundAgorot \/ 100\)\.toFixed\(2\)/);
    // …and must not scale, cap or apportion the amount anywhere else.
    expect(ROUTE_SRC.match(/refundAgorot\s*[*/]/g) ?? []).toHaveLength(1);
  });
});
