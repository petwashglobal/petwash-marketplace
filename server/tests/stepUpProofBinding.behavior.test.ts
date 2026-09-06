/**
 * The purpose-bound step-up proof (CEO verification directive §7-8).
 *
 * StepUpService already existed and was sound: HMAC-signed, (uid, purpose)
 * bound, 5-minute TTL, fail-closed on a missing secret. What it could not do
 * is the thing §8 requires — "a payout proof must not authorize refund,
 * wallet adjustment, bank change, or arbitrary later payout".
 *
 * A proof bound only to (uid, 'change_payout') says "this person, for payout
 * things, for five minutes". That authorises ANY payout, at ANY amount, to
 * ANY destination, for the whole window. These tests pin the narrowing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisStore = new Map<string, string>();
let redisUp = true;
vi.mock('../services/redis', () => ({
  redis: {
    isConnected: () => redisUp,
    async setNx(key: string) {
      if (!redisUp) return false;
      if (redisStore.has(key)) return false;
      redisStore.set(key, '1');
      return true;
    },
  },
}));

process.env.STEP_UP_HMAC_SECRET = 'a'.repeat(48);

const {
  issueStepUpProof,
  verifyStepUpProof,
  decodeStepUpProof,
  consumeStepUpProof,
  authoriseMoneyAction,
  STEP_UP_PURPOSES,
} = await import('../services/StepUpService');

const UID = 'uid_alice';
const PAYOUT = { operation: 'payout.execute', targetId: 'po_123', amountMinor: 4200 };

beforeEach(() => {
  redisStore.clear();
  redisUp = true;
});

describe('binding — a money proof authorises ONE action', () => {
  it('verifies against the exact operation, target and amount', () => {
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    expect(p).toBeTruthy();
    expect(verifyStepUpProof(UID, 'payout_action', p.token, PAYOUT)).toBe(true);
  });

  it('does NOT authorise a different payout', () => {
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    expect(verifyStepUpProof(UID, 'payout_action', p.token, { ...PAYOUT, targetId: 'po_999' })).toBe(false);
  });

  it('does NOT authorise a different AMOUNT for the same payout', () => {
    // The single most valuable thing to bind: 42.00 must not become 4200.00.
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    expect(verifyStepUpProof(UID, 'payout_action', p.token, { ...PAYOUT, amountMinor: 420000 })).toBe(false);
  });

  it('does NOT authorise a different operation on the same target', () => {
    // e.g. a refund against the payout the customer approved.
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    expect(verifyStepUpProof(UID, 'payout_action', p.token, { ...PAYOUT, operation: 'refund.execute' })).toBe(false);
  });

  it('a bound proof cannot be presented as an unbound one', () => {
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    expect(verifyStepUpProof(UID, 'payout_action', p.token)).toBe(false);
  });

  it('an unbound proof cannot satisfy a bound check', () => {
    const p = issueStepUpProof(UID, 'change_email', 300)!;
    expect(verifyStepUpProof(UID, 'change_email', p.token, PAYOUT)).toBe(false);
  });

  it('still refuses a different uid and a different purpose', () => {
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    expect(verifyStepUpProof('uid_mallory', 'payout_action', p.token, PAYOUT)).toBe(false);
    expect(verifyStepUpProof(UID, 'change_payout', p.token, PAYOUT)).toBe(false);
  });
});

describe('a money proof cannot be minted broad', () => {
  it('refuses to issue an UNBOUND payout_action proof at all', () => {
    // Not "issues one that fails later" — never mints it. A future caller
    // cannot get a blank cheque by forgetting an argument.
    expect(issueStepUpProof(UID, 'payout_action', 300)).toBeNull();
  });

  it('refuses to issue an unbound change_payout proof', () => {
    expect(issueStepUpProof(UID, 'change_payout', 300)).toBeNull();
  });

  it('refuses an incomplete binding', () => {
    expect(issueStepUpProof(UID, 'payout_action', 300, { operation: 'payout.execute', targetId: '' })).toBeNull();
  });

  it('identity purposes may still be unbound — there is no target to bind to', () => {
    expect(issueStepUpProof(UID, 'change_email', 300)).not.toBeNull();
    expect(issueStepUpProof(UID, 'delete_account', 300)).not.toBeNull();
  });
});

describe('one-use — TTL alone is not enough for money', () => {
  it('the first consumption wins and the second is refused', async () => {
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    const decoded = decodeStepUpProof(UID, 'payout_action', p.token, PAYOUT)!;
    expect(await consumeStepUpProof(decoded)).toBe(true);
    expect(await consumeStepUpProof(decoded)).toBe(false);
  });

  it('authoriseMoneyAction is single-shot end to end', async () => {
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    const args = { uid: UID, purpose: 'payout_action' as const, token: p.token, ...PAYOUT };
    expect(await authoriseMoneyAction(args)).toEqual({ ok: true });
    expect(await authoriseMoneyAction(args)).toEqual({ ok: false, reason: 'ALREADY_CONSUMED' });
  });

  it('a wrong binding is refused BEFORE anything is burned', async () => {
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    const bad = await authoriseMoneyAction({
      uid: UID, purpose: 'payout_action', token: p.token, ...PAYOUT, targetId: 'po_999',
    });
    expect(bad).toEqual({ ok: false, reason: 'INVALID_PROOF' });
    // The real one still works — a failed attempt must not spend the proof.
    expect(await authoriseMoneyAction({ uid: UID, purpose: 'payout_action', token: p.token, ...PAYOUT })).toEqual({ ok: true });
  });

  it('FAILS CLOSED when Redis is unavailable', async () => {
    // A money proof whose replay status cannot be established is not a proof.
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    redisUp = false;
    expect(await authoriseMoneyAction({ uid: UID, purpose: 'payout_action', token: p.token, ...PAYOUT }))
      .toEqual({ ok: false, reason: 'ALREADY_CONSUMED' });
  });

  it('an expired proof cannot be consumed', async () => {
    const p = issueStepUpProof(UID, 'payout_action', 30, PAYOUT)!;
    const decoded = decodeStepUpProof(UID, 'payout_action', p.token, PAYOUT)!;
    expect(await consumeStepUpProof({ ...decoded, expiresAt: Math.floor(Date.now() / 1000) - 1 })).toBe(false);
  });
});

describe('the proof itself leaks nothing', () => {
  it('carries no OTP and no raw target in the token body', () => {
    const p = issueStepUpProof(UID, 'payout_action', 300, PAYOUT)!;
    const body = Buffer.from(p.token.split('.')[0], 'base64url').toString('utf8');
    expect(body).not.toContain('po_123');
    expect(body).not.toContain('payout.execute');
    expect(body).not.toContain('4200');
  });

  it('exposes a jti so issuance and consumption can be matched in the audit log', () => {
    const p = issueStepUpProof(UID, 'change_email', 300)!;
    expect(typeof p.jti).toBe('string');
    expect(p.jti.length).toBeGreaterThan(8);
  });
});

describe('v1 tokens', () => {
  it('still verify for the identity purposes they were issued for', () => {
    // Nothing already issued may break.
    const secret = process.env.STEP_UP_HMAC_SECRET!;
    const { createHmac } = require('node:crypto');
    const now = Math.floor(Date.now() / 1000);
    const payload = ['v1', UID, 'change_email', String(now), String(now + 300), 'noncenonce'].join('.');
    const mac = createHmac('sha256', secret).update(payload, 'utf8').digest().toString('base64url');
    const token = `${Buffer.from(payload, 'utf8').toString('base64url')}.${mac}`;
    expect(verifyStepUpProof(UID, 'change_email', token)).toBe(true);
  });

  it('can NEVER satisfy a money purpose — v1 has no binding field', () => {
    const secret = process.env.STEP_UP_HMAC_SECRET!;
    const { createHmac } = require('node:crypto');
    const now = Math.floor(Date.now() / 1000);
    const payload = ['v1', UID, 'payout_action', String(now), String(now + 300), 'noncenonce'].join('.');
    const mac = createHmac('sha256', secret).update(payload, 'utf8').digest().toString('base64url');
    const token = `${Buffer.from(payload, 'utf8').toString('base64url')}.${mac}`;
    expect(verifyStepUpProof(UID, 'payout_action', token, PAYOUT)).toBe(false);
  });
});

describe('the purpose set stays deliberate', () => {
  it('separates rebinding WHERE money goes from executing a payout', () => {
    expect(STEP_UP_PURPOSES).toContain('change_payout');
    expect(STEP_UP_PURPOSES).toContain('payout_action');
  });
});
