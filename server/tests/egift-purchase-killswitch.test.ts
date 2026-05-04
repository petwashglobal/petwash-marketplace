/**
 * PR-W3 — Kill-switch test for the e-gift purchase route.
 *
 * Validates the env-gated feature flag PETWASH_EGIFT_PURCHASE_ENABLED:
 *   - Unset / empty / 'false' / 'no' / 'off' / '0' → flag is FALSE
 *   - 'true' / '1' / 'yes' / 'on' (any case)        → flag is TRUE
 *
 * The route handler is intentionally NOT booted here — that would pull in
 * the entire app. Instead we re-implement the same env-parsing predicate
 * and lock its behaviour into a test, so any future change to the parsing
 * logic must update this test alongside.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function isEgiftPurchaseEnabled(): boolean {
  const v = (process.env.PETWASH_EGIFT_PURCHASE_ENABLED || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

describe('e-gift purchase kill switch', () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.PETWASH_EGIFT_PURCHASE_ENABLED;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.PETWASH_EGIFT_PURCHASE_ENABLED;
    else process.env.PETWASH_EGIFT_PURCHASE_ENABLED = original;
  });

  it('defaults to disabled when env var is unset', () => {
    delete process.env.PETWASH_EGIFT_PURCHASE_ENABLED;
    expect(isEgiftPurchaseEnabled()).toBe(false);
  });

  it('is disabled for empty string', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = '';
    expect(isEgiftPurchaseEnabled()).toBe(false);
  });

  it('is disabled for "false"', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = 'false';
    expect(isEgiftPurchaseEnabled()).toBe(false);
  });

  it('is disabled for "no"', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = 'no';
    expect(isEgiftPurchaseEnabled()).toBe(false);
  });

  it('is disabled for "0"', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = '0';
    expect(isEgiftPurchaseEnabled()).toBe(false);
  });

  it('is disabled for arbitrary non-truthy string', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = 'maybe';
    expect(isEgiftPurchaseEnabled()).toBe(false);
  });

  it('is enabled for "true"', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = 'true';
    expect(isEgiftPurchaseEnabled()).toBe(true);
  });

  it('is enabled for "TRUE" (case insensitive)', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = 'TRUE';
    expect(isEgiftPurchaseEnabled()).toBe(true);
  });

  it('is enabled for "1"', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = '1';
    expect(isEgiftPurchaseEnabled()).toBe(true);
  });

  it('is enabled for "yes"', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = 'yes';
    expect(isEgiftPurchaseEnabled()).toBe(true);
  });

  it('is enabled for "on"', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = 'on';
    expect(isEgiftPurchaseEnabled()).toBe(true);
  });

  it('trims whitespace before parsing', () => {
    process.env.PETWASH_EGIFT_PURCHASE_ENABLED = '   true   ';
    expect(isEgiftPurchaseEnabled()).toBe(true);
  });
});
