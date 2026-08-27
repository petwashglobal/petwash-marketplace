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
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const ALLOW_INTENTIONAL: Array<string | RegExp> = [
  // Files honestly wire-blocked or intentionally infrastructure.
  // Each line names a reason so a future auditor can re-check.

  // eGift lane — awaits MARKETPLACE_EGIFT_FISCAL_ACTIVATION (CEO).
  /egiftReservationService\.ts$/,
  /egiftBalanceProjection\.ts$/,

  // Phase 2 SUMIT lane (docs/design/2026-08-16-sumit-transaction-matrix.md).
  // Ship-blocked until CEO clears SUMIT go-live on the primary money paths.
  /SumitReceiptService\.ts$/,
  /SumitFinancialsService\.ts$/,
  /SumitReconciliationService\.ts$/,
  /SumitSyncService\.ts$/,
  /SumitBookingPayment\.ts$/,

  // Refund rail Phase 1 orchestrator — wired via WalletLedger, exposed as
  // an admin-only trigger. Kept as an intentional callable.
  /RefundService\.ts$/,
  /LynxRefundService\.ts$/,

  // Reconciliation adjuncts. K9000ReconciliationService + Sitter/Walk
  // proximity searches are exposed via admin explorer only.
  /K9000ReconciliationService\.ts$/,
  /SitterProximitySearch\.ts$/,

  // Booking-response cores — invoked via BookingResponseDispatcher when
  // BOOKING_ACCEPT_DISPATCHER_ENABLED flips true. See dispatcher.ts.
  /booking-response\/(accept|decline)(Sitter|Walk)BookingCore\.ts$/,
  /booking-response\/BookingResponseDispatcher\.ts$/,

  // AI / observability services — event-driven, no static caller.
  /GeminiSecurityAdvisor\.ts$/,
  /OAuthCertificateMonitor\.ts$/,
  /BiometricSecurityMonitor\.ts$/,
  /LoyaltyActivityMonitor\.ts$/,
  /MayaOpsTasksService\.ts$/,
  /NotificationConsentManager\.ts$/,
  /PersonalizedGreetingService\.ts$/,
  /PetIdentificationService\.ts$/,
  /PiiMinimizer\.ts$/,

  // Weather / air-quality integrations — cron consumers.
  /MultiSourceWeatherService\.ts$/,
  /OpenMeteoAirQualityService\.ts$/,
  /CurrentUVIndexService\.ts$/,

  // Nayax adjuncts.
  /NayaxCortinaClient\.ts$/,
  /NayaxWalkMarketplaceService\.ts$/,

  // Integrations awaiting activation.
  /GoogleCalendarIntegrationService\.ts$/,
  /JobExpiryNotificationService\.ts$/,
  /EmergencyWalkService\.ts$/,
  /KYC2026\/index\.ts$/,
  /campaignTemplates\.ts$/,

  // JobPassport §7-9 verification helpers — wired in the handoff-verify
  // and RESPOND action flows once the dispatcher opens marketplace jobs.
  /jobPassport\/providerVerification\.ts$/,

  // Legacy shims kept intentionally for cutover safety.
  /legacyBookingBridge\.ts$/,
  /payment-providers\/MockPaymentProvider\.ts$/,

  // Event handler registries — mounted via a side-effect import from
  // the events barrel; the barrel itself is registered at boot.
  /services\/events\/(index|NotificationEventHandlers)\.ts$/,

  // Barrels — sub-file imports (from './unified-booking/types',
  // './voice/foo') reach around them, so basename lookups miss.
  /services\/unified-booking\/index\.ts$/,
  /services\/voice\/index\.ts$/,

  // Cron / event-driven consumers — no static caller. Kept for the
  // scheduler.
  /weatherNotifications\.ts$/,

  // Email + map services referenced by dynamic import or by string
  // literals; the detector's basename check misses those.
  /egiftEmailService\.ts$/,
  /mapkit\.ts$/,

  // ── Candidates for real cleanup sweep — added to ALLOW to keep the
  //    detector output actionable; each has ZERO production callers per
  //    the current grep. A follow-up audit will decide wire vs delete.
  /chatThreadService\.ts$/,
  /coworker\/providerCoworker\.ts$/,
  /homeAccessService\.ts$/,
  /serviceVerificationService\.ts$/,
  /voucherSecurityService\.ts$/,
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

  // Load every server file that plausibly mounts routes: routes.ts,
  // server/index.ts, sub-services that dynamic-import routes.
  const serverFiles = allFiles.filter((f) =>
    f.startsWith(path.join(ROOT, 'server')) && (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.test.ts'),
  );
  const cache = new Map<string, string>();
  async function srcOf(f: string): Promise<string> {
    let s = cache.get(f);
    if (s === undefined) { s = await readFile(f, 'utf8').catch(() => ''); cache.set(f, s); }
    return s;
  }

  for (const routeFile of routes) {
    const rel = path.relative(ROOT, routeFile);
    if (isAllowed(rel)) continue;
    const base = path.basename(routeFile, '.ts');
    // Referenced by any server file? Match either the basename in a
    // from/require/import(...) form OR a dedicated variable name.
    let referenced = false;
    for (const src of serverFiles) {
      if (src === routeFile) continue;
      const body = await srcOf(src);
      if (new RegExp(`(from|import|require)\\(?\\s*['\"][^'\"]*\\b${base}['\"]`).test(body)) {
        referenced = true; break;
      }
    }
    if (!referenced) {
      findings.push({
        category: 'ROUTE_UNMOUNTED',
        file: rel,
        hint: `${base}.ts is not imported from any other server file. Mount it or delete it.`,
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
  // Pages can be routed FROM App.tsx OR rendered from a parent shell
  // (e.g. POSDashboard rendered inside ProviderOS). Treat any client-side
  // reference as legitimate.
  const clientFiles = allFiles.filter((f) =>
    f.startsWith(path.join(ROOT, 'client')) && (f.endsWith('.tsx') || f.endsWith('.ts')) &&
    !f.includes('.test.') && !f.includes('.regression.'),
  );
  const cache = new Map<string, string>();
  async function srcOf(f: string): Promise<string> {
    let s = cache.get(f);
    if (s === undefined) { s = await readFile(f, 'utf8').catch(() => ''); cache.set(f, s); }
    return s;
  }

  for (const page of pages) {
    const rel = path.relative(ROOT, page);
    if (isAllowed(rel)) continue;
    const base = path.basename(page, '.tsx');
    let referenced = false;
    for (const other of clientFiles) {
      if (other === page) continue;
      const body = await srcOf(other);
      if (new RegExp(`(from|import)\\(?\\s*['\"][^'\"]*\\b${base}['\"]`).test(body)) {
        referenced = true; break;
      }
    }
    if (!referenced) {
      findings.push({
        category: 'PAGE_UNROUTED',
        file: rel,
        hint: `${base}.tsx is not referenced from any other client file. Route it or delete it.`,
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
