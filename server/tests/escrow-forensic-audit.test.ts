/**
 * Issue #153 PR-TAX-3 — Escrow forensic audit emission regression pin.
 *
 * BEFORE this fix:
 *   `server/services/EscrowService.ts` was the LIVE escrow path (verified
 *   by 9 callers in the Israeli tax audit, comment 4401469403, P0-2).
 *   Its release/refund/dispute methods committed Firestore transitions
 *   without writing a parallel row to the Postgres audit_events table.
 *   The legal traceability for these state changes was therefore weaker
 *   than the parallel BillingEngine + EscrowStateMachine path which
 *   already chains a SHA-256 audit row per transition.
 *
 * AFTER this fix:
 *   Each of the three transition methods (releaseEscrowPayment,
 *   refundEscrowPayment, disputeEscrowPayment) calls
 *     await logAuditEvent({...})
 *   AFTER the runTransaction commits and BEFORE notifications fire.
 *   logAuditEvent is fail-soft (catches internal errors, logs without
 *   throwing) — it can never block an escrow transition.
 *   No money math change. No schema change. No new dependency
 *   (logAuditEvent already exists at server/middleware/auditLog.ts:43,
 *   audit_events table at shared/schema.ts:12301).
 *
 * This source-pin test fails if any of the eight guarantees regress.
 *
 * Out of scope (explicitly NOT changed in this PR):
 *   - Money math (amount, commissionCents, payoutCents, holdUntil)
 *   - Status enum or transition semantics
 *   - Schema migrations
 *   - Notifications
 *   - Credit-note (חשבונית זיכוי) generation — REQUIRES CEO + CPA approval
 *   - BillingEngine.AccountingServiceStub replacement
 *   - withholdingRemittanceLedger inserts on payouts
 *   - SHAAM/RASA behaviour
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'EscrowService.ts'),
  'utf8',
);

function methodBody(name: string): string {
  const start = SRC.indexOf(`async ${name}(`);
  if (start < 0) return '';
  const after = SRC.slice(start);
  const nextAsync = after.indexOf('\n  async ', 10);
  return nextAsync > 0 ? after.slice(0, nextAsync) : after;
}

describe('Issue #153 PR-TAX-3 — Escrow forensic audit emission', () => {
  it('imports logAuditEvent from the existing middleware (no new dependency)', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/,
    );
  });

  it('releaseEscrowPayment emits ESCROW_RELEASED audit AFTER the tx and BEFORE notifications', () => {
    const body = methodBody('releaseEscrowPayment');
    expect(body).toMatch(/runTransaction/);
    expect(body).toMatch(/logAuditEvent\(\s*\{/);
    expect(body).toMatch(/actionType:\s*["']ESCROW_RELEASED["']/);
    expect(body).toMatch(/targetType:\s*["']escrow_payment["']/);
    // Order: runTransaction → logAuditEvent → first NotificationService call
    const txIdx     = body.indexOf('this.db.runTransaction');
    const auditIdx  = body.indexOf('logAuditEvent(');
    const notifyIdx = body.indexOf('NotificationService.sendNotification', auditIdx);
    expect(txIdx).toBeGreaterThan(0);
    expect(auditIdx).toBeGreaterThan(txIdx);
    expect(notifyIdx).toBeGreaterThan(auditIdx);
  });

  it('refundEscrowPayment emits ESCROW_REFUNDED audit AFTER the tx and BEFORE notifications', () => {
    const body = methodBody('refundEscrowPayment');
    expect(body).toMatch(/runTransaction/);
    expect(body).toMatch(/logAuditEvent\(\s*\{/);
    expect(body).toMatch(/actionType:\s*["']ESCROW_REFUNDED["']/);
    expect(body).toMatch(/targetType:\s*["']escrow_payment["']/);
    const txIdx     = body.indexOf('this.db.runTransaction');
    const auditIdx  = body.indexOf('logAuditEvent(');
    const notifyIdx = body.indexOf('NotificationService.sendNotification', auditIdx);
    expect(txIdx).toBeGreaterThan(0);
    expect(auditIdx).toBeGreaterThan(txIdx);
    expect(notifyIdx).toBeGreaterThan(auditIdx);
  });

  it('disputeEscrowPayment emits ESCROW_DISPUTED audit AFTER the tx and BEFORE notifications', () => {
    const body = methodBody('disputeEscrowPayment');
    expect(body).toMatch(/runTransaction/);
    expect(body).toMatch(/logAuditEvent\(\s*\{/);
    expect(body).toMatch(/actionType:\s*["']ESCROW_DISPUTED["']/);
    expect(body).toMatch(/targetType:\s*["']escrow_payment["']/);
    const txIdx     = body.indexOf('this.db.runTransaction');
    const auditIdx  = body.indexOf('logAuditEvent(');
    const notifyIdx = body.indexOf('NotificationService.sendNotification', auditIdx);
    expect(txIdx).toBeGreaterThan(0);
    expect(auditIdx).toBeGreaterThan(txIdx);
    expect(notifyIdx).toBeGreaterThan(auditIdx);
  });

  it('audit metadata includes the canonical forensic fields', () => {
    // Each forensic row must record the booking, customer, provider,
    // amount, currency, prevStatus, plus method-specific context. Pin
    // the keys so a future PR cannot silently drop them.
    const release = methodBody('releaseEscrowPayment');
    expect(release).toMatch(/bookingId:\s*escrow\.bookingId/);
    expect(release).toMatch(/customerId:\s*escrow\.customerId/);
    expect(release).toMatch(/providerId:\s*escrow\.providerId/);
    expect(release).toMatch(/amount:\s*escrow\.amount/);
    expect(release).toMatch(/prevStatus:\s*["']held["']/);

    const refund = methodBody('refundEscrowPayment');
    expect(refund).toMatch(/reason/);
    expect(refund).toMatch(/prevStatus:\s*["']held["']/);

    const dispute = methodBody('disputeEscrowPayment');
    expect(dispute).toMatch(/disputeReason/);
    // dispute prevStatus uses escrow.status (pre-tx snapshot), not a literal,
    // because the source state may be 'held' or some pending variant.
    expect(dispute).toMatch(/prevStatus:\s*escrow\.status/);
  });

  it('preserves Issue #153 PR-C runTransaction contract (regression)', () => {
    // PR-C wrapped read+check+update in runTransaction with a status
    // assertion inside the tx. PR-TAX-3 must NOT regress that. Every
    // mutation method still has tx.get(escrowRef) inside the tx body
    // and tx.update(escrowRef, ...) after the status check.
    for (const m of ['releaseEscrowPayment', 'refundEscrowPayment', 'disputeEscrowPayment']) {
      const body = methodBody(m);
      expect(body).toMatch(/this\.db\.runTransaction\(/);
      expect(body).toMatch(/tx\.get\(escrowRef\)/);
      expect(body).toMatch(/tx\.update\(escrowRef\,/);
    }
  });

  it('preserves Issue #153 PR-C deterministic-id idempotency on createEscrowPayment (regression)', () => {
    // Money Brain Audit PR-C: createEscrowPayment uses makeDeterministicId
    // and runTransaction with get-then-set-if-absent. PR-TAX-3 must not
    // regress that path — the create method has no audit emission added
    // here because creation is already covered by the customer/provider
    // notifications and the next state transition will emit its audit.
    const body = methodBody('createEscrowPayment');
    expect(body).toMatch(/this\.makeDeterministicId\(/);
    expect(body).toMatch(/this\.db\.runTransaction\(/);
    // Make sure no audit row is emitted on create (intentional — would
    // double-write since the next transition records prevStatus='held').
    expect(body).not.toMatch(/logAuditEvent\(/);
  });

  it('does NOT introduce credit-note, withholding, or schema changes (parked items)', () => {
    // Hard guard: this PR is forensic observability only. The legal
    // credit-note wiring, withholding ledger inserts, and schema
    // migrations remain in the CEO + CPA approval queue. Reject any
    // accidental scope-creep token.
    expect(SRC).not.toMatch(/issueCreditNote\b/);
    expect(SRC).not.toMatch(/withholdingRemittanceLedger\b/);
    expect(SRC).not.toMatch(/IsraeliDigitalReceiptService\b/);
    expect(SRC).not.toMatch(/AccountingServiceStub\b/);
  });
});
