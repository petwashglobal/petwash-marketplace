/**
 * NextBestActionCard render surface — regression pin
 * (Journey Brain Phase 5 · post-release 2026-09-04).
 *
 * The client component consuming `useNextBestAction()` has three
 * properties that MUST NOT rot in a refactor:
 *
 *   1. It is a PURE renderer — no client-side priority logic. All
 *      selection is done on the server (nextBestAction.ts). The
 *      client reads `primaryAction` / `secondaryActions` verbatim.
 *
 *   2. It ships a defence-in-depth payment-truth guard — if the
 *      server EVER leaks a forbidden key (chargeId / paidAt /
 *      refundId / fiscalDocumentNumber / …), the card suppresses
 *      the card rather than render it. AttentionList still shows
 *      its own items.
 *
 *   3. Resume taps fire `RESUME_JOURNEY` via `emitCtaEvent` — a
 *      distinct CTA identity from `BOOK_CONFIRM`. Analytics needs
 *      to tell resume-hint conversion from a real booking submit.
 *
 * These are source-anchored because the runtime tests belong in a
 * JSDOM + React Testing Library harness; this pin catches accidental
 * removals in a plain vitest run that ships with every PR.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

describe('NextBestActionCard · regression pins', () => {
  const src = read('client/src/components/NextBestActionCard.tsx');
  const hookSrc = read('client/src/hooks/useNextBestAction.ts');
  const registrySrc = read('client/src/lib/ctaActions.ts');

  it('imports emitCtaEvent from the CTA registry', () => {
    expect(src).toMatch(
      /import\s*\{[^}]*\bemitCtaEvent\b[^}]*\}\s*from\s*['"]@\/lib\/ctaActions['"]/,
    );
  });

  it('reads primaryAction + secondaryActions directly from the server hook — no local re-selection', () => {
    expect(src).toMatch(
      /const\s*\{\s*primaryAction\s*,\s*secondaryActions\s*,\s*isLoading\s*\}\s*=\s*useNextBestAction/,
    );
    // No `priority ===` client-side comparison in the render body.
    // (Icons are typed by nextAction / kind, not by priority.)
    const priorityCompare = /priority\s*===\s*['"](urgent|due_soon|informational)['"]/.exec(src);
    expect(priorityCompare, 'client must not re-select by priority').toBeNull();
  });

  it('defence-in-depth: suppresses a card whose payload leaks any forbidden payment-truth key', () => {
    // Guard function present.
    expect(src).toMatch(/isPaymentTruthLeaked/);
    // Guarded keys include every payment-truth key the server strips.
    for (const k of [
      'chargeId',
      'paidAt',
      'refundId',
      'fiscalDocumentNumber',
      'settlementId',
      'transactionId',
      'redirectUrl',
      'paymentUrl',
      'voucherCode',
      'eGiftId',
    ]) {
      expect(src).toContain(`'${k}'`);
    }
    // The primary render is gated on the guard returning false.
    expect(src).toMatch(/if\s*\(\s*isPaymentTruthLeaked\(\s*primaryAction\s*\)\s*\)\s*return\s+null/);
  });

  it('resume taps emit RESUME_JOURNEY (not BOOK_CONFIRM)', () => {
    // A resume branch fires RESUME_JOURNEY.
    expect(src).toMatch(
      /if\s*\(\s*isResumeAction\(action\)\s*\)\s*\{[\s\S]{0,200}emitCtaEvent\(\s*['"]RESUME_JOURNEY['"]/,
    );
    // A non-resume branch fires BOOK_CONFIRM.
    expect(src).toMatch(
      /}\s*else\s*\{[\s\S]{0,200}emitCtaEvent\(\s*['"]BOOK_CONFIRM['"]/,
    );
  });

  it('CTA registry defines RESUME_JOURNEY as a first-class action', () => {
    expect(registrySrc).toMatch(/\|\s*['"]RESUME_JOURNEY['"]/);
  });

  it('hook fails-CLOSED to an empty projection on any endpoint hiccup', () => {
    // The EMPTY_RESULT sentinel exists and is returned on !res.ok.
    expect(hookSrc).toMatch(/EMPTY_RESULT/);
    expect(hookSrc).toMatch(/if\s*\(\s*!res\.ok\s*\)\s*return\s+EMPTY_RESULT/);
  });

  it('hook is disabled when the user is signed out — no polling to a private endpoint from a guest', () => {
    expect(hookSrc).toMatch(/enabled:\s*!!user/);
  });

  it('render surface exposes stable data-testids for E2E', () => {
    expect(src).toMatch(/data-testid=\{`next-best-action-\$\{actor\}`\}/);
    expect(src).toMatch(/data-testid="next-best-action-primary"/);
    expect(src).toMatch(/data-testid="next-best-action-secondary-list"/);
  });
});
