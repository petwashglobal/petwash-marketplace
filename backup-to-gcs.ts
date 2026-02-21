import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

async function uploadToGCS() {
  const credsJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!credsJson) throw new Error('No GCS credentials');
  
  const credentials = JSON.parse(credsJson);
  const storage = new Storage({ credentials, projectId: credentials.project_id });
  
  // Try creating the bucket if it doesn't exist, otherwise use Firebase Storage bucket
  const primaryBucket = 'petwash-secure-documents';
  const fallbackBucket = 'signinpetwash.firebasestorage.app';
  
  let bucketName = primaryBucket;
  
  try {
    const [exists] = await storage.bucket(primaryBucket).exists();
    if (!exists) {
      console.log(`Bucket ${primaryBucket} not found, creating...`);
      await storage.createBucket(primaryBucket, { location: 'me-west1' });
      console.log(`✅ Created bucket: ${primaryBucket}`);
    }
  } catch (createErr: any) {
    console.log(`Cannot create ${primaryBucket}: ${createErr.message}`);
    console.log(`Using fallback bucket: ${fallbackBucket}`);
    bucketName = fallbackBucket;
  }
  
  const backupFile = process.argv[2];
  if (!backupFile) throw new Error('No backup file specified');
  const fileName = path.basename(backupFile);
  const destination = `codebase-backups/${fileName}`;
  
  const fileBuffer = fs.readFileSync(backupFile);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  console.log(`Uploading ${fileName} (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB) to gs://${bucketName}/${destination}`);
  console.log(`SHA-256: ${hash}`);
  
  await storage.bucket(bucketName).upload(backupFile, {
    destination,
    metadata: {
      metadata: {
        sha256Hash: hash,
        backupType: 'full-codebase',
        backupDate: new Date().toISOString(),
        retentionYears: '7',
        platform: 'PetWash',
      }
    }
  });
  
  console.log(`✅ Uploaded to GCS: gs://${bucketName}/${destination}`);
}

uploadToGCS().catch((e: any) => { console.error('GCS backup failed:', e.message); process.exit(1); });
