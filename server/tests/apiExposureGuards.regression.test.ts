/**
 * Pre-launch API exposure sweep (2026-08-06): four endpoints were open and got
 * guarded. These pins keep them from silently re-opening — a mount that drops its
 * auth guard fails this test loudly instead of shipping an anonymous hole.
 *   1. /api/translate            — calls paid Gemini → anon cost abuse
 *   2. /api/expansion/optimizer  — internal proposal mutation
 *   3. POST /api/observances/populate — unauthenticated Firestore reseed
 *   4. POST /api/monitoring/reset     — unauthenticated metrics tampering
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const routes = readFileSync(resolve(__dirname, '..', 'routes.ts'), 'utf8');

// Grab the middleware list on a given app.use('<path>', ...) mount.
function mountGuards(path: string): string {
  const m = routes.match(new RegExp(`app\\.use\\('${path.replace(/\//g, '\\/')}'([^)]*)\\)`));
  return m ? m[1] : '';
}

describe('open-API guards stay in place', () => {
  it('/api/translate requires auth (paid-Gemini cost abuse)', () => {
    expect(mountGuards('/api/translate')).toMatch(/validateFirebaseToken/);
  });
  it('/api/expansion/optimizer is admin-gated', () => {
    const g = mountGuards('/api/expansion/optimizer');
    expect(g).toMatch(/validateFirebaseToken/);
    expect(g).toMatch(/requireAdmin/);
  });
  it('POST /api/observances/populate is admin-gated (reads stay public)', () => {
    const g = mountGuards('/api/observances/populate');
    expect(g).toMatch(/validateFirebaseToken/);
    expect(g).toMatch(/requireAdmin/);
  });
  it('POST /api/monitoring/reset is admin-gated (health stays public)', () => {
    const g = mountGuards('/api/monitoring/reset');
    expect(g).toMatch(/validateFirebaseToken/);
    expect(g).toMatch(/requireAdmin/);
  });
});
