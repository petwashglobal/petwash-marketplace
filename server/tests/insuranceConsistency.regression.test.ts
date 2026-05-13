/**
 * PR-LEGAL-B — Insurance-consistency regression suite.
 *
 * Locks the §8 disclaimer in PR-LEGAL-A (#246):
 *
 *   "Pet Wash Ltd is not an insurance company, insurance
 *    broker or insurance adviser."
 *
 * Scans every consumer-facing source file under:
 *   client/src/
 *   server/templates/contracts/
 *   server/email/templates/
 *   firebase-email-templates/
 *
 * Fails LOUDLY if any of the following EVER appears in CODE
 * (comment lines are stripped before scanning so cleanup-
 * provenance comments do not cause false positives):
 *
 *   - "fully insured" / equivalents
 *   - "covered by us" / "protected by us"
 *   - "guaranteed protection" / "guaranteed coverage"
 *   - "comprehensive coverage" / "comprehensive protection"
 *   - "Pet Wash provides ... coverage / liability"
 *   - "Covered by PetWash" / "PetWash Protect" /
 *     "PetWash Accident Cover"
 *   - "Harel Insurance" / "הראל ביטוח" — the previously
 *     hard-coded underwriter
 *   - PW-2026-IL-001 — the previously hard-coded policy
 *   - "₪Xm" / "₪X million" / "$X million" coverage claims
 *
 * The agreement source file itself
 * (shared/legal/providerHostAgreement.ts) is ALLOWLISTED
 * because its §8 body legitimately uses the word "insurance"
 * in the disclaimer form. Other files that mention insurance
 * MUST do so in a §8-aligned way (the canonical disclaimer
 * wording or an operational/KYC context).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { resolve, join, sep } from "path";

const ROOT = resolve(__dirname, "..", "..");

// ─────────────────────────────────────────────────────────────
// File discovery
// ─────────────────────────────────────────────────────────────

const SCAN_ROOTS = [
  "client/src",
  "server/templates/contracts",
  "server/email/templates",
  "firebase-email-templates",
] as const;

const SCAN_EXTS = new Set([".ts", ".tsx", ".md", ".html"]);

// Files exempt from the §8 scan. The agreement body itself
// legitimately uses the word "insurance" in disclaimer form.
const ALLOWLIST_PATHS: ReadonlyArray<string> = [
  "shared/legal/providerHostAgreement.ts",
  // Operational / KYC contexts: these UPLOAD an insurance
  // certificate as a KYC document. They do not promise
  // coverage.
  "client/src/components/KYCUpload.tsx",
  "client/src/components/OnboardingVerification.tsx",
  // The regression test file itself contains the forbidden
  // patterns as string literals being tested. Exempt.
  "server/tests/insuranceConsistency.regression.test.ts",
];

function walkSource(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    if (name === "node_modules" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkSource(full, out);
      continue;
    }
    if (name.includes(".test.") || name.includes(".regression.")) {
      continue;
    }
    const dot = name.lastIndexOf(".");
    if (dot < 0) continue;
    const ext = name.slice(dot);
    if (!SCAN_EXTS.has(ext)) continue;
    out.push(full);
  }
  return out;
}

const SCAN_FILES: ReadonlyArray<string> = SCAN_ROOTS
  .flatMap((rel) => walkSource(resolve(ROOT, rel)))
  .filter((full) => {
    const rel = full.slice(ROOT.length + 1).split(sep).join("/");
    return !ALLOWLIST_PATHS.includes(rel);
  });

// ─────────────────────────────────────────────────────────────
// Comment / string stripping
// ─────────────────────────────────────────────────────────────

/**
 * Source preparation for the insurance-phrase scan.
 *
 * Strips JS / TS / TSX / JSX comments so cleanup-provenance
 * comments ("previously 'fully insured' ...") do not produce
 * false positives on the FORBIDDEN_PATTERNS scan.
 *
 * Markdown is returned RAW. Previously this helper stripped
 * HTML comments via
 *     src.replace(/<!--[\s\S]*?-->/g, "")
 * which CodeQL #188 (js/incomplete-multi-character-
 * sanitization) flagged as an unsafe sanitizer pattern.
 * The HTML comment stripper is GONE, not patched: this is
 * the safer posture because any insurance phrasing hidden
 * inside an HTML comment block now stays scannable — and
 * scanning HTML comments is exactly what we want. A
 * regulator reads HTML comments the same as body text.
 *
 * The TS / TSX stripper is a tiny state-machine parser
 * (NOT a chain of multi-character regex replaces) that:
 *   - tracks single-quote, double-quote, and template-
 *     literal string state with escape-character awareness
 *   - skips `/* … *\/` block comments outside strings
 *   - skips `//` line comments outside strings
 *   - skips `{/* … *\/}` JSX comments outside strings
 *
 * String literal contents are PRESERVED on purpose: an
 * insurance promise inside a JSX string is exactly what we
 * want this scan to catch.
 */
function sourceForInsuranceScan(src: string, isMarkdown: boolean): string {
  if (isMarkdown) {
    // Raw markdown — HTML comments included by design.
    return src;
  }

  const n = src.length;
  let out = "";
  let i = 0;
  let inString: '"' | "'" | "`" | null = null;

  while (i < n) {
    const c = src[i];

    if (inString) {
      // We are inside a string literal. Preserve every
      // character. Honour escape sequences so `\"` does not
      // close a double-quote string.
      if (c === "\\" && i + 1 < n) {
        out += c;
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (c === inString) {
        out += c;
        inString = null;
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }

    const next = src[i + 1];
    const after = src[i + 2];

    // Block comment /* … */
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }

    // Line comment //
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i + 2);
      if (end < 0) {
        i = n;
      } else {
        out += "\n"; // preserve line count for tooling
        i = end + 1;
      }
      continue;
    }

    // JSX comment {/* … */}
    if (c === "{" && next === "/" && after === "*") {
      const end = src.indexOf("*/}", i + 3);
      i = end < 0 ? n : end + 3;
      continue;
    }

    // Enter a string literal
    if (c === '"' || c === "'" || c === "`") {
      inString = c;
      out += c;
      i++;
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

// Backwards-compatible alias for any future caller that
// imports by the old name. The internal call site below uses
// the new name directly.
const stripCommentsAndStrings = sourceForInsuranceScan;

function readScrubbed(path: string): string {
  const src = readFileSync(path, "utf8");
  const isMd = path.endsWith(".md");
  return sourceForInsuranceScan(src, isMd);
}

// ─────────────────────────────────────────────────────────────
// FORBIDDEN PATTERNS
// ─────────────────────────────────────────────────────────────

interface ForbiddenPattern {
  readonly id: string;
  readonly pattern: RegExp;
  readonly reason: string;
}

const FORBIDDEN: ReadonlyArray<ForbiddenPattern> = [
  // Direct marketing-style insurance promises
  { id: "FULLY_INSURED",         pattern: /fully insured/i,                         reason: "claim that the platform fully insures" },
  { id: "COVERED_BY_US",         pattern: /covered by us\b/i,                       reason: "claim that the platform covers" },
  { id: "PROTECTED_BY_US",       pattern: /protected by us\b/i,                     reason: "claim that the platform protects" },
  { id: "GUARANTEED_PROTECTION", pattern: /guaranteed protection/i,                 reason: "guarantee of protection" },
  { id: "GUARANTEED_COVERAGE",   pattern: /guaranteed coverage/i,                   reason: "guarantee of coverage" },
  { id: "WE_INSURE_PROVIDERS",   pattern: /we insure providers/i,                   reason: "claim that the platform insures providers" },
  { id: "ALL_DAMAGES_COVERED",   pattern: /all damages covered/i,                   reason: "claim that all damages are covered" },
  { id: "INSURED_PLATFORM",      pattern: /insured platform/i,                      reason: "claim that the platform is insured" },
  { id: "PLATFORM_INSURED",      pattern: /platform insured/i,                      reason: "claim that the platform is insured" },
  { id: "COMPREHENSIVE_COVERAGE",pattern: /comprehensive coverage/i,                reason: "implies full coverage by the platform" },
  { id: "COMPREHENSIVE_PROTECT", pattern: /comprehensive protection/i,              reason: "implies full protection by the platform" },
  { id: "CLAIM_GUARANTEED",      pattern: /claim guaranteed/i,                      reason: "guarantees claim approval" },
  { id: "FULLY_COVERED",         pattern: /fully covered/i,                         reason: "claim that pets/bookings are fully covered" },

  // Pet Wash–branded insurance / protection programs
  { id: "PW_PROTECT_BRAND",      pattern: /Pet ?Wash[™]?\s*Protect/i,               reason: "PetWash-branded protection program" },
  { id: "PW_ACCIDENT_COVER",     pattern: /Pet ?Wash[™]?\s*Accident\s*Cover/i,      reason: "PetWash-branded accident cover" },
  { id: "COVERED_BY_PW",         pattern: /Covered\s+by\s+Pet ?Wash/i,              reason: "claim that PetWash covers" },
  { id: "PW_PROVIDES_COVERAGE",  pattern: /Pet ?Wash[™]?\s+provides\s+[^.\n]*\b(coverage|liability\s+coverage)\b/i,
                                                                                    reason: "claim that PetWash provides coverage" },

  // Hard-coded underwriter / policy
  { id: "HAREL_INSURANCE",       pattern: /Harel\s+Insurance/i,                     reason: "names a specific underwriter (Harel)" },
  { id: "HAREL_HE",              pattern: /הראל\s+ביטוח|הראל\s+חברה\s+לביטוח/,     reason: "names a specific underwriter (Harel, Hebrew)" },
  { id: "POLICY_NUMBER",         pattern: /PW-\d{4}-IL-\d+/,                        reason: "exposes a specific policy number" },

  // Monetary insurance claims
  { id: "ILS_M_INSURANCE",       pattern: /₪\s*\d+\s*(M|million|מיליון)/i,          reason: "monetary insurance claim in ILS" },
  { id: "USD_M_COVERAGE",        pattern: /\$\s*\d+\s*(M|million)\s+(insur|coverage|cover)/i,
                                                                                    reason: "monetary coverage claim in USD" },

  // Hebrew dangerous phrasing
  { id: "HE_MEVUTACH_BIMLOA",    pattern: /מבוטח\s+במלוא|מבוטחת\s+במלואה/,           reason: "Hebrew 'fully insured'" },
  { id: "HE_KISUI_MALE",         pattern: /כיסוי\s+מלא/,                            reason: "Hebrew 'full coverage'" },
  { id: "HE_BITUACH_MAKIF",      pattern: /ביטוח\s+מקיף/,                           reason: "Hebrew 'comprehensive insurance'" },
  { id: "HE_BITUACH_MALE",       pattern: /ביטוח\s+מלא/,                            reason: "Hebrew 'full insurance'" },
  { id: "HE_KISUI_MAKIF",        pattern: /כיסוי\s+מקיף/,                           reason: "Hebrew 'comprehensive coverage'" },
];

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("PR-LEGAL-B — insurance-consistency scan", () => {
  it("scan-root file discovery produced at least 100 files", () => {
    // Sanity: ensure the walk actually visited the trees.
    expect(SCAN_FILES.length).toBeGreaterThan(100);
  });

  for (const rule of FORBIDDEN) {
    it(`no file under scan roots contains pattern ${rule.id} (${rule.reason})`, () => {
      const hits: string[] = [];
      for (const path of SCAN_FILES) {
        const scrubbed = readScrubbed(path);
        if (rule.pattern.test(scrubbed)) {
          const rel = path.slice(ROOT.length + 1).split(sep).join("/");
          hits.push(rel);
        }
      }
      if (hits.length > 0) {
        // Surface the offending files in the failure message.
        const sample = hits.slice(0, 10).join("\n  ");
        throw new Error(
          `${rule.id} matched ${hits.length} file(s):\n  ${sample}`,
        );
      }
      expect(hits.length).toBe(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// Known-bad string anchors (specific lines we removed in this
// PR — pin them to never come back).
// ─────────────────────────────────────────────────────────────

const KNOWN_BAD_STRINGS: ReadonlyArray<{
  readonly label: string;
  readonly needle: string;
}> = [
  { label: "WalkMyPet '₪2M Insurance Coverage' title",
    needle: "₪2M Insurance Coverage" },
  { label: "WalkMyPet 'Every walker fully insured up to ₪2M'",
    needle: "Every walker fully insured up to ₪2M" },
  { label: "PetTrek 'Every trip is fully insured'",
    needle: "Every trip is fully insured" },
  { label: "Hebrew 'הסעת חיות מחמד מבוטחת במלואה'",
    needle: "הסעת חיות מחמד מבוטחת במלואה" },
  { label: "Hebrew 'כל ווקר מבוטח'",
    needle: "כל ווקר מבוטח" },
  { label: "₪10M+ insurance coverage i18n marketing claim",
    needle: "₪10M+ insurance coverage" },
  { label: "TrustSafetySection 'Every booking protected by PetWash Protect'",
    needle: "Every booking protected by PetWash Protect" },
  { label: "PlatformHub 'Pet Wash Protect covers'",
    needle: "Pet Wash Protect covers" },
  { label: "ServiceShowcase 'PetWash Protect™ guarantee'",
    needle: "PetWash Protect™ guarantee" },
  { label: "Contract template 'Pet Wash™ provides up to'",
    needle: "Pet Wash™ provides up to" },
  { label: "Policy number PW-2026-IL-001",
    needle: "PW-2026-IL-001" },
];

describe("PR-LEGAL-B — known-bad strings stay removed", () => {
  for (const item of KNOWN_BAD_STRINGS) {
    it(`removed: ${item.label}`, () => {
      const hits: string[] = [];
      for (const path of SCAN_FILES) {
        const scrubbed = readScrubbed(path);
        if (scrubbed.includes(item.needle)) {
          const rel = path.slice(ROOT.length + 1).split(sep).join("/");
          hits.push(rel);
        }
      }
      if (hits.length > 0) {
        throw new Error(
          `Known-bad string reintroduced: "${item.needle}" in:\n  ${hits.join("\n  ")}`,
        );
      }
      expect(hits.length).toBe(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// Mandatory-phrase anchor — the §8 disclaimer must remain
// available somewhere consumer-facing as the canonical
// reference text.
// ─────────────────────────────────────────────────────────────

describe("PR-LEGAL-B — §8 mandatory disclaimer remains available", () => {
  const MANDATORY_EN =
    "Pet Wash is not an insurance company, broker or adviser";
  const MANDATORY_HE =
    "אינה חברת ביטוח, סוכנות ביטוח או יועצת ביטוח";

  it("English mandatory phrase appears in at least one consumer-facing file", () => {
    const matches: string[] = [];
    for (const path of SCAN_FILES) {
      const scrubbed = readScrubbed(path);
      if (scrubbed.includes(MANDATORY_EN)) {
        matches.push(path);
      }
    }
    expect(matches.length).toBeGreaterThan(0);
  });

  it("Hebrew mandatory phrase appears in at least one consumer-facing file", () => {
    const matches: string[] = [];
    for (const path of SCAN_FILES) {
      const scrubbed = readScrubbed(path);
      if (scrubbed.includes(MANDATORY_HE)) {
        matches.push(path);
      }
    }
    expect(matches.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Allowlist sanity
// ─────────────────────────────────────────────────────────────

describe("PR-LEGAL-B — allowlist sanity", () => {
  it("agreement source file is on the allowlist", () => {
    expect(ALLOWLIST_PATHS).toContain(
      "shared/legal/providerHostAgreement.ts",
    );
  });

  it("every allowlisted path either exists or is the test file itself", () => {
    for (const rel of ALLOWLIST_PATHS) {
      const full = resolve(ROOT, rel);
      // The test file's own path is fine even if it differs
      // from the scan-root walk because we exclude
      // *.test.ts / *.regression.ts entirely.
      if (rel.endsWith(".regression.test.ts")) continue;
      expect(existsSync(full)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Source-preparation invariants (CodeQL #188 fix verification)
// ─────────────────────────────────────────────────────────────
//
// Previously the helper used
//     src.replace(/<!--[\s\S]*?-->/g, "")
// to strip HTML comments from markdown before scanning.
// CodeQL flagged this as js/incomplete-multi-character
// -sanitization. The fix REMOVED the HTML stripper entirely
// (markdown is now scanned raw) and replaced the TS/TSX
// stripper with a small state-machine parser instead of
// chained regex replaces.
//
// These tests pin the new behaviour so a future PR cannot
// silently restore the unsafe sanitiser path.

describe("PR-LEGAL-B — CodeQL #188: HTML comments are scanned, not stripped", () => {
  it("an HTML comment containing 'fully insured' is preserved (and therefore scannable)", () => {
    const sample =
      "<!-- fully insured up to ₪2M -->\n" +
      "# Heading\n" +
      "Body text.\n";
    const scrubbed = sourceForInsuranceScan(sample, /* isMarkdown */ true);
    expect(/fully insured/i.test(scrubbed)).toBe(true);
  });

  it("multiple HTML comments are all preserved (no sanitiser path collapses them)", () => {
    const sample =
      "<!-- protected by us -->\n" +
      "Body.\n" +
      "<!-- covered by us -->\n";
    const scrubbed = sourceForInsuranceScan(sample, true);
    expect(/protected by us/i.test(scrubbed)).toBe(true);
    expect(/covered by us/i.test(scrubbed)).toBe(true);
  });

  it("nested HTML comment shape is preserved as-is (no regex unwind)", () => {
    // A genuine nested sequence — the legacy regex would have
    // mishandled this. The new helper does not touch it; both
    // the inner and outer text remain visible to the scan.
    const sample = "<!-- outer <!-- inner fully insured --> trail -->\n";
    const scrubbed = sourceForInsuranceScan(sample, true);
    expect(scrubbed).toContain("fully insured");
  });

  it("Hebrew RTL phrasing inside an HTML comment is still scanned", () => {
    const sample = "<!-- ביטוח מלא -->\n# כותרת\nגוף.\n";
    const scrubbed = sourceForInsuranceScan(sample, true);
    expect(scrubbed.includes("ביטוח מלא")).toBe(true);
  });
});

describe("PR-LEGAL-B — CodeQL #188: TS/TSX comment stripper (state-machine)", () => {
  it("forbidden phrase inside a JS line comment is STRIPPED", () => {
    const sample = "// fully insured\nconst x = 1;\n";
    const scrubbed = sourceForInsuranceScan(sample, /* isMarkdown */ false);
    expect(/fully insured/i.test(scrubbed)).toBe(false);
    expect(scrubbed).toContain("const x = 1;");
  });

  it("forbidden phrase inside a JS block comment is STRIPPED", () => {
    const sample = "/* fully insured */\nconst x = 1;\n";
    const scrubbed = sourceForInsuranceScan(sample, false);
    expect(/fully insured/i.test(scrubbed)).toBe(false);
  });

  it("forbidden phrase inside a JSX comment is STRIPPED", () => {
    const sample = "<div>{/* fully insured */}</div>\n";
    const scrubbed = sourceForInsuranceScan(sample, false);
    expect(/fully insured/i.test(scrubbed)).toBe(false);
    expect(scrubbed).toContain("<div>");
  });

  it("forbidden phrase inside a double-quoted string literal is PRESERVED", () => {
    const sample = 'const x = "fully insured up to ₪2M";\n';
    const scrubbed = sourceForInsuranceScan(sample, false);
    expect(/fully insured/i.test(scrubbed)).toBe(true);
  });

  it("forbidden phrase inside a single-quoted string literal is PRESERVED", () => {
    const sample = "const x = 'fully insured';\n";
    const scrubbed = sourceForInsuranceScan(sample, false);
    expect(/fully insured/i.test(scrubbed)).toBe(true);
  });

  it("forbidden phrase inside a template literal is PRESERVED", () => {
    const sample = "const x = `fully insured ${y}`;\n";
    const scrubbed = sourceForInsuranceScan(sample, false);
    expect(/fully insured/i.test(scrubbed)).toBe(true);
  });

  it("a // sequence INSIDE a string is not treated as a comment", () => {
    // The state-machine must not start comment mode while
    // inside a string literal.
    const sample = 'const url = "https://example.com/fully insured";\n';
    const scrubbed = sourceForInsuranceScan(sample, false);
    expect(/fully insured/i.test(scrubbed)).toBe(true);
  });

  it("escaped quote inside a string does not prematurely close the string", () => {
    const sample = 'const x = "she said \\"fully insured\\"";\n';
    const scrubbed = sourceForInsuranceScan(sample, false);
    expect(/fully insured/i.test(scrubbed)).toBe(true);
  });

  it("the helper does not call .replace with a multi-char sanitizer regex", () => {
    // Reflective check: scan the file's own ACTIVE code
    // (comments and string literals stripped) for an
    // .replace(/<!-- ... /, ...) call. The historical
    // pattern is allowed to appear in JSDoc comments
    // documenting WHY it was removed — but it must not
    // appear in executable code. This pins the CodeQL #188
    // fix at the source level so a future edit cannot
    // silently restore the unsafe call.
    const self = readFileSync(__filename, "utf8");
    // The same state-machine prep this file provides,
    // applied to itself, leaves only code + string
    // literals visible.
    const codeOnly = sourceForInsuranceScan(self, /* isMarkdown */ false);
    // Tests in this file use sample strings like
    // "<!-- fully insured -->" inside string literals; the
    // state-machine preserves those (we want to assert
    // their presence elsewhere). So scan for the dangerous
    // CALL shape — `.replace(/<!--` — which would only
    // appear in non-string code.
    //
    // String literals (preserved) contain things like
    //     "<!-- fully insured up to ₪2M -->"
    // but NOT the literal characters `.replace(/<!--` as a
    // contiguous sequence. So we still get a precise check.
    const restored = /\.replace\s*\(\s*\/\s*<!--/;
    expect(restored.test(codeOnly)).toBe(false);
  });
});
