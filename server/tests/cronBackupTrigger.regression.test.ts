/**
 * Cloud-Scheduler backup trigger — reliable replacement for in-process night cron.
 * Must be mounted, CSRF-exempt (machine-to-machine), secret-gated (timing-safe vs
 * CRON_SECRET) or super-admin, and only accept known backup types. No money paths.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const src = readFileSync(resolve(ROOT, 'server/routes/cron-backup.ts'), 'utf8');
const routes = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');
const index = readFileSync(resolve(ROOT, 'server/index.ts'), 'utf8');

describe('cron-backup trigger', () => {
  it('is mounted at /api/cron and CSRF-exempt', () => {
    expect(routes).toMatch(/app\.use\('\/api\/cron', cronBackupRoutes\)/);
    expect(index).toMatch(/\/\^\\\/api\\\/cron\\\//); // /^\/api\/cron\// CSRF skip
  });

  it('is secret-gated (timing-safe vs CRON_SECRET) or super-admin', () => {
    expect(src).toMatch(/x-cron-secret/);
    expect(src).toMatch(/process\.env\.CRON_SECRET/);
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).toMatch(/isSuperAdmin/);
    expect(src).toMatch(/return res\.status\(403\)/);
  });

  it('only accepts known backup types and reuses the existing backup service', () => {
    expect(src).toMatch(/VALID_TYPES = \['postgres', 'firestore', 'code'\]/);
    expect(src).toMatch(/performPostgresBackup\(\)/);
    expect(src).toMatch(/performFirestoreExport\(\)/);
    expect(src).toMatch(/performWeeklyCodeBackup\(\)/);
    expect(src).toMatch(/isGcsConfigured\(\)/);
  });

  it('touches no money/ledger surface', () => {
    expect(src).not.toMatch(/WalletLedger|authorizeRedemption|refundToWallet|payout/);
  });
});
