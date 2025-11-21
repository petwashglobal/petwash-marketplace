/**
 * PetWash™ + Octopus™ Brand Enforcement Guard
 * 
 * Enforces strict branding rules across ALL code:
 * - PetWash™ (with trademark)
 * - Octopus™ (with trademark)
 * - Correct capitalization
 * - Luxury 2025 naming standards
 */

import * as fs from "node:fs";
import * as path from "node:path";

type BrandViolation = {
  severity: "CRITICAL" | "WARNING";
  file: string;
  line: number;
  column: number;
  violation: string;
  found: string;
  expected: string;
  context: string;
};

const projectRoot = process.cwd();

// Correct brand names (MANDATORY)
const OFFICIAL_BRANDS = [
  "PetWash™",
  "Octopus™",
  "K9000™",
  "The Plush Lab™",
  "The Sitter Suite™",
  "Walk My Pet™",
  "PetTrek™",
];

// Wrong variations that must be blocked
const BRAND_VIOLATIONS: Record<string, string> = {
  // PetWash violations
  "PetWash": "PetWash™",
  "Petwash": "PetWash™",
  "PETWASH": "PetWash™",
  "petwash": "PetWash™",
  "Pet Wash": "PetWash™",
  "pet wash": "PetWash™",
  "PetWash (c)": "PetWash™",
  "PetWash(R)": "PetWash™",
  
  // Octopus violations
  "Octopus": "Octopus™",
  "octopus": "Octopus™",
  "OCTOPUS": "Octopus™",
  "Octopus (c)": "Octopus™",
  
  // K9000 violations
  "K9000": "K9000™",
  "k9000": "K9000™",
  
  // Platform violations
  "The Plush Lab": "The Plush Lab™",
  "The Sitter Suite": "The Sitter Suite™",
  "Walk My Pet": "Walk My Pet™",
  "PetTrek": "PetTrek™",
};

// File extensions to scan
const SCANNABLE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".md", ".css", ".html"];

// Directories to exclude
const EXCLUDE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".local",
  "design_reference",
  "attached_assets",
];

/**
 * Walk directory recursively
 */
function walkDir(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.includes(entry.name)) continue;
      walkDir(fullPath, files);
    } else {
      const ext = path.extname(entry.name);
      if (SCANNABLE_EXTS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Scan file for brand violations
 */
function scanFile(filePath: string): BrandViolation[] {
  const violations: BrandViolation[] = [];
  const relPath = path.relative(projectRoot, filePath);
  
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  
  const lines = content.split(/\r?\n/);
  
  // Check each line for violations
  lines.forEach((line, lineIdx) => {
    for (const [wrong, correct] of Object.entries(BRAND_VIOLATIONS)) {
      // Skip if this is a comment explaining the rule itself
      if (line.includes(`"${wrong}"`) && line.includes(`"${correct}"`)) {
        continue;
      }
      
      // Skip if in an object/array literal defining the mapping
      if (line.trim().startsWith(`"${wrong}":`) || line.trim().startsWith(`'${wrong}':`)) {
        continue;
      }
      
      // Skip documentation files explaining the directive
      if (relPath.includes("PROTECTION_") || relPath.includes("DEPLOYMENT_") || relPath.includes(".replit-lock.md")) {
        continue;
      }
      
      // Skip URLs and domain names
      if (line.includes("petwash.co.il") || line.includes("petwashglobal/")) {
        continue;
      }
      
      const regex = new RegExp(`\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      let match;
      
      while ((match = regex.exec(line)) !== null) {
        violations.push({
          severity: "CRITICAL",
          file: relPath,
          line: lineIdx + 1,
          column: match.index + 1,
          violation: "INCORRECT_BRAND_NAME",
          found: wrong,
          expected: correct,
          context: line.trim().slice(0, 100),
        });
      }
    }
  });
  
  return violations;
}

/**
 * Main execution
 */
async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║       PetWash™ + Octopus™ Brand Enforcement Guard            ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");
  
  console.log("🔍 Scanning for brand violations...");
  
  const allFiles = walkDir(projectRoot);
  const allViolations: BrandViolation[] = [];
  
  for (const file of allFiles) {
    const violations = scanFile(file);
    allViolations.push(...violations);
  }
  
  if (allViolations.length === 0) {
    console.log("✅ No brand violations found!");
    console.log("✅ All brands correctly formatted with ™ trademark");
    console.log("");
    process.exit(0);
  }
  
  // Report violations
  console.log(`❌ Found ${allViolations.length} brand violation(s):\n`);
  
  const criticalViolations = allViolations.filter(v => v.severity === "CRITICAL");
  
  if (criticalViolations.length > 0) {
    console.log("🚨 CRITICAL VIOLATIONS:\n");
    
    criticalViolations.forEach(v => {
      console.log(`  ${v.file}:${v.line}:${v.column}`);
      console.log(`    Found: "${v.found}"`);
      console.log(`    Expected: "${v.expected}"`);
      console.log(`    Context: ${v.context}`);
      console.log("");
    });
  }
  
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║                    ❌ BUILD BLOCKED                           ║");
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log("║                                                               ║");
  console.log("║  Brand violations detected.                                  ║");
  console.log("║                                                               ║");
  console.log("║  All brands MUST use official names with ™:                  ║");
  console.log("║  - PetWash™ (NOT PetWash, Petwash, PETWASH)                  ║");
  console.log("║  - Octopus™ (NOT Octopus, octopus, OCTOPUS)                  ║");
  console.log("║  - K9000™ (NOT K9000, k9000)                                 ║");
  console.log("║                                                               ║");
  console.log("║  Fix all violations above and run again.                     ║");
  console.log("║                                                               ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  
  process.exit(1);
}

main().catch(err => {
  console.error("Brand Enforcement Guard failed:", err);
  process.exit(1);
});
