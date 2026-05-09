/**
 * Issue #153 PR-K — K9000 environment-presence guard.
 *
 * Forensic audit (PR #202) finding #11: in any environment where
 * MACHINE_ACTIVATION_URL was unset, the K9000 wash + redeem routes
 * either returned 503 (production only) OR logged a "DEMO MODE"
 * warning and proceeded to debit the wallet / accept a Nayax-
 * authorised charge while the physical machine was never commanded.
 *
 * The second branch is "fake machine success" — forbidden under
 * Rule H established in PR-CI-PAYMENT-MODE: "No fake success.
 * No log-only payout. No customer balance mutation without verified
 * payment source."
 *
 * CEO-approved scope (PR-K, narrow):
 *   "If MACHINE_ACTIVATION_URL is missing, do not debit/charge/return
 *    success. Fail clearly. No fake machine success."
 *
 * Locked invariants this suite enforces:
 *
 *   A. server/lib/k9000-env-guard.ts is the canonical source for the
 *      env-presence check. It is a pure read of process.env with no
 *      DB / vendor / money logic.
 *
 *   B. isK9000MachineConfigured() returns true when MACHINE_ACTIVATION_URL
 *      is set (any non-empty string), and false when it is unset or empty.
 *
 *   C. The wash route (POST /start_cycle) refuses with HTTP 503 when the
 *      env is missing, in ANY environment (no NODE_ENV qualifier).
 *
 *   D. The redeem route (POST /redeem) refuses with HTTP 503 when the
 *      env is missing, in ANY environment.
 *
 *   E. The "DEMO MODE — wallet will be debited but machine will NOT
 *      start" warn-and-continue branches are removed from executable
 *      code. No path remains where a wallet debit / Nayax authorisation
 *      proceeds without a configured machine command path.
 *
 *   F. The new helper module imports zero vendor SDKs (no Nayax /
 *      Tranzila / SUMIT / Stripe). It has no side effects.
 *
 *   G. No money-flow keyword (debit / refund / payout / Nayax / Tranzila /
 *      Stripe / SUMIT / wallet) is introduced by this PR's code in the
 *      env-guard helper itself.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { isK9000MachineConfigured } from '../lib/k9000-env-guard';

const ROOT = resolve(__dirname, '..', '..');
const helperSrc = readFileSync(resolve(ROOT, 'server/lib/k9000-env-guard.ts'), 'utf8');
const k9000Src = readFileSync(resolve(ROOT, 'server/routes/k9000.ts'), 'utf8');

// Strip comments so we only inspect executable code.
const k9000CodeOnly = k9000Src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── A. Helper purity + return values ─────────────────────────────────────

describe('PR-K — isK9000MachineConfigured() helper', () => {
  it('1. returns true when MACHINE_ACTIVATION_URL is a non-empty string', () => {
    expect(isK9000MachineConfigured({ MACHINE_ACTIVATION_URL: 'http://example.com' })).toBe(true);
  });

  it('2. returns false when MACHINE_ACTIVATION_URL is unset', () => {
    expect(isK9000MachineConfigured({})).toBe(false);
  });

  it('3. returns false when MACHINE_ACTIVATION_URL is an empty string', () => {
    expect(isK9000MachineConfigured({ MACHINE_ACTIVATION_URL: '' })).toBe(false);
  });

  it('4. helper performs a pure env read (no DB / vendor / money imports)', () => {
    expect(helperSrc).not.toMatch(/import[^;]*['"][^'"]*nayax[^'"]*['"]/i);
    expect(helperSrc).not.toMatch(/import[^;]*['"][^'"]*tranzila[^'"]*['"]/i);
    expect(helperSrc).not.toMatch(/import[^;]*['"][^'"]*stripe[^'"]*['"]/i);
    expect(helperSrc).not.toMatch(/import[^;]*['"][^'"]*sumit[^'"]*['"]/i);
    expect(helperSrc).not.toMatch(/from\s+['"][^'"]*\/db['"]/);
  });

  it('5. helper introduces no money-flow keyword (defence-in-depth)', () => {
    const codeOnly = helperSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/(debit|refund|payout|wallet|charge|authorize|capture)/i);
  });
});

// ── B. Wash route uses the helper, no NODE_ENV qualifier ──────────────────

describe('PR-K — wash route env-agnostic guard', () => {
  it('6. wash route imports isK9000MachineConfigured', () => {
    expect(k9000Src).toMatch(
      /import\s*\{\s*isK9000MachineConfigured\s*\}\s*from\s*['"][./]+lib\/k9000-env-guard['"]/,
    );
  });

  it('7. wash handler calls the helper and 503s when not configured', () => {
    // The K9000 Wash branch must contain the helper call AND the 503 status response.
    const startBlock = k9000Src.indexOf('K9000 Wash');
    expect(startBlock).toBeGreaterThan(0);
    const slice = k9000Src.slice(startBlock, startBlock + 6000);
    expect(slice).toMatch(/!isK9000MachineConfigured\(\)/);
    expect(slice).toMatch(/status\(503\)/);
    expect(slice).toMatch(/MACHINE_NOT_CONFIGURED/);
  });

  it('8. the prior "production-only" qualifier is gone from the wash guard', () => {
    // Defence: the old condition `process.env.NODE_ENV === 'production'`
    // immediately adjacent to a MACHINE_ACTIVATION_URL check is removed.
    expect(k9000CodeOnly).not.toMatch(
      /MACHINE_ACTIVATION_URL[\s\S]{0,80}NODE_ENV\s*===\s*['"]production['"]/,
    );
    expect(k9000CodeOnly).not.toMatch(
      /NODE_ENV\s*===\s*['"]production['"][\s\S]{0,80}MACHINE_ACTIVATION_URL/,
    );
  });
});

// ── C. Redeem route uses the helper, no NODE_ENV qualifier ────────────────

describe('PR-K — redeem route env-agnostic guard', () => {
  it('9. redeem handler calls the helper and 503s when not configured', () => {
    const redeemBlock = k9000Src.indexOf('K9000 Redeem');
    expect(redeemBlock).toBeGreaterThan(0);
    const slice = k9000Src.slice(redeemBlock, redeemBlock + 6000);
    expect(slice).toMatch(/!isK9000MachineConfigured\(\)/);
    expect(slice).toMatch(/status\(503\)/);
    expect(slice).toMatch(/MACHINE_NOT_CONFIGURED/);
  });

  it('10. the redeem route preserves correlationId in the 503 body', () => {
    // Operational continuity: the 503 must remain debuggable.
    const redeemBlock = k9000Src.indexOf('K9000 Redeem');
    const slice = k9000Src.slice(redeemBlock, redeemBlock + 6000);
    expect(slice).toMatch(/MACHINE_NOT_CONFIGURED[\s\S]{0,200}correlationId/);
  });
});

// ── D. DEMO-MODE warn-and-continue is gone ───────────────────────────────

describe('PR-K — fake-machine-success branches are removed', () => {
  it('11. wash route no longer logs "DEMO MODE — MACHINE_ACTIVATION_URL not set" then continues', () => {
    expect(k9000CodeOnly).not.toMatch(/K9000 Wash[\s\S]{0,500}DEMO MODE/);
  });

  it('12. redeem route no longer logs "DEMO MODE" warn-and-continue', () => {
    expect(k9000CodeOnly).not.toMatch(/K9000 Redeem[\s\S]{0,500}DEMO MODE/);
  });

  it('13. no executable path remains where wallet debit proceeds without MACHINE_ACTIVATION_URL', () => {
    // Defence-in-depth: the only remaining mention of "DEMO MODE" in the
    // file may exist inside comments/docstrings (those are stripped here);
    // there must be no logger.warn call mentioning DEMO MODE in code.
    expect(k9000CodeOnly).not.toMatch(/logger\.warn\([^)]*DEMO MODE[^)]*\)/);
    // And no logger.warn that says "Wallet will be debited but ... will NOT start"
    // remains in executable code.
    expect(k9000CodeOnly).not.toMatch(/Wallet will be debited[\s\S]{0,80}NOT start/);
    expect(k9000CodeOnly).not.toMatch(/Physical machine was NOT commanded/);
  });
});

// ── E. PR-K marker for traceability ───────────────────────────────────────

describe('PR-K — traceability marker', () => {
  it('14. the helper module mentions PR-K + Rule H + finding #11', () => {
    expect(helperSrc).toMatch(/PR-K/);
    expect(helperSrc).toMatch(/Rule H/);
    expect(helperSrc).toMatch(/finding #11|finding ?#?11/);
  });

  it('15. routes/k9000.ts mentions PR-K next to each guard site', () => {
    expect(k9000Src).toMatch(/PR-K/);
    const matches = k9000Src.match(/PR-K/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
