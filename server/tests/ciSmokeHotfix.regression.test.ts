/**
 * Issue #153 PR-CI-SMOKE-HOTFIX — restore CI smoke green after PR-CI-PAYMENT-MODE.
 *
 * What broke:
 *   PR #203 (PR-CI-PAYMENT-MODE) added PAYMENT_PROVIDER_MODE=mock and
 *   removed real Nayax credentials from the CI smoke. The smoke ran the
 *   production container image without NAYAX_API_KEY for the first time,
 *   which exposed two pre-existing regressions that were silent until then:
 *
 *     (a) server/services/NayaxSparkService.ts:44 throws at module load
 *         when NODE_ENV=production AND !NAYAX_API_KEY, regardless of
 *         the new mode flags. CI smoke booted in mock mode but Nayax
 *         module FATAL'd anyway, blocking route registration.
 *
 *     (b) server/index.ts had inline `require(...)` calls inside an ESM
 *         module — ReferenceError: require is not defined. The /health
 *         handler hit it on every smoke poll, returning 500. Three
 *         additional sites (configHealth diagnostic + uncaughtException
 *         + unhandledRejection handlers) had the same bug and would
 *         have crashed once smoke got past the Nayax fix.
 *
 * Resolution (single purpose: "restore CI smoke green"):
 *   (a) NayaxSparkService.ts now consults isMockModeActive() +
 *       isNayaxEnabled() from the canonical payment-provider-mode
 *       module before the FATAL throw. In live production with Nayax
 *       enabled the original safety guarantee is preserved unchanged.
 *   (b) All 4 inline `require(...)` calls in server/index.ts replaced
 *       with top-level ESM imports (aliased to keep call sites
 *       readable and avoid identifier collisions).
 *
 * Locked invariants this suite enforces:
 *
 *   A. NayaxSparkService imports the canonical payment-provider-mode
 *      helpers and consults them before the FATAL throw.
 *   B. The original safety guarantee is preserved: in live production
 *      with Nayax enabled and NAYAX_API_KEY missing, the throw still
 *      fires (mock-mode and disabled-flag are explicit opt-outs only).
 *   C. server/index.ts contains NO `require(...)` calls anywhere
 *      (the entire ESM module is now require-free).
 *   D. server/index.ts has top-level imports for getBuildInfo,
 *      logStartupConfigDiagnostic, and SystemEventService.
 *   E. The /health handler uses the imported _getBuildInfo (not
 *      a re-required local), so /health renders cleanly.
 *   F. No new vendor SDK imports introduced.
 *   G. PR-CI-SMOKE-HOTFIX marker present for grepability.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const indexSrc = readFileSync(resolve(ROOT, 'server/index.ts'), 'utf8');
const nayaxSparkSrc = readFileSync(resolve(ROOT, 'server/services/NayaxSparkService.ts'), 'utf8');

const indexCodeOnly = indexSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const nayaxCodeOnly = nayaxSparkSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── A. Nayax mock-mode honour ─────────────────────────────────────────────

describe('PR-CI-SMOKE-HOTFIX — NayaxSparkService honours payment-provider-mode', () => {
  it('1. NayaxSparkService imports isMockModeActive + isNayaxEnabled', () => {
    expect(nayaxSparkSrc).toMatch(
      /import\s*\{[^}]*isMockModeActive[^}]*isNayaxEnabled[^}]*\}\s*from\s*['"][./]+lib\/payment-provider-mode['"]/,
    );
  });

  it('2. The throw guard combines IS_PRODUCTION + missing key + !MOCK + Nayax-enabled', () => {
    // The hardened guard must include the new flag references.
    expect(nayaxCodeOnly).toMatch(/MOCK_MODE\s*=\s*isMockModeActive\(\)/);
    expect(nayaxCodeOnly).toMatch(/NAYAX_FLAG_DISABLED\s*=\s*!isNayaxEnabled\(\)/);
    expect(nayaxCodeOnly).toMatch(
      /IS_PRODUCTION\s*&&\s*!NAYAX_API_KEY\s*&&\s*!MOCK_MODE\s*&&\s*!NAYAX_FLAG_DISABLED/,
    );
  });

  it('3. The original FATAL message is preserved (operator-readable)', () => {
    expect(nayaxSparkSrc).toMatch(
      /\[Nayax\] FATAL: NAYAX_API_KEY is not set in production environment/,
    );
  });

  it('4. The hardened error message points operators at the new escape hatches', () => {
    expect(nayaxSparkSrc).toMatch(/PAYMENT_PROVIDER_MODE=mock/);
    expect(nayaxSparkSrc).toMatch(/NAYAX_ENABLED=false/);
  });
});

// ── B. server/index.ts is require-free (ESM-correct) ──────────────────────

describe('PR-CI-SMOKE-HOTFIX — server/index.ts is ESM-correct', () => {
  it('5. server/index.ts has zero require(...) calls anywhere in executable code', () => {
    expect(indexCodeOnly).not.toMatch(/\brequire\s*\(/);
  });

  it('6. top-level import for getBuildInfo exists', () => {
    expect(indexSrc).toMatch(
      /import\s*\{[^}]*getBuildInfo[^}]*\}\s*from\s*['"][./]+lib\/buildInfo['"]/,
    );
  });

  it('7. top-level import for logStartupConfigDiagnostic exists', () => {
    expect(indexSrc).toMatch(
      /import\s*\{[^}]*logStartupConfigDiagnostic[^}]*\}\s*from\s*['"][./]+lib\/configHealth['"]/,
    );
  });

  it('8. top-level import for SystemEventService exists', () => {
    expect(indexSrc).toMatch(
      /import\s*\{[^}]*SystemEventService[^}]*\}\s*from\s*['"][./]+services\/SystemEventService['"]/,
    );
  });

  it('9. /health handler uses the imported _getBuildInfo() (not a re-required local)', () => {
    // Find the /health handler and confirm it calls the aliased import.
    const idx = indexSrc.indexOf('build:');
    expect(idx).toBeGreaterThan(0);
    const slice = indexSrc.slice(Math.max(0, idx - 200), idx + 200);
    expect(slice).toMatch(/build:\s*_getBuildInfo\(\)/);
  });
});

// ── C. No new vendor SDK introduced + traceability ────────────────────────

describe('PR-CI-SMOKE-HOTFIX — scope guard + traceability', () => {
  it('10. NayaxSparkService introduces no Stripe / Tranzila / SUMIT import', () => {
    expect(nayaxCodeOnly).not.toMatch(/import[^;]*['"][^'"]*stripe[^'"]*['"]/i);
    expect(nayaxCodeOnly).not.toMatch(/import[^;]*['"][^'"]*tranzila[^'"]*['"]/i);
    expect(nayaxCodeOnly).not.toMatch(/import[^;]*['"][^'"]*sumit[^'"]*['"]/i);
  });

  it('11. PR-CI-SMOKE-HOTFIX marker present in both touched files', () => {
    expect(nayaxSparkSrc).toMatch(/PR-CI-SMOKE-HOTFIX/);
    expect(indexSrc).toMatch(/PR-CI-SMOKE-HOTFIX/);
  });
});
