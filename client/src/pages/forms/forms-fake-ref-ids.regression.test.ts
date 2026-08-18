import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression pins for the 2026-08-18 batch fix: apiRequest returns a
// Promise<Response>, not the parsed body. Reading `res.someId` directly makes
// every server-issued reference (signatureId, bookingRef, applicationId, etc.)
// undefined, so the customer sees a fabricated fallback string that doesn't
// match the row the server wrote. That's especially bad on the legally-binding
// legal-agreement surface (audit finding sev 5).

const FILES = [
  'LegalAgreementForm.tsx',
  'QuickBookingForm.tsx',
  'RefundForm.tsx',
  'ProviderRegistrationForm.tsx',
  'CustomerOnboardingForm.tsx',
  'HRApplicationForm.tsx',
  'SalesLeadForm.tsx',
];

describe('client/src/pages/forms fake-ref-id fix (audit 2026-08-18)', () => {
  for (const f of FILES) {
    const src = readFileSync(join(__dirname, f), 'utf8');

    it(`${f} awaits res.json() before reading the server ID`, () => {
      expect(src).toMatch(/const\s+res\s*=\s*await\s+apiRequest\(/);
      expect(src).toMatch(/const\s+body\s*=\s*await\s+res\.json\(\)/);
    });

    it(`${f} does not reintroduce the raw "await apiRequest(...) as any" shape`, () => {
      const stripped = src.replace(/\/\/[^\n]*/g, '');
      expect(stripped).not.toMatch(/await\s+apiRequest\([^)]+\)\s+as\s+any/);
    });
  }
});
