/**
 * Regression pins — P1 audit/reliability round (X-ray 2026-07-25).
 *  - Refunds now write to the central audit trail (invariants §4).
 *  - A failed legacy→canonical bridge raises a critical alert instead of
 *    silently producing an invisible booking (invariants §6).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const svc = (p: string) => readFileSync(join(__dirname, '..', 'services', p), 'utf8');
const refund = svc('RefundService.ts');
const bridge = svc('legacyBookingBridge.ts');

describe('refund audit trail (P1 §4)', () => {
  it('audits all three refund outcomes', () => {
    expect(refund).toMatch(/logAuditEvent/);
    expect(refund).toMatch(/REFUND_RECORDED_PENDING/);
    expect(refund).toMatch(/REFUND_EXECUTED/);
    expect(refund).toMatch(/REFUND_FAILED/);
  });
});

describe('bridge failure is visible, not silent (P1 §6)', () => {
  it('raises a critical alert when the mirror fails', () => {
    const cat = bridge.indexOf('mirror failed');
    const after = bridge.slice(cat, cat + 900);
    expect(after).toMatch(/createOrUpdateAlert/);
    expect(after).toMatch(/severity:\s*'critical'/);
    expect(after).toMatch(/bridge_failed:/);
  });
});
