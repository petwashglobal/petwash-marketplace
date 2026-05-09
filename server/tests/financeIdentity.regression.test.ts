/**
 * Issue #153 PR-G — canonical legal-identity module + tax-id literal fix.
 *
 * Forensic audit (#202) finding F-01: company tax id 516788400 was hardcoded
 * across 13 runtime sites. The correct Pet Wash Ltd Israeli company number
 * (also serves as עוסק מורשה / VAT registration number) is 517145033 per
 * the incorporation certificate.
 *
 * CEO directive 2026-05-09 (paraphrased):
 *   "Replace wrong hardcoded 516788400 with correct Pet Wash Ltd company
 *    number 517145033. This is a legal identity correctness fix, not finance
 *    logic. Source-pin test must prevent old number returning.
 *    Use this ONLY through a centralized finance configuration/domain layer.
 *    Never hardcode in services/routes/controllers again."
 *
 * Locked invariants this suite enforces:
 *
 *   A. shared/finance-identity.ts is the canonical source of legal identity
 *      and exports the correct values:
 *        COMPANY_TAX_ID = '517145033'
 *        COMPANY_NAME_EN = 'PET WASH LTD'
 *        COMPANY_NAME_HE = 'פט וואש בע"מ'
 *        COMPANY_LEI_CODE = 'IL-517145033'
 *      Helper functions return non-empty strings containing the canonical id.
 *
 *   B. The canonical module is BANK-IDENTITY-FREE — bank account, IBAN,
 *      SWIFT, branch are NOT exported here. Banking lives in
 *      server/services/TreasuryConfigService.ts (encrypted at rest).
 *
 *   C. The wrong literal '516788400' does NOT appear in any runtime source
 *      file (server/* or client/*). The only permitted occurrences are:
 *        - shared/schema.ts             (column DEFAULT — schema migration
 *                                         follow-up; declared out of scope)
 *        - shared/schema-payments.ts    (column DEFAULT — same)
 *        - shared/finance-identity.ts   (one historical-reference comment
 *                                         explaining the migration)
 *        - any file under tests/         (test fixtures — allowed)
 *
 *   D. Each migrated runtime site reads from the canonical module (positive
 *      proof) so that future literal regressions are caught at review time.
 *
 *   E. Schema column DEFAULTs that still hold the wrong literal are
 *      explicitly accounted for in this test as "follow-up migration PR";
 *      this prevents silent drift while keeping PR-G narrow.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

import {
  COMPANY_TAX_ID,
  COMPANY_VAT_NUMBER,
  COMPANY_NAME_EN,
  COMPANY_NAME_HE,
  COMPANY_LEI_CODE,
  getCompanyVatLineHe,
  getCompanyVatLineEn,
  getCompanyAuditLabel,
  getCompanyTaxId,
} from '@shared/finance-identity';

const ROOT = resolve(__dirname, '..', '..');

// ── A. Canonical exports are correct ──────────────────────────────────────

describe('PR-G — canonical legal-identity exports', () => {
  it('1. COMPANY_TAX_ID is the verified Israeli company number 517145033', () => {
    expect(COMPANY_TAX_ID).toBe('517145033');
    expect(COMPANY_VAT_NUMBER).toBe('517145033');
    expect(getCompanyTaxId()).toBe('517145033');
  });

  it('2. Company name surface is correct (English + Hebrew)', () => {
    expect(COMPANY_NAME_EN).toBe('PET WASH LTD');
    expect(COMPANY_NAME_HE).toBe('פט וואש בע"מ');
  });

  it('3. LEI code is derived from the canonical id', () => {
    expect(COMPANY_LEI_CODE).toBe('IL-517145033');
  });

  it('4. Hebrew + English VAT lines embed the canonical id', () => {
    expect(getCompanyVatLineHe()).toBe('עוסק מורשה: 517145033');
    expect(getCompanyVatLineEn()).toBe('VAT No: 517145033');
  });

  it('5. Audit label shape is canonical', () => {
    expect(getCompanyAuditLabel()).toBe('PET WASH LTD (VAT 517145033)');
  });
});

// ── B. Canonical module is BANK-FREE ──────────────────────────────────────

describe('PR-G — canonical module is bank-identity-free (banking lives elsewhere)', () => {
  const moduleSrc = readFileSync(
    resolve(ROOT, 'shared/finance-identity.ts'),
    'utf8',
  );

  it('6. No bank account number, IBAN, SWIFT, or branch number is exported', () => {
    expect(moduleSrc).not.toMatch(/082526/);
    expect(moduleSrc).not.toMatch(/IL41[\s_]/);
    expect(moduleSrc).not.toMatch(/MIZBILIT/);
    // Branch number 422 may appear but only in TreasuryConfigService docstring;
    // it must NOT appear as an exported constant in this module.
    expect(moduleSrc).not.toMatch(/export\s+const\s+\w*BANK_/i);
    expect(moduleSrc).not.toMatch(/export\s+const\s+\w*IBAN/i);
    expect(moduleSrc).not.toMatch(/export\s+const\s+\w*SWIFT/i);
  });

  it('7. Module docstring redirects bank identity to TreasuryConfigService', () => {
    expect(moduleSrc).toMatch(/TreasuryConfigService/);
    expect(moduleSrc).toMatch(/AES-256/);
  });
});

// ── C. Wrong literal is gone from runtime sources ─────────────────────────

describe('PR-G — the wrong literal 516788400 is gone from runtime sources', () => {
  // Allowed exceptions:
  //   • shared/schema.ts           (column DEFAULT — schema migration follow-up)
  //   • shared/schema-payments.ts  (column DEFAULT — same)
  //   • shared/finance-identity.ts (one historical-reference comment)
  //   • any file under server/tests / *.test.ts (fixtures)
  const ALLOWED_EXCEPTIONS = new Set([
    resolve(ROOT, 'shared/schema.ts'),
    resolve(ROOT, 'shared/schema-payments.ts'),
    resolve(ROOT, 'shared/finance-identity.ts'),
  ]);

  function walk(dir: string, hits: string[]) {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full, hits);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx|html)$/.test(entry)) continue;
      if (/\.test\.(ts|tsx|js|jsx)$/.test(entry)) continue;
      const text = readFileSync(full, 'utf8');
      if (text.includes('516788400') && !ALLOWED_EXCEPTIONS.has(full)) {
        hits.push(full);
      }
    }
  }

  it('8. No runtime source file contains the wrong literal 516788400', () => {
    const hits: string[] = [];
    walk(resolve(ROOT, 'server'), hits);
    walk(resolve(ROOT, 'client'), hits);
    walk(resolve(ROOT, 'shared'), hits);
    expect(hits).toEqual([]);
  });

  it('9. The two schema-DEFAULT exceptions are explicitly accounted for (follow-up migration)', () => {
    // This is a *negative* test that fails LOUDLY if either schema file
    // is silently changed AND the historical default is silently removed.
    // It documents the scope split between PR-G (runtime) and the future
    // schema-default migration PR.
    const schemaSrc = readFileSync(resolve(ROOT, 'shared/schema.ts'), 'utf8');
    const schemaPaySrc = readFileSync(resolve(ROOT, 'shared/schema-payments.ts'), 'utf8');
    expect(schemaSrc).toMatch(/company_tax_id["']?\)\s*\.default\(["']516788400["']/);
    expect(schemaPaySrc).toMatch(/vat_number["']?\)\s*\.default\(["']516788400["']/);
  });
});

// ── D. Migrated sites read from the canonical module ──────────────────────

describe('PR-G — migrated sites read from shared/finance-identity', () => {
  function read(rel: string): string {
    return readFileSync(resolve(ROOT, rel), 'utf8');
  }

  it('10. IsraeliInvoiceGenerator imports + uses getCompanyVatLineHe + getCompanyVatLineEn', () => {
    const src = read('server/services/IsraeliInvoiceGenerator.ts');
    expect(src).toMatch(/from\s+['"]@shared\/finance-identity['"]/);
    expect(src).toMatch(/getCompanyVatLineHe\(\)/);
    expect(src).toMatch(/getCompanyVatLineEn\(\)/);
  });

  it('11. VATCalculatorService imports COMPANY_TAX_ID and uses it at every former literal site', () => {
    const src = read('server/services/VATCalculatorService.ts');
    expect(src).toMatch(/from\s+['"]@shared\/finance-identity['"]/);
    const matches = src.match(/companyTaxId:\s*COMPANY_TAX_ID/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it('12. DriveArchivalService imports + uses canonical constants for the seller line', () => {
    const src = read('server/services/DriveArchivalService.ts');
    expect(src).toMatch(/from\s+['"]@shared\/finance-identity['"]/);
    expect(src).toMatch(/\$\{COMPANY_NAME_EN\}\s+\(VAT\s+\$\{COMPANY_TAX_ID\}\)/);
  });

  it('13. TaxDocumentService env fallback now points to COMPANY_TAX_ID', () => {
    const src = read('server/services/TaxDocumentService.ts');
    expect(src).toMatch(/from\s+['"]@shared\/finance-identity['"]/);
    expect(src).toMatch(
      /process\.env\.COMPANY_VAT_NUMBER\s*\|\|\s*COMPANY_TAX_ID/,
    );
  });

  it('14. notificationDispatcher email footer uses COMPANY_TAX_ID', () => {
    const src = read('server/lib/notificationDispatcher.ts');
    expect(src).toMatch(/from\s+['"]@shared\/finance-identity['"]/);
    expect(src).toMatch(/VAT\s+\$\{COMPANY_TAX_ID\}/);
  });

  it('15. transaction-audit admin route uses canonical constants', () => {
    const src = read('server/routes/finance/transaction-audit.ts');
    expect(src).toMatch(/from\s+['"]@shared\/finance-identity['"]/);
    expect(src).toMatch(/taxId:\s*COMPANY_TAX_ID/);
    expect(src).toMatch(/name:\s*COMPANY_NAME_EN/);
    expect(src).toMatch(/nameHe:\s*COMPANY_NAME_HE/);
  });

  it('16. client/index.html JSON-LD has the corrected vatID + leiCode literals', () => {
    const src = read('client/index.html');
    expect(src).toMatch(/"vatID":\s*"517145033"/);
    expect(src).toMatch(/"leiCode":\s*"IL-517145033"/);
  });

  it('17. DaycareCalculator UI line reads COMPANY_TAX_ID via shared module', () => {
    const src = read('client/src/pages/DaycareCalculator.tsx');
    expect(src).toMatch(/from\s+['"]@shared\/finance-identity['"]/);
    expect(src).toMatch(/Reg\.\s+\{COMPANY_TAX_ID\}/);
  });
});

// ── E. PR-G marker present in the canonical module ────────────────────────

describe('PR-G — traceability marker', () => {
  it('18. shared/finance-identity.ts mentions PR-G + 517145033 + 02/04/2025', () => {
    const src = readFileSync(resolve(ROOT, 'shared/finance-identity.ts'), 'utf8');
    expect(src).toMatch(/PR-G/);
    expect(src).toMatch(/517145033/);
    expect(src).toMatch(/02\/04\/2025/);
  });
});
