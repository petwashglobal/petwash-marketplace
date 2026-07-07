import { spawnSync } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
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

// Each app ships its OWN store icon, stamped into the native projects at build
// time (the ios/ + android/ trees are shared, so the icon is a per-flavor build
// artifact — never committed for one flavor). Sources live in
// config/capacitor/icons/<flavor>.png. Background colour drives the Android
// adaptive-icon backdrop: black for the Prestige (customer) icon, white for the
// green Provider icon.
const iconBackground = new Map([
  ["customer", "#000000"],
  ["provider", "#FFFFFF"],
]);

async function generateIcons(selectedAppName) {
  const source = path.join(repoRoot, "config", "capacitor", "icons", `${selectedAppName}.png`);
  const assetsDir = path.join(repoRoot, "assets");
  await mkdir(assetsDir, { recursive: true });
  // @capacitor/assets reads assets/icon.png (>=1024px) and generates every iOS
  // + Android size. Limit to native platforms so no PWA/web output is touched.
  await copyFile(source, path.join(assetsDir, "icon.png"));
  const bg = iconBackground.get(selectedAppName) ?? "#FFFFFF";
  run("npx", [
    "@capacitor/assets", "generate", "--ios", "--android",
    "--iconBackgroundColor", bg, "--iconBackgroundColorDark", bg,
  ]);
  console.log(`Stamped ${selectedAppName} app icon.`);
}

function run(command, args, extraEnv) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
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
    // Stamp the JS bundle with its app identity at BUILD time so the two apps
    // are hardcoded-distinct from frame 0 — no shared runtime, no async
    // bundle-id lookup, no web-experience flash. Vite exposes any VITE_*
    // env var to client code via import.meta.env.
    run("npm", ["run", "build"], { VITE_APP_FLAVOR: appName });
    run("npx", ["cap", "sync"]);
    // Stamp this flavor's own store icon into the native projects (after sync,
    // which (re)creates the native icon slots).
    await generateIcons(appName);
    run("npm", ["run", "cap:clean-sourcemaps"]);
  } else if (action === "open:ios") {
    run("npx", ["cap", "open", "ios"]);
  } else if (action === "open:android") {
    run("npx", ["cap", "open", "android"]);
  }
} finally {
  await selectConfig("provider");
}
