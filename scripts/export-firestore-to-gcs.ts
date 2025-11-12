/**
 * Pet Wash™ - Firestore to Google Cloud Storage Backup
 * 
 * This script exports all Firestore collections to Google Cloud Storage
 * for external backup independent of Firestore itself.
 * 
 * Prerequisites:
 * - Google Cloud SDK installed
 * - Service account with Firestore and GCS permissions
 * - Environment variable: GOOGLE_APPLICATION_CREDENTIALS
 * 
 * Usage:
 *   tsx scripts/export-firestore-to-gcs.ts
 */

import { db } from '../server/lib/firebase-admin';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const storage = new Storage();
const BUCKET_NAME = 'petwash-firestore-backups';
const TEMP_DIR = '/tmp/firestore-export';

interface BackupResult {
  collection: string;
  documentCount: number;
  filePath: string;
  uploaded: boolean;
  error?: string;
}

const COLLECTIONS_TO_BACKUP = [
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
  'loyalty',
  'system_backups'
];

async function exportCollectionToJSON(collectionName: string): Promise<BackupResult> {
  try {
    console.log(`📥 Exporting collection: ${collectionName}...`);
    
    const snapshot = await db.collection(collectionName).get();
    const documents: any[] = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Handle subcollections for users
      if (collectionName === 'users') {
        const profileDoc = await db
          .collection('users')
          .doc(doc.id)
          .collection('profile')
          .doc('data')
          .get();
        
        documents.push({
          id: doc.id,
          ...data,
          profile: profileDoc.exists ? profileDoc.data() : null
        });
      } else {
        documents.push({
          id: doc.id,
          ...data
        });
      }
    }
    
    const date = new Date().toISOString().split('T')[0];
    const fileName = `${collectionName}_${date}.json`;
    const localPath = path.join(TEMP_DIR, fileName);
    
    // Create temp directory if doesn't exist
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    // Write to local file
    fs.writeFileSync(localPath, JSON.stringify({
      collection: collectionName,
      exportDate: new Date().toISOString(),
      documentCount: documents.length,
      documents
    }, null, 2));
    
    console.log(`✅ Exported ${documents.length} documents from ${collectionName}`);
    
    return {
      collection: collectionName,
      documentCount: documents.length,
      filePath: localPath,
      uploaded: false
    };
  } catch (error) {
    console.error(`❌ Error exporting ${collectionName}:`, error);
    return {
      collection: collectionName,
      documentCount: 0,
      filePath: '',
      uploaded: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function uploadToGCS(localPath: string, collectionName: string): Promise<boolean> {
  try {
    const fileName = path.basename(localPath);
    const date = new Date().toISOString().split('T')[0];
    const gcsPath = `daily/${date}/${fileName}`;
    
    console.log(`☁️  Uploading ${fileName} to gs://${BUCKET_NAME}/${gcsPath}...`);
    
    await storage.bucket(BUCKET_NAME).upload(localPath, {
      destination: gcsPath,
      metadata: {
        contentType: 'application/json',
        metadata: {
          collection: collectionName,
          exportDate: new Date().toISOString(),
          source: 'petwash-firestore-backup'
        }
      }
    });
    
    console.log(`✅ Uploaded to GCS successfully`);
    
    // Clean up local file
    fs.unlinkSync(localPath);
    
    return true;
  } catch (error) {
    console.error(`❌ Error uploading to GCS:`, error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Firestore to GCS Backup');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🪣 Bucket: gs://${BUCKET_NAME}`);
  console.log(`📋 Collections: ${COLLECTIONS_TO_BACKUP.length}\n`);
  
  const results: BackupResult[] = [];
  
  // Export all collections
  for (const collection of COLLECTIONS_TO_BACKUP) {
    const result = await exportCollectionToJSON(collection);
    results.push(result);
    
    if (result.filePath && !result.error) {
      const uploaded = await uploadToGCS(result.filePath, collection);
      result.uploaded = uploaded;
    }
  }
  
  // Summary
  console.log('\n📊 Backup Summary:');
  console.log('━'.repeat(60));
  
  const successful = results.filter(r => r.uploaded);
  const failed = results.filter(r => !r.uploaded);
  const totalDocs = results.reduce((sum, r) => sum + r.documentCount, 0);
  
  console.log(`✅ Successfully backed up: ${successful.length} collections`);
  console.log(`❌ Failed: ${failed.length} collections`);
  console.log(`📄 Total documents: ${totalDocs}`);
  
  if (failed.length > 0) {
    console.log('\n⚠️  Failed collections:');
    failed.forEach(r => {
      console.log(`  - ${r.collection}: ${r.error || 'Upload failed'}`);
    });
  }
  
  console.log('\n✨ Backup process completed!');
  
  // Clean up temp directory
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmdirSync(TEMP_DIR, { recursive: true });
  }
  
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
