/**
 * Issue #153 PR-CONFIG-HEALTH — env-var manifest + presence-only health endpoint.
 *
 * CEO directive — External API / Secrets / Cloud Configuration Reality Audit.
 *
 *   "fail clearly instead of silent failure … add startup diagnostics that
 *    report missing env var names only … add admin-only config health
 *    endpoint with redacted status … do not print secret values … only
 *    print whether present/missing/malformed by name."
 *
 * This regression suite locks the canonical manifest, the presence-only
 * report shape, the boot-time logger contract, and the admin endpoint
 * wiring. The non-negotiable invariant is enforced explicitly: the
 * helper module must NOT read or echo any env-var VALUE — only its
 * presence.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  CONFIG_MANIFEST,
  buildConfigHealthReport,
  logStartupConfigDiagnostic,
  type EnvVarSpec,
} from '../lib/configHealth';

const ROOT = resolve(__dirname, '..', '..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const MARKER = 'PR-CONFIG-HEALTH-TEST-VALUE-do-not-leak';

// ── A. MANIFEST INTEGRITY ─────────────────────────────────────────────────

describe('CONFIG_MANIFEST integrity', () => {
  it('1. every entry has a name, category, and description', () => {
    expect(CONFIG_MANIFEST.length).toBeGreaterThan(20);
    for (const spec of CONFIG_MANIFEST) {
      expect(typeof spec.name).toBe('string');
      expect(spec.name.length).toBeGreaterThan(0);
      expect(['required', 'recommended', 'optional']).toContain(spec.category);
      expect(typeof spec.description).toBe('string');
      expect(spec.description.length).toBeGreaterThan(0);
    }
  });

  it('2. every name is unique (no duplicate entries)', () => {
    const names = CONFIG_MANIFEST.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('3. covers the launch-critical surfaces flagged by the audit', () => {
    const names = CONFIG_MANIFEST.map((s) => s.name);
    // P0 launch-blockers from Lane R1 + R2
    for (const required of [
      'DATABASE_URL',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_PHONE_NUMBER',
      'RECAPTCHA_SECRET_KEY',
      'VITE_RECAPTCHA_SITE_KEY',
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'MACHINE_SECRET_KEY',
    ]) {
      expect(names).toContain(required);
    }
    // P1 / P2 recommended + optional
    for (const optional of ['SENDGRID_API_KEY', 'GOOGLE_MAPS_API_KEY', 'REDIS_URL']) {
      expect(names).toContain(optional);
    }
  });

  it('4. description never contains a value-shaped substring (no inline placeholder leaks)', () => {
    // Sanity: descriptions must not look like JWTs, API keys, GUIDs, etc.
    const valueShaped = /(eyJ[A-Za-z0-9_-]{10,})|([A-Za-z0-9]{32,})|(AKIA[0-9A-Z]{16})/;
    for (const spec of CONFIG_MANIFEST) {
      expect(spec.description).not.toMatch(valueShaped);
    }
  });
});

// ── B. PRESENCE-ONLY GUARANTEE ────────────────────────────────────────────

describe('buildConfigHealthReport presence-only contract', () => {
  beforeEach(() => {
    // Clean up any test-only env vars we set
    for (const spec of CONFIG_MANIFEST) {
      if (process.env[spec.name] === MARKER) delete process.env[spec.name];
    }
  });

  it('5. report flags present env vars without echoing their values', () => {
    const sample: EnvVarSpec | undefined = CONFIG_MANIFEST.find((s) => s.category === 'optional');
    expect(sample).toBeTruthy();
    process.env[sample!.name] = MARKER;
    const report = buildConfigHealthReport();
    expect(report.status[sample!.name].present).toBe(true);
    // The value MUST not appear anywhere in the report payload
    const json = JSON.stringify(report);
    expect(json).not.toContain(MARKER);
    delete process.env[sample!.name];
  });

  it('6. missing required vars surface in missingRequired (names only)', () => {
    const required = CONFIG_MANIFEST.filter((s) => s.category === 'required');
    const before: Record<string, string | undefined> = {};
    for (const spec of required) {
      before[spec.name] = process.env[spec.name];
      delete process.env[spec.name];
    }
    const report = buildConfigHealthReport();
    for (const spec of required) {
      expect(report.missingRequired).toContain(spec.name);
      expect(report.status[spec.name].present).toBe(false);
    }
    // restore
    for (const spec of required) {
      if (before[spec.name] !== undefined) process.env[spec.name] = before[spec.name];
    }
  });

  it('7. report shape is stable: { generatedAt, nodeEnv, total, presentCount, missingRequired, missingRecommended, status }', () => {
    const report = buildConfigHealthReport();
    expect(typeof report.generatedAt).toBe('string');
    expect(typeof report.nodeEnv).toBe('string');
    expect(typeof report.total).toBe('number');
    expect(typeof report.presentCount).toBe('number');
    expect(Array.isArray(report.missingRequired)).toBe(true);
    expect(Array.isArray(report.missingRecommended)).toBe(true);
    expect(typeof report.status).toBe('object');
    expect(report.total).toBe(CONFIG_MANIFEST.length);
  });

  it('8. status values contain only { present: boolean, category, description } — never a "value" key', () => {
    const report = buildConfigHealthReport();
    for (const [name, status] of Object.entries(report.status)) {
      expect(typeof status.present).toBe('boolean');
      expect(['required', 'recommended', 'optional']).toContain(status.category);
      expect(typeof status.description).toBe('string');
      expect(Object.keys(status).sort()).toEqual(['category', 'description', 'present']);
      expect((status as any).value).toBeUndefined();
      // Bonus: name itself never contains the placeholder
      expect(name).not.toContain(MARKER);
    }
  });

  it('9. logStartupConfigDiagnostic returns the report (and does not throw on missing vars)', () => {
    const r = logStartupConfigDiagnostic();
    expect(r).toBeDefined();
    expect(r.total).toBe(CONFIG_MANIFEST.length);
  });

  it('10. an env value containing common secret-shaped strings is NOT echoed in report', () => {
    const target = CONFIG_MANIFEST.find((s) => s.category === 'optional');
    expect(target).toBeTruthy();
    // Simulate a JWT-shaped value to make sure no placeholder leaks
    const jwtShaped = 'eyJ' + 'A'.repeat(60) + '.' + 'B'.repeat(60) + '.' + 'C'.repeat(43);
    process.env[target!.name] = jwtShaped;
    const report = buildConfigHealthReport();
    const json = JSON.stringify(report);
    expect(json).not.toContain(jwtShaped);
    delete process.env[target!.name];
  });
});

// ── C. SOURCE-PIN: STARTUP + ROUTES WIRING ────────────────────────────────

describe('PR-CONFIG-HEALTH wiring source pins', () => {
  it('11. server/index.ts logs the diagnostic at boot (production listen)', () => {
    const src = read('server/index.ts');
    expect(src).toMatch(/logStartupConfigDiagnostic\(\)/);
  });

  it('12. server/routes.ts registers GET /api/admin/config-health with requireAdmin', () => {
    const src = read('server/routes.ts');
    expect(src).toMatch(
      /app\.get\(\s*['"]\/api\/admin\/config-health['"]\s*,\s*requireAdmin\s*,/,
    );
  });

  it('13. config-health handler is read-only — no INSERT / UPDATE / DELETE', () => {
    const src = read('server/routes.ts');
    const idx = src.indexOf("'/api/admin/config-health'");
    expect(idx).toBeGreaterThan(0);
    const handlerEnd = src.indexOf('});', idx + 100) + 3;
    const handlerSrc = src.slice(idx, handlerEnd);
    expect(handlerSrc).not.toMatch(/db\.insert\(/);
    expect(handlerSrc).not.toMatch(/db\.update\(/);
    expect(handlerSrc).not.toMatch(/db\.delete\(/);
  });

  it('14. config-health handler returns the report from buildConfigHealthReport (no value echoing)', () => {
    const src = read('server/routes.ts');
    const idx = src.indexOf("'/api/admin/config-health'");
    const handlerEnd = src.indexOf('});', idx + 100) + 3;
    const handlerSrc = src.slice(idx, handlerEnd);
    expect(handlerSrc).toMatch(/buildConfigHealthReport\(\)/);
    // Critical: the handler MUST NOT introduce any process.env reads of
    // its own — only the manifest path is allowed.
    expect(handlerSrc).not.toMatch(/process\.env\./);
  });

  it('15. configHealth helper does NOT read process.env values into return data', () => {
    const src = read('server/lib/configHealth.ts');
    // The helper may use `name in process.env` and `process.env[name]` for
    // a non-empty-string check, but must NOT include a value or its prefix
    // in the report.
    expect(src).not.toMatch(/value:\s*process\.env/);
    expect(src).not.toMatch(/process\.env\[\w+\]\s*\|\|\s*['"][^'"]+['"]/);
    // The export surface
    expect(src).toMatch(/export\s+const\s+CONFIG_MANIFEST/);
    expect(src).toMatch(/export\s+function\s+buildConfigHealthReport/);
    expect(src).toMatch(/export\s+function\s+logStartupConfigDiagnostic/);
  });
});
