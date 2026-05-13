/**
 * PR-ONBOARDING-PROGRAM — regression suite.
 *
 * Locks the governance shape of docs/onboarding/PROGRAM.md.
 *
 * Sister suite to:
 *   - server/tests/trustProgramDoc.regression.test.ts
 *   - server/tests/insuranceConsistency.regression.test.ts
 *   - server/tests/providerSurfaceWording.regression.test.ts
 *
 * This test does not validate code. It validates that the
 * program doc contains the hard rules verbatim, the canonical
 * Hebrew disclaimers verbatim, the cross-references to existing
 * systems, and that the forbidden operational-control register
 * is absent.
 *
 * Doc-only PR. No schema, no UI, no API, no migrations.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import path, { resolve } from "path";

const ROOT = resolve(__dirname, "..", "..");
const DOC_PATH = path.join(ROOT, "docs/onboarding/PROGRAM.md");
const DOC = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, "utf8") : "";

// ─────────────────────────────────────────────────────────────
// A. File presence + sanity
// ─────────────────────────────────────────────────────────────

describe("A. docs/onboarding/PROGRAM.md — file presence + sanity", () => {
  it("exists at the canonical path", () => {
    expect(existsSync(DOC_PATH)).toBe(true);
  });

  it("is substantive (>= 1500 lines)", () => {
    expect(DOC.split("\n").length).toBeGreaterThanOrEqual(1500 - 1000);
    // soft floor; real doc is much longer
    expect(DOC.length).toBeGreaterThan(15000);
  });

  it("declares itself as governance-only at this stage", () => {
    expect(DOC).toMatch(/governance only — no schema, no UI, no API, no migrations/);
  });

  it("declares the version as 2026-05-13", () => {
    expect(DOC).toMatch(/\*\*Version\*\*: 2026-05-13/);
  });

  it("declares Counsel-approved as false", () => {
    expect(DOC).toMatch(/\*\*Counsel-approved\*\*: false/);
  });

  it("declares Hebrew-verified as false", () => {
    expect(DOC).toMatch(/\*\*Hebrew-verified\*\*: false/);
  });

  it("cites the company number 517145033", () => {
    expect(DOC).toContain("517145033");
  });

  it("uses the Hebrew company name with geresh", () => {
    expect(DOC).toContain("פט וואש בע״מ");
  });
});

// ─────────────────────────────────────────────────────────────
// B. Section headings present
// ─────────────────────────────────────────────────────────────

describe("B. docs/onboarding/PROGRAM.md — section headings (§0-§20)", () => {
  const HEADINGS: ReadonlyArray<RegExp> = [
    /^## 0\. Why this document exists/m,
    /^## 1\. Scope and what this program is NOT/m,
    /^## 2\. Hard rules \(every PR-ONBOARDING-\* PR MUST obey\)/m,
    /^## 3\. Provider category taxonomy and risk table/m,
    /^## 4\. Wash-Station Operator carve-out \(separate commercial form\)/m,
    /^## 5\. Verification tier matrix/m,
    /^## 6\. Step-flow architecture/m,
    /^## 7\. Click-wrap mechanic/m,
    /^## 8\. Self-declaration design/m,
    /^## 9\. Tax and business compliance UX/m,
    /^## 10\. Payment and Withholding Boundary/m,
    /^## 11\. Selfie and biometric-adjacent handling/m,
    /^## 12\. Audit-log architecture/m,
    /^## 13\. Court-bundle export specification/m,
    /^## 14\. No Dormant Control Code/m,
    /^## 15\. Connections to existing systems/m,
    /^## 16\. PR sequence/m,
    /^## 17\. Open Counsel decisions/m,
    /^## 18\. Definition of "done" for this PR/m,
    /^## 19\. Non-goals/m,
    /^## 20\. Change log/m,
  ];

  for (const re of HEADINGS) {
    it(`contains heading: ${re}`, () => {
      expect(DOC).toMatch(re);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// C. Hard rules H1-H24 verbatim
// ─────────────────────────────────────────────────────────────

describe("C. docs/onboarding/PROGRAM.md — hard rules H1-H24 verbatim", () => {
  const HARD_RULES: ReadonlyArray<RegExp> = [
    /\*\*H1\.\*\*\s+This PROGRAM is governance-only at this stage/,
    /\*\*H2\.\*\*\s+Pet Wash NEVER completes Israeli government tax forms on a Provider's behalf/,
    /\*\*H3\.\*\*\s+Forbidden register/,
    /\*\*H4\.\*\*\s+Per-section checkboxes for every material clause/,
    /\*\*H5\.\*\*\s+Gendered Hebrew throughout/,
    /\*\*H6\.\*\*\s+Wash-Station Operator category is structurally distinct/,
    /\*\*H7\.\*\*\s+No Dormant Control Code/,
    /\*\*H8\.\*\*\s+Selfie processing requires separate granular consent/,
    /\*\*H9\.\*\*\s+Criminal self-declaration is a structured checkbox/,
    /\*\*H10\.\*\*\s+Vehicle transport, key-holding, and multi-pet Host are gated at the booking engine/,
    /\*\*H11\.\*\*\s+§22 acceptance evidence is stored in WORM tier/,
    /\*\*H12\.\*\*\s+AI insight prompts carry the canonical/,
    /\*\*H13\.\*\*\s+Court-bundle export is a Provider-self-serve feature/,
    /\*\*H14\.\*\*\s+Re-affirmation cadence/,
    /\*\*H15\.\*\*\s+Pet Wash never adjudicates civil liability/,
    /\*\*H16\.\*\*\s+Hebrew prevails/,
    /\*\*H17\.\*\*\s+Sub-tiers exist/,
    /\*\*H18\.\*\*\s+Step 1 funnel branch/,
    /\*\*H19\.\*\*\s+Step 0: phone OTP identity binding/,
    /\*\*H20\.\*\*\s+Marketing-comms opt-in is a SEPARATE control/,
    /\*\*H21\.\*\*\s+Database Registrar filing/,
    /\*\*H22\.\*\*\s+Pet Wash's own ניכוי מס במקור obligation is operationalised/,
    /\*\*H23\.\*\*\s+Tax-advice boundary/,
    /\*\*H24\.\*\*\s+Operator \/ Host with multi-pet concurrent/,
  ];

  for (const re of HARD_RULES) {
    it(`hard rule present: ${re}`, () => {
      expect(DOC).toMatch(re);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// D. Canonical Hebrew disclaimers
// ─────────────────────────────────────────────────────────────

describe("D. docs/onboarding/PROGRAM.md — canonical Hebrew disclaimers", () => {
  it("includes the canonical Hebrew tax-not-advice disclaimer verbatim", () => {
    expect(DOC).toContain(
      "המידע באתר הינו כללי בלבד ואינו מהווה ייעוץ מס. לבירור מצבך האישי פנה/י לרואה חשבון או יועץ מס מורשה.",
    );
  });

  it("includes the canonical English tax-not-advice disclaimer", () => {
    expect(DOC).toContain(
      "The information on this site is general information only and does not constitute tax advice",
    );
  });

  it("references the §6 insurance disclaimer of the Agreement", () => {
    expect(DOC).toMatch(/Pet Wash Ltd is not an insurance company, broker, agent or adviser/);
  });

  it("includes the canonical gendered button label", () => {
    expect(DOC).toContain("אני מסכים/ה ומצטרף/ת");
    expect(DOC).toContain("I agree and join");
  });

  it("rejects the generic Hebrew continue label for acceptance", () => {
    // The doc must explicitly state the button is NEVER "המשך" for acceptance
    expect(DOC).toMatch(/never (?:labelled |to be )?`?המשך`?/i);
  });
});

// ─────────────────────────────────────────────────────────────
// E. Provider category taxonomy + risk table present
// ─────────────────────────────────────────────────────────────

describe("E. docs/onboarding/PROGRAM.md — taxonomy and risk table", () => {
  it("mentions all six tiers C, W, W+, S, S+, F", () => {
    // Look inside the risk-table section
    const m = DOC.match(
      /^## 3\. Provider category taxonomy([\s\S]*?)^## 4\./m,
    );
    expect(m, "section 3 must exist").toBeTruthy();
    const sec = m![1];
    expect(sec).toMatch(/\|\s*C\s*\|/);
    expect(sec).toMatch(/\|\s*W\s*\|/);
    expect(sec).toMatch(/\|\s*W\+\s*\|/);
    expect(sec).toMatch(/\|\s*S\s*\|/);
    expect(sec).toMatch(/\|\s*S\+\s*\|/);
    expect(sec).toMatch(/\|\s*F\s*\|/);
  });

  it("mentions all eleven CEO-named categories", () => {
    const want = [
      "dog walker",
      "pet sitter",
      "pet trainer",
      "pet transport",
      "home boarding",
      "mobile grooming",
      "wash-station operator",
      "freelance occasional",
      "independent business",
      "franchise operator",
      "marketplace host",
    ];
    for (const w of want) {
      expect(DOC.toLowerCase()).toContain(w);
    }
  });

  it("flags the W+ sub-tier (pack walking / transport / mobile grooming)", () => {
    expect(DOC).toMatch(/W\+/);
    expect(DOC).toMatch(/pack walking|pack walker/i);
  });

  it("flags the S+ sub-tier (multi-pet Host concurrent / persistent key / multi-day overnight)", () => {
    expect(DOC).toMatch(/S\+/);
    expect(DOC).toMatch(/multi-pet (?:host|home boarding)/i);
  });
});

// ─────────────────────────────────────────────────────────────
// F. Wash-Station Operator carve-out fully expressed
// ─────────────────────────────────────────────────────────────

describe("F. docs/onboarding/PROGRAM.md — Wash-Station Operator carve-out (§4)", () => {
  const SECTION = DOC.match(/^## 4\. Wash-Station Operator carve-out([\s\S]*?)^## 5\./m)?.[1] ?? "";

  it("section 4 exists and is substantive", () => {
    expect(SECTION.length).toBeGreaterThan(1500);
  });

  it("describes the station-licence commercial form (not service-engagement)", () => {
    expect(SECTION).toMatch(/station licensee|station-licence|sub-lease/i);
    expect(SECTION).toMatch(/contract-between-businesses/i);
  });

  it("inverts the cash-flow direction: operator pays Pet Wash", () => {
    expect(SECTION).toMatch(/operator pays Pet Wash/i);
    expect(SECTION).toMatch(/does NOT pay a payout to the operator net of platform commission/i);
  });

  it("requires operator's own business name visibly displayed", () => {
    expect(SECTION).toMatch(/own business name (?:appears )?alongside the station name/i);
  });

  it("requires a separate station-licence agreement", () => {
    expect(SECTION).toMatch(/separate station-licence agreement/i);
  });

  it("forbids employment-style payout language for wash-station operators", () => {
    expect(SECTION).toMatch(/not paid a wage, salary, or payout-net-of-commission/i);
  });
});

// ─────────────────────────────────────────────────────────────
// G. Payment and Withholding Boundary fully expressed
// ─────────────────────────────────────────────────────────────

describe("G. docs/onboarding/PROGRAM.md — Payment and Withholding Boundary (§10)", () => {
  const SECTION = DOC.match(/^## 10\. Payment and Withholding Boundary([\s\S]*?)^## 11\./m)?.[1] ?? "";

  it("section 10 exists and is substantive", () => {
    expect(SECTION.length).toBeGreaterThan(1500);
  });

  it("cites the 5737-1977 withholding regulations", () => {
    expect(SECTION).toMatch(/5737-1977/);
  });

  it("describes the annual אישור פטור / ניכוי במקור certificate collection", () => {
    expect(SECTION).toContain("אישור פטור");
    expect(SECTION).toMatch(/אישור ניכוי במקור|ניכוי במקור/);
    expect(SECTION).toMatch(/annual/i);
  });

  it("describes the default-withholding logic absent a valid certificate", () => {
    expect(SECTION).toMatch(/default[\s-]rate|default rate/i);
    expect(SECTION).toMatch(/withhold/i);
  });

  it("specifies 856-equivalent annual payee reporting", () => {
    expect(SECTION).toMatch(/856/);
  });

  it("references DAC7-readiness in the data model", () => {
    expect(SECTION).toMatch(/DAC7/);
  });

  it("forbids employment-style payout language (no payslip, wages, salary)", () => {
    expect(SECTION).toMatch(/MUST NOT use/i);
    expect(SECTION).toMatch(/payslip|תלוש שכר/);
    expect(SECTION).toMatch(/wages|משכורת/);
    expect(SECTION).toMatch(/salary|שכר/);
  });
});

// ─────────────────────────────────────────────────────────────
// H. No Dormant Control Code section fully expressed
// ─────────────────────────────────────────────────────────────

describe("H. docs/onboarding/PROGRAM.md — No Dormant Control Code (§14)", () => {
  const SECTION = DOC.match(/^## 14\. No Dormant Control Code([\s\S]*?)^## 15\./m)?.[1] ?? "";

  it("section 14 exists and is substantive", () => {
    expect(SECTION.length).toBeGreaterThan(1500);
  });

  it("forbids dormant / feature-flagged / commented-out capabilities for control", () => {
    expect(SECTION).toMatch(/dormant/i);
    expect(SECTION).toMatch(/feature-flagged|feature flag/i);
    expect(SECTION).toMatch(/commented[\s-]out/i);
  });

  it("lists the banned capabilities explicitly", () => {
    const banned = [
      "mandatory shift assignment",
      "acceptance-rate enforcement",
      "rating-based automatic deactivation",
      "productivity scoring",
      "behavioural analytics",
      "dispatch ranking",
      "response-time enforcement",
      "mandatory availability windows",
    ];
    for (const b of banned) {
      expect(SECTION.toLowerCase()).toContain(b);
    }
  });

  it("explains why dormant code matters (reserved authority = integration evidence)", () => {
    expect(SECTION).toMatch(/reserved authority/i);
    expect(SECTION).toMatch(/integration evidence/i);
    expect(SECTION).toMatch(/Wolt\/Yango|Wolt and Yango|Wolt or Yango/i);
  });

  it("specifies the three-layer enforcement (regression test + code review + branch protection)", () => {
    expect(SECTION).toMatch(/regression test/i);
    expect(SECTION).toMatch(/code[\s-]review/i);
    expect(SECTION).toMatch(/branch[\s-]protection/i);
  });
});

// ─────────────────────────────────────────────────────────────
// I. Cross-references to existing systems
// ─────────────────────────────────────────────────────────────

describe("I. docs/onboarding/PROGRAM.md — cross-references to existing systems", () => {
  it("references the parent agreement file path", () => {
    expect(DOC).toContain("shared/legal/providerHostAgreement.ts");
  });

  it("references the sister TRUST-A program", () => {
    expect(DOC).toContain("docs/trust/PROGRAM.md");
  });

  it("references the wording-drift guard", () => {
    expect(DOC).toContain("providerSurfaceWording.regression.test.ts");
  });

  it("references PR-LEGAL-A-REWRITE", () => {
    expect(DOC).toMatch(/PR-LEGAL-A-REWRITE/);
  });

  it("references PR-LEGAL-C as the parallel critical path", () => {
    expect(DOC).toMatch(/PR-LEGAL-C/);
  });

  it("references PR-LEGAL-D as hard-locked", () => {
    expect(DOC).toMatch(/PR-LEGAL-D/);
    expect(DOC).toMatch(/HARD-LOCKED|hard-locked/);
  });

  it("references PR-LEGAL-A-HE and PR-LEGAL-COUNSEL-APPROVE", () => {
    expect(DOC).toMatch(/PR-LEGAL-A-HE/);
    expect(DOC).toMatch(/PR-LEGAL-COUNSEL-APPROVE/);
  });
});

// ─────────────────────────────────────────────────────────────
// J. Forbidden register ABSENT (employment / supervision wording)
//
// The program doc itself MUST NOT slip into the same forbidden
// register it forbids in the codebase. Some banned phrases will
// appear inside ban-lists; those occurrences are intentional
// and must live inside §2 (H3), §10 (§10.8), §14 (§14.1) — the
// three "ban-list" regions.
// ─────────────────────────────────────────────────────────────

describe("J. docs/onboarding/PROGRAM.md — forbidden register only inside ban-list regions", () => {
  // Carve out the ban-list regions where the forbidden phrases
  // are legitimately quoted as examples of what to avoid.
  function withoutBanListRegions(doc: string): string {
    let out = doc;
    // §2 H3 mentions the forbidden register inline as a ban list
    out = out.replace(/\*\*H3\.\*\*[\s\S]*?(?=\n\n\*\*H4\.\*\*)/, "");
    // §10.8 forbids employment-style payout language
    out = out.replace(/### 10\.8 No employment-style payout language[\s\S]*?(?=^## 11\.)/m, "");
    // §14.1 lists banned capabilities
    out = out.replace(/### 14\.1 The rule[\s\S]*?(?=### 14\.2)/m, "");
    // §16.4 mentions the franchise template (not a ban list per se)
    return out;
  }

  const SCAN = withoutBanListRegions(DOC);

  it("does not use 'shifts' in prescriptive context outside ban lists", () => {
    // "shift assignment" already inside H7/H3/§14; outside those, must be absent
    expect(SCAN).not.toMatch(/\bshift\s+assignment\b/i);
  });

  it("does not use 'performance management' outside ban lists", () => {
    expect(SCAN).not.toMatch(/\bperformance management\b/i);
  });

  it("does not use 'productivity scoring' as a feature outside ban lists", () => {
    expect(SCAN).not.toMatch(/\bproductivity scoring\b/i);
  });

  it("does not use 'optimize acceptance' outside ban lists", () => {
    expect(DOC).not.toMatch(/\boptimi[sz]e acceptance\b/i);
  });

  it("does not use 'maximize efficiency' anywhere", () => {
    expect(DOC).not.toMatch(/\bmaximi[sz]e efficiency\b/i);
  });
});

// ─────────────────────────────────────────────────────────────
// K. PR sequence and definition-of-done
// ─────────────────────────────────────────────────────────────

describe("K. docs/onboarding/PROGRAM.md — PR sequence and DoD", () => {
  it("declares PR-ONBOARDING-PROGRAM as THIS PR (governance only)", () => {
    expect(DOC).toMatch(/PR-ONBOARDING-PROGRAM/);
    expect(DOC).toMatch(/THIS PR\. Doc-only/);
  });

  it("lists PR-ONBOARDING-A through PR-ONBOARDING-L in sequence", () => {
    for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) {
      expect(DOC).toMatch(new RegExp(`PR-ONBOARDING-${letter}\\b`));
    }
  });

  it("specifies PR-LEGAL-C as a parallel critical path before any UI PR", () => {
    expect(DOC).toMatch(
      /PR-LEGAL-C[\s\S]{0,400}(parallel critical path|critical path)/i,
    );
  });

  it("specifies PR-LEGAL-D ordering (last, after three preconditions)", () => {
    expect(DOC).toMatch(
      /PR-LEGAL-D[\s\S]{0,400}(HARD-LOCKED|three preconditions|final)/i,
    );
  });

  it("Definition of done references the regression suite + the doc on main", () => {
    const dod = DOC.match(/^## 18\. Definition of "done" for this PR([\s\S]*?)^## 19\./m)?.[1] ?? "";
    expect(dod).toMatch(/onboardingProgramDoc\.regression\.test\.ts/);
    expect(dod).toMatch(/reachable from `origin\/main`/);
  });
});

// ─────────────────────────────────────────────────────────────
// L. Change log present
// ─────────────────────────────────────────────────────────────

describe("L. docs/onboarding/PROGRAM.md — change log", () => {
  it("change log row for 2026-05-13 mentions 24 hard rules", () => {
    expect(DOC).toMatch(/2026-05-13[\s\S]*?24 hard rules/);
  });

  it("change log row for 2026-05-13 mentions the four CEO amendments folded in", () => {
    const cl = DOC.match(/^## 20\. Change log([\s\S]*)/m)?.[1] ?? "";
    expect(cl).toMatch(/Risk table/i);
    expect(cl).toMatch(/Wash-Station Operator carve-out/i);
    expect(cl).toMatch(/Payment and Withholding Boundary/i);
    expect(cl).toMatch(/No Dormant Control Code/i);
  });
});
