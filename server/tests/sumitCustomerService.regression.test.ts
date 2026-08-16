/**
 * Regression pin: SumitCustomerService respects SUMIT_CUSTOMER_SYNC_ENABLED
 * (Phase 2 of the SUMIT full-service adoption plan, CEO 2026-08-16).
 *
 * The point of this file: this whole subsystem must be INERT until the CEO
 * explicitly flips the flag in production. A future edit that removes the
 * flag check would silently start creating SUMIT customers for every user
 * on the next deploy. This test fails in that case.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Source-pin: read the two files verbatim and pin the behaviour by grep. This
// is the same pattern used by other *.regression.test.ts files in this repo
// — cheap, no infra, fires on the exact string that would signal a regression.
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SVC_PATH = resolve(__dirname, '../services/SumitCustomerService.ts');
const SVC = readFileSync(SVC_PATH, 'utf8');

describe('SumitCustomerService — flag semantics', () => {
  it('reads the flag from SUMIT_CUSTOMER_SYNC_ENABLED', () => {
    expect(SVC).toContain("process.env.SUMIT_CUSTOMER_SYNC_ENABLED === 'true'");
  });

  it('defaults the flag to OFF (no permissive default)', () => {
    // Not merely !=='false' or a truthy check; must be strict === 'true'.
    expect(SVC).not.toMatch(/SUMIT_CUSTOMER_SYNC_ENABLED\s*!==\s*['"]false['"]/);
    expect(SVC).not.toMatch(/SUMIT_CUSTOMER_SYNC_ENABLED\s*\|\|/);
  });

  it('syncForUser bails out early when the flag is off — before any SUMIT call', () => {
    // The early-exit MUST come before the `client.createCustomer` call site,
    // otherwise a caller with the flag off could still trigger an HTTP.
    const flagCheckIdx = SVC.indexOf("!isSumitCustomerSyncEnabled()");
    const sumitCallIdx = SVC.indexOf('await client.createCustomer(');
    expect(flagCheckIdx).toBeGreaterThan(-1);
    expect(sumitCallIdx).toBeGreaterThan(flagCheckIdx);
  });

  it("fire-and-forget wrapper doesn't await into caller error handling", () => {
    // fireAndForgetSync must NOT propagate errors to its caller — signup /
    // activation must never fail because SUMIT is degraded. Strip comments
    // then check the fireAndForgetSync body has no `throw` statement (the
    // word appears in doc comments elsewhere, so we filter those out).
    const codeOnly = SVC
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    const start = codeOnly.indexOf('export function fireAndForgetSync');
    expect(start).toBeGreaterThan(-1);
    const nextExport = codeOnly.indexOf('\nexport ', start + 1);
    const body = nextExport === -1 ? codeOnly.slice(start) : codeOnly.slice(start, nextExport);
    expect(body).toContain('.catch((err)');
    expect(body).not.toMatch(/\bthrow\s+/);
  });

  it('caller-side idempotency pre-checks sumit_customers before the HTTP call', () => {
    const preCheckIdx = SVC.indexOf('from(sumitCustomers)');
    const sumitCallIdx = SVC.indexOf('await client.createCustomer(');
    expect(preCheckIdx).toBeGreaterThan(-1);
    expect(preCheckIdx).toBeLessThan(sumitCallIdx);
  });
});

describe('SumitClient.createCustomer — safety pins', () => {
  const CLIENT_PATH = resolve(__dirname, '../services/SumitClient.ts');
  const CLIENT = readFileSync(CLIENT_PATH, 'utf8');

  it('returns {wired:false} without calling fetch when not wired', () => {
    // The wired-gate MUST come before any fetch call in the createCustomer
    // block. Search for the block bounds and confirm the ordering.
    const start = CLIENT.indexOf('async createCustomer(input:');
    expect(start).toBeGreaterThan(-1);
    const block = CLIENT.slice(start, start + 4000);
    const wiredIdx = block.indexOf('if (!isWired())');
    const fetchIdx = block.indexOf('await fetch(url');
    expect(wiredIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(wiredIdx);
  });

  it('uses ExternalIdentifier as the SUMIT-side idempotency handle', () => {
    const start = CLIENT.indexOf('async createCustomer(input:');
    const block = CLIENT.slice(start, start + 4000);
    expect(block).toContain('ExternalIdentifier: input.externalIdentifier');
    expect(block).toContain("'Idempotency-Key': `customer:${input.externalIdentifier}`");
  });

  it("never sends national-id / bank details in the customer body (money invariants §5)", () => {
    const start = CLIENT.indexOf('async createCustomer(input:');
    const block = CLIENT.slice(start, start + 4000);
    // Body must NOT contain any of these fields.
    for (const forbidden of ['idNumber', 'nationalId', 'teudatZehut', 'bankAccount', 'iban', 'taxId', 'ssn']) {
      expect(block).not.toContain(forbidden);
    }
  });
});
