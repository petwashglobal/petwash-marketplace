/**
 * Gap 2 — app_sessions was a dormant table (no writer). A /api/track/session
 * endpoint now records sessions, keyed by a pseudonymous (hashed) subject id —
 * never the raw uid — and never breaks the client.
 *
 * Source-introspection (the handler is DB-bound in a huge routes file).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');
const start = src.indexOf("'/api/track/session'");
const region = src.slice(start, start + 2200);

describe('Gap 2 — app-session writer', () => {
  it('the endpoint exists', () => {
    expect(start).toBeGreaterThan(-1);
  });
  it('inserts app_sessions with a hashed pseudonymous subjectId (never raw uid)', () => {
    expect(region).toMatch(/db\.insert\(appSessions\)/);
    expect(region).toMatch(/subjectId,/);
    expect(region).toMatch(/crypto\.createHash\('sha256'\)\.update\(`apps:/);
    expect(region).not.toMatch(/firebaseUid/);
  });
  it('supports start + end (duration on end)', () => {
    expect(region).toMatch(/action === 'end'/);
    expect(region).toMatch(/endedAt:/);
    expect(region).toMatch(/durationS:/);
  });
  it('validates surface against the allowed set', () => {
    expect(region).toMatch(/'app', 'web', 'station_kiosk'/);
  });
});
