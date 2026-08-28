/**
 * CEO §46 (2026-08-28) — /my/status also emits per-section state.
 *
 * The applicant-side ProviderApplicationStatus.tsx reads /my/status,
 * not /application/status. This test pins the section-status DTO on
 * /my/status: same six sections, same status labels, same rules that
 * match the admin surface.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('/api/provider-onboarding/my/status returns sectionStatus (CEO §46)', () => {
  it('emits sectionStatus alongside application (existing shape stays)', () => {
    // Anchor near the /my/status handler explicitly so we don't
    // accidentally match /application/status's DTO.
    const start = SRC.indexOf("router.get('/my/status'");
    expect(start).toBeGreaterThan(0);
    const end = SRC.indexOf('router.post(\'/withdraw\'', start);
    const block = SRC.slice(start, end);
    expect(block).toMatch(/sectionStatus,/);
    // Existing shape stays — application + resubmissionToken +
    // resubmitUrl unchanged.
    expect(block).toMatch(/application:/);
    expect(block).toMatch(/resubmissionToken,/);
    expect(block).toMatch(/resubmitUrl:/);
  });

  it('projects the six canonical sections in the /my/status block', () => {
    const start = SRC.indexOf("router.get('/my/status'");
    const end = SRC.indexOf('router.post(\'/withdraw\'', start);
    const block = SRC.slice(start, end);
    for (const key of ['profile:', 'identity:', 'insurance:', 'background:', 'bank:', 'declarations:']) {
      expect(block).toMatch(new RegExp(`sections:\\s*\\{[\\s\\S]{0,800}${key}`));
    }
  });

  it('the section rules read the /my/status snake_case shape (same source as the SQL)', () => {
    // The applicant-side endpoint SELECT uses snake_case — the
    // section logic must consume the same names, otherwise a rename
    // would give incorrect statuses to real applicants.
    const start = SRC.indexOf("router.get('/my/status'");
    const end = SRC.indexOf('router.post(\'/withdraw\'', start);
    const block = SRC.slice(start, end);
    expect(block).toMatch(/app\.first_name/);
    expect(block).toMatch(/app\.insurance_policy_number/);
    expect(block).toMatch(/app\.self_declaration_no_relevant_convictions/);
  });

  it('bank readiness derives from bank_iban + bank_account_holder via the extra query', () => {
    expect(SRC).toMatch(/hasBank = !!\(r\.bank_iban && r\.bank_account_holder\)/);
  });

  it('declarations readiness reads internal_notes.declarations key count', () => {
    expect(SRC).toMatch(/notes\.declarations && Object\.keys\(notes\.declarations\)\.length > 0/);
  });

  it('best-effort: section-status DB failure downgrades to action_required (never crashes /my/status)', () => {
    // Applicants MUST still see their overall status even if the
    // section signals query fails. The section booleans stay false
    // → each section renders action_required.
    const start = SRC.indexOf("router.get('/my/status'");
    const end = SRC.indexOf('router.post(\'/withdraw\'', start);
    const block = SRC.slice(start, end);
    expect(block).toMatch(/let hasIdentityDocs = false;\s*\n\s*let hasBank = false;/);
    expect(block).toMatch(/} catch \{ \/\* section-status is best-effort/);
  });
});
