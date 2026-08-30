/**
 * ProfileFieldAuthorityMap — CEO P0-MY-ACCOUNT audit contract pin.
 */
import { describe, it, expect } from 'vitest';
import {
  PROFILE_FIELD_AUTHORITY_MAP,
  canonicalEntryFor,
  mirrorEntriesFor,
  isWriteAllowed,
  type PersonalField,
} from '../services/marketplace/ProfileFieldAuthorityMap';

describe('ProfileFieldAuthorityMap', () => {
  it('every personal field has exactly ONE canonical entry', () => {
    const fields: PersonalField[] = [
      'firstName', 'lastName', 'email', 'phone', 'dateOfBirth',
      'language', 'profileImageUrl', 'address', 'city', 'postalCode', 'country',
    ];
    for (const f of fields) {
      const canonical = PROFILE_FIELD_AUTHORITY_MAP.filter((e) => e.field === f && e.authority === 'CANONICAL');
      expect(canonical.length, `field ${f} needs exactly one CANONICAL entry`).toBe(1);
    }
  });

  it('CANONICAL rows live on the users table (single writer)', () => {
    for (const e of PROFILE_FIELD_AUTHORITY_MAP) {
      if (e.authority === 'CANONICAL') expect(e.table).toBe('users');
    }
  });

  it('privilege_members entries are MIRROR (not CANONICAL) for personal fields', () => {
    for (const e of PROFILE_FIELD_AUTHORITY_MAP) {
      if (e.table === 'privilege_members') expect(e.authority).toBe('MIRROR');
    }
  });

  it('application intake tables are LEGACY (never accept ongoing profile writes)', () => {
    for (const e of PROFILE_FIELD_AUTHORITY_MAP) {
      if (e.table.endsWith('_applications')) expect(e.authority).toBe('LEGACY');
    }
  });

  it('isWriteAllowed passes only for the CANONICAL (table, column) tuple', () => {
    expect(isWriteAllowed('firstName', 'users', 'first_name')).toBe(true);
    expect(isWriteAllowed('firstName', 'privilege_members', 'first_name')).toBe(false);
    expect(isWriteAllowed('firstName', 'provider_applications', 'first_name')).toBe(false);
  });

  it('canonicalEntryFor + mirrorEntriesFor are consistent', () => {
    const canonicalEmail = canonicalEntryFor('email');
    expect(canonicalEmail?.table).toBe('users');
    const mirrorsPhone = mirrorEntriesFor('phone');
    expect(mirrorsPhone.length).toBeGreaterThan(0);
    for (const m of mirrorsPhone) expect(m.authority).toBe('MIRROR');
  });

  it('no BUG-classified entries currently exist (baseline — new bugs land here as sentinels)', () => {
    const bugs = PROFILE_FIELD_AUTHORITY_MAP.filter((e) => e.authority === 'BUG');
    expect(bugs).toEqual([]);
  });
});
