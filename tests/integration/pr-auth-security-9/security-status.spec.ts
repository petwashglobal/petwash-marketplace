/**
 * PR-AUTH-SECURITY-9 §2 — Security Status endpoint + panel regressions.
 *
 * File-level guards that pin the SHAPE of the Account > Security surface:
 *   (a) server endpoint derives identity from the Firebase session (never body/query),
 *   (b) the client panel reads server truth on every mount (staleTime/gcTime 0),
 *   (c) NO row is inferred from localStorage / sessionStorage.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

describe('PR-AUTH-SECURITY-9 §2 — Security status endpoint + panel', () => {
  const endpoint = read('server/routes/security-status.ts');
  const panel = read('client/src/components/security/SecurityStatusPanel.tsx');
  const routes = read('server/routes.ts');

  it('server: /api/security/status exists and is READ-ONLY (GET only)', () => {
    expect(endpoint).toMatch(/router\.get\('\/status'/);
    expect(endpoint).not.toMatch(/router\.(post|put|patch|delete)\(/);
  });

  it('server: identity is derived from Firebase session — no body/query.uid or .email', () => {
    expect(endpoint).toMatch(/resolveAuthedSecurity/);
    expect(endpoint).toMatch(/firebaseAdminAuth\.verify(IdToken|SessionCookie)/);
    // No trust of client-supplied identity fields.
    expect(endpoint).not.toMatch(/req\.body\.email/);
    expect(endpoint).not.toMatch(/req\.query\.email/);
    expect(endpoint).not.toMatch(/req\.body\.uid/);
    expect(endpoint).not.toMatch(/req\.query\.uid/);
  });

  it('server: returns every required row shape', () => {
    for (const key of ['email', 'mobile', 'password', 'passkey', 'pin', 'trustedDevices', 'mfa', 'sessions']) {
      expect(endpoint).toMatch(new RegExp(`\\b${key}:\\s*\\{`));
    }
  });

  it('server: password comes from Firebase providerData (not from DB heuristic)', () => {
    expect(endpoint).toMatch(/providerData[\s\S]{0,60}providerId\s*===\s*'password'/);
  });

  it('server: MFA counts BOTH Firebase enrolledFactors AND mfa_enrollments', () => {
    expect(endpoint).toMatch(/enrolledFactors/);
    expect(endpoint).toMatch(/mfaEnrollments/);
  });

  it('server: unavailable rows are labelled — no fake "0" for trustedDevices/sessions', () => {
    expect(endpoint).toMatch(/trustedDevices:[\s\S]{0,120}available:\s*false/);
    expect(endpoint).toMatch(/sessions:[\s\S]{0,120}available:\s*false/);
  });

  it('server: mount — /api/security is registered', () => {
    expect(routes).toMatch(/\/api\/security['"]?\s*,[\s\S]{0,120}securityStatusRoutes/);
  });

  it('client panel: every row reads server truth (no localStorage read)', () => {
    expect(panel).toMatch(/useQuery/);
    expect(panel).toMatch(/'\/api\/security\/status'/);
    // Panel MUST NOT infer any row from localStorage.
    expect(panel).not.toMatch(/localStorage\.getItem/);
    expect(panel).not.toMatch(/sessionStorage\.getItem/);
  });

  it('client panel: cacheTime/staleTime 0 so Back-button never shows stale status', () => {
    expect(panel).toMatch(/gcTime:\s*0/);
    expect(panel).toMatch(/staleTime:\s*0/);
    expect(panel).toMatch(/refetchOnMount:\s*'always'/);
  });

  it('client panel: renders explicit "Not yet available" pill for unavailable rows', () => {
    expect(panel).toMatch(/Not yet available/);
    expect(panel).toMatch(/data\.trustedDevices\.available/);
    expect(panel).toMatch(/data\.sessions\.available/);
  });
});
