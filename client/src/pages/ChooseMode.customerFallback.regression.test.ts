/**
 * ChooseMode — CUSTOMER_FALLBACK source-pin.
 *
 * CEO 2026-08-28 product correction: Pet Parent is the base customer
 * workspace; Prestige is a MEMBERSHIP entitlement that travels inside
 * it, NOT a separate mode. The file's own top-of-file comment (§8)
 * already documents this, but the CUSTOMER_FALLBACK on line 49 was
 * pointing at `/prestige/home`, sending every non-Prestige customer
 * to a Prestige-branded URL — the exact conceptual mistake the CEO
 * flagged.
 *
 * Pin here:
 *   • The CUSTOMER_FALLBACK constant MUST NOT be a `/prestige/...` URL.
 *     A refactor that puts it back trips CI, not the customer.
 *   • The comment noting Prestige is entitlement-not-workspace stays
 *     at the top of the file — dropping it opens the door for the
 *     same mistake by the next author.
 *   • The pick() function keeps routing petParent → 'customer' intent
 *     (server-side backwards-compat) rather than a Prestige-shaped one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, 'ChooseMode.tsx'), 'utf8');

describe('ChooseMode — Pet Parent is the base workspace, not Prestige', () => {
  it("CUSTOMER_FALLBACK does NOT point at a Prestige-branded URL", () => {
    // The single line the CEO named. Any refactor that reintroduces
    // `/prestige/home` (or any other /prestige/* URL) as the
    // customer default trips this test.
    expect(SRC).toMatch(/const CUSTOMER_FALLBACK = ['"]\/pet-parent\/home['"]/);
    expect(SRC).not.toMatch(/const CUSTOMER_FALLBACK = ['"]\/prestige\//);
  });

  it("provider fallback stays on /provider-os — never mixed with Prestige", () => {
    expect(SRC).toMatch(/const PROVIDER_FALLBACK = ['"]\/provider-os['"]/);
  });

  it("keeps the product-rule comment that Prestige is not a workspace", () => {
    // If the "Prestige is NOT a workspace / role" wording ever gets
    // dropped, the next refactor has no anchor to reason against.
    expect(SRC).toMatch(/Prestige is NOT a workspace \/ role/);
    // The comment wraps across lines — allow whitespace/`*` prefix in between.
    expect(SRC).toMatch(/MEMBERSHIP that travels[\s\S]{0,20}with the human/);
  });

  it("pick(petParent) sends 'customer' intent to the server (backwards-compat)", () => {
    // Server post-login decider's allowlist speaks 'customer'; the
    // human-facing label is Pet Parent. Do not rename the intent
    // string — it would silently break every existing server route.
    expect(SRC).toMatch(/petParent:\s*['"]customer['"]/);
    expect(SRC).toMatch(/provider:\s*['"]provider['"]/);
  });
});
