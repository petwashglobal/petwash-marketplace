#!/usr/bin/env bash
# ===== fix-replit-prod.sh =====
set -euo pipefail

echo "▶ Backing up critical files…"
ts="$(date +%Y%m%d-%H%M%S)"
mkdir -p .backup-$ts
cp -f package.json .backup-$ts/ 2>/dev/null || true
cp -f .replit .backup-$ts/ 2>/dev/null || true
cp -f replit.nix .backup-$ts/ 2>/dev/null || true
cp -f start-production.sh .backup-$ts/ 2>/dev/null || true
echo "  Backups in .backup-$ts"

# Ensure start-production.sh exists and is executable
if [ ! -f start-production.sh ]; then
  cat > start-production.sh <<'SH'
#!/usr/bin/env bash
# Production starter for Pet Wash™
export NODE_ENV=production
exec tsx server/index.ts
SH
fi
chmod +x start-production.sh

# Make sure .replit uses our production start and Node 20+
# (Keep your existing content; only inject env + run if missing)
if ! grep -q 'NODE_VERSION' .replit 2>/dev/null; then
  printf '\n[env]\nNODE_VERSION = "20.11.1"\n' >> .replit
fi
if ! grep -q 'start-production.sh' .replit 2>/dev/null; then
  # Add a top-level run = ["./start-production.sh"] if not present
  if grep -q '^\s*run\s*=' .replit; then
    # leave existing; user's workflows may override run
    true
  else
    printf '\nrun = ["./start-production.sh"]\n' >> .replit
  fi
fi

# Patch package.json safely with Node (no jq required)
node - <<'NODE'
const fs = require('fs');
const path = 'package.json';
if (!fs.existsSync(path)) {
  throw new Error('package.json missing');
}
const pkg = JSON.parse(fs.readFileSync(path,'utf8'));

// Ensure type and scripts
pkg.type = pkg.type || "module";
pkg.scripts = pkg.scripts || {};
// Dev server (unchanged if you already have one)
pkg.scripts.dev = pkg.scripts.dev || "NODE_ENV=development tsx server/index.ts";
// Build ONLY the client; do not bundle the server (avoids alias issues)
pkg.scripts.build = "vite build && tsc --noEmit";
// Start server in production with tsx (resolves TS path aliases at runtime)
pkg.scripts.start = "bash ./start-production.sh";
// (Optional) keep your db migration script if you have one
pkg.scripts["check"] = pkg.scripts["check"] || "tsc -p tsconfig.json";

// Ensure deps/devDeps exist and pin 2025-stable versions
pkg.devDependencies = pkg.devDependencies || {};
pkg.dependencies = pkg.dependencies || {};

// Core toolchain
const wantDev = {
  "vite": "^5.4.19",
  "rollup": "^4.22.0",
  "typescript": "^5.5.4",
  "tsx": "^4.19.1",
  "@types/node": "^20.11.6"
};
// Keep existing ranges if newer; otherwise set/upgrade
for (const [k,v] of Object.entries(wantDev)) {
  const cur = pkg.devDependencies[k] || pkg.dependencies[k];
  if (!cur) pkg.devDependencies[k] = v;
  else pkg.devDependencies[k] = cur; // leave as is; user may be newer
}

// Guarantee esbuild is present via Vite (implicitly) – no direct pin needed,
// but if you had it, leave it.

// Write back
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
console.log("package.json updated.");
NODE

echo "▶ Cleaning caches…"
rm -rf node_modules .vite dist

echo "▶ Installing dependencies (pinning modern toolchain)…"
# Use legacy peer deps to avoid noisy peer warnings breaking CI
npm install --legacy-peer-deps

# Ensure our exact minimum versions are present (idempotent)
npm i -D vite@^5.4.19 rollup@^4.22.0 tsx@^4.19.1 typescript@^5.5.4 @types/node@^20.11.6 --legacy-peer-deps

echo "▶ Building client…"
npm run build

echo "▶ Smoke test: TypeScript type-check (no emit)…"
npm run check

echo "✅ Done. You can now run:"
echo "   npm start"
echo "   (or publish from Replit → Deployments)"
