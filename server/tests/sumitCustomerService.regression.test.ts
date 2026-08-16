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

describe('SumitClient.createCustomer — official SUMIT contract pins', () => {
  const CLIENT_PATH = resolve(__dirname, '../services/SumitClient.ts');
  const CLIENT = readFileSync(CLIENT_PATH, 'utf8');

  // Body from docs/PROVIDER_FINANCE_SUMIT_INTEGRATION_AUDIT_V2.md §3.1:
  //   { Details: AccountingTypedCustomer, Credentials }
  //   AccountingTypedCustomer: { Name, EmailAddress, Phone, ExternalIdentifier,
  //                              SearchMode: "Automatic"|"None", NoVAT, ... }
  //   Response: { CustomerID, CustomerHistoryURL }

  const start = CLIENT.indexOf('async createCustomer(input:');
  const block = CLIENT.slice(start, start + 5000);

  it('createCustomer method exists', () => {
    expect(start).toBeGreaterThan(-1);
  });

  it('returns {wired:false} without calling fetch when not wired', () => {
    const wiredIdx = block.indexOf('if (!isWired())');
    const fetchIdx = block.indexOf('await fetch(url');
    expect(wiredIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(wiredIdx);
  });

  it('wraps the body in Details: (per official contract, NOT Customer:)', () => {
    expect(block).toMatch(/Details:\s*{/);
    // Must NOT use the wrong wrap key Customer: at the body top level.
    // (Details.Customer is a DIFFERENT thing used in /documents/create/ — this
    // is /customers/create/ where the wrap key is Details itself.)
    const bodyIdx = block.indexOf('const body = {');
    const bodyBlock = block.slice(bodyIdx, bodyIdx + 800);
    expect(bodyBlock).not.toMatch(/^\s*Customer:\s*{/m);
  });

  it('sends SearchMode:"Automatic" for find-or-create dedup', () => {
    expect(block).toContain("SearchMode: 'Automatic'");
  });

  it('sends the official Phone field (not PhoneNumber)', () => {
    expect(block).toContain('Phone: input.phone || undefined');
    expect(block).not.toContain('PhoneNumber:');
  });

  it('uses ExternalIdentifier as the SUMIT-side idempotency handle', () => {
    expect(block).toContain('ExternalIdentifier: input.externalIdentifier');
    expect(block).toContain("'Idempotency-Key': `customer:${input.externalIdentifier}`");
  });

  it('parses response with the official field names — no heuristic fallback list', () => {
    // CustomerID and CustomerHistoryURL are the documented fields. Do NOT
    // add heuristic parsing (e.g. b.customerId ?? b.Data?.CustomerID ?? …).
    expect(block).toContain('b.CustomerID');
    expect(block).toContain('b.CustomerHistoryURL');
    // No fallback to lowercase or nested Data/Customer wrappers.
    expect(block).not.toContain('b.customerId');
    expect(block).not.toContain('(b.Data as');
  });

  it("never sends national-id / bank details in the customer body (money invariants §5)", () => {
    for (const forbidden of ['idNumber', 'nationalId', 'teudatZehut', 'bankAccount', 'iban', 'taxId', 'ssn']) {
      expect(block).not.toContain(forbidden);
    }
  });
});
