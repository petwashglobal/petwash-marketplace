import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appName = process.argv[2];
const configs = new Map([
  ["provider", "provider.config.ts"],
  ["customer", "customer.config.ts"],
]);

if (!configs.has(appName)) {
  console.error("Usage: node scripts/mobile/select-capacitor-config.mjs <provider|customer>");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(repoRoot, "config", "capacitor", configs.get(appName));
const target = path.join(repoRoot, "capacitor.config.ts");

await copyFile(source, target);
console.log(`Selected ${appName} Capacitor config.`);
