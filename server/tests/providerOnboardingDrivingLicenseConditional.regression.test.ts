/**
 * CEO §35 (2026-08-28) — driving-license inputs are conditional on the
 * driver applicant selection at BOTH client and server.
 *
 * Prior state: ProviderOnboarding.tsx declared drivingLicenseNumber /
 * Class / Expiry / File state hooks but never rendered a form section
 * for them, so drivers submitted empty licence data. Reviewers approved
 * "drivers" who had never given a licence number. Meanwhile a
 * non-driver applicant with stale state on a multi-role wizard could
 * theoretically POST driving-license fields to the /apply handler and
 * have them persisted — misleading later reviewers.
 *
 * Fix in this commit:
 *   Client — a bordered "Driving licence details" section renders
 *     ONLY when hasProviderType('driver'), with number / class /
 *     expiry / optional file input, all tagged with data-testid
 *     anchors so the CTA scanner can pin them.
 *   Server — the /apply handler destructures the raw fields but
 *     re-projects them as `undefined` unless the applicant selected
 *     'driver' in providerTypes[]. A stray field from a leaked wizard
 *     state can never persist onto a non-driver row.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CLIENT = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'ProviderOnboarding.tsx'),
  'utf8',
);
const SERVER = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('driving-license inputs conditional on driver applicant (CEO §35)', () => {
  describe('client — ProviderOnboarding.tsx', () => {
    it('the driving-license section is inside a hasProviderType("driver") conditional', () => {
      // Anchor to the section testid and walk backwards to find the
      // enclosing conditional.
      const idx = CLIENT.indexOf('data-testid="section-driving-license"');
      expect(idx).toBeGreaterThan(0);
      // The nearest hasProviderType('driver') before the section must
      // be the gate — no unconditional div wrapping this block.
      const preceding = CLIENT.slice(Math.max(0, idx - 500), idx);
      expect(preceding).toMatch(/hasProviderType\('driver'\) && \(/);
    });

    it('exposes stable testid anchors for the four inputs (scanner + E2E can find them)', () => {
      expect(CLIENT).toContain('data-testid="section-driving-license"');
      expect(CLIENT).toContain('data-testid="input-driving-license-number"');
      expect(CLIENT).toContain('data-testid="input-driving-license-class"');
      expect(CLIENT).toContain('data-testid="input-driving-license-expiry"');
      expect(CLIENT).toContain('data-testid="input-driving-license-file"');
    });

    it('inputs fire scheduleDraftSave onBlur — cross-device hydration keeps them', () => {
      // Same discipline as the bank-payout section: without onBlur the
      // debounce never fires and second device shows stale data.
      for (const tid of [
        'input-driving-license-number',
        'input-driving-license-class',
        'input-driving-license-expiry',
      ]) {
        const anchor = CLIENT.indexOf(`data-testid="${tid}"`);
        expect(anchor).toBeGreaterThan(0);
        const start = CLIENT.lastIndexOf('<input', anchor);
        const end   = CLIENT.indexOf('/>', anchor);
        const block = CLIENT.slice(start, end);
        expect(block).toMatch(/onBlur=\{scheduleDraftSave\}/);
      }
    });
  });

  describe('server — /apply strips driving-license for non-driver applicants', () => {
    it('destructures the raw fields as rawDrivingLicense* (server-owned normalisation)', () => {
      expect(SERVER).toMatch(/drivingLicenseNumber:\s*rawDrivingLicenseNumber/);
      expect(SERVER).toMatch(/drivingLicenseClass:\s*rawDrivingLicenseClass/);
      expect(SERVER).toMatch(/drivingLicenseExpiry:\s*rawDrivingLicenseExpiry/);
    });

    it('resolves isDriverApplicant from providerTypes[] (or the primary scalar as fallback)', () => {
      expect(SERVER).toMatch(/const isDriverApplicant = \(\(\) => \{/);
      expect(SERVER).toMatch(/return Array\.isArray\(arr\) && arr\.includes\('driver'\)/);
      expect(SERVER).toMatch(/rawProviderType === 'driver'/);
    });

    it('zeroes the three driving-license fields for non-driver applicants (undefined, not empty string — never persists)', () => {
      // A stray field from a leaked wizard state must NEVER land on a
      // non-driver row. The projection sets undefined so the drizzle
      // insert simply omits the column.
      expect(SERVER).toMatch(/const drivingLicenseNumber = isDriverApplicant \? rawDrivingLicenseNumber : undefined/);
      expect(SERVER).toMatch(/const drivingLicenseClass  = isDriverApplicant \? rawDrivingLicenseClass  : undefined/);
      expect(SERVER).toMatch(/const drivingLicenseExpiry = isDriverApplicant \? rawDrivingLicenseExpiry : undefined/);
    });
  });
});
