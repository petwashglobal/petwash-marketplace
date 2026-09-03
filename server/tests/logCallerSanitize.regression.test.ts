/**
 * Post-release 2026-09-03 (backlog P1 · AUDIT-LOG-2 / AUDIT-LOG-4):
 * per-caller sanitize sweep. The strategic redactor wired into
 * ServerLogger.formatLog scrubs known secret KEYS globally, but
 * these three callers were spreading whole request bodies verbatim
 * where the redactor cannot help (the payload's inner keys aren't in
 * the secret-key set). Callers now emit allowlisted fields only.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

describe('log-caller sanitize · birthdayVoucher (AUDIT-LOG-4)', () => {
  const src = read('server/birthdayVoucher.ts');

  it('imports redactEmail', () => {
    expect(src).toMatch(/import\s*\{\s*redactEmail\s*\}\s*from\s*['"]\.\/lib\/redaction['"]/);
  });

  it('logs codeSuffix instead of the full voucher code', () => {
    expect(src).toMatch(/codeSuffix\s*=\s*voucherCode\.slice\(-4\)/);
    expect(src).toMatch(/email:\s*redactEmail\(email\)/);
    // Old pattern must not sneak back
    expect(src).not.toMatch(/Birthday voucher created:\s*\$\{voucherCode\}\s*for\s*\$\{email\}/);
  });
});

describe('log-caller sanitize · nayaxService (AUDIT-LOG-2)', () => {
  const src = read('server/nayaxService.ts');

  it('handleSessionStarted allowlists correlation fields, does not spread payload', () => {
    // The old shape was `logger.info('Session started', { payload });`
    expect(src).not.toMatch(/logger\.info\('Session started',\s*\{\s*payload\s*\}\)/);
    // New shape logs the four correlation fields
    expect(src).toMatch(
      /logger\.info\('\[Nayax\] Session started',\s*\{[\s\S]*?transactionId:\s*payload\.transactionId/,
    );
  });

  it('handleQRScanned allowlists correlation fields, does not spread payload', () => {
    expect(src).not.toMatch(/logger\.info\('QR code scanned',\s*\{\s*payload\s*\}\)/);
    expect(src).toMatch(
      /logger\.info\('\[Nayax\] QR code scanned',\s*\{[\s\S]*?transactionId:\s*payload\.transactionId/,
    );
  });
});
