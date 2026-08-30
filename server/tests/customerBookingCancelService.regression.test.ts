/**
 * CustomerBookingCancelService — CEO NEXT-AUTO §1 (unpaid cancel).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  evaluateCustomerCancelUnpaid,
  type CustomerCancelInput,
} from '../services/marketplace/CustomerBookingCancelService';

const ROUTES = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');

function inp(over: Partial<CustomerCancelInput> = {}): CustomerCancelInput {
  return {
    bookingId: 'B-1',
    actorUid: 'sarah',
    snapshot: {
      bookerUid: 'sarah',
      status: 'REQUESTED',
      hasMoneyCaptured: false,
    },
    ...over,
  };
}

describe('unpaid cancel — happy path', () => {
  it.each(['requested', 'REQUESTED', 'awaiting_provider', 'quoted', 'pending'])(
    'status %s + no money → CANCELLED_UNPAID',
    (status) => {
      const r = evaluateCustomerCancelUnpaid(inp({ snapshot: { bookerUid: 'sarah', status, hasMoneyCaptured: false } }));
      expect(r.code).toBe('CANCELLED_UNPAID');
      expect(r.suggestedNext).toBe('FIND_ALTERNATIVES');
    },
  );
});

describe('paid guard — never allow unpaid path when money captured', () => {
  it('hasMoneyCaptured=true → PAID_MUST_USE_PAID_CANCEL + suggested USE_PAID_CANCEL', () => {
    const r = evaluateCustomerCancelUnpaid(inp({ snapshot: { bookerUid: 'sarah', status: 'REQUESTED', hasMoneyCaptured: true } }));
    expect(r.code).toBe('PAID_MUST_USE_PAID_CANCEL');
    expect(r.suggestedNext).toBe('USE_PAID_CANCEL');
  });
});

describe('actor guard — customer must BE the booker', () => {
  it('actorUid !== bookerUid → ACTOR_NOT_BOOKER', () => {
    const r = evaluateCustomerCancelUnpaid(inp({ actorUid: 'nir', snapshot: { bookerUid: 'sarah', status: 'REQUESTED', hasMoneyCaptured: false } }));
    expect(r.code).toBe('ACTOR_NOT_BOOKER');
  });
});

describe('terminal state guard', () => {
  it.each(['completed', 'cancelled', 'in_progress', 'accepted', 'declined'])(
    'status %s → BOOKING_NOT_CANCELLABLE',
    (status) => {
      const r = evaluateCustomerCancelUnpaid(inp({ snapshot: { bookerUid: 'sarah', status, hasMoneyCaptured: false } }));
      expect(r.code).toBe('BOOKING_NOT_CANCELLABLE');
    },
  );
});

describe('Action Brain wire (routes.ts)', () => {
  it('impact resolver + handler both registered', () => {
    expect(ROUTES).toMatch(/actionBrainImpactResolvers\.set\('CUSTOMER_CANCEL_BOOKING_UNPAID'/);
    expect(ROUTES).toMatch(/actionBrainHandlers\.set\('CUSTOMER_CANCEL_BOOKING_UNPAID'/);
  });

  it('handler delegates to evaluateCustomerCancelUnpaid — no inline UPDATE bookings', () => {
    const idx = ROUTES.indexOf("actionBrainHandlers.set('CUSTOMER_CANCEL_BOOKING_UNPAID'");
    // The handler body includes a switch across ~10 cases; scan a
    // generous window so the assertions can see every case block.
    const body = ROUTES.slice(idx, idx + 3000);
    expect(body).toMatch(/evaluateCustomerCancelUnpaid/);
    expect(body).not.toMatch(/UPDATE bookings/i);
    expect(body).not.toMatch(/status:\s*'cancelled'/i);
  });

  it('outcome mapping — CANCELLED_UNPAID → COMPLETED; PAID guard → REQUIRES_ACTION', () => {
    const idx = ROUTES.indexOf("actionBrainHandlers.set('CUSTOMER_CANCEL_BOOKING_UNPAID'");
    // The handler body includes a switch across ~10 cases; scan a
    // generous window so the assertions can see every case block.
    const body = ROUTES.slice(idx, idx + 3000);
    expect(body).toMatch(/CANCELLED_UNPAID[\s\S]{0,300}status: 'COMPLETED'/);
    expect(body).toMatch(/PAID_MUST_USE_PAID_CANCEL[\s\S]{0,120}status: 'REQUIRES_ACTION'/);
    expect(body).toMatch(/USE_PAID_CANCEL_FLOW/);
    expect(body).toMatch(/ACTOR_NOT_BOOKER[\s\S]{0,300}status: 'FAILED'/);
  });
});
