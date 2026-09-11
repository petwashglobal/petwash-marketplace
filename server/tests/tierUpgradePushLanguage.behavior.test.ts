import { describe, it, expect, vi } from 'vitest';

/**
 * THE TIER-UPGRADE PUSH SPEAKS THE CUSTOMER'S LANGUAGE (2026-09-11)
 *
 * This notification went out English-only —
 *   "🎉 Tier Upgrade!" / "Congratulations! You've reached DIAMOND tier..."
 * — to a customer base that is overwhelmingly Hebrew-speaking, from a product
 * whose web default is RTL Hebrew. The locale is now read from the
 * userProfiles doc, exactly as server/vaccineReminder.ts already reads it.
 *
 * Behavioural: the copy function is called and its OUTPUT asserted. It was
 * extracted as a pure export precisely so this could be tested without mocking
 * Firestore and FCM to find out which language a string came out in.
 */
vi.mock('../db', () => ({ db: { execute: async () => ({ rows: [] }) } }));
vi.mock('../lib/firebase-admin', () => ({ default: { firestore: () => ({}), messaging: () => ({}) } }));
vi.mock('../lib/logger', () => ({ logger: { info: () => {}, warn: () => {}, error: () => {} } }));

const load = async () => await import('../actions/loyaltySync');

describe('tier upgrade push copy', () => {
  it('is Hebrew for a Hebrew customer', async () => {
    const { tierUpgradeMessage } = await load();
    const m = tierUpgradeMessage('he', 'Black Reserve', 10);
    expect(m.title).toMatch(/[֐-׿]/);           // contains Hebrew
    expect(m.body).toMatch(/[֐-׿]/);
    expect(m.body).not.toMatch(/Congratulations/);
  });

  it('is English for an English customer', async () => {
    const { tierUpgradeMessage } = await load();
    const m = tierUpgradeMessage('en', 'Black Reserve', 10);
    expect(m.title).toMatch(/Tier Upgrade/);
    expect(m.body).toMatch(/Congratulations/);
    expect(m.body).not.toMatch(/[֐-׿]/);
  });

  it('never translates the tier name — tier names are brand names', async () => {
    // Brand rule: product and platform names stay English in every language.
    const { tierUpgradeMessage } = await load();
    expect(tierUpgradeMessage('he', 'Black Reserve', 10).body).toContain('Black Reserve');
    expect(tierUpgradeMessage('en', 'Black Reserve', 10).body).toContain('Black Reserve');
  });

  it('states the same discount number in both languages', async () => {
    // Two languages quoting different percentages would be a false-discount
    // promise in one of them.
    const { tierUpgradeMessage } = await load();
    expect(tierUpgradeMessage('he', 'Gold', 7).body).toContain('7');
    expect(tierUpgradeMessage('en', 'Gold', 7).body).toContain('7');
  });
});
