/**
 * lib/phoneClaim — a number held by a phone-only orphan is reclaimed for the
 * account that just proved possession of it; a number held by a real account
 * is not.
 *
 * CEO, 2026-09-10: +61… had been minted onto a phone-only account in March;
 * every attempt to add it to the real account answered "already in use".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ calls: [] as any[], owner: null as any, firstAttachFails: true, pgFails: false }));

vi.mock('../db', () => ({
  db: {
    update: () => ({ set: (v: any) => ({ where: async () => { h.calls.push(['pg-clear', v]); if (h.pgFails) throw new Error('pg down'); return []; } }) }),
  },
}));
vi.mock('../lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { claimVerifiedPhone, isReclaimableOrphan } from '../lib/phoneClaim';

const PHONE = '+61400000000';
const ME = 'me-uid';

function makeAuth() {
  let attaches = 0;
  return {
    updateUser: async (uid: string, props: any) => {
      h.calls.push(['updateUser', uid, props]);
      if (uid === ME && 'phoneNumber' in props) {
        attaches++;
        if (attaches === 1 && h.firstAttachFails) { const e: any = new Error('exists'); e.code = 'auth/phone-number-already-exists'; throw e; }
      }
      return {};
    },
    getUserByPhoneNumber: async () => { h.calls.push(['probe']); if (h.owner === 'throw') throw new Error('unreadable'); return h.owner; },
  };
}

describe('isReclaimableOrphan', () => {
  it('phone-only, no email, with positive provider evidence → orphan', () => {
    expect(isReclaimableOrphan({ uid: 'x', providerData: [{ providerId: 'phone' }] })).toBe(true);
  });
  it('missing or empty evidence is NOT an orphan — unknown owners are refused, never reclaimed', () => {
    expect(isReclaimableOrphan({ uid: 'x' })).toBe(false);
    expect(isReclaimableOrphan({ uid: 'x', providerData: [] })).toBe(false);
    expect(isReclaimableOrphan({ uid: 'x', providerData: [{}] })).toBe(false);
  });
  it('anything with an email or another provider → not an orphan', () => {
    expect(isReclaimableOrphan({ uid: 'x', email: 'a@b.c', providerData: [{ providerId: 'phone' }] })).toBe(false);
    expect(isReclaimableOrphan({ uid: 'x', providerData: [{ providerId: 'phone' }, { providerId: 'google.com' }] })).toBe(false);
    expect(isReclaimableOrphan({ uid: 'x', providerData: [{ providerId: 'password' }] })).toBe(false);
  });
});

describe('claimVerifiedPhone', () => {
  beforeEach(() => { h.calls = []; h.owner = null; h.firstAttachFails = true; h.pgFails = false; });

  it('attaches directly when the number is free', async () => {
    h.firstAttachFails = false;
    expect(await claimVerifiedPhone(makeAuth(), ME, PHONE)).toBe('attached');
    expect(h.calls).toEqual([['updateUser', ME, { phoneNumber: PHONE }]]);
  });

  it('reclaims from a phone-only orphan: release → disable → clear mirror → attach', async () => {
    h.owner = { uid: 'orphan-uid', providerData: [{ providerId: 'phone' }], metadata: { creationTime: '2026-03-28' } };
    expect(await claimVerifiedPhone(makeAuth(), ME, PHONE)).toBe('reclaimed_from_orphan');
    const seq = h.calls.map((c) => (c[0] === 'updateUser' ? `${c[1]}:${Object.keys(c[2])[0]}` : c[0]));
    expect(seq).toEqual([`${ME}:phoneNumber`, 'probe', 'orphan-uid:phoneNumber', 'orphan-uid:disabled', 'pg-clear', `${ME}:phoneNumber`]);
    expect(h.calls.find((c) => c[0] === 'pg-clear')![1]).toMatchObject({ phone: null, phoneVerified: false });
  });

  it('a real account keeps its number — nothing is mutated', async () => {
    h.owner = { uid: 'real-uid', email: 'someone@example.com', providerData: [{ providerId: 'phone' }] };
    expect(await claimVerifiedPhone(makeAuth(), ME, PHONE)).toBe('in_use_by_other');
    expect(h.calls.filter((c) => c[0] === 'updateUser' && c[1] === 'real-uid')).toHaveLength(0);
    expect(h.calls.filter((c) => c[0] === 'pg-clear')).toHaveLength(0);
  });

  it('our own number → already_ours', async () => {
    h.owner = { uid: ME, providerData: [{ providerId: 'phone' }] };
    expect(await claimVerifiedPhone(makeAuth(), ME, PHONE)).toBe('already_ours');
  });

  it('an unreadable probe establishes nothing → unresolved, no mutation', async () => {
    h.owner = 'throw';
    expect(await claimVerifiedPhone(makeAuth(), ME, PHONE)).toBe('unresolved');
    expect(h.calls.filter((c) => c[0] === 'updateUser')).toHaveLength(1);
  });

  it('a Postgres mirror failure does not block the reclaim (Firebase owns identity)', async () => {
    h.owner = { uid: 'orphan-uid', providerData: [{ providerId: 'phone' }] };
    h.pgFails = true;
    expect(await claimVerifiedPhone(makeAuth(), ME, PHONE)).toBe('reclaimed_from_orphan');
  });
});
