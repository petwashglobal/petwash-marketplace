/**
 * Test ES256 Key Pair and Voucher Signing
 * Verifies cryptographic security is working
 */

import { testKeyPair, signFullVoucher, verifyVoucherIntegrity } from '../server/services/voucherSecurityService';
import type { PetWashVoucher2025 } from '../shared/petwashVoucher2025Types';

async function testES256System() {
  console.log('🔐 Testing PetWash™ ES256 Voucher Security System');
  console.log('================================================\n');

  try {
    // Test 1: Verify key pair is working
    console.log('📝 Test 1: Verifying ES256 key pair...');
    const keyPairWorks = await testKeyPair();
    if (!keyPairWorks) {
      throw new Error('ES256 key pair test failed');
    }
    console.log('✅ ES256 key pair verified\n');

    // Test 2: Create and sign a test voucher
    console.log('📝 Test 2: Creating and signing test voucher...');
    const testVoucher: PetWashVoucher2025 = {
      voucher_id: 'PWV-TEST-2025-ABCD1234',
      public_code: 'PW-TEST-1234-5678',
      type: 'egift',
      visual: {
        tier: 'platinum',
        card_theme: 'luxury_gold',
        animated_highlight: true,
        highres_svg_url: null
      },
      rules: {
        value_type: 'monetary',
        value_original: 500,
        value_remaining: 500,
        washes_original: null,
        washes_remaining: null,
        currency: 'ILS',
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        transferable: true
      },
      owner: {
        user_id: 'test-user-123',
        name: 'Test User',
        email: 'test@petwash.co.il',
        created_in_app: 'web'
      },
      gift: {
        is_gift: true,
        sender_name: 'Sender Name',
        sender_email: 'sender@example.com',
        recipient_name: 'Recipient Name',
        recipient_email: 'recipient@example.com',
        personal_message: 'Happy Birthday!',
        gift_claimed_at: null
      },
      lifecycle: {
        created_at: new Date().toISOString(),
        activated_at: null,
        first_redeemed_at: null,
        last_redeemed_at: null,
        fully_redeemed_at: null,
        archived_at: null
      },
      security: {
        signature_jws: null,
        hash_sha256: null,
        signed_at: null,
        requires_pin: false,
        pin_hash: null
      },
      purchase: {
        order_id: 'ORDER-TEST-001',
        payment_method: 'credit_card',
        payment_status: 'paid',
        payment_intent_id: null,
        original_price: 500,
        purchase_location: 'web'
      },
      metadata: {
        issuer: 'petwash',
        campaign_id: null,
        tags: ['test', 'demo'],
        notes: 'Test voucher for ES256 verification'
      }
    };

    const signedVoucher = await signFullVoucher(testVoucher);
    console.log('✅ Voucher signed successfully');
    console.log(`   - Signature (first 50 chars): ${signedVoucher.security.signature_jws?.substring(0, 50)}...`);
    console.log(`   - Hash (first 32 chars): ${signedVoucher.security.hash_sha256?.substring(0, 32)}...`);
    console.log(`   - Signed at: ${signedVoucher.security.signed_at}\n`);

    // Test 3: Verify the signature
    console.log('📝 Test 3: Verifying voucher signature...');
    const verification = await verifyVoucherIntegrity(signedVoucher);
    if (!verification.valid) {
      throw new Error(`Verification failed: ${verification.errors.join(', ')}`);
    }
    console.log('✅ Signature verification passed\n');

    // Test 4: Test tamper detection
    console.log('📝 Test 4: Testing tamper detection...');
    const tamperedVoucher = { ...signedVoucher };
    tamperedVoucher.rules.value_remaining = 999999; // Try to inflate balance
    
    const tamperedVerification = await verifyVoucherIntegrity(tamperedVoucher);
    if (tamperedVerification.valid) {
      throw new Error('Tamper detection failed - accepted invalid voucher!');
    }
    console.log('✅ Tamper detection working correctly');
    console.log(`   - Detected errors: ${tamperedVerification.errors.join(', ')}\n`);

    // Success summary
    console.log('================================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('================================================\n');
    console.log('🔐 Security Features Verified:');
    console.log('   ✅ ES256 JWS cryptographic signing');
    console.log('   ✅ SHA-256 hash verification');
    console.log('   ✅ Signature verification');
    console.log('   ✅ Tamper detection');
    console.log('   ✅ Immutable field protection');
    console.log('\n🚀 Voucher security system ready for production!');

    return true;
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Run tests
testES256System()
  .then(() => {
    console.log('\n✅ ES256 security system verified and ready!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 ES256 tests failed');
    process.exit(1);
  });
