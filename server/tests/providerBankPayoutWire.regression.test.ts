/**
 * CEO §73 #12 (2026-08-28) — bank / payout target on the provider application.
 *
 * The super_app_payouts rail carried provider_bank_iban /
 * provider_bank_name for months, but the provider wizard NEVER
 * collected them at intake — every approved provider ended up with a
 * payout row pointing at a null IBAN. Admin had to open Postgres by
 * hand to fill in the target before payout ran.
 *
 * MVP wire (this commit): migration 0133 adds the columns on
 * provider_applications, /apply accepts them (with a normalisation
 * pass — IBAN uppercased + spaces stripped), a best-effort UPDATE
 * writes them post-INSERT so a rolling deploy without the column
 * doesn't fail every submission, and the admin ProviderKycReview
 * surface renders them behind a data-present gate.
 *
 * Client wizard section is a follow-up (ProviderOnboarding.tsx 1963-line
 * monolith needs its own PR). This test pins the SERVER + ADMIN halves
 * of the wire so a client update can land safely against a running
 * server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const R = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
const S = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'shared', rel), 'utf8');
const C = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'client', 'src', rel), 'utf8');
const M = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'migrations', rel), 'utf8');

describe('provider bank / payout wire (CEO §73 #12)', () => {
  describe('migration 0133 adds bank columns on provider_applications', () => {
    const sql = M('0133_provider_applications_bank_payout_2026_08_28.sql');
    it('adds bank_name / bank_branch_code / bank_iban / bank_account_holder / bank_details_at', () => {
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS bank_name\s+varchar/);
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS bank_branch_code\s+varchar/);
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS bank_iban\s+varchar/);
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS bank_account_holder\s+varchar/);
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS bank_details_at\s+timestamp/);
    });
    it('is additive-only (no destructive DROP)', () => {
      expect(sql).not.toMatch(/DROP COLUMN|DROP TABLE|TRUNCATE/i);
    });
  });

  describe('shared schema — Drizzle bank columns match the migration', () => {
    const schema = S('schema.ts');
    it('providerApplications carries bankName / bankBranchCode / bankIban / bankAccountHolder / bankDetailsAt', () => {
      const start = schema.indexOf('export const providerApplications = pgTable("provider_applications"');
      const end   = schema.indexOf('export const', start + 10);
      expect(start).toBeGreaterThan(0);
      const block = schema.slice(start, end);
      expect(block).toMatch(/bankName:\s*varchar\("bank_name"/);
      expect(block).toMatch(/bankBranchCode:\s*varchar\("bank_branch_code"/);
      expect(block).toMatch(/bankIban:\s*varchar\("bank_iban"/);
      expect(block).toMatch(/bankAccountHolder:\s*varchar\("bank_account_holder"/);
      expect(block).toMatch(/bankDetailsAt:\s*timestamp\("bank_details_at"/);
    });
  });

  describe('/apply reads bank fields off req.body and normalises them', () => {
    const src = R('routes/provider-onboarding.ts');
    it('destructures the four bank fields', () => {
      expect(src).toMatch(/bankName:\s*rawBankName/);
      expect(src).toMatch(/bankBranchCode:\s*rawBankBranchCode/);
      expect(src).toMatch(/bankIban:\s*rawBankIban/);
      expect(src).toMatch(/bankAccountHolder:\s*rawBankAccountHolder/);
    });
    it('IBAN is stripped of spaces and uppercased (canonical wire format)', () => {
      expect(src).toMatch(/rawBankIban\.replace\(\/\\s\+\/g, ''\)\.toUpperCase\(\)/);
    });
    it('bankDetailsAt stamps only when at least one bank field is present', () => {
      // Empty submission (client not yet updated) leaves the timestamp
      // null — admin can filter "bank details missing" via IS NULL.
      expect(src).toMatch(/const bankDetailsAt: Date \| null =\s*\n?\s*\(bankIban \|\| bankName \|\| bankBranchCode \|\| bankAccountHolder\) \? new Date\(\) : null/);
    });
  });

  describe('post-INSERT UPDATE persists bank fields with migration-window safety', () => {
    const src = R('routes/provider-onboarding.ts');
    it('writes bank fields via a best-effort UPDATE (kept out of the primary INSERT)', () => {
      expect(src).toMatch(/Persist bank \/ payout target \(best-effort, AFTER insert\)/);
      expect(src).toMatch(/db\s*\n?\s*\.update\(providerApplications\)/);
      expect(src).toMatch(/bankName,\s*\n\s*bankBranchCode,\s*\n\s*bankIban,\s*\n\s*bankAccountHolder,\s*\n\s*bankDetailsAt,/);
    });
    it('42703 (undefined_column) is a warn — an older deploy without the migration never crashes /apply', () => {
      expect(src).toMatch(/bankPersistErr\?\.code === '42703'/);
      expect(src).toMatch(/Bank\/payout persist skipped/);
    });
    it('any other error surfaces at ERROR — real persist failures are never lost silently', () => {
      expect(src).toMatch(/Bank\/payout persist FAILED \(not a migration issue\)/);
    });
  });

  describe('admin surface renders bank / payout card behind a data-present gate', () => {
    const src = C('pages/admin/ProviderKycReview.tsx');
    it('declares the four bank fields on the KycApplication interface', () => {
      expect(src).toMatch(/bankName\?:\s*string\s*\|\s*null/);
      expect(src).toMatch(/bankBranchCode\?:\s*string\s*\|\s*null/);
      expect(src).toMatch(/bankIban\?:\s*string\s*\|\s*null/);
      expect(src).toMatch(/bankAccountHolder\?:\s*string\s*\|\s*null/);
      expect(src).toMatch(/bankDetailsAt\?:\s*string\s*\|\s*null/);
    });
    it('gates the Bank / Payout card on data-present so applicants without bank fields do not render em-dash stubs', () => {
      expect(src).toMatch(/\(app\.bankIban \|\| app\.bankName \|\| app\.bankBranchCode \|\| app\.bankAccountHolder\) && \(/);
      expect(src).toMatch(/uppercase tracking-wide">Bank \/ Payout</);
    });
    it('renders IBAN with dir="ltr" + font-mono (Hebrew RTL doesn\'t flip the digits)', () => {
      expect(src).toMatch(/dir="ltr" className="font-mono/);
    });
  });
});
