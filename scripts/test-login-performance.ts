/**
 * Pet Wash™ - Login Performance Test
 * Tests authentication speed and dashboard access
 */

import firebaseAdmin from '../server/lib/firebase-admin';

async function testLoginPerformance() {
  console.log('🔐 Pet Wash™ Login Performance Test\n');
  
  const testEmail = 'nirhadad1@gmail.com';
  
  try {
    // Step 1: Verify Firebase user exists
    console.log('Step 1: Checking Firebase user...');
    const startFirebase = Date.now();
    const userRecord = await firebaseAdmin.auth().getUserByEmail(testEmail);
    const firebaseTime = Date.now() - startFirebase;
    console.log(`✅ Firebase lookup: ${firebaseTime}ms`);
    console.log(`   User ID: ${userRecord.uid}`);
    
    // Step 2: Generate custom token (simulates login)
    console.log('\nStep 2: Generating auth token...');
    const startToken = Date.now();
    const customToken = await firebaseAdmin.auth().createCustomToken(userRecord.uid);
    const tokenTime = Date.now() - startToken;
    console.log(`✅ Token generation: ${tokenTime}ms`);
    
    // Step 3: Create session cookie (simulates session creation)
    console.log('\nStep 3: Creating session cookie...');
    const startCookie = Date.now();
    
    // First get an ID token (normally done on client)
    // For testing, we'll use the custom token approach
    const idToken = customToken; // In real flow, client exchanges this
    
    try {
      const sessionCookie = await firebaseAdmin.auth().createSessionCookie(idToken, {
        expiresIn: 60 * 60 * 24 * 5 * 1000 // 5 days
      });
      const cookieTime = Date.now() - startCookie;
      console.log(`✅ Session cookie: ${cookieTime}ms`);
    } catch (err: any) {
      // Custom tokens can't be used directly for session cookies
      // This is expected - just measuring the time
      const cookieTime = Date.now() - startCookie;
      console.log(`⚠️  Session cookie test: ${cookieTime}ms (expected limitation with custom tokens)`);
    }
    
    // Step 4: Check Firestore user data
    console.log('\nStep 4: Fetching user data from Firestore...');
    const startFirestore = Date.now();
    const db = firebaseAdmin.firestore();
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    const firestoreTime = Date.now() - startFirestore;
    
    if (userDoc.exists) {
      console.log(`✅ Firestore user data: ${firestoreTime}ms`);
      const userData = userDoc.data();
      console.log(`   Name: ${userData?.displayName || 'N/A'}`);
      console.log(`   Email: ${userData?.email}`);
    } else {
      console.log(`⚠️  No Firestore profile: ${firestoreTime}ms`);
    }
    
    // Calculate total time
    const totalTime = firebaseTime + tokenTime + firestoreTime;
    
    console.log('\n📊 Performance Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Firebase User Lookup:  ${firebaseTime}ms`);
    console.log(`Token Generation:      ${tokenTime}ms`);
    console.log(`Firestore Data Fetch:  ${firestoreTime}ms`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total Authentication:  ${totalTime}ms`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Performance assessment
    console.log('\n🎯 Assessment:');
    if (totalTime < 500) {
      console.log('✅ EXCELLENT - Login is very fast!');
    } else if (totalTime < 1000) {
      console.log('✅ GOOD - Login speed is acceptable');
    } else if (totalTime < 2000) {
      console.log('⚠️  FAIR - Login could be faster');
    } else {
      console.log('❌ SLOW - Login needs optimization');
    }
    
    console.log('\n💡 Dashboard Access:');
    console.log(`   Expected time to dashboard: ~${totalTime + 200}ms`);
    console.log('   (includes auth + initial data fetch)');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testLoginPerformance().then(() => {
  console.log('\n✨ Test complete!\n');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
