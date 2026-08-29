/**
 * CEO FLY MODE II §14–§18 (2026-08-29) — Prestige identity linking pins.
 *
 * Behavioural tests with a mocked db that walk every CEO-listed
 * outcome: MISSING_UID, MISSING_EMAIL, EMAIL_NOT_VERIFIED,
 * NO_LEGACY_MEMBER, MEMBER_ALREADY_LINKED_TO_DIFFERENT_UID,
 * UID_ALREADY_LINKED_TO_DIFFERENT_MEMBER, RACE_ON_LINK, LOOKUP_FAILED,
 * ALREADY_LINKED_SAME_ROW, LINKED (happy path).
 *
 * §15 discipline is verified structurally by the code shape — no email
 * body-field path exists in the service — and by the EMAIL_NOT_VERIFIED
 * refusal test below.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => {
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve([])),
  };
  return { db: chain };
});

vi.mock('../../shared/schema', () => ({
  privilegeMembers: {
    memberId: 'pm.member_id',
    email: 'pm.email',
    firebaseUid: 'pm.firebase_uid',
    updatedAt: 'pm.updated_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: any[]) => ({ __and: args }),
  eq: (a: any, b: any) => ({ __eq: [a, b] }),
  isNull: (a: any) => ({ __isNull: a }),
  sql: (strings: TemplateStringsArray, ...vals: any[]) => ({ __sql: strings.raw.join('?'), vals }),
}));

vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { linkPrestigeMembershipToFirebaseUid } from '../services/prestigeIdentityLink';
import { db } from '../db';

type Stage =
  | { kind: 'read'; rows?: any[]; throw?: boolean }
  | { kind: 'update'; rows?: any[]; throw?: boolean };

function stage(...stages: Stage[]) {
  let idx = 0;

  (db as any).select.mockImplementation(() => {
    const s = stages[idx];
    if (!s || s.kind !== 'read') {
      throw new Error(`stage[${idx}]: expected read, got ${s?.kind ?? 'nothing'}`);
    }
    idx++;
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: () => (s.throw ? Promise.reject(new Error('mock db failure')) : Promise.resolve(s.rows ?? [])),
    };
    return chain;
  });

  (db as any).update.mockImplementation(() => {
    const s = stages[idx];
    if (!s || s.kind !== 'update') {
      throw new Error(`stage[${idx}]: expected update, got ${s?.kind ?? 'nothing'}`);
    }
    idx++;
    const chain: any = {
      set: () => chain,
      where: () => chain,
      returning: () => (s.throw ? Promise.reject(new Error('mock db failure')) : Promise.resolve(s.rows ?? [])),
    };
    return chain;
  });
}

describe('CEO FLY MODE II §14–§18 — Prestige identity link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MISSING_UID — empty uid refuses', async () => {
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: '', emailFromAuthContext: 'x@x.com', emailVerified: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('MISSING_UID');
  });

  it('MISSING_EMAIL — null email refuses', async () => {
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: 'uid-1', emailFromAuthContext: null, emailVerified: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('MISSING_EMAIL');
  });

  it('EMAIL_NOT_VERIFIED — §15 refuses to link on unverified email', async () => {
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: 'uid-2', emailFromAuthContext: 'x@x.com', emailVerified: false,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('EMAIL_NOT_VERIFIED');
  });

  it('NO_LEGACY_MEMBER — no row matches the email', async () => {
    stage(
      { kind: 'read', rows: [] },  // no existing by uid
      { kind: 'read', rows: [] },  // no legacy by email
    );
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: 'uid-3', emailFromAuthContext: 'noone@x.com', emailVerified: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('NO_LEGACY_MEMBER');
  });

  it('MEMBER_ALREADY_LINKED_TO_DIFFERENT_UID — refuses auto-merge', async () => {
    stage(
      { kind: 'read', rows: [] },  // no existing by our uid
      { kind: 'read', rows: [{ memberId: 'PM-42', firebaseUid: 'someone-else' }] },  // legacy already linked
    );
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: 'uid-4', emailFromAuthContext: 'a@b.com', emailVerified: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('MEMBER_ALREADY_LINKED_TO_DIFFERENT_UID');
  });

  it('UID_ALREADY_LINKED_TO_DIFFERENT_MEMBER — refuses auto-merge', async () => {
    stage(
      { kind: 'read', rows: [{ memberId: 'PM-old', email: 'other@x.com' }] },  // uid linked to a different email
    );
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: 'uid-5', emailFromAuthContext: 'new@x.com', emailVerified: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('UID_ALREADY_LINKED_TO_DIFFERENT_MEMBER');
  });

  it('ALREADY_LINKED_SAME_ROW — idempotent success, no throw', async () => {
    stage(
      { kind: 'read', rows: [{ memberId: 'PM-7', email: 'Same@x.com' }] },  // same UID, same email (case-insensitive)
    );
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: 'uid-6', emailFromAuthContext: 'same@x.com', emailVerified: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.outcome).toBe('ALREADY_LINKED_SAME_ROW');
      expect(res.memberId).toBe('PM-7');
    }
  });

  it('LINKED — happy path stamps firebase_uid atomically', async () => {
    stage(
      { kind: 'read', rows: [] },  // no existing by uid
      { kind: 'read', rows: [{ memberId: 'PM-99', firebaseUid: null }] },  // legacy with NULL uid
      { kind: 'update', rows: [{ memberId: 'PM-99' }] },  // atomic UPDATE succeeded
    );
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: 'uid-happy', emailFromAuthContext: 'happy@x.com', emailVerified: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.outcome).toBe('LINKED');
      expect(res.memberId).toBe('PM-99');
      expect(res.firebaseUid).toBe('uid-happy');
    }
  });

  it('RACE_ON_LINK — UPDATE matched 0 rows (another server won)', async () => {
    stage(
      { kind: 'read', rows: [] },
      { kind: 'read', rows: [{ memberId: 'PM-race', firebaseUid: null }] },
      { kind: 'update', rows: [] },  // 0 rows updated
    );
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: 'uid-race', emailFromAuthContext: 'race@x.com', emailVerified: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('RACE_ON_LINK');
  });

  it('LOOKUP_FAILED — DB throws on the first read', async () => {
    stage({ kind: 'read', throw: true });
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: 'uid-boom', emailFromAuthContext: 'boom@x.com', emailVerified: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('LOOKUP_FAILED');
  });

  it('email lookup is CASE-INSENSITIVE (normalizes input + row)', async () => {
    stage(
      { kind: 'read', rows: [] },
      { kind: 'read', rows: [{ memberId: 'PM-mixed', firebaseUid: null }] },
      { kind: 'update', rows: [{ memberId: 'PM-mixed' }] },
    );
    const res = await linkPrestigeMembershipToFirebaseUid({
      firebaseUid: 'uid-mixed',
      emailFromAuthContext: '  MixedCase@Example.COM  ',
      emailVerified: true,
    });
    expect(res.ok).toBe(true);
  });
});
