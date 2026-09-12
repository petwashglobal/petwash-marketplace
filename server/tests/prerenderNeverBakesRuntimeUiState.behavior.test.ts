/**
 * CEO 2026-09-12 — caught in QA of my own #2425, in production.
 *
 * scripts/prerender.mjs serialises the LIVE DOM for SEO. #2425 added
 * useSuppressFloatingStack, which sets `data-pw-suppress-floating="true"` on
 * <body> while the landing hero is on screen. The prerender happened to
 * snapshot the page in that state, so the built HTML for EVERY route shipped:
 *
 *     <body data-pw-suppress-floating="true">
 *
 * and the CSS that reads it is in the bundle. Every visitor, on every page,
 * received the accessibility / WhatsApp / AI buttons at opacity:0 and
 * pointer-events:none before a line of JS ran. Verified on production with a
 * cold load of /shop in a fresh tab: attribute present, Landing not mounted,
 * #pw-a11y dead. An accessibility control hidden site-wide is worse than the
 * button overlap it was fixing.
 *
 * This is the SAME CLASS as the 2026-07-18 incident already documented in that
 * file — the promo popup's body{overflow:hidden} frozen into static HTML,
 * "cannot scroll, website not responding". The existing defence stripped
 * runtime STYLE and refused scroll-locked output. It knew nothing about
 * runtime ATTRIBUTES, so the identical hazard in a different shape walked
 * straight through both layers.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.join(process.cwd(), 'scripts/prerender.mjs'), 'utf8');

/** The belt-and-braces check, lifted verbatim from prerender.mjs. */
function runtimeStateGuard(bodyTag: string): boolean {
  return /\sdata-pw-[a-z-]+=|\sdata-cookie-consent-active=/i.test(bodyTag);
}

/** The DOM pass, exercised against a minimal element stand-in. */
function stripRuntimeAttrs(attrs: Record<string, string>): Record<string, string> {
  const el = {
    tagName: 'BODY',
    attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })),
    removeAttribute(n: string) { delete attrs[n]; },
  };
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith('data-pw-') || attr.name === 'data-cookie-consent-active') {
      el.removeAttribute(attr.name);
    }
  }
  return attrs;
}

describe('the exact HTML that shipped is now refused', () => {
  it('rejects the body tag production actually served', () => {
    expect(runtimeStateGuard('<body data-pw-suppress-floating="true">')).toBe(true);
  });

  it('rejects the other live-UI flags the app sets on body', () => {
    for (const tag of [
      '<body data-pw-egift-hero-visible="true">',
      '<body data-pw-member-dashboard="true">',
      '<body data-cookie-consent-active="true">',
      '<body class="x" data-pw-suppress-floating="true">',
    ]) {
      expect(runtimeStateGuard(tag), `${tag} slipped through`).toBe(true);
    }
  });

  it('does NOT reject a legitimate body tag', () => {
    for (const tag of ['<body>', '<body class="antialiased">', '<body dir="rtl" lang="he">']) {
      expect(runtimeStateGuard(tag), `${tag} wrongly refused`).toBe(false);
    }
  });

  it('the DOM pass removes them before serialisation', () => {
    const left = stripRuntimeAttrs({
      'dir': 'rtl',
      'data-pw-suppress-floating': 'true',
      'data-cookie-consent-active': 'true',
      'data-pw-member-dashboard': 'true',
    });
    expect(Object.keys(left)).toEqual(['dir']);
  });
});

describe('both defences are actually wired into prerender.mjs', () => {
  it('the DOM pass strips data-pw-* off body and documentElement', () => {
    expect(SRC).toContain("attr.name.startsWith('data-pw-')");
    // it must run inside the loop that already handles body AND documentElement
    const loopAt = SRC.indexOf('for (const el of [document.body, document.documentElement])');
    expect(loopAt).toBeGreaterThan(-1);
    const stripAt = SRC.indexOf("attr.name.startsWith('data-pw-')");
    expect(stripAt, 'attribute strip is outside the body/documentElement loop')
      .toBeGreaterThan(loopAt);
  });

  it('the file-level guard throws rather than writing the file', () => {
    expect(SRC).toMatch(/data-pw-\[a-z-\]\+=/);
    expect(SRC).toContain('refusing to write runtime UI state into static HTML');
  });

  it('the original scroll-lock guard is still there', () => {
    // The 2026-07-18 incident's defence must not be lost while adding this one.
    expect(SRC).toContain('refusing to write scroll-locked HTML');
    expect(SRC).toMatch(/touch-action\\s\*:\\s\*none/);
  });
});
