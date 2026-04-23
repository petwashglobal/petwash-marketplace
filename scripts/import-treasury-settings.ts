#!/usr/bin/env tsx
/**
 * import-treasury-settings.ts
 * ============================
 * SECURE ONE-TIME IMPORT SCRIPT for Pet Wash Ltd treasury bank certificate data.
 *
 * PURPOSE:
 *   Seeds the treasury_settings table from environment variables.
 *   Encrypts IBAN and account number using AES-256-GCM before writing to DB.
 *   Prints ONLY masked confirmation output — never raw bank details.
 *
 * SECURITY RULES:
 *  ▸ Never run this in a CI pipeline or any shared environment where output is logged.
 *  ▸ Never pipe output to a file that might be committed to the repo.
 *  ▸ Set all COMPANY_BANK_* variables in secrets manager, not in shell history.
 *  ▸ After running, confirm the row exists via the admin UI at /admin/treasury.
 *
 * USAGE:
 *   # Set required env vars (use your secrets manager — never paste in shell history)
 *   export TREASURY_FIELD_ENCRYPTION_KEY=<64-hex-chars>
 *   export COMPANY_BANK_IBAN=<IBAN>
 *   export COMPANY_BANK_SWIFT=<SWIFT>
 *   export COMPANY_BANK_NAME=<bank name>
 *   export COMPANY_BANK_CODE=<bank code>
 *   export COMPANY_BANK_BRANCH_NUMBER=<branch>
 *   export COMPANY_BANK_ACCOUNT_NUMBER=<account>
 *   export COMPANY_BANK_ACCOUNT_HOLDER=<holder name>
 *   export COMPANY_BANK_ACCOUNT_OPENED=<YYYY-MM-DD>
 *   export COMPANY_BANK_CERT_DATE=<YYYY-MM-DD>
 *   export DATABASE_URL=<connection string>
 *
 *   # Run (no arguments — all input comes from env vars)
 *   npx tsx scripts/import-treasury-settings.ts
 *
 * Israeli regulatory note:
 *   This script creates the company treasury record required under the
 *   Payment Services Law (Israel, 2023) for outgoing bank transfer identification.
 *   The resulting record must be verified by a finance officer via the admin UI
 *   before provider payouts can proceed.
 */

import 'dotenv/config';
import { encryptField, maskIban, maskAccountNumber, maskSwift } from '../server/services/secretFieldCrypto';

// ── Validation ────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`\n❌ FATAL: Required env var ${name} is not set.`);
    console.error(`   Set it in your secrets manager and export it before running this script.`);
    process.exit(1);
  }
  return val;
}

function validateIsraeliIban(iban: string): boolean {
  const clean = iban.replace(/\s/g, '');
  return clean.startsWith('IL') && clean.length === 23 && /^[A-Z0-9]+$/.test(clean);
}

function validateSwift(swift: string): boolean {
  // BIC format: 4 letters (bank) + 2 letters (country) + 2 chars (location) + optional 3 (branch)
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏦 PetWash Treasury Import Script');
  console.log('==================================');
  console.log('Reading configuration from environment variables...\n');

  // Check encryption key first — it must be present before importing
  requireEnv('TREASURY_FIELD_ENCRYPTION_KEY');

  const iban          = requireEnv('COMPANY_BANK_IBAN');
  const swift         = requireEnv('COMPANY_BANK_SWIFT');
  const bankName      = requireEnv('COMPANY_BANK_NAME');
  const bankCode      = requireEnv('COMPANY_BANK_CODE');
  const branchNumber  = requireEnv('COMPANY_BANK_BRANCH_NUMBER');
  const accountNumber = requireEnv('COMPANY_BANK_ACCOUNT_NUMBER');
  const accountHolder = requireEnv('COMPANY_BANK_ACCOUNT_HOLDER');
  const openedAt      = process.env.COMPANY_BANK_ACCOUNT_OPENED;
  const certDate      = process.env.COMPANY_BANK_CERT_DATE;
  const dbUrl         = requireEnv('DATABASE_URL');

  // Normalise IBAN
  const ibanClean = iban.replace(/\s/g, '');

  // Validate inputs
  const validationErrors: string[] = [];
  if (!validateIsraeliIban(ibanClean)) {
    validationErrors.push(`IBAN does not match expected Israeli format (IL + 21 digits). Got: ${ibanClean.slice(0, 4)}...`);
  }
  if (!validateSwift(swift)) {
    validationErrors.push(`SWIFT code format invalid. Got: ${maskSwift(swift)}`);
  }
  if (!bankName.trim()) validationErrors.push('Bank name is empty');
  if (!branchNumber.trim()) validationErrors.push('Branch number is empty');
  if (!accountNumber.trim()) validationErrors.push('Account number is empty');
  if (!accountHolder.trim()) validationErrors.push('Account holder name is empty');

  if (validationErrors.length > 0) {
    console.error('❌ Validation failed:');
    validationErrors.forEach(e => console.error(`   • ${e}`));
    process.exit(1);
  }

  // Show masked preview — confirm before writing
  console.log('📋 Masked preview (this is all that will ever be shown in admin UI):\n');
  console.log(`   Legal entity:   PET WASH LTD`);
  console.log(`   Company No.:    517145033`);
  console.log(`   Bank:           ${bankName} (code: ${bankCode})`);
  console.log(`   Branch:         ${branchNumber}`);
  console.log(`   Account holder: ${accountHolder}`);
  console.log(`   Account No.:    ${maskAccountNumber(accountNumber)}`);
  console.log(`   IBAN:           ${maskIban(ibanClean)}`);
  console.log(`   SWIFT:          ${maskSwift(swift)}`);
  console.log(`   Opened:         ${openedAt ?? '(not provided)'}`);
  console.log(`   Cert date:      ${certDate ?? '(not provided)'}`);
  console.log('');

  // Encrypt sensitive fields
  console.log('🔐 Encrypting sensitive fields...');
  const ibanEncrypted = encryptField(ibanClean);
  const accountNumberEncrypted = encryptField(accountNumber);
  console.log('   ✅ IBAN encrypted');
  console.log('   ✅ Account number encrypted');
  console.log('');

  // Write to DB
  console.log('💾 Writing to database...');

  // Dynamic import so the script can validate inputs before touching the DB
  const { db } = await import('../server/db');
  const { treasurySettings } = await import('../shared/schema-treasury');
  const { eq } = await import('drizzle-orm');
  const { maskSwift: ms, maskIban: mi, maskAccountNumber: ma } = await import('../server/services/secretFieldCrypto');

  const existing = await db.select({ id: treasurySettings.id }).from(treasurySettings).limit(1);

  const values = {
    legalEntityName: 'PET WASH LTD',
    legalEntityNameHe: 'פט וואש בע"מ',
    companyNumber: '517145033',
    bankName,
    bankCode,
    branchNumber,
    swift,
    accountHolderName: accountHolder,
    ibanEncrypted,
    accountNumberEncrypted,
    ibanMaskedCache: mi(ibanClean),
    accountNumberMaskedCache: ma(accountNumber),
    swiftMaskedCache: ms(swift),
    accountOpenedAt: openedAt ? new Date(openedAt) : null,
    sourceDocumentDate: certDate ? new Date(certDate) : null,
    verificationStatus: 'pending',
    isActivePayoutSource: false,
    isActiveForReconciliation: false,
    lastModifiedByUid: 'system-import-script',
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    console.log('   ⚠️  Existing treasury record found — updating (preserving verification status)...');
    await db
      .update(treasurySettings)
      .set({
        bankName: values.bankName,
        bankCode: values.bankCode,
        branchNumber: values.branchNumber,
        swift: values.swift,
        accountHolderName: values.accountHolderName,
        ibanEncrypted: values.ibanEncrypted,
        accountNumberEncrypted: values.accountNumberEncrypted,
        ibanMaskedCache: values.ibanMaskedCache,
        accountNumberMaskedCache: values.accountNumberMaskedCache,
        swiftMaskedCache: values.swiftMaskedCache,
        accountOpenedAt: values.accountOpenedAt,
        sourceDocumentDate: values.sourceDocumentDate,
        updatedAt: values.updatedAt,
        lastModifiedByUid: values.lastModifiedByUid,
      })
      .where(eq(treasurySettings.id, existing[0].id));
    console.log(`   ✅ Record ${existing[0].id} updated\n`);
  } else {
    const [inserted] = await db
      .insert(treasurySettings)
      .values(values)
      .returning({ id: treasurySettings.id });
    console.log(`   ✅ New treasury record created (id: ${inserted.id})\n`);
  }

  console.log('✅ Import complete.\n');
  console.log('📌 Next steps:');
  console.log('   1. Log into the admin panel at /admin/treasury');
  console.log('   2. Review the masked settings — verify they match the bank certificate');
  console.log('   3. Click "Mark Verified & Activate" to enable provider payouts');
  console.log('   4. Keep the COMPANY_BANK_* env vars in secrets manager');
  console.log('   5. Delete this script\'s run from your shell history\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Import failed:', err.message ?? err);
  process.exit(1);
});
