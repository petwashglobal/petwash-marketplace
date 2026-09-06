/**
 * PATCH /api/user/profile must not be a side door into security state.
 *
 * THE DEFECT THIS PINS. The handler used to end with two lines that turned a
 * generic profile edit into a security control:
 *
 *     if (phone !== undefined) updateData.phone = phone;
 *     if (twoFactorEnabled !== undefined) updateData.twoFactorEnabled = twoFactorEnabled;
 *
 * So ANY authenticated caller could PATCH a new canonical phone number onto
 * their account with no proof they hold the handset, or flip 2FA off, entirely
 * bypassing mfa.ts — where enabling 2FA actually means an enable_2fa challenge,
 * a TwoFactorAuthService enrolment and a metadata.action binding.
 *
 * The sibling endpoint (PATCH /api/user/settings/profile) had guarded the
 * phone since the mobile-change audit via decideMobileWrite(). This one never
 * did, which made that guard one route away from pointless — the classic shape
 * of a bypass: the control exists, just not on every path to the same column.
 *
 * Source-scanning, in the house style. A DB-backed supertest for this handler
 * would need the full users table and Firebase admin stood up; the invariant
 * being protected is "this code path cannot reach that column", which is
 * exactly what a source pin proves — and it fails if either line comes back.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const USER_PROFILE = readFileSync(join(ROOT, 'server/routes/user-profile.ts'), 'utf8');
const PROFILE_SETTINGS = readFileSync(join(ROOT, 'server/routes/profile-settings.ts'), 'utf8');

/**
 * Strip comments before matching.
 *
 * The first version of this pin failed against the FIXED code, because the
 * comment explaining the fix quotes the removed line verbatim. A source pin
 * that prose can satisfy — or break — is not proving anything about the code,
 * so every assertion below runs against executable text only.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The body of the PATCH /profile handler, so assertions cannot match a sibling route. */
function patchProfileHandler(): string {
  const start = USER_PROFILE.indexOf("router.patch('/profile'");
  expect(start, 'PATCH /profile handler not found — this pin is scanning the wrong file').toBeGreaterThan(-1);
  const next = USER_PROFILE.indexOf('router.', start + 10);
  return stripComments(USER_PROFILE.slice(start, next === -1 ? undefined : next));
}

describe('an arbitrary authenticated PATCH cannot change the canonical phone', () => {
  const handler = patchProfileHandler();

  it('never assigns the request phone straight onto updateData', () => {
    expect(handler).not.toMatch(/updateData\.phone\s*=\s*phone\b/);
  });

  it('routes the phone through the canonical decision instead', () => {
    expect(USER_PROFILE).toContain("import { decideMobileWrite }");
    expect(handler).toContain('decideMobileWrite(phone, existingUser?.phone)');
  });

  it('only writes on an explicit `write` decision', () => {
    expect(handler).toMatch(/mobileDecision\.action === 'write'/);
    expect(handler).toMatch(/updateData\.phone = mobileDecision\.phone/);
  });

  it('refuses a change with a 400 that names the reason', () => {
    expect(handler).toMatch(/mobileDecision\.action === 'reject'/);
    expect(handler).toMatch(/code: mobileDecision\.code/);
  });

  it('reads the CURRENT phone in the preflight — otherwise every change looks like a first set', () => {
    // The guard distinguishes first-set from change by comparing against the
    // stored number. A projection of { id } alone would make `currentPhone`
    // undefined, and decideMobileWrite would allow everything.
    expect(handler).toMatch(/db\.select\(\{[^}]*phone: users\.phone[^}]*\}\)/);
  });

  it('the canonical decision still refuses a real change — the shared guard is intact', () => {
    const fn = PROFILE_SETTINGS.slice(
      PROFILE_SETTINGS.indexOf('export function decideMobileWrite'),
      PROFILE_SETTINGS.indexOf('/** Max wrong OTP guesses'),
    );
    expect(fn).toContain("MOBILE_CHANGE_REQUIRES_VERIFICATION");
    // First-set stays allowed on purpose — /booking-contact depends on it.
    expect(fn).toMatch(/if \(!current\) return \{ action: 'write'/);
  });
});

describe('a generic boolean PATCH cannot enable or disable 2FA', () => {
  const handler = patchProfileHandler();

  it('never assigns twoFactorEnabled onto updateData', () => {
    expect(handler).not.toMatch(/updateData\.twoFactorEnabled\s*=/);
  });

  it('refuses the field outright rather than silently ignoring it', () => {
    // A stripped-and-ignored field returns 200 and the caller believes the
    // security setting changed. That is worse than refusing.
    expect(USER_PROFILE).toContain('SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW');
    expect(USER_PROFILE).toContain('TWO_FACTOR_REQUIRES_VERIFICATION');
    expect(handler).toMatch(/for \(const \[field, rule\] of Object\.entries\(SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW\)\)/);
  });

  it('the refusal happens BEFORE any database work', () => {
    const refusalAt = handler.indexOf('SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW');
    const firstDbAt = handler.indexOf('db.select');
    expect(refusalAt).toBeGreaterThan(-1);
    expect(firstDbAt).toBeGreaterThan(-1);
    expect(refusalAt, 'security fields are refused after touching the database').toBeLessThan(firstDbAt);
  });

  it('names the canonical route so a caller knows where to go', () => {
    expect(USER_PROFILE).toMatch(/\/api\/mfa\/enable/);
  });

  it('email is refused too — it was accepted by the schema and silently dropped', () => {
    // `email` sat in profileUpdateSchema but was never applied, so a client
    // PATCHing an email got 200 and no change. Same class of lie.
    expect(USER_PROFILE).toContain('EMAIL_CHANGE_REQUIRES_VERIFICATION');
    expect(USER_PROFILE).toMatch(/settings\/email\/request-change/);
  });
});

describe('the canonical phone-change path exists to be pointed at', () => {
  const SERVICE = readFileSync(
    join(ROOT, 'server/services/UnifiedVerificationService.ts'),
    'utf8',
  );

  it('change_phone is a registered purpose', () => {
    expect(SERVICE).toMatch(/change_phone: \{\s*\n\s*purpose: "change_phone"/);
  });

  it('it hands the proven number back rather than writing the identity itself', () => {
    const entry = SERVICE.slice(
      SERVICE.indexOf('change_phone: {'),
      SERVICE.indexOf('payout: {'),
    );
    expect(entry).toContain('newPhoneE164');
    // The purpose must not mutate the users table as a side effect of verifying.
    expect(entry).not.toContain('db.update');
  });
});

describe('the canonical phone-change pair — the route the refusal points at', () => {
  const SETTINGS = readFileSync(join(ROOT, 'server/routes/profile-settings.ts'), 'utf8');

  function handler(path: string): string {
    const start = SETTINGS.indexOf(`router.post('${path}'`);
    expect(start, `${path} not found`).toBeGreaterThan(-1);
    const next = SETTINGS.indexOf('\nrouter.', start + 10);
    return stripComments(SETTINGS.slice(start, next === -1 ? undefined : next));
  }

  it('request-change sends the code to the NEW number', () => {
    const h = handler('/settings/phone/request-change');
    expect(h).toContain("purpose: 'change_phone'");
    expect(h).toContain('destination: newPhone');
  });

  it('request-change demands recent auth — a walked-away session must not change an identity', () => {
    expect(handler('/settings/phone/request-change')).toContain('hasRecentAuth(decodedToken)');
  });

  it('request-change refuses a number already in use, in BOTH stores, before sending anything', () => {
    const h = handler('/settings/phone/request-change');
    const dbCheck = h.indexOf('PHONE_ALREADY_IN_USE');
    const send = h.indexOf('startChallenge');
    expect(dbCheck).toBeGreaterThan(-1);
    expect(h).toContain('getUserByPhoneNumber');
    expect(dbCheck, 'the collision check runs after the code is sent').toBeLessThan(send);
  });

  it('CONFIRM TAKES THE NEW NUMBER FROM THE VERIFICATION, NOT THE REQUEST BODY', () => {
    // This is the whole point. If the client could name the number, the
    // challenge would prove control of one handset and write another.
    const h = handler('/settings/phone/confirm-change');
    expect(h).toContain('metadata.newPhoneE164');
    expect(h).not.toMatch(/req\.body[^\n]*phone/i);
    expect(h).toMatch(/phoneChangeConfirmSchema/);
  });

  it('confirm binds the verification to THIS operation', () => {
    expect(handler('/settings/phone/confirm-change')).toMatch(/metadata\.action !== 'change_phone'/);
  });

  it('confirm re-checks uniqueness at apply time, not only at request time', () => {
    // The request-time check was up to 5 minutes ago.
    expect(handler('/settings/phone/confirm-change')).toContain('PHONE_ALREADY_IN_USE');
  });

  it('confirm updates Firebase BEFORE the canonical row', () => {
    // Firebase is the write that can reject. Doing it first means a failure
    // leaves both stores on the old number instead of disagreeing.
    const h = handler('/settings/phone/confirm-change');
    expect(h.indexOf('admin.auth().updateUser')).toBeLessThan(h.indexOf('db.update(users)'));
  });

  it('confirm revokes other sessions — a security identity changed', () => {
    expect(handler('/settings/phone/confirm-change')).toContain('revokeAllExceptForUser');
  });

  it('confirm surfaces a partial apply instead of reporting success', () => {
    expect(handler('/settings/phone/confirm-change')).toContain('PHONE_UPDATE_PARTIAL');
  });

  it('uses the real users.phoneHash column', () => {
    // users.phoneLookupHash does not exist; referencing it would throw at
    // runtime on the first phone change anyone attempted.
    const both = handler('/settings/phone/request-change') + handler('/settings/phone/confirm-change');
    expect(both).toContain('users.phoneHash');
    expect(both).not.toContain('users.phoneLookupHash');
  });
});
