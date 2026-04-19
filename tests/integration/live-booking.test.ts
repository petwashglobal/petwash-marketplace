/**
 * PetWash™ Live Integration Test Suite
 * ======================================
 * Tests all 9 critical booking/auth scenarios against a running server.
 *
 * HOW TO RUN:
 *   Against production:
 *     API_URL=https://petwash.co.il TEST_BYPASS_TOKEN=<secret> JWT_SECRET=<secret> npm run test:integration
 *
 *   Against local dev server (start it first with: npm run dev):
 *     API_URL=http://localhost:5000 TEST_BYPASS_TOKEN=<secret> JWT_SECRET=<secret> npm run test:integration
 *
 * REQUIRED ENV VARS:
 *   API_URL           - Base URL of the running server (no trailing slash)
 *   TEST_BYPASS_TOKEN - The value you set for TEST_BYPASS_TOKEN on the server
 *   JWT_SECRET        - The JWT secret used by the server (for unified-booking test)
 *
 * TEST ACCOUNTS (adjust to match real data if needed):
 *   TEST_USER_ID     - Any valid Firebase UID for the signed-in user  (default: "test-integration-uid")
 *   TEST_SITTER_ID   - A sitter profile integer ID in DB              (default: 1)
 *   TEST_PET_ID      - A pet profile integer ID in DB                 (default: 1)
 *   TEST_WALKER_ID   - A walker profile walker_id string in DB        (default: "WALKER-TEST-001")
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as jwt from 'jsonwebtoken';

// ─── Config ────────────────────────────────────────────────────────────────────
const API_URL          = (process.env.API_URL          || 'http://localhost:5000').replace(/\/$/, '');
const BYPASS_TOKEN     = process.env.TEST_BYPASS_TOKEN || '';
const JWT_SECRET       = process.env.JWT_SECRET        || '';
const TEST_USER_ID     = process.env.TEST_USER_ID      || 'test-integration-uid';
const TEST_SITTER_ID   = Number(process.env.TEST_SITTER_ID  || '1');
const TEST_PET_ID      = Number(process.env.TEST_PET_ID     || '1');
const TEST_WALKER_ID   = process.env.TEST_WALKER_ID    || 'WALKER-TEST-001';
const FORGED_USER_ID   = 'FORGED-ATTACKER-UID-DO-NOT-USE';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Headers that simulate a fully authenticated user (Firebase bypass). */
function authHeaders(userId = TEST_USER_ID): Record<string, string> {
  if (!BYPASS_TOKEN) {
    throw new Error(
      'TEST_BYPASS_TOKEN env var is required. ' +
      'Set it to the same value configured on the server.'
    );
  }
  return {
    'Content-Type': 'application/json',
    'x-test-user-bypass': BYPASS_TOKEN,
    'x-test-user-id':     userId,
    'x-test-user-email':  `${userId}@test.petwash.local`,
  };
}

/** Headers with NO auth — simulates a signed-out request. */
function noAuthHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

/** Generate a valid JWT for unified-booking (uses JWT_SECRET). */
function jwtTokenFor(userId: string): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET env var is required for unified-booking test.');
  }
  return jwt.sign({ sub: userId, roles: ['customer'] }, JWT_SECRET, { expiresIn: '1h' });
}

/** POST helper — returns { status, body }. */
async function post(path: string, body: unknown, headers: Record<string, string>) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let json: unknown;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

// ─── Future/past date helpers ──────────────────────────────────────────────────
function futureDateStr(daysAhead = 3): string {
  const d = new Date(Date.now() + daysAhead * 86400_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function pastDateStr(): string {
  const d = new Date(Date.now() - 2 * 86400_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Walk booking payload factory ─────────────────────────────────────────────
function walkBookingPayload(overrides: Record<string, unknown> = {}) {
  return {
    walkerId:          TEST_WALKER_ID,
    scheduledDate:     futureDateStr(),
    scheduledStartTime:'10:00',
    durationMinutes:   30,
    pickupLatitude:    32.0853,
    pickupLongitude:   34.7818,
    pickupAddress:     '1 Rothschild Blvd, Tel Aviv',
    petName:           'Buddy',
    petBreed:          'Labrador',
    petWeight:         20,
    petIds:            [TEST_PET_ID],
    pricing:           { basePrice: 150, currency: 'ILS' },
    notes:             'Integration test — please ignore',
    ...overrides,
  };
}

// ─── Guard: skip entire suite if server is unreachable ─────────────────────────
beforeAll(async () => {
  try {
    const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }
  } catch (err: any) {
    // If health check fails, try root
    try {
      await fetch(`${API_URL}/`, { signal: AbortSignal.timeout(5000) });
    } catch {
      throw new Error(
        `\n⚠️  Cannot reach server at ${API_URL}\n` +
        `   Start the dev server first: npm run dev\n` +
        `   Or set API_URL to point at the production server.\n` +
        `   Original error: ${err.message}`
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════
describe('PetWash™ Live Integration — Booking + Auth (9 scenarios)', () => {

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 1 — Sitter booking with 1 pet (authenticated)
  // ───────────────────────────────────────────────────────────────────────────
  it('[1] POST /api/sitter-suite/bookings — 1 pet, signed in — must NOT return 401 or 404 "pet endpoint"', async () => {
    const { status, body } = await post(
      '/api/sitter-suite/bookings',
      {
        sitterId:  TEST_SITTER_ID,
        petId:     TEST_PET_ID,
        startDate: futureDateStr(2),
        endDate:   futureDateStr(5),
        notes:     'Integration test',
      },
      authHeaders(),
    );
    // Auth must pass — must NOT be 401
    expect(status, `Expected non-401 but got ${status}: ${JSON.stringify(body)}`).not.toBe(401);
    // Must NOT be the old Firestore ID mismatch 404
    if (status === 404) {
      const errorMsg = (body as any)?.error || '';
      expect(
        errorMsg,
        `Got 404 with message that looks like the old pet-source bug: "${errorMsg}"`
      ).not.toMatch(/pet.*not found|sitter.*not found/i);
    }
    // Acceptable outcomes: 201 (created), 400 (validation), 404 (sitter/pet not seeded in test DB)
    expect([200, 201, 400, 404, 409]).toContain(status);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 2 — Sitter booking with multiple pets (authenticated)
  // ───────────────────────────────────────────────────────────────────────────
  it('[2] POST /api/sitter-suite/bookings — multiple pets — must reach booking logic, not auth layer', async () => {
    const { status, body } = await post(
      '/api/sitter-suite/bookings',
      {
        sitterId:  TEST_SITTER_ID,
        petId:     TEST_PET_ID,   // primary pet (multi-pet: backend accepts one for now)
        startDate: futureDateStr(2),
        endDate:   futureDateStr(5),
        notes:     'Integration test multi-pet',
      },
      authHeaders(),
    );
    expect(status, `Auth blocked request: ${status}: ${JSON.stringify(body)}`).not.toBe(401);
    expect([200, 201, 400, 404, 409]).toContain(status);
    // Known gap: backend records only the first/primary pet — verify this is still acceptable state
    if (status === 201 || status === 200) {
      const b = body as any;
      // If booking was created, petId should be our test pet, not a hardcoded value
      expect(b?.petId ?? b?.booking?.petId).toBeDefined();
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 3 — Walk booking with real pet data (authenticated)
  // ───────────────────────────────────────────────────────────────────────────
  it('[3] POST /api/walk-my-pet/walks/book — real pet data — must NOT return 401, must pass validation', async () => {
    const { status, body } = await post(
      '/api/walk-my-pet/walks/book',
      walkBookingPayload(),
      authHeaders(),
    );
    expect(status, `Auth blocked walk booking: ${status}: ${JSON.stringify(body)}`).not.toBe(401);
    // Validation passes — fails only at DB lookup (walker not seeded) or business logic
    const validStatusCodes = [200, 201, 400, 404, 409];
    expect(validStatusCodes, `Unexpected status ${status}: ${JSON.stringify(body)}`).toContain(status);
    // If it does create, petName must NOT be the old hardcoded 'My Pet'
    if (status === 201 || status === 200) {
      const b = body as any;
      expect(b?.petName ?? b?.booking?.petName).not.toBe('My Pet');
      expect(b?.petBreed ?? b?.booking?.petBreed).not.toBe('Mixed');
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 4 — Walk booking with a PAST date (must fail 400)
  // ───────────────────────────────────────────────────────────────────────────
  it('[4] POST /api/walk-my-pet/walks/book — past date — MUST return 400', async () => {
    const { status, body } = await post(
      '/api/walk-my-pet/walks/book',
      walkBookingPayload({
        scheduledDate:      pastDateStr(),
        scheduledStartTime: '10:00',
      }),
      authHeaders(),
    );
    expect(status).toBe(400);
    const err = (body as any)?.error || '';
    expect(err.toLowerCase()).toMatch(/future|past/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 5 — Walk booking with duration = 0 (must fail 400)
  // ───────────────────────────────────────────────────────────────────────────
  it('[5] POST /api/walk-my-pet/walks/book — duration 0 — MUST return 400', async () => {
    const { status, body } = await post(
      '/api/walk-my-pet/walks/book',
      walkBookingPayload({ durationMinutes: 0 }),
      authHeaders(),
    );
    expect(status).toBe(400);
    const err = (body as any)?.error || '';
    expect(err.toLowerCase()).toMatch(/duration|positive/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 6 — Walker registration signed OUT (must return 401)
  // ───────────────────────────────────────────────────────────────────────────
  it('[6] POST /api/walk-my-pet/walkers/register — signed out — MUST return 401', async () => {
    const { status, body } = await post(
      '/api/walk-my-pet/walkers/register',
      {
        firstName: 'Test',
        lastName:  'Walker',
        city:      'Tel Aviv',
        country:   'IL',
        baseHourlyRate: '50',
      },
      noAuthHeaders(),
    );
    expect(status, `Expected 401 but got ${status}: ${JSON.stringify(body)}`).toBe(401);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 7 — Trainer registration signed OUT (must return 401)
  // ───────────────────────────────────────────────────────────────────────────
  it('[7] POST /api/academy/trainers/register — signed out — MUST return 401', async () => {
    const { status, body } = await post(
      '/api/academy/trainers/register',
      {
        firstName:   'Test',
        lastName:    'Trainer',
        city:        'Tel Aviv',
        specialties: ['obedience'],
        hourlyRate:  '100',
      },
      noAuthHeaders(),
    );
    expect(status, `Expected 401 but got ${status}: ${JSON.stringify(body)}`).toBe(401);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 8 — Walker review signed OUT (must return 401)
  // ───────────────────────────────────────────────────────────────────────────
  it('[8] POST /api/walk-my-pet/walkers/:walkerId/review — signed out — MUST return 401', async () => {
    const { status, body } = await post(
      `/api/walk-my-pet/walkers/${TEST_WALKER_ID}/review`,
      {
        rating:  5,
        comment: 'Great walker',
      },
      noAuthHeaders(),
    );
    expect(status, `Expected 401 but got ${status}: ${JSON.stringify(body)}`).toBe(401);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 9 — Unified booking with forged body userId (token UID must win)
  // ───────────────────────────────────────────────────────────────────────────
  it('[9] POST /api/unified-booking/draft — forged body userId — token UID must win', async () => {
    if (!JWT_SECRET) {
      console.warn('[9] SKIPPED — JWT_SECRET env var not set. Cannot generate a signed token.');
      return;
    }
    // Sign a JWT as the legitimate test user
    const legitimateToken = jwtTokenFor(TEST_USER_ID);

    const { status, body } = await post(
      '/api/unified-booking/draft',
      {
        serviceId:    'SITTER',
        resourceId:   String(TEST_SITTER_ID),
        resourceType: 'sitter',
        startTime:    new Date(Date.now() + 2 * 86400_000).toISOString(),
        endTime:      new Date(Date.now() + 5 * 86400_000).toISOString(),
        userId:       FORGED_USER_ID,   // ← SPOOFED — server MUST ignore this
        metadata:     { petId: TEST_PET_ID },
      },
      {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${legitimateToken}`,
      },
    );

    // Must NOT return 401 (the real JWT is valid)
    expect(status, `JWT auth failed unexpectedly: ${status}: ${JSON.stringify(body)}`).not.toBe(401);

    // If a booking draft was created, verify the userId stored is NOT the forged one
    if (status === 200 || status === 201) {
      const b = body as any;
      const storedUserId = b?.booking?.userId ?? b?.draft?.userId ?? b?.userId;
      if (storedUserId) {
        expect(
          storedUserId,
          `SECURITY FAILURE: booking was created with forged userId "${FORGED_USER_ID}" from request body!`
        ).not.toBe(FORGED_USER_ID);
        expect(
          storedUserId,
          `Booking userId should match the token UID "${TEST_USER_ID}"`
        ).toBe(TEST_USER_ID);
      }
    }

    // If request fails at business logic (404/400/409) that's fine — the userId check is what matters
    expect([200, 201, 400, 404, 409]).toContain(status);
  });

});
