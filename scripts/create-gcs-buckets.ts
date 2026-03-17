/**
 * PetWash™ — Complete GCS Bucket Provisioning
 * Region: me-west1 (Tel Aviv) — Israeli data residency + GDPR
 * 
 * Buckets: 9 operational + Firebase Storage (managed separately)
 * Run: npx tsx scripts/create-gcs-buckets.ts
 */

import { Storage } from '@google-cloud/storage';

// ---------------------------------------------------------------------------
// Bucket definitions
// ---------------------------------------------------------------------------

interface BucketConfig {
  name: string;
  purpose: string;
  storageClass: string;
  versioning: boolean;
  retentionDays?: number;       // undefined = no retention lock
  lifecycleDays?: number;       // delete-after for logs/temp
  uniformBucketLevelAccess: boolean;
}

const REGION = 'me-west1';

const BUCKETS: BucketConfig[] = [
  {
    name: process.env.GCS_BACKUP_BUCKET || 'petwash-transactions-backup',
    purpose: 'k9000-transactions',
    storageClass: 'STANDARD',
    versioning: true,
    retentionDays: 2555,   // 7 years (financial records — Israeli law)
    uniformBucketLevelAccess: true,
  },
  {
    name: process.env.GCS_CODE_BUCKET || 'petwash-code-backups',
    purpose: 'code-backups',
    storageClass: 'NEARLINE',
    versioning: true,
    lifecycleDays: 365,    // Keep 1 year of code snapshots
    uniformBucketLevelAccess: true,
  },
  {
    name: process.env.GCS_FIRESTORE_BUCKET || 'petwash-firestore-backups',
    purpose: 'firestore-exports',
    storageClass: 'NEARLINE',
    versioning: true,
    lifecycleDays: 365,
    uniformBucketLevelAccess: true,
  },
  {
    name: process.env.GCS_DOCUMENTS_BUCKET || 'petwash-secure-documents',
    purpose: 'user-documents-financial',
    storageClass: 'STANDARD',
    versioning: true,
    retentionDays: 1825,   // 5 years
    uniformBucketLevelAccess: true,
  },
  {
    name: process.env.GCS_STAMPS_BUCKET || 'petwash-legal-stamps',
    purpose: 'immutable-legal-stamps',
    storageClass: 'STANDARD',
    versioning: false,
    retentionDays: 3650,   // 10 years (WORM — immutable legal evidence)
    uniformBucketLevelAccess: true,
  },
  {
    name: process.env.CONTRACTOR_DOCS_BUCKET || 'petwash-contractor-documents',
    purpose: 'contractor-onboarding',
    storageClass: 'STANDARD',
    versioning: true,
    retentionDays: 2555,   // 7 years
    uniformBucketLevelAccess: true,
  },
  {
    name: process.env.GCS_MESSAGE_ATTACHMENTS_BUCKET || 'petwash-message-attachments',
    purpose: 'message-attachments',
    storageClass: 'STANDARD',
    versioning: false,
    lifecycleDays: 1095,   // 3 years then delete
    uniformBucketLevelAccess: true,
  },
  {
    name: 'petwash-secure-messages',
    purpose: 'encrypted-messages-archive',
    storageClass: 'NEARLINE',
    versioning: false,
    lifecycleDays: 1095,   // 3 years
    uniformBucketLevelAccess: true,
  },
  {
    name: process.env.GCS_LOGS_BUCKET || 'petwash-logs-retention',
    purpose: 'application-logs',
    storageClass: 'COLDLINE',
    versioning: false,
    lifecycleDays: 365,    // 1 year log retention
    uniformBucketLevelAccess: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStorageClient(): Storage {
  const credEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (credEnv) {
    try {
      const credentials = JSON.parse(credEnv);
      console.log(`🔑 Using service account: ${credentials.client_email}`);
      console.log(`📂 Project: ${credentials.project_id}\n`);
      return new Storage({ credentials });
    } catch {
      /* fall through */
    }
  }

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile) {
    console.log(`🔑 Using key file: ${keyFile}\n`);
    return new Storage({ keyFilename: keyFile });
  }

  console.log('🔑 Using Application Default Credentials\n');
  return new Storage();
}

function buildLifecycleRules(cfg: BucketConfig) {
  const rules: any[] = [];
  if (cfg.lifecycleDays) {
    rules.push({
      action: { type: 'Delete' },
      condition: { age: cfg.lifecycleDays },
    });
  }
  return rules;
}

async function provisionBucket(
  storage: Storage,
  cfg: BucketConfig
): Promise<'created' | 'exists' | 'error'> {
  const bucket = storage.bucket(cfg.name);

  try {
    const [exists] = await bucket.exists();
    if (exists) {
      console.log(`  ✅ Already exists → gs://${cfg.name}`);
      return 'exists';
    }

    console.log(`  📦 Creating → gs://${cfg.name} [${cfg.storageClass}, ${REGION}]`);

    const lifecycleRules = buildLifecycleRules(cfg);

    await storage.createBucket(cfg.name, {
      location: REGION,
      storageClass: cfg.storageClass,
      uniformBucketLevelAccess: cfg.uniformBucketLevelAccess,
      ...(lifecycleRules.length ? { lifecycle: { rule: lifecycleRules } } : {}),
      labels: {
        app: 'petwash',
        purpose: cfg.purpose,
        region: REGION,
        managed: 'terraform-equivalent',
      },
    });

    // Enable versioning
    if (cfg.versioning) {
      await bucket.setMetadata({ versioning: { enabled: true } });
      console.log(`  ↪  Versioning enabled`);
    }

    // Set retention policy (after creation — requires separate call)
    if (cfg.retentionDays) {
      const retentionSeconds = cfg.retentionDays * 86400;
      await bucket.setRetentionPeriod(retentionSeconds);
      console.log(`  ↪  Retention policy: ${cfg.retentionDays} days`);
    }

    console.log(`  ✅ Created → gs://${cfg.name}`);
    return 'created';

  } catch (err: any) {
    console.error(`  ❌ ${cfg.name}: ${err.message} (code: ${err.code})`);
    if (err.code === 403 || err.code === 'PERMISSION_DENIED') {
      console.error(`     → Grant roles/storage.admin to the service account`);
    }
    if (err.code === 409 || err.message?.includes('You already own')) {
      console.log(`  ✅ Bucket already exists (conflict 409) → gs://${cfg.name}`);
      return 'exists';
    }
    return 'error';
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('═'.repeat(60));
  console.log('  PetWash™ — GCS Bucket Provisioning');
  console.log(`  Region: ${REGION} (Tel Aviv)`);
  console.log('═'.repeat(60));
  console.log('');

  const storage = getStorageClient();

  const results: Record<string, 'created' | 'exists' | 'error'> = {};

  for (const cfg of BUCKETS) {
    console.log(`[${cfg.purpose}]`);
    results[cfg.name] = await provisionBucket(storage, cfg);
    console.log('');
  }

  // Summary
  console.log('═'.repeat(60));
  console.log('  Summary');
  console.log('═'.repeat(60));

  let errors = 0;
  for (const [name, status] of Object.entries(results)) {
    const icon = status === 'error' ? '❌' : '✅';
    const tag = status === 'created' ? ' [NEW]' : status === 'exists' ? ' [EXISTS]' : ' [FAILED]';
    console.log(`  ${icon} gs://${name}${tag}`);
    if (status === 'error') errors++;
  }

  console.log('');
  console.log(`  Firebase Storage (managed separately): gs://signinpetwash.firebasestorage.app ✅`);
  console.log('');

  if (errors === 0) {
    console.log('  ✨ All 9 GCS buckets ready for production!\n');

    console.log('  Next Steps:');
    console.log('  1. Grant Storage Object Admin on each bucket to the Cloud Run service account');
    console.log('  2. Set GCS_* env vars in Cloud Run / Secret Manager:');
    console.log('       GCS_BACKUP_BUCKET=petwash-transactions-backup');
    console.log('       GCS_CODE_BUCKET=petwash-code-backups');
    console.log('       GCS_FIRESTORE_BUCKET=petwash-firestore-backups');
    console.log('       GCS_DOCUMENTS_BUCKET=petwash-secure-documents');
    console.log('       GCS_STAMPS_BUCKET=petwash-legal-stamps');
    console.log('       CONTRACTOR_DOCS_BUCKET=petwash-contractor-documents');
    console.log('       GCS_MESSAGE_ATTACHMENTS_BUCKET=petwash-message-attachments');
    console.log('       GCS_LOGS_BUCKET=petwash-logs-retention');
    console.log('  3. Run: npx tsx scripts/test-gcs-buckets.ts to verify access');
    process.exit(0);
  } else {
    console.error(`  ❌ ${errors} bucket(s) failed. Review permissions and retry.\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
