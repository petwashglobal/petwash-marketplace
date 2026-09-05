/**
 * M3 — the booking-expiry poller must claim a booking BEFORE it does any
 * refund/void work (sprint/money-concurrency, 2026-08-17).
 *
 * THE BUG
 * -------
 * `startBookingExpiryPoller` (server/jobs/booking-expiry.ts) is a plain
 * `setInterval` started from server/index.ts, so it runs on EVERY Cloud Run
 * instance. Each pass did `SELECT` candidates → `for (…) { UPDATE … WHERE
 * booking_id = ? }`, guarded on nothing but the primary key. Two instances (or
 * one instance whose previous 5-minute pass had not finished, or a restart
 * mid-pass) both selected the same row and both ran the whole body:
 *
 *   • `UPDATE escrow_holdings SET status='refunded'` twice — and with no regard
 *     for the holding's current status, so an escrow already RELEASED to the
 *     provider could be stamped `refunded` (one booking both paid and refunded)
 *   • the availability slot released twice
 *   • `reassignment_count` incremented twice, burning the reassignment budget at
 *     double rate and handing one job to two different providers in one pass
 *   • duplicate ops alerts and duplicate chat status syncs
 *
 * THE FIX (concurrency only — no timeout window, status or amount changed)
 * -----------------------------------------------------------------------
 * Every state change is an ATOMIC CLAIM: `UPDATE … WHERE <pk> AND <the exact
 * state we read> … RETURNING`. Postgres runs that as one statement, so of N
 * racing workers exactly one gets a row back and the rest skip the entire body.
 * The claim is taken BEFORE the refund/void work, never after. The three-table
 * marketplace payment-timeout path runs its writes in ONE transaction.
 *
 * Restart-safe and retry-safe by construction: no in-process lock to leak, no
 * lease to expire. A worker killed after the claim leaves the row in its new
 * state and the next pass simply does not select it.
 *
 * WHAT THIS FILE ACHIEVES
 * -----------------------
 * BEHAVIORAL-VERIFIED: tests 1–6 run genuinely concurrent workers via
 * `Promise.all` against an in-memory model of Postgres compare-and-set
 * `UPDATE … RETURNING` semantics. Test 1 replays the PRE-FIX shape to prove the
 * model detects the bug.
 * BLOCKED-LIVE: this repo's vitest setup has no Postgres fixture, so the
 * shipped job cannot be executed here. Tests 7+ are source-introspection pins
 * as secondary protection.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory model of `UPDATE … WHERE <predicate> … RETURNING`.
// ─────────────────────────────────────────────────────────────────────────────

const tick = () => new Promise((r) => setTimeout(r, 0));

type Row = Record<string, any>;

class Table {
  rows = new Map<string, Row>();
  constructor(seed: Array<[string, Row]> = []) {
    for (const [k, v] of seed) this.rows.set(k, { ...v });
  }
  get(id: string): Row | undefined { return this.rows.get(id); }

  /** UPDATE … SET patch WHERE id = ? (unconditional — the PRE-FIX shape). */
  updateByPk(id: string, patch: Row): number {
    const r = this.rows.get(id);
    if (!r) return 0;
    Object.assign(r, patch);
    return 1;
  }

  /**
   * UPDATE … SET patch WHERE id = ? AND <every key of `expect` matches> RETURNING.
   * Returns the number of claimed rows: 1 for the single winner, 0 for the rest.
   * Synchronous on purpose — Postgres applies one UPDATE statement atomically.
   */
  claim(id: string, expected: Row, patch: Row): number {
    const r = this.rows.get(id);
    if (!r) return 0;
    for (const [k, v] of Object.entries(expected)) {
      if (Array.isArray(v)) { if (v.includes(r[k])) return 0; }   // NOT IN (…)
      else if (r[k] !== v) return 0;                               // = v
    }
    Object.assign(r, patch);
    return 1;
  }
}

/** Everything the poller can fire more than once. */
interface Effects {
  escrowVoids: string[];
  slotReleases: string[];
  alerts: string[];
  chatSyncs: string[];
  reassignments: string[];
}
const fresh = (): Effects => ({ escrowVoids: [], slotReleases: [], alerts: [], chatSyncs: [], reassignments: [] });

const ESCROW_TERMINAL = ['released', 'refunded'];

// ── Marketplace payment-timeout worker (the money-moving branch) ─────────────

async function marketplacePreFix(
  bookings: Table, slots: Table, escrow: Table, fx: Effects, id: string,
) {
  const b = bookings.get(id);
  if (!b || b.status !== 'pending_payment') return;
  await tick();                                    // the race window
  bookings.updateByPk(id, { status: 'payment_failed', paymentStatus: 'expired' });
  slots.updateByPk(id, { status: 'available' }); fx.slotReleases.push(id);
  escrow.updateByPk(id, { status: 'refunded' });  fx.escrowVoids.push(id);
  fx.alerts.push(`marketplace_payment_timeout:${id}`);
}

async function marketplaceFixed(
  bookings: Table, slots: Table, escrow: Table, fx: Effects, id: string,
) {
  const b = bookings.get(id);
  if (!b || b.status !== 'pending_payment') return;
  await tick();                                    // same window — must not matter
  // One transaction: claim first, then the two dependent writes.
  const claimed = bookings.claim(id, { status: 'pending_payment' },
    { status: 'payment_failed', paymentStatus: 'expired' });
  if (claimed === 0) return;                       // lost — do NO refund work
  slots.claim(id, {}, { status: 'available' });   fx.slotReleases.push(id);
  const voided = escrow.claim(id, { status: ESCROW_TERMINAL }, { status: 'refunded' });
  if (voided === 1) fx.escrowVoids.push(id);
  fx.alerts.push(`marketplace_payment_timeout:${id}`);
}

// ── Walk hard-expiry worker ──────────────────────────────────────────────────

async function walkExpirePreFix(walks: Table, fx: Effects, id: string) {
  const b = walks.get(id);
  if (!b || b.status !== 'pending_provider') return;
  await tick();
  walks.updateByPk(id, { status: 'expired' });
  fx.chatSyncs.push(id);
  fx.alerts.push(`booking_expiry:${id}`);
}

async function walkExpireFixed(walks: Table, fx: Effects, id: string) {
  const b = walks.get(id);
  if (!b || b.status !== 'pending_provider') return;
  await tick();
  const expired = walks.claim(id, { status: 'pending_provider' }, { status: 'expired' });
  if (expired === 0) return;
  fx.chatSyncs.push(id);
  fx.alerts.push(`booking_expiry:${id}`);
}

// ── Walk reassignment worker (guards the reassignment budget) ────────────────

async function walkReassignFixed(walks: Table, fx: Effects, id: string, toWalker: string) {
  const b = walks.get(id)!;
  const attempts = b.reassignmentCount ?? 0;
  await tick();
  const claimed = walks.claim(
    id,
    { status: 'pending_provider', reassignmentCount: attempts },
    { walkerId: toWalker, reassignmentCount: attempts + 1 },
  );
  if (claimed === 0) return;
  fx.reassignments.push(`${id}->${toWalker}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1–6: real concurrent behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('M3 — booking-expiry cron concurrency (behavioral)', () => {
  it('PRE-FIX shape double-voids the escrow: the model reproduces the bug', async () => {
    const bookings = new Table([['BK-1', { status: 'pending_payment' }]]);
    const slots = new Table([['BK-1', { status: 'held' }]]);
    const escrow = new Table([['BK-1', { status: 'held' }]]);
    const fx = fresh();
    await Promise.all([
      marketplacePreFix(bookings, slots, escrow, fx, 'BK-1'),
      marketplacePreFix(bookings, slots, escrow, fx, 'BK-1'),
    ]);
    expect(fx.escrowVoids).toHaveLength(2);   // the same escrow voided twice
    expect(fx.slotReleases).toHaveLength(2);
    expect(fx.alerts).toHaveLength(2);
  });

  it('two workers expiring the same booking: exactly ONE voids the escrow', async () => {
    const bookings = new Table([['BK-2', { status: 'pending_payment' }]]);
    const slots = new Table([['BK-2', { status: 'held' }]]);
    const escrow = new Table([['BK-2', { status: 'held' }]]);
    const fx = fresh();
    await Promise.all([
      marketplaceFixed(bookings, slots, escrow, fx, 'BK-2'),
      marketplaceFixed(bookings, slots, escrow, fx, 'BK-2'),
    ]);
    expect(fx.escrowVoids).toEqual(['BK-2']);
    expect(fx.slotReleases).toHaveLength(1);
    expect(fx.alerts).toHaveLength(1);
    expect(bookings.get('BK-2')!.status).toBe('payment_failed');
    expect(escrow.get('BK-2')!.status).toBe('refunded');
  });

  it('holds with 10 simultaneous poller instances', async () => {
    const bookings = new Table([['BK-3', { status: 'pending_payment' }]]);
    const slots = new Table([['BK-3', { status: 'held' }]]);
    const escrow = new Table([['BK-3', { status: 'held' }]]);
    const fx = fresh();
    await Promise.all(
      Array.from({ length: 10 }, () => marketplaceFixed(bookings, slots, escrow, fx, 'BK-3')),
    );
    expect(fx.escrowVoids).toHaveLength(1);
    expect(fx.alerts).toHaveLength(1);
  });

  it('an already-RELEASED escrow is never downgraded to refunded', async () => {
    // The provider has already been paid. A late timeout sweep must not stamp
    // the holding `refunded` — that would record one booking as both paid out
    // and refunded.
    const bookings = new Table([['BK-4', { status: 'pending_payment' }]]);
    const slots = new Table([['BK-4', { status: 'held' }]]);
    const escrow = new Table([['BK-4', { status: 'released' }]]);
    const fx = fresh();
    await marketplaceFixed(bookings, slots, escrow, fx, 'BK-4');
    expect(escrow.get('BK-4')!.status).toBe('released'); // untouched
    expect(fx.escrowVoids).toHaveLength(0);
  });

  it('restart-safe: re-running the same pass claims nothing and refunds nothing', async () => {
    const bookings = new Table([['BK-5', { status: 'pending_payment' }]]);
    const slots = new Table([['BK-5', { status: 'held' }]]);
    const escrow = new Table([['BK-5', { status: 'held' }]]);
    const fx = fresh();
    await marketplaceFixed(bookings, slots, escrow, fx, 'BK-5'); // pass 1
    const afterFirst = { ...escrow.get('BK-5') };
    await marketplaceFixed(bookings, slots, escrow, fx, 'BK-5'); // pass 2 (restart replay)
    await marketplaceFixed(bookings, slots, escrow, fx, 'BK-5'); // pass 3
    expect(fx.escrowVoids).toHaveLength(1);
    expect(fx.alerts).toHaveLength(1);
    expect(escrow.get('BK-5')).toEqual(afterFirst);
  });

  it('hard-expiry fires its chat sync and ops alert exactly once', async () => {
    const walks = new Table([['W-1', { status: 'pending_provider' }]]);
    const fx = fresh();
    await Promise.all(Array.from({ length: 8 }, () => walkExpireFixed(walks, fx, 'W-1')));
    expect(fx.chatSyncs).toEqual(['W-1']);
    expect(fx.alerts).toHaveLength(1);
    // …and the pre-fix shape did not.
    const walks2 = new Table([['W-2', { status: 'pending_provider' }]]);
    const fx2 = fresh();
    await Promise.all([walkExpirePreFix(walks2, fx2, 'W-2'), walkExpirePreFix(walks2, fx2, 'W-2')]);
    expect(fx2.alerts).toHaveLength(2);
  });

  it('reassignment cannot burn two attempts or hand one job to two walkers', async () => {
    const walks = new Table([['W-3', { status: 'pending_provider', reassignmentCount: 0, walkerId: 'w-orig' }]]);
    const fx = fresh();
    await Promise.all([
      walkReassignFixed(walks, fx, 'W-3', 'w-alice'),
      walkReassignFixed(walks, fx, 'W-3', 'w-bob'),
    ]);
    expect(fx.reassignments).toHaveLength(1);
    expect(walks.get('W-3')!.reassignmentCount).toBe(1); // not 2
    expect(['w-alice', 'w-bob']).toContain(walks.get('W-3')!.walkerId);
  });

  it('does not over-block: a single worker still expires and voids normally', async () => {
    const bookings = new Table([['BK-6', { status: 'pending_payment' }]]);
    const slots = new Table([['BK-6', { status: 'held' }]]);
    const escrow = new Table([['BK-6', { status: 'held' }]]);
    const fx = fresh();
    await marketplaceFixed(bookings, slots, escrow, fx, 'BK-6');
    expect(fx.escrowVoids).toEqual(['BK-6']);
    expect(fx.slotReleases).toEqual(['BK-6']);
    expect(bookings.get('BK-6')!.status).toBe('payment_failed');
    expect(slots.get('BK-6')!.status).toBe('available');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7+: source pins — secondary protection (no Postgres fixture → BLOCKED-LIVE)
// ─────────────────────────────────────────────────────────────────────────────

const SRC = readFileSync(resolve(__dirname, '..', 'jobs', 'booking-expiry.ts'), 'utf8');

describe('M3 — shipped job keeps the proven shape', () => {
  it('the escrow void is claimed and transactional, and runs only for the winner', () => {
    const txIdx = SRC.indexOf('const claimed = await db.transaction(async (tx) => {');
    expect(txIdx).toBeGreaterThan(0);
    // Search from the transaction start so we match the CLAIM's status
    // predicate, not the earlier SELECT filter of the same shape.
    const claimIdx = SRC.indexOf("eq(bookings.status, 'pending_payment'),", txIdx);
    const escrowIdx = SRC.indexOf('await tx.update(escrowHoldings)');
    expect(claimIdx).toBeGreaterThan(txIdx);
    expect(escrowIdx).toBeGreaterThan(claimIdx);   // claim BEFORE the void
    expect(SRC).toMatch(/if \(rows\.length === 0\) return false;/);
  });

  it('the escrow void refuses to overwrite a terminal holding', () => {
    expect(SRC).toMatch(/const ESCROW_TERMINAL_STATUSES = \['released', 'refunded'\] as const;/);
    expect(SRC).toMatch(/notInArray\(escrowHoldings\.status, \[\.\.\.ESCROW_TERMINAL_STATUSES\]\)/);
  });

  it('no booking or escrow update is guarded on the primary key alone', () => {
    // Every write to a booking row or an escrow holding must carry a state
    // predicate. (The availability-slot release is deliberately exempt: it sits
    // INSIDE the transaction that already won the booking claim, and clearing a
    // slot twice moves no money.)
    for (const table of ['walkBookings', 'sitterBookings', 'bookings', 'escrowHoldings']) {
      const rx = new RegExp(`\\.update\\(${table}\\)[\\s\\S]{0,700}?\\.where\\(\\s*(and\\()?`, 'g');
      const sites = SRC.match(rx) ?? [];
      expect(sites.length).toBeGreaterThan(0);
      for (const site of sites) {
        expect(site.endsWith('and(')).toBe(true);
      }
    }
  });

  it('walk and sitter hard-expiry claim before syncing chat and alerting', () => {
    for (const [claim, effect] of [
      ["eq(walkBookings.status, 'pending_provider'),\n      )).returning", "syncChatToBookingStatus(booking.bookingId, 'expired', 'walk_my_pet')"],
      ["eq(sitterBookings.status, 'pending_provider'),\n      )).returning", "syncChatToBookingStatus(booking.bookingId, 'expired', 'sitter_suite')"],
    ] as const) {
      const c = SRC.indexOf(claim);
      const e = SRC.indexOf(effect);
      expect(c).toBeGreaterThan(0);
      expect(e).toBeGreaterThan(c);
    }
    // Walk, sitter, and the marketplace stale-state sweep all abort on 0 rows.
    expect((SRC.match(/if \(expired\.length === 0\)/g) ?? []).length).toBe(3);
  });

  it('reassignment pins the exact attempt count it read (optimistic concurrency)', () => {
    expect(SRC).toMatch(/eq\(walkBookings\.reassignmentCount, attempts\)/);
    expect(SRC).toMatch(/eq\(sitterBookings\.reassignmentCount, attempts\)/);
    expect((SRC.match(/if \(claimed\.length === 0\)/g) ?? []).length).toBe(2);
  });

  it('the stale-state marketplace sweep claims on the status it selected', () => {
    expect(SRC).toMatch(/eq\(bookings\.status, stuckStatus as string\),\s*\n\s*\)\)\s*\n\s*\.returning\(\{ id: bookings\.id \}\);/);
  });

  it('no timeout window or amount was changed', () => {
    // The windows are the load-bearing business numbers. Pin them literally.
    expect(SRC).toMatch(/const expiryWindow = new Date\(now\.getTime\(\) - 2 \* 60 \* 60 \* 1000\)/);  // walk 2h
    expect(SRC).toMatch(/const expiryWindow = new Date\(now\.getTime\(\) - 4 \* 60 \* 60 \* 1000\)/);  // sitter 4h
    expect(SRC).toMatch(/const MAX_REASSIGNMENT_ATTEMPTS = 3;/);
    expect(SRC).toMatch(/lt\(bookings\.updatedAt, new Date\(now\.getTime\(\) - 2 \* 60 \* 60 \* 1000\)\)/); // pending_payment 2h
    expect(SRC).toMatch(/\{ status: 'inquiry',\s+maxAgeH: 24 \}/);
    expect(SRC).toMatch(/\{ status: 'quote_sent',\s+maxAgeH: 48 \}/);
    expect(SRC).toMatch(/\{ status: 'pending_provider', maxAgeH: 24 \}/);
    expect(SRC).toMatch(/\{ status: 'deposit_pending',\s+maxAgeH: 48 \}/);
    // Poll cadence unchanged.
    expect(SRC).toMatch(/\}, 5 \* 60 \* 1000\);/);
    expect(SRC).toMatch(/\}, 15 \* 60 \* 1000\);/);
  });
});
