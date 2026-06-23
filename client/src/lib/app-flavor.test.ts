/**
 * Tests for the consolidated app-flavor resolver (SDD §11).
 *
 * Pins the bundle-id → flavor mapping so the Prestige and Provider native apps
 * are never mis-detected (which would route a user into the wrong app shell).
 */

import { describe, it, expect } from 'vitest';
import { flavorFromBundleId } from './app-flavor';

describe('flavorFromBundleId', () => {
  it('maps the provider bundle id to provider', () => {
    expect(flavorFromBundleId('il.co.petwash.provider')).toBe('provider');
  });

  it('maps the customer bundle ids to customer (Prestige)', () => {
    expect(flavorFromBundleId('com.petwash.il')).toBe('customer');
    expect(flavorFromBundleId('il.co.petwash.customer')).toBe('customer');
  });

  it('maps an empty / missing id (browser) to web', () => {
    expect(flavorFromBundleId('')).toBe('web');
    expect(flavorFromBundleId(null)).toBe('web');
    expect(flavorFromBundleId(undefined)).toBe('web');
  });

  it('treats any non-provider native id as customer, not web', () => {
    // Defensive: a future customer bundle rename still resolves to the app, not web.
    expect(flavorFromBundleId('io.petwash.member')).toBe('customer');
  });
});
