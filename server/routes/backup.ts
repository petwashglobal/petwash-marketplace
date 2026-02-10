/**
 * Pet Wash™ Google Backup API Routes
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
