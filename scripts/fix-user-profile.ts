/**
 * Fix missing Firestore user profile
 */

import firebaseAdmin from '../server/lib/firebase-admin';

async function fixUserProfile() {
  const email = 'nirhadad1@gmail.com';
  
  try {
    const db = firebaseAdmin.firestore();
    const auth = firebaseAdmin.auth();
    
    // Get Firebase Auth user
    console.log('🔍 Checking Firebase Auth user...');
    const user = await auth.getUserByEmail(email);
    console.log(`✅ Found user: ${user.uid}`);
    
    // Check if Firestore profile exists
    console.log('\n🔍 Checking Firestore profile...');
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (userDoc.exists) {
      console.log('✅ Firestore profile exists');
      console.log('   Data:', userDoc.data());
    } else {
      console.log('❌ No Firestore profile found - Creating...');
      
      await db.collection('users').doc(user.uid).set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Nir Hadad',
        photoURL: user.photoURL || null,
        createdAt: new Date(),
        role: 'founder',
        emailVerified: user.emailVerified,
        metadata: {
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime
        }
      });
      
      console.log('✅ Firestore profile created successfully!');
    }
    
    // Test performance again
    console.log('\n🚀 Testing login speed...');
    const start = Date.now();
    const testDoc = await db.collection('users').doc(user.uid).get();
    const fetchTime = Date.now() - start;
    
    console.log(`⚡ Firestore fetch time: ${fetchTime}ms`);
    
    if (fetchTime < 100) {
      console.log('✅ EXCELLENT - Very fast!');
    } else if (fetchTime < 300) {
      console.log('✅ GOOD - Fast enough');
    } else {
      console.log('⚠️  Could be faster');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixUserProfile().then(() => {
  console.log('\n✨ Done!\n');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
