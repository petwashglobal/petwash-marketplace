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
 * Strip JS/TS/HTML/markdown comments AND string literals so
 * the regex scan only matches CODE. Comments documenting the
 * PR-LEGAL-B cleanup ("previously fully insured ...") would
 * otherwise produce false positives.
 *
 * For markdown the strip is more conservative — markdown
 * doesn't have JS-style comments. We rely on the fact that
 * the dangerous markdown lines are in contract-template
 * bodies and have been edited in this PR. The scan will see
 * any remaining body line.
 */
function stripCommentsAndStrings(src: string, isMarkdown: boolean): string {
  if (isMarkdown) {
    // Strip HTML comments only; leave body text intact.
    return src.replace(/<!--[\s\S]*?-->/g, "");
  }
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

function readScrubbed(path: string): string {
  const src = readFileSync(path, "utf8");
  const isMd = path.endsWith(".md");
  return stripCommentsAndStrings(src, isMd);
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
