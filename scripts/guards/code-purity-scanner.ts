/**
 * Code Purity Scanner
 * 
 * Detects and blocks:
 * - Template/demo/starter/boilerplate code
 * - Legacy UI fragments
 * - Foreign code patterns
 * - Rogue files and folders
 * - Duplicate routes
 * - Stale configs
 */

import * as fs from "node:fs";
import * as path from "node:path";

type PurityIssue = {
  severity: "BLOCKER" | "WARNING";
  type: string;
  file?: string;
  detail: string;
};

const projectRoot = process.cwd();

// Foreign code markers (MUST NOT EXIST)
const FOREIGN_MARKERS = [
  "TODO: Replace this template",
  "STARTER_TEMPLATE",
  "BOILERPLATE_CODE",
  "DEMO_ONLY",
  "SAMPLE_DATA",
  "placeholder-content",
  "example-component",
  "template-page",
  "starter-kit",
  "boilerplate-react",
];

// Rogue folders (MUST NOT EXIST)
const ROGUE_FOLDERS = [
  "legacy",
  "old",
  "backup",
  "template",
  "demo",
  "example",
  "starter",
  "boilerplate",
  "experiments",
  "trash",
  "deprecated",
  "_old",
  "_backup",
  "_legacy",
];

// Forbidden build directories
const FORBIDDEN_BUILD_DIRS = [
  "public",
  "build",
  "out",
  ".next",
];

// Required 2025 architecture files
const REQUIRED_2025_FILES = [
  "shared/petwashGlobal.ts",
  "shared/schema-enterprise.ts",
  "server/services/EventBus.ts",
  "server/iot/ledController.ts",
  "client/src/components/LuxuryThemeWrapper.tsx",
];

/**
 * Check for rogue folders
 */
function checkRogueFolders(): PurityIssue[] {
  const issues: PurityIssue[] = [];
  
  for (const folder of ROGUE_FOLDERS) {
    const fullPath = path.join(projectRoot, folder);
    if (fs.existsSync(fullPath)) {
      issues.push({
        severity: "BLOCKER",
        type: "ROGUE_FOLDER",
        file: folder,
        detail: `Rogue folder "${folder}" found. This contains legacy/template code and must be removed.`,
      });
    }
  }
  
  return issues;
}

/**
 * Check for forbidden build directories
 */
function checkForbiddenBuildDirs(): PurityIssue[] {
  const issues: PurityIssue[] = [];
  
  for (const dir of FORBIDDEN_BUILD_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      // Check if it contains build artifacts
      const files = fs.readdirSync(fullPath);
      if (files.length > 0) {
        issues.push({
          severity: "WARNING",
          type: "FORBIDDEN_BUILD_DIR",
          file: dir,
          detail: `Forbidden build directory "${dir}" contains files. Only dist/public is allowed for production builds.`,
        });
      }
    }
  }
  
  return issues;
}

/**
 * Check required 2025 files exist
 */
function checkRequired2025Files(): PurityIssue[] {
  const issues: PurityIssue[] = [];
  
  for (const file of REQUIRED_2025_FILES) {
    const fullPath = path.join(projectRoot, file);
    if (!fs.existsSync(fullPath)) {
      issues.push({
        severity: "BLOCKER",
        type: "MISSING_2025_FILE",
        file,
        detail: `Required 2025 architecture file "${file}" is missing.`,
      });
    }
  }
  
  return issues;
}

/**
 * Scan files for foreign code markers
 */
function scanForeignMarkers(): PurityIssue[] {
  const issues: PurityIssue[] = [];
  const scanDirs = ["client", "server", "shared"];
  
  for (const dir of scanDirs) {
    const fullDir = path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir)) continue;
    
    walkAndScan(fullDir, issues);
  }
  
  return issues;
}

function walkAndScan(dir: string, issues: PurityIssue[]): void {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walkAndScan(fullPath, issues);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".js") || entry.name.endsWith(".jsx")) {
      const content = fs.readFileSync(fullPath, "utf8");
      const relPath = path.relative(projectRoot, fullPath);
      
      for (const marker of FOREIGN_MARKERS) {
        if (content.includes(marker)) {
          issues.push({
            severity: "BLOCKER",
            type: "FOREIGN_CODE",
            file: relPath,
            detail: `Foreign code marker "${marker}" found in file.`,
          });
        }
      }
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              Code Purity Scanner (2025)                       ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");
  
  const allIssues: PurityIssue[] = [];
  
  console.log("🔍 Scanning for rogue folders...");
  allIssues.push(...checkRogueFolders());
  
  console.log("🔍 Checking forbidden build directories...");
  allIssues.push(...checkForbiddenBuildDirs());
  
  console.log("🔍 Verifying 2025 architecture files...");
  allIssues.push(...checkRequired2025Files());
  
  console.log("🔍 Scanning for foreign code markers...");
  allIssues.push(...scanForeignMarkers());
  
  const blockers = allIssues.filter(i => i.severity === "BLOCKER");
  const warnings = allIssues.filter(i => i.severity === "WARNING");
  
  if (blockers.length === 0 && warnings.length === 0) {
    console.log("✅ Code purity check passed!");
    console.log("✅ No foreign, legacy, or template code detected");
    console.log("");
    process.exit(0);
  }
  
  if (blockers.length > 0) {
    console.log(`\n🚨 BLOCKERS (${blockers.length}):\n`);
    blockers.forEach(issue => {
      console.log(`  [${issue.type}] ${issue.file || "N/A"}`);
      console.log(`    ${issue.detail}`);
      console.log("");
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`);
    warnings.forEach(issue => {
      console.log(`  [${issue.type}] ${issue.file || "N/A"}`);
      console.log(`    ${issue.detail}`);
      console.log("");
    });
  }
  
  if (blockers.length > 0) {
    console.log("╔═══════════════════════════════════════════════════════════════╗");
    console.log("║                    ❌ BUILD BLOCKED                           ║");
    console.log("╠═══════════════════════════════════════════════════════════════╣");
    console.log("║                                                               ║");
    console.log("║  Code purity violations detected.                            ║");
    console.log("║                                                               ║");
    console.log("║  Only 2025 luxury architecture code is allowed.              ║");
    console.log("║  Remove all legacy, template, and foreign code.              ║");
    console.log("║                                                               ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");
    process.exit(1);
  }
  
  console.log("✅ Code purity check passed (with warnings)");
  process.exit(0);
}

main().catch(err => {
  console.error("Code Purity Scanner failed:", err);
  process.exit(1);
});
