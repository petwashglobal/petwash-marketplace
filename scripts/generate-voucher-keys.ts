/**
 * Generate ES256 Key Pair for Voucher JWS Signing
 * Run: npx tsx scripts/generate-voucher-keys.ts
 */

import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose';

async function generateES256Keys() {
  console.log('🔐 Generating ES256 key pair for voucher signing...\n');
  
  const { privateKey, publicKey } = await generateKeyPair('ES256', {
    extractable: true
  });

  const privatePEM = await exportPKCS8(privateKey);
  const publicPEM = await exportSPKI(publicKey);

  console.log('✅ Keys generated successfully!\n');
  console.log('Add these to your Replit Secrets:\n');
  console.log('━'.repeat(60));
  console.log('\n📝 Secret Name: VOUCHER_ES256_PRIVATE_KEY_PEM');
  console.log('Value:');
  console.log(privatePEM);
  console.log('\n' + '━'.repeat(60));
  console.log('\n📝 Secret Name: VOUCHER_ES256_PUBLIC_KEY_PEM');
  console.log('Value:');
  console.log(publicPEM);
  console.log('\n' + '━'.repeat(60));
  console.log('\n⚠️  IMPORTANT: Store these in Replit Secrets, NOT in code!');
  console.log('💡 These keys will be used to cryptographically sign vouchers.');
}

generateES256Keys().catch(console.error);
