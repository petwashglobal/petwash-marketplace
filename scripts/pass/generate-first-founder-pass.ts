#!/usr/bin/env tsx
/**
 * Pass-only Founder Wallet generator.
 *
 * Safety:
 * - no database writes
 * - no SUMIT/bank/payment calls
 * - no secret printing
 * - generated .pkpass stays gitignored
 */

import fs from 'node:fs';
import path from 'node:path';
import { applyWalletEnvCompat } from '../../server/lib/wallet-env-compat';

const outputPath = path.resolve(process.cwd(), 'first-founder-pass.pkpass');

const visual = {
  passId: 'pass-founder-001c-f8f9e9fc',
  userId: 'founder-001-nir-hadad',
  ownerName: 'Nir Hadad',
  primaryPetName: 'Kenzo',
  tier: 'ROYAL',
  availableCreditIls: 0,
  qrTokenVersion: 1,
};

async function main() {
  applyWalletEnvCompat();
  const { generateAppleWalletPass } = await import('../../server/services/AppleWalletService');
  const buffer = await generateAppleWalletPass(visual);
  fs.writeFileSync(outputPath, buffer, { mode: 0o600 });
  const size = fs.statSync(outputPath).size;
  console.log(`Founder pass written: ${outputPath}`);
  console.log(`Size: ${size} bytes`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/APPLE|PASS_TOKEN|TOKEN|SECRET|CERT|KEY/.test(message)) {
    console.error('Founder pass generation failed: wallet signing configuration is missing or invalid.');
  } else {
    console.error(`Founder pass generation failed: ${message}`);
  }
  process.exit(1);
});
