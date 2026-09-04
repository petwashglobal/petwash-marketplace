/**
 * NextBestActionCard dismiss + feedback loop — regression pin
 * (Journey Brain Phase 6 · post-release 2026-09-04).
 *
 * The final piece of the Phase 6 loop: a user can dismiss the
 * primary card, which sends 'not_interested' to the server; the
 * composer then suppresses that same action_key for the 7-day
 * cooldown. This pin guards the client wire.
 *
 * Properties pinned:
 *
 *   1. The card imports useNextBestActionFeedback + actionKeyFor
 *      from the hook module.
 *   2. The primary tap sends the "act" verdict so the composer
 *      can distinguish click-throughs from dismissals.
 *   3. The dismiss X exists with data-testid="next-best-action-dismiss"
 *      and data-action-id="DISMISS_NEXT_BEST_ACTION".
 *   4. Its onClick stops propagation AND sends the "not_interested"
 *      verdict — a dismissal never also fires the primary tap.
 *   5. The dismiss button has an aria-label for screen readers,
 *      HE + EN both covered.
 *   6. DISMISS_NEXT_BEST_ACTION exists in the CtaAction registry.
 *   7. actionKeyFor derives the correct shape:
 *        AttentionItem → `attn:<id>`
 *        ResumeAction  → `resume:<domain>`
 *      — mirrors the server's deriveActionKey so client + server
 *      speak the same suppression vocabulary.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

describe('NextBestActionCard · Phase 6 dismiss wire', () => {
  const cardSrc = read('client/src/components/NextBestActionCard.tsx');
  const hookSrc = read('client/src/hooks/useNextBestActionFeedback.ts');
  const registrySrc = read('client/src/lib/ctaActions.ts');

  it('card imports useNextBestActionFeedback + actionKeyFor', () => {
    expect(cardSrc).toMatch(
      /import\s*\{\s*useNextBestActionFeedback\s*,\s*actionKeyFor\s*\}\s*from\s*['"]@\/hooks\/useNextBestActionFeedback['"]/,
    );
  });

  it('primary tap sends the "act" verdict — positive telemetry', () => {
    expect(cardSrc).toMatch(/submitFeedback\(\s*key\s*,\s*['"]act['"]\s*\)/);
  });

  it('dismiss button carries data-testid="next-best-action-dismiss" + data-action-id="DISMISS_NEXT_BEST_ACTION"', () => {
    expect(cardSrc).toMatch(/data-testid="next-best-action-dismiss"/);
    expect(cardSrc).toMatch(/data-action-id="DISMISS_NEXT_BEST_ACTION"/);
  });

  it('dismiss handler stops propagation AND sends "not_interested"', () => {
    // e.stopPropagation() so the click does NOT bubble to the
    // wrapping primary button.
    expect(cardSrc).toMatch(/e\.stopPropagation\(\)/);
    expect(cardSrc).toMatch(/e\.preventDefault\(\)/);
    // The verdict is 'not_interested' — matches the server enum.
    expect(cardSrc).toMatch(/submitFeedback\(\s*key\s*,\s*['"]not_interested['"]\s*\)/);
    // The emit reaches the CTA registry with the dismiss id.
    expect(cardSrc).toMatch(/emitCtaEvent\(\s*['"]DISMISS_NEXT_BEST_ACTION['"]/);
  });

  it('dismiss button carries a localized aria-label (HE + EN)', () => {
    expect(cardSrc).toMatch(/aria-label=\{\s*he\s*\?\s*['"]לא מעניין אותי['"]\s*:\s*['"]Not interested['"]\s*\}/);
  });

  it('CtaAction registry defines DISMISS_NEXT_BEST_ACTION', () => {
    expect(registrySrc).toMatch(/\|\s*['"]DISMISS_NEXT_BEST_ACTION['"]/);
  });

  it('actionKeyFor mirrors the server contract (attn:<id> / resume:<domain>)', () => {
    // The client hook exposes actionKeyFor as the compose helper.
    expect(hookSrc).toMatch(/attn:\$\{id\}/);
    expect(hookSrc).toMatch(/resume:\$\{action\.domain\}/);
  });

  it('feedback hook invalidates the next-best-action cache on success — composer re-runs', () => {
    expect(hookSrc).toMatch(
      /queryClient\.invalidateQueries\(\s*\{\s*queryKey:\s*\[\s*['"]\/api\/next-best-action['"]\s*\]\s*\}/,
    );
  });

  it('feedback hook is fire-and-forget — a network failure returns { ok: false } instead of throwing', () => {
    // The submit path swallows a network throw.
    expect(hookSrc).toMatch(/try\s*\{[\s\S]{0,400}apiRequest\(\s*['"]POST['"]/);
    expect(hookSrc).toMatch(/skipped:\s*['"]network['"]/);
  });
});
