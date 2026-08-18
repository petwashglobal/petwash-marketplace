/**
 * PR-DANGER-3 regression pins — admin customer PATCH allowlist.
 *
 * Two axes covered:
 *   1) BEHAVIORAL: run the actual filter function against known-shape
 *      bodies and assert the output. This is the real safety net — a
 *      refactor that silently reintroduces `washBalance` handling would
 *      trip these tests immediately.
 *   2) SOURCE PIN: assert the handler in routes.ts uses the shared
 *      allowlist helper (so a copy-paste inline allowlist somewhere
 *      else does not silently reappear).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  filterAdminCustomerPatch,
  ADMIN_CUSTOMER_PATCH_ALLOWED_FIELDS,
} from '../../server/lib/adminCustomerPatchAllowlist';

const root = process.cwd();
const routesSrc = fs.readFileSync(path.join(root, 'server/routes.ts'), 'utf8');

// The complete banned set — every category the CEO's classification pulled
// off the general profile PATCH. If a future contributor adds any of these
// to the allowlist, the behavioral tests below trip immediately.
const BANNED_FIELDS = [
  // Money (PR-DANGER-3 initial pass)
  'loyaltyTier', 'totalSpent', 'washBalance',
  // Identity — Firebase↔Postgres drift risk
  'email', 'phone',
  // Consent — must be a real user event
  'termsAccepted', 'marketing', 'reminders',
  // Security / system — set by auth / verification service
  'isVerified', 'lastLogin', 'authProvider', 'authProviderId',
  // Loyalty binding — needs enrollment ceremony
  'loyaltyProgram',
  // Extra defence (identity + auth)
  'password', 'firebaseUid', 'id', 'role', 'accountType', 'isAdmin', 'isStaff',
];

describe('PR-DANGER-3 — filterAdminCustomerPatch behavior', () => {
  it('preserves every field on the allowlist unchanged', () => {
    const body = {
      firstName: 'Nir',
      lastName: 'Hadad',
      dateOfBirth: '1985-06-15',
      country: 'IL',
      gender: 'male',
      petType: 'dog',
      profilePictureUrl: 'https://cdn.petwash.co.il/x.jpg',
    };
    const out = filterAdminCustomerPatch(body);
    expect(out).toEqual(body);
    // Guarantees a NEW object, not the same reference — a caller cannot
    // hold the input and mutate it back in after filtering.
    expect(out).not.toBe(body);
  });

  it('strips every banned field, even when mixed with allowed fields', () => {
    const body: Record<string, unknown> = { firstName: 'Nir' };
    for (const banned of BANNED_FIELDS) body[banned] = 'ATTACKER_VALUE';
    const out = filterAdminCustomerPatch(body);
    expect(out).toEqual({ firstName: 'Nir' });
    for (const banned of BANNED_FIELDS) {
      expect(out, `banned field '${banned}' survived filter`).not.toHaveProperty(banned);
    }
  });

  it('returns {} for null / undefined / non-object bodies', () => {
    expect(filterAdminCustomerPatch(null)).toEqual({});
    expect(filterAdminCustomerPatch(undefined)).toEqual({});
    expect(filterAdminCustomerPatch(42 as unknown)).toEqual({});
    expect(filterAdminCustomerPatch('firstName=Nir' as unknown)).toEqual({});
    expect(filterAdminCustomerPatch([1, 2, 3] as unknown as any)).toEqual({});
  });

  it('never re-enables a money-side field through a case-insensitive alias', () => {
    // Regression: an attacker who noticed the .includes(key) check might
    // try a different case. The Set-based filter uses strict equality —
    // this test pins that behavior.
    const body = {
      WASHBALANCE: 9999,   // uppercase
      wash_balance: 9999,  // snake_case
      washBalance: 9999,   // exact banned key
      LoyaltyTier: 'royal',
      totalspent: 999999,
    };
    const out = filterAdminCustomerPatch(body);
    expect(out).toEqual({});
  });

  it('allowlist contains only the seven PROFILE fields — no more, no less', () => {
    // Any drift here is a security decision; pin the exact list.
    expect([...ADMIN_CUSTOMER_PATCH_ALLOWED_FIELDS].sort()).toEqual([
      'country',
      'dateOfBirth',
      'firstName',
      'gender',
      'lastName',
      'petType',
      'profilePictureUrl',
    ]);
  });
});

describe('PR-DANGER-3 — handler in routes.ts uses the shared helper', () => {
  it('imports filterAdminCustomerPatch and calls it on the admin customer PATCH', () => {
    // The handler must delegate to the shared helper — a future refactor
    // that reintroduces an inline `const allowedFields = [...]` beside the
    // handler would silently split the source of truth in two.
    const handlerStart = routesSrc.indexOf(`app.patch('/api/admin/customers/:id'`);
    expect(handlerStart, 'admin customer PATCH handler missing').toBeGreaterThan(-1);
    const handlerSlice = routesSrc.slice(handlerStart, handlerStart + 4000);
    expect(handlerSlice).toMatch(/filterAdminCustomerPatch/);
    // Accept either static `from '…/adminCustomerPatchAllowlist'` or dynamic
    // `await import('…/adminCustomerPatchAllowlist')` — either shape means
    // the handler is going through the shared helper.
    expect(handlerSlice).toMatch(/adminCustomerPatchAllowlist/);
    // The old inline `const allowedFields = [` shape must be gone from
    // this specific handler window.
    expect(handlerSlice).not.toMatch(/const allowedFields = \[/);
  });

  it('handler no longer references any BANNED field name directly', () => {
    // Prevents a copy-paste that manually restores one of the banned
    // fields (e.g. `if (body.washBalance) …`) into the same handler.
    const handlerStart = routesSrc.indexOf(`app.patch('/api/admin/customers/:id'`);
    const handlerSlice = routesSrc.slice(handlerStart, handlerStart + 4000);
    // Skip the comment block — banned field names ARE mentioned there
    // for documentation. Only bans code-level references. Strip the
    // block comment first.
    const codeOnly = handlerSlice.replace(/\/\*[\s\S]*?\*\//g, '')
                                 .replace(/\/\/[^\n]*/g, '');
    for (const banned of ['washBalance', 'totalSpent', 'loyaltyTier']) {
      expect(codeOnly, `banned money field '${banned}' referenced in handler code`)
        .not.toMatch(new RegExp(`\\b${banned}\\b`));
    }
  });
});
