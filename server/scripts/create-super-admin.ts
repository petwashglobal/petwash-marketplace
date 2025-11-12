/**
 * Script to create super admin user in Firebase Auth and Firestore
 * Run: tsx server/scripts/create-super-admin.ts
 */

import admin from '../lib/firebase-admin';
import { db } from '../lib/firebase-admin';

const SUPER_ADMIN_EMAIL = 'nirhadad1@gmail.com';
const TEMP_PASSWORD = 'TempAdmin2025!';

async function createSuperAdmin() {
  try {
    console.log('🔧 Creating super admin user...');
    
    // Step 1: Check if user exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(SUPER_ADMIN_EMAIL);
      console.log(`✅ Firebase Auth user already exists: ${userRecord.uid}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Create new user in Firebase Auth
        userRecord = await admin.auth().createUser({
          email: SUPER_ADMIN_EMAIL,
          password: TEMP_PASSWORD,
          emailVerified: true,
          displayName: 'Nir Hadad',
        });
        console.log(`✅ Created Firebase Auth user: ${userRecord.uid}`);
        console.log(`   Email: ${SUPER_ADMIN_EMAIL}`);
        console.log(`   Temp Password: ${TEMP_PASSWORD}`);
      } else {
        throw error;
      }
    }

    // Step 2: Create/Update employee profile in Firestore
    const employeeRef = db
      .collection('users')
      .doc(userRecord.uid)
      .collection('employee')
      .doc('profile');

    await employeeRef.set({
      uid: userRecord.uid,
      email: SUPER_ADMIN_EMAIL,
      fullName: 'Nir Hadad',
      role: 'admin',
      status: 'active',
      stations: [],
      employeeId: 'ADMIN001',
      notes: 'Super administrator - Full system access',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`✅ Created Firestore employee profile at: users/${userRecord.uid}/employee/profile`);
    console.log('');
    console.log('🎉 Super admin setup complete!');
    console.log('');
    console.log('📋 Login Details:');
    console.log(`   URL: https://petwash.co.il/admin/login`);
    console.log(`   Email: ${SUPER_ADMIN_EMAIL}`);
    console.log(`   Password: ${TEMP_PASSWORD}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    process.exit(1);
  }
}

createSuperAdmin();
