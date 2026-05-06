/** PR-W34v — marketplace-ranking + franchise admin audit. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ranking = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'marketplace-ranking.ts'), 'utf8');
const fmgmt = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'franchise-mgmt.ts'), 'utf8');
const efranch = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'enterprise-franchise.ts'), 'utf8');

describe('PR-W34v — marketplace + franchise admin audit', () => {
  it('marketplace-ranking emits 2 actions', () => {
    expect(ranking).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    for (const a of ['RANKING_BATCH_RECOMPUTE', 'RANKING_ADMIN_OVERRIDE']) {
      expect(ranking).toMatch(new RegExp(`actionType:\\s*['"]${a}['"]`));
    }
  });
  it('franchise-mgmt emits 2 actions', () => {
    expect(fmgmt).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    for (const a of ['FRANCHISE_QUALITY_AUDIT_CREATE', 'FRANCHISE_MANDATORY_UPDATE_DEPLOY']) {
      expect(fmgmt).toMatch(new RegExp(`actionType:\\s*['"]${a}['"]`));
    }
  });
  it('enterprise-franchise emits 5 actions', () => {
    expect(efranch).toMatch(/import\s*\{\s*logAuditEvent\s*\}/);
    for (const a of [
      'FRANCHISEE_CREATE', 'FRANCHISEE_UPDATE',
      'ROYALTY_PAYMENT_CREATE', 'ROYALTY_PAYMENT_UPDATE', 'ROYALTY_PAYMENT_RECORD',
    ]) {
      expect(efranch).toMatch(new RegExp(`actionType:\\s*['"]${a}['"]`));
    }
  });
  it('royalty record-payment masks paymentReference (last4 only)', () => {
    const idx = efranch.indexOf('ROYALTY_PAYMENT_RECORD');
    const block = efranch.slice(idx, idx + 1000);
    expect(block).toMatch(/paymentReferenceLast4:/);
    expect(block).not.toMatch(/paymentReference:\s*validated\.paymentReference\b/);
  });
});
