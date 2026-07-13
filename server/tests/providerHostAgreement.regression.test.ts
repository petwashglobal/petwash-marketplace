/**
 * PR-LEGAL-A — Provider & Host Services Agreement regression suite.
 *
 * Pins the bilingual source-of-truth module at
 * shared/legal/providerHostAgreement.ts.
 *
 * The legal-sufficiency of the agreement under any specific
 * statute is COUNSEL-TO-CONFIRM. This test does NOT assert
 * legal sufficiency. It enforces only:
 *
 *   A. Module shape + the three verification gates
 *   B. English body — 16 sections, verbatim CEO text, §8
 *      mandatory phrase present, §8 disclaimer language
 *      present
 *   C. Hebrew body — preserved raw, NOT verified, runtime
 *      fallback to English
 *   D. FORBIDDEN_PATTERNS — no insurance promises, sums,
 *      coverage guarantees, or claim-approval language in
 *      the scaffolding (comments, types, helpers). The body
 *      text itself contains the word "insurance" inside the
 *      §8 disclaimer — that is correct and required.
 *   E. Boundary scan — no protected-system imports
 *   F. Helper behaviour — getAgreementBody falls back to
 *      English when Hebrew is unverified
 *
 * Counsel-review checklist (must pass before
 * PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED flips to true):
 *   - byte-for-byte EN text matches the legal source PDF
 *   - HE verified prose body is supplied, contains all 16
 *     sections, and includes the §8 mandatory phrase
 *   - §8 disclaimer wording is acceptable in both languages
 *   - PROVIDER_HOST_AGREEMENT_VERSION reflects the
 *     reviewed text
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  PROVIDER_HOST_AGREEMENT_VERSION,
  PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED,
  PROVIDER_HOST_AGREEMENT_EN_VERIFIED,
  PROVIDER_HOST_AGREEMENT_HE_VERIFIED,
  PROVIDER_HOST_AGREEMENT_SOURCE,
  PROVIDER_HOST_AGREEMENT_EN,
  PROVIDER_HOST_AGREEMENT_HE,
  PROVIDER_HOST_AGREEMENT_HE_RAW,
  getAgreementBody,
  getEffectiveLanguage,
  type AgreementBody,
  type AgreementSection,
  type AgreementLanguage,
} from "../../shared/legal/providerHostAgreement";

const ROOT = resolve(__dirname, "..", "..");
const SOURCE_PATH = resolve(
  ROOT,
  "shared/legal/providerHostAgreement.ts",
);
const SOURCE = readFileSync(SOURCE_PATH, "utf8");

/** Strip comments + string literals from a TS source so a regex
 *  scan only matches code, not in-file text content. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

const SOURCE_CODE_ONLY = codeOnly(SOURCE);

// ─────────────────────────────────────────────────────────────
// A. Module shape + verification gates
// ─────────────────────────────────────────────────────────────

describe("A. providerHostAgreement.ts — module shape + gates", () => {
  it("source file exists", () => {
    expect(existsSync(SOURCE_PATH)).toBe(true);
  });

  it("PROVIDER_HOST_AGREEMENT_VERSION is a dated tag", () => {
    expect(PROVIDER_HOST_AGREEMENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED is FALSE (mandatory default)", () => {
    expect(PROVIDER_HOST_AGREEMENT_COUNSEL_APPROVED).toBe(false);
  });

  it("PROVIDER_HOST_AGREEMENT_EN_VERIFIED is TRUE", () => {
    expect(PROVIDER_HOST_AGREEMENT_EN_VERIFIED).toBe(true);
  });

  it("PROVIDER_HOST_AGREEMENT_HE_VERIFIED is FALSE (Hebrew supplied was mobile-RTL-fragmented; awaiting verified prose)", () => {
    expect(PROVIDER_HOST_AGREEMENT_HE_VERIFIED).toBe(false);
  });

  it("PROVIDER_HOST_AGREEMENT_SOURCE is the provenance tag", () => {
    expect(PROVIDER_HOST_AGREEMENT_SOURCE).toBe(
      "petwash-provider-host-agreement",
    );
  });
});

// ─────────────────────────────────────────────────────────────
// B. English body — 16 sections, verbatim, §8 disclaimer
// ─────────────────────────────────────────────────────────────

describe("B. English body", () => {
  // PR-LEGAL-A-REWRITE (May 2026): the agreement was rewritten from the old
  // 16-section, 1-indexed layout to a 23-section, 0-indexed bilingual structure.
  // Every core protection SURVIVES (verified below); the section numbering and
  // titles are the new canonical list.
  it("has exactly 23 sections", () => {
    expect(PROVIDER_HOST_AGREEMENT_EN.sections.length).toBe(23);
  });

  it("sections are numbered 0..22 in order", () => {
    const ids = PROVIDER_HOST_AGREEMENT_EN.sections.map((s) => s.id);
    expect(ids).toEqual([
      "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11",
      "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22",
    ]);
  });

  it("section titles match the canonical list (verbatim)", () => {
    const titles = PROVIDER_HOST_AGREEMENT_EN.sections.map((s) => s.title);
    expect(titles).toEqual([
      "DEFINITIONS",
      "PLATFORM ROLE",
      "INDEPENDENT CONTRACTOR STATUS",
      "PROVIDER RESPONSIBILITY",
      "ANIMAL WELFARE AND DOG SUPERVISION",
      "HOST AND HOME-BASED SERVICES",
      "INSURANCE DISCLAIMER",
      "PRIVACY AND PERSONAL DATA",
      "NON-DISCRIMINATION AND ACCESSIBILITY",
      "TAX, BUSINESS AND LEGAL COMPLIANCE",
      "PAYMENTS AND PLATFORM FEES",
      "VERIFICATION AND SAFETY CHECKS",
      "CUSTOMER RELATIONSHIP",
      "INTELLECTUAL PROPERTY AND CONTENT LICENCE",
      "ACCOUNT SUSPENSION AND TERMINATION",
      "LIMITATION OF LIABILITY",
      "MODIFICATIONS AND EFFECTIVE DATE",
      "GOVERNING LAW AND JURISDICTION",
      "DISPUTE RESOLUTION",
      "LANGUAGE PRECEDENCE",
      "NOTICES AND CONTACTS",
      "SEVERABILITY",
      "DIGITAL ACCEPTANCE",
    ]);
  });

  it("every section body is non-empty", () => {
    for (const s of PROVIDER_HOST_AGREEMENT_EN.sections) {
      expect(s.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("document title is the canonical bilingual header", () => {
    expect(PROVIDER_HOST_AGREEMENT_EN.title).toBe(
      "PET WASH LTD — PROVIDER & HOST SERVICES AGREEMENT",
    );
  });

  it("lastUpdated is the supplied stamp", () => {
    expect(PROVIDER_HOST_AGREEMENT_EN.lastUpdated).toBe("May 2026");
  });

  // §8 MANDATORY PHRASE — the consistency anchor across the
  // platform. Every other UI surface that mentions insurance
  // must co-locate this exact phrase per PROGRAM.md / Gate-1
  // mandatory-phrase rule.
  // INSURANCE DISCLAIMER is now §6 (id "6"). The mandatory anchor phrase survives
  // and is STRENGTHENED — it now also names "insurance agent" (…company, broker,
  // agent or adviser). Tolerate the added word so the guard still fires but isn't
  // brittle to the stronger wording.
  it("§6 contains the mandatory 'not insurance company/broker/(agent/)adviser' phrase", () => {
    const s = PROVIDER_HOST_AGREEMENT_EN.sections.find((x) => x.id === "6");
    expect(s).toBeDefined();
    expect(s!.body).toMatch(
      /Pet Wash Ltd is not an insurance company, insurance broker,(?: insurance agent,?)? (?:or )?insurance adviser\./,
    );
  });

  it("§6 explicitly denies any guarantee that a claim will be approved or covered", () => {
    const s = PROVIDER_HOST_AGREEMENT_EN.sections.find((x) => x.id === "6");
    // New prose: "…guarantees that any claim, loss, damage … will be covered" and
    // "Pet Wash does not guarantee claim approval or payment."
    expect(s!.body).toMatch(/any claim[^.]*will be covered/);
    expect(s!.body).toMatch(/does not guarantee claim approval or payment/);
  });

  it("§6 explicitly preserves the Provider's own insurance obligation", () => {
    const s = PROVIDER_HOST_AGREEMENT_EN.sections.find((x) => x.id === "6");
    expect(s!.body).toMatch(
      /Providers remain solely responsible for obtaining and maintaining any insurance required by law/,
    );
  });

  it("§2 declares independent contractor status, not employee", () => {
    const s2 = PROVIDER_HOST_AGREEMENT_EN.sections.find((s) => s.id === "2");
    expect(s2!.body).toMatch(/independent contractor/i);
    // New prose: "not as an employee …" + "Nothing in this Agreement creates an
    // employment relationship …" — the not-an-employer guarantee is preserved.
    expect(s2!.body).toMatch(/not as an employee/i);
    expect(s2!.body).toMatch(/creates an employment relationship/i);
  });

  it("§9 mentions both Israeli business types verbatim", () => {
    // TAX, BUSINESS AND LEGAL COMPLIANCE is now §9 (id "9").
    const s = PROVIDER_HOST_AGREEMENT_EN.sections.find((x) => x.id === "9");
    expect(s!.body).toContain("עוסק פטור");
    expect(s!.body).toContain("עוסק מורשה");
  });

  it("§22 mentions IP address, timestamps and digital acceptance as evidence", () => {
    // DIGITAL ACCEPTANCE is now §22 (id "22").
    const s = PROVIDER_HOST_AGREEMENT_EN.sections.find((x) => x.id === "22");
    expect(s!.body).toMatch(/IP address/i);
    expect(s!.body).toMatch(/timestamp/i);
    expect(s!.body).toMatch(/digital(?:ly)? (?:acceptance|signing)/i);
  });

  it("§17 declares Israeli governing law", () => {
    // GOVERNING LAW AND JURISDICTION is now §17 (id "17").
    const s = PROVIDER_HOST_AGREEMENT_EN.sections.find((x) => x.id === "17");
    expect(s!.body).toMatch(/laws of the State of Israel/);
  });
});

// ─────────────────────────────────────────────────────────────
// C. Hebrew body — raw, NOT verified, fallback to English
// ─────────────────────────────────────────────────────────────

describe("C. Hebrew body — unverified raw", () => {
  it("PROVIDER_HOST_AGREEMENT_HE is null until verified prose lands", () => {
    expect(PROVIDER_HOST_AGREEMENT_HE).toBeNull();
  });

  it("PROVIDER_HOST_AGREEMENT_HE_RAW preserves the supplied raw text verbatim", () => {
    expect(PROVIDER_HOST_AGREEMENT_HE_RAW.status).toBe("raw-unverified");
    expect(PROVIDER_HOST_AGREEMENT_HE_RAW.lang).toBe("he");
    // The raw text MUST contain Hebrew characters (proof the
    // user-supplied text was preserved at all).
    expect(PROVIDER_HOST_AGREEMENT_HE_RAW.rawSupplied).toMatch(/[֐-׿]/);
  });

  it("PROVIDER_HOST_AGREEMENT_HE_RAW carries a clear awaiting-verified note", () => {
    // The note now explains the mobile-RTL paste problem and that HE_VERIFIED
    // must stay false until Counsel verifies the HE_DRAFT prose — same intent
    // (raw Hebrew is NOT display-ready / awaiting verified prose).
    expect(PROVIDER_HOST_AGREEMENT_HE_RAW.notes).toMatch(
      /must remain false until\s+Counsel verifies/,
    );
  });

  it("requesting Hebrew falls back to English while HE is unverified", () => {
    const body = getAgreementBody("he" as AgreementLanguage);
    expect(body).toBe(PROVIDER_HOST_AGREEMENT_EN);
  });

  it("requesting English returns the English body", () => {
    const body = getAgreementBody("en" as AgreementLanguage);
    expect(body).toBe(PROVIDER_HOST_AGREEMENT_EN);
  });

  it("getEffectiveLanguage reports 'en' when Hebrew is requested but unverified", () => {
    expect(getEffectiveLanguage("he" as AgreementLanguage)).toBe("en");
    expect(getEffectiveLanguage("en" as AgreementLanguage)).toBe("en");
  });
});

// ─────────────────────────────────────────────────────────────
// D. FORBIDDEN_PATTERNS — scaffolding scan (no marketing
//    insurance promises in comments / types / helpers).
//    The §8 body legitimately mentions insurance in the
//    disclaimer form; that is correct and required.
// ─────────────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [
  /fully insured/i,
  /covered by us/i,
  /guaranteed protection/i,
  /we insure providers/i,
  /all damages covered/i,
  /insured platform/i,
  /comprehensive coverage/i,
  /claim guaranteed/i,
  /up to \$\s*\d+/i,
  /up to ₪\s*\d+/i,
  /\$\s*\d+\s*(M|million)\s+coverage/i,
  /₪\s*\d+\s*(M|million|מיליון)/i,
];

describe("D. scaffolding scan (FORBIDDEN_PATTERNS)", () => {
  // Strip the agreement body literals so a regex doesn't
  // false-positive on the §8 disclaimer's own use of the
  // word "insurance".
  for (const pattern of FORBIDDEN_PATTERNS) {
    it(`source code must not contain ${pattern}`, () => {
      expect(SOURCE_CODE_ONLY).not.toMatch(pattern);
    });
  }

  it("no in-file claim that the agreement is binding under any specific statute", () => {
    // Per CEO directive C5: do not assert legal basis as final
    // fact in code comments. The file may MENTION statutes (e.g.
    // 'Israeli Electronic Transactions Law') but must do so as
    // 'Counsel-to-confirm', not as a binding assertion.
    expect(SOURCE).not.toMatch(
      /is legally binding under [A-Za-z][^.]*\bLaw\b/i,
    );
    expect(SOURCE).not.toMatch(
      /this Agreement satisfies [A-Za-z][^.]*\bLaw\b/i,
    );
    expect(SOURCE).not.toMatch(
      /(?:is|are)\s+compliant\s+with\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Law\s+\d{4}/,
    );
  });
});

// ─────────────────────────────────────────────────────────────
// E. Boundary scan — no protected-system imports
// ─────────────────────────────────────────────────────────────

const FORBIDDEN_IMPORTS: ReadonlyArray<RegExp> = [
  // auth
  /\bvalidateFirebaseToken\b/,
  /\brequireAdmin\b/,
  /\brequireBrainAccess\b/,
  /\bisSuperAdmin\b/,
  /\brbac\b/,

  // payment / wallet
  /\bnayax\b/i,
  /\btranzila\b/i,
  /\bstripe\b/i,
  /\bsumit\b/i,
  /\bupay\b/i,
  /\bWalletService\b/,
  /\bBillingEngine\b/,
  /\bAuditLedgerService\b/,

  // K9000 hardware
  /\bk9000\b/i,
  /\bstationHeartbeat\b/i,

  // schema / persistence
  /\bdrizzle-orm\b/,
  /\bpgTable\b/,
  /\bfirebase-admin\b/,
  /\bfirestore\b/i,

  // Google Places / live geocoding
  /\bgoogle\.maps\b/,
  /\bGooglePlacesAutocomplete\b/,
  /\b\/api\/google\/places/,
  /\b\/api\/google\/reverse-geocode/,

  // Google Sheets / Drive / GCS
  /\bgoogleSheetsIntegration\b/,
  /\bgoogleDriveBackupService\b/,
  /\b@google-cloud\/storage\b/,

  // UI frameworks (data-layer file must not import UI)
  /\bfrom\s+["']react["']/,
  /\bfrom\s+["']express["']/,
  /\bfrom\s+["']wouter["']/,

  // network call sites
  /\bfetch\s*\(/,
  /\baxios\b/,
  /\bXMLHttpRequest\b/,

  // No geolocation / IP auto-fill
  /\bnavigator\.geolocation\b/,
  /\bipinfo\b/i,
  /\bgeoip\b/i,
];

describe("E. boundary scan — protected systems untouched", () => {
  for (const pattern of FORBIDDEN_IMPORTS) {
    it(`module must not contain ${pattern}`, () => {
      expect(SOURCE_CODE_ONLY).not.toMatch(pattern);
    });
  }

  it("declares no Drizzle table", () => {
    expect(SOURCE_CODE_ONLY).not.toMatch(/pgTable\s*\(/);
  });

  it("declares no Express router", () => {
    expect(SOURCE_CODE_ONLY).not.toMatch(/Router\s*\(/);
  });

  it("declares no class", () => {
    expect(SOURCE_CODE_ONLY).not.toMatch(/^class\b/m);
    expect(SOURCE_CODE_ONLY).not.toMatch(/export\s+class\b/);
  });

  it("exports exactly two functions (getAgreementBody + getEffectiveLanguage)", () => {
    const fnExports = SOURCE_CODE_ONLY.match(/export\s+function\s+\w+/g) ?? [];
    expect(fnExports.length).toBe(2);
    expect(SOURCE_CODE_ONLY).toMatch(
      /export\s+function\s+getAgreementBody\b/,
    );
    expect(SOURCE_CODE_ONLY).toMatch(
      /export\s+function\s+getEffectiveLanguage\b/,
    );
  });
});

// ─────────────────────────────────────────────────────────────
// F. Type-shape sanity (interfaces compile against sentinels)
// ─────────────────────────────────────────────────────────────

describe("F. type shape", () => {
  it("AgreementSection has id / title / body", () => {
    const s: AgreementSection = {
      id: "1",
      title: "ABOUT PET WASH",
      body: "x",
    };
    expect(s.id).toBe("1");
  });

  it("AgreementBody has title / lastUpdated / sections", () => {
    const b: AgreementBody = {
      title: "x",
      lastUpdated: "y",
      sections: [],
    };
    expect(b.title).toBe("x");
  });

  it("AgreementLanguage is exactly 'en' | 'he'", () => {
    const en: AgreementLanguage = "en";
    const he: AgreementLanguage = "he";
    expect([en, he]).toEqual(["en", "he"]);
  });
});
