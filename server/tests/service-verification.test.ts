/**
 * Service-handoff verification tests: right-person checks (code + last-4),
 * conduct acknowledgment per jurisdiction, code crypto, and the hash-chained
 * ("blockchain-style") check-in ledger detecting tampering.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  isCodeFormatValid, last4, verifyLast4, canAttempt, conductAcknowledgmentText, resolveJurisdiction,
} from '../../shared/service-verification';
import {
  generateVerificationCode, hashCode, newSalt, verifyCodeHash, chainHash, verifyChain, type ChainRow,
} from '../lib/serviceVerificationCrypto';

const ROOT = resolve(__dirname, '..', '..');
const src = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('right-person verification', () => {
  it('accepts a 6-digit code format, rejects others', () => {
    expect(isCodeFormatValid('048273')).toBe(true);
    expect(isCodeFormatValid('1234')).toBe(false);
    expect(isCodeFormatValid('abcdef')).toBe(false);
  });
  it('last-4-of-mobile matches the registered phone', () => {
    expect(last4('+972 54-983-3355')).toBe('3355');
    expect(verifyLast4('3355', '+972549833355')).toBe(true);
    expect(verifyLast4('0000', '+972549833355')).toBe(false);
  });
  it('caps attempts (anti-brute-force)', () => {
    expect(canAttempt(4)).toBe(true);
    expect(canAttempt(5)).toBe(false);
  });
});

describe('conduct acknowledgment (jurisdiction-aware)', () => {
  it('Israel references Israeli law + the firm anti-theft line', () => {
    const t = conductAcknowledgmentText('IL');
    expect(t).toMatch(/State of Israel/);
    expect(t).toMatch(/Theft or wilful damage is a crime/);
    expect(t).toMatch(/lights and air-conditioning/);
    expect(t).toMatch(/Water the plants/);
  });
  it('Greece-ready', () => {
    expect(resolveJurisdiction('GR').name).toBe('Greece');
    expect(conductAcknowledgmentText('GR')).toMatch(/Hellenic Republic/);
  });
  it('defaults to Israel for unknown country', () => {
    expect(resolveJurisdiction('ZZ').code).toBe('IL');
  });
});

describe('code crypto (stored hashed only)', () => {
  it('generates a 6-digit code', () => expect(generateVerificationCode()).toMatch(/^\d{6}$/));
  it('verifies the right code and rejects the wrong one (constant-time)', () => {
    const salt = newSalt();
    const h = hashCode('048273', salt);
    expect(verifyCodeHash('048273', salt, h)).toBe(true);
    expect(verifyCodeHash('000000', salt, h)).toBe(false);
  });
});

describe('hash-chained check-in ledger (tamper-evident)', () => {
  const ev = (over: Partial<Omit<ChainRow, 'prevHash' | 'hash'>>) => ({
    bookingId: 'bkg1', eventType: 'check_in' as const, method: 'code', actorId: 'p1',
    conductAck: true, at: '2026-06-18T09:00:00.000Z', ...over,
  });
  const build = (inputs: Array<Omit<ChainRow, 'prevHash' | 'hash'>>): ChainRow[] => {
    const out: ChainRow[] = []; let prev: string | null = null;
    for (const i of inputs) { const hash = chainHash(prev, i); out.push({ ...i, prevHash: prev, hash }); prev = hash; }
    return out;
  };
  it('a clean chain verifies', () => {
    const chain = build([ev({}), ev({ eventType: 'check_out', at: '2026-06-18T11:00:00.000Z' })]);
    expect(verifyChain(chain)).toEqual({ ok: true });
  });
  it('editing a past event breaks the chain', () => {
    const chain = build([ev({}), ev({ eventType: 'check_out', at: '2026-06-18T11:00:00.000Z' })]);
    chain[0].actorId = 'attacker';          // tamper after the fact
    expect(verifyChain(chain).ok).toBe(false);
  });
});

describe('service enforces conduct ack + attempt cap (source-introspection)', () => {
  const svc = src('server/services/serviceVerificationService.ts');
  it('check-in requires the conduct acknowledgment', () => {
    expect(svc).toMatch(/conductAck/);
    expect(svc).toMatch(/CONDUCT_ACK_REQUIRED/);
  });
  it('failed attempts increment + are capped', () => {
    expect(svc).toMatch(/attempts: v\.attempts \+ 1/);
    expect(svc).toMatch(/TOO_MANY_ATTEMPTS/);
  });
});
