import { describe, it, expect } from 'vitest';
import {
  computeCutoff,
  shouldAutoDecline,
  getAcceptTimeoutMs,
  getAcceptTimeoutPollMs,
} from '../../server/jobs/booking-accept-timeout';

/**
 * Phase B5 — Accept Timeout System tests.
 *
 * Pure-function tests. The DB select + state-machine transition + wallet
 * release + notification dispatch are exercised by the integration suite
 * (live-booking) once a Postgres test instance is available.
 */

describe('getAcceptTimeoutMs — env override', () => {
  it('defaults to 24 hours when ACCEPT_TIMEOUT_HOURS is unset', () => {
    delete process.env.ACCEPT_TIMEOUT_HOURS;
    expect(getAcceptTimeoutMs()).toBe(24 * 60 * 60 * 1000);
  });

  it('honours ACCEPT_TIMEOUT_HOURS=1', () => {
    process.env.ACCEPT_TIMEOUT_HOURS = '1';
    expect(getAcceptTimeoutMs()).toBe(60 * 60 * 1000);
    delete process.env.ACCEPT_TIMEOUT_HOURS;
  });

  it('falls back to 24h on bad env values (NaN / negative / empty)', () => {
    process.env.ACCEPT_TIMEOUT_HOURS = 'not-a-number';
    expect(getAcceptTimeoutMs()).toBe(24 * 60 * 60 * 1000);
    process.env.ACCEPT_TIMEOUT_HOURS = '-5';
    expect(getAcceptTimeoutMs()).toBe(24 * 60 * 60 * 1000);
    process.env.ACCEPT_TIMEOUT_HOURS = '';
    expect(getAcceptTimeoutMs()).toBe(24 * 60 * 60 * 1000);
    delete process.env.ACCEPT_TIMEOUT_HOURS;
  });
});

describe('getAcceptTimeoutPollMs — env override', () => {
  it('defaults to 5 minutes when ACCEPT_TIMEOUT_POLL_MS is unset', () => {
    delete process.env.ACCEPT_TIMEOUT_POLL_MS;
    expect(getAcceptTimeoutPollMs()).toBe(5 * 60 * 1000);
  });

  it('honours ACCEPT_TIMEOUT_POLL_MS=60000', () => {
    process.env.ACCEPT_TIMEOUT_POLL_MS = '60000';
    expect(getAcceptTimeoutPollMs()).toBe(60_000);
    delete process.env.ACCEPT_TIMEOUT_POLL_MS;
  });

  it('falls back to 5 min on bad values', () => {
    process.env.ACCEPT_TIMEOUT_POLL_MS = 'bad';
    expect(getAcceptTimeoutPollMs()).toBe(5 * 60 * 1000);
    process.env.ACCEPT_TIMEOUT_POLL_MS = '0';
    expect(getAcceptTimeoutPollMs()).toBe(5 * 60 * 1000);
    delete process.env.ACCEPT_TIMEOUT_POLL_MS;
  });
});

describe('computeCutoff — deterministic time math', () => {
  it('returns now - 24 hours by default', () => {
    delete process.env.ACCEPT_TIMEOUT_HOURS;
    const now = new Date('2026-06-01T12:00:00Z');
    const cutoff = computeCutoff(now);
    expect(cutoff.toISOString()).toBe('2026-05-31T12:00:00.000Z');
  });

  it('honours a per-call timeoutMs argument', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const cutoff = computeCutoff(now, 60 * 60 * 1000); // 1 hour
    expect(cutoff.toISOString()).toBe('2026-06-01T11:00:00.000Z');
  });
});

describe('shouldAutoDecline — pure predicate', () => {
  const cutoff = new Date('2026-06-01T12:00:00Z');

  it('returns true for pending older than cutoff', () => {
    expect(shouldAutoDecline(
      { status: 'pending', createdAt: new Date('2026-05-31T11:00:00Z') },
      cutoff,
    )).toBe(true);
  });

  it('returns false for pending newer than cutoff', () => {
    expect(shouldAutoDecline(
      { status: 'pending', createdAt: new Date('2026-06-01T13:00:00Z') },
      cutoff,
    )).toBe(false);
  });

  it('returns false for non-pending statuses regardless of age', () => {
    expect(shouldAutoDecline(
      { status: 'accepted', createdAt: new Date('2025-01-01T00:00:00Z') },
      cutoff,
    )).toBe(false);
    expect(shouldAutoDecline(
      { status: 'cancelled', createdAt: new Date('2025-01-01T00:00:00Z') },
      cutoff,
    )).toBe(false);
    expect(shouldAutoDecline(
      { status: 'declined', createdAt: new Date('2025-01-01T00:00:00Z') },
      cutoff,
    )).toBe(false);
  });

  it('returns false when createdAt is missing or invalid (defense in depth)', () => {
    expect(shouldAutoDecline({ status: 'pending', createdAt: null }, cutoff)).toBe(false);
    expect(shouldAutoDecline({ status: 'pending', createdAt: undefined }, cutoff)).toBe(false);
    expect(shouldAutoDecline({ status: 'pending', createdAt: 'not-a-date' }, cutoff)).toBe(false);
  });

  it('accepts ISO string createdAt', () => {
    expect(shouldAutoDecline(
      { status: 'pending', createdAt: '2026-05-31T11:00:00Z' },
      cutoff,
    )).toBe(true);
  });

  it('considers exact-cutoff-match as NOT stale (>= cutoff stays alive)', () => {
    const exact = new Date('2026-06-01T12:00:00Z'); // same instant as cutoff
    expect(shouldAutoDecline(
      { status: 'pending', createdAt: exact },
      cutoff,
    )).toBe(false);
  });
});

describe('Real-world scenarios', () => {
  it('booking created 25 hours ago → auto-decline', () => {
    const now = new Date('2026-06-02T12:00:00Z');
    delete process.env.ACCEPT_TIMEOUT_HOURS; // default 24h
    const cutoff = computeCutoff(now);
    expect(shouldAutoDecline(
      { status: 'pending', createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) },
      cutoff,
    )).toBe(true);
  });

  it('booking created 23 hours ago → still alive', () => {
    const now = new Date('2026-06-02T12:00:00Z');
    delete process.env.ACCEPT_TIMEOUT_HOURS;
    const cutoff = computeCutoff(now);
    expect(shouldAutoDecline(
      { status: 'pending', createdAt: new Date(now.getTime() - 23 * 60 * 60 * 1000) },
      cutoff,
    )).toBe(false);
  });

  it('with 1-hour env override, 90-min-old request is stale', () => {
    process.env.ACCEPT_TIMEOUT_HOURS = '1';
    const now = new Date('2026-06-02T12:00:00Z');
    const cutoff = computeCutoff(now);
    expect(shouldAutoDecline(
      { status: 'pending', createdAt: new Date(now.getTime() - 90 * 60 * 1000) },
      cutoff,
    )).toBe(true);
    delete process.env.ACCEPT_TIMEOUT_HOURS;
  });
});
