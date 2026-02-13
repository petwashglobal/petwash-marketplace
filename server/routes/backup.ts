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
import { 
  electronicInvoices, digitalSignatures, signedDocuments, 
  smartWashReceipts, nayaxTransactions, transactionRecords,
  biometricCertificateVerifications, providerApplications,
  sitterProfiles, walkerProfiles
} from '@shared/schema';
import { desc } from 'drizzle-orm';

const router = Router();

const ADMIN_EMAILS = [
  'nirhadad1@gmail.com',
  'nir.h@petwash.co.il',
  'admin@petwash.co.il',
  'Support@PetWash.co.il'
];

const requireBackupAdmin = (req: any, res: any, next: any) => {
  const userEmail = req.firebaseUser?.email;
  if (!ADMIN_EMAILS.includes(userEmail || '')) {
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

    logger.info(`[Backup] Full backup complete: ${successCount}/${tables.length} tables backed up`);

    res.json({
      success: true,
      message: `Backed up ${successCount}/${tables.length} tables`,
      results,
      folderLink: stats.folderLink
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
