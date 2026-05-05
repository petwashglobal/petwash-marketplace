/**
 * PR-W13 — VAT rate single source of truth.
 *
 * Pre-PR-W13 the platform had 24+ duplicate definitions of "0.18" — each
 * service file declared its own VAT_RATE / ISRAELI_VAT_RATE / ISRAEL_VAT_RATE
 * constant. When Israel last changed VAT (17% → 18% in Jan 2025) ops had
 * to hand-edit dozens of files and could miss any of them silently.
 *
 * The canonical constant is ISRAEL_VAT_RATE in shared/israel-compliance-config.ts.
 * PR-W13 makes every other VAT-rate source derive from this constant via
 * import (or via process.env.VAT_RATE || String(ISRAEL_VAT_RATE) for the
 * env-driven defaults). Behaviour is unchanged — every call site still
 * resolves to 0.18 — but a future rate change is a one-line edit.
 *
 * This test pins the invariant: scan every server/shared TypeScript file
 * and assert ZERO files (other than the canonical) declare a VAT rate
 * via a literal `0.18`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

const REPO = path.resolve(__dirname, '..', '..');
const CANONICAL = path.join(REPO, 'shared', 'israel-compliance-config.ts');

/** Recursively collect every .ts file under server/ and shared/, except node_modules / tests / worktrees. */
function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.claude' ||
        entry.name === 'worktrees' ||
        entry.name === 'tests'
      ) {
        continue;
      }
      collectTsFiles(full, acc);
    } else if (entry.isFile() && full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      // Skip test files anywhere
      if (full.includes('.test.') || full.includes('.spec.')) continue;
      acc.push(full);
    }
  }
  return acc;
}

const files = [
  ...collectTsFiles(path.join(REPO, 'server')),
  ...collectTsFiles(path.join(REPO, 'shared')),
];

describe('PR-W13 — VAT rate single source of truth', () => {
  it('canonical constant is exactly 0.18', () => {
    expect(ISRAEL_VAT_RATE).toBe(0.18);
  });

  it('canonical constant lives at shared/israel-compliance-config.ts', () => {
    const text = fs.readFileSync(CANONICAL, 'utf8');
    expect(text).toMatch(/^export const ISRAEL_VAT_RATE\s*=\s*0\.18;/m);
  });

  it('NO server/shared file (except the canonical) declares a duplicate VAT rate constant', () => {
    // A "duplicate declaration" is a top-level const/let with a name
    // matching VAT_RATE / ISRAELI_VAT_RATE / ISRAEL_VAT_RATE assigned
    // directly to the literal 0.18.
    const offenders: string[] = [];
    const declRegex = /^(?:export\s+)?(?:const|let)\s+(?:ISRAEL_VAT_RATE|ISRAELI_VAT_RATE|VAT_RATE)\s*=\s*0\.18\b/m;
    for (const f of files) {
      if (f === CANONICAL) continue;
      const text = fs.readFileSync(f, 'utf8');
      if (declRegex.test(text)) {
        offenders.push(path.relative(REPO, f));
      }
    }
    expect(offenders, `Files declaring a duplicate VAT rate:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('NO env-driven default falls back to the bare \'0.18\' string literal', () => {
    // process.env.VAT_RATE || '0.18' must use String(ISRAEL_VAT_RATE) instead.
    const offenders: string[] = [];
    const envFallbackRegex = /process\.env\.VAT_RATE\s*\|\|\s*['"]0\.18['"]/;
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      if (envFallbackRegex.test(text)) {
        offenders.push(path.relative(REPO, f));
      }
    }
    expect(offenders, `Files using bare '0.18' env default:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('audit-flagged services now import ISRAEL_VAT_RATE from the canonical', () => {
    // The 4 services the audit explicitly named must import the canonical.
    const auditFlagged = [
      'server/services/VATCalculatorService.ts',
      'server/services/LuxuryInvoiceService.ts',
      'server/services/PetWashOperationsOrchestrator.ts',
      'server/services/DailyReconciliationJob.ts',
      'server/services/ElectronicInvoicingService.ts',
    ];
    for (const rel of auditFlagged) {
      const text = fs.readFileSync(path.join(REPO, rel), 'utf8');
      expect(
        text,
        `${rel} must import ISRAEL_VAT_RATE from @shared/israel-compliance-config`,
      ).toMatch(/import\s*\{[^}]*\bISRAEL_VAT_RATE\b[^}]*\}\s*from\s*['"]@shared\/israel-compliance-config['"]/);
    }
  });

  it('no behaviour change: every import resolves to 0.18 (compile-time)', () => {
    // The whole point of PR-W13 is "no VAT behaviour change yet" — the
    // canonical value must remain 0.18. If a future PR drops the rate
    // to 0.17 (or raises to 0.19), THIS test must be updated as a
    // deliberate signal of an intentional rate change.
    expect(ISRAEL_VAT_RATE).toBe(0.18);
  });
});
