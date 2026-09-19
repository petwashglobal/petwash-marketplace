/**
 * Saving the account profile does not send fields the server refuses
 * — regression pin (2026-09-19).
 *
 * THE DEFECT. MyAccount hydrates its edit form from GET /api/user/profile
 * (`setEditedProfile(profileData)`) and saved with `{ ...editedProfile }`. That
 * read-back contains `email` and `twoFactorEnabled`, and PATCH /api/user/profile
 * refuses both OUTRIGHT — deliberately, so a generic profile write can never be
 * a side door into security state (server/routes/user-profile.ts,
 * SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW, pinned by
 * server/tests/profileSecurityFieldBypass.regression.test.ts).
 *
 * Both halves were right; together they bricked the screen. EVERY save — name,
 * birthday, car plate, emergency contact, address — came back
 *   400 "Two-step login cannot be changed from the profile endpoint."
 * because the form echoed back the value the server had just handed it. The
 * member saw "שגיאה בשמירה" quoting an internal route and nothing saved. The
 * two changes that produced it landed apart: the read-back gained those fields
 * on 2026-08-10 (so the edit form would stop rendering blank), the refusal
 * arrived in #2433.
 *
 * This is a REAL test of the payload builder, not a source scan — the builder
 * was extracted into its own module so the rule could be executed. The source
 * pins below only cover the two things a unit test cannot see: that the page
 * actually calls it, and that the client's refused-list still matches the
 * server's.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  buildProfileUpdatePayload,
  PROFILE_UPDATE_FIELDS,
  PROFILE_FIELDS_THE_SERVER_REFUSES,
} from '../lib/profileUpdatePayload';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'MyAccount.tsx'), 'utf8');
const ROUTE = fs.readFileSync(path.join(ROOT, 'server', 'routes', 'user-profile.ts'), 'utf8');

/** The exact shape GET /api/user/profile hands the form for an existing user. */
const READ_BACK = {
  displayName: 'ניר הדד',
  email: 'member@petwash.co.il',
  phone: '+972501234567',
  address: 'הרצל 1, כפר סבא',
  street: 'הרצל',
  streetNumber: '1',
  apartment: '',
  city: 'כפר סבא',
  postalCode: '4442201',
  country: 'IL',
  latitude: 32.175,
  longitude: 34.907,
  addressIsTemporary: false,
  temporaryAddress: '',
  temporaryLat: null,
  temporaryLng: null,
  temporaryPostal: '',
  birthdate: '1980-04-02',
  photoURL: 'https://example.invalid/a.jpg',
  preferredLanguage: 'he',
  gender: 'male',
  carPlate: '12-345-67',
  carPlate2: '',
  emergencyContactName: 'דנה',
  emergencyContactPhone: '+972521111111',
  marketingConsent: true,
  twoFactorEnabled: true,
  notificationPreferences: { pushEnabled: true, blackFridayEnabled: false },
};

describe('the profile save body (2026-09-19)', () => {
  it('THE BUG: a save that echoes the read-back carries neither refused field', () => {
    const body = buildProfileUpdatePayload({ ...READ_BACK });
    for (const field of PROFILE_FIELDS_THE_SERVER_REFUSES) {
      expect(body, `${field} would be refused with a 400 and lose the whole save`)
        .not.toHaveProperty(field);
    }
  });

  it('what the member actually edited still goes through', () => {
    const body = buildProfileUpdatePayload({ ...READ_BACK, displayName: 'ניר הדד כהן' });
    expect(body.displayName).toBe('ניר הדד כהן');
    expect(body.birthdate).toBe('1980-04-02');
    expect(body.carPlate).toBe('12-345-67');
    expect(body.emergencyContactPhone).toBe('+972521111111');
    expect(body.city).toBe('כפר סבא');
    expect(body.marketingConsent).toBe(true);
    expect(body.notificationPreferences).toEqual(READ_BACK.notificationPreferences);
  });

  it('a false or empty value is sent, not dropped — only `undefined` means untouched', () => {
    // marketingConsent:false is a withdrawal of consent. Dropping it because it
    // is falsy would silently keep the member opted in.
    const body = buildProfileUpdatePayload({ marketingConsent: false, carPlate: '' });
    expect(body).toHaveProperty('marketingConsent', false);
    expect(body).toHaveProperty('carPlate', '');
  });

  it('an untouched field is omitted so the handler leaves the column alone', () => {
    const body = buildProfileUpdatePayload({ displayName: 'א', city: undefined });
    expect(Object.keys(body)).toEqual(['displayName']);
  });

  it('photoURL is not sent — the handler ignores it, the photo endpoint owns it', () => {
    // profileUpdateSchema accepts photoURL but the handler never reads it, so
    // sending it is a save that reports success and changes nothing.
    expect(buildProfileUpdatePayload({ ...READ_BACK })).not.toHaveProperty('photoURL');
    expect(PROFILE_UPDATE_FIELDS).not.toContain('photoURL' as never);
  });

  it('a field the read-back grows later cannot reach the endpoint by accident', () => {
    // The allow-list, not a spread, is the whole point: this is how it broke.
    const body = buildProfileUpdatePayload({ ...READ_BACK, someFutureSecurityFlag: true });
    expect(body).not.toHaveProperty('someFutureSecurityFlag');
  });

  it('every field it does send is one the endpoint reads', () => {
    const accepted = ROUTE.slice(
      ROUTE.indexOf('const profileUpdateSchema'),
      ROUTE.indexOf('const SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW'),
    );
    for (const field of PROFILE_UPDATE_FIELDS) {
      expect(accepted, `${field} is not in profileUpdateSchema`).toMatch(
        new RegExp(`\\b${field}:`),
      );
    }
  });
});

describe('the two halves cannot drift apart again', () => {
  it('the client refused-list is exactly the server refused-list', () => {
    const block = ROUTE.slice(
      ROUTE.indexOf('const SECURITY_FIELDS_REQUIRING_CANONICAL_FLOW'),
      ROUTE.indexOf('} as const;'),
    );
    const serverRefuses = [...block.matchAll(/^ {2}([A-Za-z][A-Za-z0-9]*): \{$/gm)].map((m) => m[1]);
    expect(serverRefuses.length).toBeGreaterThan(0);
    expect([...PROFILE_FIELDS_THE_SERVER_REFUSES].sort()).toEqual(serverRefuses.sort());
  });

  it('the account screen builds its body with the builder, never a raw spread', () => {
    expect(PAGE).toMatch(/import \{ buildProfileUpdatePayload \}/);
    const save = PAGE.slice(
      PAGE.indexOf('const handleSaveProfile'),
      PAGE.indexOf('const handleSaveProfile') + 2200,
    );
    expect(save).toMatch(/updateProfileMutation\.mutate\(\s*\n?\s*buildProfileUpdatePayload\(/);
    expect(save).not.toMatch(/mutate\(\{ \.\.\.editedProfile/);
  });

  it('the refusal itself is untouched — a REAL change is still refused loudly', () => {
    // This fix is about not sending an unchanged echo. It must not become a
    // reason to soften the guard.
    expect(ROUTE).toContain('TWO_FACTOR_REQUIRES_VERIFICATION');
    expect(ROUTE).toContain('EMAIL_CHANGE_REQUIRES_VERIFICATION');
    expect(ROUTE).toMatch(/return res\.status\(400\)\.json\(\{ error: rule\.message, code: rule\.code \}\)/);
  });
});

describe('a notification toggle the screen offers is a toggle the server stores', () => {
  it('every switch in the notifications tab is accepted by the server schema', () => {
    const schema = ROUTE.slice(
      ROUTE.indexOf('const notificationPreferencesSchema'),
      ROUTE.indexOf('const profileUpdateSchema'),
    );
    const offered = [...PAGE.matchAll(/\{ key: '([a-zA-Z]+Enabled)',/g)].map((m) => m[1]);
    expect(offered.length).toBeGreaterThanOrEqual(10);
    for (const key of offered) {
      // A plain z.object STRIPS what it does not declare: an undeclared key was
      // accepted with a 200, dropped, and the switch sprang back on reload.
      expect(schema, `${key} is offered in the UI but silently dropped on save`).toMatch(
        new RegExp(`\\b${key}: z\\.boolean\\(\\)`),
      );
    }
  });

  it('the GET returns them too, so an "off" reads back as off', () => {
    const defaults = ROUTE.slice(
      ROUTE.indexOf('const defaultNotificationPrefs'),
      ROUTE.indexOf('let storedNotificationPrefs'),
    );
    for (const key of ['worldDogDayEnabled', 'blackFridayEnabled', 'petBirthdayPushEnabled']) {
      // Missing from the response, the client's `?? true` fallback made these
      // impossible to see as off even once they were stored.
      expect(defaults, `${key} missing from the read-back`).toMatch(new RegExp(`\\b${key}:`));
    }
  });
});
