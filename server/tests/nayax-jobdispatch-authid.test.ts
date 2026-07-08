/**
 * Nayax job-dispatch auth-id field fix — regression pin (2026-07-08).
 *
 * Payment-conflict audit, LOW/latent: NayaxJobDispatchPaymentService authorized a
 * card hold and stored the auth reference as `authorizationId` on the
 * payment_intents insert — but the schema column is `nayax_authorization_id`
 * (Drizzle field nayaxAuthorizationId), and BOTH the capture and void paths read
 * `intent.nayaxAuthorizationId`. So the reference was never persisted → every
 * capture/void short-circuited with "Missing authorization ID". Fixed by writing
 * the correct field. Pins the write/read field names in agreement.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'NayaxJobDispatchPaymentService.ts'),
  'utf8',
);

describe('Nayax job-dispatch auth-id persistence (2026-07-08)', () => {
  it('the insert writes nayaxAuthorizationId (the real column)', () => {
    expect(SRC).toMatch(/nayaxAuthorizationId:\s*authResponse\.AuthorizationId/);
  });

  it('capture + void read the SAME field they now write', () => {
    // both guards read intent.nayaxAuthorizationId — must match the write above
    const reads = SRC.match(/if \(!intent\.nayaxAuthorizationId\)/g) ?? [];
    expect(reads.length).toBeGreaterThanOrEqual(2);
  });

  it('the insert no longer writes the phantom authorizationId column', () => {
    // the insert .values block must not set a bare authorizationId field
    expect(SRC).not.toMatch(/status: 'authorized',\s*\n\s*authorizationId:/);
  });
});
