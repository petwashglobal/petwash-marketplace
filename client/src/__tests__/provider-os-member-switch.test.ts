/**
 * ProviderOS "both roles" bridge — regression pin (2026-07-09).
 *
 * Full new-user test (CEO: "want to be both roles, what happens on login"):
 * signup lets you pick Member AND Provider together, and once the provider app
 * is approved, post-login upgrades the role and /whoami returns BOTH worlds
 * (dashboardsAllowed = ['member','provider']). The ExperienceSwitcher renders
 * those worlds — but it was mounted ONLY on /my-account, so a provider landing
 * in the walled provider-os shell had NO on-screen way back to their member
 * world (book, wash, wallet, rewards). And the account avatar in the header was
 * a dead <div> (a real dead-click).
 *
 * This pins: (1) a persistent "Switch to Member" control → /prestige/home, and
 * (2) the avatar is now a real button → /my-account (account hub w/ the full
 * ExperienceSwitcher). So a both-roles user is never trapped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'provider-os', 'ProviderOS.tsx'),
  'utf8',
);

describe('ProviderOS gives a both-roles user a way back to Member (2026-07-09)', () => {
  it('has a router navigate distinct from the module switcher', () => {
    // wouter useLocation destructured as setRoute (module `navigate` is unrelated)
    expect(SRC).toMatch(/const \[, setRoute\] = useLocation\(\)/);
  });

  it('offers a persistent "Switch to Member" control that routes to the member home', () => {
    expect(SRC).toMatch(/data-testid="switch-to-member"/);
    expect(SRC).toMatch(/setRoute\('\/prestige\/home'\)/);
  });

  it('the account avatar is a real button (not a dead div) → account hub', () => {
    expect(SRC).toMatch(/data-testid="provider-account"/);
    expect(SRC).toMatch(/setRoute\('\/my-account'\)/);
    // the old static avatar div must be gone
    expect(SRC).not.toMatch(/<div className="w-7 h-7 rounded-full bg-\[#FBF6E7\][^>]*>\s*\{displayName/);
  });
});
