import { db } from '../db';
import { kycQuarantineObjects, kycEvents, providers } from '../../shared/schema';
import { storage, db as firestoreDb } from '../lib/firebase-admin';
import { Storage } from '@google-cloud/storage';
import { eq, and, lt } from 'drizzle-orm';
import { logger } from '../lib/logger';

const FIREBASE_BUCKET = 'gs://signinpetwash.firebasestorage.app';
const GCS_BUCKET = process.env.GCS_DOCUMENTS_BUCKET || 'petwash-secure-documents';

let gcsStorage: Storage;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    gcsStorage = new Storage({ credentials });
  } else {
    gcsStorage = new Storage();
  }
} catch {
  gcsStorage = new Storage();
}

async function runKycDeletion(): Promise<void> {
  try {
    const now = new Date();

    const overdueRows = await db
      .select()
      .from(kycQuarantineObjects)
      .where(
        and(
          eq(kycQuarantineObjects.deletionStatus, 'pending'),
          lt(kycQuarantineObjects.deleteBy, now)
        )
      );

    if (overdueRows.length === 0) return;

    logger.info(`[KycDeletionJob] Processing ${overdueRows.length} overdue quarantine row(s)`);

    for (const row of overdueRows) {
      try {
        if (row.storageSystem === 'firebase_storage') {
          const bucket = storage.bucket(FIREBASE_BUCKET);
          try {
            await bucket.file(row.objectKey).delete();
          } catch (err: any) {
            if (err.code !== 404) throw err;
          }
          try {
            await firestoreDb.collection('users').doc(row.userId).update({
              'kyc.docPaths': [],
              'kyc.documentsDeleted': true,
            });
          } catch (fsErr) {
            logger.warn(`[KycDeletionJob] Firestore update failed for uid=${row.userId}:`, fsErr);
          }
        } else if (row.storageSystem === 'gcs') {
          const bucket = gcsStorage.bucket(GCS_BUCKET);
          try {
            await bucket.file(row.objectKey).delete();
          } catch (err: any) {
            if (err.code !== 404) throw err;
          }
          try {
            await db
              .update(providers)
              .set({ kycDeletionCompletedAt: new Date() })
              .where(eq(providers.userId, row.userId));
          } catch (provErr) {
            logger.warn(`[KycDeletionJob] providers.kyc_deletion_completed_at update failed for uid=${row.userId}:`, provErr);
          }
        }

        await db
          .update(kycQuarantineObjects)
          .set({ deletionStatus: 'completed', deletedAt: new Date() })
          .where(eq(kycQuarantineObjects.id, row.id));

        await db.insert(kycEvents).values({
          userId: row.userId,
          eventType: 'file_deleted',
          actor: 'auto_delete_job',
          result: 'success',
          reason: `Auto-deleted after ${row.reasonCode ? `extended retention (${row.reasonCode})` : 'standard 24h window'}`,
        });

        logger.info(`[KycDeletionJob] Deleted ${row.storageSystem} file: ${row.objectKey}`);
      } catch (err) {
        logger.error(`[KycDeletionJob] Failed to delete objectKey=${row.objectKey}:`, err);
        await db
          .update(kycQuarantineObjects)
          .set({ deletionStatus: 'failed' })
          .where(eq(kycQuarantineObjects.id, row.id));
      }
    }
  } catch (err) {
    logger.error('[KycDeletionJob] Job run error:', err);
  }
}

export function startKycDeletionJob(): void {
  logger.info('[KycDeletionJob] Starting — runs every 15 minutes');
  runKycDeletion();
  setInterval(runKycDeletion, 15 * 60 * 1000);
}
