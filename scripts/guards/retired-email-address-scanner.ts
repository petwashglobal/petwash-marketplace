#!/usr/bin/env tsx
/**
 * Blocks public reintroduction of retired PetWash contact inboxes.
 *
 * The support mailbox is the only public customer support address. This guard
 * intentionally avoids spelling retired addresses in source as a complete
 * literal so the scanner can enforce the same rule on its own file.
 */

import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';
import { exit } from 'process';

const RETIRED_LOCAL = 'hello';
const PETWASH_DOMAIN = 'petwash.co.il';
const RETIRED_EMAIL = `${RETIRED_LOCAL}@${PETWASH_DOMAIN}`;

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.vercel',
  '.firebase',
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.html',
  '.css',
  '.sql',
  '.env',
  '.example',
  '.txt',
  '.yml',
  '.yaml',
]);

function hasScannedExtension(fileName: string): boolean {
  return [...SCANNED_EXTENSIONS].some((extension) => fileName.endsWith(extension));
}

async function collectFiles(dir: string, results: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        await collectFiles(join(dir, entry.name), results);
      }
      continue;
    }

    if (!entry.isFile() || EXCLUDED_FILES.has(entry.name) || !hasScannedExtension(entry.name)) {
      continue;
    }

    results.push(join(dir, entry.name));
  }

  return results;
}

const root = process.cwd();
const files = await collectFiles(root);
const violations: string[] = [];

for (const file of files) {
  let content = '';
  try {
    content = await readFile(file, 'utf8');
  } catch {
    continue;
  }

  const lower = content.toLowerCase();
  if (!lower.includes(RETIRED_EMAIL)) {
    continue;
  }

  const rel = relative(root, file);
  content.split(/\r?\n/).forEach((line, index) => {
    if (line.toLowerCase().includes(RETIRED_EMAIL)) {
      violations.push(`${rel}:${index + 1}`);
    }
  });
}

if (violations.length) {
  console.error('Retired PetWash email address found. Replace public references with support@petwash.co.il.');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  exit(1);
}

console.log('Retired email address guard passed.');
