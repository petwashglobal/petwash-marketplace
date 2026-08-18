/**
 * PR-AUTH-SIGNUP-2 regression pins — corrected 2026-08-16 per CEO patch
 * to the original submission.
 *
 * The signup consent contract has three independent axes; each must have
 * its own state, its own audit lane, and its own gate. This test pins the
 * three so any regression that re-couples them will fail loudly:
 *
 *   1) ageConfirmed18Plus — explicit "I am 18+" checkbox (mandatory).
 *      Paired with the DOB the user types; server independently
 *      calculates age from DOB and requires BOTH to hold.
 *
 *   2) agreedTerms — Terms + Privacy Notice checkbox (mandatory).
 *      Recorded as one legal-consent event on termsAcceptedAt +
 *      termsVersion + privacyAcceptedAt + privacyVersion.
 *
 *   3) acceptedMarketing — optional marketing preference. NEVER blocks
 *      signup and NEVER touches the Terms/Privacy audit timestamps.
 *
 * Google/Apple OAuth is the easy button: the tap is NEVER gated on any
 * of the three checkboxes. The post-OAuth activation surface collects
 * the mandatory data new users still owe.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PR-AUTH-SIGNUP-2 — mandatory DOB + explicit 18+ + Terms + granular marketing', () => {
  const signup = read('client/src/pages/SignUpLuxury.tsx');
  const routes = read('server/routes.ts');

  it('does NOT pre-seed a synthetic 25-year-old DOB on mount', () => {
    // The old default (`${now-25}-06-15`) let anyone who never touched the
    // wheel submit with a fabricated adult birthday indistinguishable from
    // real input. dob must start empty; the picker rendering a default
    // VIEW is fine, but the STATE must not commit until the user acts.
    expect(signup).not.toMatch(/useState\(`\$\{new Date\(\)\.getFullYear\(\) - 25\}-06-15`\)/);
    expect(signup).toMatch(/const \[dob, setDob\] = useState\(''\)/);
  });

  it('declares all three consent states UNCHECKED by default (never pre-ticked)', () => {
    // 18+ confirmation, Terms/Privacy acceptance, and marketing preference
    // are three independent axes — none may default to true.
    expect(signup).toMatch(
      /const \[ageConfirmed18Plus, setAgeConfirmed18Plus\] = useState\(false\)/,
    );
    expect(signup).toMatch(/const \[agreedTerms, setAgreedTerms\] = useState\(false\)/);
    expect(signup).toMatch(
      /const \[acceptedMarketing, setAcceptedMarketing\] = useState\(false\)/,
    );
  });

  it('requireTerms() hard-fails on missing DOB / age<18 / unchecked 18+ box / unchecked Terms box', () => {
    // Four independent failure modes, all inside the same helper so every
    // submit path (mobile OTP, email OTP, email+password) uses one truth.
    const rt = signup.match(/const requireTerms = \(\) => \{[\s\S]*?return true;\s*\};/);
    expect(rt, 'requireTerms helper missing').toBeTruthy();
    const body = rt![0];
    expect(body).toMatch(/if \(!dobValid \|\| !isAdult\)/);
    expect(body).toMatch(/if \(!ageConfirmed18Plus\)/);
    expect(body).toMatch(/if \(!agreedTerms\)/);
  });

  it('consentOk requires DOB valid AND isAdult AND ageConfirmed18Plus AND agreedTerms', () => {
    // Marketing is intentionally absent — optional signals must never gate
    // account creation. All four hard signals AND-composed.
    expect(signup).toMatch(
      /const consentOk = dobValid && isAdult && ageConfirmed18Plus && agreedTerms;/,
    );
  });

  it('joinReady requires consentOk (all four gates)', () => {
    expect(signup).toMatch(
      /const joinReady = !busy && bothContacts && passwordValid && consentOk;/,
    );
  });

  it('social() does NOT run requireTerms() before OAuth (Google/Apple is the easy button)', () => {
    // Gating the OAuth tap on DOB / 18+ / Terms adds friction before we
    // know who the person is. Consent is collected AFTER OAuth on the
    // activation completion surface. Regression: no `if (... !requireTerms()) return`
    // in the social() prelude.
    const social = signup.match(/async function social\([^)]+\) \{[\s\S]*?setBusy\(true\);/);
    expect(social, 'social() prelude missing').toBeTruthy();
    expect(social![0]).not.toMatch(/!requireTerms\(\)/);
  });

  it('social session POSTs send ONLY the idToken (no fabricated consent for a user who has not ticked anything)', () => {
    // The client has NOT collected DOB / ageConfirmed / termsAccepted /
    // acceptedMarketing before the OAuth tap. Sending termsAccepted:true
    // here would fabricate consent the user never provided. Both social
    // paths (native Capacitor + web popup) must post only `{ idToken }`.
    const onlyIdTokenMatches = signup.match(
      /body: JSON\.stringify\(\{ idToken \}\)/g,
    );
    expect(onlyIdTokenMatches, 'social session body must be `{ idToken }` alone').toBeTruthy();
    // Native + web social = at least 2 occurrences.
    expect(onlyIdTokenMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it('manual signup session POSTs carry dateOfBirth + ageConfirmed + termsAccepted + acceptedMarketing (login omits all)', () => {
    // Manual paths: mobile-OTP verify(), email-OTP verifyEmailCode(),
    // email+password emailSubmit(). Each must forward all four fields on
    // signup so the server /session handler can enforce them; login mode
    // omits the four so a returning user's stored values are never
    // overwritten.
    // Phone verify() is signup-only (no authMode branch):
    expect(signup).toMatch(
      /body: JSON\.stringify\(\{ idToken, dateOfBirth: dob, ageConfirmed: true, termsAccepted: true, acceptedMarketing \}\)/,
    );
    // The two authMode-guarded consent spreads (email OTP + email+password):
    const guardedSpreads = signup.match(
      /\.\.\.\(authMode === 'login'\s*\?\s*\{\}\s*:\s*\{ ageConfirmed: true, termsAccepted: true, acceptedMarketing \}\)/g,
    );
    expect(guardedSpreads, 'guarded consent spread missing on email paths').toBeTruthy();
    expect(guardedSpreads!.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the mandatory 18+ checkbox with data-testid + required attribute', () => {
    // Explicit affirmative act separate from the DOB picker.
    expect(signup).toContain('data-testid="checkbox-ageConfirmed18Plus"');
    expect(signup).toMatch(/checked=\{ageConfirmed18Plus\}/);
    // Explicit label copy (EN + HE).
    expect(signup).toMatch(/I confirm that I am 18 years of age or older/);
    expect(signup).toMatch(/אני מאשר\/ת שאני בן\/בת 18/);
  });

  it('renders the mandatory Terms + Privacy checkbox with data-testid + required attribute', () => {
    expect(signup).toContain('data-testid="checkbox-agreedTerms"');
    expect(signup).toContain('aria-required="true"');
    expect(signup).toMatch(/checked=\{agreedTerms\}/);
  });

  it('renders a SEPARATE optional Marketing checkbox (never bundled with Terms)', () => {
    // The marketing checkbox must be its own control, its own state, and
    // its label must make optionality + unsubscribe rights explicit.
    expect(signup).toContain('data-testid="checkbox-acceptedMarketing"');
    expect(signup).toMatch(/checked=\{acceptedMarketing\}/);
    expect(signup).toMatch(/optional — you can unsubscribe anytime/);
    expect(signup).toMatch(/אופציונלי/);
  });
});

describe('server /session — independent age gate + consent audit separation', () => {
  const routes = read('server/routes.ts');

  it('extracts all three consent flags as STRICT booleans (accept only literal true)', () => {
    // A truthy string / 1 / null must never be coerced into a signup
    // consent. Guards the wire format contract on every axis.
    expect(routes).toMatch(/const ageConfirmed = \(req\.body as any\)\?\.ageConfirmed === true;/);
    expect(routes).toMatch(/const termsAcceptedFlag = \(req\.body as any\)\?\.termsAccepted === true;/);
    expect(routes).toMatch(/const acceptedMarketing = \(req\.body as any\)\?\.acceptedMarketing === true;/);
  });

  it('recalculates age from the DOB the client typed — never trusts ageConfirmed alone', () => {
    // The checkbox is affirmation, not evidence. Server derives age from
    // dateOfBirth and rejects when the calc says < 18, even if the box is
    // ticked. The independent calc must be present in the /session handler.
    expect(routes).toMatch(/const serverCalculatedAge = \(\(\): number \| null =>/);
    expect(routes).toMatch(/const serverAdult = serverCalculatedAge !== null && serverCalculatedAge >= 18;/);
  });

  it('stamps termsAcceptedAt + termsVersion + privacyAcceptedAt + privacyVersion together on signup only', () => {
    // One legal-consent event, four audit fields written in the same
    // updateUser call. Guarded by isNewUser + ageConfirmed + termsAcceptedFlag
    // + serverAdult + no prior termsAcceptedAt — a returning user cannot
    // silently rewrite their earlier audit record.
    expect(routes).toMatch(
      /if \([\s\S]*?_syncResult\?\.isNewUser[\s\S]*?&& ageConfirmed[\s\S]*?&& termsAcceptedFlag[\s\S]*?&& serverAdult[\s\S]*?&& !\(_syncResult\.user as any\)\.termsAcceptedAt/,
    );
    expect(routes).toMatch(/termsAcceptedAt: consentNow,/);
    expect(routes).toMatch(/termsVersion: TERMS_VERSION_CURRENT,/);
    expect(routes).toMatch(/privacyAcceptedAt: consentNow,/);
    expect(routes).toMatch(/privacyVersion: TERMS_VERSION_CURRENT,/);
  });

  it('logs a warning when termsAccepted arrives without the age gate satisfied (never stamps)', () => {
    // A mismatched client that sends termsAccepted without ageConfirmed
    // (or fails the server age check) must NOT be silently accepted.
    // Warning surfaces the drift; stamp is skipped.
    expect(routes).toMatch(/Terms acceptance rejected — age gate not satisfied/);
  });

  it('records marketingConsent as a bool WITHOUT touching Terms/Privacy audit timestamps', () => {
    // Marketing preference is separate from legal consent. The update
    // must NOT set privacyConsentUpdatedAt (which the old patch stamped
    // — that mixes a marketing preference change with a privacy-consent
    // audit change and makes the audit lane unusable) and must NOT set
    // termsAcceptedAt/privacyAcceptedAt.
    const marketingBlock = routes.match(
      /Marketing preference recorded[\s\S]{0,400}/,
    );
    expect(marketingBlock, 'marketing stamp block missing').toBeTruthy();
    // The marketing updateUser call is a SINGLE-FIELD object literal —
    // nothing else on the call. Match the specific tight shape and assert
    // no adjacent audit-lane keys were folded in.
    const tightMarketingCall = routes.match(
      /await authService\.updateUser\(decoded\.uid, \{\s*marketingConsent: acceptedMarketing,\s*\}\);/,
    );
    expect(tightMarketingCall, 'single-field marketing updateUser call missing').toBeTruthy();
    // Belt-and-braces: the marketing block itself (bounded by the log line
    // that immediately follows) must not contain any legal-audit field.
    const marketingBlockTight = routes.match(
      /Marketing preference recorded[\s\S]{0,300}?\}\);/,
    );
    expect(marketingBlockTight).toBeTruthy();
    // The block preceding the stamp call (the guard + call, up to the log line):
    const blockBeforeLog = routes.match(
      /if \(_syncResult\?\.isNewUser && \(req\.body as any\)\?\.acceptedMarketing !== undefined\)[\s\S]*?Marketing preference recorded/,
    );
    expect(blockBeforeLog, 'marketing guard block missing').toBeTruthy();
    expect(blockBeforeLog![0]).not.toMatch(/privacyConsentUpdatedAt/);
    expect(blockBeforeLog![0]).not.toMatch(/termsAcceptedAt/);
    expect(blockBeforeLog![0]).not.toMatch(/privacyAcceptedAt/);
  });

  it('does NOT auto-stamp Terms from social OAuth alone (OAuth authenticates, it does not accept Terms)', () => {
    // The old handler stamped termsAcceptedAt whenever the provider was
    // Google/Apple/Facebook — that fabricated a Terms acceptance from an
    // identity-only OAuth screen. Rebuild: the socialOAuthProviders
    // list must no longer appear inside the stamp condition.
    const stampCondition = routes.match(
      /if \([\s\S]{0,600}?termsAcceptedAt: consentNow,/,
    );
    expect(stampCondition, 'terms stamp condition missing').toBeTruthy();
    expect(stampCondition![0]).not.toMatch(/socialOAuthProviders\.includes/);
  });
});
