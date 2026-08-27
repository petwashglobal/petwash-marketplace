#!/usr/bin/env tsx
/**
 * Orphan detector — CEO 2026-08-27 §35-36.
 *
 * Scans the repo for the shape of "built but not wired":
 *
 *   (A) server/services/*.ts exports never imported OUTSIDE server/tests
 *   (B) server/routes/*.ts route files never mounted in server/routes.ts
 *   (C) client/src/pages/*.tsx page files never referenced in App.tsx
 *   (D) client/src/components/**\/*.tsx components never imported
 *
 * The detector is a WARNING TOOL, not an automatic deleter. A finding
 * is a signal to either wire the export, delete it, or classify it as
 * intentional infrastructure (e.g. reservation service that awaits
 * MARKETPLACE_EGIFT_FISCAL_ACTIVATION).
 *
 * Usage:
 *   npx tsx scripts/audit/orphan-detector.ts
 *   npx tsx scripts/audit/orphan-detector.ts --json > scratchpad/orphans.json
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const ALLOW_INTENTIONAL: Array<string | RegExp> = [
  // Files that are honestly wire-blocked pending CEO or Phase 2.
  /egiftReservationService\.ts$/,     // MARKETPLACE_EGIFT_FISCAL_ACTIVATION
  /egiftBalanceProjection\.ts$/,      // consumed by /api/egift/:egiftId/balance
];

interface Finding {
  category: 'SERVICE_EXPORT' | 'ROUTE_UNMOUNTED' | 'PAGE_UNROUTED' | 'COMPONENT_UNUSED';
  file: string;
  exportName?: string;
  hint: string;
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
      await walk(p, out);
    } else if (e.isFile()) {
      out.push(p);
    }
  }
  return out;
}

function isAllowed(rel: string): boolean {
  return ALLOW_INTENTIONAL.some((p) => (typeof p === 'string' ? rel.endsWith(p) : p.test(rel)));
}

async function scanServerServices(allFiles: string[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  const services = allFiles.filter((f) =>
    f.includes('/server/services/') && f.endsWith('.ts') && !f.endsWith('.test.ts'),
  );
  const importersCache = new Map<string, string>();

  for (const svc of services) {
    const rel = path.relative(ROOT, svc);
    if (isAllowed(rel)) continue;

    const svcModule = rel.replace(/\.ts$/, '').replace(/^server\//, '');
    // Look for import lines that reference this service from a NON-test file.
    let importedByProduction = false;
    for (const other of allFiles) {
      if (other === svc) continue;
      if (other.endsWith('.test.ts')) continue;
      const otherRel = path.relative(ROOT, other);
      if (!otherRel.startsWith('server/') && !otherRel.startsWith('shared/')) continue;
      let src = importersCache.get(other);
      if (src === undefined) {
        src = await readFile(other, 'utf8').catch(() => '');
        importersCache.set(other, src);
      }
      const basename = path.basename(svc, '.ts');
      if (src.includes(basename) && new RegExp(`from ['"][^'"]*${basename}['"]`).test(src)) {
        importedByProduction = true;
        break;
      }
    }
    if (!importedByProduction) {
      findings.push({
        category: 'SERVICE_EXPORT',
        file: rel,
        hint: `${path.basename(svc)} is not imported by any non-test file. Wire it, delete it, or add to ALLOW_INTENTIONAL.`,
      });
    }
  }
  return findings;
}

async function scanRoutes(allFiles: string[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  const routes = allFiles.filter((f) =>
    f.includes('/server/routes/') && f.endsWith('.ts') && !f.endsWith('.test.ts'),
  );
  const mountingFile = path.join(ROOT, 'server', 'routes.ts');
  const mountingSrc = await readFile(mountingFile, 'utf8').catch(() => '');

  for (const routeFile of routes) {
    const rel = path.relative(ROOT, routeFile);
    if (isAllowed(rel)) continue;
    const base = path.basename(routeFile, '.ts');
    // Both bare basename and its camelCase form are commonly used as var names.
    const camel = base.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const patterns = [base, camel, camel + 'Routes'];
    const mounted = patterns.some((p) => mountingSrc.includes(p));
    if (!mounted) {
      findings.push({
        category: 'ROUTE_UNMOUNTED',
        file: rel,
        hint: `${base}.ts is not mounted in server/routes.ts. Mount it or delete it.`,
      });
    }
  }
  return findings;
}

async function scanClientPages(allFiles: string[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  const pages = allFiles.filter((f) =>
    f.includes('/client/src/pages/') && f.endsWith('.tsx') && !f.includes('.test.') && !f.includes('.regression.'),
  );
  const appTsx = await readFile(path.join(ROOT, 'client', 'src', 'App.tsx'), 'utf8').catch(() => '');

  for (const page of pages) {
    const rel = path.relative(ROOT, page);
    if (isAllowed(rel)) continue;
    const base = path.basename(page, '.tsx');
    if (!appTsx.includes(base)) {
      findings.push({
        category: 'PAGE_UNROUTED',
        file: rel,
        hint: `${base} is not referenced from client/src/App.tsx. Wire it or delete it.`,
      });
    }
  }
  return findings;
}

async function scanClientComponents(allFiles: string[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  const components = allFiles.filter((f) =>
    f.includes('/client/src/components/') && f.endsWith('.tsx') && !f.includes('.test.'),
  );

  const importersCache = new Map<string, string>();

  for (const comp of components) {
    const rel = path.relative(ROOT, comp);
    if (isAllowed(rel)) continue;
    const base = path.basename(comp, '.tsx');
    let importedByOther = false;
    for (const other of allFiles) {
      if (other === comp) continue;
      if (other.endsWith('.test.tsx') || other.endsWith('.test.ts')) continue;
      const otherRel = path.relative(ROOT, other);
      if (!otherRel.startsWith('client/')) continue;
      let src = importersCache.get(other);
      if (src === undefined) {
        src = await readFile(other, 'utf8').catch(() => '');
        importersCache.set(other, src);
      }
      if (new RegExp(`from ['"][^'"]*${base}['"]`).test(src)) {
        importedByOther = true;
        break;
      }
    }
    if (!importedByOther) {
      findings.push({
        category: 'COMPONENT_UNUSED',
        file: rel,
        hint: `${base}.tsx is not imported anywhere in client/. Wire it or delete it.`,
      });
    }
  }
  return findings;
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');

  const files: string[] = [];
  await walk(path.join(ROOT, 'server'), files);
  await walk(path.join(ROOT, 'client'), files);
  await walk(path.join(ROOT, 'shared'), files);

  const [services, routes, pages, components] = await Promise.all([
    scanServerServices(files),
    scanRoutes(files),
    scanClientPages(files),
    scanClientComponents(files),
  ]);

  const findings = [...services, ...routes, ...pages, ...components];

  if (asJson) {
    process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2) + '\n');
    return;
  }

  const banner = '━'.repeat(60);
  console.log(banner);
  console.log(`Orphan detector — ${findings.length} finding${findings.length === 1 ? '' : 's'}`);
  console.log(banner);
  for (const cat of ['SERVICE_EXPORT', 'ROUTE_UNMOUNTED', 'PAGE_UNROUTED', 'COMPONENT_UNUSED'] as const) {
    const bucket = findings.filter((f) => f.category === cat);
    if (bucket.length === 0) continue;
    console.log(`\n[${cat}] (${bucket.length})`);
    for (const f of bucket) {
      console.log(`  ${f.file}`);
      console.log(`    ↳ ${f.hint}`);
    }
  }
  if (findings.length === 0) {
    console.log('\nNo orphans. Every wire lands somewhere real.\n');
  }
}

main().catch((err) => {
  console.error('orphan-detector crashed:', err);
  process.exit(1);
});
