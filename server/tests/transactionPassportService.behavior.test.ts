/**
 * TransactionPassportService — Program 12 (shape + in-memory source).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryPassportSource,
  loadPassport,
  type PassportRecord,
} from '../services/marketplace/TransactionPassportService';

const source = new InMemoryPassportSource();

const sample: PassportRecord = {
  headEntityRef: { kind: 'booking', id: 'B-1' },
  actors: [
    { role: 'CUSTOMER', uid: 'sarah', displayCode: 'CUSTOMER_SELF' },
    { role: 'PROVIDER', uid: 'maya', displayCode: 'PROVIDER_NAME' },
    { role: 'SYSTEM', displayCode: 'PETWASH_SYSTEM' },
  ],
  events: [
    { code: 'BOOKING_REQUESTED', actor: { role: 'CUSTOMER', uid: 'sarah' }, at: '2026-08-30T09:00:00Z' },
    { code: 'BOOKING_ACCEPTED', actor: { role: 'PROVIDER', uid: 'maya' }, at: '2026-08-30T09:05:00Z' },
    { code: 'PAYMENT_CAPTURED', actor: { role: 'SYSTEM' }, at: '2026-08-30T09:05:30Z' },
  ],
  money: {
    legs: [{ code: 'PAY', amountCents: 15000, currency: 'ILS', labelCode: 'AMOUNT_PAID', timelineAt: '2026-08-30T09:05:30Z' }],
    totalCents: 15000,
  },
  documents: [{ documentId: 'D-42', kind: 'RECEIPT', externalUrl: 'https://sumit.co.il/doc/xyz' }],
  correlationIds: ['jobRef:JOB-B-1', 'transactionId:TX-42'],
};

beforeEach(() => source.clear());

describe('TransactionPassportService', () => {
  it('loadByKey booking → OK with the full passport', async () => {
    source.put({ kind: 'booking', value: 'B-1' }, sample);
    const out = await loadPassport({ kind: 'booking', value: 'B-1' }, source);
    expect(out.code).toBe('OK');
    if (out.code !== 'OK') throw new Error();
    expect(out.passport.headEntityRef).toEqual({ kind: 'booking', id: 'B-1' });
    expect(out.passport.actors).toHaveLength(3);
    expect(out.passport.events[0].code).toBe('BOOKING_REQUESTED');
    expect(out.passport.money.totalCents).toBe(15000);
  });

  it('loadByKey unknown → NOT_FOUND (never fabricates a passport)', async () => {
    const out = await loadPassport({ kind: 'booking', value: 'B-none' }, source);
    expect(out.code).toBe('NOT_FOUND');
  });

  it('cross-key lookup: same record indexed by both booking and jobRef', async () => {
    source.put({ kind: 'booking', value: 'B-1' }, sample);
    source.put({ kind: 'jobRef', value: 'JOB-B-1' }, sample);
    const a = await loadPassport({ kind: 'booking', value: 'B-1' }, source);
    const b = await loadPassport({ kind: 'jobRef', value: 'JOB-B-1' }, source);
    expect(a.code).toBe('OK');
    expect(b.code).toBe('OK');
    if (a.code !== 'OK' || b.code !== 'OK') throw new Error();
    expect(a.passport.headEntityRef.id).toBe(b.passport.headEntityRef.id);
  });

  it('correlationIds carry the transaction crossroads (jobRef + transactionId)', async () => {
    source.put({ kind: 'booking', value: 'B-1' }, sample);
    const out = await loadPassport({ kind: 'booking', value: 'B-1' }, source);
    if (out.code !== 'OK') throw new Error();
    expect(out.passport.correlationIds).toContain('jobRef:JOB-B-1');
    expect(out.passport.correlationIds).toContain('transactionId:TX-42');
  });

  it('a throwing source degrades to NOT_FOUND (no wire leaks)', async () => {
    const explosive = {
      loadByKey: () => { throw new Error('boom'); },
    };
    const out = await loadPassport({ kind: 'booking', value: 'B-1' }, explosive as any);
    expect(out.code).toBe('NOT_FOUND');
  });
});
