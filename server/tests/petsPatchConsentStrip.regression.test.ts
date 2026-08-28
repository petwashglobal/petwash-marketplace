/**
 * CEO §22 (2026-08-28) — PATCH /api/pets/:petId cannot flip
 * medicalShareConsent (must go through POST /:petId/consent).
 *
 * Consent flips carry three preconditions:
 *   1. medicalConsentUpdatedAt audit stamp,
 *   2. medicalDataPrivate mirror = !share,
 *   3. Postgres pets row update so booking-time snapshot builder
 *      (buildServerSafetySnapshot) reads the new value.
 *
 * The dedicated /consent endpoint enforces all three. The generic
 * PATCH cannot — allowing consent through PATCH would be a stealth-
 * share bug: a client could flip the flag without an audit stamp
 * and without the Postgres mirror.
 *
 * Fix: strip medicalShareConsent + medicalDataPrivate +
 * medicalConsentUpdatedAt from the PATCH body, log a warn so the
 * mismatched call is visible, and force the client to use the
 * dedicated endpoint.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'pets.ts'),
  'utf8',
);

describe('PATCH /api/pets/:petId strips consent-only fields (CEO §22)', () => {
  it('declares a CONSENT_ONLY_ROUTE allowlist covering the three consent fields', () => {
    expect(SRC).toMatch(/const CONSENT_ONLY_ROUTE = new Set\(\[/);
    expect(SRC).toMatch(/'medicalShareConsent'/);
    expect(SRC).toMatch(/'medicalDataPrivate'/);
    expect(SRC).toMatch(/'medicalConsentUpdatedAt'/);
  });

  it('deletes each stripped field from the parsed body and logs a warn', () => {
    // Anchor to the PATCH handler block.
    const start = SRC.indexOf("router.patch('/:petId'");
    expect(start).toBeGreaterThan(0);
    const end = SRC.indexOf("router.post('/:petId/consent'", start);
    const block = SRC.slice(start, end);
    // for-of loop over the allowlist keys.
    expect(block).toMatch(/for \(const key of CONSENT_ONLY_ROUTE\)/);
    expect(block).toMatch(/delete \(parsed as any\)\[key\]/);
    expect(block).toMatch(/logger\.warn\('\[Pets\] PATCH stripped consent field/);
    // Log includes the redirect to the correct endpoint.
    expect(block).toMatch(/use POST \/:petId\/consent/);
  });

  it('the strip runs BEFORE the Firestore .update() call — the DB never sees the flag from PATCH', () => {
    const start = SRC.indexOf("router.patch('/:petId'");
    const end = SRC.indexOf("router.post('/:petId/consent'", start);
    const block = SRC.slice(start, end);
    const stripIdx  = block.indexOf('for (const key of CONSENT_ONLY_ROUTE)');
    const updateIdx = block.indexOf('petRef.update(updates)');
    expect(stripIdx).toBeGreaterThan(0);
    expect(updateIdx).toBeGreaterThan(0);
    expect(stripIdx).toBeLessThan(updateIdx);
  });

  it('the dedicated /consent endpoint stays the ONLY route that writes medical_consent_updated_at', () => {
    // If a rename or refactor accidentally adds the timestamp to the
    // PATCH block, we lose the audit stamp guarantee. Assert the
    // PATCH block does NOT write medical_consent_updated_at anywhere.
    const start = SRC.indexOf("router.patch('/:petId'");
    const end = SRC.indexOf("router.post('/:petId/consent'", start);
    const block = SRC.slice(start, end);
    expect(block).not.toMatch(/medical_consent_updated_at/);
  });
});
