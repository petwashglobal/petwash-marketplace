import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * A STALE WALLET LINK MUST NOT REPORT "Pass generation failed" (2026-09-12)
 *
 * From the CEO's phone: tapping "הוסף ל-Apple Wallet" ended at
 * **"Safari cannot download this file."**
 *
 * Verified against production: GET /api/pass/apple/<bogus> answers
 * `500 {"ok":false,"error":"Pass generation failed"}` — NOT the 503 that would
 * mean certificates are missing. So the certs ARE configured; a token problem
 * was being reported as a server-side generation failure.
 *
 * Mechanism: `lookupPassByToken` THROWS on a bad or expired token, so the
 * `if (!pass) return 404` branch in each caller is unreachable and control
 * jumps to the catch. The HTML route mapped all four token errors; the two
 * routes that deliver the actual file handled only TOKEN_EXPIRED, so
 * INVALID_SIGNATURE / INVALID_TOKEN_FORMAT / INVALID_PURPOSE all became a 500.
 *
 * Behavioural on the mapper — it is pure, so its output is asserted directly
 * rather than grepping for the shape of a catch block.
 */
const SRC = readFileSync(
  resolve(__dirname, '../routes/pass-universal.ts'),
  'utf8',
);

// Imported for real, not reconstructed from source. An earlier version of this
// test rebuilt the function with `new Function` on the extracted TypeScript and
// died on the type annotations — exporting the pure helper is both simpler and
// actually tests the code that ships.
import { tokenErrorResponse as map } from '../routes/pass-universal';

describe('wallet link token errors', () => {
  it('an expired link says expired, and is not a 500', () => {
    const r = map({ message: 'TOKEN_EXPIRED' });
    expect(r?.status).toBe(410);
    expect(r?.error).toMatch(/expired/i);
  });

  it.each(['INVALID_SIGNATURE', 'INVALID_TOKEN_FORMAT', 'INVALID_PURPOSE'])(
    '%s is a 403 about the link, never a 500 about generation',
    (code) => {
      const r = map({ message: code });
      expect(r).not.toBeNull();
      expect(r!.status).toBe(403);
      expect(r!.error).not.toMatch(/generation/i);
    },
  );

  it('tells the customer what to DO, not just that it broke', () => {
    for (const code of ['TOKEN_EXPIRED', 'INVALID_SIGNATURE']) {
      expect(map({ message: code })!.error).toMatch(/PetWash app/);
    }
  });

  it('a genuine generation failure is NOT swallowed as a token error', () => {
    // Otherwise a real signing bug would be reported to the customer as a
    // stale link and nobody would ever fix it.
    expect(map({ message: 'ENOENT: no such file or directory' })).toBeNull();
    expect(map(new Error('certificate expired'))).toBeNull();
    expect(map(undefined)).toBeNull();
  });
});

describe('both file-delivering routes use the mapper', () => {
  it('appears three times: the helper plus the Apple and Google catches', () => {
    // The HTML route already mapped these correctly and is left alone.
    expect(SRC.split('tokenErrorResponse').length - 1).toBeGreaterThanOrEqual(3);
  });
});
