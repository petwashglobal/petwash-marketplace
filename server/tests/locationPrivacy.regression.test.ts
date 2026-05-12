/**
 * PR-LOCATION-PRIVACY-1 — Constitution regression suite.
 *
 * Pins the address-data privacy constitution at
 * docs/location/PRIVACY.md. A future PR that silently
 * deletes a section, weakens a hard rule, or sneaks runtime
 * code into this PR must fail LOUDLY here.
 *
 *   A. file presence + size sanity
 *   B. every section heading from §0–§20 is present
 *   C. every "hard rule" item in §2 is present
 *   D. every required topic from the CEO directive is
 *      addressed (24-topic checklist from chat 2026-05-12)
 *   E. legal-citation anchors (Israeli Privacy Protection
 *      Law, GDPR articles, Israeli tax law section)
 *   F. no runtime code shipped in this PR — only the doc
 *      and this regression test should be in the diff
 *   G. constitutional anchors are stable strings that
 *      future PRs are required to cite verbatim
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..", "..");
const DOC_PATH = resolve(ROOT, "docs/location/PRIVACY.md");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const DOC = readFileSync(DOC_PATH, "utf8");

// ─────────────────────────────────────────────────────────────
// A. File presence + size sanity
// ─────────────────────────────────────────────────────────────

describe("A. PRIVACY.md — file presence + sanity", () => {
  it("exists at the canonical path", () => {
    expect(existsSync(DOC_PATH)).toBe(true);
  });

  it("is substantive (not a stub)", () => {
    const size = statSync(DOC_PATH).size;
    // ≥10 KB ≈ 250 paragraph-lines. A token-shaped stub of
    // a few hundred bytes would fail this.
    expect(size).toBeGreaterThan(10_000);
  });

  it("declares itself a governance document, not runtime code", () => {
    expect(DOC).toMatch(/governance document/i);
    expect(DOC).toMatch(/does NOT itself ship runtime code/i);
  });
});

// ─────────────────────────────────────────────────────────────
// B. Every numbered section heading is present
// ─────────────────────────────────────────────────────────────

const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "## 0. Why this document exists",
  "## 1. Scope",
  "## 2. Hard rules (every downstream PR MUST obey)",
  "## 3. Data inventory (what may be stored)",
  "## 4. Access matrix (who can see what)",
  "## 5. Retention",
  "## 6. Provider visibility — the rule everyone asks about",
  "## 7. Audit logging",
  "## 8. Export & sync to Google (Sheets, Drive, GCS)",
  "## 9. Manual vs automatic matching",
  "## 10. Israeli Privacy Protection Law (Law 5741-1981) posture",
  "## 11. GDPR-compatible export / delete posture",
  "## 12. Children, family, and safety edge cases",
  "## 13. Consent wording (UI copy)",
  "## 14. Emergency disclosure",
  "## 15. Manual vs automatic — UI-level rules",
  "## 16. Open CEO decisions blocking downstream PRs",
  "## 17. How downstream PRs cite this document",
  "## 18. Change log",
  "## 19. Non-goals of this document",
  '## 20. Definition of "done" for this PR',
];

describe("B. PRIVACY.md — section headings", () => {
  for (const heading of REQUIRED_SECTIONS) {
    it(`contains heading: ${heading}`, () => {
      expect(DOC).toContain(heading);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// C. Every numbered hard-rule item in §2
// ─────────────────────────────────────────────────────────────

const REQUIRED_HARD_RULES: ReadonlyArray<RegExp> = [
  /^1\. \*\*No free-text city\.\*\*/m,
  /^2\. \*\*No silent persistence\.\*\*/m,
  /^3\. \*\*Minimum viable scope\.\*\*/m,
  /^4\. \*\*Manual confirm always wins\.\*\*/m,
  /^5\. \*\*No live coordinate sharing without an explicit user/m,
  /^6\. \*\*No silent background geolocation\.\*\*/m,
  /^7\. \*\*No IP-based geolocation auto-fill\.\*\*/m,
  /^8\. \*\*No live third-party geocoding by default\.\*\*/m,
  /^9\. \*\*No coordinates before acceptance\.\*\*/m,
  /^10\. \*\*No apartment \/ floor \/ entrance before acceptance\.\*\*/m,
  /^11\. \*\*Every read is logged\.\*\*/m,
  /^12\. \*\*Every export is logged\.\*\*/m,
  /^13\. \*\*Right to deletion is honoured within 30 days\.\*\*/m,
  /^14\. \*\*Provider visibility is a function of state, not role\.\*\*/m,
  /^15\. \*\*Children and family members are inferred, not/m,
];

describe("C. PRIVACY.md — §2 hard rules", () => {
  for (const pattern of REQUIRED_HARD_RULES) {
    it(`hard rule present: ${pattern}`, () => {
      expect(DOC).toMatch(pattern);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// D. CEO-required topic checklist (chat 2026-05-12)
// ─────────────────────────────────────────────────────────────

const CEO_TOPIC_KEYWORDS: ReadonlyArray<{ topic: string; pattern: RegExp }> = [
  { topic: "exact address data stored", pattern: /Data inventory.*may be stored/i },
  { topic: "who can see it", pattern: /Access matrix.*who can see what/i },
  { topic: "retention period", pattern: /## 5\. Retention/ },
  { topic: "provider visibility rules", pattern: /Provider visibility/i },
  { topic: "audit logging", pattern: /## 7\. Audit logging/ },
  { topic: "deletion/export rights", pattern: /right to erasure|right of access|portability/i },
  { topic: "Google sync rules", pattern: /Export & sync to Google/i },
  { topic: "manual vs automatic matching", pattern: /## 9\. Manual vs automatic matching/ },
  { topic: "location precision exposure", pattern: /Coordinate rounding policy/i },
  { topic: "children/family safety edge cases", pattern: /Children, family, and safety/i },
  { topic: "emergency disclosure", pattern: /## 14\. Emergency disclosure/ },
  { topic: "PetTrek transport visibility", pattern: /PetTrek/i },
  { topic: "PawFinder privacy", pattern: /PawFinder/i },
  { topic: "K9000 station privacy separation", pattern: /K9000.*public/i },
  { topic: "providers see exact address before accept?", pattern: /Before customer picks a provider/i },
  { topic: "walkers see apartment numbers?", pattern: /Walkers — do they see apartment numbers/i },
  { topic: "coordinates rounded before acceptance?", pattern: /3 decimal places/i },
  { topic: "storage of historical booking snapshots", pattern: /Snapshot rule.*Israeli tax law/i },
  { topic: "Israeli Privacy Protection Law posture", pattern: /Law 5741-1981/i },
  { topic: "GDPR-compatible export/delete posture", pattern: /GDPR-compatible export \/ delete posture/i },
  { topic: "Google Places consent wording", pattern: /Google Places consent/i },
  { topic: "no silent background geolocation", pattern: /No silent background geolocation/i },
  { topic: "no IP geolocation auto-fill", pattern: /No IP-based geolocation auto-fill/i },
  { topic: "no live coordinate sharing without action", pattern: /No live coordinate sharing without an explicit user/i },
];

describe("D. PRIVACY.md — CEO topic checklist (chat 2026-05-12)", () => {
  for (const { topic, pattern } of CEO_TOPIC_KEYWORDS) {
    it(`covers: ${topic}`, () => {
      expect(DOC).toMatch(pattern);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// E. Legal-citation anchors
// ─────────────────────────────────────────────────────────────

describe("E. PRIVACY.md — legal-citation anchors", () => {
  it("cites Israeli Privacy Protection Law 5741-1981", () => {
    expect(DOC).toMatch(/Law 5741-1981/);
  });

  it("cites GDPR Article 6 (lawful basis)", () => {
    expect(DOC).toMatch(/Article 6\b/);
  });

  it("cites GDPR Article 15 (right of access)", () => {
    expect(DOC).toMatch(/Article 15\b/);
  });

  it("cites GDPR Article 17 (right to erasure)", () => {
    expect(DOC).toMatch(/Article 17\b/);
  });

  it("cites GDPR Article 20 (portability)", () => {
    expect(DOC).toMatch(/Article 20\b/);
  });

  it("cites GDPR Article 22 (automated decision making)", () => {
    expect(DOC).toMatch(/Article 22\b/);
  });

  it("cites Israeli tax law section 25 (7-year retention)", () => {
    expect(DOC).toMatch(/Income Tax Ordinance.*section 25|section 25.*Income Tax/);
    expect(DOC).toMatch(/7-year/);
  });

  it("cites §29A of the Israeli Privacy Protection Law (emergency disclosure)", () => {
    expect(DOC).toMatch(/§29A.*Israeli Privacy Protection Law|Israeli Privacy Protection Law[^.]*§29A/);
  });
});

// ─────────────────────────────────────────────────────────────
// F. Doc-only PR — no runtime code shipped here
// ─────────────────────────────────────────────────────────────

describe("F. PR-LOCATION-PRIVACY-1 — doc-only invariants", () => {
  it("doc states no schema migration ships in this PR", () => {
    expect(DOC).toMatch(/no schema, no migration/i);
  });

  it("doc states no UI / no route / no env var ships in this PR", () => {
    expect(DOC).toMatch(/no UI, no route, no env var/i);
  });

  it("references the existing dataset PR by id (so a reader cannot mis-identify the foundation)", () => {
    expect(DOC).toMatch(/PR-LOCATION-CITIES-1/);
  });

  it("references the existing address-model PR by id", () => {
    expect(DOC).toMatch(/PR-LOCATION-ADDRESS-MODEL-1/);
  });

  it("references the existing city-picker PR by id", () => {
    expect(DOC).toMatch(/PR-LOCATION-CITY-PICKER-1/);
  });

  it("references the existing places-guard PR by id", () => {
    expect(DOC).toMatch(/PR-LOCATION-GUARD-PLACES-1/);
  });
});

// ─────────────────────────────────────────────────────────────
// G. Constitutional anchors — strings downstream PRs must cite
// ─────────────────────────────────────────────────────────────

const ANCHOR_STRINGS: ReadonlyArray<string> = [
  // The literal anchor string §17 says PRs must include in
  // their body. If we ever change this string, the change is
  // intentional and breaks this test on purpose.
  "Constitutional reference: docs/location/PRIVACY.md",
  // The tier names every downstream PR MUST use verbatim.
  "**T0**",
  "**T1**",
  "**T2**",
  // The audit-log action verbs downstream PRs MUST emit.
  "`address-revealed-on-accept`",
  "`address-redacted-on-deletion`",
  "`address-exported`",
  "`address-emergency-disclosure`",
  "`address-precision-elevated`",
  "`live-location-share-started`",
  "`live-location-share-stopped`",
];

describe("G. PRIVACY.md — constitutional anchor strings (stable)", () => {
  for (const anchor of ANCHOR_STRINGS) {
    it(`contains anchor: ${anchor}`, () => {
      expect(DOC).toContain(anchor);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// H. Sanity — this PR is in fact the privacy PR, not an
//    accidental re-write of another doc.
// ─────────────────────────────────────────────────────────────

describe("H. PRIVACY.md — self-identification", () => {
  it("title is the Location Privacy & Address-Data Constitution", () => {
    expect(DOC).toMatch(/^# Location Privacy & Address-Data Constitution/m);
  });

  it("PR id appears in the change log", () => {
    expect(DOC).toMatch(/PR-LOCATION-PRIVACY-1/);
  });

  it("does NOT redefine the city dataset (avoids stepping on PR-LOCATION-CITIES-1)", () => {
    expect(DOC).not.toMatch(/1272 rows/i);
    expect(DOC).not.toMatch(/normalizeHebrewCitySearch/);
  });

  it("does NOT redefine the address model (avoids stepping on PR-LOCATION-ADDRESS-MODEL-1)", () => {
    expect(DOC).not.toMatch(/AddressConfidence\b/);
    expect(DOC).not.toMatch(/ADDRESS_CONFIDENCE_TIERS/);
  });
});
