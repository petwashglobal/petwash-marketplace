/**
 * Pet Wash™ - Test Backup System
 * 
 * Runs comprehensive tests on the GCS backup system
 */

import { performWeeklyCodeBackup, performFirestoreExport, getBackupStatus } from '../server/services/gcsBackupService';

async function runTests() {
  console.log('🧪 Pet Wash™ Backup System Tests\n');
  console.log('═'.repeat(60));
  
  // Test 1: Check configuration
  console.log('\n📋 Test 1: Verify Configuration');
  const status = await getBackupStatus();
  
  if (status.configured) {
    console.log('✅ GCS credentials configured');
  } else {
    console.error('❌ GCS credentials not found');
    console.log('Run: tsx scripts/setup-gcs-backups.ts /path/to/key.json');
    process.exit(1);
  }
  
  // Test 2: Code backup
  console.log('\n📦 Test 2: Weekly Code Backup');
  console.log('This may take a few minutes...');
  
  const codeResult = await performWeeklyCodeBackup();
  
  if (codeResult.success) {
    console.log('✅ Code backup successful');
    console.log(`   File: ${codeResult.backupFile}`);
    console.log(`   Size: ${codeResult.size}`);
    console.log(`   URL: ${codeResult.gcsUrl}`);
  } else {
    console.error('❌ Code backup failed:', codeResult.error);
  }
  
  // Test 3: Firestore export
  console.log('\n🗄️  Test 3: Daily Firestore Export');
  console.log('This may take a few minutes...');
  
  const firestoreResult = await performFirestoreExport();
  
  if (firestoreResult.success) {
    console.log('✅ Firestore export successful');
    console.log(`   Collections: ${firestoreResult.collections}`);
    console.log(`   Total Docs: ${firestoreResult.totalDocs}`);
    console.log(`   Path: ${firestoreResult.gcsPath}`);
  } else {
    console.error('❌ Firestore export failed:', firestoreResult.error);
  }
  
  // Test 4: Recent backups
  console.log('\n📊 Test 4: Recent Backup History');
  
  if (status.recentBackups && status.recentBackups.length > 0) {
    console.log(`Found ${status.recentBackups.length} recent backups:`);
    status.recentBackups.forEach((backup: any, i: number) => {
      const icon = backup.status === 'success' ? '✅' : '❌';
      console.log(`  ${icon} ${backup.type} - ${backup.timestamp}`);
    });
  } else {
    console.log('No backup history found (this is the first backup)');
  }
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📈 Test Summary:');
  
  const allPassed = codeResult.success && firestoreResult.success;
  
  if (allPassed) {
    console.log('✅ All tests passed!');
    console.log('\n🎉 Backup system is fully operational');
    console.log('\nScheduled backups:');
    console.log('  📦 Weekly code backup: Every Sunday 2 AM Israel time');
    console.log('  🗄️  Daily Firestore export: Every day midnight Israel time');
    console.log('\nAccess your backups:');
    console.log('  https://console.cloud.google.com/storage/browser/petwash-code-backups');
    console.log('  https://console.cloud.google.com/storage/browser/petwash-firestore-backups');
  } else {
    console.error('\n❌ Some tests failed - please review errors above');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
