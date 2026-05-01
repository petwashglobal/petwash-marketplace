import { describe, it, expect } from 'vitest';
import { assertProximityRequirements } from '../../server/routes/booking-search';

/**
 * Phase B3 — Strict proximity matching contract tests.
 *
 * Pure-function tests against assertProximityRequirements. End-to-end
 * search behavior (provider exclusion, tiered ranking) is verified by
 * the integration suite once a DB is provisioned.
 */

describe('assertProximityRequirements — strict-mode coordinate gate', () => {
  it('passes when requireCoordinates is false (legacy mode)', () => {
    expect(assertProximityRequirements({ requireCoordinates: false })).toBeNull();
    expect(assertProximityRequirements({})).toBeNull();
    // Even with bad coords, legacy mode does not block here.
    expect(
      assertProximityRequirements({ latitude: NaN, longitude: 999, requireCoordinates: false }),
    ).toBeNull();
  });

  it('passes when strict mode + valid Israeli coordinates', () => {
    // Tel Aviv
    expect(
      assertProximityRequirements({ requireCoordinates: true, latitude: 32.0853, longitude: 34.7818 }),
    ).toBeNull();
    // Jerusalem
    expect(
      assertProximityRequirements({ requireCoordinates: true, latitude: 31.7683, longitude: 35.2137 }),
    ).toBeNull();
    // Eilat
    expect(
      assertProximityRequirements({ requireCoordinates: true, latitude: 29.5577, longitude: 34.9519 }),
    ).toBeNull();
  });

  it('rejects strict mode without latitude — 422 COORDINATES_REQUIRED', () => {
    const r = assertProximityRequirements({ requireCoordinates: true, longitude: 34.7818 });
    expect(r).not.toBeNull();
    expect(r?.statusCode).toBe(422);
    expect(r?.body.code).toBe('COORDINATES_REQUIRED');
  });

  it('rejects strict mode without longitude — 422', () => {
    const r = assertProximityRequirements({ requireCoordinates: true, latitude: 32.0853 });
    expect(r?.statusCode).toBe(422);
    expect(r?.body.code).toBe('COORDINATES_REQUIRED');
  });

  it('rejects strict mode with NaN latitude (defense in depth)', () => {
    const r = assertProximityRequirements({ requireCoordinates: true, latitude: NaN, longitude: 34.7818 });
    expect(r?.statusCode).toBe(422);
  });

  it('rejects strict mode with out-of-range latitude (defense in depth)', () => {
    expect(
      assertProximityRequirements({ requireCoordinates: true, latitude: 91, longitude: 0 })?.statusCode,
    ).toBe(422);
    expect(
      assertProximityRequirements({ requireCoordinates: true, latitude: -91, longitude: 0 })?.statusCode,
    ).toBe(422);
  });

  it('rejects strict mode with out-of-range longitude (defense in depth)', () => {
    expect(
      assertProximityRequirements({ requireCoordinates: true, latitude: 32, longitude: 181 })?.statusCode,
    ).toBe(422);
    expect(
      assertProximityRequirements({ requireCoordinates: true, latitude: 32, longitude: -181 })?.statusCode,
    ).toBe(422);
  });

  it('rejects strict mode with infinity (defense in depth)', () => {
    expect(
      assertProximityRequirements({
        requireCoordinates: true,
        latitude: Number.POSITIVE_INFINITY,
        longitude: 34,
      })?.statusCode,
    ).toBe(422);
  });

  it('rejects strict mode with non-number coordinate type (defense in depth)', () => {
    expect(
      assertProximityRequirements({
        requireCoordinates: true,
        latitude: '32.085' as any,
        longitude: 34.7818,
      })?.statusCode,
    ).toBe(422);
  });
});

describe('Strict-mode policy — documented contract', () => {
  // These tests document the contract. The actual behaviour is exercised
  // in the booking-search route (provider filter + ranker swap).
  it('requireCoordinates default is false (no breaking change for legacy callers)', () => {
    // Default value is enforced by the Zod schema in shared/schema.ts.
    // Test: a filter with no requireCoordinates field passes the gate.
    expect(assertProximityRequirements({})).toBeNull();
  });

  it('strict mode rejects missing coords with a structured machine code', () => {
    const r = assertProximityRequirements({ requireCoordinates: true });
    expect(r).toEqual({
      statusCode: 422,
      body: {
        error: 'Strict proximity mode requires valid latitude and longitude.',
        code: 'COORDINATES_REQUIRED',
      },
    });
  });
});
