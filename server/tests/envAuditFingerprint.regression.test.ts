/**
 * M-DEPLOY-4 regression — env-audit must be stable against line drift.
 *
 * BEFORE M-DEPLOY-4: the audit gate failed any time a process.env read's
 * line number shifted — even if no real env-var change happened. This
 * blocked deploys ~5 times on 2026-05-23/24 (PRs #401, #408, #410, plus
 * the M-DEPLOY-2 drift between #406 and #407).
 *
 * AFTER M-DEPLOY-4: --check compares a STABLE FINGERPRINT keyed on
 * {varName, classification, hasModuleLoad, hasFunctionBody, hasGuard,
 *  readCount}. Line numbers in the rendered doc body are informational,
 * not part of the comparison.
 *
 * This file pins the contract via source-pin tests on the audit script
 * itself, so a future PR can't accidentally revert to the brittle
 * full-doc-string compare.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'audit-required-env-vars.ts');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'PRODUCTION_REQUIRED_ENV_VARS.md');

const SCRIPT_SRC = fs.readFileSync(SCRIPT_PATH, 'utf8');

describe('M-DEPLOY-4 — env-audit stable fingerprint', () => {
  it('declares a VarFingerprint shape including varName + classification + scope flags + guard + count', () => {
    expect(SCRIPT_SRC).toMatch(/interface VarFingerprint\s*\{[\s\S]*?\}/);
    const block =
      SCRIPT_SRC.match(/interface VarFingerprint\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(block).toMatch(/\bvarName: string;/);
    expect(block).toMatch(/classification:.*REQUIRED.*WARN.*OPTIONAL/);
    expect(block).toMatch(/hasModuleLoad: boolean;/);
    expect(block).toMatch(/hasFunctionBody: boolean;/);
    expect(block).toMatch(/hasGuard: boolean;/);
    expect(block).toMatch(/readCount: number;/);
    // The whole POINT of M-DEPLOY-4 is that line numbers are NOT in the
    // fingerprint. If somebody re-adds them, this test fails loudly.
    expect(block).not.toMatch(/\bline:\s*number/);
    expect(block).not.toMatch(/\bfile:\s*string/);
  });

  it('canonicalises the fingerprint by sorting varName-globally + omits file:line', () => {
    const block =
      SCRIPT_SRC.match(/function fingerprintHash[\s\S]*?\n\}/)?.[0] ?? '';
    expect(block).toMatch(/sort\(/);
    expect(block).toMatch(/varName\.localeCompare/);
    // Canonical key string must not contain a literal "line" or "file" key
    // — those would re-introduce the brittleness.
    const canonicalLine =
      block.match(/`\$\{f\.varName\}[\s\S]*?`/)?.[0] ?? '';
    expect(canonicalLine).not.toMatch(/file/i);
    expect(canonicalLine).not.toMatch(/\.line\b/);
  });

  it('--check compares fingerprints, NOT full rendered markdown', () => {
    // Find the CHECK_ONLY block and verify it does NOT compare `existing === rendered`
    // as the GATE decision. Line drift causes existing !== rendered but must NOT exit 5.
    const block =
      SCRIPT_SRC.match(/if \(CHECK_ONLY\)\s*\{[\s\S]*?\}\s*\n\s*writeFileSync/)?.[0] ?? '';
    // The new logic extracts fingerprints from both sides:
    expect(block).toMatch(/extractFingerprint\(existing\)/);
    expect(block).toMatch(/freshFingerprint/);
    // And gates on fingerprint equality, not doc equality:
    expect(block).toMatch(/existingFp === freshFingerprint/);
    // The OK branch may STILL note line drift (rendered != existing) — but
    // that path exits 0, not 5. Anchor on that exit ordering.
    const okIdx = block.indexOf('existingFp === freshFingerprint');
    const failExit5Idx = block.indexOf('process.exit(5)', okIdx);
    const okExit0Idx = block.indexOf('process.exit(0)', okIdx);
    expect(okExit0Idx).toBeGreaterThan(okIdx);
    expect(okExit0Idx).toBeLessThan(failExit5Idx); // exit 0 before any exit 5
  });

  it('embeds the fingerprint as an HTML comment marker in the rendered doc', () => {
    expect(SCRIPT_SRC).toMatch(/env-audit-fingerprint:/);
    expect(SCRIPT_SRC).toMatch(/<!--\s*env-audit-fingerprint:\s*\$\{fingerprint\}\s*-->/);
    // FINGERPRINT_MARKER_RE must capture a 16-hex-char value (sha256 prefix)
    expect(SCRIPT_SRC).toMatch(
      /FINGERPRINT_MARKER_RE\s*=\s*\/.*\[a-f0-9\]\{16\}/,
    );
  });

  it('the generated doc has a fingerprint header on line 1', () => {
    const docLines = fs.readFileSync(DOC_PATH, 'utf8').split('\n');
    expect(docLines[0]).toMatch(/<!-- env-audit-fingerprint: [a-f0-9]{16} -->/);
  });

  it('treats a missing fingerprint marker as a one-shot regen request (exit 5), not a silent pass', () => {
    // If somebody hand-edits the doc and strips the marker, --check must
    // refuse to validate. Otherwise the gate could be neutered by deleting
    // one line. Match up to process.exit(5) directly because the block body
    // contains template-literal `${...}` braces that would trip a lazy
    // brace-matching regex.
    const block =
      SCRIPT_SRC.match(/if \(existingFp === null\)[\s\S]*?process\.exit\(5\)/)?.[0] ?? '';
    expect(block).toMatch(/process\.exit\(5\)/);
    expect(block).toMatch(/missing the env-audit-fingerprint header/);
  });
});

describe('M-DEPLOY-4 — operator-facing messages', () => {
  // The whole point is to stop hours-long deploy outages from a stale line
  // number. Make sure the OK-with-drift case prints a clear "NOT a blocker"
  // message so operators know they don't need to ship a hotfix PR.

  it('prints a clear "informational only — NOT a deploy blocker" message on line drift', () => {
    expect(SCRIPT_SRC).toMatch(/informational only.*NOT a deploy blocker/);
  });

  it('print enumerates the 6 cases that DO change the fingerprint', () => {
    // The error message must teach the reviewer what counts as a "real"
    // change so a future engineer doesn't try to bypass it.
    const block = SCRIPT_SRC.match(/stable fingerprint changed[\s\S]*?exit\(5\)/)?.[0] ?? '';
    expect(block).toMatch(/new var added/i);
    expect(block).toMatch(/var removed/i);
    expect(block).toMatch(/classification changed/i);
    expect(block).toMatch(/MODULE_LOAD.*FUNCTION_BODY/i);
    expect(block).toMatch(/guard added.*removed/i);
    expect(block).toMatch(/read-site count changed/i);
  });
});
