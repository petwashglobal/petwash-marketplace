/**
 * Contractor PII read-gate cluster — regression pins (2026-07-08).
 *
 * Read-endpoint audit: several contractor/compliance READ routes were mounted
 * under authMiddleware (authentication only) but forgot the role/ownership gate
 * that their sibling WRITE routes already had — leaking raw government-ID data to
 * any logged-in user:
 *
 *   1. GET /api/contractors            → whole contractor roster (enumeration).
 *   2. GET /api/contractors/:id        → identity_documents = national ID /
 *      passport / licence NUMBERS for any contractor.
 *   3. GET /api/drivers                → every driver's licence record.
 *   4. GET /.../:id/identity-docs      → FAIL-OPEN: ownership was enforced only
 *      when the caller's roles included "contractor", so a customer / empty-roles
 *      token skipped it and read ID-document FILES.
 *   5. GET /.../:id/compliance-status  → any contractor's compliance dossier.
 *
 * Fixes: 1-3 gated to admin/hr/compliance; 4 made fail-closed (privileged OR the
 * owning contractor, else 403); 5 restricted to compliance staff. The admin
 * privilege surface itself was separately audited and found clean.
 *
 * Source-level pins (same style as credit-wallet-confirm-idor.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const FRAMEWORK = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'contractors-framework.ts'), 'utf8');
const IDENTITY = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'compliance-identity.ts'), 'utf8');
const BRAIN = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'compliance-brain.ts'), 'utf8');

describe('contractor PII read-gate cluster (2026-07-08)', () => {
  it('GET /contractors is role-gated (roster no longer public to any user)', () => {
    expect(FRAMEWORK).toMatch(/router\.get\("\/contractors",\s*authMiddleware,\s*requireRoles\("admin",\s*"hr",\s*"compliance"\)/);
  });

  it('GET /contractors/:id (national-ID / passport numbers) is role-gated', () => {
    expect(FRAMEWORK).toMatch(/router\.get\("\/contractors\/:id",\s*authMiddleware,\s*requireRoles\("admin",\s*"hr",\s*"compliance"\)/);
  });

  it('GET /drivers (licence records) is role-gated', () => {
    expect(FRAMEWORK).toMatch(/router\.get\("\/drivers",\s*authMiddleware,\s*requireRoles\("admin",\s*"hr",\s*"compliance"\)/);
  });

  it('identity-docs is FAIL-CLOSED: privileged OR owning contractor, else 403', () => {
    // no longer a bare `if (req.authRoles.includes("contractor"))` ownership-only gate
    expect(IDENTITY).toMatch(/isPrivileged\s*=\s*\(req\.authRoles \|\| \[\]\)\.some/);
    expect(IDENTITY).toMatch(/isOwningContractor\s*=/);
    expect(IDENTITY).toMatch(/if \(!isOwningContractor\)/);
  });

  it('compliance-status is restricted to compliance staff', () => {
    expect(BRAIN).toMatch(/compliance-status".*authMiddleware/);
    expect(BRAIN).toMatch(/restricted to compliance staff/);
  });
});
