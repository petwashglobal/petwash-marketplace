import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 2026-09-17, mapping the CEO's first real booking: a walker approved from
 * the admin review screen could never be booked.
 *  1. provider-onboarding approve wrote `providers` + a starter rate card but
 *     no walker/sitter/trainer profile (search joins those) and no
 *     provider_profiles row (both accept gates read it).
 *  2. The Provider Control Tower keyed its ladder buttons on a
 *     provider_applicants id that the current wizard deletes on submit, so
 *     every button was disabled and no service could reach "booking".
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('admin review approval seeds what search and accept need', () => {
  const src = R('server/routes/provider-onboarding.ts');
  const approve = src.slice(src.indexOf("router.post('/admin/applications/approve'"));
  it('seeds the platform profiles', () => {
    expect(src).toContain("import { seedProviderProfiles } from '../services/providerProfileSeed';");
    expect(approve).toContain('await seedProviderProfiles(application as any, platformIds);');
  });
  it('upserts provider_profiles with the passed background check', () => {
    expect(approve).toMatch(/INSERT INTO provider_profiles \(user_id, background_check_status, created_at, updated_at\)\s+VALUES \(\$1, 'passed', NOW\(\), NOW\(\)\)\s+ON CONFLICT \(user_id\) DO UPDATE/);
  });
  it('the other approval path writes provider_profiles too', () => {
    expect(R('server/routes/provider-applications.ts')).toMatch(/INSERT INTO provider_profiles \(user_id, background_check_status, created_at, updated_at\)/);
  });
  it('provider_profiles has the columns written (migration 0010)', () => {
    const m = R('migrations/0010_registration_tables.sql');
    const t = m.slice(m.indexOf('CREATE TABLE IF NOT EXISTS "provider_profiles"'));
    for (const col of ['"user_id"', '"background_check_status"', '"created_at"', '"updated_at"']) expect(t.slice(0, 2500)).toContain(col);
  });
});

describe('the per-service ladder works for providers with no provider_applicants row', () => {
  const src = R('server/routes/provider-applications.ts');
  const route = src.slice(src.indexOf("router.post('/admin/provider/:providerUid/service/:serviceType/approve'"), src.indexOf("router.post('/admin/:applicationId/service/:serviceType/approve'"));
  it('exists, is admin-only, validates level + reason', () => {
    expect(route.length).toBeGreaterThan(200);
    expect(route).toContain('if (!callerIsAdmin(req)) {');
    expect(route).toContain('if (!ALLOWED_SERVICE_LEVELS.includes(level)) {');
    expect(route).toContain("if (!reason || String(reason).trim().length < 3) {");
  });
  it('only moves a service that approval seeded for this provider', () => {
    expect(route).toContain("error: 'SERVICE_NOT_APPLIED'");
    expect(route).toContain('eq(providerServices.providerId, providerUid)');
  });
  it('writes the audit against the approved application', () => {
    expect(route).toContain("eventType: 'provider_service_level_changed'");
    expect(route).toContain("eq(providerApplications.status, 'approved')");
  });
  it('the control tower uses it when there is no applicationId, and no longer disables the buttons', () => {
    const ui = R('client/src/pages/admin/AdminProviderControl.tsx');
    expect(ui).toContain('/api/provider-applications/admin/provider/${encodeURIComponent(action.row.providerId)}/service/');
    expect(ui).toContain('const noApp = !row.providerId;');
    expect(ui).not.toContain("throw new Error('לנותן שירות זה אין בקשה מקושרת");
  });
});
