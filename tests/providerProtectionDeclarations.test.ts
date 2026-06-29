import { describe, it, expect } from 'vitest';
import {
  PROVIDER_DECLARATION_DOCS,
  PROVIDER_DECLARATION_BY_KEY,
  coreDeclarationDocs,
  requiredDeclarationsForScopes,
  allRequiredDocsCounselApproved,
} from '@shared/providerProtectionDeclarations';

describe('provider declaration registry — well-formed', () => {
  it('has unique keys', () => {
    const keys = PROVIDER_DECLARATION_DOCS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('every doc has version, titles, bodies, requiredFor', () => {
    for (const d of PROVIDER_DECLARATION_DOCS) {
      expect(d.version).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(d.titleEn.length).toBeGreaterThan(3);
      expect(d.titleHe.length).toBeGreaterThan(3);
      expect(d.bodyEn.length).toBeGreaterThan(20);
      expect(d.requiredFor.length).toBeGreaterThan(0);
    }
  });
  it('the by-key map matches the list', () => {
    expect(Object.keys(PROVIDER_DECLARATION_BY_KEY).length).toBe(PROVIDER_DECLARATION_DOCS.length);
  });
});

describe('required-docs logic', () => {
  it('core docs apply to every provider', () => {
    const core = coreDeclarationDocs();
    expect(core.length).toBeGreaterThanOrEqual(8);
    expect(core.every((d) => d.requiredFor.includes('ALL'))).toBe(true);
  });
  it('a walker needs core + walking, not hosting/academy/pettrek', () => {
    const keys = requiredDeclarationsForScopes(['WALK_MY_PET']).map((d) => d.key);
    expect(keys).toContain('independent_provider');
    expect(keys).toContain('insurance_disclosure');
    expect(keys).toContain('walking_protocol');
    expect(keys).not.toContain('home_hosting_protocol');
    expect(keys).not.toContain('academy_protocol');
    expect(keys).not.toContain('pettrek_transport_protocol');
  });
  it('a home-hosting sitter needs the hosting protocol', () => {
    const keys = requiredDeclarationsForScopes(['PET_SITTER_HOSTING']).map((d) => d.key);
    expect(keys).toContain('home_hosting_protocol');
    expect(keys).not.toContain('walking_protocol');
  });
  it('a provider offering multiple services gets the union', () => {
    const keys = requiredDeclarationsForScopes(['WALK_MY_PET', 'ACADEMY']).map((d) => d.key);
    expect(keys).toContain('walking_protocol');
    expect(keys).toContain('academy_protocol');
  });
});

describe('counsel-approval gate', () => {
  it('reports NOT approved while wording is still draft', () => {
    expect(allRequiredDocsCounselApproved(['WALK_MY_PET'])).toBe(false);
  });
});
