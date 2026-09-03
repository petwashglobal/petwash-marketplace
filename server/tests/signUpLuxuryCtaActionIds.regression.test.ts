/**
 * Lane B follow-up · CTA action-id wiring on SignUpLuxury.tsx
 * (post-release 2026-09-03).
 *
 * The CTA action-id registry (client/src/lib/ctaActions.ts) is only
 * as valuable as the CTAs actually wearing its identity attributes.
 * These pins prove that every primary auth CTA on the /signin +
 * /signup surface carries:
 *
 *   1. `data-action-id="<AUTH_*>"` — a stable DOM handle that
 *      survives i18n copy swaps, CSS refactors, and label edits.
 *   2. An `emitCtaEvent('<AUTH_*>')` call inside the tap handler —
 *      so the observability sink (opt-in) sees a semantic id, not
 *      a translated label.
 *
 * A refactor that strips a data-action-id OR forgets an
 * emitCtaEvent call must fail here loudly, before the pin
 * reappears as "tap did nothing" in a post-mortem.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SIGNUP = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'SignUpLuxury.tsx'),
  'utf8',
);

describe('SignUpLuxury · CTA action-id wiring (Lane B follow-up)', () => {
  it('imports emitCtaEvent from the canonical registry (no shadow copy)', () => {
    expect(SIGNUP).toMatch(
      /import \{ emitCtaEvent \} from '@\/lib\/ctaActions';/,
    );
  });

  it('Google button carries AUTH_GOOGLE identity AND emits the event', () => {
    expect(SIGNUP).toMatch(/data-action-id="AUTH_GOOGLE"/);
    expect(SIGNUP).toMatch(
      /onClick=\{\(\) => \{ emitCtaEvent\('AUTH_GOOGLE'\); social\('google'\); \}\}/,
    );
  });

  it('Apple button carries AUTH_APPLE identity AND emits the event', () => {
    expect(SIGNUP).toMatch(/data-action-id="AUTH_APPLE"/);
    expect(SIGNUP).toMatch(
      /onClick=\{\(\) => \{ emitCtaEvent\('AUTH_APPLE'\); social\('apple'\); \}\}/,
    );
  });

  it('"Continue with mobile" button carries AUTH_PHONE_OTP identity', () => {
    expect(SIGNUP).toMatch(/data-action-id="AUTH_PHONE_OTP"/);
    expect(SIGNUP).toMatch(/emitCtaEvent\('AUTH_PHONE_OTP'\);\s*setManualMode\(true\); setMethod\('mobile'\)/);
  });

  it('"Continue with email" button carries AUTH_EMAIL_PASSWORD identity', () => {
    expect(SIGNUP).toMatch(/data-action-id="AUTH_EMAIL_PASSWORD"/);
    expect(SIGNUP).toMatch(/emitCtaEvent\('AUTH_EMAIL_PASSWORD'\);\s*setManualMode\(true\); setMethod\('email'\)/);
  });

  it('Passkey button carries AUTH_PASSKEY identity AND emits the event', () => {
    expect(SIGNUP).toMatch(/data-action-id="AUTH_PASSKEY"/);
    expect(SIGNUP).toMatch(
      /onClick=\{\(\) => \{ emitCtaEvent\('AUTH_PASSKEY'\); handlePasskeyLogin\(\); \}\}/,
    );
  });

  it('Forgot-password link carries AUTH_FORGOT_PASSWORD identity AND emits AFTER the empty-email guard', () => {
    // The emit MUST come AFTER the invalid-email early return so a
    // failed validation click does not still record an "attempted
    // password reset" event.
    expect(SIGNUP).toMatch(/data-action-id="AUTH_FORGOT_PASSWORD"/);
    expect(SIGNUP).toMatch(
      /if \(!emailValid\) \{[\s\S]{0,300}return;\s*\}\s*emitCtaEvent\('AUTH_FORGOT_PASSWORD'\);/,
    );
  });

  it('Both resend-OTP buttons carry AUTH_RESEND_OTP with a channel qualifier', () => {
    // Each button emits with an `{ channel: '<mobile|email>' }`
    // qualifier so downstream analytics can split retries by channel.
    expect(SIGNUP).toMatch(/emitCtaEvent\('AUTH_RESEND_OTP', \{ channel: 'mobile' \}\);/);
    expect(SIGNUP).toMatch(/emitCtaEvent\('AUTH_RESEND_OTP', \{ channel: 'email' \}\);/);
    // Both buttons carry the shared identity attribute.
    const resendActionIds = SIGNUP.match(/data-action-id="AUTH_RESEND_OTP"/g) ?? [];
    expect(resendActionIds.length).toBe(2);
  });

  it('every AUTH_* identity string used here also exists in the CtaAction enum (no stray literals)', () => {
    const REGISTRY = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'client', 'src', 'lib', 'ctaActions.ts'),
      'utf8',
    );
    const used = Array.from(SIGNUP.matchAll(/emitCtaEvent\('([A-Z_]+)'/g)).map(
      (m) => m[1],
    );
    // Guard: at least one AUTH_ id must be emitted from this file.
    expect(used.length).toBeGreaterThan(0);
    for (const id of new Set(used)) {
      // Registry keeps every CtaAction as a `| '<id>'` union member.
      expect(REGISTRY).toContain(`| '${id}'`);
    }
  });
});
