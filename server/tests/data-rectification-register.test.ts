/**
 * Gap 6 — data_rectification_requests must actually be written + readable.
 *
 * The /correct endpoint applied the change and logged to the audit ledger, but
 * never recorded the request in the rectification register (Amendment 13 / GDPR
 * Art.16). It now does, data-minimized (pseudonymous subjectRef, field name only,
 * NOT the user's free-text reason), plus an admin-guarded list + status endpoint.
 *
 * Source-introspection (the handlers are DB- and auth-bound).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'dataRights.ts'),
  'utf8',
);

describe('Gap 6 — rectification register', () => {
  it('the /correct handler inserts into dataRectificationRequests', () => {
    expect(src).toMatch(/db\.insert\(dataRectificationRequests\)/);
    expect(src).toMatch(/status:\s*'completed'/);
  });

  it('is data-minimized: pseudonymous (hashed) subjectRef, no user reason stored', () => {
    expect(src).toMatch(/subjectRefFor\(/);
    expect(src).toMatch(/createHash\('sha256'\)/);
    // the row note must be a fixed string, not the user-supplied `reason`
    expect(src).not.toMatch(/note:\s*reason/);
  });

  it('exposes an admin list endpoint guarded by requireAdmin', () => {
    expect(src).toMatch(/get\('\/admin\/rectifications',\s*requireAdmin/);
  });

  it('exposes an admin status-update endpoint guarded by requireAdmin, validating status', () => {
    expect(src).toMatch(/patch\('\/admin\/rectifications\/:id',\s*requireAdmin/);
    expect(src).toMatch(/'received',\s*'in_progress',\s*'completed',\s*'rejected'/);
  });
});
