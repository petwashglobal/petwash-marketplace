import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression pins for the 2026-08-18 error-leak sanitize batch. Server routes
// must never echo error.message (or the internal .details) back to the client
// — those may include stack traces, DB constraint names, integration hostnames,
// or PII. Log the raw error server-side; return a static message.

const ROOT = join(__dirname, '..', '..');

describe('server error-leak sanitize (2026-08-18)', () => {
  it('server/routes/fcm.ts never echoes error.message', () => {
    const src = readFileSync(join(ROOT, 'server/routes/fcm.ts'), 'utf8');
    expect(src).not.toMatch(/error:\s*error\.message/);
    expect(src).not.toMatch(/error:\s*err\.message/);
  });

  it('server/routes/globalServices.ts never echoes error.message', () => {
    const src = readFileSync(join(ROOT, 'server/routes/globalServices.ts'), 'utf8');
    expect(src).not.toMatch(/error:\s*error\.message/);
    expect(src).not.toMatch(/error:\s*err\.message/);
  });

  it('server/routes/biometric-certificates.ts never returns raw error via details', () => {
    const src = readFileSync(join(ROOT, 'server/routes/biometric-certificates.ts'), 'utf8');
    expect(src).not.toMatch(/details:\s*error\.message/);
    expect(src).not.toMatch(/details:\s*err\.message/);
  });
});
