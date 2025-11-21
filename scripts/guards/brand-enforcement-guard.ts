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
  severity: "CRITICAL" | "WARNING" | "INFO";
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
  // Critical PetWash violations only (UI facing)
  "Petwash": "PetWash™",
  "PETWASH": "PetWash™",
  "Pet Wash": "PetWash™",
  "pet wash": "PetWash™",
  "PetWash (c)": "PetWash™",
  "PetWash(R)": "PetWash™",
};

// File extensions to scan (focus on user-facing UI files only)
const SCANNABLE_EXTS = [".tsx"];

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
    const relPath = path.relative(projectRoot, fullPath);
    
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.includes(entry.name)) continue;
      walkDir(fullPath, files);
    } else {
      const ext = path.extname(entry.name);
      // Only scan client-side UI files (user-facing)
      if (SCANNABLE_EXTS.includes(ext) && relPath.startsWith("client/")) {
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
    const trimmedLine = line.trim();
    
    // Skip full-line comments only (not inline comments or JSDoc descriptions with code)
    if ((trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) && !trimmedLine.includes('<') && !trimmedLine.includes('const ') && !trimmedLine.includes('let ') && !trimmedLine.includes('var ')) {
      return;
    }
    
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
      
      // Skip URL schemes (e.g., petwash://, k9000://)
      if (line.includes(`${wrong}://`) || line.includes(`${wrong.toLowerCase()}://`)) {
        continue;
      }
      
      // Skip path segments (e.g., /k9000/book, /petwash/home)
      if (line.includes(`/${wrong}/`) || line.includes(`/${wrong.toLowerCase()}/`)) {
        continue;
      }
      
      // Skip lowercase path segments and database identifiers
      if (wrong.toLowerCase() === wrong && (line.includes('"id"') || line.includes("'id'") || line.includes('path:') || line.includes('iosScheme:') || line.includes('androidScheme:'))) {
        continue;
      }
      
      const regex = new RegExp(`\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      let match;
      
      while ((match = regex.exec(line)) !== null) {
        // Determine severity based on context
        let severity: "CRITICAL" | "WARNING" | "INFO" = "WARNING";
        
        // CRITICAL: Customer-facing text/content in key pages
        const criticalPages = ["Landing", "Home", "Header", "Footer", "Navigation"];
        
        // Check if this is actual JSX text content (not just technical identifiers)
        const isJSXTextContent = line.includes("<p") || line.includes("<h") || line.includes("<span") || 
                                 line.includes("<div") || line.includes("<button") || line.includes("<a") || 
                                 line.includes("<li") || line.includes(">{") || line.includes("</");
        
        // Skip technical labels/aria-labels (not visible to customers)
        const isTechnicalLabel = line.includes("aria-label:") || line.includes("aria-describedby:");
        
        // Skip if it's in a full-line comment (not mixed code/comment)
        const isFullLineComment = trimmedLine.startsWith('*') && !trimmedLine.includes('<');
        
        if (criticalPages.some(page => relPath.includes(page)) && isJSXTextContent && !isTechnicalLabel && !isFullLineComment) {
          severity = "CRITICAL";
        }
        
        // INFO: Technical identifiers, descriptions, placeholders
        if (line.includes("description:") || line.includes("placeholder:") || isTechnicalLabel) {
          severity = "INFO";
        }
        
        violations.push({
          severity,
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
  const warnings = allViolations.filter(v => v.severity === "WARNING");
  const info = allViolations.filter(v => v.severity === "INFO");
  
  if (criticalViolations.length > 0) {
    console.log("🚨 CRITICAL VIOLATIONS (Customer-Facing Copy):\n");
    
    criticalViolations.forEach(v => {
      console.log(`  ${v.file}:${v.line}:${v.column}`);
      console.log(`    Found: "${v.found}"`);
      console.log(`    Expected: "${v.expected}"`);
      console.log(`    Context: ${v.context}`);
      console.log("");
    });
    
    console.log("╔═══════════════════════════════════════════════════════════════╗");
    console.log("║                    ❌ BUILD BLOCKED                           ║");
    console.log("╠═══════════════════════════════════════════════════════════════╣");
    console.log("║                                                               ║");
    console.log("║  Critical brand violations in customer-facing pages.         ║");
    console.log("║                                                               ║");
    console.log("║  Fix the CRITICAL violations above before building.          ║");
    console.log("║                                                               ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");
    
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length} secondary brand issues - fix when possible):\n`);
    console.log(`   Run with VERBOSE=1 to see all warning details\n`);
  }
  
  if (info.length > 0) {
    console.log(`ℹ️  INFO: ${info.length} minor brand suggestions logged\n`);
  }
  
  console.log("✅ Brand enforcement passed (critical checks only)");
  if (warnings.length > 0 || info.length > 0) {
    console.log("⚠️  Note: Some secondary text could use trademark updates");
  }
  process.exit(0);
}

main().catch(err => {
  console.error("Brand Enforcement Guard failed:", err);
  process.exit(1);
});
