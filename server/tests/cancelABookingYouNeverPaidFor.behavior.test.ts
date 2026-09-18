/**
 * Behavioural test — server/lib/unpaidCancellation.ts (2026-09-19).
 *
 * Sitter and Walk both refused a customer cancel unless the booking was still
 * waiting for the provider. That was right while accepting a booking also
 * charged for it. It stopped being right the moment accept and payment came
 * apart:
 *
 *   WALK   — a walker's accept now lands the booking in payment_pending with
 *            NOTHING paid; only the verified payment return writes 'confirmed'.
 *            The customer was told to phone support to get out of a booking
 *            they had never paid for, and the walker held a dead slot.
 *   SITTER — accept charges the stored method; a FAILED charge lands in
 *            payment_failed, where nothing was captured and nothing will ever
 *            retry. The customer was told to phone support about a charge that
 *            never happened.
 *
 * What must NOT move is just as important: a booking with money held against
 * it stays with the refund rail.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  customerMayCancelUnpaid,
  CANCELLABLE_WHILE_UNPAID,
} from '../lib/unpaidCancellation';

describe('a walk the customer has not paid for', () => {
  it('can be cancelled while it waits for a walker', () => {
    expect(customerMayCancelUnpaid('walk', 'pending_provider')).toBe(true);
  });

  it('can be cancelled after the walker accepts, because that takes no money', () => {
    expect(customerMayCancelUnpaid('walk', 'payment_pending')).toBe(true);
  });

  it('cannot be cancelled once it is paid for', () => {
    for (const paid of ['confirmed', 'in_progress', 'completed']) {
      expect(customerMayCancelUnpaid('walk', paid), paid).toBe(false);
    }
  });
});

describe('a sitter booking whose charge failed', () => {
  it('can be cancelled — nothing was captured and nothing will retry', () => {
    expect(customerMayCancelUnpaid('sitter', 'payment_failed')).toBe(true);
  });

  it('payment_pending stays with support: it may or may not have been charged', () => {
    // For sitter this is the transient state AROUND the capture, unlike walk
    // where it means "waiting for the customer to pay".
    expect(customerMayCancelUnpaid('sitter', 'payment_pending')).toBe(false);
  });

  it('a confirmed booking has money held and belongs to the refund rail', () => {
    expect(customerMayCancelUnpaid('sitter', 'confirmed')).toBe(false);
  });
});

describe('the rule refuses anything it does not recognise', () => {
  it('an unknown status is not cancellable', () => {
    expect(customerMayCancelUnpaid('walk', 'something_new')).toBe(false);
    expect(customerMayCancelUnpaid('sitter', '')).toBe(false);
  });

  it('a missing status is not cancellable', () => {
    expect(customerMayCancelUnpaid('walk', undefined)).toBe(false);
    expect(customerMayCancelUnpaid('walk', null)).toBe(false);
  });

  it('an unknown service is not cancellable', () => {
    expect(customerMayCancelUnpaid('academy' as any, 'pending_provider')).toBe(false);
  });

  it('the two services do not share a list', () => {
    expect(CANCELLABLE_WHILE_UNPAID.walk).not.toEqual(CANCELLABLE_WHILE_UNPAID.sitter);
  });
});

describe('both cancel routes ask the shared rule, and set on the status they read', () => {
  const R = (f: string) => readFileSync(resolve(__dirname, '..', 'routes', f), 'utf8');

  it.each([
    ['walk-my-pet.ts', 'walk'],
    ['sitter-suite.ts', 'sitter'],
  ])('%s', (file, service) => {
    const src = R(file);
    expect(src).toMatch(new RegExp(`customerMayCancelUnpaid\\('${service}'`));
    // Compare-and-set: a payment landing in the same moment must win, rather
    // than the cancel overwriting a booking that has just been paid for.
    const region = src.slice(src.indexOf("/cancel'"), src.indexOf("/cancel'") + 3000);
    expect(region).toMatch(/\.returning\(/);
    expect(region).toMatch(/BOOKING_CHANGED/);
  });
});
