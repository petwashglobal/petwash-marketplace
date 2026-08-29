/**
 * Lane A — TRUE NEW Google customer persona pins.
 *
 * CEO FLY MODE II §10 — AUTH CONVERSION P0 (2026-08-29).
 *
 * "Extend FirebaseTestPersona with a REAL new-user shape. Do NOT
 *  reuse customerActive."
 *
 * Also locks the /api/auth/account-resolution intercept + the
 * session-response shape change so a spec can drive the true-new
 * progressive journey through the harness deterministically.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ADAPTER = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'tests', 'e2e', 'firebaseTestAdapter.ts'),
  'utf8',
);

describe('CEO FLY MODE II §10 — customerNew persona shape', () => {
  it('FirebaseTestPersona interface has an optional newUser field', () => {
    expect(ADAPTER).toMatch(
      /newUser\?: \{[\s\S]{0,200}profileState: 'incomplete' \| 'complete'/,
    );
  });

  it('newUser.requiredActions is a typed union of the six RequiredAction values', () => {
    for (const action of [
      'mobile_verification',
      'email_verification',
      'first_name',
      'last_name',
      'date_of_birth',
      'terms_acceptance',
    ]) {
      expect(ADAPTER).toMatch(new RegExp(`'${action}'`));
    }
  });

  it('personas.customerNew EXISTS and is DISTINCT from customerActive', () => {
    expect(ADAPTER).toMatch(/customerNew:\s*\{/);
    // Distinct uid so the harness can never accidentally reuse the
    // returning-user state.
    expect(ADAPTER).toMatch(/customerNew:[\s\S]{0,400}uid:\s*'usr_e2e_customer_new'/);
    expect(ADAPTER).toMatch(/customerActive:[\s\S]{0,400}uid:\s*'usr_e2e_customer_active'/);
  });

  it('personas.customerNew signals isNewUser via newUser.profileState = incomplete', () => {
    expect(ADAPTER).toMatch(
      /customerNew:[\s\S]{0,900}newUser:\s*\{[\s\S]{0,200}profileState:\s*'incomplete'/,
    );
  });

  it('personas.customerNew.requiredActions is ordered per CEO §2 (mobile → DOB → terms for Google)', () => {
    expect(ADAPTER).toMatch(
      /customerNew:[\s\S]{0,900}requiredActions:\s*\[\s*'mobile_verification',\s*'date_of_birth',\s*'terms_acceptance',/,
    );
  });

  it('customerNew canonicalDestination matches customerActive → /pet-parent/home', () => {
    // Both personas land in the same place; the difference is the
    // path they take (profile completion vs straight-through).
    expect(ADAPTER).toMatch(
      /customerNew:[\s\S]{0,900}canonicalDestination:\s*'\/pet-parent\/home'/,
    );
  });
});

describe('CEO FLY MODE II §9 — server owns new-vs-returning: intercept plumbing', () => {
  it('/api/auth/session response includes isNewUser + profileState from the persona', () => {
    expect(ADAPTER).toMatch(/isNewUser:\s*!!persona\.newUser/);
    expect(ADAPTER).toMatch(/profileState:\s*persona\.newUser\?\.profileState \?\? 'complete'/);
  });

  it('/api/auth/account-resolution intercept EXISTS and returns the strict Lane A shape', () => {
    expect(ADAPTER).toMatch(
      /page\.route\('\*\*\/api\/auth\/account-resolution'/,
    );
    // Response body carries all four Lane A fields.
    const idx = ADAPTER.indexOf("/api/auth/account-resolution'");
    const block = ADAPTER.slice(idx, idx + 1500);
    expect(block).toMatch(/isNewUser:\s*!!persona\.newUser/);
    expect(block).toMatch(/profileState:\s*persona\.newUser\?\.profileState \?\? 'complete'/);
    expect(block).toMatch(/requiredActions,/);
    expect(block).toMatch(/destination:\s*persona\.canonicalDestination/);
  });

  it('account-resolution intercept only responds to GET (POST would pass through)', () => {
    const idx = ADAPTER.indexOf("/api/auth/account-resolution'");
    const block = ADAPTER.slice(idx, idx + 1500);
    expect(block).toMatch(/if \(request\.method\(\) !== 'GET'\)/);
  });

  it('when the persona has NO newUser, the response defaults to returning-user shape', () => {
    // ?? 'complete' + empty array cover the returning-user path;
    // the client's state machine sees requiredActions:[] and jumps
    // straight to ACTIVATION → POST_LOGIN → DONE without rendering
    // any profile-completion screens.
    expect(ADAPTER).toMatch(
      /const requiredActions = persona\.newUser\?\.requiredActions \?\? \[\];/,
    );
  });
});
