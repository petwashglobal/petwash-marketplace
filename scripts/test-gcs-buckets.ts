/**
 * Test GCS bucket connectivity and permissions
 * Run: npx tsx scripts/test-gcs-buckets.ts
 */

import { Storage } from '@google-cloud/storage';

async function testGCSBuckets() {
  try {
    // Initialize storage client with Firebase credentials
    const credentialsJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!credentialsJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found in environment');
    }

    const credentials = JSON.parse(credentialsJson);
    const storage = new Storage({ credentials });
    
    console.log('✅ Storage client initialized');
    console.log('📦 Project:', credentials.project_id);
    console.log('🔑 Service Account:', credentials.client_email);
    console.log('');
    
    // Get bucket names from environment or use defaults
    const buckets = [
      process.env.GCS_CODE_BUCKET || 'petwash-code-backups',
      process.env.GCS_FIRESTORE_BUCKET || 'petwash-firestore-backups'
    ];
    
    console.log('Testing buckets:', buckets.join(', '));
    console.log('─'.repeat(60));
    console.log('');
    
    for (const bucketName of buckets) {
      console.log(`Testing: ${bucketName}`);
      
      try {
        const bucket = storage.bucket(bucketName);
        
        // Test 1: Check if bucket exists
        const [exists] = await bucket.exists();
        
        if (!exists) {
          console.log(`❌ Bucket does NOT exist: ${bucketName}`);
          console.log(`   Create at: https://console.cloud.google.com/storage/browser?project=${credentials.project_id}`);
          console.log('');
          continue;
        }
        
        console.log(`✅ Bucket exists`);
        
        // Test 2: Write permission
        const testFileName = `test-connection-${Date.now()}.txt`;
        const testFile = bucket.file(testFileName);
        const testContent = `Connection test from Replit at ${new Date().toISOString()}`;
        
        await testFile.save(testContent, {
          metadata: {
            contentType: 'text/plain',
          },
        });
        console.log(`✅ Write permission: OK`);
        
        // Test 3: Read permission
        const [downloadedContent] = await testFile.download();
        const contentMatches = downloadedContent.toString() === testContent;
        console.log(`✅ Read permission: OK ${contentMatches ? '(content verified)' : ''}`);
        
        // Test 4: Delete permission
        await testFile.delete();
        console.log(`✅ Delete permission: OK`);
        
        console.log(`✅ All tests passed for ${bucketName}`);
        
      } catch (error: any) {
        console.log(`❌ Error with ${bucketName}:`);
        console.log(`   Code: ${error.code}`);
        console.log(`   Message: ${error.message}`);
        
        if (error.code === 403 || error.code === 'PERMISSION_DENIED') {
          console.log('');
          console.log('   🔧 FIX: Grant "Storage Object Admin" role to:');
          console.log(`      ${credentials.client_email}`);
          console.log('');
          console.log('   Steps:');
          console.log('   1. Go to https://console.cloud.google.com/storage/browser');
          console.log(`   2. Select bucket: ${bucketName}`);
          console.log('   3. Click "Permissions" tab');
          console.log('   4. Click "Grant Access"');
          console.log('   5. Add service account email above');
          console.log('   6. Select role: "Storage Object Admin"');
        }
      }
      
      console.log('');
    }
    
    console.log('─'.repeat(60));
    console.log('Test complete!');
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

testGCSBuckets();
