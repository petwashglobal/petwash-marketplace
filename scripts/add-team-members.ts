#!/usr/bin/env tsx
/**
 * Add Pet Wash team members to the system
 * Creates employee records in Firestore at: employees/{uid}
 */

import admin from '../server/lib/firebase-admin';
import { db } from '../server/lib/firebase-admin';

async function addTeamMember(
  email: string,
  firstName: string,
  lastName: string,
  fullName: string,
  role: string,
  phone: string,
  employeeId: string,
  notes: string
) {
  try {
    console.log(`\n🔍 Processing: ${fullName} (${email})`);
    
    // Check if Firebase user exists, create if not
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log(`✅ Found existing Firebase user: ${userRecord.uid}`);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log(`📝 Creating new Firebase user...`);
        userRecord = await admin.auth().createUser({
          email,
          emailVerified: false,
          displayName: fullName,
          disabled: false,
        });
        console.log(`✅ Created Firebase user: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }
    
    // Create employee document at employees/{uid}
    const employeeData = {
      uid: userRecord.uid,
      email: userRecord.email || email,
      firstName,
      lastName,
      fullName,
      role,
      status: 'active',
      isActive: true,
      phone,
      employeeId,
      stations: [],
      notes,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
    };
    
    const employeeRef = db.collection('employees').doc(userRecord.uid);
    await employeeRef.set(employeeData, { merge: true });
    
    console.log(`✅ Created/Updated employee record at: employees/${userRecord.uid}`);
    console.log(`   - Role: ${role}`);
    console.log(`   - Status: active`);
    console.log(`   - Phone: ${phone}`);
    console.log(`   - Employee ID: ${employeeId}`);
    
    return userRecord.uid;
  } catch (error) {
    console.error(`❌ Error processing ${fullName}:`, error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Adding Pet Wash team members...\n');
    
    // Add Avner Shakarzi - Head of Development and Installation
    await addTeamMember(
      'avner9000@gmail.com',
      'Avner',
      'Shakarzi',
      'Avner Shakarzi',
      'ops', // Using 'ops' role for Development and Installation
      '+972506795120',
      'DEV001',
      'Head of Development and Installation - WhatsApp: +972 50-6795120'
    );
    
    // Update Ido Shakarzi - National Operations Director
    await addTeamMember(
      'Ido.S@petwash.co.il',
      'Ido',
      'Shakarzi',
      'Ido Shakarzi',
      'admin', // Admin role for National Operations Director
      '+972558813036',
      'DIR001',
      'National Operations Director - Super admin access'
    );
    
    console.log('\n✅ All team members processed successfully!');
    console.log('\n📋 Team Summary:');
    console.log('   • Avner Shakarzi - Head of Development and Installation');
    console.log('   • Ido Shakarzi - National Operations Director');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to add team members:', error);
    process.exit(1);
  }
}

main();
