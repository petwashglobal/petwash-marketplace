/**
 * /api/users/create-profile — retired (old-layer audit 2026-09-12).
 *
 * History: 2026-07-08 pinned an 18+ floor + authLimiter on this social
 * account-mint endpoint. Since /complete-profile (#2402) no client calls it,
 * and it accepted a CLIENT-supplied consent text hash as legal evidence, so
 * the whole handler is gone and the path answers 410 GONE (still behind
 * authLimiter so a scripted caller cannot use it as a probe).
 *
 * The 18+ floor now lives in the canonical rail: post-login refuses profile
 * completion without the explicit attestation (AGE_CONFIRMATION_REQUIRED).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROUTES = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');
const POST_LOGIN = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'post-login.ts'), 'utf8');

describe('create-profile is sealed (2026-09-12)', () => {
  it('the path answers 410 behind authLimiter and no handler body remains', () => {
    expect(ROUTES).toMatch(/app\.post\('\/api\/users\/create-profile',\s*authLimiter,\s*\(_req, res\) => \{\s*\n\s*logger\.warn\([^\n]*\n\s*return res\.status\(410\)/);
    expect(ROUTES.match(/app\.post\('\/api\/users\/create-profile'/g)?.length).toBe(1);
    expect(ROUTES).not.toContain('[CreateProfile] Processing');
  });
  it('the unauthenticated /api/consent/onboarding writer is sealed too', () => {
    expect(ROUTES).toMatch(/app\.post\('\/api\/consent\/onboarding',\s*authLimiter,\s*\(_req, res\) => \{/);
    expect(ROUTES).not.toContain("origin: '/api/consent/onboarding'");
  });
  it('the 18+ floor lives on the canonical rail', () => {
    expect(POST_LOGIN).toContain('AGE_CONFIRMATION_REQUIRED');
  });
});
