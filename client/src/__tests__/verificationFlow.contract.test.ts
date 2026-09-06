/**
 * Contract pins for the ONE Pet Wash verification experience.
 *
 * The product rule (CEO 2026-09-06) is that there is a single reusable
 * verification system across signup, login, eGift, account settings, provider,
 * payout, email change, phone change, account closure and sensitive financial
 * actions — not a bespoke OTP form per surface. These pins hold the parts of
 * that rule a reviewer cannot eyeball: the copy is purpose-aware in BOTH
 * languages, the flow never masks a destination itself, and the six-digit
 * entry keeps the mobile affordances that make it usable one-handed.
 *
 * Source-scanning, in the house style of the sibling client pins — this repo
 * has no jsdom/testing-library setup and adding one is not this change.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHANNEL_NOUN,
  UI_COPY,
  purposeCopy,
  verificationErrorMessage,
  type VerificationPurpose,
} from '../lib/verification/purposeCopy';

const ROOT = join(__dirname, '..', '..', '..');
const FLOW = readFileSync(
  join(ROOT, 'client/src/components/verification/VerificationFlow.tsx'),
  'utf8',
);
const HOOK = readFileSync(
  join(ROOT, 'client/src/lib/verification/useVerificationChallenge.ts'),
  'utf8',
);

const ALL_PURPOSES: VerificationPurpose[] = [
  'diagnostic_noop', 'login', 'signup', 'egift_redeem',
  'change_email', 'enable_2fa', 'disable_2fa', 'close_account', 'payout',
];

describe('purpose-aware copy — no more generic "Verification code"', () => {
  it('every purpose has real copy in English AND Hebrew', () => {
    for (const p of ALL_PURPOSES) {
      for (const lang of ['en', 'he'] as const) {
        const c = purposeCopy(p, lang);
        for (const field of ['title', 'lede', 'cta', 'next'] as const) {
          expect(c[field].trim().length, `${p}.${lang}.${field}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('the Hebrew is actually Hebrew, not an untranslated English string', () => {
    const hebrew = /[֐-׿]/;
    for (const p of ALL_PURPOSES) {
      const c = purposeCopy(p, 'he');
      expect(hebrew.test(c.title), `${p} title`).toBe(true);
      expect(hebrew.test(c.lede), `${p} lede`).toBe(true);
      expect(hebrew.test(c.cta), `${p} cta`).toBe(true);
    }
  });

  it('no two purposes share the same English lede — the screen must say WHY', () => {
    const ledes = ALL_PURPOSES.map((p) => purposeCopy(p, 'en').lede);
    expect(new Set(ledes).size).toBe(ledes.length);
  });

  it('every purpose answers "what happens next"', () => {
    for (const p of ALL_PURPOSES) {
      expect(purposeCopy(p, 'en').next.length).toBeGreaterThan(10);
      expect(purposeCopy(p, 'he').next.length).toBeGreaterThan(5);
    }
  });

  it('carries the exact purpose wording the CEO specified', () => {
    expect(purposeCopy('login', 'en').lede).toContain('sign in to Pet Wash');
    expect(purposeCopy('signup', 'en').lede).toContain('finish creating your Pet Wash account');
    expect(purposeCopy('change_email', 'en').title).toContain('new email address');
    expect(purposeCopy('egift_redeem', 'en').lede).toContain("Confirm that it's you");
    expect(purposeCopy('payout', 'en').lede).toContain('payout');
    expect(purposeCopy('close_account', 'en').lede).toContain('account closure');
    expect(purposeCopy('enable_2fa', 'en').lede).toContain('extra security');
  });

  it('an unknown purpose falls back rather than throwing on a customer', () => {
    expect(() => purposeCopy('not_a_purpose' as VerificationPurpose, 'en')).not.toThrow();
  });
});

describe('error copy is human and actionable', () => {
  it('names a next action for every reason code, in both languages', () => {
    const codes = [
      'INVALID_CODE', 'CHALLENGE_EXPIRED', 'CHALLENGE_LOCKED',
      'CHALLENGE_COOLDOWN', 'SMS_PROVIDER_ERROR', 'NETWORK',
    ];
    for (const code of codes) {
      for (const lang of ['en', 'he'] as const) {
        expect(verificationErrorMessage(code, lang).length, `${code}.${lang}`).toBeGreaterThan(8);
      }
    }
  });

  it('uses the wording the CEO specified for the common failures', () => {
    expect(verificationErrorMessage('INVALID_CODE', 'en')).toBe("That code isn't correct. Try again.");
    expect(verificationErrorMessage('CHALLENGE_EXPIRED', 'en')).toBe('That code has expired. Send a new one.');
    expect(verificationErrorMessage('SMS_PROVIDER_ERROR', 'en')).toContain('use another method');
  });

  it('a network error promises the challenge survives — it must not read like a reset', () => {
    expect(verificationErrorMessage('NETWORK', 'en')).toContain('still valid');
  });

  it('an unmapped code still gets a human sentence, never a raw enum', () => {
    const msg = verificationErrorMessage('SOME_NEW_SERVER_CODE', 'en');
    expect(msg).not.toContain('SOME_NEW_SERVER_CODE');
    expect(msg).toBe('Something went wrong. Try again.');
  });

  it('never reveals whether an account exists', () => {
    for (const lang of ['en', 'he'] as const) {
      for (const code of ['CHALLENGE_NOT_FOUND', 'CODE_MISMATCH', 'DELIVERY_FAILED']) {
        const msg = verificationErrorMessage(code, lang).toLowerCase();
        expect(msg).not.toContain('no account');
        expect(msg).not.toContain('not registered');
        expect(msg).not.toContain('לא רשום');
      }
    }
  });
});

describe('the error map covers every code the server can actually throw', () => {
  /**
   * This exists because the first draft of the map was written from memory and
   * invented CODE_MISMATCH and TOO_MANY_ATTEMPTS — codes the service never
   * emits. The real ones are INVALID_CODE and CHALLENGE_LOCKED, so a customer
   * who mistyped a digit would have been shown "Something went wrong."
   *
   * Rather than fix the two strings and move on, this reads the reason codes
   * straight out of UnifiedVerificationService and fails if ANY of them lacks
   * customer copy. Adding a new throw site to the service now fails here until
   * someone writes the sentence a customer will read.
   */
  const SERVICE = readFileSync(
    join(ROOT, 'server/services/UnifiedVerificationService.ts'),
    'utf8',
  );

  function serverReasonCodes(): string[] {
    const codes = new Set<string>();
    for (const m of SERVICE.matchAll(/new UnifiedVerificationError\(\s*\n?\s*"([A-Z_]+)"/g)) {
      codes.add(m[1]);
    }
    // The locked/invalid throw picks its code with a ternary.
    for (const m of SERVICE.matchAll(/locked \? "([A-Z_]+)" : "([A-Z_]+)"/g)) {
      codes.add(m[1]);
      codes.add(m[2]);
    }
    return [...codes].sort();
  }

  it('finds the reason codes (the scan itself must not silently match nothing)', () => {
    const codes = serverReasonCodes();
    expect(codes.length).toBeGreaterThan(10);
    expect(codes).toContain('INVALID_CODE');
    expect(codes).toContain('CHALLENGE_LOCKED');
  });

  it('every server reason code has real customer copy in both languages', () => {
    const generic = {
      en: verificationErrorMessage('__definitely_not_a_code__', 'en'),
      he: verificationErrorMessage('__definitely_not_a_code__', 'he'),
    };
    for (const code of serverReasonCodes()) {
      for (const lang of ['en', 'he'] as const) {
        const msg = verificationErrorMessage(code, lang);
        expect(msg, `${code} (${lang}) falls through to the generic message`).not.toBe(generic[lang]);
      }
    }
  });
});

describe('VerificationFlow — the reusable screen', () => {
  it('renders the SERVER-masked destination and never masks one itself', () => {
    expect(FLOW).toContain('challenge?.maskedDestination');
    // A client that masks is a client that was handed a raw address.
    expect(FLOW).not.toMatch(/maskEmail|maskPhone|maskDestinationForOwner/);
  });

  it('uses ONE accessible input, not six separate ones', () => {
    expect(FLOW).toContain('<InputOTP');
    expect(FLOW).not.toMatch(/inputRefs/);
  });

  it('keeps the mobile affordances that make a code usable one-handed', () => {
    expect(FLOW).toContain('autoComplete="one-time-code"');
    expect(FLOW).toContain('inputMode="numeric"');
    expect(FLOW).toContain("pattern=\"[0-9]*\"");
  });

  it('Enter submits a complete code', () => {
    expect(FLOW).toMatch(/e\.key === 'Enter'/);
  });

  it('submits a given code only once, by ANY route — auto OR a Continue click', () => {
    /**
     * This pin originally checked only the auto-submit path, and the browser
     * suite immediately showed why that was not enough: type six digits
     * (auto-submit fires) then click Continue twice, and the server saw THREE
     * verifies — three of the customer's five attempts on one code, and a
     * double-submit of a one-shot code on the success path.
     *
     * The guard now lives in submit() itself, so both routes go through it.
     */
    expect(FLOW).toContain('lastSubmitted');
    expect(FLOW).toMatch(/if \(lastSubmitted\.current === value\) return;/);
    // It must sit in submit(), not in the auto-submit effect, or the manual
    // path walks straight past it again.
    const submitFn = FLOW.slice(FLOW.indexOf('const submit = useCallback'), FLOW.indexOf('// Auto-submit only'));
    expect(submitFn).toContain('lastSubmitted.current === value');
  });

  it('is genuinely RTL for Hebrew, not translated strings in an LTR box', () => {
    expect(FLOW).toMatch(/dir=\{he \? 'rtl' : 'ltr'\}/);
    // …but the digits themselves stay LTR: a code reads left-to-right everywhere.
    expect(FLOW).toMatch(/dir="ltr"/);
  });

  it('offers only the channels the SERVER allows for the purpose', () => {
    expect(FLOW).toContain('allowedChannels');
    // No hard-coded "also try SMS" that ignores policy.
    expect(FLOW).not.toMatch(/\[['"]sms['"], ?['"]whatsapp['"]\]/);
  });

  it('states what happens next, up front', () => {
    expect(FLOW).toContain('copy.next');
  });
});

describe('useVerificationChallenge — the single client owner', () => {
  it('talks to the canonical endpoints and no bespoke ones', () => {
    expect(HOOK).toContain('/api/verification/start');
    expect(HOOK).toContain('/api/verification/verify');
    expect(HOOK).toContain('/api/verification/resend');
    expect(HOOK).not.toContain('/api/onboarding-verification');
    expect(HOOK).not.toContain('/api/transaction-otp');
    expect(HOOK).not.toContain('/api/provider/phone');
  });

  it('drives the resend countdown from the server, not a hard-coded number', () => {
    expect(HOOK).toContain('resendAvailableAt');
    // A literal 30/60-second cooldown in the client would drift from the server's.
    expect(HOOK).not.toMatch(/setResendIn\(\s*(30|60)\s*\)/);
  });

  it('guards double-submit so two clicks cannot spend two attempts', () => {
    expect(HOOK).toContain('inFlight');
  });

  it('a failed verify keeps the challenge — the form must not reset', () => {
    expect(HOOK).toContain('// Keep the challenge.');
    expect(HOOK).toMatch(/setPhase\('awaiting_code'\)/);
  });

  it('never stores a code anywhere persistent', () => {
    expect(HOOK).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});

describe('no OTP value can reach a log, a URL or analytics', () => {
  for (const [name, src] of [['VerificationFlow', FLOW], ['useVerificationChallenge', HOOK]] as const) {
    it(`${name} logs no code`, () => {
      expect(src).not.toMatch(/console\.(log|info|warn|error)\s*\([^)]*code/i);
      expect(src).not.toMatch(/[?&]code=/);
    });
  }
});

describe('shared chrome copy', () => {
  it('has both languages for every string', () => {
    for (const [key, entry] of Object.entries(UI_COPY)) {
      for (const lang of ['en', 'he'] as const) {
        const v = (entry as any)[lang];
        const rendered = typeof v === 'function' ? v('x') : v;
        expect(String(rendered).length, `${key}.${lang}`).toBeGreaterThan(0);
      }
    }
  });

  it('names the channel the customer should check', () => {
    expect(CHANNEL_NOUN.email.en).toBe('email');
    expect(CHANNEL_NOUN.sms.he).toBe('טלפון');
    expect(CHANNEL_NOUN.whatsapp.en).toBe('WhatsApp');
  });
});

describe('signup/login migration — one screen, two transports', () => {
  const SIGNUP = readFileSync(join(ROOT, 'client/src/pages/SignUpLuxury.tsx'), 'utf8');
  const TRANSPORT = readFileSync(
    join(ROOT, 'client/src/lib/verification/authEmailTransport.ts'),
    'utf8',
  );
  const SWITCH = readFileSync(join(ROOT, 'client/src/lib/verification/rolloutSwitch.ts'), 'utf8');
  const AUTH_EMAIL = readFileSync(join(ROOT, 'server/routes/auth-email.ts'), 'utf8');

  it('the email code screen renders the SHARED flow, not another OTP form', () => {
    expect(SIGNUP).toContain('<VerificationFlow');
    expect(SIGNUP).toContain("purpose={authMode === 'login' ? 'login' : 'signup'}");
  });

  it('THE TURNSTILE GUARD SURVIVES — the flow does not bypass /api/auth/email/start', () => {
    /**
     * The obvious migration is to point VerificationFlow at /api/verification.
     * That would silently drop turnstileGuard({ action: 'signup_email_start' })
     * from the most-attacked surface in the product, because the generic
     * endpoint has no bot check. Hence a transport.
     */
    expect(AUTH_EMAIL).toContain("turnstileGuard({ action: 'signup_email_start' })");
    expect(TRANSPORT).toContain('/api/auth/email/start');
    expect(TRANSPORT).not.toContain('/api/verification/start');
  });

  it('the page keeps ownership of the guarded start; the flow ADOPTS the challenge', () => {
    // autoStart={false} + existingChallenge means the flow never opens a
    // second challenge, which would invalidate the code already sent.
    expect(SIGNUP).toContain('autoStart={false}');
    expect(SIGNUP).toContain('existingChallenge={emailChallenge}');
  });

  it('the adopted challenge cannot outlive the code screen', () => {
    // `sent` is cleared from a dozen places; one effect owns the lifetime so
    // none of them can leave a stale masked address on screen.
    expect(SIGNUP).toMatch(/if \(!sent\) setEmailChallenge\(null\)/);
  });

  it('the OTP is consumed ONCE — stage 1 is not re-run after the flow verifies', () => {
    // Re-verifying a one-shot code returns CHALLENGE_NOT_PENDING, which reads
    // to the customer as "wrong code" for a code that was correct.
    expect(SIGNUP).toContain('presuppliedSessionToken');
    expect(SIGNUP).toMatch(/verifyEmailCode\('', token\)/);
  });

  it('stages 2-4 are still shared by both paths — only the screen moved', () => {
    expect(SIGNUP).toMatch(/let sessionToken = presuppliedSessionToken \|\| cachedEmailSessionToken/);
  });

  it('verify targets THIS challenge, not "the latest for this address"', () => {
    // Two tabs, or a resend, and "latest" is no longer what is on screen.
    expect(TRANSPORT).toContain('verificationChallengeId: a.challengeId');
    expect(AUTH_EMAIL).toContain('verificationChallengeId');
  });

  it('resend hits the resend route, NOT start — start would kill the code already sent', () => {
    expect(TRANSPORT).toContain('/api/auth/email/resend');
    expect(AUTH_EMAIL).toMatch(/router\.post\('\/resend'/);
  });

  it('the transport reads the email from the caller — the wire stays masked', () => {
    expect(TRANSPORT).toContain('opts.getEmail()');
    // It must not try to recover a raw address from the challenge.
    expect(TRANSPORT).not.toMatch(/challenge as any\)\.email/);
  });

  it('the rollout switch is INDEPENDENT of the server purpose flags', () => {
    // The UNIFIED_VERIFICATION_* flags enable backend purposes and have been ON
    // for login/signup for a while. Treating that as a rollout plan would swap
    // the live signup screen for everyone on a deploy.
    expect(SWITCH).not.toContain('UNIFIED_VERIFICATION_LOGIN_ENABLED');
    expect(SWITCH).toContain('pwverify');
    expect(SWITCH).toContain('VITE_UNIFIED_VERIFICATION_UI');
  });

  it('the switch survives the auth redirect round-trip', () => {
    // Firebase bounces the browser; a query param alone would be lost.
    expect(SWITCH).toContain('sessionStorage');
  });

  it('the switch never throws on a page that must always render', () => {
    // sessionStorage access throws outright in some privacy modes.
    expect(SWITCH.match(/try \{/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('both branches exist ONLY while the switch does — this is temporary by construction', () => {
    expect(SIGNUP).toContain('sharedVerificationUi &&');
    expect(SIGNUP).toContain('!sharedVerificationUi &&');
    expect(SWITCH).toContain('TEMPORARY BY CONSTRUCTION');
  });
});
