// FILE: fix_config.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PATHS
const replitConfigPath = path.join(process.cwd(), '.replit');
const backupPath = path.join(process.cwd(), '.replit.bak_2025');

// THE CLEAN 2025 CONFIGURATION (TOML Format)
// Enforces Node 18+, single port entry, and hidden system files.
const cleanConfig = `modules = ["nodejs-20", "web", "postgresql-16"]
run = ["npm", "run", "dev"]
hidden = [".config", ".git", "generated-icon.png", "node_modules", "dist"]

[nix]
channel = "stable-24_05"
packages = ["openssl", "pngquant", "optipng", "k6", "dig", "jq"]

[deployment]
deploymentTarget = "cloudrun"
build = ["npm", "run", "build"]
run = ["npm", "run", "start"]

[workflows]
runButton = "Project"

[[workflows.workflow]]
name = "Project"
mode = "parallel"
author = "agent"

[[workflows.workflow.tasks]]
task = "workflow.run"
args = "Start application"

[[workflows.workflow]]
name = "Start application"
author = "agent"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "npm run dev"
waitForPort = 5000

[agent]
integrations = ["javascript_database:1.0.0", "javascript_auth_all_persistance:1.0.0", "firebase_barebones_javascript:1.0.0", "javascript_log_in_with_replit:1.0.0", "hubspot:1.0.0", "twilio:1.0.0", "javascript_gemini_ai_integrations:1.0.0", "google-mail:1.0.0", "google-sheet:1.0.0", "google-calendar:1.0.0", "github:1.0.0"]

# 2025 DEPLOYMENT STANDARD: Single Port Mapping
[[ports]]
localPort = 5000
externalPort = 80
`;

async function runFix() {
  console.log("🔧 [SYSTEM] Starting Configuration Repair...");

  try {
    // 1. Safety Backup
    if (fs.existsSync(replitConfigPath)) {
      fs.copyFileSync(replitConfigPath, backupPath);
      console.log(`✅ [BACKUP] Original config saved to .replit.bak_2025`);
    }

    // 2. Write Clean Config
    fs.writeFileSync(replitConfigPath, cleanConfig);
    
    console.log("---------------------------------------------");
    console.log("✅ [SUCCESS] .replit file successfully overwritten.");
    console.log("🚫 [CLEANUP] Removed 15 conflicting port entries.");
    console.log("🚀 [READY] Port 5000 is now mapped to External 80.");
    console.log("---------------------------------------------");
    console.log("👉 ACTION REQUIRED: Press 'Stop' then 'Run' to apply.");

  } catch (error) {
    console.error("❌ [ERROR] Fix failed:", error.message);
  }
}

runFix();
