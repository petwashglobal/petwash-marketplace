/**
 * Issue #153 PR-C — Escrow idempotency + TOCTOU regression pin.
 *
 * BEFORE this fix:
 *   `server/services/EscrowService.ts` had four read-then-write money paths
 *   that were NOT inside Firestore transactions:
 *     • createEscrowPayment       — `this.db.collection().doc()` produced a
 *       fresh random ID on every call. A retried POST /api/escrow/create
 *       (network glitch, processor webhook replay, double-tap UI) spawned
 *       N escrow docs each holding the customer's money.
 *     • releaseEscrowPayment      — read status, check === "held", then
 *       update outside a tx. Two concurrent release calls both passed the
 *       check and both committed status="released" → double payout fired.
 *     • refundEscrowPayment       — same TOCTOU.
 *     • disputeEscrowPayment      — same TOCTOU; race between dispute and
 *       cron auto-release could leak funds.
 *
 * AFTER this fix:
 *   • createEscrowPayment derives a deterministic Firestore doc-id from
 *     a sha256(`escrow:${dedupKey}`) prefix where dedupKey is, in order:
 *       (1) explicit metadata.idempotencyKey
 *       (2) `${bookingId}:${nayaxTransactionId}`
 *       (3) `${bookingId}` alone
 *     and wraps a get-then-set-if-absent inside `db.runTransaction`. Same
 *     dedupKey twice → one doc, second call returns the existing escrow
 *     and does NOT re-fire notifications.
 *   • releaseEscrowPayment, refundEscrowPayment, disputeEscrowPayment all
 *     wrap their read+check+update inside `db.runTransaction` so the
 *     status assertion can no longer be defeated by a parallel call.
 *
 * This source-pin test fails if any of the eight guarantees regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'EscrowService.ts'),
  'utf8',
);
const ROUTES_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'escrow.ts'),
  'utf8',
);

describe('Issue #153 PR-C — EscrowService idempotency + TOCTOU close', () => {
  it('imports crypto for the deterministic-id helper', () => {
    expect(SRC).toMatch(/import\s+crypto\s+from\s+["']crypto["']/);
  });

  it('defines makeDeterministicId using sha256 sliced to a Firestore-safe length', () => {
    expect(SRC).toMatch(
      /private\s+makeDeterministicId\([^)]*\)[\s\S]{0,300}crypto\.createHash\(["']sha256["']\)[\s\S]{0,200}\.slice\(0,\s*24\)/,
    );
  });

  it('createEscrowPayment derives a dedup key from explicit, then nayaxTx, then bookingId', () => {
    // The key derivation order must remain stable so that callers passing
    // metadata.idempotencyKey win, callers with nayaxTransactionId fall
    // through to the second tier, and bare bookingId callers land on the
    // third tier — all while still producing exactly one doc per booking.
    expect(SRC).toMatch(/metadata\?\.idempotencyKey/);
    expect(SRC).toMatch(/\$\{bookingId\}:\$\{nayaxTransactionId\}/);
    // bookingId-only fallback present:
    const block = SRC.match(/const\s+dedupKey\s*=[\s\S]{0,400};/)?.[0] ?? '';
    expect(block).toMatch(/:\s*bookingId\s*\)/);
  });

  it('createEscrowPayment uses the deterministic ID for the Firestore doc reference', () => {
    expect(SRC).toMatch(
      /this\.db\s*\.collection\(["']escrow_payments["']\)\s*\.doc\(\s*this\.makeDeterministicId\(/,
    );
  });

  it('createEscrowPayment wraps the get-then-set inside this.db.runTransaction', () => {
    // The transaction body must contain BOTH a tx.get and a tx.set (the
    // tx.get on the existing ref to detect duplicate, the tx.set on the
    // new escrow). A single regex anchors both being inside the same
    // runTransaction callback.
    expect(SRC).toMatch(
      /this\.db\.runTransaction\(\s*async\s*\(tx\)\s*=>\s*\{[\s\S]{0,2000}tx\.get\(escrowRef\)[\s\S]{0,2000}tx\.set\(escrowRef\,/,
    );
  });

  it('createEscrowPayment skips notifications when the doc already existed (idempotent retry)', () => {
    // The "isNew: false" path must short-circuit before the
    // NotificationService calls so that a duplicate request does not
    // re-fire the customer/provider push notifications.
    expect(SRC).toMatch(
      /if\s*\(\s*!result\.isNew\s*\)[\s\S]{0,300}return\s+result\.escrow\s*;/,
    );
    // Ordering anchor: the early return must appear BEFORE the first
    // post-tx NotificationService.sendNotification call.
    const earlyReturnIdx = SRC.indexOf('if (!result.isNew)');
    const firstNotifyIdx = SRC.indexOf('NotificationService.sendNotification', earlyReturnIdx);
    expect(earlyReturnIdx).toBeGreaterThan(0);
    expect(firstNotifyIdx).toBeGreaterThan(earlyReturnIdx);
  });

  it('releaseEscrowPayment wraps read+check+update inside runTransaction', () => {
    const releaseBlock = SRC.match(
      /async\s+releaseEscrowPayment\([\s\S]{0,2500}^\s\s\}/m,
    )?.[0] ?? SRC.split('async releaseEscrowPayment')[1]?.split('async refundEscrowPayment')[0] ?? '';
    expect(releaseBlock).toMatch(/this\.db\.runTransaction\(/);
    expect(releaseBlock).toMatch(/tx\.get\(escrowRef\)/);
    expect(releaseBlock).toMatch(/e\.status\s*!==\s*["']held["']/);
    expect(releaseBlock).toMatch(/tx\.update\(escrowRef\,\s*\{[\s\S]{0,200}status:\s*["']released["']/);
  });

  it('refundEscrowPayment wraps read+check+update inside runTransaction', () => {
    const refundBlock = SRC.split('async refundEscrowPayment')[1]?.split('async disputeEscrowPayment')[0] ?? '';
    expect(refundBlock).toMatch(/this\.db\.runTransaction\(/);
    expect(refundBlock).toMatch(/tx\.get\(escrowRef\)/);
    expect(refundBlock).toMatch(/e\.status\s*!==\s*["']held["']/);
    expect(refundBlock).toMatch(/tx\.update\(escrowRef\,\s*\{[\s\S]{0,200}status:\s*["']refunded["']/);
  });

  it('disputeEscrowPayment wraps read+check+update inside runTransaction and preserves Section-10 freeze', () => {
    const disputeBlock = SRC.split('async disputeEscrowPayment')[1]?.split('async getEscrowPayment')[0] ?? '';
    expect(disputeBlock).toMatch(/this\.db\.runTransaction\(/);
    expect(disputeBlock).toMatch(/tx\.get\(escrowRef\)/);
    expect(disputeBlock).toMatch(/e\.status\s*===\s*["']released["']/);
    expect(disputeBlock).toMatch(/e\.status\s*===\s*["']refunded["']/);
    // Section 10 freeze flag must still be set inside the tx update:
    expect(disputeBlock).toMatch(/autoReleaseBlocked:\s*true/);
    expect(disputeBlock).toMatch(/status:\s*["']disputed["']/);
  });

  it('does NOT leave any escrow mutation outside a transaction', () => {
    // Reject the prior shape: a bare `await escrowRef.get()` (read) followed
    // anywhere by a bare `await escrowRef.update(...)` (write) WITHOUT a
    // surrounding runTransaction would re-introduce TOCTOU. We pin that
    // the four mutation methods do not contain a bare escrowRef.update or
    // bare escrowRef.set outside the runTransaction callback.
    const mutationMethods = ['createEscrowPayment', 'releaseEscrowPayment', 'refundEscrowPayment', 'disputeEscrowPayment'];
    for (const m of mutationMethods) {
      const start = SRC.indexOf(`async ${m}(`);
      expect(start).toBeGreaterThan(0);
      // crude method-end heuristic: next "async " keyword OR closing of
      // class. We trim to that block and check for prohibited bare writes.
      const after = SRC.slice(start);
      const nextAsync = after.indexOf('\n  async ', 10);
      const block = nextAsync > 0 ? after.slice(0, nextAsync) : after;
      expect(block).not.toMatch(/await\s+escrowRef\.update\(/);
      expect(block).not.toMatch(/await\s+escrowRef\.set\(/);
    }
  });

  it('preserves the public EscrowPayment status enum (held|released|refunded|disputed)', () => {
    // Money-state enum is a contract; downstream readers depend on it.
    expect(SRC).toMatch(
      /status:\s*["']held["']\s*\|\s*["']released["']\s*\|\s*["']refunded["']\s*\|\s*["']disputed["']/,
    );
  });

  it('preserves the route-level participant guard (assertEscrowParticipant) — no auth regression', () => {
    expect(ROUTES_SRC).toMatch(/async\s+function\s+assertEscrowParticipant/);
    expect(ROUTES_SRC).toMatch(
      /escrow\.customerId\s*!==\s*callerId\s*&&\s*escrow\.providerId\s*!==\s*callerId/,
    );
    // Customer-only release rule preserved:
    expect(ROUTES_SRC).toMatch(
      /Only the customer who created this escrow can release it/,
    );
  });

  it('preserves the auto-release Section-10 freeze logic (no regression on disputed-skip)', () => {
    // autoReleaseExpiredHolds must still re-read the doc inside the loop
    // and skip when autoReleaseBlocked === true OR status === "disputed".
    expect(SRC).toMatch(
      /fresh\?\.autoReleaseBlocked\s*===\s*true\s*\|\|\s*fresh\?\.status\s*===\s*["']disputed["']/,
    );
  });
});
