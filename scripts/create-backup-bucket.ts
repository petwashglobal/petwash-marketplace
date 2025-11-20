/**
 * Create PetWash Backups Bucket in Google Cloud Storage
 * Creates the bucket and grants service account permissions
 */

import { Storage } from '@google-cloud/storage';

const PROJECT_ID = 'nifty-quanta-475212-v3';
const BUCKET_NAME = 'petwash-backups';
const SERVICE_ACCOUNT_EMAIL = 'petwash-backup-service@nifty-quanta-475212-v3.iam.gserviceaccount.com';

async function createBackupBucket() {
  console.log('🔧 Creating PetWash Backup Bucket');
  console.log('=====================================\n');

  try {
    // Initialize storage with service account credentials
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (!credentialsJson) {
      console.error('❌ GOOGLE_APPLICATION_CREDENTIALS not set');
      process.exit(1);
    }

    const credentials = JSON.parse(credentialsJson);
    console.log(`📋 Using service account: ${credentials.client_email}`);
    console.log(`📋 Project: ${credentials.project_id}\n`);

    const storage = new Storage({
      projectId: PROJECT_ID,
      credentials
    });

    // Step 1: Check if bucket already exists
    console.log(`Step 1: Checking if bucket "${BUCKET_NAME}" exists...`);
    const bucket = storage.bucket(BUCKET_NAME);
    
    try {
      const [exists] = await bucket.exists();
      
      if (exists) {
        console.log(`✅ Bucket "${BUCKET_NAME}" already exists\n`);
      } else {
        // Step 2: Create the bucket
        console.log(`Step 2: Creating bucket "${BUCKET_NAME}"...`);
        
        const [createdBucket] = await storage.createBucket(BUCKET_NAME, {
          location: 'US',
          storageClass: 'STANDARD',
        });
        
        console.log(`✅ Bucket created successfully`);
        console.log(`   Location: ${createdBucket.metadata.location}`);
        console.log(`   Storage Class: ${createdBucket.metadata.storageClass}\n`);
      }
    } catch (error: any) {
      if (error.code === 409) {
        console.log(`✅ Bucket "${BUCKET_NAME}" already exists (owned by project)\n`);
      } else {
        throw error;
      }
    }

    // Step 3: Grant IAM permissions to service account
    console.log(`Step 3: Granting Storage Object Admin role to service account...`);
    
    try {
      const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
      
      // Check if service account already has the role
      const roleToAdd = 'roles/storage.objectAdmin';
      const memberToAdd = `serviceAccount:${SERVICE_ACCOUNT_EMAIL}`;
      
      let roleExists = false;
      if (policy.bindings) {
        for (const binding of policy.bindings) {
          if (binding.role === roleToAdd && binding.members?.includes(memberToAdd)) {
            roleExists = true;
            break;
          }
        }
      }
      
      if (roleExists) {
        console.log(`✅ Service account already has ${roleToAdd}\n`);
      } else {
        // Add the binding
        if (!policy.bindings) {
          policy.bindings = [];
        }
        
        // Find existing binding for this role or create new one
        let binding = policy.bindings.find(b => b.role === roleToAdd);
        if (binding) {
          if (!binding.members) {
            binding.members = [];
          }
          binding.members.push(memberToAdd);
        } else {
          policy.bindings.push({
            role: roleToAdd,
            members: [memberToAdd],
          });
        }
        
        await bucket.iam.setPolicy(policy);
        console.log(`✅ Granted ${roleToAdd} to ${SERVICE_ACCOUNT_EMAIL}\n`);
      }
    } catch (error: any) {
      console.error(`❌ Error granting IAM permissions:`, error.message);
      console.error(`   You may need to grant permissions manually in Cloud Console\n`);
    }

    // Step 4: Verify permissions
    console.log(`Step 4: Verifying service account can upload files...`);
    
    try {
      const testFileName = `petwash-test-${Date.now()}.txt`;
      const testContent = 'PetWash™ Backup Test - Bucket Creation Verification';
      
      const file = bucket.file(testFileName);
      await file.save(testContent, {
        metadata: {
          contentType: 'text/plain',
        },
      });
      
      console.log(`✅ Successfully uploaded test file`);
      
      // Clean up test file
      await file.delete();
      console.log(`✅ Successfully deleted test file\n`);
      
    } catch (error: any) {
      console.error(`❌ Error testing upload:`, error.message);
      console.error(`   Permissions may need time to propagate (wait 2-5 minutes)\n`);
    }

    console.log('🎉 Bucket setup complete!');
    console.log(`\n📦 Bucket: gs://${BUCKET_NAME}`);
    console.log(`🔑 Service Account: ${SERVICE_ACCOUNT_EMAIL}`);
    console.log(`✅ Ready for backups\n`);

  } catch (error: any) {
    console.error('💥 Error creating bucket:', error);
    
    if (error.code === 403) {
      console.error(`\n🔒 Permission Denied`);
      console.error(`The service account lacks permission to create buckets.`);
      console.error(`\nPlease create the bucket manually:`);
      console.error(`1. Go to: https://console.cloud.google.com/storage/create-bucket`);
      console.error(`2. Bucket name: ${BUCKET_NAME}`);
      console.error(`3. Location: United States (US)`);
      console.error(`4. Storage class: Standard`);
      console.error(`5. Click CREATE`);
      console.error(`\nThen grant permissions:`);
      console.error(`1. Go to bucket Permissions tab`);
      console.error(`2. Click + GRANT ACCESS`);
      console.error(`3. Add principal: ${SERVICE_ACCOUNT_EMAIL}`);
      console.error(`4. Role: Storage Object Admin`);
      console.error(`5. Click SAVE\n`);
    }
    
    process.exit(1);
  }
}

createBackupBucket().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
