/**
 * Google Cloud Storage Backup Service
 * Handles automated backups to GCS buckets
 */

import { Storage } from '@google-cloud/storage';
import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import sgMail from '../lib/sendgrid';
import { resolveGoogleServiceAccountJson } from '../lib/googleServiceAccount';

const execFileAsync = promisify(execFile);

// Environment-driven bucket names (no hardcoding)
const CODE_BUCKET = process.env.GCS_CODE_BUCKET || 'petwash-code-backups';
const FIRESTORE_BUCKET = process.env.GCS_FIRESTORE_BUCKET || 'petwash-firestore-backups';
const TEMP_DIR = '/tmp/petwash-backups';

let storage: Storage | null = null;

// Initialize storage client - PRODUCTION: Environment variables ONLY
// Uses the shared Google service-account credential chain (see server/lib/googleServiceAccount.ts).
function getStorageClient(): Storage {
  if (!storage) {
    const credentialsJson = resolveGoogleServiceAccountJson();

    if (!credentialsJson) {
      throw new Error('[GCS] No Google credentials found. Set GOOGLE_APPLICATION_CREDENTIALS_JSON in Replit Secrets.');
    }
    
    try {
      const credentials = JSON.parse(credentialsJson);
      storage = new Storage({ credentials });
      logger.info('[GCS] Storage client initialized from environment variable (secure)');
    } catch (error) {
      throw new Error(`[GCS] Failed to parse Google credentials JSON: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }
  
  return storage;
}

/**
 * Create weekly code backup and upload to GCS
 */
export async function performWeeklyCodeBackup(): Promise<{
  success: boolean;
  backupFile?: string;
  size?: string;
  gcsUrl?: string;
  error?: string;
}> {
  const startTime = Date.now();
  const date = new Date().toISOString().split('T')[0];
  const backupFile = `petwash-code-${date}.tar.gz`;
  const localPath = path.join(TEMP_DIR, backupFile);
  
  try {
    logger.info('[GCS] Starting weekly code backup...');
    
    // Create temp directory
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    // Create tar.gz backup
    // Use execFile (not exec) to avoid shell injection from environment-derived path values
    logger.info('[GCS] Creating compressed backup...');
    await execFileAsync('tar', [
      '-czf', localPath,
      '--exclude=node_modules',
      '--exclude=.git',
      '--exclude=dist',
      '--exclude=.cache',
      '--exclude=*.log',
      '--exclude=petwash-backup-*.tar.gz',
      '--exclude=gcs-service-account.json',
      '-C', process.cwd(), '.',
    ], { maxBuffer: 1024 * 1024 * 100 });
    
    // Get file size and calculate hash
    const stats = fs.statSync(localPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    logger.info(`[GCS] Backup created: ${sizeMB} MB`);
    
    logger.info('[GCS] Calculating integrity hash...');
    const fileHash = calculateFileHash(localPath);
    logger.info(`[GCS] SHA-256: ${fileHash}`);
    
    // Upload to GCS
    const storageClient = getStorageClient();
    logger.info(`[GCS] Uploading to gs://${CODE_BUCKET}/${backupFile}...`);
    
    await storageClient.bucket(CODE_BUCKET).upload(localPath, {
      destination: backupFile,
      metadata: {
        metadata: {
          project: 'petwash',
          type: 'code-backup',
          date,
          timestamp: new Date().toISOString(),
          sha256: fileHash
        }
      }
    });
    
    const gcsUrl = `gs://${CODE_BUCKET}/${backupFile}`;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const timestamp = new Date().toISOString();
    
    logger.info(`[GCS] ✅ Code backup complete in ${duration}s: ${gcsUrl}`);

    // Clean up local file
    fs.unlinkSync(localPath);

    // Log to Firestore — BEST EFFORT. The upload above is the backup; the
    // runtime SA can lack Firestore write (PERMISSION_DENIED), and an
    // unguarded await here turned a SUCCESSFUL upload into a 500 → Cloud
    // Scheduler status 13 (the weekly code-backup failure). Mirror the
    // postgres path (#1168): a dump that landed in GCS IS a success.
    try {
      await db.collection('backup_logs').add({
        type: 'code',
        status: 'success',
        backupFile,
        sizeMB: parseFloat(sizeMB),
        gcsUrl,
        sha256: fileHash,
        duration: parseFloat(duration),
        timestamp
      });
    } catch (logErr: any) {
      logger.warn('[GCS] Code backup uploaded OK but backup_logs write failed (non-fatal)', { error: logErr?.message });
    }

    // Send backup summary email with CSV attachment — also best-effort; an
    // email/SendGrid failure must not fail a backup that already landed.
    try {
      await sendBackupSummaryEmail({
        type: 'code',
        timestamp,
        codeBackup: {
          file: backupFile,
          size: `${sizeMB} MB`,
          hash: fileHash,
          gcsUrl
        },
        includeCSV: true
      });
    } catch (emailErr: any) {
      logger.warn('[GCS] Code backup summary email failed (non-fatal)', { error: emailErr?.message });
    }

    return {
      success: true,
      backupFile,
      size: `${sizeMB} MB`,
      gcsUrl
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[GCS] Code backup failed:', error);
    
    // Clean up on error
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    
    // Log error to Firestore
    await db.collection('backup_logs').add({
      type: 'code',
      status: 'failed',
      error: errorMsg,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: errorMsg
    };
  }
}

const POSTGRES_BUCKET = process.env.GCS_POSTGRES_BUCKET || 'petwash-postgres-backups';

/**
 * Resolve the pg_dump binary, GUARANTEEING a version >= the Neon server major.
 *
 * Why this exists: the runtime image installs postgresql-client-18 (PGDG), but
 * the bare `pg_dump` on PATH is the postgresql-common WRAPPER, whose selected
 * version depends on what else is installed. If any older client (e.g. 17) ever
 * lands in the image, the wrapper can resolve to it and pg_dump REFUSES a newer
 * server ("server version mismatch" — the 2026-06-26 backup failure, Neon PG18
 * vs pg_dump 17.10). Pinning the versioned binary path removes that ambiguity.
 *
 * Order: explicit PG_DUMP_PATH override → versioned PGDG path(s), newest first →
 * bare `pg_dump` (last resort). Bump the version list when Neon's major changes.
 */
function resolvePgDumpBinary(): string {
  const candidates = [
    process.env.PG_DUMP_PATH,
    '/usr/lib/postgresql/18/bin/pg_dump',
    '/usr/lib/postgresql/19/bin/pg_dump',
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch { /* noop */ }
  }
  return 'pg_dump';
}

/**
 * Verify the Postgres backup bucket exists — the nightly job NEVER creates it.
 *
 * Production pattern (CEO backup spec 2026-06-28): a GCP admin creates the bucket
 * ONCE; the backup service account gets only roles/storage.objectCreator and just
 * UPLOADS. The previous code called createBucket() on every run, which needs
 * storage.buckets.create — a permission the backup SA intentionally does NOT have,
 * so the nightly run failed with "does not have storage.buckets.create access".
 * Creating infrastructure is not the backup job's responsibility.
 *
 * If the bucket is missing we fail LOUD with the exact one-time admin commands
 * (never a silent no-backup, never an attempt to create it). If the existence
 * probe itself is denied (objectCreator-only SAs may lack storage.buckets.get),
 * we skip the probe and proceed to upload — a genuinely-missing bucket then fails
 * clearly on the upload.
 */
async function ensurePostgresBucket(storageClient: Storage): Promise<void> {
  const bucket = storageClient.bucket(POSTGRES_BUCKET);
  try {
    const [exists] = await bucket.exists();
    if (exists) return;
    throw new Error(
      `Backup bucket gs://${POSTGRES_BUCKET} does not exist. A GCP admin must create it ONCE — ` +
      `the nightly job does not (and must not) create buckets. Run:\n` +
      `  gcloud storage buckets create gs://${POSTGRES_BUCKET} --location=${process.env.GCS_BACKUP_LOCATION || 'me-west1'} --uniform-bucket-level-access --public-access-prevention\n` +
      `then grant upload-only access:\n` +
      `  gcloud storage buckets add-iam-policy-binding gs://${POSTGRES_BUCKET} --member="serviceAccount:github-actions@signinpetwash.iam.gserviceaccount.com" --role="roles/storage.objectCreator"`,
    );
  } catch (e: any) {
    if (/does not exist/.test(e?.message || '')) throw e;
    // exists() denied (objectCreator lacks storage.buckets.get) — don't block;
    // upload will surface a clear error if the bucket is truly missing.
    logger.warn(`[GCS] bucket existence probe skipped (no storage.buckets.get) — proceeding to upload`, { error: e?.message });
  }
}

/**
 * Nightly PostgreSQL logical backup → GCS.
 *
 * Postgres (Neon) is the source of truth — users, bookings, money, providers,
 * loyalty — yet until now ONLY Firestore + code were backed up. A Neon incident
 * had no independent recovery copy. This runs pg_dump in PostgreSQL's portable
 * custom format (compressed, restorable with pg_restore), uploads it to GCS with
 * a SHA-256 integrity hash, and logs the result.
 *
 * IMPORTANT — fails LOUDLY: if DATABASE_URL/credentials are missing, or the
 * pg_dump binary isn't in the runtime image, this does NOT silently succeed.
 * It records a failed backup_log, emails the summary, and fires a security alert,
 * so a non-working backup is always visible (the opposite of the dead scheduler).
 * Neon's own point-in-time recovery (PITR) remains the first-line safety net —
 * this GCS dump is the independent second copy.
 */
export async function performPostgresBackup(): Promise<{
  success: boolean;
  backupFile?: string;
  size?: string;
  gcsUrl?: string;
  error?: string;
}> {
  const startTime = Date.now();
  const date = new Date().toISOString().split('T')[0];
  const stamp = `${date}_${Date.now()}`;
  const backupFile = `petwash-postgres-${stamp}.dump`;
  const localPath = path.join(TEMP_DIR, backupFile);
  const dbUrl = process.env.DATABASE_URL;

  async function recordFailure(error: string) {
    logger.error('[GCS] 🚨 PostgreSQL backup FAILED — database has NO fresh GCS copy', { error });
    try {
      await db.collection('backup_logs').add({ type: 'postgres', status: 'failed', error, timestamp: new Date().toISOString() });
    } catch { /* best effort */ }
    try {
      const { sendSecurityAlert } = await import('./alerts');
      await sendSecurityAlert(
        'PostgreSQL nightly backup FAILED',
        `<p><strong>The nightly PostgreSQL backup did not produce a fresh GCS copy.</strong></p>` +
        `<p>Date: ${date}<br/>Error: ${error}</p>` +
        `<p>Impact: the source-of-truth database has no fresh independent backup for this run. ` +
        `Confirm Neon PITR is enabled, check DATABASE_URL, and ensure pg_dump is present in the runtime image.</p>`,
      );
    } catch { /* best effort */ }
    if (fs.existsSync(localPath)) { try { fs.unlinkSync(localPath); } catch { /* noop */ } }
  }

  try {
    if (!dbUrl) { await recordFailure('DATABASE_URL not set'); return { success: false, error: 'DATABASE_URL not set' }; }
    if (!isGcsConfigured()) { await recordFailure('GCS credentials not configured'); return { success: false, error: 'GCS not configured' }; }

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    logger.info('[GCS] Starting PostgreSQL backup (pg_dump custom format)...');
    // execFile (no shell) — the URL is passed as an argv element, not interpolated
    // into a shell string, so there is no injection surface. -Fc = compressed,
    // restorable custom format; --no-owner/--no-privileges for clean cross-env restore.
    const pgDumpBin = resolvePgDumpBinary();
    logger.info(`[GCS] Using pg_dump binary: ${pgDumpBin}`);
    try {
      await execFileAsync(pgDumpBin, ['-Fc', '--no-owner', '--no-privileges', '-f', localPath, dbUrl], {
        maxBuffer: 1024 * 1024 * 200,
        env: { ...process.env },
      });
    } catch (dumpErr: any) {
      const missing = dumpErr?.code === 'ENOENT';
      await recordFailure(missing ? `pg_dump binary not found (tried ${pgDumpBin})` : `pg_dump failed: ${dumpErr?.message}`);
      return { success: false, error: missing ? 'pg_dump not installed' : dumpErr?.message };
    }

    const stats = fs.statSync(localPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const fileHash = calculateFileHash(localPath);
    logger.info(`[GCS] pg_dump complete: ${sizeMB} MB, sha256 ${fileHash.slice(0, 12)}…`);

    const storageClient = getStorageClient();
    await ensurePostgresBucket(storageClient); // self-heal: create the bucket if it was never provisioned
    const destination = `daily/${date}/${backupFile}`;
    await storageClient.bucket(POSTGRES_BUCKET).upload(localPath, {
      destination,
      metadata: { metadata: { project: 'petwash', type: 'postgres-backup', date, sha256: fileHash } },
    });

    const gcsUrl = `gs://${POSTGRES_BUCKET}/${destination}`;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const timestamp = new Date().toISOString();
    logger.info(`[GCS] ✅ PostgreSQL backup complete in ${duration}s: ${gcsUrl}`);

    fs.unlinkSync(localPath);
    // Best-effort success log. The DUMP is the critical artifact and is already
    // safely in GCS by this point — do NOT let a Firestore permission/availability
    // blip on this secondary log write flip a GOOD backup to "FAILED" (which fired a
    // false security alert + a Cloud Scheduler retry storm that re-dumped repeatedly).
    try {
      await db.collection('backup_logs').add({
        type: 'postgres', status: 'success', backupFile, sizeMB: parseFloat(sizeMB), gcsUrl,
        sha256: fileHash, duration: parseFloat(duration), timestamp,
      });
    } catch (logErr: any) {
      logger.warn('[GCS] Postgres backup uploaded OK but backup_logs write failed (non-fatal)', { error: logErr?.message });
    }

    return { success: true, backupFile, size: `${sizeMB} MB`, gcsUrl };
  } catch (error: any) {
    await recordFailure(error?.message || 'Unknown error');
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Export Firestore collections to GCS
 */
export async function performFirestoreExport(): Promise<{
  success: boolean;
  collections?: number;
  totalDocs?: number;
  gcsPath?: string;
  error?: string;
}> {
  const startTime = Date.now();
  const date = new Date().toISOString().split('T')[0];
  const gcsPath = `daily/${date}`;
  // ROOT CAUSE FIX (2026-07-08): the backup service account has
  // roles/storage.objectCreator (create-only, no overwrite/delete — correct for
  // security). The old fixed name `${collection}_${date}.json` meant any SECOND
  // run that day tried to OVERWRITE the existing object, which needs
  // storage.objects.delete → 403 on every collection → all FAILED, 0 docs. A
  // per-run stamp makes every write a fresh CREATE (exactly how the working
  // Postgres backup avoids this), and keeps each run's files as immutable
  // history instead of clobbering the prior copy.
  const runStamp = Date.now();

  const COLLECTIONS = [
    'users',
    'kyc',
    'birthday_vouchers',
    'crm_email_templates',
    'nayax_transactions',
    'nayax_vouchers',
    'nayax_webhook_events',
    'nayax_terminals',
    'station_events',
    'inbox',
    'loyalty'
  ];
  
  try {
    logger.info('[GCS] Starting Firestore export...');
    
    const storageClient = getStorageClient();
    let totalDocs = 0;
    const results: any[] = [];
    
    for (const collectionName of COLLECTIONS) {
      try {
        logger.info(`[GCS] Exporting ${collectionName}...`);
        
        const snapshot = await db.collection(collectionName).get();
        const documents: any[] = [];
        
        for (const doc of snapshot.docs) {
          const data = doc.data();
          
          // Handle subcollections for users
          if (collectionName === 'users') {
            const profileDoc = await db
              .collection('users')
              .doc(doc.id)
              .collection('profile')
              .doc('data')
              .get();
            
            documents.push({
              id: doc.id,
              ...data,
              profile: profileDoc.exists ? profileDoc.data() : null
            });
          } else {
            documents.push({
              id: doc.id,
              ...data
            });
          }
        }
        
        const exportData = {
          collection: collectionName,
          exportDate: new Date().toISOString(),
          documentCount: documents.length,
          documents
        };
        
        // Upload JSON to GCS — per-run stamp so every write is a fresh CREATE
        // (the create-only backup SA cannot overwrite; see runStamp note above).
        const fileName = `${collectionName}_${date}_${runStamp}.json`;
        const fileContent = JSON.stringify(exportData, null, 2);
        const fileSizeBytes = Buffer.byteLength(fileContent, 'utf8');
        const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
        
        const file = storageClient.bucket(FIRESTORE_BUCKET).file(`${gcsPath}/${fileName}`);
        
        await file.save(fileContent, {
          contentType: 'application/json',
          metadata: {
            metadata: {
              collection: collectionName,
              documentCount: documents.length.toString(),
              exportDate: new Date().toISOString(),
              fileSizeMB
            }
          }
        });

        // ── READ-BACK VERIFICATION (spec §9: a backup you cannot read back is
        // not a backup) ──────────────────────────────────────────────────────
        // Re-download the object we just wrote and confirm it is retrievable,
        // parses, and reports the SAME document count. A genuine COUNT MISMATCH
        // is fatal (corrupt/truncated → the collection is demoted to FAILED).
        // BUT the create-only backup SA (objectCreator) has no read permission,
        // so the download itself may 403 — that is NOT a backup failure (the
        // upload, i.e. the backup, already succeeded). So: mismatch = fatal;
        // "can't read it back" (permission/network) = verified:false, non-fatal.
        let verified = false;
        try {
          const [readBack] = await file.download();
          const parsed = JSON.parse(readBack.toString('utf8'));
          const verifiedCount = Array.isArray(parsed?.documents) ? parsed.documents.length : -1;
          if (verifiedCount !== documents.length) {
            throw new Error(`READBACK_MISMATCH: wrote ${documents.length} docs but read back ${verifiedCount}`);
          }
          verified = true;
        } catch (verifyErr: any) {
          if (/READBACK_MISMATCH/.test(verifyErr?.message || '')) throw verifyErr; // corruption → fatal
          logger.warn(`[GCS] read-back verify skipped for ${collectionName} (upload OK, cannot re-read): ${verifyErr?.message}`);
        }

        totalDocs += documents.length;
        results.push({
          collection: collectionName,
          docs: documents.length,
          sizeMB: parseFloat(fileSizeMB),
          verified,
        });

        logger.info(`[GCS] ✅ Exported ${documents.length} docs from ${collectionName} (${fileSizeMB} MB)${verified ? ' + read-back verified' : ''}`);
      } catch (error: any) {
        // Capture the REAL error (PERMISSION_DENIED / NOT_FOUND / project-not-found)
        // instead of a bare error:true — the old report hid the root cause.
        const errorMessage = error?.message || String(error);
        logger.error(`[GCS] Failed to export ${collectionName}: ${errorMessage}`);
        results.push({ collection: collectionName, error: true, errorMessage });
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const fullGcsPath = `gs://${FIRESTORE_BUCKET}/${gcsPath}`;
    const timestamp = new Date().toISOString();

    // ── HONEST STATUS ────────────────────────────────────────────────────────
    // The old code ALWAYS returned success:true and logged status:'success',
    // even when every collection threw and totalDocs was 0 — the "green
    // checkmark on a dead backup" that hid a total backup failure. Overall
    // success now requires BOTH: zero failed collections AND at least one
    // document actually exported.
    const failed = results.filter(r => r.error);
    const zeroDocs = totalDocs === 0;
    const ok = failed.length === 0 && !zeroDocs;
    const overallStatus: 'success' | 'failed' = ok ? 'success' : 'failed';

    if (ok) {
      logger.info(`[GCS] ✅ Firestore export complete in ${duration}s: ${fullGcsPath} (${totalDocs} docs)`);
    } else {
      logger.error(
        `[GCS] 🚨 Firestore export FAILED in ${duration}s — ${failed.length}/${results.length} collections failed, ${totalDocs} docs exported`,
        { failedCollections: failed.map(f => f.collection), firstError: failed[0]?.errorMessage },
      );
    }

    // Log to backup_logs — BEST EFFORT, but with the REAL status (never a false
    // 'success'). A completed run must not be turned into a 500 by a log write
    // the runtime SA may lack permission for.
    try {
      await db.collection('backup_logs').add({
        type: 'firestore',
        status: overallStatus,
        collections: results.length,
        failedCollections: failed.map(f => f.collection),
        totalDocs,
        gcsPath: fullGcsPath,
        details: results,
        duration: parseFloat(duration),
        timestamp
      });
    } catch (logErr: any) {
      logger.warn('[GCS] Firestore export backup_logs write failed (non-fatal)', { error: logErr?.message });
    }

    // Fire a LOUD alert on ANY failure — mirrors the postgres path. A backup
    // that exported nothing must never pass silently as it did before.
    if (!ok) {
      try {
        const { sendSecurityAlert } = await import('./alerts');
        await sendSecurityAlert(
          zeroDocs ? '🚨 Firestore backup FAILED — 0 DOCUMENTS' : '🚨 Firestore backup FAILED — collections did not export',
          `<p><strong>The daily Firestore export did not produce a usable backup.</strong></p>` +
          `<p>Path: ${fullGcsPath}<br/>Documents exported: <strong>${totalDocs}</strong><br/>` +
          `Failed collections (${failed.length}/${results.length}): ${failed.map(f => f.collection).join(', ') || 'none'}</p>` +
          `<p>First captured error: <code>${failed[0]?.errorMessage || '(none)'}</code></p>` +
          `<p>Likely: the runtime service account lacks Firestore read (datastore.viewer) or the target project/database is wrong. ` +
          `The Postgres nightly dump is the source-of-truth backup — verify it succeeded independently.</p>`,
        );
      } catch { /* best effort */ }
    }

    // Send backup summary email — subject + body now reflect the REAL status.
    try {
      await sendBackupSummaryEmail({
        type: 'firestore',
        timestamp,
        status: overallStatus,
        firestoreBackup: {
          path: fullGcsPath,
          collections: results.length,
          totalDocs,
          files: results.map(r => ({
            collection: r.collection,
            docs: r.docs || 0,
            sizeMB: r.sizeMB,
            error: r.error,
            errorMessage: r.errorMessage,
            verified: r.verified,
          }))
        },
        includeCSV: true
      });
    } catch (emailErr: any) {
      logger.warn('[GCS] Firestore backup summary email failed (non-fatal)', { error: emailErr?.message });
    }

    return {
      success: ok,
      collections: results.length,
      totalDocs,
      gcsPath: fullGcsPath,
      ...(ok ? {} : { error: zeroDocs ? '0 documents exported — backup is NOT usable' : `${failed.length} collection(s) failed to export` }),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[GCS] Firestore export failed:', error);
    
    // Log error to Firestore
    await db.collection('backup_logs').add({
      type: 'firestore',
      status: 'failed',
      error: errorMsg,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * Check if GCS backups are configured - PRODUCTION: Environment variables ONLY
 */
export function isGcsConfigured(): boolean {
  const credentialsJson = resolveGoogleServiceAccountJson();

  if (!credentialsJson) {
    return false;
  }
  
  try {
    JSON.parse(credentialsJson);
    return true;
  } catch {
    logger.error('[GCS] Google credentials env var is not valid JSON');
    return false;
  }
}

/**
 * Get backup status and recent logs
 */
/**
 * Backup a single message to GCS
 */
// ── Circuit-breaker for the per-message backup ───────────────────────────────
// backupMessage() runs once for EVERY message sent. A persistent failure (missing
// `petwash-secure-messages` bucket, denied service account, or no credentials)
// would otherwise log an error for every single message — the "million failed
// messages" flood. Once a failure is seen we pause attempts for a cooldown window
// and emit ONE warning, instead of an error per message. A sweep can re-backup the
// rows marked backupStatus!='completed' once the bucket/creds are fixed.
let msgBackupPausedUntil = 0;
let msgBackupLastNoticeAt = 0;
const MSG_BACKUP_COOLDOWN_MS = 30 * 60 * 1000; // 30 min

function pauseMessageBackup(reason: string): void {
  const now = Date.now();
  msgBackupPausedUntil = now + MSG_BACKUP_COOLDOWN_MS;
  if (now - msgBackupLastNoticeAt > MSG_BACKUP_COOLDOWN_MS) {
    msgBackupLastNoticeAt = now;
    logger.warn('[GCS] Message backup paused for 30 min after a failure — fix the bucket/credentials to re-enable (rows stay backupStatus!=completed for later sweep)', { reason });
  }
}

export async function backupMessage(messageData: {
  messageId: number;
  userId: string;
  subject: string;
  body: string;
  messageHash: string;
  auditHash: string;
  createdAt: Date;
}): Promise<{
  success: boolean;
  gcsPath?: string;
  error?: string;
}> {
  // Skip quietly while the breaker is open (no per-message logging during an outage).
  if (Date.now() < msgBackupPausedUntil) {
    return { success: false, error: 'backup_paused' };
  }
  // No credentials → don't even try; pause + single notice (not an error per message).
  if (!isGcsConfigured()) {
    pauseMessageBackup('GCS credentials not configured');
    return { success: false, error: 'gcs_not_configured' };
  }
  try {
    const storageClient = getStorageClient();
    const bucket = storageClient.bucket('petwash-secure-messages');
    
    const fileName = `messages/${messageData.userId}/${messageData.messageId}_${Date.now()}.json`;
    const file = bucket.file(fileName);
    
    const backupData = {
      messageId: messageData.messageId,
      userId: messageData.userId,
      subject: messageData.subject,
      body: messageData.body,
      messageHash: messageData.messageHash,
      auditHash: messageData.auditHash,
      createdAt: messageData.createdAt.toISOString(),
      backedUpAt: new Date().toISOString(),
    };
    
    await file.save(JSON.stringify(backupData, null, 2), {
      metadata: {
        contentType: 'application/json',
        metadata: {
          messageId: messageData.messageId.toString(),
          userId: messageData.userId,
          auditHash: messageData.auditHash,
        },
      },
    });
    
    logger.info('[GCS] Message backed up successfully', {
      messageId: messageData.messageId,
      gcsPath: fileName,
    });
    
    return {
      success: true,
      gcsPath: fileName,
    };
  } catch (error: any) {
    // Open the circuit-breaker + emit ONE throttled warning instead of an error
    // for every message. The row keeps backupStatus!='completed' for a later sweep.
    pauseMessageBackup(error?.message || 'unknown');
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function getBackupStatus() {
  try {
    const logs = await db.collection('backup_logs')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    return {
      configured: isGcsConfigured(),
      recentBackups: logs.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    };
  } catch (error) {
    logger.error('[GCS] Error getting backup status:', error);
    return {
      configured: isGcsConfigured(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Calculate SHA-256 hash of a file for integrity verification
 */
function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Generate CSV attachment with backup file details
 */
function generateBackupCSV(data: {
  type: 'code' | 'firestore';
  date: string;
  codeBackup?: { file: string; size: string; hash: string; gcsUrl: string };
  firestoreBackup?: { path: string; collections: number; totalDocs: number; files: Array<{ collection: string; docs: number; sizeMB?: number; error?: boolean }> };
}): string {
  const csvLines: string[] = [];
  
  if (data.type === 'code') {
    csvLines.push('Backup Type,File Name,Size,SHA-256 Hash,GCS URL,Timestamp');
    csvLines.push(`Code Backup,${data.codeBackup?.file},${data.codeBackup?.size},${data.codeBackup?.hash},${data.codeBackup?.gcsUrl},${data.date}`);
  } else {
    csvLines.push('Backup Type,Collection,Documents,Size (MB),GCS Path,Status,Timestamp');
    data.firestoreBackup?.files.forEach(file => {
      const status = file.error ? 'FAILED' : 'SUCCESS';
      const size = file.sizeMB ? file.sizeMB.toFixed(2) : 'N/A';
      csvLines.push(`Firestore Backup,${file.collection},${file.docs || 0},${size},${data.firestoreBackup?.path}/${file.collection}_${data.date}.json,${status},${data.date}`);
    });
    
    // Calculate totals for successful exports only
    const hasFailures = data.firestoreBackup?.files.some(f => f.error) || false;
    const successfulDocs = data.firestoreBackup?.files
      .filter(f => !f.error)
      .reduce((sum, f) => sum + (f.docs || 0), 0) || 0;
    const totalSize = data.firestoreBackup?.files
      .filter(f => !f.error && f.sizeMB)
      .reduce((sum, f) => sum + (f.sizeMB || 0), 0)
      .toFixed(2) || '0.00';
    
    const overallStatus = hasFailures ? 'PARTIAL SUCCESS' : 'SUCCESS';
    csvLines.push(`Total (Successful Only),,${successfulDocs},${totalSize},,${overallStatus},`);
  }
  
  return csvLines.join('\n');
}

/**
 * Send backup summary email
 */
async function sendBackupSummaryEmail(data: {
  type: 'code' | 'firestore';
  timestamp: string;
  status?: 'success' | 'failed';
  codeBackup?: { file: string; size: string; hash: string; gcsUrl: string };
  firestoreBackup?: { path: string; collections: number; totalDocs: number; files: Array<{ collection: string; docs: number; sizeMB?: number; error?: boolean; errorMessage?: string; verified?: boolean }> };
  includeCSV?: boolean;
}): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn('[GCS] SendGrid not configured, skipping backup summary email');
    return;
  }

  const date = new Date(data.timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem'
  });

  // SUBJECT MUST REFLECT REALITY — a green ✅ is only allowed when the backup
  // genuinely succeeded. The old hardcoded ✅ subject made a total failure (0
  // docs, all collections dead) look like a success in the inbox.
  const dateStr = new Date(data.timestamp).toLocaleDateString('en-US');
  let subject: string;
  if (data.type === 'firestore') {
    const files = data.firestoreBackup?.files || [];
    const anyFail = files.some(f => f.error);
    const total = data.firestoreBackup?.totalDocs ?? 0;
    if (total === 0) {
      subject = `🚨 ⁦Pet Wash™⁩ Backup FAILED — 0 DOCUMENTS — ${dateStr}`;
    } else if (anyFail) {
      subject = `❌ ⁦Pet Wash™⁩ Backup FAILED (some collections) — ${dateStr}`;
    } else {
      subject = `✅ ⁦Pet Wash™⁩ Backup SUCCESS — ${dateStr}`;
    }
  } else {
    // Code backup only reaches the email on a successful upload (failures throw earlier).
    subject = `✅ ⁦Pet Wash™⁩ Code Backup SUCCESS — ${dateStr}`;
  }

  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 24px; }
        .section { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px 20px; margin-bottom: 20px; border-radius: 5px; }
        .section h2 { margin-top: 0; color: #667eea; font-size: 18px; }
        .detail { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: 600; color: #555; }
        .value { color: #333; }
        .success { color: #10b981; font-weight: 600; }
        .hash { font-family: 'Courier New', monospace; font-size: 12px; color: #6b7280; word-break: break-all; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🐾 ⁦Pet Wash™⁩ Backup Summary</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Automated Backup Report</p>
      </div>
  `;

  if (data.type === 'code' && data.codeBackup) {
    htmlContent += `
      <div class="section">
        <h2>🗓 Backup Details</h2>
        <div class="detail">
          <span class="label">Date & Time:</span>
          <span class="value">${date} (Israel Time)</span>
        </div>
        <div class="detail">
          <span class="label">Backup Type:</span>
          <span class="value">Weekly Code Backup</span>
        </div>
      </div>

      <div class="section">
        <h2>💾 Code Backup</h2>
        <div class="detail">
          <span class="label">File:</span>
          <span class="value">${data.codeBackup.file}</span>
        </div>
        <div class="detail">
          <span class="label">Size:</span>
          <span class="value">${data.codeBackup.size}</span>
        </div>
        <div class="detail">
          <span class="label">GCS Path:</span>
          <span class="value">${data.codeBackup.gcsUrl}</span>
        </div>
      </div>

      <div class="section">
        <h2>🔐 Backup Integrity</h2>
        <div class="detail">
          <span class="label">SHA-256 Hash:</span>
        </div>
        <div class="hash" style="margin-top: 10px;">${data.codeBackup.hash}</div>
        <div style="margin-top: 15px;">
          <span class="success">✅ Verified - Integrity Check Passed</span>
        </div>
      </div>
    `;
  } else if (data.type === 'firestore' && data.firestoreBackup) {
    htmlContent += `
      <div class="section">
        <h2>🗓 Backup Details</h2>
        <div class="detail">
          <span class="label">Date & Time:</span>
          <span class="value">${date} (Israel Time)</span>
        </div>
        <div class="detail">
          <span class="label">Backup Type:</span>
          <span class="value">Daily Firestore Export</span>
        </div>
      </div>

      <div class="section">
        <h2>🗄 Firestore Backup</h2>
        <div class="detail">
          <span class="label">GCS Path:</span>
          <span class="value">${data.firestoreBackup.path}</span>
        </div>
        <div class="detail">
          <span class="label">Collections Exported:</span>
          <span class="value">${data.firestoreBackup.collections}</span>
        </div>
        <div class="detail">
          <span class="label">Total Documents:</span>
          <span class="value">${data.firestoreBackup.totalDocs}</span>
        </div>
        <div class="detail">
          <span class="label">Read-back Verified:</span>
          <span class="value">${data.firestoreBackup.files.filter(f => f.verified).length} / ${data.firestoreBackup.files.length} collections (re-downloaded &amp; doc-count matched)</span>
        </div>
      </div>

      <div class="section">
        <h2>📊 Collection Details</h2>
        ${data.firestoreBackup.files.map(file => {
          if (file.error) {
            return `
              <div class="detail">
                <span class="label">${file.collection}:</span>
                <span class="value" style="color: #ef4444;">❌ FAILED — ${(file.errorMessage || 'no error captured').replace(/</g, '&lt;')}</span>
              </div>
            `;
          }
          return `
            <div class="detail">
              <span class="label">${file.collection}:</span>
              <span class="value">${file.docs} documents (${file.sizeMB?.toFixed(2) || 'N/A'} MB)</span>
            </div>
          `;
        }).join('')}
        <div style="margin-top: 15px;">
          ${(() => {
            const anyFail = data.firestoreBackup!.files.some(f => f.error);
            const total = data.firestoreBackup!.totalDocs ?? 0;
            if (total === 0) return '<span style="color: #ef4444; font-weight: 700;">🚨 BACKUP FAILED — 0 documents exported. This backup is NOT usable.</span>';
            if (anyFail) return '<span style="color: #ef4444; font-weight: 600;">❌ FAILED — one or more collections did not export. Backup is incomplete.</span>';
            return '<span class="success">✅ Verified - All Collections Exported Successfully</span>';
          })()}
        </div>
      </div>
    `;
  }

  htmlContent += `
      <div class="section">
        <h2>⚙️ Next Scheduled Backups</h2>
        <div class="detail">
          <span class="label">Code Backup:</span>
          <span class="value">Sunday 2:00 AM Israel Time</span>
        </div>
        <div class="detail">
          <span class="label">Firestore Export:</span>
          <span class="value">Daily 1:00 AM Israel Time</span>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="https://petwash.co.il/admin/backups/status" class="button">🔍 View Backup Dashboard</a>
      </div>

      <div class="footer">
        <p>⁦Pet Wash™⁩ Automated Backup System</p>
        <p>This is an automated report. For support, contact <a href="mailto:Support@PetWash.co.il">Support@PetWash.co.il</a></p>
      </div>
    </body>
    </html>
  `;

  const emailData: any = {
    to: 'nir.h@petwash.co.il',  // Updated for deployment report
    cc: 'Support@PetWash.co.il',
    from: {
      email: 'noreply@petwash.co.il',
      name: '⁦Pet Wash™⁩ Backup System'
    },
    subject,
    html: htmlContent
  };

  // Add CSV attachment if requested
  if (data.includeCSV) {
    const csvContent = generateBackupCSV({
      type: data.type,
      date: new Date(data.timestamp).toISOString().split('T')[0],
      codeBackup: data.codeBackup,
      firestoreBackup: data.firestoreBackup
    });

    emailData.attachments = [{
      content: Buffer.from(csvContent).toString('base64'),
      filename: `petwash-backup-${data.type}-${new Date(data.timestamp).toISOString().split('T')[0]}.csv`,
      type: 'text/csv',
      disposition: 'attachment'
    }];
  }

  try {
    await sgMail.send(emailData);
    logger.info(`[GCS] ✅ Backup summary email sent for ${data.type} backup`);
  } catch (error) {
    logger.error('[GCS] Failed to send backup summary email:', error);
  }
}

const FINANCIAL_BUCKET = process.env.GCS_FINANCIAL_BUCKET || 'petwash-secure-documents';

export async function backupFinancialDocument(params: {
  documentType: 'invoice' | 'receipt' | 'ledger_export' | 'tax_report' | 'escrow_record';
  bookingId: string;
  platform: string;
  content: Buffer | string;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<{ success: boolean; gcsUrl?: string; sha256?: string; error?: string }> {
  try {
    if (!isGcsConfigured()) {
      logger.warn('[GCS Financial] GCS not configured - skipping financial document backup');
      return { success: false, error: 'GCS not configured' };
    }

    const storageClient = getStorageClient();
    const date = new Date().toISOString().split('T')[0];
    const yearMonth = date.substring(0, 7);
    const fileName = `financial/${params.platform}/${yearMonth}/${params.documentType}_${params.bookingId}_${Date.now()}.${params.contentType === 'application/pdf' ? 'pdf' : 'json'}`;

    const contentBuffer = typeof params.content === 'string' ? Buffer.from(params.content) : params.content;
    const sha256 = crypto.createHash('sha256').update(contentBuffer).digest('hex');

    const bucket = storageClient.bucket(FINANCIAL_BUCKET);
    const file = bucket.file(fileName);

    await file.save(contentBuffer, {
      metadata: {
        contentType: params.contentType || 'application/json',
        metadata: {
          documentType: params.documentType,
          bookingId: params.bookingId,
          platform: params.platform,
          sha256,
          uploadedAt: new Date().toISOString(),
          retentionYears: '7',
          ...params.metadata,
        },
      },
    });

    const gcsUrl = `gs://${FINANCIAL_BUCKET}/${fileName}`;
    logger.info(`[GCS Financial] ✅ ${params.documentType} backed up: ${gcsUrl}`, {
      bookingId: params.bookingId,
      platform: params.platform,
      sha256,
    });

    return { success: true, gcsUrl, sha256 };
  } catch (error: any) {
    logger.error('[GCS Financial] Document backup failed', {
      documentType: params.documentType,
      bookingId: params.bookingId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}
