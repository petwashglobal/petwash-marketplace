/**
 * ActionConfirmationPolicy — Program 39.
 */
import { describe, it, expect } from 'vitest';
import { policyFor, isBlocking } from '../services/marketplace/ActionConfirmationPolicy';

describe('ActionConfirmationPolicy', () => {
  it('navigation actions are NONE (no confirmation)', () => {
    expect(policyFor('VIEW_BOOKING')).toBe('NONE');
    expect(policyFor('VIEW_ORDER')).toBe('NONE');
    expect(policyFor('VIEW_REFUND_STATUS')).toBe('NONE');
    expect(policyFor('VIEW_PET_PROFILE')).toBe('NONE');
  });

  it('favouriting is INSTANT_WITH_UNDO (no dialog, but reversible)', () => {
    expect(policyFor('FAVOURITE_PROVIDER')).toBe('INSTANT_WITH_UNDO');
    expect(policyFor('DISMISS_ATTENTION_ITEM')).toBe('INSTANT_WITH_UNDO');
  });

  it('sending a chat message or making a masked call is INSTANT', () => {
    expect(policyFor('SEND_MESSAGE')).toBe('INSTANT');
    expect(policyFor('CALL_PROVIDER_MASKED')).toBe('INSTANT');
  });

  it('sending a booking request / accepting a booking is REVIEW', () => {
    expect(policyFor('SEND_BOOKING_REQUEST')).toBe('REVIEW');
    expect(policyFor('BOOKING_ACCEPT')).toBe('REVIEW');
  });

  it('accepting a revised price is EXPLICIT (checkbox / re-tap)', () => {
    expect(policyFor('ACCEPT_REVISED_PRICE')).toBe('EXPLICIT');
    expect(policyFor('ACCEPT_PROPOSAL')).toBe('EXPLICIT');
  });

  it('paid cancellation shows a MONEY_PREVIEW', () => {
    expect(policyFor('CUSTOMER_CANCEL_BOOKING_PAID')).toBe('MONEY_PREVIEW');
    expect(policyFor('PROVIDER_CANCEL_CONFIRMED_BOOKING')).toBe('MONEY_PREVIEW');
  });

  it('changing bank / payout / passkey requires REAUTH', () => {
    expect(policyFor('UPDATE_BANK_ACCOUNT')).toBe('REAUTH');
    expect(policyFor('UPDATE_PAYOUT_ACCOUNT')).toBe('REAUTH');
    expect(policyFor('ENROLL_PASSKEY')).toBe('REAUTH');
  });

  it('deleting an account requires REAUTH + EXPLICIT', () => {
    expect(policyFor('DELETE_ACCOUNT')).toBe('REAUTH_AND_EXPLICIT');
  });

  it('unknown action → UNKNOWN (§72 discipline — never silent default)', () => {
    expect(policyFor('SOME_ACTION_NOT_IN_CATALOG_YET')).toBe('UNKNOWN');
    expect(policyFor('SOME_MONEY_MOVE_WE_HAVEN_T_MET', { movesMoney: true })).toBe('UNKNOWN');
  });

  it('isBlocking classifies the interactive levels correctly', () => {
    expect(isBlocking('NONE')).toBe(false);
    expect(isBlocking('INSTANT_WITH_UNDO')).toBe(false);
    expect(isBlocking('INSTANT')).toBe(false);
    expect(isBlocking('REVIEW')).toBe(true);
    expect(isBlocking('EXPLICIT')).toBe(true);
    expect(isBlocking('MONEY_PREVIEW')).toBe(true);
    expect(isBlocking('REAUTH')).toBe(true);
    expect(isBlocking('REAUTH_AND_EXPLICIT')).toBe(true);
    expect(isBlocking('UNKNOWN')).toBe(false); // caller escalates, not the confirmation layer
  });
});
