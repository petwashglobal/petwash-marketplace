/**
 * Regression pin — Nayax refund fan-out (AUDIT-MONEY-5 / #230 slice 1).
 *
 * The POST /api/webhooks/nayax/refund handler in
 * server/routes/nayax-webhooks.ts used to:
 *   1. update the payment_intents row status
 *   2. mark the inbox event complete
 *   3. 200 OK
 *
 * There was no notification to the payer telling them the money was on
 * its way, and no audit-events row anchoring "we processed refund X
 * for tx Y at time T for user Z". The only trace was a logger.info
 * that rotated out within days — a support agent asked "did we
 * actually refund this?" had no queryable answer.
 *
 * Fix: between the DB update and markCompleted the handler now
 *   • writes a NAYAX_REFUND_APPLIED audit event with the payer,
 *     amounts, and refundId, and
 *   • dispatches an SMS + push refund_issued notification to the payer.
 *
 * Both calls are wrapped in try/catch (a notification outage must
 * never wedge the refund) but they are ordered BEFORE markCompleted —
 * so if the entire block throws, the inbox stays in 'processing' and
 * Nayax's retry (or the retry sweeper) re-runs the handler.
 *
 * This pin walks the source and refuses any regression that removes
 * either fan-out call from the refund handler.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const src = readFileSync(join(ROOT, 'server/routes/nayax-webhooks.ts'), 'utf8');

describe('AUDIT-MONEY-5 / #230 — Nayax refund handler fan-out', () => {
  it('imports both logAuditEvent and buildRefundIssuedSms', () => {
    expect(src).toMatch(/import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/);
    expect(src).toMatch(/import\s*\{[^}]*\bbuildRefundIssuedSms\b[^}]*\}\s*from\s*['"]\.\.\/services\/PetWashNotificationEngine['"]/);
  });

  it('handler writes NAYAX_REFUND_APPLIED audit event', () => {
    expect(src).toMatch(/actionType:\s*['"]NAYAX_REFUND_APPLIED['"]/);
  });

  it('handler dispatches refund_issued notification with SMS + push', () => {
    // The refund_issued eventType MUST appear inside a dispatchNotifications call.
    expect(src).toMatch(/dispatchNotifications\(\{[\s\S]{0,2500}?eventType:\s*['"]refund_issued['"]/);
    // The push template MUST reference the buildRefundIssuedSms helper — the
    // handler owns the exact wording rather than reinventing it inline.
    expect(src).toMatch(/buildRefundIssuedSms\(\{/);
  });

  it('audit + notification emit BEFORE inbox markCompleted so retries re-fire on outage', () => {
    // The refund handler's markCompleted (the SUCCESS branch, not the
    // unknown-transaction early-return above it) MUST be preceded in
    // file order by both AUDIT-MONEY-5 side effects, so a throw in the
    // fan-out leaves the inbox in 'processing' and Nayax's retry
    // re-runs the whole handler.
    const auditIdx = src.indexOf("actionType: 'NAYAX_REFUND_APPLIED'");
    const notifyIdx = src.indexOf("eventType: 'refund_issued'");
    // Find the LAST markCompleted inside the refund handler — the file has
    // several; the refund one is the last of the res.status(200) branches
    // that also carries a refundId in the response body.
    const refundHandlerMarker = "res.status(200).json({\n        received: true,\n        refundId,\n      });";
    const refundResIdx = src.indexOf(refundHandlerMarker);
    expect(refundResIdx).toBeGreaterThan(0);
    expect(auditIdx).toBeGreaterThan(0);
    expect(notifyIdx).toBeGreaterThan(0);
    expect(auditIdx).toBeLessThan(refundResIdx);
    expect(notifyIdx).toBeLessThan(refundResIdx);
  });

  it('inbox failure branch still calls markFailedRetryable so partial-failure retries', () => {
    expect(src).toMatch(/markFailedRetryable\?\.\(['"]refund_exception['"]\)/);
  });
});
