/**
 * Pet Wash™ - Create GCS Buckets for Automated Backups
 * 
 * This script creates the required Google Cloud Storage buckets
 * for code and Firestore backups
 */

import { Storage } from '@google-cloud/storage';

const CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const CODE_BUCKET = 'petwash-code-backups';
const FIRESTORE_BUCKET = 'petwash-firestore-backups';

// Helper to get Storage client
function getStorageClient(): Storage {
  if (!CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set');
  }
  
  try {
    // Parse JSON credentials from environment
    const credentials = JSON.parse(CREDENTIALS);
    return new Storage({ credentials });
  } catch {
    // Fall back to file path
    return new Storage({ keyFilename: CREDENTIALS });
  }
}

async function createBucket(storage: Storage, bucketName: string): Promise<boolean> {
  try {
    // Check if bucket already exists
    const [exists] = await storage.bucket(bucketName).exists();
    
    if (exists) {
      console.log(`✅ Bucket already exists: gs://${bucketName}`);
      return true;
    }
    
    // Create the bucket
    console.log(`📦 Creating bucket: gs://${bucketName}...`);
    await storage.createBucket(bucketName, {
      location: 'US',
      storageClass: 'STANDARD',
      labels: {
        app: 'petwash',
        purpose: 'backup'
      }
    });
    
    console.log(`✅ Successfully created: gs://${bucketName}`);
    return true;
    
  } catch (error: any) {
    console.error(`❌ Failed to create bucket ${bucketName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Pet Wash™ - GCS Bucket Creation\n');
  
  try {
    const storage = getStorageClient();
    console.log('✅ Connected to Google Cloud Storage\n');
    
    // Create both buckets
    const codeSuccess = await createBucket(storage, CODE_BUCKET);
    const firestoreSuccess = await createBucket(storage, FIRESTORE_BUCKET);
    
    console.log('\n📊 Summary:');
    console.log(`   Code Backup Bucket: ${codeSuccess ? '✅' : '❌'} gs://${CODE_BUCKET}`);
    console.log(`   Firestore Backup Bucket: ${firestoreSuccess ? '✅' : '❌'} gs://${FIRESTORE_BUCKET}`);
    
    if (codeSuccess && firestoreSuccess) {
      console.log('\n✨ All buckets ready!');
      console.log('\n📋 Next Steps:');
      console.log('   1. Run: npx tsx scripts/setup-gcs-backups.ts');
      console.log('   2. Automated backups will activate on next cron cycle\n');
      process.exit(0);
    } else {
      console.error('\n❌ Some buckets failed to create');
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

main();
