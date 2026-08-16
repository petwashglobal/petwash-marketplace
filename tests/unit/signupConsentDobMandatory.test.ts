/**
 * PR-AUTH-SIGNUP-2 regression pins — MASTER AUTH rebuild (2026-08-16).
 *
 * Source-pin guarantees that the "mandatory active consent + real DOB"
 * contract cannot silently regress back to the earlier passive/pre-seeded
 * behavior. The reversal cost the product a signup that was legally
 * unusable (pre-checked marketing bundled with Terms; a fake 25-year-old
 * DOB stamped on every user who never spun the wheel), so each of these
 * assertions guards a distinct axis of that contract.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PR-AUTH-SIGNUP-2 — mandatory DOB + active consent + granular marketing', () => {
  const signup = read('client/src/pages/SignUpLuxury.tsx');
  const routes = read('server/routes.ts');

  it('does NOT pre-seed a synthetic 25-year-old DOB on mount', () => {
    // The old default (`${now-25}-06-15`) let anyone who never touched the
    // wheel submit with a fabricated adult birthday indistinguishable from
    // a real one. dob must start empty; the picker rendering a default
    // VIEW is fine, but the STATE must not commit until the user acts.
    expect(signup).not.toMatch(/useState\(`\$\{new Date\(\)\.getFullYear\(\) - 25\}-06-15`\)/);
    expect(signup).toMatch(/const \[dob, setDob\] = useState\(''\)/);
  });

  it('declares the acceptedMarketing state UNCHECKED by default (never pre-ticked)', () => {
    // Pre-ticked marketing bundled with Terms is unlawful under both
    // Israeli Communications Law s.30A and GDPR Art.7(2). Default must
    // be false; the checkbox is granular and optional.
    expect(signup).toMatch(/const \[acceptedMarketing, setAcceptedMarketing\] = useState\(false\)/);
  });

  it('requireTerms() hard-fails without a valid 18+ DOB AND without agreedTerms', () => {
    // The passive-consent guard used to allow submit on isAdult alone with
    // no Terms tick. MASTER AUTH rebuild reinstates both hard gates in the
    // same helper so every submit path (mobile/email OTP + email+password
    // + social) is protected by one truth.
    const rt = signup.match(/const requireTerms = \(\) => \{[\s\S]*?return true;\s*\};/);
    expect(rt, 'requireTerms helper missing').toBeTruthy();
    const body = rt![0];
    expect(body).toMatch(/if \(!dobValid \|\| !isAdult\)/);
    expect(body).toMatch(/if \(!agreedTerms\)/);
  });

  it('consentOk requires BOTH ageConfirmed AND agreedTerms', () => {
    // ageConfirmed used to fall back to the `over18` checkbox alone,
    // letting the signup CTA arm with no DOB entered. Rebuild ties
    // consent to (isAdult && agreedTerms) — no shortcut path.
    expect(signup).toMatch(/const ageConfirmed = isAdult;/);
    expect(signup).toMatch(/const consentOk = ageConfirmed && agreedTerms;/);
  });

  it('joinReady requires consentOk (not just isAdult)', () => {
    // The previous joinReady expression let a valid 18+ DOB + email +
    // password + phone unlock Continue with no Terms tick.
    expect(signup).toMatch(/const joinReady = !busy && bothContacts && passwordValid && consentOk;/);
  });

  it('social() gates on requireTerms() BEFORE calling the OAuth provider', () => {
    // Tapping Google/Apple used to bypass Terms and the DOB gate entirely
    // (passive-consent era). Rebuild routes every non-login social tap
    // through requireTerms so the same consent state protects social too.
    const social = signup.match(/async function social\([^)]+\) \{[\s\S]*?setBusy\(true\);/);
    expect(social, 'social() prelude missing').toBeTruthy();
    expect(social![0]).toMatch(/if \(authMode !== 'login' && !requireTerms\(\)\) return;/);
  });

  it('social session POSTs carry dateOfBirth + termsAccepted + acceptedMarketing on new-user signup', () => {
    // Two social paths mint sessions: native (Capacitor) and web (popup).
    // Both must ship DOB + granular marketing so the users row is
    // CREATED with the real birthday and correct opt-in from tap one —
    // never silently stamped with a synthetic default later on.
    const sessionBodyMatches = signup.match(
      /const sessionBody = authMode === 'login'\s*\?\s*\{ idToken \}\s*:\s*\{ idToken, dateOfBirth: dob, termsAccepted: true, acceptedMarketing \};/g,
    );
    expect(sessionBodyMatches, 'social session body branch missing').toBeTruthy();
    expect(sessionBodyMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it('manual OTP + email+password session POSTs carry acceptedMarketing on signup only', () => {
    // Every manual signup path (mobile OTP → verify(), email OTP →
    // verifyEmailCode(), email+password → emailSubmit()) must forward
    // the granular marketing flag. Login mode must NOT — otherwise a
    // returning user's stored preference gets clobbered every login.
    // Phone verify() (new-user only path, no authMode guard needed):
    expect(signup).toMatch(
      /body: JSON\.stringify\(\{ idToken, dateOfBirth: dob, termsAccepted: true, acceptedMarketing \}\)/,
    );
    // The two authMode-guarded spreads (email verify + email+password submit):
    const guardedSpreads = signup.match(
      /\.\.\.\(authMode === 'login' \? \{\} : \{ acceptedMarketing \}\)/g,
    );
    expect(guardedSpreads, 'guarded acceptedMarketing spread missing on email paths').toBeTruthy();
    expect(guardedSpreads!.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the mandatory Terms checkbox with data-testid + required attribute', () => {
    // The mandatory checkbox must be present in the DOM (E2E-selectable),
    // marked required for a11y + browser validation, and UNCHECKED by
    // default (state defaults to false — checked prop follows state).
    expect(signup).toContain('data-testid="checkbox-agreedTerms"');
    expect(signup).toContain('aria-required="true"');
    expect(signup).toMatch(/checked=\{agreedTerms\}/);
  });

  it('renders a SEPARATE optional Marketing checkbox (never bundled with Terms)', () => {
    // GDPR Art.7(2) + Israeli law: consent must be granular. This checkbox
    // is unrequired, defaults unchecked, and its label makes optionality
    // and unsubscribe rights explicit — never the same box as Terms.
    expect(signup).toContain('data-testid="checkbox-acceptedMarketing"');
    expect(signup).toMatch(/checked=\{acceptedMarketing\}/);
    // Explicit optional label text (EN + HE variants).
    expect(signup).toMatch(/optional — you can unsubscribe anytime/);
    expect(signup).toMatch(/אופציונלי/);
  });

  it('server /session extracts acceptedMarketing as a STRICT boolean (no truthy coercion)', () => {
    // A truthy string / 1 / null could silently opt users in. The route
    // must accept only literal `true`. Guards the wire format contract.
    expect(routes).toMatch(/const acceptedMarketing = acceptedMarketingRaw === true;/);
  });

  it('server /session stamps marketingConsent ONLY on new-user signup (never overwrites returning users)', () => {
    // Returning login requests omit the field so an existing preference
    // is preserved. The stamp is guarded by isNewUser + field-presence
    // (undefined check) so a login call can never null a prior opt-in.
    expect(routes).toMatch(
      /if \(_syncResult\?\.isNewUser && \(req\.body as any\)\?\.acceptedMarketing !== undefined\)/,
    );
    expect(routes).toMatch(/marketingConsent: acceptedMarketing,/);
    expect(routes).toMatch(/privacyConsentUpdatedAt: new Date\(\),/);
  });
});
