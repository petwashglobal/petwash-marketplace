import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 2026-09-10 — the header language control was a 44px empty rectangle.
 *
 * The 2026-09-05 tap-target work correctly raised every header control to the
 * 44pt floor. For the burger and profile buttons it did that with a
 * TRANSPARENT ::after so the painted box never changed. A native <select> is
 * its own hit area, so the floor went on the element — and the pill grew from
 * a small chip to a 44px box sitting beside two 2rem circles. Reported from a
 * real phone: "ugly boxed weird, was ok, now broken".
 *
 * Both properties matter and they pull in opposite directions:
 *   - remove the 44px and the control is under the accessibility floor again
 *   - paint the 44px and the header looks broken
 *
 * The wrapper splits them: .pw-language-tap-pill paints at 2rem,
 * the <select> keeps 44px and paints nothing. This pins BOTH halves so the
 * next person cannot fix one by breaking the other — which is exactly how the
 * regression happened.
 */

const ROOT = resolve(import.meta.dirname, "../..");

/**
 * Line comments FIRST, then block comments. The reverse order lets a `/*`
 * inside a `//` comment open a block match that runs to the next real close —
 * it swallowed 168KB of prestige-pass.ts elsewhere in this repo. PR #2349
 * introduces server/tests/helpers/sourceWithoutComments.ts as the shared,
 * guarded version; switch this file over once that lands.
 */
function sourceWithoutComments(rel: string): string {
  const raw = readFileSync(resolve(ROOT, rel), "utf8");
  return raw.replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\/\*[\s\S]*?\*\//g, "");
}

const css = sourceWithoutComments("client/src/styles/petwash-header.css");
const header = sourceWithoutComments("client/src/components/PetWashHeader.tsx");

function rule(selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `${selector} not found in petwash-header.css`).toBeGreaterThan(-1);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open, close);
}

describe("header language pill: 44pt hit area, 2rem painted box", () => {
  it("the header select is wrapped, so the paint and the hit area can differ", () => {
    expect(header).toContain("pw-language-tap");
    expect(header).toContain("pw-language-tap-pill");
  });

  it("the select KEEPS the 44px accessibility floor", () => {
    const r = rule(".pw-language-tap > .pw-language-select");
    expect(r).toContain("min-height: 44px");
    expect(r).toContain("height: 44px");
  });

  it("the select paints nothing — no border, no background of its own", () => {
    const r = rule(".pw-language-tap > .pw-language-select");
    expect(r).toContain("border: 0");
    expect(r).toContain("background: transparent");
  });

  it("the painted pill is 2rem, matching the burger circle", () => {
    const r = rule(".pw-language-tap-pill");
    expect(r).toContain("height: 2rem");
    // content-box would add the 1.5px stroke twice and sit 3px taller.
    expect(r).toContain("box-sizing: border-box");
  });

  it("the pill never swallows a click meant for the select", () => {
    expect(rule(".pw-language-tap-pill")).toContain("pointer-events: none");
  });

  it("focus is still visible even though the select's own border is gone", () => {
    expect(css).toContain(".pw-language-tap:focus-within .pw-language-tap-pill");
  });
});
