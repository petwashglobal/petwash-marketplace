/**
 * PR-W54 — single floating-stack manager.
 *
 * CEO directive 2026-05:
 *   • One vertical stack
 *   • Equal spacing (16px minimum)
 *   • Safe-area aware
 *   • No overlap ever
 *
 *   Bottom offset:
 *   calc(env(safe-area-inset-bottom) + var(--pw-bottom-nav-height) + 24px)
 *
 * This test pins:
 *   1. Only ONE <FloatingStack> mount in the entire app.
 *   2. The CSS uses the canonical variables (--pw-fab-base, --pw-fab-step,
 *      --pw-keyboard-offset, --pw-bottom-nav-height).
 *   3. The CEO bottom-offset formula is the one in --pw-fab-base.
 *   4. Each FAB derives its bottom from the variables (no magic numbers).
 *   5. Step distance = 56px button + 16px gap = 72px (≥ CEO 16px minimum).
 *   6. The component imports the single FloatingStack singleton.
 *   7. AIChatAssistant (the dead duplicate chat bubble) is NOT mounted.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8');

describe('PR-W54 — floating-stack singleton', () => {
  const app = read('client/src/App.tsx');

  it('App.tsx mounts exactly one <FloatingStack>', () => {
    const matches = app.match(/<FloatingStack\b/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('App.tsx does NOT mount the dead duplicate AIChatAssistant', () => {
    expect(app).not.toMatch(/<AIChatAssistant\b/);
  });

  it('FloatingStack.tsx defends against double-mount via window flag', () => {
    const c = read('client/src/components/FloatingStack.tsx');
    expect(c).toMatch(/__PW_FLOAT_STACK_LOADED__/);
  });
});

describe('PR-W54 — CSS variables (single source of truth for FAB layout)', () => {
  const css = read('client/src/styles/floating-stack.css');

  it('--pw-bottom-nav-height defined on :root (default 0)', () => {
    expect(css).toMatch(/:root\s*\{[^}]*--pw-bottom-nav-height:\s*0px/s);
  });

  it('--pw-bottom-nav-height has a non-zero mobile override (max-width: 767px)', () => {
    // PR-W55 bumped this from 56px (h-14) → 64px (h-16). Future
    // adjustments stay covered by this looser assertion; the strict
    // numerical pin lives in mobile-bottom-nav.test.ts.
    expect(css).toMatch(
      /@media\s*\(\s*max-width:\s*767px\s*\)[^{]*\{\s*:root\s*\{[^}]*--pw-bottom-nav-height:\s*\d+px/s,
    );
  });

  it('--pw-fab-base uses the CEO formula (env(safe-area-inset-bottom) + nav-height + 24px)', () => {
    // Allow whitespace + optional default-fallback inside env().
    expect(css).toMatch(
      /--pw-fab-base:\s*calc\(\s*env\(safe-area-inset-bottom[^)]*\)\s*\+\s*var\(--pw-bottom-nav-height\)\s*\+\s*24px/,
    );
  });

  it('--pw-fab-step = button-size + gap (≥ 16px gap, CEO mandate)', () => {
    expect(css).toMatch(/--pw-fab-button-size:\s*56px/);
    expect(css).toMatch(/--pw-fab-gap:\s*16px/);
    expect(css).toMatch(
      /--pw-fab-step:\s*calc\(\s*var\(--pw-fab-button-size\)\s*\+\s*var\(--pw-fab-gap\)\s*\)/,
    );
  });

  it('--pw-keyboard-offset defined (default 0px) so JS can update it', () => {
    expect(css).toMatch(/--pw-keyboard-offset:\s*0px/);
  });
});

describe('PR-W54 — every FAB uses the canonical variables (no magic numbers)', () => {
  const css = read('client/src/styles/floating-stack.css');

  function fabBottomBlock(id: string): string {
    const start = css.indexOf(`#${id}`);
    if (start < 0) throw new Error(`#${id} not found in floating-stack.css`);
    const end = css.indexOf('}', start);
    return css.slice(start, end);
  }

  it('#pw-ai (index 0) bottom: var(--pw-fab-base) + var(--pw-keyboard-offset)', () => {
    const block = fabBottomBlock('pw-ai');
    expect(block).toMatch(
      /bottom:\s*calc\(\s*var\(--pw-fab-base\)\s*\+\s*var\(--pw-keyboard-offset\)\s*\)/,
    );
  });

  it('#pw-wa (index 1) bottom: base + 1 * step + keyboard', () => {
    const block = fabBottomBlock('pw-wa');
    expect(block).toMatch(
      /bottom:\s*calc\(\s*var\(--pw-fab-base\)\s*\+\s*1\s*\*\s*var\(--pw-fab-step\)\s*\+\s*var\(--pw-keyboard-offset\)\s*\)/,
    );
  });

  it('#pw-a11y (index 2) bottom: base + 2 * step + keyboard', () => {
    const block = fabBottomBlock('pw-a11y');
    expect(block).toMatch(
      /bottom:\s*calc\(\s*var\(--pw-fab-base\)\s*\+\s*2\s*\*\s*var\(--pw-fab-step\)\s*\+\s*var\(--pw-keyboard-offset\)\s*\)/,
    );
  });

  it('#pw-vip (index 3) bottom: base + 3 * step + keyboard', () => {
    const block = fabBottomBlock('pw-vip');
    expect(block).toMatch(
      /bottom:\s*calc\(\s*var\(--pw-fab-base\)\s*\+\s*3\s*\*\s*var\(--pw-fab-step\)\s*\+\s*var\(--pw-keyboard-offset\)\s*\)/,
    );
  });

  it('no FAB hardcodes a px bottom value', () => {
    for (const id of ['pw-ai', 'pw-wa', 'pw-a11y', 'pw-vip']) {
      const block = fabBottomBlock(id);
      expect(block, `#${id} contains a magic px bottom`).not.toMatch(/bottom:\s*\d+px/);
      expect(block, `#${id} contains a calc with a leading magic px`).not.toMatch(
        /bottom:\s*calc\(\s*\d+px\s*\+/,
      );
    }
  });
});

describe('PR-W54 — keyboard handling uses the CSS variable, not inline style', () => {
  const c = read('client/src/components/FloatingStack.tsx');

  it('updates --pw-keyboard-offset on visualViewport resize', () => {
    expect(c).toMatch(
      /document\.documentElement\.style\.setProperty\(\s*['"]--pw-keyboard-offset['"]/,
    );
  });

  it('does NOT override per-button style.bottom (was incompatible with calc)', () => {
    expect(c).not.toMatch(/htmlBtn\.style\.bottom\s*=/);
    expect(c).not.toMatch(/data-base-bottom=\"\d+\"/);
  });
});
