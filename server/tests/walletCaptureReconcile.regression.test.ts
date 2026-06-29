/**
 * A failed wallet debit/release on provider-response must NOT be silently swallowed.
 * The booking already returned 200 ("charged"); on failure we flag the row
 * (debit_failed / release_failed — distinct from the normal 'hold_active') and alert,
 * so a held amount that is neither captured nor released is visible + recoverable.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'routes', 'booking-requests.ts'), 'utf8');

describe('wallet capture failure is visible + recoverable', () => {
  it('flags a distinct finance state on failure (not left as hold_active)', () => {
    expect(SRC).toMatch(/const failedState = data\.action === 'accept' \? 'debit_failed' : 'release_failed'/);
    expect(SRC).toMatch(/\.set\(\{ financeState: failedState/);
  });
  it('alerts ops on the swallowed failure', () => {
    expect(SRC).toMatch(/sendSecurityAlert\(\s*`Wallet \$\{data\.action\} FAILED/);
  });
});
