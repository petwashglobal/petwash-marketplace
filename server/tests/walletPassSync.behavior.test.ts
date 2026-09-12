import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../db', () => ({ db: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../services/GoogleWalletService', () => ({
  isGoogleWalletConfigured: () => false,
  pushUpdate: vi.fn(),
}));

import {
  syncPassForUser,
  passBalanceIlsFromCents,
  buildApnsJwt,
  apnsConfigured,
  schedulePassSync,
  pendingPassSyncCount,
  type PassSyncDeps,
  type PassRow,
} from '../services/walletPassSync';

/**
 * Wallet pass live sync audit 2026-09-12:
 *   before — only /api/pass/redeem pushed a new balance, and only to Google;
 *   nothing ever pushed to Apple; a top-up / eGift / refund / K9000 wash left
 *   the pass on the phone stale until the member re-opened it.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

function pass(over: Partial<PassRow> = {}): PassRow {
  return {
    passId: 'PW-1111-2222', userId: 'u1', ownerName: 'Nir Hadad', primaryPetName: 'Kenzo',
    tier: 'GOLD', availableCreditIls: '120.00', validUntil: null, status: 'ACTIVE',
    qrTokenVersion: 3, appleSerialNumber: 'PW-1111-2222', ...over,
  };
}
function deps(over: Partial<PassSyncDeps> = {}): PassSyncDeps & { calls: any[] } {
  const calls: any[] = [];
  return {
    calls,
    loadPass: async () => pass(),
    liveBalance: async () => ({ availableCreditIls: '65.00', loyaltyTier: 'gold' }),
    savePassBalance: async (u, b) => { calls.push(['save', u, b]); },
    googleConfigured: () => true,
    pushGoogle: async (p, b) => { calls.push(['google', p.passId, b]); },
    pushApple: async (serial) => { calls.push(['apple', serial]); return { attempted: 1, pushed: 1, skipped: 0, failed: 0 }; },
    ...over,
  };
}

describe('the pass figure is ONE formula', () => {
  it('cash + eGift + promo, two decimals', () => {
    expect(passBalanceIlsFromCents({ cashWalletBalanceCents: 4800, egiftBalanceCents: 1500, promoBalanceCents: 5 })).toBe('63.05');
    expect(passBalanceIlsFromCents({})).toBe('0.00');
  });
  it('pass-universal serves the same formula (no private copy left)', () => {
    const src = R('server/routes/pass-universal.ts');
    expect(src).toContain("import { lookupLivePassBalance } from '../services/walletPassSync'");
    expect(src).not.toMatch(/cashWalletBalanceCents:\s+walletAccounts\.cashWalletBalanceCents/);
  });
});

describe('syncPassForUser', () => {
  it('no pass row → no_pass, nothing written or pushed', async () => {
    const d = deps({ loadPass: async () => null });
    expect(await syncPassForUser('u1', 'credit_added', {}, d)).toEqual({ userId: 'u1', reason: 'credit_added', status: 'no_pass' });
    expect(d.calls).toEqual([]);
  });
  it('a non-ACTIVE pass is never pushed', async () => {
    const d = deps({ loadPass: async () => pass({ status: 'SUSPENDED' }) });
    expect((await syncPassForUser('u1', 'credit_added', {}, d)).status).toBe('no_pass');
    expect(d.calls).toEqual([]);
  });
  it('balance unchanged → unchanged, nothing written or pushed', async () => {
    const d = deps({ liveBalance: async () => ({ availableCreditIls: '120.00', loyaltyTier: null }) });
    const r = await syncPassForUser('u1', 'k9000_debit', {}, d);
    expect(r.status).toBe('unchanged');
    expect(d.calls).toEqual([]);
  });
  it('balance changed → row written FIRST, then Google, then Apple; result is truthful', async () => {
    const d = deps();
    const r = await syncPassForUser('u1', 'k9000_debit', {}, d);
    expect(r).toMatchObject({ status: 'synced', balanceBefore: '120.00', balanceAfter: '65.00', google: 'pushed' });
    expect(r.apple).toEqual({ attempted: 1, pushed: 1, skipped: 0, failed: 0 });
    expect(d.calls.map((c) => c[0])).toEqual(['save', 'google', 'apple']);
    expect(d.calls[0]).toEqual(['save', 'u1', '65.00']);
    expect(d.calls[2]).toEqual(['apple', 'PW-1111-2222']);
  });
  it('Google not configured → row still written, Apple still pushed, google reported "skipped" (never "pushed")', async () => {
    const d = deps({ googleConfigured: () => false });
    const r = await syncPassForUser('u1', 'egift_purchase', {}, d);
    expect(r.google).toBe('skipped');
    expect(d.calls.map((c) => c[0])).toEqual(['save', 'apple']);
  });
  it('Google push throws → reported "failed", Apple still attempted', async () => {
    const d = deps({ pushGoogle: async () => { throw new Error('boom'); } });
    const r = await syncPassForUser('u1', 'egift_purchase', {}, d);
    expect(r.google).toBe('failed');
    expect(d.calls.map((c) => c[0])).toEqual(['save', 'apple']);
  });
  it('APNs not configured is reported as skipped with a reason — never as pushed', async () => {
    const d = deps({ pushApple: async () => ({ attempted: 0, pushed: 0, skipped: 2, failed: 0, reason: 'APNS_NOT_CONFIGURED' }) });
    const r = await syncPassForUser('u1', 'credit_added', {}, d);
    expect(r.apple?.pushed).toBe(0);
    expect(r.apple?.reason).toBe('APNS_NOT_CONFIGURED');
  });
  it('force → pushes even when the balance is unchanged (manual / reissue)', async () => {
    const d = deps({ liveBalance: async () => ({ availableCreditIls: '120.00', loyaltyTier: null }) });
    expect((await syncPassForUser('u1', 'manual', { force: true }, d)).status).toBe('synced');
  });
});

describe('schedulePassSync is fire-and-forget and debounced per member', () => {
  it('a burst of writes for one member collapses to one pending sync; null user is a no-op', () => {
    const before = pendingPassSyncCount();
    schedulePassSync(null, 'credit_added');
    schedulePassSync(undefined, 'credit_added');
    expect(pendingPassSyncCount()).toBe(before);
    schedulePassSync('burst-user', 'credit_added');
    schedulePassSync('burst-user', 'k9000_debit');
    schedulePassSync('burst-user', 'booking_debit');
    expect(pendingPassSyncCount()).toBe(before + 1);
  });
});

describe('APNs token', () => {
  it('not configured without all four env vars', () => {
    const saved = { ...process.env };
    delete process.env.APPLE_APNS_KEY; delete process.env.APPLE_APNS_KEY_ID; delete process.env.APPLE_TEAM_ID; delete process.env.APPLE_PASS_TYPE_ID;
    expect(apnsConfigured()).toBe(false);
    process.env = saved;
  });
  it('signs an ES256 JWT with the p8 key (header kid + team iss), no dependency', () => {
    const { generateKeyPairSync, createPublicKey, verify } = require('crypto');
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const saved = { ...process.env };
    process.env.APPLE_APNS_KEY = pem; process.env.APPLE_APNS_KEY_ID = 'ABC123DEFG'; process.env.APPLE_TEAM_ID = 'U22NC3Q5Z4'; process.env.APPLE_PASS_TYPE_ID = 'pass.com.petwash.il';
    const token = buildApnsJwt(Date.now() + 3_600_000); // fresh cache slot
    const [h, c, s] = token.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'ABC123DEFG' });
    expect(JSON.parse(Buffer.from(c, 'base64url').toString()).iss).toBe('U22NC3Q5Z4');
    const ok = verify('sha256', Buffer.from(`${h}.${c}`), { key: createPublicKey(privateKey), dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
    expect(ok).toBe(true);
    process.env = saved;
  });
});

describe('every value-moving wallet writer schedules a sync (pins)', () => {
  it('WalletService: addCredits, confirmRedemption, refundRedemption, adminInjectCredits, debitBookingFromHold, refundBookingWallet', () => {
    const src = R('server/services/WalletService.ts');
    for (const reason of ['credit_added', 'redemption_confirmed', 'redemption_refunded', 'admin_injection', 'booking_debit', 'booking_refund']) {
      expect(src, reason).toContain(`schedulePassSync(`);
      expect(src, reason).toContain(`'${reason}'`);
    }
  });
  it('K9000RedemptionService: debitAndLog + autoCompensateSession', () => {
    const src = R('server/services/K9000RedemptionService.ts');
    expect(src).toContain("schedulePassSync(userId, 'k9000_debit')");
    expect(src).toContain("schedulePassSync(session.userId, 'k9000_compensation')");
  });
  it('EgiftFinancialService: purchase + redeem', () => {
    const src = R('server/services/EgiftFinancialService.ts');
    expect(src).toContain("schedulePassSync(input.userId, 'egift_purchase')");
    expect(src).toContain("schedulePassSync(input.userId, 'egift_redeem')");
  });
  it('the 2-minute sweep is scheduled for every writer that was not hooked', () => {
    const src = R('server/backgroundJobs.ts');
    expect(src).toContain("cron.schedule('*/2 * * * *'");
    expect(src).toContain('sweepStalePasses');
  });
  it('Apple web service: passesUpdatedSince is honoured and Last-Modified is the pass row time (no more "everything changed, now")', () => {
    const src = R('server/routes/pass-universal.ts');
    expect(src).toContain('req.query.passesUpdatedSince');
    expect(src).toContain("res.setHeader('Last-Modified', new Date(passUpdatedAt).toUTCString())");
    expect(src).not.toContain("lastUpdated:   new Date().toISOString()");
  });
});
