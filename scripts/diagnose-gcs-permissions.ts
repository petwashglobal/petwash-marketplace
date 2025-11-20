/**
 * Google Cloud Storage Permission Diagnostic Tool
 * Tests service account permissions and provides detailed error reporting
 */

import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = process.env.GCS_BACKUP_BUCKET || process.env.BIOMETRIC_BUCKET_NAME || 'petwash-backups-93383';

async function diagnosePermissions() {
  console.log('🔍 Google Cloud Storage Permission Diagnostics');
  console.log('=============================================\n');

  try {
    // Initialize storage with service account credentials
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (!credentialsJson) {
      console.error('❌ GOOGLE_APPLICATION_CREDENTIALS not set');
      process.exit(1);
    }

    const credentials = JSON.parse(credentialsJson);
    console.log('📋 Service Account Information:');
    console.log(`   Email: ${credentials.client_email}`);
    console.log(`   Project: ${credentials.project_id}`);
    console.log(`   Key ID: ${credentials.private_key_id}\n`);

    const storage = new Storage({
      projectId: credentials.project_id,
      credentials
    });

    const bucket = storage.bucket(BUCKET_NAME);

    // Test 1: Check if bucket exists
    console.log('Test 1: Checking if bucket exists...');
    try {
      const [exists] = await bucket.exists();
      if (exists) {
        console.log(`✅ Bucket "${BUCKET_NAME}" exists\n`);
      } else {
        console.log(`❌ Bucket "${BUCKET_NAME}" does not exist\n`);
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`❌ Error checking bucket existence:`, error.message);
      console.error(`   Code: ${error.code}\n`);
    }

    // Test 2: Try to list bucket contents
    console.log('Test 2: Attempting to list bucket contents...');
    try {
      const [files] = await bucket.getFiles({ maxResults: 5 });
      console.log(`✅ Successfully listed bucket contents`);
      console.log(`   Found ${files.length} files (showing first 5)\n`);
    } catch (error: any) {
      console.error(`❌ Error listing bucket contents:`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Code: ${error.code}`);
      console.error(`   Status: ${error.status || 'N/A'}\n`);
    }

    // Test 3: Get bucket metadata
    console.log('Test 3: Fetching bucket metadata...');
    try {
      const [metadata] = await bucket.getMetadata();
      console.log(`✅ Successfully fetched bucket metadata`);
      console.log(`   Location: ${metadata.location}`);
      console.log(`   Storage Class: ${metadata.storageClass}`);
      console.log(`   Created: ${metadata.timeCreated}\n`);
    } catch (error: any) {
      console.error(`❌ Error fetching bucket metadata:`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Code: ${error.code}\n`);
    }

    // Test 4: Get bucket IAM policy
    console.log('Test 4: Fetching bucket IAM policy...');
    try {
      const [policy] = await bucket.iam.getPolicy();
      console.log(`✅ Successfully fetched IAM policy`);
      
      // Find bindings for our service account
      const ourBindings = policy.bindings?.filter((binding: any) => 
        binding.members?.some((member: string) => 
          member.includes(credentials.client_email)
        )
      );

      if (ourBindings && ourBindings.length > 0) {
        console.log(`\n📊 IAM Roles for ${credentials.client_email}:`);
        ourBindings.forEach((binding: any) => {
          console.log(`   - ${binding.role}`);
        });
      } else {
        console.log(`\n⚠️  Service account NOT found in bucket IAM policy!`);
        console.log(`   This is likely the root cause of 403 errors.\n`);
      }
      console.log();
    } catch (error: any) {
      console.error(`❌ Error fetching IAM policy:`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Code: ${error.code}\n`);
    }

    // Test 5: Try to create a test file
    console.log('Test 5: Attempting to upload a test file...');
    try {
      const testFileName = `petwash-diagnostic-test-${Date.now()}.txt`;
      const testContent = 'PetWash™ Diagnostic Test - Service Account Permission Verification';
      
      const file = bucket.file(testFileName);
      await file.save(testContent, {
        metadata: {
          contentType: 'text/plain',
        },
      });
      
      console.log(`✅ Successfully uploaded test file: ${testFileName}`);
      console.log(`   This confirms storage.objects.create permission!\n`);

      // Clean up test file
      console.log('Test 6: Cleaning up test file...');
      await file.delete();
      console.log(`✅ Successfully deleted test file\n`);

    } catch (error: any) {
      console.error(`❌ Error uploading test file:`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Code: ${error.code}`);
      console.error(`   Status: ${error.status || 'N/A'}`);
      
      if (error.code === 403) {
        console.error(`\n🔒 403 FORBIDDEN - Missing Permission`);
        console.error(`   The service account lacks "storage.objects.create" permission`);
        console.error(`\n💡 Required Actions:`);
        console.error(`   1. Go to: https://console.cloud.google.com/storage/browser/${BUCKET_NAME}`);
        console.error(`   2. Click "PERMISSIONS" tab`);
        console.error(`   3. Click "+ GRANT ACCESS"`);
        console.error(`   4. Add principal: ${credentials.client_email}`);
        console.error(`   5. Assign role: "Storage Object Admin" or "Firebase Storage Admin"`);
        console.error(`   6. Save and wait 2-5 minutes for propagation\n`);
        
        console.error(`   Alternative roles to try:`);
        console.error(`   - roles/storage.objectAdmin (Google Cloud Storage)`);
        console.error(`   - roles/firebasestorage.admin (Firebase Storage)`);
        console.error(`   - roles/firebasestorage.objectAdmin (Firebase Storage Objects)\n`);
      }
    }

  } catch (error: any) {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  }
}

diagnosePermissions().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
