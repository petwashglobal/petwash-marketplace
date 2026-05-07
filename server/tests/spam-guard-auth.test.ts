/**
 * Issue #153 Mission 4 PR-1 — spam-guard auth + audit regression pin.
 *
 * Before this fix:
 *   - Mount in routes.ts ran ONLY adminLimiter (a rate limiter, not auth).
 *   - Router had NO router.use guard and NO per-handler auth.
 *   - 5 endpoints (2 reads + 3 mutations) reachable unauthenticated.
 *
 * After this fix:
 *   - Mount runs validateFirebaseToken before adminLimiter so
 *     req.firebaseUser is populated for the role check.
 *   - Router applies router.use(requireAdmin) so every handler — read
 *     or mutation — requires admin role before execution.
 *   - Three mutations emit canonical audit_events:
 *       SPAMGUARD_MANUAL_SWEEP
 *       SPAMGUARD_ANALYZE      (metadata: contentLength only, no raw content)
 *       SPAMGUARD_DETECTION_RESOLVE
 *
 * This source-pin test fails if any of the guarantees regress.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes.ts'),
  'utf8',
);
const SPAM_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'spam-guard.ts'),
  'utf8',
);

describe('spam-guard mount (routes.ts) — Issue #153 Mission 4 PR-1', () => {
  it('mount applies validateFirebaseToken before adminLimiter', () => {
    expect(ROUTES_SRC).toMatch(
      /app\.use\(\s*['"]\/api\/admin\/spam-guard['"]\s*,\s*validateFirebaseToken\s*,\s*adminLimiter\s*,/,
    );
  });
});

describe('spam-guard router — Issue #153 Mission 4 PR-1 regression pin', () => {
  it('imports requireAdmin from adminAuth', () => {
    expect(SPAM_SRC).toMatch(
      /import\s*\{\s*requireAdmin\s*\}\s*from\s*['"]\.\.\/adminAuth['"]/,
    );
  });

  it('imports logAuditEvent from middleware/auditLog', () => {
    expect(SPAM_SRC).toMatch(
      /import\s*\{\s*logAuditEvent\s*\}\s*from\s*['"]\.\.\/middleware\/auditLog['"]/,
    );
  });

  it('applies requireAdmin as router-level middleware (blanket guard)', () => {
    expect(SPAM_SRC).toMatch(/router\.use\(\s*requireAdmin\s*\)/);
  });

  it('emits audit_events on every mutation route', () => {
    for (const action of [
      'SPAMGUARD_MANUAL_SWEEP',
      'SPAMGUARD_ANALYZE',
      'SPAMGUARD_DETECTION_RESOLVE',
    ]) {
      expect(SPAM_SRC).toMatch(
        new RegExp(`actionType:\\s*['"]${action}['"]`),
      );
    }
  });

  it('analyze audit metadata logs contentLength only — never raw content', () => {
    // The audit emission for SPAMGUARD_ANALYZE must include a length
    // field but NEVER spread the request body or echo the raw content.
    const idx = SPAM_SRC.indexOf('SPAMGUARD_ANALYZE');
    expect(idx).toBeGreaterThan(0);
    const block = SPAM_SRC.slice(idx, idx + 600);
    expect(block).toMatch(/contentLength:/);
    // Defensive: must NOT pass the raw `content` variable into metadata.
    expect(block).not.toMatch(/\bcontent:\s*content\b/);
  });

  it('emit helper uses setImmediate fire-and-forget pattern (non-blocking)', () => {
    expect(SPAM_SRC).toMatch(/setImmediate\(\s*\(\)\s*=>\s*\{[\s\S]*logAuditEvent\(/);
  });

  it('removes the misleading "Admin auth is applied globally" comment', () => {
    // The previous comment claimed router was protected by global
    // /api/admin/* auth — that was never true. The corrected comment
    // explicitly documents the router-level requireAdmin guard.
    expect(SPAM_SRC).not.toMatch(/Admin auth is applied globally/);
  });
});
