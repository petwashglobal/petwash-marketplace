/**
 * Pure unit tests for resolveProviderBookingActions.
 *
 * Per CEO 2026-08-18 §P1-27: stop reporting `tsc-clean` as
 * behavioral-verified. This is the first ACTUAL behavioral verification
 * shipped for any sprint code. Runs under vitest (see vitest.config.ts —
 * `tests/**\/*.test.ts` is in the include list, matching this file
 * via the alias-friendly location under shared/).
 *
 * The resolver is a pure function — no DB, no request, no time source —
 * so this file's assertions run in milliseconds and never flake.
 */

import { describe, expect, it } from 'vitest';
import {
  ARRIVING_MINUTES,
  IMMINENT_MINUTES,
  resolveProviderBookingActions,
} from '@shared/lib/providerBookingActions';

describe('resolveProviderBookingActions', () => {
  describe('pending', () => {
    it('offers ACCEPT primary + ACCEPT/DECLINE/MESSAGE/VIEW allowed', () => {
      const r = resolveProviderBookingActions({ status: 'pending' });
      expect(r.primaryAction).toBe('ACCEPT');
      expect(r.allowedActions).toEqual(['ACCEPT', 'DECLINE', 'MESSAGE', 'VIEW_DETAILS']);
    });
  });

  describe('meet_greet_requested', () => {
    it('offers SCHEDULE_MEET_GREET primary + DECLINE fallback', () => {
      const r = resolveProviderBookingActions({ status: 'meet_greet_requested' });
      expect(r.primaryAction).toBe('SCHEDULE_MEET_GREET');
      expect(r.allowedActions).toContain('SCHEDULE_MEET_GREET');
      expect(r.allowedActions).toContain('DECLINE');
    });
  });

  describe('meet_greet_scheduled', () => {
    it('offers COMPLETE_MEET_GREET primary only when the meeting is here', () => {
      const r = resolveProviderBookingActions({
        status: 'meet_greet_scheduled',
        minutesUntilMeetGreet: IMMINENT_MINUTES,
      });
      expect(r.primaryAction).toBe('COMPLETE_MEET_GREET');
    });

    it('offers COMPLETE_MEET_GREET when the meeting is past (negative minutes)', () => {
      const r = resolveProviderBookingActions({
        status: 'meet_greet_scheduled',
        minutesUntilMeetGreet: -30,
      });
      expect(r.primaryAction).toBe('COMPLETE_MEET_GREET');
    });

    it('falls back to VIEW_DETAILS when the meeting is still far out', () => {
      const r = resolveProviderBookingActions({
        status: 'meet_greet_scheduled',
        minutesUntilMeetGreet: 90,
      });
      expect(r.primaryAction).toBe('VIEW_DETAILS');
      // Allowed still includes COMPLETE so the provider CAN complete
      // early if the customer showed up ahead of time.
      expect(r.allowedActions).toContain('COMPLETE_MEET_GREET');
    });

    it('falls back to VIEW_DETAILS when minutesUntilMeetGreet is null', () => {
      const r = resolveProviderBookingActions({
        status: 'meet_greet_scheduled',
        minutesUntilMeetGreet: null,
      });
      expect(r.primaryAction).toBe('VIEW_DETAILS');
    });
  });

  describe('confirmed', () => {
    it('offers START_SERVICE inside the IMMINENT window', () => {
      const r = resolveProviderBookingActions({
        status: 'confirmed',
        minutesUntilStart: IMMINENT_MINUTES,
      });
      expect(r.primaryAction).toBe('START_SERVICE');
      expect(r.allowedActions).toContain('START_SERVICE');
      expect(r.allowedActions).toContain('ARRIVING');
    });

    it('offers ARRIVING between IMMINENT and ARRIVING window', () => {
      const r = resolveProviderBookingActions({
        status: 'confirmed',
        minutesUntilStart: ARRIVING_MINUTES,
      });
      expect(r.primaryAction).toBe('ARRIVING');
    });

    it('offers ARRIVING at exactly ARRIVING_MINUTES', () => {
      const r = resolveProviderBookingActions({
        status: 'confirmed',
        minutesUntilStart: ARRIVING_MINUTES,
      });
      expect(r.primaryAction).toBe('ARRIVING');
    });

    it('offers only VIEW_DETAILS beyond ARRIVING window', () => {
      const r = resolveProviderBookingActions({
        status: 'confirmed',
        minutesUntilStart: 120,
      });
      expect(r.primaryAction).toBe('VIEW_DETAILS');
      expect(r.allowedActions).not.toContain('START_SERVICE');
      expect(r.allowedActions).not.toContain('ARRIVING');
    });

    it('offers VIEW_DETAILS when minutesUntilStart is null', () => {
      const r = resolveProviderBookingActions({
        status: 'confirmed',
        minutesUntilStart: null,
      });
      expect(r.primaryAction).toBe('VIEW_DETAILS');
    });
  });

  describe('in_progress', () => {
    it('offers FINISH_SERVICE — this is the whole point of the focus card', () => {
      const r = resolveProviderBookingActions({ status: 'in_progress' });
      expect(r.primaryAction).toBe('FINISH_SERVICE');
      expect(r.allowedActions).toContain('FINISH_SERVICE');
      expect(r.allowedActions).toContain('MESSAGE');
    });
  });

  describe('terminal / post-service states', () => {
    for (const status of [
      'provider_marked_complete',
      'completed',
      'reviewed',
      'cancelled',
      'declined',
      'disputed',
    ]) {
      it(`${status} falls to VIEW_DETAILS with no destructive actions offered`, () => {
        const r = resolveProviderBookingActions({ status });
        expect(r.primaryAction).toBe('VIEW_DETAILS');
        expect(r.allowedActions).not.toContain('START_SERVICE');
        expect(r.allowedActions).not.toContain('FINISH_SERVICE');
        expect(r.allowedActions).not.toContain('COMPLETE_MEET_GREET');
        expect(r.allowedActions).not.toContain('ACCEPT');
      });
    }
  });

  describe('unknown / defensive inputs', () => {
    it('null status → VIEW_DETAILS', () => {
      const r = resolveProviderBookingActions({ status: null });
      expect(r.primaryAction).toBe('VIEW_DETAILS');
    });

    it('undefined status → VIEW_DETAILS', () => {
      const r = resolveProviderBookingActions({ status: undefined });
      expect(r.primaryAction).toBe('VIEW_DETAILS');
    });

    it('empty string status → VIEW_DETAILS', () => {
      const r = resolveProviderBookingActions({ status: '' });
      expect(r.primaryAction).toBe('VIEW_DETAILS');
    });

    it('bogus status like "yolo" → VIEW_DETAILS (never destructive)', () => {
      const r = resolveProviderBookingActions({ status: 'yolo' });
      expect(r.primaryAction).toBe('VIEW_DETAILS');
      expect(r.allowedActions).not.toContain('START_SERVICE');
    });

    it('MESSAGE + VIEW_DETAILS are always in allowedActions for every real state', () => {
      const states = [
        'pending', 'meet_greet_requested', 'meet_greet_scheduled',
        'meet_greet_completed', 'accepted', 'payment_pending',
        'confirmed', 'in_progress',
        'provider_marked_complete', 'completed', 'reviewed',
        'cancelled', 'declined', 'disputed',
      ];
      for (const s of states) {
        const r = resolveProviderBookingActions({ status: s });
        expect(r.allowedActions, `status=${s}`).toContain('MESSAGE');
        expect(r.allowedActions, `status=${s}`).toContain('VIEW_DETAILS');
      }
    });
  });

  describe('case normalization', () => {
    it('accepts uppercase status', () => {
      const r = resolveProviderBookingActions({ status: 'IN_PROGRESS' });
      expect(r.primaryAction).toBe('FINISH_SERVICE');
    });

    it('accepts mixed case status', () => {
      const r = resolveProviderBookingActions({ status: 'Confirmed', minutesUntilStart: 5 });
      expect(r.primaryAction).toBe('START_SERVICE');
    });
  });

  describe('primaryAction is always a member of allowedActions', () => {
    // Invariant: if a state offers a primary action, it must also list it
    // as allowed. A client that filters buttons by allowedActions must
    // never lose the primary.
    const states = [
      'pending', 'meet_greet_requested',
      'in_progress',
    ];
    for (const s of states) {
      it(`${s}: primaryAction ⊆ allowedActions`, () => {
        const r = resolveProviderBookingActions({ status: s });
        expect(r.allowedActions).toContain(r.primaryAction);
      });
    }

    it('confirmed + imminent: primary ⊆ allowed', () => {
      const r = resolveProviderBookingActions({ status: 'confirmed', minutesUntilStart: 5 });
      expect(r.allowedActions).toContain(r.primaryAction);
    });

    it('meet_greet_scheduled + imminent: primary ⊆ allowed', () => {
      const r = resolveProviderBookingActions({ status: 'meet_greet_scheduled', minutesUntilMeetGreet: 5 });
      expect(r.allowedActions).toContain(r.primaryAction);
    });
  });
});
