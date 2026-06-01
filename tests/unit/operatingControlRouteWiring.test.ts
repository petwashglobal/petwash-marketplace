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
});
