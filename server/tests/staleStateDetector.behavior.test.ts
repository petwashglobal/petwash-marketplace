/**
 * StaleStateDetector — Program 40.
 */
import { describe, it, expect } from 'vitest';
import {
  checkVersion,
  checkStatus,
} from '../services/marketplace/StaleStateDetector';

describe('StaleStateDetector — checkVersion', () => {
  it('matching version → FRESH', () => {
    expect(checkVersion({ expectedVersion: 5, serverVersion: 5 })).toEqual({ code: 'FRESH' });
  });

  it('server advanced → STALE with VERSION_ADVANCED', () => {
    const out = checkVersion({ expectedVersion: 3, serverVersion: 5 });
    expect(out.code).toBe('STALE');
    if (out.code !== 'STALE') throw new Error();
    expect(out.reasonCode).toBe('VERSION_ADVANCED');
    expect(out.serverState).toBe('5');
  });

  it('string uuid versions compared exactly', () => {
    expect(checkVersion({ expectedVersion: 'uuid-a', serverVersion: 'uuid-a' })).toEqual({ code: 'FRESH' });
    const out = checkVersion({ expectedVersion: 'uuid-a', serverVersion: 'uuid-b' });
    expect(out.code).toBe('STALE');
  });
});

describe('StaleStateDetector — checkStatus', () => {
  it('server still in a mutation-safe status → FRESH', () => {
    const out = checkStatus({
      expectedStatus: 'REQUESTED',
      serverStatus: 'REQUESTED',
      mutationSafeStatuses: ['REQUESTED', 'PENDING', 'QUOTED'],
    });
    expect(out.code).toBe('FRESH');
  });

  it('server advanced OUT OF safe set → STATUS_ADVANCED', () => {
    const out = checkStatus({
      expectedStatus: 'REQUESTED',
      serverStatus: 'CONFIRMED',
      mutationSafeStatuses: ['REQUESTED', 'PENDING', 'QUOTED'],
    });
    expect(out.code).toBe('STALE');
    if (out.code !== 'STALE') throw new Error();
    expect(out.reasonCode).toBe('STATUS_ADVANCED');
    expect(out.serverState).toBe('CONFIRMED');
  });

  it('server in a terminal status → STATUS_TERMINAL (even if it was in the safe list)', () => {
    const out = checkStatus({
      expectedStatus: 'REQUESTED',
      serverStatus: 'CANCELLED',
      mutationSafeStatuses: ['REQUESTED', 'CANCELLED'],
      terminalStatuses: ['CANCELLED', 'COMPLETED'],
    });
    expect(out.code).toBe('STALE');
    if (out.code !== 'STALE') throw new Error();
    expect(out.reasonCode).toBe('STATUS_TERMINAL');
  });

  it('case-insensitive comparison', () => {
    const out = checkStatus({
      expectedStatus: 'requested',
      serverStatus: 'REQUESTED',
      mutationSafeStatuses: ['requested'],
    });
    expect(out.code).toBe('FRESH');
  });

  it('two-device scenario — phone accepted, laptop tries decline stale', () => {
    // Provider phone accepted: server is now ACCEPTED.
    // Laptop still shows REQUESTED and tries to DECLINE.
    const out = checkStatus({
      expectedStatus: 'REQUESTED',
      serverStatus: 'ACCEPTED',
      mutationSafeStatuses: ['REQUESTED'],
      terminalStatuses: ['CANCELLED', 'COMPLETED', 'DECLINED', 'EXPIRED'],
    });
    expect(out.code).toBe('STALE');
    if (out.code !== 'STALE') throw new Error();
    expect(out.reasonCode).toBe('STATUS_ADVANCED');
  });

  it('customer-cancel scenario — phone cancelled, desktop tries to confirm', () => {
    const out = checkStatus({
      expectedStatus: 'CONFIRMED',
      serverStatus: 'CANCELLED',
      mutationSafeStatuses: ['CONFIRMED', 'CANCELLED'],
      terminalStatuses: ['CANCELLED', 'COMPLETED'],
    });
    expect(out.code).toBe('STALE');
    if (out.code !== 'STALE') throw new Error();
    expect(out.reasonCode).toBe('STATUS_TERMINAL');
  });
});
