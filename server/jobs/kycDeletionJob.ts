import { db } from '../db';
import { kycQuarantineObjects } from '@shared/schema';
import { and, eq, lt, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { storage as firebaseStorage } from '../lib/firebase-admin';
import { Storage } from '@google-cloud/storage';

const GCS_BUCKET = process.env.GCS_DOCUMENTS_BUCKET || 'petwash-secure-documents';
const JOB_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let gcsStorage: Storage | null = null;

function getGcsStorage(): Storage {
  if (!gcsStorage) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      gcsStorage = new Storage({ credentials });
    } else {
      gcsStorage = new Storage();
    }
  }
  return gcsStorage;
}

async function deleteFromFirebaseStorage(objectKey: string): Promise<void> {
  const bucket = firebaseStorage.bucket('gs://signinpetwash.firebasestorage.app');
  await bucket.file(objectKey).delete();
}

async function deleteFromGcs(objectKey: string): Promise<void> {
  const gcs = getGcsStorage();
  await gcs.bucket(GCS_BUCKET).file(objectKey).delete();
}

async function runDeletionPass(): Promise<void> {
  let rows: typeof kycQuarantineObjects.$inferSelect[] = [];

  try {
    rows = await db
      .select()
      .from(kycQuarantineObjects)
      .where(
        and(
          eq(kycQuarantineObjects.deletionStatus, 'pending'),
          lt(kycQuarantineObjects.deleteBy, sql`NOW()`)
        )
      )
      .limit(100);
  } catch (err) {
    logger.warn('[KycDeletion] Could not query quarantine table (non-fatal)', { error: (err as Error).message });
    return;
  }

  if (rows.length === 0) return;

  logger.info(`[KycDeletion] Processing ${rows.length} overdue quarantine object(s)`);

  for (const row of rows) {
    try {
      if (row.storageSystem === 'firebase_storage') {
        await deleteFromFirebaseStorage(row.objectKey);
      } else if (row.storageSystem === 'gcs') {
        await deleteFromGcs(row.objectKey);
      } else {
        logger.warn('[KycDeletion] Unknown storage system', { id: row.id, storageSystem: row.storageSystem });
        continue;
      }

      await db
        .update(kycQuarantineObjects)
        .set({ deletionStatus: 'completed', deletedAt: new Date() })
        .where(eq(kycQuarantineObjects.id, row.id));

      logger.info('[KycDeletion] Deleted', { id: row.id, storageSystem: row.storageSystem, objectKey: row.objectKey });
    } catch (deleteErr) {
      const msg = (deleteErr as Error).message;
      const isAlreadyGone = msg.includes('No such object') || msg.includes('404') || msg.includes('not found');

      if (isAlreadyGone) {
        await db
          .update(kycQuarantineObjects)
          .set({ deletionStatus: 'completed', deletedAt: new Date() })
          .where(eq(kycQuarantineObjects.id, row.id))
          .catch(() => {});
        logger.info('[KycDeletion] Object already absent, marking completed', { id: row.id });
      } else {
        await db
          .update(kycQuarantineObjects)
          .set({ deletionStatus: 'failed' })
          .where(eq(kycQuarantineObjects.id, row.id))
          .catch(() => {});
        logger.error('[KycDeletion] Deletion failed', { id: row.id, objectKey: row.objectKey, error: msg });
      }
    }
  }
}

export function startKycDeletionJob(): void {
  logger.info('[KycDeletion] Starting compliance deletion job (interval: 15 min)');
  runDeletionPass().catch(e => logger.warn('[KycDeletion] Initial pass error', e));
  setInterval(() => {
    runDeletionPass().catch(e => logger.warn('[KycDeletion] Pass error', e));
  }, JOB_INTERVAL_MS);
}
