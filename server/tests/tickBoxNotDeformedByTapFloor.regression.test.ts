import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 2026-09-10 — the 48px tap floor was DEFORMING every tick box, not enlarging it.
 *
 *   button, .clickable, [role="button"],
 *   input[type="checkbox"], input[type="radio"] { min-height: 48px; }
 *
 * A checkbox and a radio are the one control whose WIDTH nobody sets — the UA
 * paints a ~13px square. A lone `min-height` therefore stretched the painted
 * box and left the width alone. Measured on production at a real 390px
 * viewport: every checkbox rendered 13x48 in Chromium and 12x48 in WebKit,
 * aspect ratio 0.27. On /signup the three consent rows use
 * `align-items: flex-start`, so each sliver hung ~29px below its own one-line
 * label and read as a box that had slipped out of place.
 *
 * The floor was not even buying reach: 13px wide fails a 44px target on the
 * other axis. It cost the look and delivered nothing.
 *
 * Same defect class as the 44px language <select> in #2350 — a tap floor put
 * on a PAINTED box instead of on the hit area. Clicking a <label> toggles the
 * control it wraps, so the label is where a height floor belongs.
 *
 * These pins fail if anyone re-adds a height floor to a tick box without the
 * matching width floor that would keep it square.
 */

const root = resolve(import.meta.dirname, "../..");

/** Comments stripped — a pin must never pass on its own explanation. */
function css(path: string): string {
  return readFileSync(resolve(root, path), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every `selector { ... }` block in a stylesheet, comments already removed. */
function rules(source: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    out.push({ selector: m[1].trim(), body: m[2] });
  }
  return out;
}

function declaration(body: string, prop: string): string | null {
  const m = body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
  return m ? m[1].trim() : null;
}

const TICK_BOX = /input\[type=["']?(checkbox|radio)["']?\]|\[role=["']?(checkbox|radio)["']?\]/i;

const SHEETS = ["client/src/index.css", "client/src/styles/petwash-header.css"];

describe("a tick box is never given a height floor without a width floor", () => {
  it("no rule stretches a checkbox or radio on one axis only", () => {
    const offenders: string[] = [];

    for (const sheet of SHEETS) {
      for (const rule of rules(css(sheet))) {
        // A rule only reaches the painted box when the tick box is the SUBJECT
        // of the selector, i.e. the last compound in at least one of its
        // comma-separated parts. `label:has(> input[type=checkbox])` targets
        // the label and is exactly the shape we want, so it must not count.
        const targetsBox = rule.selector
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
          .some((part) => {
            const subject = part.split(/\s+|>|\+|~/).filter(Boolean).pop() ?? "";
            return TICK_BOX.test(subject) && !/^label/i.test(part);
          });
        if (!targetsBox) continue;

        const minHeight = declaration(rule.body, "min-height");
        if (!minHeight) continue;
        const height = parseFloat(minHeight);
        if (!Number.isFinite(height) || height <= 0) continue;

        const minWidth = declaration(rule.body, "min-width");
        const width = minWidth ? parseFloat(minWidth) : NaN;
        if (!Number.isFinite(width) || width < height) {
          offenders.push(
            `${sheet}: \`${rule.selector}\` sets min-height:${minHeight} with min-width:${minWidth ?? "none"}`,
          );
        }
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the reach the floor was reaching for still exists, on the label", () => {
    const sheet = css("client/src/index.css");
    const labelFloor = rules(sheet).find(
      (rule) => /^label:has\(/m.test(rule.selector) && TICK_BOX.test(rule.selector),
    );
    expect(labelFloor, "no min-height floor on the label that wraps a tick box").toBeTruthy();
    expect(parseFloat(declaration(labelFloor!.body, "min-height") ?? "0")).toBeGreaterThanOrEqual(44);
  });
});

/**
 * 2026-09-10 — the mobile nav strip read left-to-right in Hebrew.
 *
 * `[dir="rtl"] .pw-header { direction: ltr }` is deliberate (the header's
 * physical chrome must not mirror: logo centred, burger right). Every other
 * text-bearing descendant of the header carries its own `direction: rtl`
 * override — .pw-nav-link, .pw-mega-link, .pw-mobile-link. The mobile nav
 * strip, added later, did not, so it inherited the forced LTR.
 *
 * Measured on production at 390px in Hebrew: "תווי שי דיגיטליים" (source
 * order first) sat at x=69, the leftmost position, and "פלטפורמות" (last) at
 * x=268 — source order painted left-to-right, the opposite of every other
 * Hebrew row on the page.
 */
describe("every text row inside the forced-LTR header states its own direction", () => {
  const headerCss = css("client/src/styles/petwash-header.css");

  it("the header really does force LTR, so the override is required", () => {
    const forced = rules(headerCss).find((rule) => rule.selector === '[dir="rtl"] .pw-header');
    expect(forced, "the forced-LTR header rule is gone — this pin needs rewriting").toBeTruthy();
    expect(declaration(forced!.body, "direction")).toBe("ltr");
  });

  it("the mobile nav strip row is put back to RTL", () => {
    const override = rules(headerCss).find(
      (rule) =>
        rule.selector.includes('[dir="rtl"]') &&
        rule.selector.includes(".pw-mobile-nav-strip-row") &&
        declaration(rule.body, "direction") === "rtl",
    );
    expect(
      override,
      'no `[dir="rtl"] .pw-mobile-nav-strip-row { direction: rtl }` — the strip will paint its items left-to-right in Hebrew',
    ).toBeTruthy();
  });
});

/**
 * 2026-09-10 — two checkbox rows in ONE form disagreed about which side a
 * tick box lives on.
 *
 * The sign-in panel is already `dir="rtl"`, so a plain `flex-direction: row`
 * packs the box on the right — which is what the three .sl-consentBox rows do
 * and what they measured (x=350 of a 27..363 card). "Remember me on this
 * device" added `flexDirection: he ? 'row-reverse' : 'row'` on top of the RTL
 * container, flipping it BACK to left-to-right: measured x=27, the far LEFT
 * of the same card.
 *
 * Mirroring is the container's job here; a second flip inside it is always a
 * double negative.
 */
describe("the sign-in remember-me row mirrors with the document, not against it", () => {
  it("does not flip flex-direction for Hebrew", () => {
    const src = readFileSync(resolve(root, "client/src/pages/SignUpLuxury.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    const marker = 'data-testid="signin-remember-me-label"';
    const at = src.indexOf(marker);
    expect(at, "the remember-me label is gone — this pin needs rewriting").toBeGreaterThan(-1);

    // The <label ...> tag that carries the testid, back to its opening bracket.
    const tagStart = src.lastIndexOf("<label", at);
    const tag = src.slice(tagStart, at);
    expect(tag).not.toMatch(/row-reverse/);
  });
});
