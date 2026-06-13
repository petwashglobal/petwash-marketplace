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

const PUBLIC_PASS_BASE_URL = 'https://petwash.co.il';

const passProfiles = {
  nir: {
    outputName: 'first-founder-pass.pkpass',
    visual: {
      passId: 'pass-founder-001c-f8f9e9fc',
      userId: 'founder-001-nir-hadad',
      ownerName: 'Nir Hadad',
      primaryPetName: 'Kenzo',
      tier: 'ROYAL',
      availableCreditIls: 0,
      qrTokenVersion: 1,
    },
  },
  ido: {
    outputName: 'ido-shakarzi-pass.pkpass',
    visual: {
      passId: 'pass-ido-shakarzi-001',
      userId: 'staff-ido-shakarzi',
      ownerName: 'Ido Shakarzi',
      primaryPetName: undefined,
      tier: 'ROYAL',
      availableCreditIls: 0,
      qrTokenVersion: 1,
    },
  },
};

async function main() {
  applyWalletEnvCompat();
  // Local .env files sometimes point BASE_URL at the Cloud Run origin for API
  // diagnostics. Apple Wallet passes must carry the public domain users open.
  process.env.BASE_URL = PUBLIC_PASS_BASE_URL;
  process.env.PUBLIC_SITE_URL = PUBLIC_PASS_BASE_URL;
  process.env.APP_PUBLIC_URL = PUBLIC_PASS_BASE_URL;

  const member = (process.argv.find(arg => arg.startsWith('--member='))?.split('=')[1] || 'nir') as keyof typeof passProfiles;
  const profile = passProfiles[member];
  if (!profile) throw new Error(`Unknown pass member '${member}'. Use --member=nir or --member=ido.`);

  const { generateAppleWalletPass } = await import('../../server/services/AppleWalletService');
  const outputPath = path.resolve(process.cwd(), profile.outputName);
  const buffer = await generateAppleWalletPass(profile.visual);
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
