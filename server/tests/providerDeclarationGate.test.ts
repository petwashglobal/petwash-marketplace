import { describe, it, expect } from 'vitest';
import {
  declarationDocType,
  parseDeclarationDocType,
  scopesForServiceTypes,
  DECLARATION_DOC_TYPE_PREFIX,
} from '../services/providerDeclarationGate';
import { requiredDeclarationsForScopes } from '@shared/providerProtectionDeclarations';

describe('declaration documentType encode/decode', () => {
  it('round-trips key + dotted version', () => {
    const dt = declarationDocType('independent_provider', '2026-06-29.v1');
    expect(dt).toBe(`${DECLARATION_DOC_TYPE_PREFIX}:independent_provider:2026-06-29.v1`);
    expect(parseDeclarationDocType(dt)).toEqual({
      key: 'independent_provider',
      version: '2026-06-29.v1',
    });
  });

  it('rejects non-declaration documentTypes', () => {
    expect(parseDeclarationDocType('waiver')).toBeNull();
    expect(parseDeclarationDocType('')).toBeNull();
    expect(parseDeclarationDocType(null)).toBeNull();
    expect(parseDeclarationDocType(`${DECLARATION_DOC_TYPE_PREFIX}:onlykey`)).toBeNull();
  });
});

describe('service-type → declaration scope mapping', () => {
  it('maps canonical + alias service types to scopes', () => {
    // sitter (alias) requires BOTH sitter protocols
    expect(scopesForServiceTypes(['sitter']).sort()).toEqual(
      ['PET_SITTER_HOSTING', 'PET_SITTER_OWNER_HOME'].sort(),
    );
    expect(scopesForServiceTypes(['walking'])).toEqual(['WALK_MY_PET']);
    expect(scopesForServiceTypes(['academy'])).toEqual(['ACADEMY']); // training alias
    expect(scopesForServiceTypes(['pettrek'])).toEqual(['PETTREK']); // transport alias
    expect(scopesForServiceTypes(['grooming'])).toEqual([]); // core-only
  });

  it('dedupes across multiple services and ignores unknowns', () => {
    const scopes = scopesForServiceTypes(['pet_sitting', 'pet_sitting', 'dog_walking', 'mystery', null]);
    expect(scopes.sort()).toEqual(
      ['PET_SITTER_HOSTING', 'PET_SITTER_OWNER_HOME', 'WALK_MY_PET'].sort(),
    );
  });

  it('a grooming-only provider still owes every core declaration', () => {
    const scopes = scopesForServiceTypes(['grooming']);
    const required = requiredDeclarationsForScopes(scopes);
    expect(required.length).toBeGreaterThan(0);
    expect(required.every((d) => d.category === 'core')).toBe(true);
  });

  it('a walker owes core docs + the walking protocol only', () => {
    const required = requiredDeclarationsForScopes(scopesForServiceTypes(['dog_walking']));
    const keys = required.map((d) => d.key);
    expect(keys).toContain('walking_protocol');
    expect(keys).not.toContain('academy_protocol');
    expect(keys).not.toContain('home_hosting_protocol');
  });
});
