/**
 * HandoffService — CEO NEXT-AUTO §8 verified-code handshake.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  issueHandoffCode,
  verifyHandoffCode,
  getHandoffRecord,
  _resetHandoffStoreForTests,
} from '../services/marketplace/HandoffService';

beforeEach(() => _resetHandoffStoreForTests());

describe('issue', () => {
  it('returns a 6-digit code + a record with the code hashed (never stored plain)', () => {
    const r = issueHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', issuerUid: 'maya', verifierUid: 'sarah' });
    expect(r.code).toBe('CODE_ISSUED');
    expect(r.handoffCode).toMatch(/^\d{6}$/);
    // The response record does NOT echo the plain code.
    expect(r.record!.code).toBe('');
    expect(r.record!.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.record!.status).toBe('PENDING');
  });

  it('self-handoff blocked', () => {
    const r = issueHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', issuerUid: 'nir', verifierUid: 'nir' });
    expect(r.code).toBe('SELF_HANDOFF_BLOCKED');
  });
});

describe('verify', () => {
  it('correct code + correct verifier → CODE_VERIFIED and record is single-use', () => {
    const issued = issueHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', issuerUid: 'maya', verifierUid: 'sarah' });
    const r = verifyHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', actorUid: 'sarah', code: issued.handoffCode! });
    expect(r.code).toBe('CODE_VERIFIED');
    expect(r.record!.verifiedBy).toBe('sarah');
    // Second attempt fails — the code is single-use.
    const r2 = verifyHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', actorUid: 'sarah', code: issued.handoffCode! });
    expect(r2.code).toBe('CODE_ALREADY_USED');
  });

  it('wrong code → CODE_INVALID', () => {
    issueHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', issuerUid: 'maya', verifierUid: 'sarah' });
    const r = verifyHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', actorUid: 'sarah', code: '000000' });
    expect(r.code).toBe('CODE_INVALID');
  });

  it('wrong verifier → ACTOR_NOT_VERIFIER (never leaks whether the code was right)', () => {
    const issued = issueHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', issuerUid: 'maya', verifierUid: 'sarah' });
    const r = verifyHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', actorUid: 'nir', code: issued.handoffCode! });
    expect(r.code).toBe('ACTOR_NOT_VERIFIER');
  });

  it('no code issued → NO_CODE_ISSUED', () => {
    const r = verifyHandoffCode({ bookingId: 'B-99', phase: 'PICKUP', actorUid: 'sarah', code: '123456' });
    expect(r.code).toBe('NO_CODE_ISSUED');
  });

  it('expired code → CODE_EXPIRED', () => {
    const past = Date.now() - 30 * 60 * 1000;
    const issued = issueHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', issuerUid: 'maya', verifierUid: 'sarah', now: past });
    const r = verifyHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', actorUid: 'sarah', code: issued.handoffCode! });
    expect(r.code).toBe('CODE_EXPIRED');
  });
});

describe('PICKUP and RETURN are independent (§11 per-phase evidence)', () => {
  it('one PICKUP verification does not verify RETURN', () => {
    const p = issueHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', issuerUid: 'maya', verifierUid: 'sarah' });
    verifyHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', actorUid: 'sarah', code: p.handoffCode! });
    // RETURN has no issued code yet.
    const r = verifyHandoffCode({ bookingId: 'B-1', phase: 'RETURN', actorUid: 'maya', code: p.handoffCode! });
    expect(r.code).toBe('NO_CODE_ISSUED');
  });

  it('RETURN is customer→provider (roles swap): customer issues, provider verifies', () => {
    const r = issueHandoffCode({ bookingId: 'B-1', phase: 'RETURN', issuerUid: 'sarah', verifierUid: 'maya' });
    const v = verifyHandoffCode({ bookingId: 'B-1', phase: 'RETURN', actorUid: 'maya', code: r.handoffCode! });
    expect(v.code).toBe('CODE_VERIFIED');
  });
});

describe('read', () => {
  it('getHandoffRecord returns the record without the plain code', () => {
    const r = issueHandoffCode({ bookingId: 'B-1', phase: 'PICKUP', issuerUid: 'maya', verifierUid: 'sarah' });
    const got = getHandoffRecord('B-1', 'PICKUP');
    expect(got!.code).toBe('');
    expect(got!.codeHash).toBe(r.record!.codeHash);
  });
});
