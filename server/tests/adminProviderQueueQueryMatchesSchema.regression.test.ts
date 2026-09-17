import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

/**
 * 2026-09-17: /api/provider-onboarding/admin/applications/queue answered 500
 * even after migration 0162 created provider_review_queue — the query also
 * selected `a.fraud_flags` from provider_applications, a column that exists
 * nowhere: not in any migration (fraud_flags belongs to user_devices) and not
 * in the drizzle schema. The KYC risk signal the screen shows is
 * kyc_fraud_risk_level.
 */
const ROOT = resolve(__dirname, '..', '..');
const queue = readFileSync(join(ROOT, 'server/services/providerQueue.ts'), 'utf8');
const schema = readFileSync(join(ROOT, 'shared/schema.ts'), 'utf8');
const migrations = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(ROOT, 'migrations', f), 'utf8')).join('\n');

describe('the admin queue query only reads columns that exist', () => {
  it('does not select fraud_flags from the applications table', () => {
    expect(queue).not.toMatch(/^\s*a\.fraud_flags,/m);
  });

  it('every a.<column> it selects is a real provider_applications column', () => {
    const sql = queue.slice(queue.indexOf('SELECT'), queue.indexOf('FROM provider_review_queue q'));
    const cols = Array.from(new Set(Array.from(sql.matchAll(/\ba\.([a-z_]+)/g)).map((m) => m[1])));
    expect(cols.length).toBeGreaterThan(5);
    const appTable = schema.slice(schema.indexOf('export const providerApplications = pgTable'));
    const declared = appTable.slice(0, appTable.indexOf('\n}'));
    const missing = cols.filter((c) => !declared.includes(`"${c}"`) && !new RegExp(`ADD COLUMN IF NOT EXISTS ["']?${c}\\b`).test(migrations));
    expect(missing).toEqual([]);
  });
});
