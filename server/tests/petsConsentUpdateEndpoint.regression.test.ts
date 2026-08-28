/**
 * CEO §22 + §4 (2026-08-28) — owner-controlled medical-share consent.
 *
 * buildServerSafetySnapshot / projectStoredSafetyForProvider both gate
 * on the PostgreSQL pets row's medicalShareConsent flag, but until
 * this commit no code path let the owner flip that flag with an audit
 * trail. Consent silently stayed at the DB default forever.
 *
 * POST /api/pets/:petId/consent — owner-only, audit-stamped write of
 * medicalShareConsent + medicalDataPrivate mirror + medicalConsentUpdatedAt.
 * Source-pin regression on the shape.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'pets.ts'),
  'utf8',
);

describe('POST /api/pets/:petId/consent — owner-controlled medical-share (CEO §22)', () => {
  it('mounts a POST at /:petId/consent behind validateFirebaseToken', () => {
    expect(SRC).toMatch(/router\.post\('\/:petId\/consent', validateFirebaseToken/);
  });

  it('rejects a non-boolean medicalShareConsent (never coerces)', () => {
    // A coercion (e.g. truthy check on "false") could flip consent by
    // accident. Contract: must be a real boolean.
    expect(SRC).toMatch(/if \(typeof raw !== 'boolean'\)/);
    expect(SRC).toMatch(/errorCode:\s*'CONSENT_MUST_BE_BOOL'/);
  });

  it('mirrors medicalDataPrivate = !medicalShareConsent — every branch writes both columns atomically', () => {
    // Two lookup shapes (numeric id OR name), both must write the pair.
    expect(SRC).toMatch(/\[raw, !raw, petIdNum, uid\]/);
    expect(SRC).toMatch(/\[raw, !raw, uid, petName\]/);
    expect(SRC).toMatch(/medical_share_consent = \$1,/);
    expect(SRC).toMatch(/medical_data_private  = \$2,/);
  });

  it('stamps medical_consent_updated_at = NOW() for audit', () => {
    expect(SRC).toMatch(/medical_consent_updated_at = NOW\(\)/);
  });

  it('cross-user attempt returns 404 — every WHERE clause pins user_id', () => {
    // The UPDATE keys on both id (or name) AND user_id, so a caller
    // poking another owner gets rowCount === 0 → 404 (never confirms
    // whether the record exists to a non-owner).
    expect(SRC).toMatch(/WHERE id = \$3 AND user_id = \$4/);
    expect(SRC).toMatch(/WHERE user_id = \$3 AND name = \$4/);
    expect(SRC).toMatch(/errorCode:\s*'PET_NOT_FOUND'/);
  });

  it('accepts EITHER a numeric petId in the URL OR a petName in the body (cross-store lookup)', () => {
    // Firestore pets have string IDs; Postgres pets are integer. Force
    // clients to know the Postgres row id would keep this endpoint
    // dark — accept the name path so the client's /api/pets consumers
    // can flip consent immediately.
    expect(SRC).toMatch(/const isNumericId = Number\.isFinite\(petIdNum\) && petIdNum > 0/);
    expect(SRC).toMatch(/req\.body\?\.petName/);
    expect(SRC).toMatch(/errorCode:\s*'PET_LOOKUP_KEY_REQUIRED'/);
  });

  it('fail-CLOSED on DB error — 502 with distinct code, no half-succeeded write', () => {
    expect(SRC).toMatch(/consent update FAILED — flag NOT written/);
    expect(SRC).toMatch(/status\(502\)/);
    expect(SRC).toMatch(/errorCode:\s*'CONSENT_UPDATE_FAILED'/);
  });

  it('rejects a request with neither a numeric petId nor a petName', () => {
    expect(SRC).toMatch(/if \(!isNumericId && !petName\)/);
  });
});
