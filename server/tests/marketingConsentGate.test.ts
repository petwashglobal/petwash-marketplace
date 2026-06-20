/**
 * Israel Spam Law §30א — marketing consent gate unit tests.
 *
 * Proves the canonical reusable chokepoint `assertMarketingConsent(userId, channel)`
 * (exported from server/services/CampaignDeliveryService.ts) enforces:
 *
 *   1. sms   → BLOCKED when marketing_sms_consent_at is null;
 *              ALLOWED when it has a timestamp.
 *   2. email → BLOCKED when marketing_email_consent_at is null;
 *              ALLOWED when it has a timestamp.
 *   3. push  → ALLOWED only when marketing_push_consent_at is set AND
 *              push_device_permission_status === 'granted' (BOTH required).
 *   4. in_app → always allowed (no DB lookup, never gated).
 *   5. FAIL-CLOSED: no preferences row → sms/email/push all blocked.
 *   6. FAIL-CLOSED: DB lookup throws → blocked.
 *
 * The notification_preferences lookup is mocked via the `pool` from ../db so the
 * test never touches a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB pool — assertMarketingConsent issues exactly one pool.query().
const query = vi.fn();
vi.mock('../db', () => ({
  pool: { query: (...args: any[]) => query(...args) },
  db: {},
}));

// Stub heavy sibling modules pulled in transitively by CampaignDeliveryService
// so importing it does not spin up real coupon / notification machinery.
vi.mock('../services/CouponService', () => ({ couponService: {} }));
vi.mock('../services/PetWashNotificationEngine', () => ({ dispatchNotifications: vi.fn() }));
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { assertMarketingConsent } from '../services/CampaignDeliveryService';

/** Helper: make the NEXT pool.query resolve to a notification_preferences row. */
function prefsRow(row: Record<string, any> | null) {
  query.mockResolvedValueOnce({ rows: row ? [row] : [] });
}
/** Helper: make the NEXT pool.query (the suppression veto) resolve to a users row. */
function suppRow(row: Record<string, any> | null) {
  query.mockResolvedValueOnce({ rows: row ? [row] : [] });
}

describe('assertMarketingConsent — Israel Spam Law §30א gate', () => {
  beforeEach(() => {
    query.mockReset();
  });

  // ── SMS ──────────────────────────────────────────────────────────────────
  it('BLOCKS sms when marketing_sms_consent_at is null', async () => {
    prefsRow({
      marketing_sms_consent_at: null,
      marketing_email_consent_at: null,
      marketing_push_consent_at: null,
      push_device_permission_status: 'not_determined',
    });
    expect(await assertMarketingConsent('user-1', 'sms')).toBe(false);
  });

  it('ALLOWS sms when marketing_sms_consent_at has a timestamp', async () => {
    prefsRow({
      marketing_sms_consent_at: new Date('2026-01-01T00:00:00Z'),
      marketing_email_consent_at: null,
      marketing_push_consent_at: null,
      push_device_permission_status: 'not_determined',
    });
    suppRow(null); // no legacy suppression
    expect(await assertMarketingConsent('user-2', 'sms')).toBe(true);
  });

  // ── EMAIL ────────────────────────────────────────────────────────────────
  it('BLOCKS email when marketing_email_consent_at is null', async () => {
    prefsRow({
      marketing_sms_consent_at: new Date(),
      marketing_email_consent_at: null,
      marketing_push_consent_at: null,
      push_device_permission_status: 'granted',
    });
    expect(await assertMarketingConsent('user-3', 'email')).toBe(false);
  });

  it('ALLOWS email when marketing_email_consent_at has a timestamp', async () => {
    prefsRow({
      marketing_sms_consent_at: null,
      marketing_email_consent_at: new Date('2026-02-02T00:00:00Z'),
      marketing_push_consent_at: null,
      push_device_permission_status: 'not_determined',
    });
    suppRow(null);
    expect(await assertMarketingConsent('user-4', 'email')).toBe(true);
  });

  // ── PUSH (requires BOTH consent timestamp AND permission 'granted') ────────
  it('BLOCKS push when consent timestamp present but permission not granted', async () => {
    prefsRow({
      marketing_sms_consent_at: null,
      marketing_email_consent_at: null,
      marketing_push_consent_at: new Date('2026-03-03T00:00:00Z'),
      push_device_permission_status: 'not_determined',
    });
    expect(await assertMarketingConsent('user-5', 'push')).toBe(false);
  });

  it('BLOCKS push when permission granted but consent timestamp missing', async () => {
    prefsRow({
      marketing_sms_consent_at: null,
      marketing_email_consent_at: null,
      marketing_push_consent_at: null,
      push_device_permission_status: 'granted',
    });
    expect(await assertMarketingConsent('user-6', 'push')).toBe(false);
  });

  it('ALLOWS push only when consent timestamp AND permission granted', async () => {
    prefsRow({
      marketing_sms_consent_at: null,
      marketing_email_consent_at: null,
      marketing_push_consent_at: new Date('2026-03-03T00:00:00Z'),
      push_device_permission_status: 'granted',
    });
    suppRow(null);
    expect(await assertMarketingConsent('user-7', 'push')).toBe(true);
  });

  // ── UNIFICATION: legacy suppression store can veto even with new consent ────
  it('BLOCKS a consented send when the legacy suppression_list.all is true', async () => {
    prefsRow({
      marketing_sms_consent_at: new Date(), marketing_email_consent_at: null,
      marketing_push_consent_at: null, push_device_permission_status: 'not_determined',
    });
    suppRow({ suppression_list: { all: true }, communication_preferences: {} });
    expect(await assertMarketingConsent('user-supp', 'sms')).toBe(false);
  });

  it('BLOCKS a consented send when legacy communication_preferences.marketingConsent is false', async () => {
    prefsRow({
      marketing_sms_consent_at: null, marketing_email_consent_at: new Date(),
      marketing_push_consent_at: null, push_device_permission_status: 'not_determined',
    });
    suppRow({ suppression_list: {}, communication_preferences: { marketingConsent: false } });
    expect(await assertMarketingConsent('user-optout', 'email')).toBe(false);
  });

  it('ALLOWS when consented and legacy store has a per-channel flag for a DIFFERENT channel', async () => {
    prefsRow({
      marketing_sms_consent_at: new Date(), marketing_email_consent_at: null,
      marketing_push_consent_at: null, push_device_permission_status: 'not_determined',
    });
    suppRow({ suppression_list: { email: true }, communication_preferences: {} });
    expect(await assertMarketingConsent('user-mixed', 'sms')).toBe(true);
  });

  // ── in_app — always allowed, never hits the DB ────────────────────────────
  it('ALLOWS in_app without any DB lookup', async () => {
    expect(await assertMarketingConsent('user-8', 'in_app')).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  // ── FAIL-CLOSED ───────────────────────────────────────────────────────────
  it('BLOCKS all real channels when no preferences row exists (fail-closed)', async () => {
    prefsRow(null);
    expect(await assertMarketingConsent('user-9', 'sms')).toBe(false);
    prefsRow(null);
    expect(await assertMarketingConsent('user-9', 'email')).toBe(false);
    prefsRow(null);
    expect(await assertMarketingConsent('user-9', 'push')).toBe(false);
  });

  it('BLOCKS when the consent lookup throws (fail-closed)', async () => {
    query.mockRejectedValueOnce(new Error('db down'));
    expect(await assertMarketingConsent('user-10', 'sms')).toBe(false);
  });

  it('BLOCKS when userId is empty', async () => {
    expect(await assertMarketingConsent('', 'sms')).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
