import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 2026-09-10 — every page opened with a dead band under the browser chrome.
 *
 * `body` reserved top padding at four breakpoints — 76px, 6.5rem, 7rem, 8rem —
 * for a header that is `position: sticky`. A sticky header occupies its own
 * space in normal flow, so the reservation booked the space TWICE: an empty
 * band, then the header below it. The band changed size with the window, in
 * portrait and landscape, which is why it read as "a hidden box that sits
 * there" rather than as a layout constant.
 *
 * Measured on the live site at 1280px: body padding-top 112px, header top 169.
 * With the padding removed the header sits at 57 — flush under the dev banner
 * — and stays the topmost painted element when scrolled. 112px reclaimed.
 *
 * THE INVARIANT IS CONDITIONAL, so it is pinned as a pair: top padding on body
 * is only correct if the header is FIXED. It is sticky. If someone makes it
 * fixed, this test should fail and be updated deliberately — not silently
 * drift back.
 */

const ROOT = resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const indexCss = read("client/src/index.css");
const headerCss = read("client/src/styles/petwash-header.css");

/** Every `padding-top` inside a `body { ... }` block, media queries included. */
function bodyPaddingTops(css: string): string[] {
  const out: string[] = [];
  const re = /(^|[\s,}])body\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    for (const p of m[2].matchAll(/padding-top:\s*([^;]+);/g)) out.push(p[1].trim());
  }
  return out;
}

describe("no dead band above the sticky header", () => {
  it("the header is sticky, not fixed — the premise of everything below", () => {
    expect(headerCss).toMatch(/\.pw-header\s*\{[^}]*position:\s*sticky/);
    expect(headerCss).not.toMatch(/\.pw-header\s*\{[^}]*position:\s*fixed/);
  });

  it("the parser actually finds body rules — a silent zero would pass", () => {
    expect(bodyPaddingTops(indexCss).length).toBeGreaterThan(2);
  });

  it("no breakpoint reserves top padding for it", () => {
    const offenders = bodyPaddingTops(indexCss).filter((v) => !/^0(px|rem|%)?$/.test(v));
    expect(
      offenders,
      "a sticky header occupies its own space; reserving more leaves an empty band",
    ).toEqual([]);
  });
});
