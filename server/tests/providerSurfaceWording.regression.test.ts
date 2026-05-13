/**
 * PR-LEGAL-UI-SCRUB — Provider-surface wording regression suite.
 *
 * This is a LEGAL-RISK ALIGNMENT guard, not a cosmetic style
 * check. It ensures that provider-facing surfaces (dashboards,
 * the provider console, driver dashboards, the AI insight
 * prompt, and the driver contractor template) do NOT contain
 * operational-control wording that would create integration-
 * test evidence against Pet Wash Ltd's §2 independent-
 * contractor cushion in the Provider & Host Services Agreement.
 *
 * Locked CEO vocabulary:
 *   Allowed:  activity, usage, trends, insights, booking
 *             history, customer feedback, safety indicators,
 *             account health, platform integrity
 *   Avoid:    performance management, productivity, efficiency,
 *             optimization, behavioural scoring, acceptance
 *             targets, completion targets, dispatch ranking,
 *             provider ranking, supervision wording
 *
 * Sister suite to insuranceConsistency.regression.test.ts.
 *
 * Scope: WORDING ONLY. Variable names like `acceptanceRate`
 * (camelCase, no space) are NOT scanned because they are
 * backend field names from the API response and are not
 * shown to providers. The forbidden patterns require a SPACE
 * inside the phrase, which excludes camelCase matches.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import path, { resolve, join, sep } from "path";

const ROOT = resolve(__dirname, "..", "..");

// ─────────────────────────────────────────────────────────────
// Watch list — six surfaces that this PR scrubbed.
// Each MUST stay clean of FORBIDDEN_OPERATIONAL_CONTROL phrases
// and MUST contain the new neutral wording.
// ─────────────────────────────────────────────────────────────

const WATCH_FILES: ReadonlyArray<string> = [
  "client/src/pages/WalkerDashboard.tsx",
  "client/src/pages/contractor/Dashboard.tsx",
  "client/src/pages/pettrek/DriverDashboard.tsx",
  "client/src/pages/ProviderConsole.tsx",
  "client/src/pages/provider-os/POSProfile.tsx",
  "server/templates/contracts/driver_contractor_agreement.md",
];

// Broader sweep — provider-facing pages directory + contracts
// templates directory. Catches future drift in any new dashboard
// added to client/src/pages or any new contract added to
// server/templates/contracts.
const SWEEP_ROOTS: ReadonlyArray<string> = [
  "client/src/pages",
  "server/templates/contracts",
];

const SWEEP_EXTS = new Set([".ts", ".tsx", ".md"]);

const SWEEP_ALLOWLIST: ReadonlyArray<string> = [
  // This regression test contains the forbidden phrases as
  // string literals being asserted-against. Exempt.
  "server/tests/providerSurfaceWording.regression.test.ts",
  // PlatformShowcase.tsx — the only "performance metrics" match
  // here is the literal "Custom application performance metrics"
  // referring to Prometheus infrastructure observability for the
  // platform itself. This is SRE / DevOps telemetry, NOT provider
  // performance scoring. Different legal/evidentiary domain.
  "client/src/pages/PlatformShowcase.tsx",
  // CompanyReports.tsx — "Team Productivity Report" is the name
  // of an internal HR report module for Pet Wash company
  // EMPLOYEES, not for independent providers/contractors.
  // Different legal/evidentiary domain.
  "client/src/pages/CompanyReports.tsx",
  // franchise_master_agreement.md — Franchise agreements are a
  // distinct commercial form from independent-contractor
  // agreements under Israeli law. Performance standards in a
  // franchise context are not the same Wolt/Yango integration
  // evidence concern. Flagged for separate Counsel review under
  // a future PR-LEGAL-FRANCHISE if needed.
  "server/templates/contracts/franchise_master_agreement.md",
];

// ─────────────────────────────────────────────────────────────
// Comment / string scrubbing (lifted shape from PR-LEGAL-B)
//
// Strips JS / TS / TSX / JSX comments so cleanup-provenance
// comments do not produce false positives. Markdown is returned
// RAW because contract templates are written in plain prose.
// String literal contents are PRESERVED so a forbidden phrase
// inside a JSX label is caught.
// ─────────────────────────────────────────────────────────────

function sourceForWordingScan(src: string, isMarkdown: boolean): string {
  if (isMarkdown) return src;

  const n = src.length;
  let out = "";
  let i = 0;
  let inString: '"' | "'" | "`" | null = null;

  while (i < n) {
    const c = src[i];

    if (inString) {
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

    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i + 2);
      if (end < 0) {
        i = n;
      } else {
        out += "\n";
        i = end + 1;
      }
      continue;
    }
    if (c === "{" && next === "/" && after === "*") {
      const end = src.indexOf("*/}", i + 3);
      i = end < 0 ? n : end + 3;
      continue;
    }
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

function readScrubbed(absPath: string): string {
  const src = readFileSync(absPath, "utf8");
  return sourceForWordingScan(src, absPath.endsWith(".md"));
}

function walkSwept(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    if (name === "node_modules" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkSwept(full, out);
      continue;
    }
    if (name.includes(".test.") || name.includes(".regression.")) continue;
    const dot = name.lastIndexOf(".");
    if (dot < 0) continue;
    if (!SWEEP_EXTS.has(name.slice(dot))) continue;
    out.push(full);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// FORBIDDEN operational-control phrases (CEO-locked list).
//
// Each phrase requires inter-word spacing — this guarantees we
// do NOT false-positive on camelCase backend field names like
// `acceptanceRate` or `performanceMonitor`. Variable names stay
// untouched; only user-visible wording is policed.
// ─────────────────────────────────────────────────────────────

interface ForbiddenWording {
  readonly id: string;
  readonly pattern: RegExp;
  readonly reason: string;
}

const FORBIDDEN_OPERATIONAL_CONTROL: ReadonlyArray<ForbiddenWording> = [
  {
    id: "PERFORMANCE_METRICS",
    pattern: /\bperformance\s+metrics?\b/i,
    reason: "reads as workforce performance scoring (integration evidence)",
  },
  {
    id: "ACCEPTANCE_RATE",
    pattern: /\bacceptance\s+rate\b/i,
    reason: "reads as enforced booking-acceptance target (integration evidence)",
  },
  {
    id: "PRODUCTIVITY",
    pattern: /\bproductivity\b/i,
    reason: "workforce-productivity register; suggests supervision",
  },
  {
    id: "ROUTE_OPTIMIZATION",
    pattern: /\broute\s+optimi[sz]ation\b/i,
    reason: "implies dispatch control over an independent contractor",
  },
  {
    id: "DISPATCH_PRIORITY",
    pattern: /\bdispatch\s+priority\b/i,
    reason: "implies ranking and dispatch supervision",
  },
  {
    id: "BEHAVIOURAL_ANALYTICS_UK",
    pattern: /\bbehavioural\s+analytics\b/i,
    reason: "behavioural scoring of independent contractors",
  },
  {
    id: "BEHAVIORAL_ANALYTICS_US",
    pattern: /\bbehavioral\s+analytics\b/i,
    reason: "behavioural scoring of independent contractors",
  },
  {
    id: "OPTIMIZE_PERFORMANCE",
    pattern: /\boptimi[sz]e\s+performance\b/i,
    reason: "directive performance-improvement language",
  },
  {
    id: "MAXIMIZE_EFFICIENCY",
    pattern: /\bmaximi[sz]e\s+efficiency\b/i,
    reason: "workforce-efficiency register",
  },
];

// ─────────────────────────────────────────────────────────────
// 1. Targeted assertions on the six surfaces this PR scrubbed.
// ─────────────────────────────────────────────────────────────

describe("PR-LEGAL-UI-SCRUB — watched provider surfaces are clean", () => {
  for (const rel of WATCH_FILES) {
    describe(rel, () => {
      const abs = path.join(ROOT, rel);

      it("file exists", () => {
        expect(existsSync(abs)).toBe(true);
      });

      const scrubbed = existsSync(abs) ? readScrubbed(abs) : "";

      for (const rule of FORBIDDEN_OPERATIONAL_CONTROL) {
        it(`does NOT contain forbidden phrase ${rule.id} (${rule.reason})`, () => {
          expect(scrubbed).not.toMatch(rule.pattern);
        });
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. Broader sweep — provider-facing page tree + contracts.
// Future-proofs the scrub against new dashboards.
// ─────────────────────────────────────────────────────────────

describe("PR-LEGAL-UI-SCRUB — broader sweep of provider/driver surfaces", () => {
  const sweptFiles: string[] = SWEEP_ROOTS.flatMap((r) =>
    walkSwept(resolve(ROOT, r)),
  ).filter((full) => {
    const rel = full.slice(ROOT.length + 1).split(sep).join("/");
    return !SWEEP_ALLOWLIST.includes(rel);
  });

  it("the sweep discovered at least 5 files", () => {
    expect(sweptFiles.length).toBeGreaterThanOrEqual(5);
  });

  for (const rule of FORBIDDEN_OPERATIONAL_CONTROL) {
    it(`no swept file contains forbidden phrase ${rule.id}`, () => {
      const offenders: string[] = [];
      for (const abs of sweptFiles) {
        const scrubbed = readScrubbed(abs);
        if (rule.pattern.test(scrubbed)) {
          const rel = abs.slice(ROOT.length + 1).split(sep).join("/");
          offenders.push(rel);
        }
      }
      expect(offenders, `offenders for ${rule.id}: ${offenders.join(", ")}`).toEqual([]);
    });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Positive assertions — the neutral replacement wording is
// present where this PR put it. Locks the rename so a future
// commit cannot silently regress.
// ─────────────────────────────────────────────────────────────

describe("PR-LEGAL-UI-SCRUB — neutral replacement wording present", () => {
  it("WalkerDashboard uses 'Platform Activity Overview' (EN + HE)", () => {
    const src = readFileSync(
      path.join(ROOT, "client/src/pages/WalkerDashboard.tsx"),
      "utf8",
    );
    expect(src).toContain("Platform Activity Overview");
    expect(src).toContain("סקירת פעילות פלטפורמה");
  });

  it("contractor/Dashboard uses 'Platform Activity Overview'", () => {
    const src = readFileSync(
      path.join(ROOT, "client/src/pages/contractor/Dashboard.tsx"),
      "utf8",
    );
    expect(src).toContain("Platform Activity Overview");
  });

  it("pettrek/DriverDashboard uses 'Platform Activity Overview'", () => {
    const src = readFileSync(
      path.join(ROOT, "client/src/pages/pettrek/DriverDashboard.tsx"),
      "utf8",
    );
    expect(src).toContain("Platform Activity Overview");
  });

  it("ProviderConsole uses 'Booking Activity Summary' label", () => {
    const src = readFileSync(
      path.join(ROOT, "client/src/pages/ProviderConsole.tsx"),
      "utf8",
    );
    expect(src).toContain("Booking Activity Summary");
  });

  it("ProviderConsole AI prompt is informational (no 'improve my business' / 'actionable suggestions')", () => {
    const src = readFileSync(
      path.join(ROOT, "client/src/pages/ProviderConsole.tsx"),
      "utf8",
    );
    expect(src).toContain("informational insights");
    expect(src).toContain("platform usage trends");
    expect(src).toContain("Insights only");
    expect(src).not.toMatch(/improve my business/i);
    expect(src).not.toMatch(/actionable suggestions/i);
  });

  it("provider-os/POSProfile uses 'Booking Activity Summary'", () => {
    const src = readFileSync(
      path.join(ROOT, "client/src/pages/provider-os/POSProfile.tsx"),
      "utf8",
    );
    expect(src).toContain("Booking Activity Summary");
  });

  it("driver_contractor_agreement uses 'navigation and trip-support tools' (not route optimization)", () => {
    const src = readFileSync(
      path.join(ROOT, "server/templates/contracts/driver_contractor_agreement.md"),
      "utf8",
    );
    expect(src).toContain("navigation and trip-support tools");
    expect(src).not.toMatch(/route optimi[sz]ation/i);
  });
});
