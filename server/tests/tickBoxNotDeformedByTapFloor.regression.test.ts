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

/**
 * 2026-09-10 — picking a language did not survive a refresh.
 *
 * readUrlLanguage() is authoritative on boot AND writes what it finds into
 * pw_lang. Nothing updated the query string when the user chose a different
 * language, so a `?lang=he` link stayed `?lang=he` while English was on
 * screen — and the next boot read that stale param and put Hebrew back.
 * Measured on production, three steps:
 *
 *   land on /?lang=he   url ?lang=he   pw_lang=he   html lang=he
 *   pick English        url ?lang=he   pw_lang=en   html lang=en
 *   reload              url ?lang=he   pw_lang=HE   html lang=he   <- choice gone
 *
 * The switcher leaves the param behind, so the links it produces are exactly
 * the ones on which it can never stick — as are shared and bookmarked links.
 */
describe("an explicit language choice is written back to the URL", () => {
  const src = readFileSync(resolve(root, "client/src/lib/languageStore.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("a URL sync exists and uses replaceState, not pushState", () => {
    expect(src).toMatch(/function syncUrlLanguage/);
    expect(src).toMatch(/history\.replaceState/);
    expect(src).not.toMatch(/history\.pushState/);
  });

  it("it runs on the language actually rendered, not only inside setLanguage", () => {
    // The header writes pw_lang directly in both its controlled and
    // uncontrolled paths; those reach the provider through the poller, never
    // through setLanguage. An effect keyed on `language` catches all of them.
    expect(src).toMatch(/useEffect\(\s*\(\)\s*=>\s*\{\s*syncUrlLanguage\(language\);?\s*\}\s*,\s*\[language\]\s*\)/);
  });

  it("it rewrites a param that is present and never invents one", () => {
    const fn = src.slice(src.indexOf("function syncUrlLanguage"));
    const body = fn.slice(0, fn.indexOf("\n}") + 2);
    expect(body).toMatch(/keys\.length === 0\)\s*return/);
    expect(body).toMatch(/searchParams\.set/);
  });
});

/**
 * 2026-09-10 — the homepage shipped id="packages" twice.
 *
 * WashPackages puts that id on its own <section>; Landing wrapped it in a
 * second <div id="packages">. Measured on production: two elements match
 * `#packages`, a DIV and a SECTION, both at y=6895. Duplicate ids are invalid
 * HTML — getElementById, a `#packages` anchor and any aria-labelledby /
 * aria-controls pointing at it resolve to the first match only.
 */
describe("the packages anchor id is defined exactly once", () => {
  it("Landing does not re-declare the id WashPackages already owns", () => {
    const landing = readFileSync(resolve(root, "client/src/pages/Landing.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const section = readFileSync(resolve(root, "client/src/components/WashPackages.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(section, "WashPackages no longer owns the id — this pin needs rewriting")
      .toMatch(/id="packages"/);
    expect(landing).not.toMatch(/id="packages"/);
  });
});

/**
 * 2026-09-10 — the dev-banner dismiss button was an 18x48 sliver.
 *
 * Same root cause as the tick boxes above: the global
 * `button { min-height: 48px }` floor sets a HEIGHT only, and a bare "x" is
 * ~18px wide. Measured on production: 18x48, aspect 0.37 — and 18px wide fails
 * a 44px target on the width axis, so the floor bought nothing here either.
 *
 * The strip's appearance moved into `.pw-under-dev-dismiss` while this branch
 * was open, and that rule now states BOTH axes. The pin follows it there and
 * keeps the invariant: an icon-only button states its own size on both axes,
 * because inheriting a lone height floor is exactly what deformed it.
 */
describe("the dev-banner dismiss button states both of its axes", () => {
  const css = readFileSync(resolve(root, "client/src/styles/petwash-header.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  it("declares a min-width as well as a min-height", () => {
    const rule = css.match(/\.pw-under-dev-dismiss\s*\{[^}]*\}/);
    expect(rule, "the dismiss rule is gone — this pin needs rewriting").toBeTruthy();
    const w = rule![0].match(/min-width:\s*([\d.]+)/);
    const h = rule![0].match(/min-height:\s*([\d.]+)/);
    expect(w, "no min-width — a bare glyph collapses and the button becomes a sliver").toBeTruthy();
    expect(h).toBeTruthy();
    expect(Number(w![1])).toBeGreaterThanOrEqual(24);
    expect(Number(h![1])).toBeGreaterThanOrEqual(24);
  });
});

/**
 * 2026-09-10 — the auth form's visible labels were not attached to anything.
 *
 * Six `<label className="sl-label">` elements sat directly above their input
 * with no htmlFor, and the inputs had no id. Sighted users saw "אימייל" /
 * "סיסמה"; a screen reader got only the placeholder, which is the documented
 * anti-pattern and disappears the moment the user types. Two fields in the
 * same file (signup-first-name / signup-last-name) already did it correctly,
 * so this was an omission from an established local pattern, on the one form
 * every returning user has to get through.
 *
 * NOTE deliberately NOT changed: `required` is false on the password input on
 * purpose — the panel offers a passwordless one-time-code path and the hint
 * says so ("or leave blank to get a one-time code"). Marking it required would
 * break that flow. This pin covers naming only.
 */
describe("every text field on the auth panel is named by its own label", () => {
  const src = readFileSync(resolve(root, "client/src/pages/SignUpLuxury.tsx"), "utf8");

  it("no sl-label is left dangling in front of a raw <input>", () => {
    const dangling: string[] = [];
    const re = /<label className="sl-label"(?![^>]*htmlFor)([^>]*)>([\s\S]*?)<\/label>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const tail = src.slice(m.index + m[0].length, m.index + m[0].length + 1200);
      const input = tail.search(/<input\s/);
      // A label in front of a <PhoneInput> component names that component, not
      // a raw input — out of scope for htmlFor, and flagged separately.
      if (input === -1 || tail.slice(0, input).includes("<PhoneInput")) continue;
      dangling.push(m[2].trim().slice(0, 40));
    }
    expect(dangling, `labels with no htmlFor: ${dangling.join(" | ")}`).toEqual([]);
  });

  it("each htmlFor points at an id that exists exactly once", () => {
    const fors = [...src.matchAll(/htmlFor="([^"]+)"/g)].map((m) => m[1]);
    expect(fors.length).toBeGreaterThanOrEqual(6);
    for (const id of fors) {
      // (?<![\w-]) or `data-testid="x"` counts as a second `id="x"`.
      const hits = [...src.matchAll(new RegExp(`(?<![\\w-])id="${id}"`, "g"))].length;
      expect(hits, `id="${id}" appears ${hits} times`).toBe(1);
    }
  });
});

/**
 * 2026-09-10 — /signup and /signin had no h1 at all on a phone.
 *
 * `.sl-h1 { display: none }` in the small-screen block. Hiding the marketing
 * headline there is the right call — the form has to win the fold — but
 * display:none also drops it from the document outline and the accessibility
 * tree. Measured at 390px: zero visible h1, the first heading was the panel's
 * h2. Clipping keeps the pixels identical and the outline intact.
 */
describe("the auth page keeps an h1 on small screens", () => {
  it("the mobile rule clips .sl-h1 instead of removing it", () => {
    const src = readFileSync(resolve(root, "client/src/pages/SignUpLuxury.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/\.sl-h1\{\s*display:\s*none\s*\}/);
    const rule = src.match(/\.sl-h1\s*\{[^}]*clip-path[^}]*\}/);
    expect(rule, "no clipped .sl-h1 rule — the heading is either visible or gone").toBeTruthy();
    expect(rule![0]).toMatch(/position:\s*absolute/);
  });
});

/**
 * 2026-09-10 — a dialog that declared aria-modal but never took focus.
 *
 * The mobile drawer is role="dialog" aria-modal="true". Opening it left
 * document.activeElement on the burger — measured on production, focus stayed
 * outside the dialog — so a screen reader remained on a control it had just
 * announced as expanded, and a keyboard user had to tab forward through the
 * page to reach a menu already covering it. Closing it left focus wherever it
 * had drifted instead of returning it to the burger.
 *
 * The close button also needs a plain :focus ring, not only :focus-visible:
 * focus arrives here from a scripted .focus(), and the focus-visible heuristic
 * does not fire for that on a button — measured with the drawer open, focusing
 * it changed outline, box-shadow, border and background not at all.
 */
describe("the mobile drawer takes focus when it opens and gives it back", () => {
  const src = readFileSync(resolve(root, "client/src/components/PetWashHeader.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("still claims to be a modal dialog, so the promise applies", () => {
    expect(src).toMatch(/aria-modal="true"/);
  });

  it("moves focus into the drawer on open", () => {
    expect(src).toMatch(/\.pw-mobile-close'\)\?\.focus\(\)/);
  });

  it("remembers the opener and restores focus on close", () => {
    expect(src).toMatch(/const opener = document\.activeElement/);
    expect(src).toMatch(/opener\?\.isConnected.*opener\.focus\(\)/s);
  });

  it("the close button paints a ring on plain :focus", () => {
    const css = readFileSync(resolve(root, "client/src/styles/petwash-header.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = css.match(/\.pw-mobile-close:focus\s*\{[^}]*\}/);
    expect(rule, "no :focus rule — programmatic focus would land invisibly").toBeTruthy();
    expect(parseFloat(rule![0].match(/outline:\s*(\d+)/)?.[1] ?? "0")).toBeGreaterThanOrEqual(2);
  });
});

/**
 * 2026-09-10 — the provider dashboard told providers things that were not true.
 *
 * Three separate fictions, all on the surface a provider runs their business
 * from. Each was verified against the code before being fixed.
 */
describe("the provider dashboard does not invent what it cannot know", () => {
  const read = (p: string) =>
    readFileSync(resolve(root, p), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  /**
   * The payout tab offered `paidPayouts` — money that has ALREADY left for the
   * provider's bank — as "Available to withdraw", and "Max" pre-filled it. The
   * server clamps against `status IN ('completed','reviewed') AND payout_status
   * != 'paid_out'` (provider-dashboard-v2.ts), i.e. the PENDING balance. So the
   * headline was the one number you cannot have and Max always earned a 400.
   */
  it("offers the withdrawable balance, not the already-paid one", () => {
    const src = read("client/src/pages/provider-os/POSWallet.tsx");
    const line = src.split("\n").find((l) => l.includes("Available to withdraw"));
    expect(line, "the payout tab's balance line is gone — this pin needs rewriting").toBeTruthy();
    expect(line).toMatch(/\bpending\b/);
    expect(line).not.toMatch(/\bpaid\b/);
    // "Max" must fill the same balance the server will honour.
    expect(src).toMatch(/setPayoutAmount\(String\(pending/);
    expect(src).not.toMatch(/setPayoutAmount\(String\(paid/);
  });

  it("states no payout minimum, because none is enforced", () => {
    // The server rejects only amount <= 0. A "Minimum ₪100" line turned away
    // providers who could in fact withdraw ₪40.
    expect(read("client/src/pages/provider-os/POSWallet.tsx")).not.toMatch(/Minimum ₪/);
  });

  it("does not invent a 48-hour hold that exists nowhere in the payout path", () => {
    expect(read("client/src/pages/provider-os/POSWallet.tsx")).not.toMatch(/48h hold/);
  });

  /**
   * "Sign Now" called simulateSign(), which set local React state and toasted
   * "E-signature recorded and PDF saved to your account" — with no API call in
   * the module bar the file upload. The eight documents included the Provider
   * Agreement, the NDA and the Payout & Commission Agreement.
   */
  it("never claims to have taken a signature it did not take", () => {
    const src = read("client/src/pages/provider-os/POSDocuments.tsx");
    expect(src).not.toMatch(/simulateSign/);
    expect(src).not.toMatch(/E-signature recorded/);
    expect(src).not.toMatch(/SHA-256 hashed for legal validity/);
    expect(src).not.toMatch(/recorded with audit trail/);
  });

  /**
   * /api/provider-dashboard/v2/stats answers { success, stats: {...} }
   * (provider-dashboard-v2.ts:527). Three consumers read the ROOT, so every
   * field was undefined even on a 200 with real data — a five-star, 300-job
   * provider saw "0.0★ · 0 completed · 0% · 0 reviews", the availability
   * toggle never persisted, and the documents warning could never fire.
   */
  it("unwraps the stats envelope everywhere it is consumed", () => {
    for (const page of ["ProviderOS", "POSDashboard", "POSAssistant"]) {
      const src = read(`client/src/pages/provider-os/${page}.tsx`);
      if (!src.includes("provider-dashboard/v2/stats")) continue;
      expect(src, `${page} reads the stats envelope's root`).toMatch(/\?\.stats \?\?/);
    }
  });

  it("does not divide an already-shekel figure by 100 a second time", () => {
    // pendingPayouts is converted from cents server-side (v2:535). The
    // assistant divided again, so ₪1,200 was narrated to the provider as ₪12.
    expect(read("client/src/pages/provider-os/POSAssistant.tsx")).not.toMatch(/pending \/ 100/);
  });
});

/**
 * 2026-09-10 — four surfaces that told the user something untrue.
 */
describe("nothing claims a fact it does not have", () => {
  const read = (p: string) =>
    readFileSync(resolve(root, p), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  /**
   * A rejected or withdrawn applicant could never apply again. The submit
   * claims `provider_onboarding_apply:${uid}` — per user, marked 'done' on
   * success, never released. Inside 24h that answers DONE (409 already
   * submitted); after 24h the helper's own created_at window misses the row
   * and it answers IN_FLIGHT, so the applicant is told "your application is
   * already being submitted" permanently. The code itself says re-applying
   * after a rejection "is deliberately allowed".
   */
  it("releases the submit claim when an application is rejected or withdrawn", () => {
    const src = read("server/routes/provider-onboarding.ts");
    expect(src).toMatch(/async function reopenApplyClaim/);
    expect(src).toMatch(/reopenApplyClaim\([^)]*'application_rejected'\)/);
    expect(src).toMatch(/reopenApplyClaim\([^)]*'application_withdrawn'\)/);
    // The release must actually delete the row — finalize(key, false) does.
    expect(src).toMatch(/finalizeBusinessClaim\(applyClaimKey\(uid\), false\)/);
  });

  /**
   * GET /api/shop/products served ten rows whose own description reads
   * "EXAMPLE ONLY — Replace with real supplier item", with real prices and
   * stock, publicly and unauthenticated. Only a CLIENT-side SKU filter stood
   * between a shopper and a demo product.
   */
  it("never serves placeholder inventory from the public catalogue", () => {
    const src = read("server/routes/shop.ts");
    expect(src).toMatch(/function isPlaceholderProduct/);
    expect(src).toMatch(/startsWith\('EX-'\)/);
    // Both the list and the by-id route must refuse it.
    expect(src).toMatch(/filter\(\(p: any\) => !isPlaceholderProduct\(p\)\)/);
    expect(src).toMatch(/!product \|\| isPlaceholderProduct\(product\)/);
  });

  it("the pagination count follows the filtered list", () => {
    // Filtering the page but leaving pagination.total at the unfiltered number
    // made production answer {"products":[],"pagination":{"total":10}} — an
    // empty page claiming ten results.
    const src = read("server/routes/shop.ts");
    expect(src).toMatch(/pg\.total = Math\.max\(0, pg\.total - removed\)/);
  });

  /**
   * credit-wallet returns 'new' for a member who never enrolled (#2345). The
   * wallet's `TIER_LABELS[tier] || TIER_LABELS.bronze` turned that explicit
   * "not a member" straight back into a "Member" badge.
   */
  it("does not fall back to a membership tier the server refused to give", () => {
    const src = read("client/src/pages/MyWallet.tsx");
    expect(src).not.toMatch(/\|\| TIER_LABELS\.bronze/);
    expect(src).toMatch(/TIER_LABELS\[tier\] \?\? null/);
  });

  it("prints no shekel value for points, because no conversion rate exists", () => {
    // formatCurrency takes agorot, so `points * 10` asserted 10 points = ₪1 —
    // a rate nobody set, for something no code can redeem.
    expect(read("client/src/pages/MyWallet.tsx")).not.toMatch(/loyaltyPointsBalance \|\| 0\) \* 10/);
  });

  /**
   * /loyalty/tiers is public — no auth, no fetch — yet hardcoded the visitor's
   * tier to 'bronze', rendering "Your Tier" on Member and a padlock on all six
   * above it for everyone, including real top-tier members.
   */
  it("the public tier ladder does not assert a tier for an unknown visitor", () => {
    const src = read("client/src/pages/LoyaltyTiers.tsx");
    expect(src).not.toMatch(/const currentTier = 'bronze'/);
    expect(src).toMatch(/const currentTier: string \| null = null/);
    // and no hardcoded progress percentage
    expect(src).not.toMatch(/width: '25%'/);
  });
});

/**
 * 2026-09-10 — the "send us better documents" link went to NotFound.
 *
 * A reviewer asking for a clearer photo emails
 * `${appUrl}/provider-application/resubmit?token=…`, and /my/status returns
 * the same string as `resubmitUrl` for the status page to render. No such
 * route existed in App.tsx and no page file existed, so every one of those
 * links hit the SPA catch-all.
 *
 * It was the only way back in: `pending_resubmission` also sits in the
 * existing-application list that blocks a fresh POST /apply, so an applicant
 * asked for documents could neither upload them nor start over.
 *
 * The endpoint was already built and is PUBLIC by design — the single-use
 * secure token is the credential, claimed atomically and expiring — so the
 * page must not sit behind RequireAuth.
 */
describe("the resubmission link the server emails has somewhere to land", () => {
  const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("the route the email builds is registered", () => {
    const emailed = readFileSync(resolve(root, "server/routes/provider-onboarding.ts"), "utf8");
    expect(emailed, "the server no longer emails this path — this pin needs rewriting")
      .toMatch(/\/provider-application\/resubmit\?token=/);
    expect(app).toMatch(/<Route path="\/provider-application\/resubmit">/);
  });

  it("it is not gated behind a sign-in the token holder cannot pass", () => {
    const at = app.indexOf('<Route path="/provider-application/resubmit">');
    expect(at).toBeGreaterThan(-1);
    // Stop at this route's own closing tag — a fixed window bleeds into the
    // NEXT route, which is legitimately behind RequireAuth.
    const block = app.slice(at, app.indexOf("</Route>", at));
    expect(block).not.toMatch(/RequireAuth/);
  });

  it("the page posts the token to the endpoint that already exists", () => {
    // Comments stripped: this page's own comment says the word "Authorization"
    // to explain why it sends none, and a pin must not read its explanation.
    const page = readFileSync(resolve(root, "client/src/pages/ProviderApplicationResubmit.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(page).toMatch(/provider-onboarding\/resubmit\//);
    // The token is the credential — sending a Bearer here would be wrong.
    expect(page).not.toMatch(/Authorization/);
  });
});
