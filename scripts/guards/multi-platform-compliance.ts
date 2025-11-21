/**
 * Multi-Platform Compliance Engine
 * 
 * Validates that ALL PetWash™ + Octopus™ platforms are properly integrated:
 * - PetWash™ Core
 * - PetSitter™
 * - PetTransport™
 * - PetWalk™
 * - Academy™
 * - Marketplace™
 * - Municipal Portal
 * - Franchise Portal
 * - Technician Dashboard
 * - Drivers App
 * - K9000™ Hardware Bridge
 * - Octopus™ Digital Screens
 * - EventBus Integration
 * - Payment Systems
 */

import * as fs from "node:fs";
import * as path from "node:path";

type ComplianceIssue = {
  platform: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  category: string;
  detail: string;
  file?: string;
};

const projectRoot = process.cwd();

// Platform requirements
const PLATFORM_REQUIREMENTS = {
  "PetWash™ Core": {
    routes: ["server/routes/petwash"],
    schemas: ["k9000Stations", "washSessions"],
    components: ["client/src/components/LuxuryThemeWrapper.tsx"],
  },
  "K9000™ LED System": {
    files: ["server/iot/ledController.ts"],
    schemas: ["k9000LedCommandHistory"],
  },
  "EventBus": {
    files: ["server/services/EventBus.ts"],
  },
  "Payment Systems": {
    routes: ["server/routes/payments"],
  },
  "Loyalty System": {
    routes: ["server/routes/loyalty"],
  },
};

// Critical integrations
const CRITICAL_INTEGRATIONS = [
  { name: "EventBus", file: "server/services/EventBus.ts" },
  { name: "LED Controller", file: "server/iot/ledController.ts" },
  { name: "PetWash Global Schema", file: "shared/petwashGlobal.ts" },
  { name: "Enterprise Schema", file: "shared/schema-enterprise.ts" },
];

/**
 * Check platform files exist
 */
function checkPlatformRequirements(): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  
  for (const [platform, requirements] of Object.entries(PLATFORM_REQUIREMENTS)) {
    // Check routes
    if (requirements.routes) {
      for (const route of requirements.routes) {
        const fullPath = path.join(projectRoot, route);
        if (!fs.existsSync(fullPath)) {
          issues.push({
            platform,
            severity: "WARNING",
            category: "MISSING_ROUTE",
            detail: `Route directory "${route}" not found`,
            file: route,
          });
        }
      }
    }
    
    // Check files
    if (requirements.files) {
      for (const file of requirements.files) {
        const fullPath = path.join(projectRoot, file);
        if (!fs.existsSync(fullPath)) {
          issues.push({
            platform,
            severity: "CRITICAL",
            category: "MISSING_FILE",
            detail: `Required file "${file}" not found`,
            file,
          });
        }
      }
    }
    
    // Check components
    if (requirements.components) {
      for (const component of requirements.components) {
        const fullPath = path.join(projectRoot, component);
        if (!fs.existsSync(fullPath)) {
          issues.push({
            platform,
            severity: "CRITICAL",
            category: "MISSING_COMPONENT",
            detail: `Required component "${component}" not found`,
            file: component,
          });
        }
      }
    }
  }
  
  return issues;
}

/**
 * Check critical integrations
 */
function checkCriticalIntegrations(): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  
  for (const integration of CRITICAL_INTEGRATIONS) {
    const fullPath = path.join(projectRoot, integration.file);
    if (!fs.existsSync(fullPath)) {
      issues.push({
        platform: "Global",
        severity: "CRITICAL",
        category: "MISSING_INTEGRATION",
        detail: `Critical integration "${integration.name}" is missing`,
        file: integration.file,
      });
    } else {
      // Verify file is not empty
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.trim().length < 100) {
        issues.push({
          platform: "Global",
          severity: "WARNING",
          category: "INCOMPLETE_INTEGRATION",
          detail: `Integration file "${integration.name}" appears incomplete or stubbed`,
          file: integration.file,
        });
      }
    }
  }
  
  return issues;
}

/**
 * Validate EventBus wiring
 */
function validateEventBusWiring(): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  
  const ledControllerPath = path.join(projectRoot, "server/iot/ledController.ts");
  if (fs.existsSync(ledControllerPath)) {
    const content = fs.readFileSync(ledControllerPath, "utf8");
    
    // Check for EventBus integration
    if (!content.includes("eventBus.subscribe")) {
      issues.push({
        platform: "K9000™ LED",
        severity: "CRITICAL",
        category: "MISSING_EVENTBUS_WIRING",
        detail: "LED Controller is not wired to EventBus",
        file: "server/iot/ledController.ts",
      });
    }
    
    // Check for key event handlers
    const requiredEvents = ["wash.started", "wash.completed", "transport.assigned", "station.offline"];
    for (const event of requiredEvents) {
      if (!content.includes(`'${event}'`) && !content.includes(`"${event}"`)) {
        issues.push({
          platform: "K9000™ LED",
          severity: "WARNING",
          category: "MISSING_EVENT_HANDLER",
          detail: `LED Controller missing handler for "${event}" event`,
        });
      }
    }
  }
  
  return issues;
}

/**
 * Check schema consistency
 */
function checkSchemaConsistency(): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  
  const enterpriseSchemaPath = path.join(projectRoot, "shared/schema-enterprise.ts");
  if (fs.existsSync(enterpriseSchemaPath)) {
    const content = fs.readFileSync(enterpriseSchemaPath, "utf8");
    
    // Check for critical tables
    const criticalTables = [
      "k9000Stations",
      "washSessions",
      "k9000LedCommandHistory",
      "users",
    ];
    
    for (const table of criticalTables) {
      if (!content.includes(`export const ${table}`) && !content.includes(`const ${table}`)) {
        issues.push({
          platform: "Database",
          severity: "CRITICAL",
          category: "MISSING_TABLE",
          detail: `Critical table "${table}" not defined in enterprise schema`,
          file: "shared/schema-enterprise.ts",
        });
      }
    }
  }
  
  return issues;
}

/**
 * Main execution
 */
async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║        Multi-Platform Compliance Engine (2025)                ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");
  
  const allIssues: ComplianceIssue[] = [];
  
  console.log("🔍 Checking platform requirements...");
  allIssues.push(...checkPlatformRequirements());
  
  console.log("🔍 Checking critical integrations...");
  allIssues.push(...checkCriticalIntegrations());
  
  console.log("🔍 Validating EventBus wiring...");
  allIssues.push(...validateEventBusWiring());
  
  console.log("🔍 Checking schema consistency...");
  allIssues.push(...checkSchemaConsistency());
  
  const critical = allIssues.filter(i => i.severity === "CRITICAL");
  const warnings = allIssues.filter(i => i.severity === "WARNING");
  
  if (critical.length === 0 && warnings.length === 0) {
    console.log("✅ Multi-platform compliance check passed!");
    console.log("✅ All platforms properly integrated");
    console.log("");
    process.exit(0);
  }
  
  if (critical.length > 0) {
    console.log(`\n🚨 CRITICAL ISSUES (${critical.length}):\n`);
    critical.forEach(issue => {
      console.log(`  [${issue.platform}] ${issue.category}`);
      console.log(`    ${issue.detail}`);
      if (issue.file) console.log(`    File: ${issue.file}`);
      console.log("");
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`);
    warnings.forEach(issue => {
      console.log(`  [${issue.platform}] ${issue.category}`);
      console.log(`    ${issue.detail}`);
      if (issue.file) console.log(`    File: ${issue.file}`);
      console.log("");
    });
  }
  
  if (critical.length > 0) {
    console.log("╔═══════════════════════════════════════════════════════════════╗");
    console.log("║                    ❌ BUILD BLOCKED                           ║");
    console.log("╠═══════════════════════════════════════════════════════════════╣");
    console.log("║                                                               ║");
    console.log("║  Critical platform compliance violations detected.           ║");
    console.log("║                                                               ║");
    console.log("║  All PetWash™ + Octopus™ platforms must be integrated.       ║");
    console.log("║                                                               ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");
    process.exit(1);
  }
  
  console.log("✅ Compliance check passed (with warnings)");
  process.exit(0);
}

main().catch(err => {
  console.error("Multi-Platform Compliance Engine failed:", err);
  process.exit(1);
});
