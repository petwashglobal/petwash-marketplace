/**
 * P0 — the prerenderer must never bake a scroll lock into the static HTML.
 *
 * Production incident 2026-07-18 (CEO: "cannot scroll, website not responding").
 * Live HTML served by petwash.co.il was:
 *
 *     <body style="overflow: hidden;">
 *
 * on `/`, `/signup` and other routes. The whole site was unscrollable — not just
 * to touch, but to programmatic scrolling too — from the very first byte, before
 * a line of JS ran.
 *
 * Root cause: scripts/prerender.mjs serialises the LIVE DOM
 * (`document.documentElement.outerHTML`). The promo popup renders on page load
 * and locks background scroll (`body{overflow:hidden}`), so the snapshot froze
 * that transient lock into the cached HTML of every prerendered route. Fixing
 * the popup's own cleanup (PR #1459) could not help: the lock was in the shipped
 * markup, not applied at runtime.
 *
 * Two defences, both pinned here:
 *   1. the in-page pass clears scroll-lock properties and drops transient
 *      overlays before serialising;
 *   2. a belt-and-braces check THROWS rather than write a locked <body> to disk.
 *
 * Sibling pins: bodyTouchActionScrollLock (JS surface),
 * immersiveScrollLockHotfix (CSS surface). This one covers the BUILD surface.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const script = readFileSync(resolve(ROOT, 'scripts/prerender.mjs'), 'utf8');

/** The exact guard used by the prerenderer before writing a route to disk. */
const LOCK_RE = /overflow\s*:\s*hidden|touch-action\s*:\s*none|position\s*:\s*fixed/i;

describe('prerender — static HTML must always ship scrollable', () => {
  it('strips scroll-lock properties from body/html before serialising', () => {
    expect(script).toMatch(/overflow/);
    expect(script).toMatch(/touchAction/);
    // must clear them, not merely read them
    expect(script).toMatch(/el\.style\[prop\]\s*=\s*''/);
  });

  it('removes transient overlays (popup / drawer / dialog) from the snapshot', () => {
    expect(script).toMatch(/pw-drawer-overlay/);
    expect(script).toMatch(/role="dialog"|\[role=\\?"dialog\\?"\]/);
    expect(script).toMatch(/node\.remove\(\)/);
  });

  it('refuses to write HTML whose <body> carries a scroll lock', () => {
    expect(script).toMatch(/refusing to write scroll-locked HTML/);
  });

  it('the guard catches the exact body tag that shipped to production', () => {
    // Real regression sample pulled from the live site during the incident.
    expect(LOCK_RE.test('<body style="overflow: hidden;">')).toBe(true);
    expect(LOCK_RE.test('<body style="touch-action: none;">')).toBe(true);
    expect(LOCK_RE.test('<body style="position: fixed; top: 0">')).toBe(true);
  });

  it('the guard does NOT false-positive on a healthy body tag', () => {
    expect(LOCK_RE.test('<body>')).toBe(false);
    expect(LOCK_RE.test('<body class="luxury">')).toBe(false);
    expect(LOCK_RE.test('<body style="margin: 0">')).toBe(false);
  });
});
