/**
 * PetWash™ 2025 Preflight Guardian
 *
 * Missions:
 *  1. Block any legacy UI or old template code from reaching production
 *  2. Verify that the repo looks like the 2025 luxury codebase (not old landing)
 *  3. Check basic backup config (GCS bucket etc) is set correctly
 *  4. Give a clear, human readable report for Nir and the team
 *
 * This script is safe to run on:
 *  - Replit Shell
 *  - Local dev machines
 *  - GitHub Actions
 *
 * Run examples:
 *  - npx tsx scripts/petwash-preflight.ts
 *  - npm run preflight   (once we wire it in package.json)
 */

import * as fs from "node:fs";
import * as path from "node:path";

type ScanIssue = {
  type:
    | "LEGACY_UI"
    | "BANNED_PATTERN"
    | "MISSING_REQUIRED_FILE"
    | "CONFIG_WARNING"
    | "CONFIG_ERROR";
  file?: string;
  line?: number;
  snippet?: string;
  detail: string;
};

const projectRoot = process.cwd();

/**
 * 1 - Configuration
 * Adjust here only if needed
 */

// Directories that should be scanned for UI problems
const SCAN_DIRS = [
  "client",
  "src",
  "app",
  "pages",
  "components",
  "styles",
  "css",
].map((p) => path.join(projectRoot, p));

// File extensions to scan
const CODE_EXTS = [".tsx", ".ts", ".jsx", ".js", ".css", ".scss", ".sass"];

// Old UI markers that must never appear in production again
// You can add more phrases as you discover them
const LEGACY_UI_MARKERS: string[] = [
  "apple-package-",
  "apple-package__",
  "old-landing-hero",
  "oldLandingHero",
  "legacy-landing",
  "demo-template",
  "example-template",
  "placeholder-hero",
  "lorem ipsum",
  "tailwindui.com",
  "template from",
  "react-landing-page-template",
];

// Hard banned patterns - these always fail
const BANNED_PATTERNS: string[] = [
  // Dangerous debug code
  "console.log('DEBUG_ONLY')",
  "DEBUG_ONLY_START",
  "DEBUG_ONLY_END",

  // Local only secrets markers
  "HARDCODED_API_KEY",
  
  // Wrong brand formats (only check actual brand name usage, not descriptions)
  "PetWash (c)",
  "Petwash™", // wrong capitalization
];

// Expected modern files that should exist in your 2025 system
// Adjust names if your repo is slightly different
const REQUIRED_FILES: string[] = [
  "client/src/components/LuxuryThemeWrapper.tsx",
  "client/src/components/GiftCards.tsx",
  "client/src/components/PetWashHeaderNav.tsx",
  "client/src/components/Footer.tsx",
  "client/src/components/PetWashDivisions.tsx",
  "client/src/components/LuxuryPlatformShowcase.tsx",
];

// Backup related env vars to sanity check
// Note: These are optional warnings, not hard failures
const REQUIRED_ENV_VARS: string[] = [
  "GCS_BACKUP_BUCKET",
];

/**
 * Utility - simple directory walk with no external deps
 */
function walkDir(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules and .git
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walkDir(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function isCodeFile(file: string): boolean {
  return CODE_EXTS.some((ext) => file.endsWith(ext));
}

/**
 * Scan a single file for markers
 */
function scanFile(file: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const rel = path.relative(projectRoot, file);

  let content: string;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    return [
      {
        type: "CONFIG_WARNING",
        file: rel,
        detail: "Could not read file for scanning",
      },
    ];
  }

  const lines = content.split(/\r?\n/);

  // Legacy UI markers
  for (const marker of LEGACY_UI_MARKERS) {
    lines.forEach((line, idx) => {
      if (line.includes(marker)) {
        issues.push({
          type: "LEGACY_UI",
          file: rel,
          line: idx + 1,
          snippet: line.trim().slice(0, 200),
          detail: `Legacy UI marker "${marker}" found`,
        });
      }
    });
  }

  // Banned patterns
  for (const pattern of BANNED_PATTERNS) {
    lines.forEach((line, idx) => {
      if (line.includes(pattern)) {
        issues.push({
          type: "BANNED_PATTERN",
          file: rel,
          line: idx + 1,
          snippet: line.trim().slice(0, 200),
          detail: `Banned pattern "${pattern}" detected`,
        });
      }
    });
  }

  return issues;
}

/**
 * Check required files
 */
function checkRequiredFiles(): ScanIssue[] {
  const issues: ScanIssue[] = [];

  for (const rel of REQUIRED_FILES) {
    const full = path.join(projectRoot, rel);
    if (!fs.existsSync(full)) {
      issues.push({
        type: "MISSING_REQUIRED_FILE",
        file: rel,
        detail: `Required 2025 file is missing. This usually means the old UI is still active instead of the luxury layout.`,
      });
    }
  }

  return issues;
}

/**
 * Check basic env config
 */
function checkEnvConfig(): ScanIssue[] {
  const issues: ScanIssue[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = process.env[key];
    if (!value || !value.trim()) {
      issues.push({
        type: "CONFIG_ERROR",
        detail: `Environment variable ${key} is not set. Backups or Google Cloud integration may be broken.`,
      });
    } else {
      // Small sanity check on bucket
      if (key === "GCS_BACKUP_BUCKET" && !value.startsWith("petwash-")) {
        issues.push({
          type: "CONFIG_WARNING",
          detail: `GCS_BACKUP_BUCKET is set to "${value}". Double check this is your official backup bucket name.`,
        });
      }
    }
  }

  return issues;
}

/**
 * Main runner
 */
async function main() {
  const issues: ScanIssue[] = [];

  console.log("🔍 PetWash 2025 Preflight Guardian starting...\n");

  // 1. Env config check
  console.log("1) Checking backup and Google Cloud env config...");
  issues.push(...checkEnvConfig());

  // 2. Required files
  console.log("2) Checking for core 2025 luxury UI files...");
  issues.push(...checkRequiredFiles());

  // 3. Scan code for legacy or banned patterns
  console.log("3) Scanning source tree for legacy UI or banned patterns...");
  for (const dir of SCAN_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = walkDir(dir);
    for (const file of files) {
      if (!isCodeFile(file)) continue;
      issues.push(...scanFile(file));
    }
  }

  // 4. Git sanity
  const gitDir = path.join(projectRoot, ".git");
  if (!fs.existsSync(gitDir)) {
    issues.push({
      type: "CONFIG_WARNING",
      detail:
        "No .git directory found. Repository might not be connected to GitHub. Version control protection will be weaker.",
    });
  }

  // Print report
  console.log("\n📊 Preflight Report\n");

  if (issues.length === 0) {
    console.log("✅ No issues found. Codebase looks clean and modern.\n");
    console.log("You are safe to build, deploy and push to GitHub.");
    process.exit(0);
  }

  const grouped: Record<string, ScanIssue[]> = {};
  for (const issue of issues) {
    if (!grouped[issue.type]) grouped[issue.type] = [];
    grouped[issue.type].push(issue);
  }

  const order: ScanIssue["type"][] = [
    "CONFIG_ERROR",
    "LEGACY_UI",
    "BANNED_PATTERN",
    "MISSING_REQUIRED_FILE",
    "CONFIG_WARNING",
  ];

  let hasHardFail = false;

  for (const type of order) {
    const list = grouped[type];
    if (!list || list.length === 0) continue;

    console.log(`--- ${type} (${list.length}) ---`);
    for (const item of list) {
      const loc = item.file
        ? `${item.file}${item.line ? ":" + item.line : ""}`
        : "";
      console.log(`• ${item.detail}${loc ? "  -> " + loc : ""}`);
      if (item.snippet) {
        console.log(`    "${item.snippet}"`);
      }
    }
    console.log("");

    if (type === "CONFIG_ERROR" || type === "LEGACY_UI" || type === "BANNED_PATTERN") {
      hasHardFail = true;
    }
  }

  if (hasHardFail) {
    console.log(
      "❌ Preflight failed.\n" +
        "These issues must be fixed before build, deploy or pushing to protected branches.\n"
    );
    process.exit(1);
  } else {
    console.log(
      "⚠️ Preflight completed with warnings only.\n" +
        "You can build, but it is recommended to review and fix the warnings.\n"
    );
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Preflight script crashed:", err);
  process.exit(1);
});
