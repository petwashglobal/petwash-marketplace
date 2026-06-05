import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const roots = [
  "dist/public",
  "ios/App/App/public",
  "android/app/src/main/assets/public",
  "ios-customer/App/App/public",
  "android-customer/app/src/main/assets/public",
];

async function pruneMaps(root) {
  let entries;

  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return 0;
    }

    throw error;
  }

  let removed = 0;

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      removed += await pruneMaps(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".map")) {
      await rm(fullPath);
      removed += 1;
    }
  }

  return removed;
}

const removed = (
  await Promise.all(roots.map((root) => pruneMaps(root)))
).reduce((sum, count) => sum + count, 0);

console.log(`Pruned ${removed} Capacitor source map artifact${removed === 1 ? "" : "s"}.`);
