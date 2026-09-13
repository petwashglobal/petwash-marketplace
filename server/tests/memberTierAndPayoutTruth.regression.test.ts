import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 2026-09-13 — three money/member truths that were silently false.
 *
 * 1. Membership: every reader looked up privilege_members.firebase_uid, which
 *    no join route wrote. Enrolled members got no tier discount, read
 *    NOT_JOINED on /api/me/status and never saw the Prestige home item.
 * 2. Tier case: points upgrades stored 'GOLD' while every reader compares
 *    'gold', so an upgraded member was refused a loyalty wash at the bay, and
 *    the upgrade push compared against a value no caller passes (never sent).
 * 3. Payout release: seven station_settlements columns used by the release
 *    gate, the reserve hold and the treasury forecast did not exist (42703).
 */

const queries: Array<{ text: string; params: unknown[] }> = [];
let nextRows: any[] = [];

vi.mock('../db', () => ({
  db: {},
  pool: {
    query: vi.fn(async (text: string, params: unknown[]) => {
      queries.push({ text, params });
      return { rows: nextRows };
    }),
  },
}));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const root = path.resolve(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('findPrivilegeMemberForUser', () => {
  beforeEach(() => { queries.length = 0; nextRows = []; });

  it('returns null for no uid without touching the database', async () => {
    const { findPrivilegeMemberForUser } = await import('../lib/privilegeMemberLookup');
    expect(await findPrivilegeMemberForUser('')).toBeNull();
    expect(await findPrivilegeMemberForUser(undefined)).toBeNull();
    expect(queries).toHaveLength(0);
  });

  it('binds by uid first, else by the account OWN users.email on an UNBOUND row', async () => {
    const { findPrivilegeMemberForUser } = await import('../lib/privilegeMemberLookup');
    nextRows = [{ member_id: 'PWP-1', tier: 'GOLD', status: 'Active', points: '120', bound: false }];
    const m = await findPrivilegeMemberForUser('uid-abc');
    expect(m).toEqual({ memberId: 'PWP-1', tier: 'GOLD', status: 'active', points: 120 });

    const q = queries[0];
    expect(q.params).toEqual(['uid-abc']); // the only input is the verified uid
    expect(q.text).toContain('pm.firebase_uid = $1');
    // email comes from users (the account), never from a request body
    expect(q.text).toMatch(/SELECT lower\(u\.email\) FROM users u\s+WHERE u\.id = \$1/);
    // a row already bound to ANOTHER account can never be claimed by email
    expect(q.text).toContain('pm.firebase_uid IS NULL');
    expect(q.text).toContain('ORDER BY bound DESC');
  });

  it('no row → null (not a member, no benefit)', async () => {
    const { findPrivilegeMemberForUser } = await import('../lib/privilegeMemberLookup');
    nextRows = [];
    expect(await findPrivilegeMemberForUser('uid-x')).toBeNull();
  });
});

describe('every membership reader uses the helper, none keys on the unwritten column alone', () => {
  it('routes.ts tier discount', () => {
    const src = read('server/lib/memberTierDiscount.ts');
    const fn = src.slice(src.indexOf('async function resolveMemberTierDiscount'));
    expect(fn).toContain('findPrivilegeMemberForUser(userId)');
    expect(fn).toContain('canonicalTierId(member.tier)');
    expect(fn).not.toContain('privilegeMembers.firebaseUid');
  });
  it('me-status', () => {
    const src = read('server/routes/me-status.ts');
    expect(src).toContain('findPrivilegeMemberForUser(uid)');
    expect(src).not.toMatch(/FROM privilege_members\s+WHERE firebase_uid = \$1/);
  });
  it('attention feed', () => {
    const src = read('server/services/attentionFeed.ts');
    expect(src).toContain('findPrivilegeMemberForUser(userId)');
    expect(src).not.toContain('eq(privilegeMembers.firebaseUid, userId)');
  });
  it('prestige-join writes the uid on insert, and binds an existing row only for the token email', () => {
    const src = read('server/routes/prestige-join.ts');
    expect(src).toMatch(/sms_consent, status, firebase_uid\)/);
    expect(src).toMatch(/'pending_verification', \$9\)/);
    expect(src).toMatch(/marketingConsent === true, userId\]/);
    expect(src).toContain("const tokenEmail = String((req as any).firebaseUser?.email || '').trim().toLowerCase();");
    expect(src).toContain('if (tokenEmail && tokenEmail === email.trim().toLowerCase())');
    expect(src).toContain('WHERE email = $2 AND firebase_uid IS NULL');
  });
});

describe('tier case', () => {
  it('the bay accepts an upper-case stored tier and the two highest tiers', async () => {
    const { loyaltyWashEligible } = await import('../services/K9000RedemptionService');
    expect(loyaltyWashEligible({ loyaltyTier: 'GOLD', loyaltyPointsBalance: 500 })).toBe(true);
    expect(loyaltyWashEligible({ loyaltyTier: ' Platinum ', loyaltyPointsBalance: 900 })).toBe(true);
    expect(loyaltyWashEligible({ loyaltyTier: 'royal', loyaltyPointsBalance: 500 })).toBe(true);
    expect(loyaltyWashEligible({ loyaltyTier: 'emerald', loyaltyPointsBalance: 500 })).toBe(true);
    expect(loyaltyWashEligible({ loyaltyTier: 'SILVER', loyaltyPointsBalance: 5000 })).toBe(false);
    expect(loyaltyWashEligible({ loyaltyTier: 'GOLD', loyaltyPointsBalance: 499 })).toBe(false);
  });

  it('the bay-side redemption check uses the same normalisation', () => {
    const src = read('server/services/K9000RedemptionService.ts');
    expect(src).toContain('LOYALTY_QUALIFYING_TIERS.includes(normalizedTier(wallet.loyaltyTier))');
    expect(src).not.toContain("LOYALTY_QUALIFYING_TIERS.includes(wallet.loyaltyTier ?? '')");
  });

  it('loyaltySync stores canonical lower-case ids everywhere it writes a tier', () => {
    const src = read('server/actions/loyaltySync.ts');
    expect(src).toContain('newTier = canonicalTierId(calculateTier(newPoints));');
    expect(src).toContain('const rollbackTier = canonicalTierId(calculateTier(');
    expect(src).not.toMatch(/newTier = calculateTier\(newPoints\);/);
  });

  it('the upgrade push compares against the tier read in the transaction, and only on a rise', () => {
    const src = read('server/actions/loyaltySync.ts');
    expect(src).toContain('previousTier = canonicalTierId(oldTier);');
    expect(src).toContain('TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(oldTier)');
    expect(src).not.toMatch(/const oldTier = metadata\?\.oldTier;\s*\n\s*if \(oldTier && oldTier !== newTier\)/);
    expect(src).toContain('tierUpgradeMessage(locale, tierDisplayName(newTier, locale), discount)');
  });

  it('canonicalTierId maps the old upper-case ladder onto TIER_CONFIGS ids', async () => {
    const { canonicalTierId } = await import('@shared/lib/tierLabels');
    for (const [raw, id] of [['BRONZE', 'bronze'], ['GOLD', 'gold'], ['EMERALD', 'emerald'], ['ROYAL', 'royal']] as const) {
      expect(canonicalTierId(raw)).toBe(id);
    }
  });

  it('My Account badge compares case-insensitively', () => {
    const src = read('client/src/pages/MyAccount.tsx');
    expect(src).toContain("String(wallet?.loyaltyTier || '').toUpperCase() === 'GOLD'");
    expect(src).not.toContain("wallet?.loyaltyTier === 'GOLD'");
  });
});

describe('payout release columns exist', () => {
  const COLUMNS = [
    'payout_hold_reason',
    'second_release_approval_required',
    'payout_release_requested_at',
    'payout_release_approved_at',
    'payout_release_approved_by',
    'held_in_reserve',
    'reserve_reason',
  ];
  const migration = read('migrations/0156_station_settlements_payout_release_columns.sql');
  const schema = read('shared/schema.ts');
  const settlements = schema.slice(schema.indexOf('export const stationSettlements = pgTable'), schema.indexOf('}, (table) => ({', schema.indexOf('export const stationSettlements = pgTable')));

  it('every column the release gate and treasury forecast use is added by the migration and declared in the schema', () => {
    const users = read('server/routes/financial-approvals.ts') + read('server/lib/treasury-forecast.ts');
    for (const col of COLUMNS) {
      expect(users.includes(col), `${col} is no longer used — drop it from this list`).toBe(true);
      expect(migration, `migration missing ${col}`).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`));
      expect(settlements, `schema.ts missing ${col}`).toContain(`"${col}"`);
    }
  });

  it('the migration is additive only', () => {
    const sqlOnly = migration.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(sqlOnly).not.toMatch(/\b(DROP|UPDATE|DELETE|RENAME|TRUNCATE)\b/i);
    expect(sqlOnly).toContain('ALTER TABLE station_settlements');
  });
});
