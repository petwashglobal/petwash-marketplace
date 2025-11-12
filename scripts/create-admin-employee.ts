#!/usr/bin/env tsx
/**
 * Create admin employee record in Firestore
 * Creates document at: employees/{uid}
 * 
 * Required fields:
 * - role: 'admin'
 * - isActive: true
 * - firstName, lastName, email
 */

import admin from '../server/lib/firebase-admin';
import { db } from '../server/lib/firebase-admin';

async function createAdminEmployee() {
  const email = 'nirhadad1@gmail.com';
  
  try {
    console.log(`🔍 Looking up Firebase user: ${email}`);
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`✅ Found Firebase user: ${userRecord.uid}`);
    
    // Create employee document at employees/{uid}
    const employeeData = {
      id: userRecord.uid,
      email: userRecord.email || email,
      firstName: 'Nir',
      lastName: 'Hadad',
      fullName: 'Nir Hadad',
      role: 'admin',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
      employeeId: 'ADMIN001',
      phone: '',
      stations: [],
      notes: 'System administrator - super admin access'
    };
    
    const employeeRef = db.collection('employees').doc(userRecord.uid);
    await employeeRef.set(employeeData, { merge: true });
    
    console.log(`✅ Created employee record at: employees/${userRecord.uid}`);
    console.log(`   - role: admin`);
    console.log(`   - isActive: true`);
    console.log(`   - email: ${email}`);
    console.log(`   - firstName: Nir`);
    console.log(`   - lastName: Hadad`);
    
    // Verify it was created
    const doc = await employeeRef.get();
    if (doc.exists) {
      const data = doc.data();
      console.log(`\n✅ Verification successful:`);
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Document was not created');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdminEmployee();
