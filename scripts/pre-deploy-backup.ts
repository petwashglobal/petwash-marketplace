#!/usr/bin/env tsx
/**
 * Pre-Deployment Backup Script
 * Triggers complete code and Firestore backups before going live
 */

import { performWeeklyCodeBackup, performFirestoreExport, isGcsConfigured } from '../server/services/gcsBackupService';

async function runPreDeploymentBackup() {
  console.log('🚀 Pre-Deployment Backup Starting...\n');
  
  // Check GCS configuration
  if (!isGcsConfigured()) {
    console.error('❌ GCS backup not configured!');
    console.error('   Please run: tsx scripts/setup-gcs-backups.ts');
    process.exit(1);
  }
  
  console.log('✅ GCS credentials configured\n');
  
  // 1. Backup codebase
  console.log('📦 Backing up codebase...');
  const codeResult = await performWeeklyCodeBackup();
  
  if (codeResult.success) {
    console.log(`✅ Code backup complete!`);
    console.log(`   File: ${codeResult.backupFile}`);
    console.log(`   Size: ${codeResult.size}`);
    console.log(`   GCS URL: ${codeResult.gcsUrl}\n`);
  } else {
    console.error(`❌ Code backup failed: ${codeResult.error}\n`);
    process.exit(1);
  }
  
  // 2. Backup Firestore
  console.log('🔥 Backing up Firestore data...');
  const firestoreResult = await performFirestoreExport();
  
  if (firestoreResult.success) {
    console.log(`✅ Firestore backup complete!`);
    console.log(`   Collections: ${firestoreResult.collections}`);
    console.log(`   Total Docs: ${firestoreResult.totalDocs}`);
    console.log(`   GCS Path: ${firestoreResult.gcsPath}\n`);
  } else {
    console.error(`❌ Firestore backup failed: ${firestoreResult.error}\n`);
    process.exit(1);
  }
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ PRE-DEPLOYMENT BACKUP COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📦 Code: ${codeResult.size}`);
  console.log(`🔥 Firestore: ${firestoreResult.collections} collections, ${firestoreResult.totalDocs} docs`);
  console.log('\n🚀 Ready for production deployment!\n');
}

runPreDeploymentBackup().catch(error => {
  console.error('❌ Backup failed:', error.message);
  process.exit(1);
});
