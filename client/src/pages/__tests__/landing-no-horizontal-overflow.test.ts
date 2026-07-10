/**
 * Landing page — horizontal-overflow belt (2026-07-10, follows #1371).
 *
 * The global body{overflow-x:hidden} guard LEAKS on iOS Safari, letting stray
 * elements (e.g. the hero's `-inset-4` gold glow, or any full-bleed section)
 * inflate the page and crop content on iPhone. A page-level `overflow-x-clip`
 * on the Landing root kills the rogue horizontal scroll. `clip` (not `hidden`)
 * does not create a scroll container, so sticky/absolute descendants and
 * intentional decorative bleeds keep working.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'Landing.tsx'), 'utf8');

describe('Landing horizontal-overflow belt (2026-07-10)', () => {
  it('page root clips horizontal overflow (iOS-reliable belt)', () => {
    expect(SRC).toMatch(/className="min-h-screen overflow-x-clip bg-white"/);
  });
});
