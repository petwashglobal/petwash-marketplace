/**
 * Issue #148 P5 (admin-notifications mount) — regression pin.
 *
 * Before this fix: admin-notifications.ts had its `requireAdmin` middleware
 * inlined on each of 8 handler signatures. Any future handler added without
 * the inline arg would silently bypass the role check (defense gap).
 *
 * After this fix:
 *   - `router.use(requireAdmin)` applies the guard at the router level so
 *     any future handler is automatically protected.
 *   - The 8 inline `, requireAdmin,` args were removed (no behaviour change;
 *     the same fn is now called once at router level instead of 8 times).
 *   - The single mutation `POST /notifications/retry-sweep` emits a
 *     canonical audit_events row via logAuditEvent.
 *
 * This source-pin test fails if those guarantees regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'admin-notifications.ts'),
  'utf8',
);

describe('admin-notifications — Issue #148 P5 regression pin', () => {
  it('applies requireAdmin as router-level middleware', () => {
    expect(SRC).toMatch(/router\.use\(\s*requireAdmin\s*\)/);
  });

  it('imports logAuditEvent from middleware/auditLog', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/,
    );
  });

  it('does NOT pass requireAdmin per handler (would mean 2x token verifies)', () => {
    expect(SRC).not.toMatch(/router\.(get|post|put|patch|delete)\([^)]+,\s*requireAdmin\s*,/);
  });

  it('still defines the local requireAdmin middleware function', () => {
    expect(SRC).toMatch(/async function requireAdmin\(/);
  });

  it('emits NOTIFICATION_RETRY_SWEEP audit on the single mutation', () => {
    expect(SRC).toMatch(/actionType:\s*['"]NOTIFICATION_RETRY_SWEEP['"]/);
    expect(SRC).toMatch(/targetType:\s*['"]notification_retry_queue['"]/);
  });

  it('audit emission uses setImmediate fire-and-forget pattern', () => {
    expect(SRC).toMatch(/setImmediate\(\s*\(\)\s*=>\s*\{[\s\S]*logAuditEvent\(/);
  });
});
