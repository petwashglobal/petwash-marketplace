/**
 * PetWash™ Voucher System Test
 * Tests ES256 signing, ledger verification, and security
 */

import { 
  buildBaseVoucher,
  signFullVoucher,
  verifyVoucherJws,
  voucherSha256,
  redeemAmount
} from '../shared/petwashVoucher2025';

async function testVoucherSystem() {
  console.log('🧪 Testing PetWash™ Voucher System 2025');
  console.log('==========================================\n');

  try {
    // Test 1: Create voucher with ES256 signing
    console.log('📝 Test 1: Creating secure voucher with ES256 signing...');
    const baseVoucher = await buildBaseVoucher({
      valueOriginal: 500,
      washesOriginal: 10,
      ownerUserId: 'test-user-123',
      ownerName: 'Test User',
      ownerEmail: 'test@petwash.co.il',
      packageType: 'luxury',
      purchaseDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isGift: false,
      paymentMethod: 'credit_card'
    });
    
    const testVoucher = await signFullVoucher(baseVoucher);
    
    console.log('✅ Voucher created successfully');
    console.log(`   - Voucher ID: ${testVoucher.voucherId}`);
    console.log(`   - Public Code: ${testVoucher.publicCode}`);
    console.log(`   - Has signature: ${!!testVoucher.signature}`);
    console.log(`   - Signature preview: ${testVoucher.signature?.substring(0, 50)}...`);
    console.log(`   - Security hash: ${testVoucher.securityHash?.substring(0, 32)}...`);

    // Test 2: Verify signature
    console.log('\n🔐 Test 2: Verifying ES256 signature...');
    try {
      const payload = await verifyVoucherJws(testVoucher.signature!);
      console.log('✅ Signature verification: PASSED');
      console.log(`   - Verified voucher ID: ${payload.voucherId}`);
      console.log(`   - Issuer: ${payload.iss}`);
    } catch (error: any) {
      throw new Error(`❌ Signature verification: FAILED - ${error.message}`);
    }

    // Test 3: Test hash verification
    console.log('\n🔐 Test 3: Testing SHA-256 hash verification...');
    const calculatedHash = voucherSha256(testVoucher);
    if (calculatedHash === testVoucher.securityHash) {
      console.log('✅ Hash verification: PASSED');
      console.log(`   - Hash: ${calculatedHash.substring(0, 32)}...`);
    } else {
      throw new Error('❌ Hash verification: FAILED (hashes do not match)');
    }

    // Test 4: Test tamper detection
    console.log('\n🛡️  Test 4: Testing tamper detection...');
    const tamperedVoucher = { ...testVoucher };
    tamperedVoucher.valueRemaining = 999999; // Try to inflate balance
    const tamperedHash = voucherSha256(tamperedVoucher);
    if (tamperedHash !== testVoucher.securityHash) {
      console.log('✅ Tamper detection: PASSED (hash changed after tampering)');
      console.log(`   - Original hash: ${testVoucher.securityHash?.substring(0, 32)}...`);
      console.log(`   - Tampered hash: ${tamperedHash.substring(0, 32)}...`);
    } else {
      throw new Error('❌ Tamper detection: FAILED (hash should change)');
    }

    // Test 5: Test redemption
    console.log('\n💰 Test 5: Testing voucher redemption...');
    const redeemed = redeemAmount(testVoucher, 100);
    console.log('✅ Redemption: PASSED');
    console.log(`   - Original value: ${testVoucher.valueRemaining}`);
    console.log(`   - Redeemed amount: 100`);
    console.log(`   - New value: ${redeemed.valueRemaining}`);
    console.log(`   - Valid: ${redeemed.valueRemaining === 400}`);

    // Test 6: Security features
    console.log('\n🔒 Test 6: Verifying security features...');
    const securityChecks = {
      'ES256 JWS Signature': !!testVoucher.signature,
      'SHA-256 Hash': !!testVoucher.securityHash,
      'Unique Voucher ID': !!testVoucher.voucherId,
      'Public Code': !!testVoucher.publicCode,
      'Balance Integrity': testVoucher.valueRemaining <= testVoucher.valueOriginal,
      'Tamper Detection': tamperedHash !== testVoucher.securityHash,
      'Redemption Logic': redeemed.valueRemaining === 400
    };

    let allSecurityPassed = true;
    Object.entries(securityChecks).forEach(([feature, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`   ${status} ${feature}: ${passed ? 'ENABLED' : 'DISABLED'}`);
      if (!passed) allSecurityPassed = false;
    });

    if (!allSecurityPassed) {
      throw new Error('Security checks failed');
    }

    console.log('\n✅ ALL TESTS PASSED!');
    console.log('==========================================');
    console.log('🎉 Voucher System Ready for Production!');
    console.log('\n🔐 Security Features Verified:');
    console.log('   ✅ ES256 JWS cryptographic signing');
    console.log('   ✅ SHA-256 hash verification');
    console.log('   ✅ Tamper detection');
    console.log('   ✅ Unique voucher IDs & public codes');
    console.log('   ✅ Balance integrity checks');
    console.log('   ✅ Signature validation');
    console.log('   ✅ Redemption logic');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  }
}

// Run tests
testVoucherSystem()
  .then(() => {
    console.log('\n🚀 System verified and ready to deploy!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Tests failed:', error);
    process.exit(1);
  });
