/**
 * NayaxJobDispatch payment simulation must require an EXPLICIT opt-in and never run
 * in production — so a missing/typo'd NODE_ENV on a deploy can't mock-approve real
 * job-dispatch payments.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'services', 'NayaxJobDispatchPaymentService.ts'), 'utf8');

describe('NayaxJobDispatch payment sim hardening', () => {
  it('no sim branch keys on NODE_ENV alone', () => {
    expect(SRC).not.toMatch(/if \(process\.env\.NODE_ENV === 'development'\)/);
  });
  it('every sim requires explicit opt-in AND non-production', () => {
    const guards = (SRC.match(/process\.env\.NODE_ENV !== 'production' && process\.env\.NAYAX_JOBDISPATCH_SIMULATE === 'true'/g) || []).length;
    expect(guards).toBeGreaterThanOrEqual(3);
  });
});
