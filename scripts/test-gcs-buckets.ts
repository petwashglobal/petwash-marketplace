/**
 * PetWash™ — GCS Bucket Connectivity Test
 * Tests all 9 operational buckets for existence and read/write access.
 * Run: npx tsx scripts/test-gcs-buckets.ts
 */

import { Storage } from '@google-cloud/storage';

const BUCKETS = [
  process.env.GCS_BACKUP_BUCKET            || 'petwash-transactions-backup',
  process.env.GCS_CODE_BUCKET              || 'petwash-code-backups',
  process.env.GCS_FIRESTORE_BUCKET         || 'petwash-firestore-backups',
  process.env.GCS_DOCUMENTS_BUCKET         || 'petwash-secure-documents',
  process.env.GCS_STAMPS_BUCKET            || 'petwash-legal-stamps',
  process.env.CONTRACTOR_DOCS_BUCKET       || 'petwash-contractor-documents',
  process.env.GCS_MESSAGE_ATTACHMENTS_BUCKET || 'petwash-message-attachments',
  'petwash-secure-messages',
  process.env.GCS_LOGS_BUCKET             || 'petwash-logs-retention',
];

async function testGCSBuckets() {
  const credEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!credEnv) {
    console.error('❌ No GCS credentials found. Set FIREBASE_SERVICE_ACCOUNT_KEY.');
    process.exit(1);
  }

  const credentials = JSON.parse(credEnv);
  const storage = new Storage({ credentials });

  console.log('═'.repeat(60));
  console.log('  PetWash™ — GCS Bucket Connectivity Test');
  console.log('═'.repeat(60));
  const redactedEmail = credentials.client_email?.replace(/^(.{3}).*(@.*)$/, '$1***$2') ?? '(unknown)';
  console.log(`  Service Account : ${redactedEmail}`);
  console.log(`  Project         : ${credentials.project_id}`);
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const bucketName of BUCKETS) {
    process.stdout.write(`  gs://${bucketName.padEnd(36)} `);

    try {
      const bucket = storage.bucket(bucketName);
      const [exists] = await bucket.exists();

      if (!exists) {
        console.log('❌ NOT FOUND');
        console.log(`     → Run: npx tsx scripts/create-gcs-buckets.ts`);
        failed++;
        continue;
      }

      // Write test
      const testFile = bucket.file(`_healthcheck/test-${Date.now()}.txt`);
      await testFile.save('petwash-healthcheck', { metadata: { contentType: 'text/plain' } });

      // Read test
      await testFile.download();

      // Clean up
      await testFile.delete().catch(() => {});

      console.log('✅ OK (read/write)');
      passed++;

    } catch (err: any) {
      if (err.code === 403 || err.code === 'PERMISSION_DENIED') {
        console.log('⚠️  EXISTS but no write access');
        const redactedEmailErr = credentials.client_email?.replace(/^(.{3}).*(@.*)$/, '$1***$2') ?? '(unknown)';
        console.log(`     → Grant Storage Object Admin to: ${redactedEmailErr}`);
      } else {
        console.log(`❌ ERROR: ${err.message}`);
      }
      failed++;
    }
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log(`  Firebase Storage (separate): gs://signinpetwash.firebasestorage.app`);
  console.log('─'.repeat(60));
  console.log(`  Passed: ${passed} / ${BUCKETS.length}   Failed: ${failed}`);
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

testGCSBuckets().catch((err) => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
