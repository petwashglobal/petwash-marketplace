/**
 * Master Protection Orchestrator
 * 
 * Coordinates ALL protection systems:
 * 1. Brand Enforcement Guard
 * 2. Code Purity Scanner
 * 3. Architecture Integrity Checker
 * 4. Multi-Platform Compliance Engine
 * 5. Preflight Guardian
 * 
 * This is the SINGLE entry point for all protection checks.
 */

import { spawn } from "node:child_process";
import * as path from "node:path";

type GuardResult = {
  name: string;
  passed: boolean;
  exitCode: number;
  output: string;
};

const projectRoot = process.cwd();

const GUARDS = [
  {
    name: "Brand Enforcement Guard",
    script: "scripts/guards/brand-enforcement-guard.ts",
    critical: true,
  },
  {
    name: "Code Purity Scanner",
    script: "scripts/guards/code-purity-scanner.ts",
    critical: true,
  },
  {
    name: "Architecture Integrity Checker",
    script: "scripts/guards/architecture-integrity-checker.ts",
    critical: true,
  },
  {
    name: "Multi-Platform Compliance Engine",
    script: "scripts/guards/multi-platform-compliance.ts",
    critical: false,
  },
  {
    name: "Preflight Guardian",
    script: "scripts/petwash-preflight.ts",
    critical: true,
  },
];

/**
 * Run a single guard
 */
function runGuard(guard: typeof GUARDS[0]): Promise<GuardResult> {
  return new Promise((resolve) => {
    const scriptPath = path.join(projectRoot, guard.script);
    const child = spawn("tsx", [scriptPath], {
      cwd: projectRoot,
      stdio: "pipe",
    });

    let output = "";

    child.stdout?.on("data", (data) => {
      output += data.toString();
    });

    child.stderr?.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        name: guard.name,
        passed: code === 0,
        exitCode: code ?? 1,
        output,
      });
    });

    child.on("error", (err) => {
      resolve({
        name: guard.name,
        passed: false,
        exitCode: 1,
        output: `Error running guard: ${err.message}`,
      });
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║                                                               ║");
  console.log("║     🛡️  PetWash™ + Octopus™ Master Protection System  🛡️     ║");
  console.log("║                                                               ║");
  console.log("║              Dual-End Total Protection (2025-2030)            ║");
  console.log("║                                                               ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Running comprehensive protection checks...");
  console.log("");

  const results: GuardResult[] = [];

  // Run all guards sequentially
  for (const guard of GUARDS) {
    console.log(`⏳ Running: ${guard.name}...`);
    const result = await runGuard(guard);
    results.push(result);

    if (result.passed) {
      console.log(`✅ ${guard.name} - PASSED\n`);
    } else {
      console.log(`❌ ${guard.name} - FAILED\n`);
      // Print output for failed guards
      console.log(result.output);
      console.log("");
    }
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                         SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  console.log(`✅ Passed: ${passed.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}\n`);

  if (failed.length > 0) {
    console.log("Failed guards:");
    failed.forEach((r) => {
      const guard = GUARDS.find((g) => g.name === r.name);
      const criticality = guard?.critical ? "🚨 CRITICAL" : "⚠️  WARNING";
      console.log(`  ${criticality} - ${r.name}`);
    });
    console.log("");
  }

  // Check if any critical guards failed
  const criticalFailed = failed.filter((r) => {
    const guard = GUARDS.find((g) => g.name === r.name);
    return guard?.critical;
  });

  if (criticalFailed.length > 0) {
    console.log("╔═══════════════════════════════════════════════════════════════╗");
    console.log("║                    ❌ PROTECTION FAILED                       ║");
    console.log("╠═══════════════════════════════════════════════════════════════╣");
    console.log("║                                                               ║");
    console.log("║  Critical protection checks failed.                          ║");
    console.log("║                                                               ║");
    console.log("║  Build/Deploy/Commit BLOCKED until all checks pass.          ║");
    console.log("║                                                               ║");
    console.log("║  Fix the issues above and run again.                         ║");
    console.log("║                                                               ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");
    process.exit(1);
  }

  if (failed.length > 0) {
    console.log("⚠️  Some non-critical checks failed. Review warnings above.");
    console.log("");
  }

  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              ✅ PROTECTION CHECKS PASSED                      ║");
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log("║                                                               ║");
  console.log("║  All critical protection systems validated.                  ║");
  console.log("║                                                               ║");
  console.log("║  Code is ready for:                                          ║");
  console.log("║  - Commit to Git                                             ║");
  console.log("║  - Push to GitHub                                            ║");
  console.log("║  - Production deployment                                     ║");
  console.log("║                                                               ║");
  console.log("║  🛡️  PetWash™ + Octopus™ Protected  🛡️                       ║");
  console.log("║                                                               ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  process.exit(0);
}

main().catch((err) => {
  console.error("Master Protection Orchestrator failed:", err);
  process.exit(1);
});
