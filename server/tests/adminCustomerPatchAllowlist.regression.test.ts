/**
 * Regression pin for the admin "edit customer" PATCH allowlist (audit item 249).
 *
 * The pre-2026-08-16 allowlist accepted `totalSpent`, `washBalance`, `isVerified`,
 * `termsAccepted`, `email`, `phone`, `authProvider`, `authProviderId`, `lastLogin`,
 * `loyaltyTier`, `loyaltyProgram`, `marketing`, `reminders` — every one of those
 * is a money / identity / consent / audit field that must NOT be admin-forged
 * via a generic profile PATCH. These tests fail if any of them are re-added.
 */
import { describe, it, expect } from 'vitest';
import {
  ADMIN_CUSTOMER_PATCH_ALLOWED_FIELDS,
  filterAdminCustomerPatch,
} from '../lib/adminCustomerPatchAllowlist';

const FORBIDDEN_FIELDS = [
  // Money
  'totalSpent', 'washBalance', 'loyaltyTier', 'loyaltyProgram',
  // Identity contacts — dedicated flow only
  'email', 'phone', 'phoneNumber',
  // Verification / consent state
  'isVerified', 'emailVerified', 'phoneVerified', 'termsAccepted',
  'marketing', 'reminders', 'marketingConsent', 'privacyConsentUpdatedAt',
  // Auth linkage
  'authProvider', 'authProviderId', 'firebaseUid', 'lastLogin',
  // Password (already blocked by insertCustomerSchema.omit but pin here too)
  'password', 'resetPasswordToken', 'resetPasswordExpires',
  // Direct role escalation
  'role', 'isAdmin', 'isStaff', 'isSuperAdmin', 'accountType',
] as const;

describe('adminCustomerPatchAllowlist', () => {
  it('exports the 7 profile-only fields the admin UI legitimately edits', () => {
    expect([...ADMIN_CUSTOMER_PATCH_ALLOWED_FIELDS].sort()).toEqual(
      ['country', 'dateOfBirth', 'firstName', 'gender', 'lastName', 'petType', 'profilePictureUrl'].sort()
    );
  });

  for (const field of FORBIDDEN_FIELDS) {
    it(`silently drops forbidden field: ${field}`, () => {
      const body = { firstName: 'Alice', [field]: 'attacker-value' };
      const filtered = filterAdminCustomerPatch(body);
      expect(filtered).toEqual({ firstName: 'Alice' });
      expect(filtered).not.toHaveProperty(field);
    });
  }

  it('drops unknown keys entirely', () => {
    const filtered = filterAdminCustomerPatch({
      firstName: 'Alice',
      totalSpent: 99999,
      washBalance: 42,
      isVerified: true,
      role: 'admin',
      __proto__: { polluted: true },
    });
    expect(filtered).toEqual({ firstName: 'Alice' });
  });

  it('handles non-object bodies safely', () => {
    expect(filterAdminCustomerPatch(null)).toEqual({});
    expect(filterAdminCustomerPatch(undefined)).toEqual({});
    expect(filterAdminCustomerPatch('string')).toEqual({});
    expect(filterAdminCustomerPatch(42)).toEqual({});
  });

  it('preserves multiple allowed fields together', () => {
    const filtered = filterAdminCustomerPatch({
      firstName: 'Alice',
      lastName: 'Cohen',
      dateOfBirth: '1990-01-15',
      country: 'IL',
      gender: 'female',
      petType: 'dog',
      profilePictureUrl: 'https://cdn/x.png',
      // Attacker payload:
      totalSpent: 99999,
      isVerified: true,
    });
    expect(filtered).toEqual({
      firstName: 'Alice',
      lastName: 'Cohen',
      dateOfBirth: '1990-01-15',
      country: 'IL',
      gender: 'female',
      petType: 'dog',
      profilePictureUrl: 'https://cdn/x.png',
    });
  });
});
