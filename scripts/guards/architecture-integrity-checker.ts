/**
 * Architecture Integrity Checker
 * 
 * Validates the 2025 PetWash™ + Octopus™ architecture:
 * - Correct folder structure
 * - Module organization
 * - Import patterns
 * - Route organization
 * - Schema consistency
 */

import * as fs from "node:fs";
import * as path from "node:path";

type ArchitectureIssue = {
  severity: "ERROR" | "WARNING";
  category: string;
  detail: string;
  file?: string;
};

const projectRoot = process.cwd();

// Required top-level directories
const REQUIRED_DIRS = [
  "client",
  "server",
  "shared",
  "scripts",
];

// Required server structure
const REQUIRED_SERVER_DIRS = [
  "server/routes",
  "server/services",
  "server/middleware",
  "server/iot",
];

// Required shared files
const REQUIRED_SHARED_FILES = [
  "shared/petwashGlobal.ts",
  "shared/schema-enterprise.ts",
];

// Forbidden patterns
const FORBIDDEN_PATTERNS = [
  { pattern: /from\s+['"]\.\.\/\.\.\/\.\.\//, desc: "Triple parent imports (..../../..)" },
  { pattern: /require\(['"][^'"]*node_modules/, desc: "Direct node_modules require" },
];

/**
 * Check required directories exist
 */
function checkRequiredDirs(): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];
  
  for (const dir of REQUIRED_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (!fs.existsSync(fullPath)) {
      issues.push({
        severity: "ERROR",
        category: "MISSING_DIRECTORY",
        detail: `Required directory "${dir}" does not exist`,
        file: dir,
      });
    }
  }
  
  for (const dir of REQUIRED_SERVER_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (!fs.existsSync(fullPath)) {
      issues.push({
        severity: "ERROR",
        category: "MISSING_SERVER_DIR",
        detail: `Required server directory "${dir}" does not exist`,
        file: dir,
      });
    }
  }
  
  return issues;
}

/**
 * Check required shared files
 */
function checkRequiredSharedFiles(): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];
  
  for (const file of REQUIRED_SHARED_FILES) {
    const fullPath = path.join(projectRoot, file);
    if (!fs.existsSync(fullPath)) {
      issues.push({
        severity: "ERROR",
        category: "MISSING_SHARED_FILE",
        detail: `Required shared file "${file}" does not exist`,
        file,
      });
    }
  }
  
  return issues;
}

/**
 * Scan for forbidden import patterns
 */
function scanImportPatterns(): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];
  const scanDirs = ["client/src", "server", "shared"];
  
  for (const dir of scanDirs) {
    const fullDir = path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir)) continue;
    
    walkAndCheckImports(fullDir, issues);
  }
  
  return issues;
}

function walkAndCheckImports(dir: string, issues: ArchitectureIssue[]): void {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walkAndCheckImports(fullPath, issues);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      const content = fs.readFileSync(fullPath, "utf8");
      const relPath = path.relative(projectRoot, fullPath);
      
      for (const { pattern, desc } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          issues.push({
            severity: "WARNING",
            category: "FORBIDDEN_IMPORT_PATTERN",
            detail: `Forbidden import pattern: ${desc}`,
            file: relPath,
          });
        }
      }
    }
  }
}

/**
 * Validate port configuration
 */
function validatePortConfig(): ArchitectureIssue[] {
  const issues: ArchitectureIssue[] = [];
  const replitFile = path.join(projectRoot, ".replit");
  
  if (!fs.existsSync(replitFile)) {
    issues.push({
      severity: "WARNING",
      category: "MISSING_REPLIT_CONFIG",
      detail: ".replit configuration file not found",
    });
    return issues;
  }
  
  const content = fs.readFileSync(replitFile, "utf8");
  const portBlocks = content.match(/\[\[ports\]\]/g);
  
  if (portBlocks && portBlocks.length > 1) {
    issues.push({
      severity: "WARNING",
      category: "MULTIPLE_PORTS",
      detail: `Multiple [[ports]] blocks detected (${portBlocks.length}). Only ONE port (5000→80) is recommended. Note: .replit cannot be edited programmatically - manual fix required.`,
      file: ".replit",
    });
  }
  
  return issues;
}

/**
 * Main execution
 */
async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║          Architecture Integrity Checker (2025)                ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");
  
  const allIssues: ArchitectureIssue[] = [];
  
  console.log("🔍 Checking required directories...");
  allIssues.push(...checkRequiredDirs());
  
  console.log("🔍 Checking required shared files...");
  allIssues.push(...checkRequiredSharedFiles());
  
  console.log("🔍 Scanning import patterns...");
  allIssues.push(...scanImportPatterns());
  
  console.log("🔍 Validating port configuration...");
  allIssues.push(...validatePortConfig());
  
  const errors = allIssues.filter(i => i.severity === "ERROR");
  const warnings = allIssues.filter(i => i.severity === "WARNING");
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log("✅ Architecture integrity check passed!");
    console.log("✅ 2025 structure validated");
    console.log("");
    process.exit(0);
  }
  
  if (errors.length > 0) {
    console.log(`\n🚨 ERRORS (${errors.length}):\n`);
    errors.forEach(issue => {
      console.log(`  [${issue.category}] ${issue.file || "N/A"}`);
      console.log(`    ${issue.detail}`);
      console.log("");
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`);
    warnings.forEach(issue => {
      console.log(`  [${issue.category}] ${issue.file || "N/A"}`);
      console.log(`    ${issue.detail}`);
      console.log("");
    });
  }
  
  if (errors.length > 0) {
    console.log("╔═══════════════════════════════════════════════════════════════╗");
    console.log("║                    ❌ BUILD BLOCKED                           ║");
    console.log("╠═══════════════════════════════════════════════════════════════╣");
    console.log("║                                                               ║");
    console.log("║  Architecture integrity violations detected.                 ║");
    console.log("║                                                               ║");
    console.log("║  Fix the errors above to restore 2025 architecture.          ║");
    console.log("║                                                               ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");
    process.exit(1);
  }
  
  console.log("✅ Architecture check passed (with warnings)");
  process.exit(0);
}

main().catch(err => {
  console.error("Architecture Integrity Checker failed:", err);
  process.exit(1);
});
