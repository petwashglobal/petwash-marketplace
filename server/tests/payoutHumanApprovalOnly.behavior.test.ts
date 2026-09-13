/**
 * PROVIDER PAYOUTS NEED A HUMAN "YES" FROM PET WASH (CEO rule, 2026-09-13).
 *
 * Providers can lie. No timer, cron, machine key or "system" actor may release
 * provider money. Found on main (dormant only because no bank API is wired):
 * the 24h auto-approve cron and the escrow expiry sweep released escrow as
 * 'system_*', the hourly payout job ran releaseEscrowAndPayout (→ bank transfer
 * once BANK_PAYOUT_LIVE), and a machine-key route released holdings.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { isSystemPayoutActor, HumanPayoutApprovalRequired } from '../lib/payoutHumanApproval';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('who counts as a human approver', () => {
  it.each([
    ['system', true], ['system_auto_approve', true], ['system_auto_release', true], ['system:cron', true],
    ['cron-escrow', true], ['', true], [null, true], [undefined, true],
    ['biFU2cFFadminUid', false], ['owner-uid-123', false],
  ])('%j → system=%s', (actor, expected) => {
    expect(isSystemPayoutActor(actor as any)).toBe(expected);
  });
  it('the refusal carries a stable code', () => {
    expect(new HumanPayoutApprovalRequired('escrow e1', 'system').code).toBe('HUMAN_APPROVAL_REQUIRED');
  });
});

describe('EscrowService.releaseEscrowPayment refuses system actors before touching Firestore', () => {
  it('throws HUMAN_APPROVAL_REQUIRED and never reads the escrow', async () => {
    const doc = vi.fn(() => { throw new Error('Firestore must not be touched'); });
    vi.doMock('../lib/firebase-admin', () => ({ default: { firestore: () => ({ collection: () => ({ doc }) }) }, db: { collection: () => ({ doc }) } }));
    vi.doMock('./../services/NotificationService', () => ({ default: {} }));
    vi.doMock('../middleware/auditLog', () => ({ logAuditEvent: vi.fn() }));
    vi.doMock('../services/payoutGate', () => ({ checkPayoutGates: vi.fn() }));
    vi.doMock('../services/LedgerService', () => ({ shadowMirrorEscrowHold: vi.fn(), shadowMirrorEscrowRelease: vi.fn() }));
    const { default: EscrowService } = await import('../services/EscrowService');
    for (const actor of ['system_auto_approve', 'system_auto_release', 'system']) {
      await expect(EscrowService.releaseEscrowPayment('esc-1', actor)).rejects.toMatchObject({ code: 'HUMAN_APPROVAL_REQUIRED' });
    }
    expect(doc).not.toHaveBeenCalled();
  });
});

describe('every automatic path now stops at an admin review', () => {
  it('24h auto-approve cron: flags the held escrow, never calls releaseEscrowPayment, never says "released"', () => {
    const src = read('cron/auto-approve-completions.ts');
    expect(src).not.toMatch(/releaseEscrowPayment\(/);
    expect(src).toMatch(/flagPayoutForAdminReview\(\{/);
    expect(src).not.toMatch(/paymentReleasedAt: now,/);
    expect(src).not.toMatch(/Payment released \(auto-approved\)/);
  });

  it('escrow expiry sweep: flags once for review, never releases', () => {
    const src = read('services/EscrowService.ts');
    const i = src.indexOf('async autoReleaseExpiredHolds(');
    const body = src.slice(i, i + 3000);
    expect(body).not.toMatch(/releaseEscrowPayment\(/);
    expect(body).toMatch(/if \(!fresh\?\.awaitingAdminApprovalAt\)/);
  });

  it('hourly super_app_payouts job: flags, never calls releaseEscrowAndPayout', () => {
    const src = read('services/ProviderPayoutService.ts');
    const i = src.indexOf('static async autoReleaseExpiredEscrows(');
    const body = src.slice(i, i + 1600);
    expect(body).not.toMatch(/releaseEscrowAndPayout\(/);
    expect(body).toMatch(/flagPayoutForAdminReview\(\{/);
  });

  it('releaseEscrowAndPayout refuses without a human approver, before any database read', () => {
    const src = read('services/ProviderPayoutService.ts');
    const i = src.indexOf('static async releaseEscrowAndPayout(');
    const guard = src.indexOf('if (isSystemPayoutActor(approvedByUid))', i);
    const firstRead = src.indexOf('await db.select()', i);
    expect(guard).toBeGreaterThan(i);
    expect(firstRead).toBeGreaterThan(guard);
  });

  it('the AI override passes the VERIFIED admin uid, not the body adminId', () => {
    const src = read('routes/ai-payout-verification.ts');
    expect(src).toContain('releaseEscrowAndPayout(payoutId, true, approverUid)');
    expect(src).toContain("const approverUid = (req as any).firebaseUser?.uid");
  });

  it('the machine-key escrow release route is gone (410)', () => {
    const src = read('routes/marketplace-bookings.ts');
    const i = src.indexOf("router.post('/process-escrow-releases'");
    const body = src.slice(i, i + 300);
    expect(body).toContain("res.status(410).json({ error: 'HUMAN_APPROVAL_REQUIRED'");
    expect(body).not.toContain('processEscrowReleases');
  });

  it('THE human "yes": admin-only, needs a written reason, uses the signed-in uid', () => {
    const src = read('routes/escrow.ts');
    const i = src.indexOf('router.post("/admin/:escrowId/approve-release", requireAdmin');
    expect(i).toBeGreaterThan(0);
    const body = src.slice(i, i + 1400);
    expect(body).toContain('REASON_REQUIRED');
    expect(body).toContain('EscrowService.releaseEscrowPayment(req.params.escrowId, adminUid)');
  });
});

describe('payout gate reads the OPEN dispute', () => {
  it('filters dispute status in the query (an old closed dispute can no longer hide an open one)', () => {
    const src = read('services/payoutGate.ts');
    expect(src).toMatch(/bookingDisputes\.status\} IN \('open', 'under_review', 'pending', 'escalated'\)/);
  });
});
