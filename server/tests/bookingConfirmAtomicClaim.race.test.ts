/**
 * M2 — POST /api/bookings/:bookingId/confirm must produce exactly ONE of each
 * side effect (sprint/money-concurrency, 2026-08-17).
 *
 * THE BUG
 * -------
 * The handler in server/routes/bookings.ts read the booking document, checked
 * `status` against `['pending','awaiting_confirmation','payment_held']`, and
 * then issued a separate, unconditional `.update({ status: 'confirmed' })`.
 * Read and write were two independent Firestore operations, so two simultaneous
 * confirmations both saw `pending`, both passed the check, and both ran the
 * whole side-effect chain:
 *
 *   • two `booking_confirmed` audit rows for one confirmation
 *   • two Google Sheets rows via logSitterBooking (the ops day-sheet)
 *   • two petWashOrchestrator.handleBookingConfirmed runs → a DUPLICATE Google
 *     Calendar event, another Sheets append, and a second notification to both
 *     the customer and the provider
 *
 * Triggers: double-tap, customer and provider confirming at the same moment,
 * a client retry after a dropped response, a super-admin replay.
 *
 * THE FIX (concurrency only — no financial rule touched)
 * ------------------------------------------------------
 * Read-check-write is lifted into ONE `db.runTransaction`. Firestore aborts and
 * retries a transaction whose read set changed before commit, so exactly one
 * caller flips pending → confirmed. Only that caller runs the side effects; the
 * loser returns an idempotent 200 `{ alreadyConfirmed: true }` and fires none.
 *
 * WHAT THIS FILE ACHIEVES
 * -----------------------
 * BEHAVIORAL-VERIFIED: tests 1–5 drive genuinely concurrent `Promise.all` calls
 * against an in-memory Firestore model that implements real optimistic-
 * concurrency `runTransaction` semantics (version-stamped read set, abort +
 * retry on conflict). Test 1 replays the PRE-FIX shape to prove the model
 * actually catches the bug.
 * BLOCKED-LIVE: this repo has no Firestore emulator in its vitest setup, so the
 * shipped handler cannot be executed here. Tests 6+ are source-introspection
 * pins as secondary protection that the handler keeps the shape the model
 * proves correct.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory Firestore with real optimistic-concurrency transaction semantics.
// ─────────────────────────────────────────────────────────────────────────────

const tick = () => new Promise((r) => setTimeout(r, 0));

class TransactionAborted extends Error {}

interface Doc { data: Record<string, any>; version: number }

class FakeFirestore {
  private docs = new Map<string, Doc>();
  /** Counts every commit attempt, so we can prove retries happened. */
  commitAttempts = 0;

  set(id: string, data: Record<string, any>) {
    this.docs.set(id, { data: { ...data }, version: 0 });
  }

  get(id: string): Record<string, any> | undefined {
    return this.docs.get(id)?.data;
  }

  /** Non-transactional update — the PRE-FIX write path. */
  updateUnsafe(id: string, patch: Record<string, any>) {
    const d = this.docs.get(id)!;
    d.data = { ...d.data, ...patch };
    d.version++;
  }

  /**
   * Firestore-equivalent runTransaction: the body's reads are version-stamped;
   * at commit, if any read document changed, the whole body is re-run.
   */
  async runTransaction<T>(
    body: (tx: { get: (id: string) => Promise<{ exists: boolean; data: () => any }>; update: (id: string, patch: Record<string, any>) => void }) => Promise<T>,
    maxAttempts = 5,
  ): Promise<T> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const readVersions = new Map<string, number>();
      const writes: Array<[string, Record<string, any>]> = [];
      const tx = {
        get: async (id: string) => {
          const d = this.docs.get(id);
          readVersions.set(id, d?.version ?? -1);
          await tick(); // real async read — lets the racer interleave
          return { exists: !!d, data: () => ({ ...(d?.data ?? {}) }) };
        },
        update: (id: string, patch: Record<string, any>) => { writes.push([id, patch]); },
      };
      const result = await body(tx);
      this.commitAttempts++;
      // Commit check: every document we read must be unchanged.
      let conflict = false;
      for (const [id, v] of readVersions) {
        if ((this.docs.get(id)?.version ?? -1) !== v) { conflict = true; break; }
      }
      if (conflict) { await tick(); continue; } // abort → retry the body
      for (const [id, patch] of writes) {
        const d = this.docs.get(id)!;
        d.data = { ...d.data, ...patch };
        d.version++;
      }
      return result;
    }
    throw new TransactionAborted('too much contention');
  }
}

/** Every observable side effect the handler fires, counted. */
interface SideEffects {
  auditRows: string[];
  sheetsRows: string[];
  calendarEvents: string[];
  notifications: string[];
}
const freshEffects = (): SideEffects => ({ auditRows: [], sheetsRows: [], calendarEvents: [], notifications: [] });

const CONFIRMABLE = ['pending', 'awaiting_confirmation', 'payment_held'];

function runSideEffects(fx: SideEffects, bookingId: string, actor: string) {
  fx.auditRows.push(`booking_confirmed:${bookingId}`);
  fx.sheetsRows.push(`logSitterBooking:${bookingId}`);
  fx.calendarEvents.push(`CONFIRMED:${bookingId}`);   // petWashOrchestrator
  fx.notifications.push(`customer+provider:${bookingId}:${actor}`);
}

type Outcome = { status: number; alreadyConfirmed?: boolean };

/** PRE-FIX: get() → check → unconditional update() → side effects. */
async function confirmPreFix(fs: FakeFirestore, fx: SideEffects, id: string, actor: string): Promise<Outcome> {
  const doc = fs.get(id);
  if (!doc) return { status: 404 };
  if (doc.status && !CONFIRMABLE.includes(doc.status)) return { status: 409 };
  await tick(); // the real-world race window between read and write
  fs.updateUnsafe(id, { status: 'confirmed', confirmedAt: new Date(), confirmedBy: actor });
  runSideEffects(fx, id, actor);
  return { status: 200 };
}

/** POST-FIX: authz read, then an atomic transactional claim gating the effects. */
async function confirmFixed(fs: FakeFirestore, fx: SideEffects, id: string, actor: string): Promise<Outcome> {
  const doc = fs.get(id);                      // authz read (outside the tx)
  if (!doc) return { status: 404 };
  if (doc.status && !CONFIRMABLE.includes(doc.status)) return { status: 409 };

  const claim = await fs.runTransaction(async (tx) => {
    const fresh = await tx.get(id);
    if (!fresh.exists) return { conflictStatus: 'not_found' } as const;
    const s = fresh.data().status;
    if (s === 'confirmed') return 'already_confirmed' as const;
    if (s && !CONFIRMABLE.includes(s)) return { conflictStatus: String(s) } as const;
    tx.update(id, { status: 'confirmed', confirmedAt: new Date(), confirmedBy: actor });
    return 'claimed' as const;
  });

  if (typeof claim === 'object') {
    return { status: claim.conflictStatus === 'not_found' ? 404 : 409 };
  }
  if (claim === 'already_confirmed') return { status: 200, alreadyConfirmed: true };

  runSideEffects(fx, id, actor);               // ONLY the single winner
  return { status: 200 };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1–5: real concurrent behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('M2 — Firestore booking confirm concurrency (behavioral)', () => {
  it('PRE-FIX shape duplicates every side effect: the model reproduces the bug', async () => {
    const fs = new FakeFirestore(); const fx = freshEffects();
    fs.set('BK-1', { status: 'pending' });
    await Promise.all([
      confirmPreFix(fs, fx, 'BK-1', 'customer'),
      confirmPreFix(fs, fx, 'BK-1', 'provider'),
    ]);
    expect(fx.auditRows).toHaveLength(2);
    expect(fx.sheetsRows).toHaveLength(2);
    expect(fx.calendarEvents).toHaveLength(2); // duplicate calendar event
    expect(fx.notifications).toHaveLength(2);  // customer notified twice
  });

  it('exactly ONE of two simultaneous confirmations wins; the loser is an idempotent 200', async () => {
    const fs = new FakeFirestore(); const fx = freshEffects();
    fs.set('BK-2', { status: 'pending' });
    const [a, b] = await Promise.all([
      confirmFixed(fs, fx, 'BK-2', 'customer'),
      confirmFixed(fs, fx, 'BK-2', 'provider'),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const idempotent = [a, b].filter((r) => r.alreadyConfirmed);
    expect(idempotent).toHaveLength(1);
    expect(fs.get('BK-2')!.status).toBe('confirmed');
  });

  it('exactly one of EACH side effect: confirmation, calendar write, notification, ops row', async () => {
    const fs = new FakeFirestore(); const fx = freshEffects();
    fs.set('BK-3', { status: 'pending' });
    await Promise.all([
      confirmFixed(fs, fx, 'BK-3', 'customer'),
      confirmFixed(fs, fx, 'BK-3', 'provider'),
    ]);
    expect(fx.auditRows).toHaveLength(1);
    expect(fx.sheetsRows).toHaveLength(1);
    expect(fx.calendarEvents).toHaveLength(1);
    expect(fx.notifications).toHaveLength(1);
  });

  it('holds under 25 simultaneous confirmations', async () => {
    const fs = new FakeFirestore(); const fx = freshEffects();
    fs.set('BK-4', { status: 'pending' });
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) => confirmFixed(fs, fx, 'BK-4', `actor-${i}`)),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => !r.alreadyConfirmed)).toHaveLength(1);
    expect(fx.auditRows).toHaveLength(1);
    expect(fx.calendarEvents).toHaveLength(1);
    expect(fx.notifications).toHaveLength(1);
  });

  it('a confirm racing a cancellation never does both', async () => {
    // Cancellation modelled the same way the real cancel path must be: an
    // atomic transactional claim on the same document.
    const cancelFixed = (fs: FakeFirestore, id: string) =>
      fs.runTransaction(async (tx) => {
        const fresh = await tx.get(id);
        if (fresh.data().status === 'confirmed') return 'too_late' as const;
        tx.update(id, { status: 'cancelled' });
        return 'cancelled' as const;
      });

    for (let round = 0; round < 20; round++) {
      const fs = new FakeFirestore(); const fx = freshEffects();
      fs.set('BK-5', { status: 'pending' });
      const [confirmRes, cancelRes] = await Promise.all([
        confirmFixed(fs, fx, 'BK-5', 'provider'),
        cancelFixed(fs, 'BK-5'),
      ]);
      const finalStatus = fs.get('BK-5')!.status;
      // The document lands in exactly one terminal state…
      expect(['confirmed', 'cancelled']).toContain(finalStatus);
      if (finalStatus === 'cancelled') {
        // …and a booking that ended cancelled must have fired NO confirmation
        // side effects — no calendar event, no notification, no ops row.
        expect(confirmRes.status).toBe(409);
        expect(fx.calendarEvents).toHaveLength(0);
        expect(fx.notifications).toHaveLength(0);
        expect(fx.sheetsRows).toHaveLength(0);
      } else {
        expect(cancelRes).toBe('too_late');
        expect(fx.calendarEvents).toHaveLength(1);
      }
    }
  });

  it('does not over-block: a lone confirmation still succeeds with full side effects', async () => {
    const fs = new FakeFirestore(); const fx = freshEffects();
    fs.set('BK-6', { status: 'awaiting_confirmation' });
    const r = await confirmFixed(fs, fx, 'BK-6', 'provider');
    expect(r.status).toBe(200);
    expect(r.alreadyConfirmed).toBeUndefined();
    expect(fx.auditRows).toHaveLength(1);
    expect(fx.calendarEvents).toHaveLength(1);
    expect(fs.get('BK-6')!.status).toBe('confirmed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6+: source pins — secondary protection (no Firestore emulator → BLOCKED-LIVE)
// ─────────────────────────────────────────────────────────────────────────────

const SRC = readFileSync(resolve(__dirname, '..', 'routes', 'bookings.ts'), 'utf8');
const CONFIRM = SRC.slice(
  SRC.indexOf('router.post("/:bookingId/confirm"'),
  SRC.indexOf('router.post("/:bookingId/complete"'),
);

describe('M2 — shipped handler keeps the proven shape', () => {
  it('the confirm handler exists and was located for introspection', () => {
    expect(CONFIRM.length).toBeGreaterThan(500);
  });

  it('the status flip happens inside a Firestore transaction', () => {
    expect(CONFIRM).toMatch(/await db\.runTransaction\(async \(tx\) => \{/);
    expect(CONFIRM).toMatch(/const fresh = await tx\.get\(bookingRef\)/);
    expect(CONFIRM).toMatch(/tx\.update\(bookingRef, \{\s*\n\s*status: "confirmed"/);
  });

  it('the pre-fix unconditional out-of-transaction update is gone', () => {
    expect(CONFIRM).not.toMatch(/await db\.collection\("bookings"\)\.doc\(bookingId\)\.update\(/);
  });

  it('the transaction re-validates the CURRENT status, not the earlier read', () => {
    expect(CONFIRM).toMatch(/const freshStatus = fresh\.data\(\)\?\.status/);
    expect(CONFIRM).toMatch(/if \(freshStatus && !confirmableStates\.includes\(freshStatus\)\)/);
  });

  it('the loser returns an idempotent 200 and short-circuits before any side effect', () => {
    const loserIdx = CONFIRM.indexOf("if (claim === 'already_confirmed')");
    const returnIdx = CONFIRM.indexOf('res.json({ success: true, alreadyConfirmed: true })');
    expect(loserIdx).toBeGreaterThan(0);
    expect(returnIdx).toBeGreaterThan(loserIdx);
    // Every side effect must appear AFTER the early return.
    // Match call sites, not the prose in the comment block above them.
    for (const effect of [
      'void logAuditEvent({',
      'await logSitterBooking({',
      'petWashOrchestrator.handleBookingConfirmed({',
    ]) {
      expect(CONFIRM.indexOf(effect)).toBeGreaterThan(returnIdx);
    }
  });

  it('a status conflict discovered inside the transaction answers 409, not a silent success', () => {
    expect(CONFIRM).toMatch(/return \{ conflictStatus: String\(freshStatus\) \}/);
    expect(CONFIRM).toMatch(/res\.status\(409\)\.json\(\{ error: `Cannot confirm a booking with status: \$\{claim\.conflictStatus\}` \}\)/);
  });

  it('no money rule was introduced into the confirm path', () => {
    // The confirm handler must not compute VAT, commission or amounts.
    expect(CONFIRM).not.toMatch(/VATCalculatorService|platformFee|commission\s*[=:]/);
  });
});
