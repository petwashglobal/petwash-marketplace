import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression pins for the 2026-08-18 second wave of error-leak sanitize:
// compliance.ts (25 sites), kyc.ts (7), bookings.ts (6). Server routes must
// never echo error.message back to the client — those may include stack
// traces, DB constraint names, integration hostnames, or PII.

const ROOT = join(__dirname, '..', '..');

const FILES = [
  'server/routes/compliance.ts',
  'server/routes/kyc.ts',
  'server/routes/bookings.ts',
];

describe('server error-leak sanitize wave 2 (compliance / kyc / bookings)', () => {
  for (const f of FILES) {
    it(`${f} never echoes error.message`, () => {
      const raw = readFileSync(join(ROOT, f), 'utf8');
      const src = raw.replace(/\/\/[^\n]*/g, '');
      expect(src).not.toMatch(/error:\s*error\.message/);
      expect(src).not.toMatch(/error:\s*err\.message/);
    });
  }
});
