/**
 * The provider insurance clearance gate (#800 added isProviderInsuranceCleared
 * but only used it to DISPLAY a flag — it gated no money). This pins that the
 * gate is now ENFORCED at every provider money-exit, on BOTH payout rails:
 *   - contractor_earnings rail: payoutLedger.releaseEscrow + processPayout
 *   - super_app_payouts rail:   ProviderPayoutService.releaseEscrowAndPayout
 * Uninsured provider => money stays held. Source-introspection (DB/auth-bound).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const read = (...p: string[]) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');
const ledger = read('services', 'payoutLedger.ts');
const payoutSvc = read('services', 'ProviderPayoutService.ts');

describe('insurance clearance gate is enforced on payout', () => {
  it('payoutLedger imports the clearance gate', () => {
    expect(ledger).toMatch(/import \{ isProviderInsuranceCleared \} from '\.\.\/routes\/provider-insurance'/);
  });

  it('releaseEscrow blocks an uncleared provider before releasing from escrow', () => {
    const fn = ledger.slice(ledger.indexOf('export async function releaseEscrow'), ledger.indexOf('export async function processPayout'));
    expect(fn).toMatch(/await isProviderInsuranceCleared\(earning\.contractorId\)/);
    expect(fn).toMatch(/PAYOUT_BLOCKED_INSURANCE/);
    // gate must run BEFORE the status flips to 'released'
    expect(fn.indexOf('isProviderInsuranceCleared')).toBeLessThan(fn.indexOf("payoutStatus: 'released'"));
  });

  it('processPayout blocks an uncleared provider before the bank transfer', () => {
    const fn = ledger.slice(ledger.indexOf('export async function processPayout'));
    expect(fn).toMatch(/await isProviderInsuranceCleared\(earning\.contractorId\)/);
    expect(fn.indexOf('isProviderInsuranceCleared')).toBeLessThan(fn.indexOf("payoutStatus: 'paid_out'"));
  });

  it('ProviderPayoutService blocks an uncleared provider before processing', () => {
    expect(payoutSvc).toMatch(/import \{ isProviderInsuranceCleared \} from ['"]\.\.\/routes\/provider-insurance['"]/);
    const fn = payoutSvc.slice(payoutSvc.indexOf('releaseEscrowAndPayout'));
    // insurance docs are keyed by Firebase UID; this rail resolves it via provider.userId
    expect(fn).toMatch(/await isProviderInsuranceCleared\(provider\.userId\)/);
    expect(fn).toMatch(/PAYOUT_BLOCKED_INSURANCE/);
    expect(fn.indexOf('isProviderInsuranceCleared')).toBeLessThan(fn.indexOf("status: 'processing'"));
  });
});
