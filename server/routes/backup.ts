/**
 * ⁦Pet Wash™⁩ Google Backup API Routes
 * 
 * Endpoints for managing Google Drive backups
 * Supports JSON, Sheets, Docs, and full database backups
 * SECURED: All routes require Firebase auth + admin role
 */

import { Router, Request, Response } from 'express';
import { googleDriveBackupService } from '../services/googleDriveBackupService';
import { storage } from '../storage';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { logger } from '../lib/logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { 
  electronicInvoices, digitalSignatures, signedDocuments, 
  smartWashReceipts, nayaxTransactions, transactionRecords,
  biometricCertificateVerifications, providerApplications,
  sitterProfiles, walkerProfiles, walkBookings, sitterBookings,
  securityEvents,
} from '@shared/schema';
import { desc } from 'drizzle-orm';
import { SystemEventService } from '../services/SystemEventService';

const router = Router();

const getSuperAdminEmails = (): string[] => {
  const envEmails = process.env.SUPER_ADMIN_EMAILS;
  if (envEmails) {
    return envEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  }
  return [];
};

const requireBackupAdmin = (req: any, res: any, next: any) => {
  const userEmail = (req.firebaseUser?.email || '').toLowerCase();
  const admins = getSuperAdminEmails();
  if (!admins.includes(userEmail)) {
    return res.status(403).json({ error: 'Admin access required for backup operations' });
  }
  next();
};

/**
 * GET /api/backup/status
 * Get backup system status and folder info
 */
router.get('/status', validateFirebaseToken, requireBackupAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await googleDriveBackupService.getBackupStats();
    res.json({
      success: true,
      data: {
        connected: true,
        ...stats
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      connected: false
    });
  }
});

/**
 * GET /api/backup/list
 * List all backup files
 */
router.get('/list', validateFirebaseToken, requireBackupAdmin, async (req: Request, res: Response) => {
  try {
    const result = await googleDriveBackupService.listBackups();
    res.json({
      success: true,
      files: result.files,
      count: result.files.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/json
 * Backup JSON data to Google Drive
 */
router.post('/json', validateFirebaseToken, requireBackupAdmin, async (req: Request, res: Response) => {
  try {
    const { data, fileName, includeTimestamp = true } = req.body;

    if (!data || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: data, fileName'
      });
    }

    const result = await googleDriveBackupService.backupJSON(
      data,
      fileName,
      { includeTimestamp }
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/spreadsheet
 * Create a Google Sheet backup
 */
router.post('/spreadsheet', validateFirebaseToken, requireBackupAdmin, async (req: Request, res: Response) => {
  try {
    const { title, data, includeTimestamp = true } = req.body;

    if (!data || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, data (2D array)'
      });
    }

    const result = await googleDriveBackupService.createSpreadsheet(
      title,
      data,
      { includeTimestamp }
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/document
 * Create a Google Doc backup
 */
router.post('/document', validateFirebaseToken, requireBackupAdmin, async (req: Request, res: Response) => {
  try {
    const { title, content, includeTimestamp = true } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: title'
      });
    }

    const result = await googleDriveBackupService.createDocument(
      title,
      content || '',
      { includeTimestamp }
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/report
 * Create a system report backup
 */
router.post('/report', validateFirebaseToken, requireBackupAdmin, async (req: Request, res: Response) => {
  try {
    const { reportName, content } = req.body;

    if (!reportName || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: reportName, content'
      });
    }

    const result = await googleDriveBackupService.backupReport(reportName, content);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/backup/full
 * Full system backup - users, bookings, pets, etc.
 */
router.post('/full', validateFirebaseToken, requireBackupAdmin, async (req: Request, res: Response) => {
  try {
    logger.info('[Backup] Full system backup initiated by admin');
    const tables: { name: string; data: any[] }[] = [];

    try {
      const users = await storage.getAllUsers?.() || [];
      if (users.length > 0) {
        tables.push({ name: 'users', data: users.map(u => ({ ...u, password: '[REDACTED]' })) });
      }
    } catch (e) {
      logger.warn('[Backup] Users backup skipped');
    }

    try {
      const pets = await storage.getAllPets?.() || [];
      if (pets.length > 0) {
        tables.push({ name: 'pets', data: pets });
      }
    } catch (e) {
      logger.warn('[Backup] Pets backup skipped');
    }

    try {
      const bookings = await storage.getAllBookings?.() || [];
      if (bookings.length > 0) {
        tables.push({ name: 'bookings', data: bookings });
      }
    } catch (e) {
      logger.warn('[Backup] Bookings backup skipped');
    }

    try {
      const stations = await storage.getAllStations?.() || [];
      if (stations.length > 0) {
        tables.push({ name: 'stations', data: stations });
      }
    } catch (e) {
      logger.warn('[Backup] Stations backup skipped');
    }

    try {
      const invoices = await db.select().from(electronicInvoices).orderBy(desc(electronicInvoices.createdAt)).limit(1000);
      if (invoices.length > 0) {
        tables.push({ name: 'electronic_invoices', data: invoices });
      }
    } catch (e) {
      logger.warn('[Backup] Invoices backup skipped');
    }

    try {
      const signatures = await db.select().from(digitalSignatures).orderBy(desc(digitalSignatures.createdAt)).limit(1000);
      if (signatures.length > 0) {
        tables.push({ name: 'digital_signatures', data: signatures });
      }
    } catch (e) {
      logger.warn('[Backup] Signatures backup skipped');
    }

    try {
      const signedDocs = await db.select().from(signedDocuments).orderBy(desc(signedDocuments.createdAt)).limit(1000);
      if (signedDocs.length > 0) {
        tables.push({ name: 'signed_documents', data: signedDocs });
      }
    } catch (e) {
      logger.warn('[Backup] Signed documents backup skipped');
    }

    try {
      const receipts = await db.select().from(smartWashReceipts).orderBy(desc(smartWashReceipts.createdAt)).limit(1000);
      if (receipts.length > 0) {
        tables.push({ name: 'receipts', data: receipts });
      }
    } catch (e) {
      logger.warn('[Backup] Receipts backup skipped');
    }

    try {
      const transactions = await db.select().from(transactionRecords).orderBy(desc(transactionRecords.createdAt)).limit(1000);
      if (transactions.length > 0) {
        tables.push({ name: 'transaction_records', data: transactions });
      }
    } catch (e) {
      logger.warn('[Backup] Transaction records backup skipped');
    }

    try {
      const nayaxTxns = await db.select().from(nayaxTransactions).orderBy(desc(nayaxTransactions.createdAt)).limit(1000);
      if (nayaxTxns.length > 0) {
        tables.push({ name: 'nayax_transactions', data: nayaxTxns });
      }
    } catch (e) {
      logger.warn('[Backup] Nayax transactions backup skipped');
    }

    try {
      const verifications = await db.select().from(biometricCertificateVerifications).orderBy(desc(biometricCertificateVerifications.createdAt)).limit(1000);
      if (verifications.length > 0) {
        tables.push({ name: 'identity_verifications', data: verifications });
      }
    } catch (e) {
      logger.warn('[Backup] Identity verifications backup skipped');
    }

    try {
      const provApps = await db.select().from(providerApplications).orderBy(desc(providerApplications.createdAt)).limit(1000);
      if (provApps.length > 0) {
        tables.push({ name: 'provider_applications', data: provApps });
      }
    } catch (e) {
      logger.warn('[Backup] Provider applications backup skipped');
    }

    try {
      const sitters = await db.select().from(sitterProfiles).orderBy(desc(sitterProfiles.createdAt)).limit(1000);
      if (sitters.length > 0) {
        tables.push({ name: 'sitter_profiles', data: sitters });
      }
    } catch (e) {
      logger.warn('[Backup] Sitter profiles backup skipped');
    }

    try {
      const walkers = await db.select().from(walkerProfiles).orderBy(desc(walkerProfiles.createdAt)).limit(1000);
      if (walkers.length > 0) {
        tables.push({ name: 'walker_profiles', data: walkers });
      }
    } catch (e) {
      logger.warn('[Backup] Walker profiles backup skipped');
    }

    /* ── New tables ─────────────────────────────────────────────────────── */
    try {
      const walks = await db.select().from(walkBookings).orderBy(desc(walkBookings.createdAt)).limit(2000);
      if (walks.length > 0) tables.push({ name: 'walk_bookings', data: walks });
    } catch (e) { logger.warn('[Backup] Walk bookings backup skipped'); }

    try {
      const sitters = await db.select().from(sitterBookings).orderBy(desc(sitterBookings.createdAt)).limit(2000);
      if (sitters.length > 0) tables.push({ name: 'sitter_bookings', data: sitters });
    } catch (e) { logger.warn('[Backup] Sitter bookings backup skipped'); }

    try {
      const secEvts = await db.select().from(securityEvents).orderBy(desc(securityEvents.createdAt)).limit(2000);
      if (secEvts.length > 0) tables.push({ name: 'security_events', data: secEvts });
    } catch (e) { logger.warn('[Backup] Security events backup skipped'); }

    try {
      const sysEvts = await db.execute(sql`
        SELECT * FROM system_events ORDER BY created_at DESC LIMIT 2000
      `);
      if (sysEvts.rows.length > 0) tables.push({ name: 'system_events', data: sysEvts.rows as any[] });
    } catch (e) { logger.warn('[Backup] System events backup skipped'); }

    try {
      const walletRows = await db.execute(sql`
        SELECT id, user_uid, entry_type, amount_cents, balance_cents_after,
               reference_id, description, created_at
        FROM wallet_ledger ORDER BY created_at DESC LIMIT 5000
      `);
      if (walletRows.rows.length > 0) tables.push({ name: 'wallet_ledger', data: walletRows.rows as any[] });
    } catch (e) { logger.warn('[Backup] Wallet ledger backup skipped'); }

    if (tables.length === 0) {
      return res.json({
        success: true,
        message: 'No data to backup',
        results: []
      });
    }

    const results = await googleDriveBackupService.backupDatabase(tables);

    const successCount = results.filter(r => r.success).length;
    const stats = await googleDriveBackupService.getBackupStats();

    // Stamp the backup run to system_events
    SystemEventService.stamp({
      eventType: 'full_backup_completed',
      severity: 'info',
      source: 'backup_service',
      message: `Full backup completed: ${successCount}/${tables.length} tables backed up to Google Drive`,
      detail: { successCount, totalTables: tables.length, driveLink: stats.folderLink },
    });

    logger.info(`[Backup] Full backup complete: ${successCount}/${tables.length} tables backed up`);

    res.json({
      success: true,
      message: `Backed up ${successCount}/${tables.length} tables`,
      results,
      folderLink: stats.folderLink
    });
  } catch (error: any) {
    SystemEventService.stamp({
      eventType: 'full_backup_failed',
      severity: 'error',
      source: 'backup_service',
      message: `Full backup FAILED: ${error.message?.slice(0, 200)}`,
      detail: { error: error.message },
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ── GET /api/backup/auto-status ─────────────────────────────────────────── */
router.get('/auto-status', validateFirebaseToken, requireBackupAdmin, (_req, res) => {
  res.json({
    schedule: 'Daily at 01:00 Asia/Jerusalem (Israel Time)',
    nextRun:  getNextBackupRun(),
    status:   'active',
  });
});

/* ── Automatic daily backup scheduler ──────────────────────────────────────
 * Runs every day at 01:00 Jerusalem time.
 * Performs a full system backup to Google Drive automatically.
 */
function getNextBackupRun(): string {
  const now = new Date();
  const next = new Date();
  next.setHours(1, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

function msUntilNextBackup(): number {
  return new Date(getNextBackupRun()).getTime() - Date.now();
}

async function runDailyBackup(): Promise<void> {
  logger.info('[AutoBackup] 🔄 Daily backup starting...');
  try {
    const tables: { name: string; data: any[] }[] = [];

    const addTable = async (name: string, fn: () => Promise<any[]>) => {
      try { const d = await fn(); if (d.length) tables.push({ name, data: d }); }
      catch (e: any) { logger.warn(`[AutoBackup] ${name} skipped: ${e?.message}`); }
    };

    await addTable('walk_bookings',    () => db.select().from(walkBookings).orderBy(desc(walkBookings.createdAt)).limit(5000));
    await addTable('sitter_bookings',  () => db.select().from(sitterBookings).orderBy(desc(sitterBookings.createdAt)).limit(5000));
    await addTable('electronic_invoices', () => db.select().from(electronicInvoices).orderBy(desc(electronicInvoices.createdAt)).limit(2000));
    await addTable('nayax_transactions',  () => db.select().from(nayaxTransactions).orderBy(desc(nayaxTransactions.createdAt)).limit(2000));
    await addTable('transaction_records', () => db.select().from(transactionRecords).orderBy(desc(transactionRecords.createdAt)).limit(2000));
    await addTable('security_events',     () => db.select().from(securityEvents).orderBy(desc(securityEvents.createdAt)).limit(2000));
    await addTable('sitter_profiles',     () => db.select().from(sitterProfiles).orderBy(desc(sitterProfiles.createdAt)).limit(500));
    await addTable('walker_profiles',     () => db.select().from(walkerProfiles).orderBy(desc(walkerProfiles.createdAt)).limit(500));
    await addTable('provider_applications', () => db.select().from(providerApplications).orderBy(desc(providerApplications.createdAt)).limit(500));

    // Raw-SQL tables (not in drizzle schema)
    try {
      const sysEvts = await db.execute(sql`SELECT * FROM system_events ORDER BY created_at DESC LIMIT 3000`);
      if (sysEvts.rows.length) tables.push({ name: 'system_events', data: sysEvts.rows as any[] });
    } catch (_) {}
    try {
      const ledger = await db.execute(sql`SELECT id, user_uid, entry_type, amount_cents, balance_cents_after, reference_id, description, created_at FROM wallet_ledger ORDER BY created_at DESC LIMIT 10000`);
      if (ledger.rows.length) tables.push({ name: 'wallet_ledger', data: ledger.rows as any[] });
    } catch (_) {}

    if (tables.length === 0) {
      logger.warn('[AutoBackup] No data found — backup skipped');
      return;
    }

    const results = await googleDriveBackupService.backupDatabase(tables);
    const ok = results.filter(r => r.success).length;
    const stats = await googleDriveBackupService.getBackupStats();

    SystemEventService.stamp({
      eventType: 'auto_backup_completed',
      severity: 'info',
      source: 'auto_backup_scheduler',
      message: `Daily auto-backup: ${ok}/${tables.length} tables → Google Drive`,
      detail: { ok, total: tables.length, driveLink: stats.folderLink },
    });
    logger.info(`[AutoBackup] ✅ Complete: ${ok}/${tables.length} tables → Drive`);
  } catch (err: any) {
    SystemEventService.stamp({
      eventType: 'auto_backup_failed',
      severity: 'error',
      source: 'auto_backup_scheduler',
      message: `Daily auto-backup FAILED: ${err?.message?.slice(0, 200)}`,
      detail: { error: err?.message },
    });
    logger.error('[AutoBackup] ❌ Failed', { error: err?.message });
  }

  // Schedule next run
  setTimeout(runDailyBackup, msUntilNextBackup());
}

/* Kick off the daily backup scheduler on module load */
setTimeout(runDailyBackup, msUntilNextBackup());
logger.info(`[AutoBackup] 📅 Daily Google Drive backup scheduled — next run: ${getNextBackupRun()}`);

export default router;
