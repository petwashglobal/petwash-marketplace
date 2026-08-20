import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Signup-friction audit (2026-08-19) SEV-2 pins.
//
// #3 AccountActivation crashed for email-first signups (Google / Apple /
//    email+password) — the page posted phone: user.phoneNumber (undefined)
//    to /api/auth/sms/start, the server returned 'phone_required', and the
//    user saw a generic "Failed to send code" toast with no next action.
//
// #4 AccountActivation was English-only + LTR hardcoded — a Hebrew user
//    completed the whole flow in RTL Hebrew and then landed on an English
//    LTR page for the last step, including an English activation email.
//
// #7 Server normalizeFlow silently downgraded 'general' / 'booking' /
//    'activation' to 'prestige' — the /api/auth/sms/* post-verify redirect
//    and every audit tag then falsely said "prestige signup" for users
//    who never touched Prestige.

const ACCOUNT_ACTIVATION = readFileSync(
  join(__dirname, '..', '..', 'client', 'src', 'pages', 'AccountActivation.tsx'),
  'utf8',
);
const AUTH_SMS = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'auth-sms.ts'),
  'utf8',
);

describe('signup-friction 2026-08-19 SEV-2 fixes', () => {
  // ── #3 email-first phone capture ─────────────────────────────────────
  describe('SEV-2 #3 — AccountActivation captures a phone for email-first signups', () => {
    it('declares local state for the captured phone + phone-input form', () => {
      expect(ACCOUNT_ACTIVATION).toMatch(/setCapturedPhone/);
      expect(ACCOUNT_ACTIVATION).toMatch(/setPhoneInput/);
      expect(ACCOUNT_ACTIVATION).toMatch(/setPhoneInputError/);
    });

    it('renders a phone-capture section BEFORE the "Send code" button when no phone is on file', () => {
      expect(ACCOUNT_ACTIVATION).toMatch(/data-testid="section-capture-phone"/);
      expect(ACCOUNT_ACTIVATION).toMatch(/data-testid="input-capture-phone"/);
      expect(ACCOUNT_ACTIVATION).toMatch(/data-testid="button-capture-phone-continue"/);
    });

    it('validates the captured phone with an E.164 regex before unlocking Send code', () => {
      // The regex literal itself — the fix intentionally enforces E.164
      // client-side so the user sees an inline hint before the request.
      expect(ACCOUNT_ACTIVATION).toMatch(/E164_RE\s*=\s*\/\^\\\+\\d\{8,15\}\\?\$\//);
    });

    it('posts the captured phone (not user.phoneNumber) to /api/auth/sms/start', () => {
      // The mutationFn computes `const phone = capturedPhone || user?.phoneNumber`
      // ABOVE the fetch call, then passes `phone` in the body. Verify both
      // halves — that the compute is present AND that the body sends it.
      const startFnStart = ACCOUNT_ACTIVATION.indexOf('const sendOtpMutation');
      const startFnEnd = ACCOUNT_ACTIVATION.indexOf('const verifyOtpMutation');
      expect(startFnStart).toBeGreaterThan(-1);
      expect(startFnEnd).toBeGreaterThan(startFnStart);
      const startFn = ACCOUNT_ACTIVATION.slice(startFnStart, startFnEnd);
      expect(startFn).toMatch(/capturedPhone\s*\|\|\s*user\?\.phoneNumber/);
      expect(startFn).toContain('"/api/auth/sms/start"');
    });

    it('reuses the captured phone on /api/auth/sms/verify so the OTP-store key lines up', () => {
      const verifyFnStart = ACCOUNT_ACTIVATION.indexOf('const verifyOtpMutation');
      const verifyFnEnd = ACCOUNT_ACTIVATION.indexOf('const sendEmailMutation');
      expect(verifyFnStart).toBeGreaterThan(-1);
      expect(verifyFnEnd).toBeGreaterThan(verifyFnStart);
      const verifyFn = ACCOUNT_ACTIVATION.slice(verifyFnStart, verifyFnEnd);
      expect(verifyFn).toMatch(/capturedPhone\s*\|\|\s*user\?\.phoneNumber/);
      expect(verifyFn).toContain('"/api/auth/sms/verify"');
    });
  });

  // ── #4 i18n + RTL ────────────────────────────────────────────────────
  describe('SEV-2 #4 — AccountActivation is bilingual and direction-aware', () => {
    it('reads i18nextLng from localStorage the same way AccessPending does', () => {
      expect(ACCOUNT_ACTIVATION).toMatch(/localStorage\.getItem\(['"]i18nextLng['"]\)/);
      expect(ACCOUNT_ACTIVATION).toMatch(/const\s+isHe\s*=\s*lang\s*===\s*['"]he['"]/);
    });

    it('no longer hardcodes dir="ltr" on the wrapper', () => {
      // The wrapper must use dir={isHe ? 'rtl' : 'ltr'} on BOTH the loading
      // state and the main return, so a Hebrew user is never dropped into a
      // stray LTR shell.
      expect(ACCOUNT_ACTIVATION).not.toMatch(/<div className="min-h-screen bg-white" dir="ltr">/);
      expect(ACCOUNT_ACTIVATION).toMatch(/dir=\{isHe \? ['"]rtl['"] : ['"]ltr['"]\}/);
    });

    it('sends the runtime language to the activation-email endpoint (not hardcoded "en")', () => {
      const emailFnStart = ACCOUNT_ACTIVATION.indexOf('const sendEmailMutation');
      const emailFnEnd = ACCOUNT_ACTIVATION.indexOf('// Stop polling', emailFnStart);
      expect(emailFnStart).toBeGreaterThan(-1);
      expect(emailFnEnd).toBeGreaterThan(emailFnStart);
      const emailFn = ACCOUNT_ACTIVATION.slice(emailFnStart, emailFnEnd);
      expect(emailFn).toContain('/api/onboarding-verification/send-activation-email');
      expect(emailFn).toMatch(/language:\s*lang/);
      expect(emailFn).not.toMatch(/language:\s*["']en["']/);
    });

    it('carries a bilingual t object with Hebrew copy for every user-visible surface', () => {
      // Anchor on a few Hebrew strings we shipped; if they drift we want the
      // regression to shout so the copy stays audited.
      expect(ACCOUNT_ACTIVATION).toContain('הפעלת חשבון');
      expect(ACCOUNT_ACTIVATION).toContain('השלימו את החשבון שלכם');
      expect(ACCOUNT_ACTIVATION).toContain('אימות נייד');
      expect(ACCOUNT_ACTIVATION).toContain('שליחת קוד אימות');
      expect(ACCOUNT_ACTIVATION).toContain('אישור הקוד');
      expect(ACCOUNT_ACTIVATION).toContain('שליחת דוא"ל הפעלה');
    });

    it('the /start body also passes language: lang so the SMS provider template matches', () => {
      const startFnStart = ACCOUNT_ACTIVATION.indexOf('const sendOtpMutation');
      const startFnEnd = ACCOUNT_ACTIVATION.indexOf('const verifyOtpMutation');
      const startFn = ACCOUNT_ACTIVATION.slice(startFnStart, startFnEnd);
      expect(startFn).toMatch(/language:\s*lang/);
    });
  });

  // ── #7 normalizeFlow buckets ─────────────────────────────────────────
  describe('SEV-2 #7 — server normalizeFlow recognizes every client-sent flow', () => {
    it('AuthFlow union covers general | booking | activation in addition to prestige|provider|guest', () => {
      // Anchor on the exact union text so nobody silently drops a value.
      expect(AUTH_SMS).toMatch(/export type AuthFlow =[^;]*'prestige'/);
      expect(AUTH_SMS).toMatch(/export type AuthFlow =[^;]*'provider'/);
      expect(AUTH_SMS).toMatch(/export type AuthFlow =[^;]*'guest'/);
      expect(AUTH_SMS).toMatch(/export type AuthFlow =[^;]*'general'/);
      expect(AUTH_SMS).toMatch(/export type AuthFlow =[^;]*'booking'/);
      expect(AUTH_SMS).toMatch(/export type AuthFlow =[^;]*'activation'/);
    });

    it('FLOW_REDIRECTS maps every new flow to a real client route (no more silent prestige bucketing)', () => {
      const start = AUTH_SMS.indexOf('const FLOW_REDIRECTS');
      expect(start).toBeGreaterThan(-1);
      const end = AUTH_SMS.indexOf('};', start);
      expect(end).toBeGreaterThan(start);
      const block = AUTH_SMS.slice(start, end);
      // SEV-1 fix (2026-08-20): /member/dashboard was a 404 — the canonical
      // members' route is /prestige/home. See auth-wiring-sev1-five-gaps
      // regression test for the pin against the new value.
      expect(block).toMatch(/prestige:\s*['"]\/prestige\/home['"]/);
      expect(block).toMatch(/provider:\s*['"]\/provider\/dashboard['"]/);
      expect(block).toMatch(/guest:\s*['"]\/egift['"]/);
      expect(block).toMatch(/booking:\s*['"]\/booking['"]/);
      expect(block).toMatch(/activation:\s*['"]\/activate-account['"]/);
      expect(block).toMatch(/general:\s*['"]\/['"]/);
    });

    it('normalizeFlow accepts every known flow via a Set membership check (not a hardcoded 3-value OR)', () => {
      // The old code was:
      //   input === 'provider' || input === 'guest' || input === 'prestige' ? input : DEFAULT_FLOW
      // The fix routes through KNOWN_FLOWS so adding a new flow to the union
      // does NOT require touching the guard in a second place.
      expect(AUTH_SMS).toMatch(/KNOWN_FLOWS/);
      expect(AUTH_SMS).toMatch(/KNOWN_FLOWS\s*as\s*Set<string>\)\.has\(input\)/);
    });

    it('every flow: string literal the client posts to /api/auth/sms/* is a KNOWN_FLOWS member', () => {
      // Grep the client for `flow: 'x'` inside AccountActivation.tsx and
      // SignUpLuxury.tsx — the two callers of /api/auth/sms/*.
      const signup = readFileSync(
        join(__dirname, '..', '..', 'client', 'src', 'pages', 'SignUpLuxury.tsx'),
        'utf8',
      );
      // AccountActivation uses 'activation'; SignUpLuxury's Flow union
      // exposes 'prestige' | 'provider' | 'guest' | 'booking' | 'general'.
      expect(ACCOUNT_ACTIVATION).toMatch(/flow:\s*['"]activation['"]/);
      expect(signup).toMatch(/type Flow =[^;]*'prestige'/);
      expect(signup).toMatch(/type Flow =[^;]*'provider'/);
      expect(signup).toMatch(/type Flow =[^;]*'guest'/);
      expect(signup).toMatch(/type Flow =[^;]*'booking'/);
      expect(signup).toMatch(/type Flow =[^;]*'general'/);
    });
  });
});
