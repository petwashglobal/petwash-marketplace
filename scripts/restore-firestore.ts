/**
 * Pet Wash™ - Firestore Restoration Script
 * 
 * Restores Firestore collections from GCS backup
 * 
 * Usage:
 *   tsx scripts/restore-firestore.ts /path/to/backup/directory
 */

import { db } from '../server/lib/firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = process.argv[2] || './firestore-restore';

const COLLECTIONS = [
  'users',
  'kyc',
  'birthday_vouchers',
  'crm_email_templates',
  'nayax_transactions',
  'nayax_vouchers',
  'nayax_webhook_events',
  'nayax_terminals',
  'station_events',
  'inbox',
  'loyalty'
];

async function restoreCollection(collectionName: string, backupFile: string) {
  try {
    if (!fs.existsSync(backupFile)) {
      console.log(`⚠️  Skipping ${collectionName}: backup file not found`);
      return { collection: collectionName, status: 'skipped', reason: 'file not found' };
    }

    const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    const documents = data.documents || [];

    if (documents.length === 0) {
      console.log(`⚠️  Skipping ${collectionName}: no documents in backup`);
      return { collection: collectionName, status: 'skipped', reason: 'no documents' };
    }

    console.log(`📦 Restoring ${collectionName}: ${documents.length} documents...`);

    // Use batched writes (max 500 operations per batch)
    let batch = db.batch();
    let operationCount = 0;
    let totalRestored = 0;

    for (const doc of documents) {
      const { id, profile, ...docData } = doc;
      const docRef = db.collection(collectionName).doc(id);
      
      batch.set(docRef, docData, { merge: true }); // Use merge to avoid overwriting existing data
      operationCount++;
      totalRestored++;

      // Restore user profile subcollection if exists
      if (collectionName === 'users' && profile) {
        const profileRef = docRef.collection('profile').doc('data');
        batch.set(profileRef, profile, { merge: true });
        operationCount++;
      }

      // Commit batch when reaching 500 operations
      if (operationCount >= 500) {
        await batch.commit();
        console.log(`  ✓ Committed batch (${totalRestored}/${documents.length})`);
        batch = db.batch();
        operationCount = 0;
      }
    }

    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`✅ ${collectionName}: ${totalRestored} documents restored`);
    return { collection: collectionName, status: 'success', count: totalRestored };
  } catch (error) {
    console.error(`❌ Error restoring ${collectionName}:`, error);
    return { 
      collection: collectionName, 
      status: 'failed', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function main() {
  console.log('🚀 Pet Wash™ Firestore Restoration\n');
  console.log('═'.repeat(60));
  console.log(`📂 Backup directory: ${BACKUP_DIR}\n`);

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`❌ Backup directory not found: ${BACKUP_DIR}`);
    console.log('\nUsage: tsx scripts/restore-firestore.ts /path/to/backup/directory');
    process.exit(1);
  }

  // List available backup files
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} backup files:\n`);
  files.forEach(f => console.log(`  - ${f}`));
  console.log('\n' + '═'.repeat(60) + '\n');

  // Confirm before proceeding
  console.log('⚠️  WARNING: This will restore data to Firestore');
  console.log('   Existing documents will be merged (not replaced)');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Starting restoration...\n');

  const results: Array<{
    collection: string;
    status: 'success' | 'failed' | 'skipped';
    count?: number;
    error?: string;
    reason?: string;
  }> = [];
  let totalDocs = 0;
  let successCount = 0;
  let failedCount = 0;

  for (const collection of COLLECTIONS) {
    const backupFiles = files.filter(f => f.startsWith(`${collection}_`));
    
    if (backupFiles.length === 0) {
      console.log(`⚠️  No backup file found for ${collection}`);
      results.push({ collection, status: 'skipped', reason: 'no backup file' });
      continue;
    }

    // Use most recent backup if multiple exist
    const backupFile = path.join(BACKUP_DIR, backupFiles.sort().reverse()[0]);
    const result = await restoreCollection(collection, backupFile);
    results.push(result);

    if (result.status === 'success') {
      successCount++;
      totalDocs += result.count || 0;
    } else if (result.status === 'failed') {
      failedCount++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Restoration Summary:\n');
  console.log(`✅ Successful: ${successCount} collections`);
  console.log(`❌ Failed: ${failedCount} collections`);
  console.log(`📄 Total documents restored: ${totalDocs}\n`);

  console.log('Detailed Results:');
  results.forEach(r => {
    const icon = r.status === 'success' ? '✅' : r.status === 'failed' ? '❌' : '⚠️';
    const msg = r.status === 'success' 
      ? `${r.count} docs` 
      : r.status === 'failed' 
        ? r.error 
        : r.reason;
    console.log(`  ${icon} ${r.collection.padEnd(25)} ${msg}`);
  });

  if (failedCount > 0) {
    console.log('\n⚠️  Some collections failed to restore. Check logs above for details.');
    process.exit(1);
  } else {
    console.log('\n🎉 Firestore restoration complete!');
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
