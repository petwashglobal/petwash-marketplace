/**
 * CEO MASTER DIRECTIVE 2026-08-28 §23 §36 §37 §61 §65 §68 —
 * JourneyConcierge client rendering invariants (Journey Brain Phase 5).
 *
 * The concierge component is a PURE renderer over
 * useNextBestActionFeed. It:
 *   * resolves reasonCode → localised HE/EN copy (client-only table)
 *   * wraps ANY confirmation-required action behind a confirm modal
 *   * exposes a "Why am I seeing this?" affordance for each card
 *     (§23 transparency)
 *   * never invokes an LLM
 *   * never displays a fabricated money amount (moneyHintCents only
 *     when > 0)
 *   * hides itself when the feed is empty (§68 no dark patterns)
 *
 * A regression that breaks any of the above trips CI here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CONCIERGE = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'components', 'JourneyConcierge.tsx'),
  'utf8',
);
const HOOK = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'hooks', 'useNextBestActionFeed.ts'),
  'utf8',
);
const HOME = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'PrestigeHome.tsx'),
  'utf8',
);
const POS = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'provider-os', 'POSDashboard.tsx'),
  'utf8',
);

describe('JourneyConcierge — pure renderer (CEO §36 §65)', () => {
  it('reads useNextBestActionFeed and renders NOTHING when empty', () => {
    // Loading + empty guards — the section must never render an
    // empty card container that would fool the user into thinking
    // something is broken.
    expect(CONCIERGE).toMatch(/if \(isLoading\) return null;/);
    expect(CONCIERGE).toMatch(/if \(!actions \|\| actions\.length === 0\) return null;/);
    expect(CONCIERGE).toMatch(/useNextBestActionFeed\(actor\)/);
  });

  it('never imports or invokes an LLM SDK', () => {
    // Same rule as the server composer — the concierge is a
    // rendering layer, not an inference layer.
    expect(CONCIERGE).not.toMatch(/from ['"]@anthropic-ai/);
    expect(CONCIERGE).not.toMatch(/from ['"]openai/);
    expect(CONCIERGE).not.toMatch(/from ['"]@google\/genai/);
    expect(CONCIERGE).not.toMatch(/generative/i);
  });
});

describe('reasonCode → localised copy (CEO §65)', () => {
  it('covers every stable reasonCode with HE + EN copy', () => {
    // Client owns the copy table. A refactor that dropped a case
    // would leave that reason rendering as the generic fallback —
    // silently degraded UX.
    for (const code of [
      'BOOKING_PAYMENT_DUE',
      'BOOKING_STARTS_SOON',
      'BOOKING_PROVIDER_ACCEPTED',
      'BOOKING_AWAITING_YOU',
      'BOOKING_REVIEW_AVAILABLE',
      'BOOKING_REQUEST_WAITING',
      'PROVIDER_REQUEST_WAITING',
      'JOURNEY_RESUME_SAVED',
      'SAVED_SEARCH_CONTINUE',
      'FAVOURITE_REBOOK',
      'REFUND_IN_PROGRESS',
      'EGIFT_BALANCE_AVAILABLE',
      'EGIFT_EXPIRING_SOON',
      'WALLET_BALANCE_AVAILABLE',
      'WASH_PACKAGE_AVAILABLE',
      'PRESTIGE_BENEFIT_AVAILABLE',
      'KYA_STALE_REVIEW',
      'PROVIDER_INSURANCE_EXPIRING',
      'PROVIDER_KYC_DOC_EXPIRING',
      'PROVIDER_PAYOUT_AVAILABLE',
      'PROVIDER_AVAILABILITY_STALE',
    ]) {
      expect(CONCIERGE).toContain(`case '${code}':`);
    }
  });

  it('unknown reasonCode falls through to a NEUTRAL "recommended for you" — never crashes', () => {
    // The reasonCopy() switch is exhaustive on today's enum; the
    // caller uses reasonCopy ?? { neutral fallback } so a rolling
    // deploy where the server ships a new code before the client
    // learns it stays graceful.
    expect(CONCIERGE).toMatch(/const copy = reasonCopy\(a\.reasonCode, he\) \?\? \{/);
    expect(CONCIERGE).toContain("title: he ? 'מומלץ עבורך' : 'Recommended for you'");
  });
});

describe('confirmation gate (CEO §37)', () => {
  it('wraps requiresConfirmation actions in a confirm modal', () => {
    // Money paths (payment, rebook, provider accept) MUST show the
    // modal before navigating.
    expect(CONCIERGE).toMatch(/if \(a\.requiresConfirmation\)/);
    expect(CONCIERGE).toMatch(/setConfirm\(\{ action: a, copy \}\);/);
    // Modal renders with data-testid the E2E test can pin.
    expect(CONCIERGE).toContain('data-testid="journey-concierge-confirm"');
    expect(CONCIERGE).toContain('data-testid="journey-concierge-confirm-cancel"');
    expect(CONCIERGE).toContain('data-testid="journey-concierge-confirm-continue"');
  });

  it('non-confirmation actions navigate DIRECTLY — no modal delay', () => {
    // The go() function returns early after opening the modal.
    // Otherwise navigate(destination) fires immediately.
    expect(CONCIERGE).toMatch(/if \(a\.requiresConfirmation\) \{[\s\S]*?return;\s*\n\s*\}\s*\n\s*navigate\(a\.destination\);/);
  });
});

describe('transparency (CEO §23 "Why am I seeing this?")', () => {
  it('every card carries a Why button + reasonCode reveal', () => {
    expect(CONCIERGE).toContain('data-testid={`journey-concierge-why-${a.id}`}');
    expect(CONCIERGE).toMatch(/data-testid=\{`journey-concierge-why-panel-\$\{a\.id\}`\}/);
    // The panel shows the machine-readable reasonCode so a
    // developer can debug quickly and a paranoid user can see
    // exactly what signal produced the card.
    expect(CONCIERGE).toMatch(/\{a\.reasonCode\}/);
  });
});

describe('money hint discipline (CEO §46 §68)', () => {
  it('renders moneyHintCents ONLY when a positive amount is present', () => {
    // Never invent a zero. Never fabricate. moneyHintCents is a
    // display-only hint sourced from the server.
    expect(CONCIERGE).toMatch(/typeof a\.moneyHintCents === 'number' && a\.moneyHintCents > 0/);
  });
});

describe('hook contract (CEO §65)', () => {
  it('fetches /api/next-best-action/{pet-parent|provider} with lang query', () => {
    expect(HOOK).toMatch(/\/api\/next-best-action\/\$\{actor === 'pet_parent' \? 'pet-parent' : 'provider'\}\?lang=\$\{lang\}/);
  });

  it('is gated on Firebase auth (enabled: !!user)', () => {
    expect(HOOK).toMatch(/enabled: !!user,/);
  });

  it('returns actions + isLoading + refetch — nothing else', () => {
    expect(HOOK).toMatch(/return \{\s*\n\s*feed: query\.data \?\? null,\s*\n\s*actions: query\.data\?\.actions \?\? \[\],\s*\n\s*isLoading: query\.isLoading,\s*\n\s*refetch: query\.refetch,\s*\n\s*\};/);
  });
});

describe('mount on PrestigeHome (CEO §61)', () => {
  it('PrestigeHome imports + renders JourneyConcierge alongside AttentionList', () => {
    expect(HOME).toMatch(/import \{ JourneyConcierge \} from '@\/components\/JourneyConcierge';/);
    // Rendered right after AttentionList so the two feeds sit
    // together at the top of the fold.
    expect(HOME).toMatch(/<AttentionList actor="pet_parent" \/>[\s\S]*?<JourneyConcierge actor="pet_parent" \/>/);
  });
});

describe('mount on ProviderOS POSDashboard (CEO §62)', () => {
  it('POSDashboard imports + renders <JourneyConcierge actor="provider" /> top-of-fold', () => {
    expect(POS).toMatch(/import \{ JourneyConcierge \} from '@\/components\/JourneyConcierge';/);
    expect(POS).toContain('<JourneyConcierge actor="provider" />');
  });
});
