/**
 * Pet Wash™ - GCS Backup Setup & Activation
 * 
 * This script activates automated backups to Google Cloud Storage
 * 
 * Prerequisites:
 * - GCS buckets created: petwash-code-backups, petwash-firestore-backups
 * - Service account JSON key provided
 * 
 * Usage:
 *   tsx scripts/setup-gcs-backups.ts /path/to/service-account-key.json
 */

import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.argv[2];
const CODE_BUCKET = 'petwash-code-backups';
const FIRESTORE_BUCKET = 'petwash-firestore-backups';

// Helper to get Storage instance with credentials
function getStorageClient(): Storage {
  try {
    // Try parsing as JSON first (from environment variable)
    const credentials = JSON.parse(CREDENTIALS_PATH);
    return new Storage({ credentials });
  } catch {
    // Fall back to file path
    return new Storage({ keyFilename: CREDENTIALS_PATH });
  }
}

async function verifyCredentials(): Promise<boolean> {
  try {
    if (!CREDENTIALS_PATH) {
      console.error('❌ Error: No credentials provided');
      console.log('Usage: tsx scripts/setup-gcs-backups.ts /path/to/service-account-key.json');
      console.log('Or set GOOGLE_APPLICATION_CREDENTIALS secret with JSON content');
      return false;
    }

    let credentials: any;
    
    // Check if CREDENTIALS_PATH is a JSON string or a file path
    try {
      credentials = JSON.parse(CREDENTIALS_PATH);
      console.log('✅ Credentials loaded from environment variable (JSON)');
    } catch {
      // It's a file path
      if (!fs.existsSync(CREDENTIALS_PATH)) {
        console.error(`❌ Error: Credentials file not found: ${CREDENTIALS_PATH.substring(0, 50)}...`);
        return false;
      }
      credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
      console.log('✅ Credentials file found');
    }
    
    console.log(`✅ Project ID: ${credentials.project_id}`);
    console.log(`✅ Client Email: ${credentials.client_email}`);
    
    return true;
  } catch (error: any) {
    console.error('❌ Error reading credentials:', error.message);
    return false;
  }
}

async function verifyBuckets(): Promise<boolean> {
  try {
    const storage = getStorageClient();
    
    console.log('\n🔍 Verifying GCS buckets...');
    
    // Check code backup bucket
    const [codeExists] = await storage.bucket(CODE_BUCKET).exists();
    if (codeExists) {
      console.log(`✅ Code backup bucket exists: gs://${CODE_BUCKET}`);
    } else {
      console.error(`❌ Code backup bucket not found: gs://${CODE_BUCKET}`);
      console.log('Create it with: gsutil mb gs://' + CODE_BUCKET);
      return false;
    }
    
    // Check Firestore backup bucket
    const [firestoreExists] = await storage.bucket(FIRESTORE_BUCKET).exists();
    if (firestoreExists) {
      console.log(`✅ Firestore backup bucket exists: gs://${FIRESTORE_BUCKET}`);
    } else {
      console.error(`❌ Firestore backup bucket not found: gs://${FIRESTORE_BUCKET}`);
      console.log('Create it with: gsutil mb gs://' + FIRESTORE_BUCKET);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error verifying buckets:', error);
    return false;
  }
}

async function testUpload(): Promise<boolean> {
  try {
    const storage = getStorageClient();
    const testContent = JSON.stringify({
      test: true,
      timestamp: new Date().toISOString(),
      message: 'GCS backup system test'
    }, null, 2);
    
    const testFile = '/tmp/gcs-test.json';
    fs.writeFileSync(testFile, testContent);
    
    console.log('\n🧪 Testing upload permissions...');
    
    await storage.bucket(CODE_BUCKET).upload(testFile, {
      destination: 'test/connection-test.json'
    });
    
    console.log('✅ Successfully uploaded test file');
    
    // Clean up test file
    await storage.bucket(CODE_BUCKET).file('test/connection-test.json').delete();
    fs.unlinkSync(testFile);
    
    console.log('✅ Successfully cleaned up test file');
    
    return true;
  } catch (error) {
    console.error('❌ Error testing upload:', error);
    return false;
  }
}

async function saveCredentialsToReplit(): Promise<boolean> {
  try {
    console.log('\n💾 Saving credentials to Replit...');
    
    const destPath = path.join(process.cwd(), 'gcs-service-account.json');
    
    // Check if CREDENTIALS_PATH is JSON or file path
    let credentialsContent: string;
    try {
      JSON.parse(CREDENTIALS_PATH);
      // It's JSON content
      credentialsContent = CREDENTIALS_PATH;
      console.log('📝 Writing JSON credentials to file...');
    } catch {
      // It's a file path, read and copy
      credentialsContent = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
      console.log('📄 Copying credentials file...');
    }
    
    fs.writeFileSync(destPath, credentialsContent, 'utf8');
    
    console.log(`✅ Credentials saved to: ${destPath}`);
    console.log('⚠️  Make sure gcs-service-account.json is in .gitignore');
    
    // Update .env if it exists
    const envPath = path.join(process.cwd(), '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    
    if (!envContent.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
      envContent += `\n# GCS Backup Credentials\nGOOGLE_APPLICATION_CREDENTIALS=./gcs-service-account.json\n`;
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated .env file');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error saving credentials:', error);
    return false;
  }
}

async function updateGitignore(): Promise<void> {
  try {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    let gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    
    const entriesToAdd = [
      'gcs-service-account.json',
      'petwash-backup-*.tar.gz',
      '.env'
    ];
    
    let updated = false;
    for (const entry of entriesToAdd) {
      if (!gitignoreContent.includes(entry)) {
        gitignoreContent += `\n${entry}`;
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(gitignorePath, gitignoreContent);
      console.log('✅ Updated .gitignore');
    }
  } catch (error) {
    console.log('⚠️  Could not update .gitignore (non-critical)');
  }
}

async function main() {
  console.log('🚀 Pet Wash™ GCS Backup Setup\n');
  
  const steps = [
    { name: 'Verify Credentials', fn: verifyCredentials },
    { name: 'Verify GCS Buckets', fn: verifyBuckets },
    { name: 'Test Upload Permissions', fn: testUpload },
    { name: 'Save Credentials', fn: saveCredentialsToReplit }
  ];
  
  for (const step of steps) {
    const success = await step.fn();
    if (!success) {
      console.error(`\n❌ Setup failed at: ${step.name}`);
      process.exit(1);
    }
  }
  
  await updateGitignore();
  
  console.log('\n✨ GCS Backup System Setup Complete!\n');
  console.log('📋 Next Steps:');
  console.log('1. Weekly code backups are ready to activate');
  console.log('2. Daily Firestore exports are ready to activate');
  console.log('3. Run: tsx scripts/test-backup-system.ts to verify');
  console.log('4. Automated backups will start with next cron cycle\n');
  
  console.log('🔗 Access your backups at:');
  console.log(`   Code: https://console.cloud.google.com/storage/browser/${CODE_BUCKET}`);
  console.log(`   Firestore: https://console.cloud.google.com/storage/browser/${FIRESTORE_BUCKET}\n`);
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
