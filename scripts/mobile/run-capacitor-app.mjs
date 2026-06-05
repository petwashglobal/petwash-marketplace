import { spawnSync } from "node:child_process";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [appName, action] = process.argv.slice(2);
const configs = new Map([
  ["provider", "provider.config.ts"],
  ["customer", "customer.config.ts"],
]);
const actions = new Set(["sync", "open:ios", "open:android"]);

if (!configs.has(appName) || !actions.has(action)) {
  console.error(
    "Usage: node scripts/mobile/run-capacitor-app.mjs <provider|customer> <sync|open:ios|open:android>",
  );
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function selectConfig(selectedAppName) {
  const source = path.join(
    repoRoot,
    "config",
    "capacitor",
    configs.get(selectedAppName),
  );
  const target = path.join(repoRoot, "capacitor.config.ts");

  await copyFile(source, target);
  console.log(`Selected ${selectedAppName} Capacitor config.`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
}

try {
  await selectConfig(appName);

  if (action === "sync") {
    run("npm", ["run", "build"]);
    run("npx", ["cap", "sync"]);
    run("npm", ["run", "cap:clean-sourcemaps"]);
  } else if (action === "open:ios") {
    run("npx", ["cap", "open", "ios"]);
  } else if (action === "open:android") {
    run("npx", ["cap", "open", "android"]);
  }
} finally {
  await selectConfig("provider");
}
