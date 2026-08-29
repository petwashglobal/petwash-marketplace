/**
 * ProviderOS "Pet Parent side" bridge — regression pin (2026-07-09,
 * relabelled 2026-08-26 to match the CEO role-model directive:
 * workspaces are Pet Parent ↔ Provider; "Member" was Prestige framing).
 *
 * A provider is ALSO a Pet Parent (additive multi-role: they can own
 * pets, book other providers, use a station, hold a wallet). Before this
 * pin, a provider landing in the walled provider-os shell had NO
 * on-screen way back to the Pet Parent side, and the account avatar in
 * the header was a dead <div>.
 *
 * This pins: (1) a persistent "Switch to Pet Parent" control →
 * /pet-parent/home (the canonical customer home per CEO AUTH MASTER
 * §16 2026-08-29), and (2) the avatar is now a real button →
 * /my-account. So a multi-role user is never trapped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'provider-os', 'ProviderOS.tsx'),
  'utf8',
);

describe('ProviderOS gives a multi-role user a way back to Pet Parent (2026-07-09, relabelled 2026-08-26)', () => {
  it('has a router navigate distinct from the module switcher', () => {
    // wouter useLocation destructured as setRoute (module `navigate` is unrelated)
    expect(SRC).toMatch(/const \[, setRoute\] = useLocation\(\)/);
  });

  it('offers a persistent "Switch to Pet Parent" control that routes to the Pet Parent home', () => {
    expect(SRC).toMatch(/data-testid="switch-to-pet-parent"/);
    expect(SRC).toMatch(/setRoute\('\/pet-parent\/home'\)/);
    // Crown belongs to Prestige — the Pet Parent switcher must not use it.
    expect(SRC).not.toMatch(/data-testid="switch-to-member"/);
  });

  it('the account avatar is a real button (not a dead div) → account hub', () => {
    expect(SRC).toMatch(/data-testid="provider-account"/);
    expect(SRC).toMatch(/setRoute\('\/my-account'\)/);
    // the old static avatar div must be gone
    expect(SRC).not.toMatch(/<div className="w-7 h-7 rounded-full bg-\[#FBF6E7\][^>]*>\s*\{displayName/);
  });
});
