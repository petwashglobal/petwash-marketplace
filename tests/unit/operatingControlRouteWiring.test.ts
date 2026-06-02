import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

function source(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('operating-control route wiring', () => {
  it('gates provider application approval before approving a provider application', () => {
    const code = source('server/routes/provider-onboarding.ts');

    expect(code).toContain("import { assertOperatingControl } from '../lib/petwashOperatingControlGateway'");
    expect(code).toContain("actionType: 'PROVIDER_ACTIVATION'");
    expect(code).toContain("route: 'POST /api/provider-onboarding/admin/applications/approve'");

    const gateIndex = code.indexOf("actionType: 'PROVIDER_ACTIVATION'");
    const mutationIndex = code.indexOf("SET status = 'approved'");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(mutationIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(mutationIndex);
  });

  it('gates treasury payout batch creation, submission, and mark-paid routes', () => {
    const code = source('server/routes/treasury.ts');

    expect(code).toContain("import { assertOperatingControl } from '../lib/petwashOperatingControlGateway'");
    expect(code.match(/actionType: 'PROVIDER_PAYOUT'/g)?.length).toBeGreaterThanOrEqual(3);
    expect(code).toContain("route: 'POST /api/treasury/batches'");
    expect(code).toContain("route: 'POST /api/treasury/batches/:id/submit'");
    expect(code).toContain("route: 'POST /api/treasury/batches/:id/mark-paid'");

    const createGateIndex = code.indexOf("route: 'POST /api/treasury/batches'");
    const createMutationIndex = code.indexOf('INSERT INTO payout_batches');
    expect(createGateIndex).toBeGreaterThan(-1);
    expect(createMutationIndex).toBeGreaterThan(-1);
    expect(createGateIndex).toBeLessThan(createMutationIndex);

    const markPaidGateIndex = code.indexOf("route: 'POST /api/treasury/batches/:id/mark-paid'");
    const markPaidMutationIndex = code.indexOf("UPDATE payout_batches SET status = 'paid'");
    expect(markPaidGateIndex).toBeGreaterThan(-1);
    expect(markPaidMutationIndex).toBeGreaterThan(-1);
    expect(markPaidGateIndex).toBeLessThan(markPaidMutationIndex);
  });

  it('gates direct booking and walk wallet refunds before legacy wallet balance mutations', () => {
    const bookings = source('server/routes/bookings.ts');
    const walkMyPet = source('server/routes/walk-my-pet.ts');

    expect(bookings).toContain("import { assertOperatingControl } from \"../lib/petwashOperatingControlGateway\"");
    expect(bookings).toContain("actionType: 'CUSTOMER_REFUND'");
    expect(bookings).toContain("route: 'POST /api/bookings/:bookingId/cancel'");
    expect(bookings.indexOf("route: 'POST /api/bookings/:bookingId/cancel'")).toBeLessThan(
      bookings.indexOf('INSERT INTO wallet_accounts (wallet_id, user_id, cash_wallet_balance_cents, updated_at)'),
    );

    expect(walkMyPet).toContain("import { assertOperatingControl } from '../lib/petwashOperatingControlGateway'");
    expect(walkMyPet).toContain("route: 'POST /api/walk-my-pet/walker/reject/:walkId'");
    expect(walkMyPet.indexOf("route: 'POST /api/walk-my-pet/walker/reject/:walkId'")).toBeLessThan(
      walkMyPet.indexOf('INSERT INTO wallet_accounts (wallet_id, user_id, cash_wallet_balance_cents)'),
    );
  });

  it('gates dispute resolution money movement before wallet or provider-release mutations', () => {
    const code = source('server/routes/disputes.ts');

    expect(code).toContain("import { assertOperatingControl } from '../lib/petwashOperatingControlGateway'");
    expect(code).toContain("route: 'PATCH /api/disputes/:id/resolve'");
    expect(code).toContain("actionType: 'CUSTOMER_REFUND'");
    expect(code).toContain("actionType: 'PROVIDER_PAYOUT'");

    const gateIndex = code.indexOf("route: 'PATCH /api/disputes/:id/resolve'");
    const walletMutationIndex = code.indexOf('INSERT INTO wallet_accounts (wallet_id, user_id, cash_wallet_balance_cents)');
    const escrowReleaseIndex = code.indexOf("SET status = 'released'");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(walletMutationIndex);
    expect(gateIndex).toBeLessThan(escrowReleaseIndex);
  });

  it('gates case closure routes before direct closed-status writes', () => {
    const code = source('server/routes/case-actions.ts');

    expect(code).toContain("import { assertOperatingControl } from '../lib/petwashOperatingControlGateway'");
    expect(code).toContain("actionType: 'BANK_MATCH_CLOSE'");
    expect(code).toContain("POST /api/case-actions/closure-request:auto-approved");
    expect(code).toContain("POST /api/case-actions/closure-approve");
    expect(code).toContain("POST /api/case-actions/bulk:close_cases");

    const approveGateIndex = code.indexOf("POST /api/case-actions/closure-approve");
    const approveCloseIndex = code.indexOf("SET status           = 'closed'", approveGateIndex);
    expect(approveGateIndex).toBeGreaterThan(-1);
    expect(approveCloseIndex).toBeGreaterThan(-1);
    expect(approveGateIndex).toBeLessThan(approveCloseIndex);
  });

  it('places a front-door operating-control middleware on legacy prestige admin money routes', () => {
    const code = source('server/routes/prestige-pass.ts');

    expect(code).toContain("import { assertOperatingControl } from '../lib/petwashOperatingControlGateway'");
    expect(code).toContain('LEGACY_PRESTIGE_MONEY_ROUTE_GATES');
    expect(code).toContain("actionType: 'CUSTOMER_REFUND'");
    expect(code).toContain("actionType: 'PROVIDER_PAYOUT'");
    expect(code).toContain("actionType: 'BANK_MATCH_CLOSE'");
    expect(code).toContain("actionType: 'MANUAL_FINANCIAL_ADJUSTMENT'");

    const middlewareIndex = code.indexOf('LEGACY_PRESTIGE_MONEY_ROUTE_GATES');
    const legacyPaidIndex = code.indexOf("SET status = 'paid', payout_batch_id");
    const legacyRefundApprovalIndex = code.indexOf("SET status='approved', reviewed_by_uid");
    expect(middlewareIndex).toBeGreaterThan(-1);
    expect(legacyPaidIndex).toBeGreaterThan(-1);
    expect(legacyRefundApprovalIndex).toBeGreaterThan(-1);
    expect(middlewareIndex).toBeLessThan(legacyPaidIndex);
    expect(middlewareIndex).toBeLessThan(legacyRefundApprovalIndex);
  });
});
