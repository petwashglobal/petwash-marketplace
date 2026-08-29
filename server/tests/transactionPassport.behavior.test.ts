/**
 * TransactionPassport — behavior pins
 * (business doctrine §13, §43, §47, §48, §50).
 */
import { describe, it, expect } from 'vitest';
import {
  makeJobRef,
  appendAuditEvent,
  hasActorWithRole,
  receiptOwnerUid,
  providerEarningsUid,
  type TransactionPassport,
} from '../../shared/marketplace/transactionPassport';

function base(over: Partial<TransactionPassport> = {}): TransactionPassport {
  return {
    transactionId: 'tx_001',
    jobRef: 'PW-BKG-ABCD1234',
    correlationId: 'corr_1',
    domain: 'BOOKING',
    actors: [
      { uid: 'sarah', role: 'BOOKER' },
      { uid: 'maya', role: 'PROVIDER' },
    ],
    reference: 'bkg_123',
    documents: [],
    fulfillment: { status: 'NOT_STARTED' },
    auditEvents: [],
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...over,
  };
}

describe('makeJobRef (§48 human-readable ids)', () => {
  it('bookings prefix PW-BKG-', () => {
    expect(makeJobRef('BOOKING', 'abc-1234-XYZ!')).toMatch(/^PW-BKG-[A-Z0-9]{1,8}$/);
  });

  it('other domains use their canonical prefixes', () => {
    expect(makeJobRef('SHOP', 'ord_9999')).toMatch(/^PW-SHOP-ORD9999$/);
    expect(makeJobRef('K9000', 'stn_777')).toMatch(/^PW-K9K-STN777$/);
    expect(makeJobRef('EGIFT', 'gift-42')).toMatch(/^PW-EGIFT-GIFT42$/);
    expect(makeJobRef('WALLET', 'walx1')).toMatch(/^PW-WAL-WALX1$/);
    expect(makeJobRef('REFUND', 'r-1')).toMatch(/^PW-REF-R1$/);
  });

  it('trims non-alphanumerics + uppercases', () => {
    expect(makeJobRef('BOOKING', 'ab!@#c')).toMatch(/^PW-BKG-ABC$/);
  });
});

describe('appendAuditEvent (§50 append-only discipline)', () => {
  it('returns a NEW passport with the event appended — does not mutate input', () => {
    const p = base();
    const next = appendAuditEvent(p, {
      eventId: 'evt_1',
      actorUid: 'sarah',
      eventType: 'BOOKING_REQUEST_SUBMIT',
      at: '2026-08-02T00:00:00Z',
    });
    expect(next).not.toBe(p);
    expect(p.auditEvents).toHaveLength(0);
    expect(next.auditEvents).toHaveLength(1);
    expect(next.auditEvents[0].eventType).toBe('BOOKING_REQUEST_SUBMIT');
  });

  it('inherits correlationId from the passport when the event does not carry one', () => {
    const p = base();
    const next = appendAuditEvent(p, {
      eventId: 'evt_1',
      actorUid: 'sarah',
      eventType: 'BOOKING_ACCEPT',
      at: '2026-08-02T00:00:00Z',
    });
    expect(next.auditEvents[0].correlationId).toBe('corr_1');
  });

  it('respects an explicit correlationId when provided', () => {
    const p = base();
    const next = appendAuditEvent(p, {
      eventId: 'evt_1',
      actorUid: 'sarah',
      eventType: 'BOOKING_ACCEPT',
      at: '2026-08-02T00:00:00Z',
      correlationId: 'corr_override',
    });
    expect(next.auditEvents[0].correlationId).toBe('corr_override');
  });

  it('updates updatedAt to the event timestamp', () => {
    const p = base();
    const at = '2026-09-15T10:00:00Z';
    const next = appendAuditEvent(p, {
      eventId: 'evt_2',
      actorUid: 'maya',
      eventType: 'BOOKING_COMPLETE_JOB',
      at,
    });
    expect(next.updatedAt).toBe(at);
  });
});

describe('actor-role helpers', () => {
  it('hasActorWithRole finds BOOKER + PROVIDER on a booking passport', () => {
    const p = base();
    expect(hasActorWithRole(p, 'BOOKER')).toBe(true);
    expect(hasActorWithRole(p, 'PROVIDER')).toBe(true);
    expect(hasActorWithRole(p, 'BUYER')).toBe(false);
  });

  it('receiptOwnerUid returns BUYER on a SHOP passport (§43 buyer holds receipt)', () => {
    const p = base({
      domain: 'SHOP',
      actors: [
        { uid: 'sarah', role: 'BUYER' },
        { uid: 'petwash', role: 'MERCHANT' },
      ],
    });
    expect(receiptOwnerUid(p)).toBe('sarah');
  });

  it('receiptOwnerUid returns BOOKER on a BOOKING passport (booking receipt owner)', () => {
    expect(receiptOwnerUid(base())).toBe('sarah');
  });

  it('receiptOwnerUid returns null when no BUYER + no BOOKER (safety)', () => {
    const p = base({
      domain: 'WALLET',
      actors: [{ uid: 'petwash', role: 'MERCHANT' }],
    });
    expect(receiptOwnerUid(p)).toBeNull();
  });

  it('providerEarningsUid returns PROVIDER on a BOOKING passport (§47 provider surface uses PROVIDER)', () => {
    expect(providerEarningsUid(base())).toBe('maya');
  });

  it('providerEarningsUid returns null on a SHOP passport (customer receipts NEVER surface in provider earnings)', () => {
    const p = base({ domain: 'SHOP', actors: [{ uid: 'sarah', role: 'BUYER' }] });
    expect(providerEarningsUid(p)).toBeNull();
  });
});

describe('eGift buyer vs recipient discipline (§43)', () => {
  it('an eGift passport can carry BUYER + RECIPIENT and both are addressable', () => {
    const p = base({
      domain: 'EGIFT',
      actors: [
        { uid: 'sarah', role: 'BUYER' },
        { uid: 'david', role: 'RECIPIENT' },
      ],
    });
    // Receipt goes to the buyer.
    expect(receiptOwnerUid(p)).toBe('sarah');
    // Recipient participates but does not hold the receipt.
    expect(hasActorWithRole(p, 'RECIPIENT')).toBe(true);
  });
});
