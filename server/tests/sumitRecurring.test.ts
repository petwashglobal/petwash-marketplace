import { describe, it, expect, vi } from 'vitest';
import { sumitClient } from '../services/SumitClient';

/**
 * chargeRecurring (POST /billing/recurring/charge/) is the SUMIT subscription /
 * הוראת קבע endpoint. Like every SumitClient method it MUST be a safe no-op
 * until SUMIT is wired — a recurring charge can never fire from an unconfigured
 * environment — and when wired it must send UpdateCustomerByEmail:true so each
 * renewal emails its fiscal document (per SUMIT docs).
 */
describe('SumitClient.chargeRecurring', () => {
  const SAMPLE = {
    idempotencyKey: 'sub-renew-1',
    sumitCustomerId: 12345,
    description: 'PetWash Prestige — annual renewal',
    amountIls: 559,
    recurrenceMonths: 12,
  };

  it('no-ops without firing fetch when SUMIT is not wired', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch' as any);
    const res = await sumitClient.chargeRecurring(SAMPLE);
    expect(res.wired).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('source pins UpdateCustomerByEmail:true (emails the doc after each renewal)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'services', 'SumitClient.ts'),
      'utf8',
    );
    expect(src).toMatch(/billing\/recurring\/charge/);
    expect(src).toMatch(/UpdateCustomerByEmail:\s*true/);
  });
});
