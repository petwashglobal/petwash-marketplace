/**
 * Lane C.1 · Journey Brain Phase 1 (post-release 2026-09-03).
 *
 * The composer surfaces one "resume where you left off" card per
 * active JourneyCheckpoint for pet-parents. Pins the safety-critical
 * invariants of that probe:
 *
 *   * reads active checkpoints via listActiveCheckpoints (which
 *     already filters expires_at > now())
 *   * maps every JourneyDomain to a REAL mounted client route
 *   * skips UNKNOWN domains silently (a future-flag can't route
 *     a user into a dead URL)
 *   * emits informational-priority AttentionItems only (a resume
 *     hint is never urgent — the underlying wizard re-runs every
 *     money / permission gate on resume)
 *   * fails-CLOSED to [] on ANY error (partial checkpoint outage
 *     must never break the composer for the whole feed)
 *   * wired into composeAttentionFeed on the pet_parent branch
 *     directly AFTER the KYA-stale probe (adjacency pin)
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'attentionFeed.ts'),
  'utf8',
);

describe('attentionFeed — Journey Brain Phase 1 resume probe (Lane C.1)', () => {
  it('probe reads checkpoints via listActiveCheckpoints — never a raw expired query', () => {
    // listActiveCheckpoints refuses `expires_at <= now()` rows, so
    // routing through it is the only supported call path. A direct
    // pool query would re-open the door to surfacing stale drafts.
    expect(SRC).toMatch(
      /const \{ listActiveCheckpoints \} = await import\('\.\/journeyCheckpoints'\);/,
    );
    expect(SRC).toMatch(
      /const active = await listActiveCheckpoints\(pool, \{ userUid: userId \}\);/,
    );
  });

  it('probe short-circuits with [] when the user has no active checkpoints', () => {
    // No active row → nothing to nudge. The composer must never
    // fabricate a card just to fill space (CEO §60 no-nag rule).
    expect(SRC).toMatch(/if \(!active\.length\) return \[\];/);
  });

  it('every JourneyDomain maps to a MOUNTED client route (no dead taps)', () => {
    // The DOMAIN_META literal must carry ALL six JourneyDomain
    // values. Missing keys would route a user into an unmounted
    // URL — the exact failure mode CEO §7 forbids.
    expect(SRC).toContain("destination: '/walk-my-pet'");
    expect(SRC).toContain("destination: '/sitter-suite'");
    expect(SRC).toContain("destination: '/marketplace'");
    expect(SRC).toContain("destination: '/shop/checkout'");
    expect(SRC).toContain("destination: '/wallet/egift/buy'");
    expect(SRC).toContain("destination: '/provider-onboarding'");
  });

  it('unknown domains are skipped silently (no dead-URL fallback)', () => {
    // A future release may add a JourneyDomain this deploy predates.
    // The probe must skip such rows instead of routing users to '' /
    // '/' / a guessed URL.
    expect(SRC).toMatch(
      /const meta = DOMAIN_META\[row\.domain as JourneyDomain\];/,
    );
    expect(SRC).toMatch(
      /if \(!meta\) continue; \/\/ unknown domain → don't route into a dead URL/,
    );
  });

  it('emitted items are informational priority — a resume hint is never urgent', () => {
    // The underlying wizard re-runs every payment / permission gate
    // on resume; the checkpoint is a UX hint, not authority. Pinning
    // "informational" prevents a future refactor from marking these
    // urgent and spamming home.
    expect(SRC).toMatch(
      /id: `journey_resume:\$\{row\.domain\}`,\s*\n\s*actor: 'pet_parent',\s*\n\s*domain: meta\.attentionDomain,\s*\n\s*entityId: row\.id,\s*\n\s*priority: 'informational',/,
    );
  });

  it('bilingual HE + EN title and reason are baked in — no client-side i18n gap', () => {
    // The attention feed contract is "server already localised".
    // A missing branch would render an English string in a HE
    // session.
    expect(SRC).toMatch(/title: he \? `המשך \$\{meta\.he\}` : `Resume your \$\{meta\.en\}`/);
    expect(SRC).toMatch(/'שמרנו את המקום שלך — נמשיך מהמקום בו עצרת\.'/);
    expect(SRC).toMatch(/'We saved where you left off — pick up from the same spot\.'/);
  });

  it('primary CTA is `view` — resume is a navigation, not a mutation', () => {
    // `pay` / `confirm` / `top_up` would suggest the card itself
    // moves money. The card only opens the wizard, which then
    // re-runs the money gate.
    expect(SRC).toMatch(/nextAction: 'view',\s*\n\s*destination: meta\.destination,/);
  });

  it('probe is wrapped in try/catch that returns [] on ANY error (fail-CLOSED)', () => {
    // A checkpoint-service outage must never nuke the whole feed.
    expect(SRC).toMatch(/\[AttentionFeed\] journey-resume probe failed/);
    expect(SRC).toMatch(
      /logger\.warn\('\[AttentionFeed\] journey-resume probe failed'[\s\S]*?return \[\];\s*\n\s*\}/,
    );
  });

  it('composer wires the resume probe on the pet-parent branch AFTER the KYA-stale probe', () => {
    // Adjacency check — a re-order that dropped this line would
    // silently kill the resume card without failing any other test.
    expect(SRC).toMatch(
      /\.\.\.await petParentKyaStaleItems\(userId, he\),\s*\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*\.\.\.await petParentJourneyResumeItems\(userId, he\),/,
    );
  });

  it('probe function is defined and imports JourneyDomain as a TYPE (no runtime coupling)', () => {
    // A value-import would create a runtime circular dep the moment
    // journeyCheckpoints.ts imports anything else from attentionFeed.
    // Type-only import erases at compile time.
    expect(SRC).toMatch(
      /import type \{ JourneyDomain \} from '\.\/journeyCheckpoints';/,
    );
    expect(SRC).toMatch(
      /async function petParentJourneyResumeItems\(\s*\n?\s*userId: string,\s*\n?\s*he: boolean,\s*\n?\s*\): Promise<AttentionItem\[\]>/,
    );
  });

  it('DOMAIN_META is FROZEN so a runtime mutation cannot redirect a resume card', () => {
    // Object.freeze() forbids adding a rogue destination at runtime.
    expect(SRC).toMatch(/> = Object\.freeze\(\{[\s\S]*?walk_book:/);
  });
});
