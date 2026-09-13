/** Every finding the evidence engine can produce has a Hebrew title in the admin queue. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FINDING_HE, VERDICT_HE } from './payoutApprovalCopy';

describe('payout approval copy', () => {
  it('covers every code emitted by server/services/jobEvidence.ts', () => {
    const engine = readFileSync(join(__dirname, '../../../../server/services/jobEvidence.ts'), 'utf8');
    const codes = [...engine.matchAll(/(?:block|warn)\('([A-Z_]+)'/g)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(10);
    for (const c of codes) expect(FINDING_HE[c], c).toBeTruthy();
  });
  it('has a Hebrew label for every verdict', () => {
    expect(Object.keys(VERDICT_HE).sort()).toEqual(['blocked', 'clear', 'none', 'review']);
  });
  it('the screen talks to the real endpoints and requires the override for blocked jobs', () => {
    const src = readFileSync(join(__dirname, 'AdminPayoutApprovals.tsx'), 'utf8');
    expect(src).toContain('"/api/escrow/admin/awaiting-approval"');
    expect(src).toContain('/approve-release');
    expect(src).toContain('(!blocked || (override && reason.trim().length >= 20))');
    expect(src).toContain('dir="rtl"');
  });
});
