/**
 * CEO §22 (2026-08-28) — client wire for the medical-share consent toggle.
 *
 * The server endpoint (POST /api/pets/:petId/consent) landed in
 * ee1791644 + d192761a0 (cross-store lookup by petName). This test
 * pins the CLIENT half: Pets.tsx renders a consent toggle on every
 * pet card and calls the endpoint with the (petName, medicalShareConsent)
 * body so Firestore-shaped ids still route to the Postgres row.
 *
 * Chain of custody now goes owner → toggle → server → Postgres →
 * next booking read → walker Today card (also pinned).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'Pets.tsx'),
  'utf8',
);

describe('Pets.tsx — medical share consent toggle (CEO §22 client wire)', () => {
  it('extends the Pet interface with an optional medicalShareConsent flag', () => {
    expect(SRC).toMatch(/medicalShareConsent\?:\s*boolean/);
  });

  it('declares consentMutation calling POST /api/pets/:petId/consent with (petName, medicalShareConsent)', () => {
    expect(SRC).toMatch(/const consentMutation = useMutation/);
    expect(SRC).toMatch(/apiRequest\('POST', `\/api\/pets\/\$\{input\.pet\.id\}\/consent`, \{/);
    expect(SRC).toMatch(/petName:\s*input\.pet\.name/);
    expect(SRC).toMatch(/medicalShareConsent:\s*input\.share/);
  });

  it('renders a per-pet consent row with data-testid anchors so E2E can find it', () => {
    expect(SRC).toMatch(/data-testid=\{`consent-row-\$\{pet\.id\}`\}/);
    expect(SRC).toMatch(/data-testid=\{`consent-toggle-\$\{pet\.id\}`\}/);
  });

  it('toggle reflects the current pet.medicalShareConsent === true state (strict boolean, not truthy)', () => {
    // A `!!pet.medicalShareConsent` would show ON for legacy pets
    // where the field is missing. Explicit === true is fail-safe.
    expect(SRC).toMatch(/aria-checked=\{pet\.medicalShareConsent === true\}/);
    expect(SRC).toMatch(/pet\.medicalShareConsent === true \? 'bg-emerald-500' : 'bg-gray-300'/);
  });

  it('onClick flips the current state via consentMutation.mutate — never a bare state write', () => {
    // A local optimistic state without the server call would be a
    // consent lie: the UI would show "on" while the backend keeps
    // "off". Always go through the mutation.
    expect(SRC).toMatch(/consentMutation\.mutate\(\{/);
    expect(SRC).toMatch(/share:\s*!\(pet\.medicalShareConsent === true\)/);
  });

  it('the copy describes WHAT sharing does, without pressuring the owner', () => {
    // CEO §6 discipline: neutral, informative — never "recommended"
    // language or shame framing.
    expect(SRC).toContain('Share medical details with providers');
    expect(SRC).toContain('שיתוף מידע רפואי עם מטפלים');
    // Explicitly ban pressure phrasing patterns.
    expect(SRC).not.toContain('recommended');
    expect(SRC).not.toContain('should share');
  });
});
