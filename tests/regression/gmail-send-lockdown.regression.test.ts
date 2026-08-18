import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'gmail.ts'),
  'utf8',
);

// Regression pin for the 2026-08-18 hidden-defect hunter finding:
// POST /api/gmail/send was gated on requireFirebaseAuth only — any Firebase-auth
// user could send arbitrary email FROM PetWash's Gmail identity, with CRLF
// header injection on top. This pin locks in the two hardenings.

describe('POST /api/gmail/send lockdown (2026-08-18 sev-5 fix)', () => {
  it('is gated on requireAdmin, not just requireFirebaseAuth', () => {
    expect(SRC).toMatch(/router\.post\(['"]\/send['"],\s*requireAdmin,/);
    const stripped = SRC.replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/router\.post\(['"]\/send['"],\s*requireFirebaseAuth,/);
  });

  it('rejects CRLF/NUL in to/subject headers to block CRLF injection', () => {
    expect(SRC).toMatch(/HEADER_UNSAFE\s*=\s*\/\[\\r\\n\\0\]\//);
    expect(SRC).toMatch(/HEADER_UNSAFE\.test\(to\)/);
    expect(SRC).toMatch(/HEADER_UNSAFE\.test\(subject\)/);
  });

  it('refuses comma-separated recipient lists', () => {
    expect(SRC).toMatch(/to\.includes\(['"],['"]\)/);
  });

  it('imports requireAdmin from adminAuth', () => {
    expect(SRC).toMatch(/import\s+\{\s*requireAdmin\s*\}\s+from\s+['"]\.\.\/adminAuth['"]/);
  });
});
