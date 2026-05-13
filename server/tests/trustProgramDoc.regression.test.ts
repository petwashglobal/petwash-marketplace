/**
 * TRUST-A — Living Trust Ecosystem governance-doc regression suite.
 *
 * Pins the binding posture of docs/trust/PROGRAM.md:
 *
 *   A. file presence + size sanity
 *   B. every numbered section heading from §0–§24 present
 *   C. every hard rule H1–H15 present verbatim
 *   D. all six Hebrew canonical paragraphs HE.1–HE.6
 *      present verbatim (the source-of-truth wording the
 *      Safety & Capability Declaration typed module will
 *      consume in TRUST-SCD-MODULE)
 *   E. all seven Israel heat-safety items present
 *   F. FORBIDDEN_MEDICAL_WORDING scan — none of the banned
 *      phrases appear in marketing-style positive
 *      assertions anywhere in the doc
 *   G. constitutional-anchor citations present
 *      (PRIVACY.md sections, Provider & Host Services
 *      Agreement sections, PR-LEGAL-A / PR-LEGAL-B refs)
 *   H. self-identification + non-overlap with prior
 *      governance docs
 *   I. nine-reason taxonomy named in §14.4
 *
 * Legal sufficiency of the program is COUNSEL-TO-CONFIRM
 * (per H11–H15 of the doc itself). This test enforces only
 * the rule-fidelity invariants.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..", "..");
const DOC_PATH = resolve(ROOT, "docs/trust/PROGRAM.md");

const DOC = readFileSync(DOC_PATH, "utf8");

// ─────────────────────────────────────────────────────────────
// A. File presence + size sanity
// ─────────────────────────────────────────────────────────────

describe("A. docs/trust/PROGRAM.md — file presence + sanity", () => {
  it("exists at the canonical path", () => {
    expect(existsSync(DOC_PATH)).toBe(true);
  });

  it("is substantive (not a stub)", () => {
    const size = statSync(DOC_PATH).size;
    expect(size).toBeGreaterThan(10_000);
  });

  it("declares itself a governance document, not runtime code", () => {
    expect(DOC).toMatch(/governance document/i);
    expect(DOC).toMatch(/does NOT itself ship runtime code/i);
  });

  it("title is the Living Trust Ecosystem Program", () => {
    expect(DOC).toMatch(/^# Living Trust Ecosystem — Program/m);
  });

  it("version is a dated tag", () => {
    expect(DOC).toMatch(/\*\*Version:\*\*\s+\d{4}-\d{2}-\d{2}/);
  });
});

// ─────────────────────────────────────────────────────────────
// B. Section headings — §0 through §24
// ─────────────────────────────────────────────────────────────

const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "## 0. Why this document exists",
  "## 1. Scope",
  "## 2. Hard rules (every TRUST-* PR MUST obey)",
  "## 3. Living Trust Ecosystem — module map",
  "## 4. Pet identity (Pet Passport summary)",
  "## 5. Provider identity (Provider Trust Card summary)",
  "## 6. Live Booking Card (summary)",
  "## 7. Safety Widget (summary)",
  "## 8. Badge taxonomy (summary)",
  "## 9. Pet Timeline (summary)",
  "## 10. IL-aware notifications (summary)",
  "## 11. WhatsApp deep-link channel (summary)",
  "## 12. Home dock (summary)",
  "## 13. Social proof (summary)",
  "## 14. Provider Safety & Capability Declaration",
  "## 15. Storage spec (shape only — no schema in this PR)",
  "## 16. Audit verbs taxonomy",
  "## 17. Bilingual canonical wording (Hebrew-first)",
  "## 18. Israel heat-safety layer",
  "## 19. Connections to existing systems",
  "## 20. PR sequence",
  "## 21. Open CEO decisions",
  '## 22. Definition of "done" for this PR',
  "## 23. Non-goals",
  "## 24. Change log",
];

describe("B. docs/trust/PROGRAM.md — section headings (§0–§24)", () => {
  for (const heading of REQUIRED_SECTIONS) {
    it(`contains heading: ${heading}`, () => {
      expect(DOC).toContain(heading);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// C. Hard rules H1–H15 verbatim
// ─────────────────────────────────────────────────────────────

const REQUIRED_HARD_RULES: ReadonlyArray<RegExp> = [
  /\*\*H1\.\*\*\s+Pet identity is canonical/,
  /\*\*H2\.\*\*\s+Provider identity is canonical/,
  /\*\*H3\.\*\*\s+Live status events flow through booking/,
  /\*\*H4\.\*\*\s+WhatsApp \/ SMS \/ FCM are channels/,
  /\*\*H5\.\*\*\s+Address staging from PRIVACY\.md §6 is law/,
  /\*\*H6\.\*\*\s+No fake social proof/,
  /\*\*H7\.\*\*\s+No new insurance promises/,
  /\*\*H8\.\*\*\s+Hebrew-first/,
  /\*\*H9\.\*\*\s+iPhone Safari \+ safe-area \+ 100dvh mandatory/,
  /\*\*H10\.\*\*\s+Single audit-log verb per consumer action/,
  /\*\*H11\.\*\*\s+Provider Safety & Capability Declaration is/,
  /\*\*H12\.\*\*\s+Pet Wash NEVER collects full medical records/,
  /\*\*H13\.\*\*\s+Doctor confirmation, when requested for higher-/,
  /\*\*H14\.\*\*\s+Independent-contractor wording is mandatory/,
  /\*\*H15\.\*\*\s+Israeli proportionality test/,
];

describe("C. docs/trust/PROGRAM.md — hard rules H1–H15 verbatim", () => {
  for (const pattern of REQUIRED_HARD_RULES) {
    it(`hard rule present: ${pattern}`, () => {
      expect(DOC).toMatch(pattern);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// D. Hebrew canonical paragraphs HE.1–HE.6 verbatim
// ─────────────────────────────────────────────────────────────

const HEBREW_SENTINELS: ReadonlyArray<{
  readonly id: string;
  readonly fragment: string;
}> = [
  { id: "HE.1", fragment: "כחלק מהצטרפותך לפלטפורמת פט וואש" },
  { id: "HE.2", fragment: "ידוע לי כי השירותים בפלטפורמה עשויים לכלול" },
  { id: "HE.3", fragment: "אני מאשר/ת כי למיטב ידיעתי אינני מודע/ת למגבלה" },
  { id: "HE.4", fragment: "אני מתחייב/ת שלא להעניק שירות תחת השפעת אלכוהול" },
  { id: "HE.5", fragment: "אני מתחייב/ת לפעול באחריות בתנאי חום" },
  { id: "HE.6", fragment: "ידוע לי כי פט וואש בע״מ אינה גוף רפואי" },
];

describe("D. docs/trust/PROGRAM.md — HE.1–HE.6 verbatim", () => {
  for (const item of HEBREW_SENTINELS) {
    it(`${item.id} fragment present: ${item.fragment}`, () => {
      expect(DOC).toContain(item.fragment);
    });
  }

  it("Hebrew capability self-declaration carries the למיטב ידיעתי framing", () => {
    // The "to the best of my knowledge" anchor is intentional —
    // it keeps the statement non-medical (good-faith capability
    // attestation, not a medical claim).
    expect(DOC).toContain("למיטב ידיעתי");
  });

  it("Hebrew non-medical disclaimer is present", () => {
    expect(DOC).toContain("אינה גוף רפואי");
  });
});

// ─────────────────────────────────────────────────────────────
// E. Israel heat-safety items
// ─────────────────────────────────────────────────────────────

const HEAT_SAFETY_ITEMS: ReadonlyArray<RegExp> = [
  /Hot asphalt awareness/i,
  /Hydration/i,
  /Unsafe summer hours/i,
  /Brachycephalic dog risks/i,
  /Pet distress signs/i,
  /Vehicle heat dangers/i,
  /Water availability obligation/i,
];

describe("E. docs/trust/PROGRAM.md — Israel heat-safety layer", () => {
  for (const pattern of HEAT_SAFETY_ITEMS) {
    it(`heat-safety item present: ${pattern}`, () => {
      expect(DOC).toMatch(pattern);
    });
  }

  it("references the Tel Aviv summer 11:00–16:00 default block", () => {
    expect(DOC).toMatch(/11:00.{0,3}16:00/);
    expect(DOC).toMatch(/June.{0,3}September|June–September/);
  });

  it("references brachycephalic breeds explicitly", () => {
    expect(DOC).toMatch(/pugs|French bulldogs|Boston terriers/);
  });
});

// ─────────────────────────────────────────────────────────────
// F. FORBIDDEN_MEDICAL_WORDING scan
//
// The doc names the banned phrases in §14.7 (the "NEVER use"
// list) and §15 (the FORBIDDEN_MEDICAL_WORDING set). That is
// the ONLY context where the phrases legitimately appear —
// as quoted bans. The doc must NOT use any of them in a
// positive, marketing-style assertion.
//
// Scan: each banned phrase MAY appear, but ONLY immediately
// adjacent to one of the rejection anchors:
//   - quoted as a banned phrase inside a list
//   - inside the FORBIDDEN_MEDICAL_WORDING enumeration
//   - in a "NEVER use" / "must never appear" context
// Implementation: count occurrences and assert every
// occurrence falls within the §14.7 or §15 region of the
// document (after the "### 14.7" heading and before
// section §16).
// ─────────────────────────────────────────────────────────────

function regionBetween(start: string, end: string): string {
  const i = DOC.indexOf(start);
  const j = DOC.indexOf(end);
  if (i < 0) return "";
  return DOC.slice(i, j > i ? j : DOC.length);
}

const BAN_LIST_REGION_147 = regionBetween("### 14.7 Independent-contractor wording rules", "### 14.8");
const BAN_LIST_REGION_15 = regionBetween("## 15. Storage spec", "## 16. Audit verbs taxonomy");
const ALLOWED_BAN_CONTEXT = BAN_LIST_REGION_147 + "\n" + BAN_LIST_REGION_15;

const FORBIDDEN_MEDICAL_WORDING: ReadonlyArray<string> = [
  "medically healthy",
  "mentally healthy",
  "free from illness",
  "medically approved",
  "medical approval",
  "employee medical",
  "passed medical",
  "company medical clearance",
];

describe("F. docs/trust/PROGRAM.md — FORBIDDEN_MEDICAL_WORDING scan", () => {
  it("§14.7 region is non-empty (the ban list itself must exist)", () => {
    expect(BAN_LIST_REGION_147.length).toBeGreaterThan(0);
  });

  it("§15 region is non-empty (the FORBIDDEN_MEDICAL_WORDING set must exist)", () => {
    expect(BAN_LIST_REGION_15.length).toBeGreaterThan(0);
  });

  for (const phrase of FORBIDDEN_MEDICAL_WORDING) {
    it(`"${phrase}" appears ONLY inside the §14.7 / §15 ban-list regions`, () => {
      // Every occurrence in the whole doc must be inside the
      // permitted ban-list region.
      const allCount = (DOC.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length;
      const banListCount = (ALLOWED_BAN_CONTEXT.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length;
      expect(allCount).toBeGreaterThan(0); // phrase must be named (as a ban) at least once
      expect(allCount).toBe(banListCount); // and every occurrence is inside the ban-list region
    });
  }

  it("the doc explicitly forbids 'employment medical screening' language", () => {
    expect(DOC).toMatch(/employment medical screening/i);
    expect(DOC).toMatch(/NOT as employment medical screening/i);
  });

  it("the doc does not contain insurance-promise wording (PR #248 lock extends)", () => {
    // Spot-check the PR-#248 patterns. The repo-wide
    // FORBIDDEN_PATTERNS scan in PR-LEGAL-B handles the
    // exhaustive case; here we sanity-check this doc.
    expect(DOC).not.toMatch(/fully insured/i);
    expect(DOC).not.toMatch(/Covered by Pet ?Wash/i);
    expect(DOC).not.toMatch(/Pet ?Wash[™]?\s*Protect/i);
    expect(DOC).not.toMatch(/Harel\s+Insurance/i);
  });
});

// ─────────────────────────────────────────────────────────────
// G. Constitutional-anchor citations
// ─────────────────────────────────────────────────────────────

describe("G. docs/trust/PROGRAM.md — constitutional anchors", () => {
  it("cites docs/location/PRIVACY.md §3, §7, §10, §11, §13, §14, §17", () => {
    expect(DOC).toMatch(/PRIVACY\.md[^\n]*§3[^\n]*§7/);
    expect(DOC).toMatch(/§10/);
    expect(DOC).toMatch(/§11/);
    expect(DOC).toMatch(/§13/);
    expect(DOC).toMatch(/§14/);
    expect(DOC).toMatch(/§17/);
  });

  it("cites the Provider & Host Services Agreement (PR-LEGAL-A #246)", () => {
    expect(DOC).toMatch(/PR-LEGAL-A #246/);
    expect(DOC).toMatch(/Provider & Host Services Agreement/);
  });

  it("cites the §8 insurance-disclaimer anchor", () => {
    expect(DOC).toMatch(/Pet Wash Ltd is not an insurance company, insurance broker or insurance adviser/);
  });

  it("cites PR-LEGAL-B #247 / #248 as the insurance-consistency lock source", () => {
    expect(DOC).toMatch(/PR[- ]?LEGAL[- ]?B/);
    expect(DOC).toMatch(/#247/);
    expect(DOC).toMatch(/#248/);
  });
});

// ─────────────────────────────────────────────────────────────
// H. Self-identification + non-overlap
// ─────────────────────────────────────────────────────────────

describe("H. docs/trust/PROGRAM.md — self-identification + non-overlap", () => {
  it("is the TRUST program, not the Location program", () => {
    expect(DOC).toMatch(/^# Living Trust Ecosystem/m);
    expect(DOC).not.toMatch(/^# Location Infrastructure Program/m);
  });

  it("PR id TRUST-A appears in the change log", () => {
    expect(DOC).toMatch(/TRUST-A/);
  });

  it("does NOT redefine the city dataset", () => {
    expect(DOC).not.toMatch(/1272 rows/i);
    expect(DOC).not.toMatch(/normalizeHebrewCitySearch/);
  });

  it("does NOT redefine the address model", () => {
    expect(DOC).not.toMatch(/ADDRESS_CONFIDENCE_TIERS/);
    expect(DOC).not.toMatch(/AddressConfidence\b/);
  });

  it("does NOT redefine the Provider & Host Services Agreement body", () => {
    // The agreement body lives in shared/legal/
    // providerHostAgreement.ts. This doc CITES it but must
    // not re-paraphrase its sections.
    expect(DOC).not.toMatch(/INSURANCE DISCLAIMER\s+IMPORTANT NOTICE/);
  });
});

// ─────────────────────────────────────────────────────────────
// I. Nine-reason enhanced-verification taxonomy
// ─────────────────────────────────────────────────────────────

const NINE_REASONS: ReadonlyArray<string> = [
  "PetTrek",
  "overnight",
  "key holding",
  "medication administration",
  "reactive",
  "large-dog",
  "special-needs",
  "elderly-pet",
  "multi-pet",
];

describe("I. docs/trust/PROGRAM.md — Level-2 nine-reason taxonomy", () => {
  for (const r of NINE_REASONS) {
    it(`names reason: ${r}`, () => {
      expect(DOC.toLowerCase()).toContain(r.toLowerCase());
    });
  }

  it("references the existing providerDeclaration.ts as the taxonomy seed", () => {
    expect(DOC).toMatch(/shared\/legal\/providerDeclaration\.ts/);
    expect(DOC).toMatch(/ENHANCED_VERIFICATION_REASONS/);
  });
});

// ─────────────────────────────────────────────────────────────
// J. PR sequence — TRUST-A through TRUST-L + TRUST-SCD-*
// ─────────────────────────────────────────────────────────────

const PR_ROW_IDS: ReadonlyArray<string> = [
  "TRUST-A",
  "TRUST-SCD-MODULE",
  "TRUST-B",
  "TRUST-C",
  "TRUST-D",
  "TRUST-E",
  "TRUST-F",
  "TRUST-G",
  "TRUST-H",
  "TRUST-I",
  "TRUST-J",
  "TRUST-K",
  "TRUST-L",
  "TRUST-SCD-SCHEMA",
  "TRUST-SCD-API",
  "TRUST-SCD-UI",
  "TRUST-SCD-ADMIN",
  "TRUST-SCD-COUNSEL-FLIP",
];

describe("J. docs/trust/PROGRAM.md — PR sequence rows", () => {
  for (const id of PR_ROW_IDS) {
    it(`PR id row present: ${id}`, () => {
      expect(DOC).toContain(id);
    });
  }
});
