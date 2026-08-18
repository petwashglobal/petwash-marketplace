/**
 * PR-ACCESS-REQUESTS-MINE-PROJECTION — fire-order item 104.
 *
 * GET /api/access-requests/mine delegated to
 * storage.getStaffAccessRequestByUser which returns the full
 * staff_access_requests row (bare db.select()). That leaked to the
 * applicant:
 *   decidedBy      admin uid that made the decision
 *   approvalScope  internal jsonb approver-scope metadata
 *   userId         redundant / internal
 *   id             internal db serial
 * `reason` is INTENTIONALLY kept — applicant is entitled to see why
 * their request was rejected.
 *
 * Fix: new `toSafeAccessRequestView()` helper + explicit type applied
 * to the response.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const ROUTE = 'server/routes/access-requests.ts';

function read(rel: string): string { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('PR-ACCESS-REQUESTS-MINE-PROJECTION', () => {
  const src = read(ROUTE);

  it('A1. toSafeAccessRequestView helper is defined + SafeAccessRequestView type', () => {
    expect(/type\s+SafeAccessRequestView\s*=\s*\{/.test(src)).toBe(true);
    expect(/function\s+toSafeAccessRequestView\s*\(\s*r\s*:\s*any\s*\)\s*:\s*SafeAccessRequestView/.test(src)).toBe(true);
  });

  it('A2. SafeAccessRequestView type has NO forbidden field', () => {
    const typeBlock = src.match(/type\s+SafeAccessRequestView\s*=\s*\{([\s\S]*?)\}\s*;/)?.[1] || '';
    expect(typeBlock.length).toBeGreaterThan(0);
    const forbidden = ['decidedBy', 'approvalScope', 'userId', 'id'];
    for (const f of forbidden) {
      const re = new RegExp(`^\\s*${f}\\s*:`, 'm');
      if (re.test(typeBlock)) {
        throw new Error(`SafeAccessRequestView contains forbidden field "${f}"`);
      }
    }
    // reason IS in the type — applicant sees why their request was rejected.
    expect(/^\s*reason\s*:/m.test(typeBlock)).toBe(true);
  });

  it('A3. toSafeAccessRequestView body references ONLY allow-listed fields', () => {
    const body = src.match(/function\s+toSafeAccessRequestView[\s\S]*?\{([\s\S]*?)\}\s*\n/)?.[1] || '';
    expect(body.length).toBeGreaterThan(0);
    for (const forbidden of ['r.decidedBy', 'r.approvalScope', 'r.userId', 'r.id']) {
      expect(body.includes(forbidden)).toBe(false);
    }
  });

  it('A4. /mine handler runs the response through toSafeAccessRequestView', () => {
    const mineBlock = src.match(/router\.get\(\s*['"]\/mine['"][\s\S]*?^\}\s*\)\s*;/m)?.[0] || '';
    expect(mineBlock.length).toBeGreaterThan(0);
    expect(/res\.json\(\s*\{\s*request:\s*request\s*\?\s*toSafeAccessRequestView\(\s*request\s*\)\s*:\s*null\s*\}\s*\)/.test(mineBlock)).toBe(true);
  });

  it('A5. caller identity from req.firebaseUser?.uid — no query/body/params', () => {
    const mineBlock = src.match(/router\.get\(\s*['"]\/mine['"][\s\S]*?^\}\s*\)\s*;/m)?.[0] || '';
    expect(/const\s+userId\s*=\s*req\.firebaseUser\?\.uid/.test(mineBlock)).toBe(true);
    expect(mineBlock.includes('req.query')).toBe(false);
    expect(mineBlock.includes('req.body')).toBe(false);
    expect(mineBlock.includes('req.params')).toBe(false);
  });

  it('A6. requireAuth middleware still gates the route', () => {
    expect(/router\.get\(\s*['"]\/mine['"]\s*,\s*requireAuth\s*,/.test(src)).toBe(true);
  });
});
