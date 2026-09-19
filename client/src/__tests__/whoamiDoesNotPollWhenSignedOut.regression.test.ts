import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 2026-09-19, production logs for the preceding 24h:
 *   /api/session/whoami 401 x654 — the single most frequent line in the
 *   entire service, on a platform with 15 registered users.
 *
 * useWhoami polled every 5 minutes unconditionally, so every open tab kept
 * asking "who am I" forever, including visitors who were not signed in and
 * never signed in during the visit. Each call is a Cloud Run invocation that
 * also keeps the instance from scaling to zero — which is exactly what the
 * min-instances=0 cost cut (CEO, 2026-08-01) was for.
 *
 * The poll exists to catch a role escalation on a SIGNED-IN session. A
 * signed-out session cannot change role without a login, and AuthProvider
 * already invalidates this query on every auth-state change.
 */
const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'auth', 'useWhoami.ts'),
  'utf8',
);

describe('whoami does not poll a signed-out visitor', () => {
  it('refetchInterval is a function of the query, not a bare number', () => {
    expect(src).toMatch(/refetchInterval:\s*\(query\)\s*=>/);
    expect(src).not.toMatch(/refetchInterval:\s*\d/);
  });

  it('it polls only when the last answer said authenticated', () => {
    const m = src.match(/refetchInterval:\s*\(query\)\s*=>([\s\S]{0,160})/);
    expect(m).toBeTruthy();
    const body = m![1];
    expect(body).toContain('authenticated === true');
    // and it must stop entirely otherwise
    expect(body).toContain('false');
  });

  it('a 4xx is still never retried — that answer cannot heal', () => {
    // Kept from 2026-09-17: retrying a 401 just repeats the question, and it
    // force-refreshed the Google token each time (13 calls in a row).
    expect(src).toContain('status >= 400 && status < 500) return false');
  });
});
