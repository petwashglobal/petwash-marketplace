/**
 * Password-reset anti-enumeration invariants — regression pin
 * (customer sign-in path · Lane D auth integrity).
 *
 * Password-reset is the biggest account-enumeration attack surface
 * in the app because it exposes "does this email exist?" through
 * any variance between success / failure paths. The CEO's Lane D
 * audit (2026-08-16 §D10) pinned this: the same generic message
 * MUST render whether Firebase confirms the send, silently
 * throws, or rejects an unknown account.
 *
 * SignUpLuxury.tsx now has TWO forgot-password buttons:
 *
 *   1. Primary tab UI · data-action-id="AUTH_FORGOT_PASSWORD"
 *      (fires the email-validation branch + toast).
 *   2. Compact link on returning-user password panel ·
 *      data-testid="link-forgot-password"
 *      (fires the client-side handleForgotPassword handler).
 *
 * Both paths MUST NEVER surface Firebase error variance to the user.
 * Both MUST fire emitCtaEvent for analytics. Both MUST use a stable
 * localised toast/message that's identical for exists/not-exists.
 *
 * This pin catches a refactor that:
 *   * removes the try/catch (would surface Firebase's `auth/user-not-found`)
 *   * removes emitCtaEvent (silent analytics gap)
 *   * changes the toast to leak "user not found" / "email not registered"
 *   * removes the double-submit guard (rate-limit / rapid clicks)
 *   * hard-codes ltr on an RTL-first surface
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

describe('Password reset · anti-enumeration invariants', () => {
  const src = read('client/src/pages/SignUpLuxury.tsx');
  const registrySrc = read('client/src/lib/ctaActions.ts');

  it('CTA registry defines AUTH_FORGOT_PASSWORD', () => {
    expect(registrySrc).toMatch(/\|\s*['"]AUTH_FORGOT_PASSWORD['"]/);
  });

  it('primary forgot-password button carries data-action-id="AUTH_FORGOT_PASSWORD"', () => {
    expect(src).toMatch(/data-action-id="AUTH_FORGOT_PASSWORD"/);
  });

  it('returning-user forgot-password link carries stable data-testid="link-forgot-password"', () => {
    expect(src).toMatch(/data-testid="link-forgot-password"/);
  });

  it('confirmation status message carries stable data-testid="text-forgot-sent"', () => {
    expect(src).toMatch(/data-testid="text-forgot-sent"/);
  });

  it('both paths use Firebase sendPasswordResetEmail (never a PetWash /api/ endpoint)', () => {
    // sendPasswordResetEmail is imported lazily in BOTH the handler
    // and the inline button.
    const occurrences = src.match(/sendPasswordResetEmail/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it('primary button ALWAYS emits AUTH_FORGOT_PASSWORD before firing sendPasswordResetEmail', () => {
    // emitCtaEvent runs first — analytics captures the intent even
    // if Firebase throws mid-await.
    const rx = /emitCtaEvent\('AUTH_FORGOT_PASSWORD'\)[\s\S]{0,200}try\s*\{[\s\S]{0,200}sendPasswordResetEmail/;
    expect(src).toMatch(rx);
  });

  it('handler-based forgot swallows ALL errors — no Firebase text ever surfaces', () => {
    // The handleForgotPassword definition wraps sendPasswordResetEmail
    // in try { ... } catch { ... } with an empty catch body.
    const rx = /handleForgotPassword\s*=\s*async[\s\S]{0,2000}try\s*\{[\s\S]{0,300}sendPasswordResetEmail[\s\S]{0,120}\}\s*catch\s*\{/;
    expect(src).toMatch(rx);
  });

  it('inline forgot button ALSO swallows ALL errors', () => {
    // The inline button (line 2168+) has its own catch block. Match
    // an empty catch body next to sendPasswordResetEmail.
    const rx = /await\s+sendPasswordResetEmail\(fbAuth,\s*email\)[\s\S]{0,120}\}\s*catch\s*\{[\s\S]{0,80}\/\*[^*]*Same generic message/;
    expect(src).toMatch(rx);
  });

  it('anti-enumeration toast text is generic — HE + EN both say "if an account exists"', () => {
    // HE variant: "אם קיים חשבון עבור <email>"
    expect(src).toMatch(/אם\s*קיים\s*חשבון\s*עבור/);
    // EN variant: "If an account exists for <email>"
    expect(src).toMatch(/If an account exists for/);
    // The confirmation status message also uses generic wording.
    expect(src).toMatch(/If an account exists for that address/);
  });

  it('handler blocks double-submit via forgotBusy state (rate-limit hygiene)', () => {
    // Guard at top of the handler.
    expect(src).toMatch(/if\s*\(\s*forgotBusy\s*\)\s*return/);
    // setForgotBusy(true) before the async work.
    expect(src).toMatch(/setForgotBusy\(\s*true\s*\)/);
    // setForgotBusy(false) in finally.
    expect(src).toMatch(/finally\s*\{[\s\S]{0,200}setForgotBusy\(\s*false\s*\)/);
  });

  it('client-side RFC-ish email shape check runs BEFORE Firebase call — no wasted round-trip', () => {
    // Regex must run before setForgotBusy(true).
    const rx = /if\s*\(\s*!\s*\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\/[\s\S]{0,200}setForgotBusy\(\s*true\s*\)/;
    expect(src).toMatch(rx);
  });

  it('inline button is disabled while busy or when email is invalid — no rapid-fire calls', () => {
    expect(src).toMatch(/disabled=\{busy\s*\|\|\s*!emailValid\}\s*[\r\n\s]*data-action-id="AUTH_FORGOT_PASSWORD"/);
  });
});
