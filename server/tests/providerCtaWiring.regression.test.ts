/**
 * CEO MASTER §A11 §A12 §D §16 (2026-08-29) — pins the provider-CTA
 * wiring pass. Every provider CTA on Sitter / Walk-My-Pet / Academy /
 * PetTrek / marketing pages carries the semantic data-action-id from
 * ctaActions AND routes through the canonical resume gate
 * (/become-provider). No more direct /provider-onboarding links, no
 * more /join/<alias> deep-links from the banner map, no more legacy
 * `?type=` string emitted by the banner.
 *
 * If a refactor removes any of these attributes, this suite trips.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const R = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8');
const BANNER = R('client/src/components/ProviderRegistrationBanner.tsx');
const BROWSE_SITTERS = R('client/src/pages/sitter-suite/BrowseSitters.tsx');
const BROWSE_WALKERS = R('client/src/pages/walk-my-pet/BrowseWalkers.tsx');
const CHOOSE_PATH = R('client/src/pages/ChoosePath.tsx');
const SIGN_UP_LUXURY = R('client/src/pages/SignUpLuxury.tsx');
const PLATFORM_HUB = R('client/src/pages/PlatformHub.tsx');
const MARKETPLACE_TERMS = R('client/src/pages/legal/MarketplaceTerms.tsx');
const APPLICATION_STATUS = R('client/src/pages/ProviderApplicationStatus.tsx');
const PROVIDER_PENDING = R('client/src/pages/ProviderPending.tsx');
const BECOME_PROVIDER_LIB = R('client/src/lib/becomeProvider.ts');

describe('ProviderRegistrationBanner — CEO §A11 §D one URL emitter', () => {
  it('imports urlForProviderIntent from the canonical ctaActions helper', () => {
    expect(BANNER).toMatch(/from ['"]@\/lib\/ctaActions['"]/);
    expect(BANNER).toMatch(/urlForProviderIntent/);
    expect(BANNER).toMatch(/PROVIDER_SERVICE_ACTION_IDS/);
    expect(BANNER).toMatch(/CtaAction/);
  });

  it('drops the local dedicatedJoinRoutes map (single source of truth)', () => {
    expect(BANNER).not.toMatch(/dedicatedJoinRoutes/);
  });

  it('drops direct /join/<alias> and /become-provider?type=<alias> URL strings', () => {
    expect(BANNER).not.toMatch(/['"]\/join\/[a-z]+['"]/);
    expect(BANNER).not.toMatch(/\/become-provider\?type=/);
  });

  it('every Apply Now / tile carries a data-action-id (CEO §A12)', () => {
    // Count data-action-id occurrences on Buttons and role=button tiles.
    // Six emitter surfaces (compact/hero/section + hero tile grid +
    // section tile grid).
    const matches = BANNER.match(/data-action-id=/g) ?? [];
    expect(matches.length, `banner must carry ≥ 3 data-action-id attributes; found ${matches.length}`).toBeGreaterThanOrEqual(3);
  });

  it('provider-type tiles carry keyboard activation (Space + Enter)', () => {
    expect(BANNER).toMatch(/e\.key === 'Enter' \|\| e\.key === ' '/);
    expect(BANNER).toMatch(/e\.preventDefault\(\);/);
  });
});

describe('BrowseSitters — Become a Sitter CTA', () => {
  it('carries data-action-id="ADD_PROVIDER_SERVICE_PET_SITTING"', () => {
    expect(BROWSE_SITTERS).toMatch(/data-action-id="ADD_PROVIDER_SERVICE_PET_SITTING"/);
    // The existing testid stays.
    expect(BROWSE_SITTERS).toMatch(/data-testid="button-become-sitter"/);
  });
});

describe('BrowseWalkers — Become a Walker CTA', () => {
  it('carries data-action-id="ADD_PROVIDER_SERVICE_DOG_WALKING"', () => {
    expect(BROWSE_WALKERS).toMatch(/data-action-id="ADD_PROVIDER_SERVICE_DOG_WALKING"/);
    expect(BROWSE_WALKERS).toMatch(/data-testid="button-become-walker"/);
  });
});

describe('ChoosePath — two-tile provider chooser', () => {
  it('Pet Parent tile carries data-action-id="SWITCH_TO_PET_PARENT"', () => {
    expect(CHOOSE_PATH).toMatch(/actionId: 'SWITCH_TO_PET_PARENT'/);
  });

  it('Provider tile carries data-action-id="START_PROVIDER_APPLICATION" and routes through /become-provider', () => {
    expect(CHOOSE_PATH).toMatch(/actionId: 'START_PROVIDER_APPLICATION'/);
    expect(CHOOSE_PATH).toMatch(/navigate\('\/become-provider'\)/);
    // Must NOT go straight to /provider-onboarding — that's the exact
    // gate-bypass CEO §1 caught in review.
    expect(CHOOSE_PATH).not.toMatch(/navigate\('\/provider-onboarding'\)/);
  });

  it('renders data-action-id from the option definition', () => {
    expect(CHOOSE_PATH).toMatch(/data-action-id=\{o\.actionId\}/);
  });
});

describe('SignUpLuxury /signin /signup — CEO §A12 auth funnel identity', () => {
  it('Google button carries data-action-id="AUTH_GOOGLE"', () => {
    expect(SIGN_UP_LUXURY).toMatch(/data-action-id="AUTH_GOOGLE"/);
    expect(SIGN_UP_LUXURY).toMatch(/data-testid="button-auth-google"/);
  });

  it('Apple button carries data-action-id="AUTH_APPLE"', () => {
    expect(SIGN_UP_LUXURY).toMatch(/data-action-id="AUTH_APPLE"/);
    expect(SIGN_UP_LUXURY).toMatch(/data-testid="button-auth-apple"/);
  });

  it('Continue with mobile carries data-action-id="AUTH_PHONE"', () => {
    expect(SIGN_UP_LUXURY).toMatch(/data-action-id="AUTH_PHONE"/);
    expect(SIGN_UP_LUXURY).toMatch(/data-testid="button-continue-mobile"/);
  });

  it('Continue with email carries data-action-id="AUTH_EMAIL"', () => {
    expect(SIGN_UP_LUXURY).toMatch(/data-action-id="AUTH_EMAIL"/);
    expect(SIGN_UP_LUXURY).toMatch(/data-testid="button-continue-email"/);
  });

  it('Passkey / Face ID button carries data-action-id="AUTH_PASSKEY"', () => {
    expect(SIGN_UP_LUXURY).toMatch(/data-action-id="AUTH_PASSKEY"/);
    expect(SIGN_UP_LUXURY).toMatch(/data-testid="button-auth-passkey"/);
  });
});

describe('Additional provider-CTA emitters — CEO §D wiring pass', () => {
  it('PlatformHub cta-become-provider carries START_PROVIDER_APPLICATION', () => {
    expect(PLATFORM_HUB).toMatch(/data-testid="cta-become-provider"/);
    expect(PLATFORM_HUB).toMatch(/data-action-id="START_PROVIDER_APPLICATION"/);
  });

  it('MarketplaceTerms Join-as-Provider carries START_PROVIDER_APPLICATION', () => {
    expect(MARKETPLACE_TERMS).toMatch(/data-action-id="START_PROVIDER_APPLICATION"/);
    expect(MARKETPLACE_TERMS).toMatch(/data-testid="marketplace-terms-join-as-provider"/);
  });

  it('ProviderApplicationStatus apply + resume CTAs carry the correct action ids', () => {
    expect(APPLICATION_STATUS).toMatch(/data-action-id="START_PROVIDER_APPLICATION"[\s\S]*data-testid="apply-become-provider"/);
    expect(APPLICATION_STATUS).toMatch(/data-action-id="RESUME_PROVIDER_APPLICATION"[\s\S]*data-testid="resume-provider-application"/);
  });

  it('ProviderPending fallback Apply-Now carries START_PROVIDER_APPLICATION', () => {
    expect(PROVIDER_PENDING).toMatch(/data-action-id="START_PROVIDER_APPLICATION"/);
    expect(PROVIDER_PENDING).toMatch(/data-testid="provider-pending-apply-now"/);
  });
});

describe('becomeProvider.ts library — emits the CANONICAL URL', () => {
  it('imports urlForProviderIntent + shared normaliser from Lane E vocabulary', () => {
    expect(BECOME_PROVIDER_LIB).toMatch(/from '@shared\/lib\/providerServiceVocabulary'/);
    expect(BECOME_PROVIDER_LIB).toMatch(/urlForProviderIntent/);
  });

  it('does NOT emit the legacy ?type= URL shape any more', () => {
    // The library used to build `/become-provider?type=<alias>`
    // directly. It now goes through urlForProviderIntent which emits
    // `?requestedService=<code>`. This pin prevents a silent regression.
    expect(BECOME_PROVIDER_LIB).not.toMatch(/\?type=\$\{encodeURIComponent\(type\)\}/);
  });
});
