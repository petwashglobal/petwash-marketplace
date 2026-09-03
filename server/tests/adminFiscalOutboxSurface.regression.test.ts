/**
 * Post-release 2026-09-03 (backlog P1): fiscal outbox admin surface.
 * Source-anchored pins so a refactor cannot silently strip the auth
 * guards or the mounted routes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('admin fiscal-outbox surface — routes and auth', () => {
  it('routes.ts mounts /api/admin/fiscal-outbox behind the admin stack', () => {
    const src = read('server/routes.ts');
    // Import present
    expect(src).toMatch(
      /import\s+adminFiscalOutboxRouter\s+from\s+'\.\/routes\/adminFiscalOutbox'/,
    );
    // Mount present
    expect(src).toMatch(/app\.use\('\/api\/admin\/fiscal-outbox',\s*adminFiscalOutboxRouter\)/);
    // The /api/admin/* prefix already carries adminLimiter, Firebase auth,
    // role guard, MFA gate, and read-only mutation guard — this pin ensures
    // those stack-wide middlewares are still in place around admin mounts.
    expect(src).toMatch(/app\.use\('\/api\/admin\/',\s*adminLimiter\)/);
    expect(src).toMatch(/app\.use\('\/api\/admin\/',\s*requireRole/);
  });

  it('router exposes list / detail / force-retry / mark-reviewed', () => {
    const src = read('server/routes/adminFiscalOutbox.ts');
    expect(src).toMatch(/router\.get\('\/',/);
    expect(src).toMatch(/router\.get\('\/:id',/);
    expect(src).toMatch(/router\.post\('\/:id\/force-retry',/);
    expect(src).toMatch(/router\.post\('\/:id\/mark-reviewed',/);
  });

  it('both write endpoints require verified super-admin', () => {
    const src = read('server/routes/adminFiscalOutbox.ts');
    // Extract the force-retry handler body
    const forceIdx = src.indexOf("router.post('/:id/force-retry'");
    const markIdx = src.indexOf("router.post('/:id/mark-reviewed'");
    expect(forceIdx).toBeGreaterThan(0);
    expect(markIdx).toBeGreaterThan(0);
    // Each write handler starts with an isSuperAdminVerified check
    expect(src.slice(forceIdx, forceIdx + 400)).toMatch(/isSuperAdminVerified\(req\)/);
    expect(src.slice(markIdx, markIdx + 400)).toMatch(/isSuperAdminVerified\(req\)/);
  });

  it('force-retry only reactivates rows that are pending or failed_needs_review', () => {
    const src = read('server/routes/adminFiscalOutbox.ts');
    expect(src).toMatch(/status IN \('failed_needs_review', 'pending'\)/);
    // Reset shape must set status/attempts/next_attempt_at atomically
    expect(src).toMatch(/SET status = 'pending'[\s\S]{0,200}attempts = 0/);
    expect(src).toMatch(/next_attempt_at = now\(\)/);
  });

  it('mark-reviewed only stamps rows already in failed_needs_review', () => {
    const src = read('server/routes/adminFiscalOutbox.ts');
    expect(src).toMatch(
      /UPDATE fiscal_document_outbox[\s\S]{0,200}WHERE id = \$1[\s\S]{0,80}AND status = 'failed_needs_review'/,
    );
  });
});
