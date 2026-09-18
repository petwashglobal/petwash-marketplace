/**
 * Why every list on the site says 0 (provider audit + live sweep, 2026-09-18):
 *
 *  - a groomer could never exist: the approval had no groomer → platform
 *    mapping at all (so the whole seed block was skipped), and the other
 *    approval path mapped groomer → 'pet_wash_hub', which no search reads.
 *    /groomers searches providers.platform_id = 'groomers'.
 *  - every approved sitter was invisible: Browse Sitters post-filters on
 *    sitter_profiles.service_types, and NOTHING writes that column.
 *  - a sitter approved without a date of birth got no profile row at all
 *    (the column is NOT NULL, the seed skips, and the form had no field).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('a groomer can be approved into existence', () => {
  it('both approval paths map groomer to the platform the search reads', () => {
    expect(read('server/routes/provider-onboarding.ts')).toContain("groomer: 'groomers',");
    expect(read('server/routes/provider-applications.ts')).toContain("groomer:           'groomers',");
  });

  it('and that is the platform /groomers searches', () => {
    expect(read('server/services/providerSearchService.ts')).toContain('fetchByPlatform("groomers", "grooming"');
  });

  it('no approval path still routes a groomer to a platform nobody searches', () => {
    expect(read('server/routes/provider-applications.ts')).not.toContain("groomer:           'pet_wash_hub'");
  });
});

describe('an approved sitter is visible', () => {
  const search = read('server/services/providerSearchService.ts');

  it('an empty service list means the standard pet-sitting offer, not "hide me"', () => {
    expect(search).toContain('const DEFAULT_SITTER_SERVICES = ["boarding", "drop_in"];');
    expect(search).toContain('const services = recorded.length > 0 ? recorded : DEFAULT_SITTER_SERVICES;');
  });

  it('a sitter who recorded services keeps exactly those', () => {
    // the filter still runs against the recorded list when there is one
    const block = search.slice(search.indexOf('const DEFAULT_SITTER_SERVICES'), search.indexOf('Derive supported marketplace services'));
    expect(block).toContain('const required = SITTER_SERVICE_MAP[serviceType] ?? [];');
    expect(block).toContain('if (!services.some((sv) => required.includes(sv))) continue;');
  });

  it('pet sitting maps to boarding/drop-in, daycare to daycare', () => {
    expect(search).toContain('pet_sitting: ["boarding", "drop_in"]');
    expect(search).toContain('daycare: ["daycare"]');
  });
});

describe('a sitter applicant is asked for the date of birth the profile needs', () => {
  const form = read('client/src/pages/ProviderOnboarding.tsx');

  it('the field exists and is shown when applying as a sitter', () => {
    expect(form).toContain('data-testid="input-provider-dob"');
    expect(form).toContain("providerTypes.includes('sitter') && (");
  });

  it('you cannot continue without it, and the checklist says why', () => {
    expect(form).toContain("providerTypes.includes('sitter') && !dob)");
    expect(form).toContain('Date of birth (required for pet sitting)');
  });

  it('the profile seed still refuses to invent one', () => {
    const seed = read('server/services/providerProfileSeed.ts');
    expect(seed).toContain("reason: 'no_date_of_birth_on_application'");
  });
});
