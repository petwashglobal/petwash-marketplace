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

  it('mirrors medicalDataPrivate = !medicalShareConsent — always one atomic write', () => {
    // A partial write where share=true landed but private=true stayed
    // would leave the pet in an incoherent state (both share ON and
    // marked private). Assert the single UPDATE writes both.
    expect(SRC).toMatch(/medical_share_consent = \$1,/);
    expect(SRC).toMatch(/medical_data_private  = \$2,/);
    expect(SRC).toMatch(/\[raw, !raw, petIdNum, uid\]/);
  });

  it('stamps medical_consent_updated_at = NOW() for audit', () => {
    expect(SRC).toMatch(/medical_consent_updated_at = NOW\(\)/);
  });

  it('cross-user attempt returns 404 — WHERE clause pins user_id', () => {
    // The UPDATE keys on both id AND user_id, so a caller poking
    // another owner's petId gets rowCount === 0 → 404 (never confirms
    // whether the id exists).
    expect(SRC).toMatch(/WHERE id = \$3 AND user_id = \$4/);
    expect(SRC).toMatch(/errorCode:\s*'PET_NOT_FOUND'/);
  });

  it('fail-CLOSED on DB error — 502 with distinct code, no half-succeeded write', () => {
    expect(SRC).toMatch(/consent update FAILED — flag NOT written/);
    expect(SRC).toMatch(/status\(502\)/);
    expect(SRC).toMatch(/errorCode:\s*'CONSENT_UPDATE_FAILED'/);
  });

  it('rejects invalid petId shapes before touching the DB', () => {
    expect(SRC).toMatch(/const petIdNum = Number\(req\.params\.petId\)/);
    expect(SRC).toMatch(/if \(!Number\.isFinite\(petIdNum\) \|\| petIdNum <= 0\)/);
  });
});
