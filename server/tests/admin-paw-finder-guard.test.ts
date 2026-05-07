/**
 * Issue #148 P5 (admin-paw-finder mount) — regression pin.
 *
 * Before this fix: the /api/admin/paw-finder mount in routes.ts ran
 * `validateFirebaseToken` only — and the router itself had NO inline
 * `requireAdmin` and NO blanket `router.use(...)` guard. Any signed-in
 * Firebase user (customer, walker, sitter, anyone) could reach the
 * moderation queue and approve/reject/archive posts.
 *
 * After this fix:
 *   - admin-paw-finder.ts imports `requireAdmin` and applies it via
 *     `router.use(requireAdmin)` so every handler requires admin role.
 *   - Mutations (approve / reject / archive) emit canonical
 *     `audit_events` via `logAuditEvent` alongside the local
 *     paw_finder_events log.
 *
 * This source-pin test fails if either guarantee is removed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'admin-paw-finder.ts'),
  'utf8',
);

describe('admin-paw-finder — Issue #148 P5 regression pin', () => {
  it('imports requireAdmin from adminAuth', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*requireAdmin\s*\}\s*from\s*['"]\.\.\/adminAuth['"]/,
    );
  });

  it('imports logAuditEvent from middleware/auditLog', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/,
    );
  });

  it('applies requireAdmin as router-level middleware (blanket guard)', () => {
    expect(SRC).toMatch(/router\.use\(\s*requireAdmin\s*\)/);
  });

  it('emits audit_events on every mutation route', () => {
    for (const action of [
      'PAW_FINDER_POST_APPROVE',
      'PAW_FINDER_POST_REJECT',
      'PAW_FINDER_POST_ARCHIVE',
    ]) {
      expect(SRC).toMatch(
        new RegExp(`actionType:\\s*['"]${action}['"]`),
      );
    }
  });

  it('audit emission targets the correct domain (paw_finder_post)', () => {
    expect(SRC).toMatch(/targetType:\s*['"]paw_finder_post['"]/);
  });

  it('still calls the existing local paw_finder_events log (no behaviour regression)', () => {
    expect(SRC).toMatch(/paw_finder_post_approved_by_support/);
    expect(SRC).toMatch(/paw_finder_post_rejected_by_support/);
    expect(SRC).toMatch(/paw_finder_post_archived/);
  });

  it('emit helper uses setImmediate fire-and-forget pattern (non-blocking)', () => {
    expect(SRC).toMatch(/setImmediate\(\s*\(\)\s*=>\s*\{[\s\S]*logAuditEvent\(/);
  });
});
