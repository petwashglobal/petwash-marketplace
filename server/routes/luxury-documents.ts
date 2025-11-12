/**
 * Luxury Documents API
 * Send sample invoices, receipts, and statements to CEO
 */

import { Router } from 'express';
import { logger } from '../lib/logger';
import LuxuryDocumentEmailService from '../services/LuxuryDocumentEmailService';
import SystemStatusReportService from '../services/SystemStatusReportService';
import { Storage } from '@google-cloud/storage';
import { db as firestoreDb } from '../lib/firebase-admin';

const router = Router();

/**
 * Send luxury document samples to CEO email
 */
router.post('/send-samples', async (req, res) => {
  try {
    const { email } = req.body;
    const recipientEmail = email || 'Nir.h@petwash.co.il';

    logger.info('[Luxury Documents API] Sending sample documents to CEO', { email: recipientEmail });

    const result = await LuxuryDocumentEmailService.sendSampleDocumentsToCEO(recipientEmail);

    if (result.success) {
      res.json({
        success: true,
        message: `נשלחו ${result.sentDocuments?.length || 0} מסמכים לדוגמה ל-${recipientEmail}`,
        sentDocuments: result.sentDocuments
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    logger.error('[Luxury Documents API] Failed to send samples', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Send comprehensive system status report to CEO
 */
router.post('/send-status-report', async (req, res) => {
  try {
    const { email } = req.body;
    const recipientEmail = email || 'Nir.h@petwash.co.il';

    logger.info('[System Status Report API] Sending comprehensive report to CEO', { email: recipientEmail });

    const result = await SystemStatusReportService.sendStatusReportToCEO(recipientEmail);

    if (result.success) {
      res.json({
        success: true,
        message: `דוח מצב מערכת נשלח בהצלחה ל-${recipientEmail}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    logger.error('[System Status Report API] Failed to send report', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get Google Cloud Storage backup statistics
 */
router.get('/backup-report', async (req, res) => {
  try {
    logger.info('[Backup Report] Generating comprehensive backup statistics...');

    // Initialize GCS client
    let storage: Storage;
    try {
      const credentialsSource = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (credentialsSource) {
        const credentials = JSON.parse(credentialsSource);
        storage = new Storage({ credentials });
      } else {
        storage = new Storage();
      }
    } catch (error) {
      logger.warn('[Backup Report] GCS credentials not configured, using mock data');
      
      res.json({
        success: true,
        message: 'GCS לא מוגדר - נתונים לדוגמה',
        mockData: true,
        report: {
          codeBackups: {
            bucket: 'petwash-code-backups',
            totalFiles: 52,
            totalSizeGB: 2.8,
            oldestBackup: '2024-01-15',
            newestBackup: new Date().toISOString().split('T')[0]
          },
          firestoreBackups: {
            bucket: 'petwash-firestore-backups',
            totalFiles: 365,
            totalSizeGB: 12.4,
            oldestBackup: '2024-01-01',
            newestBackup: new Date().toISOString().split('T')[0]
          },
          totalStorage: {
            totalFiles: 417,
            totalSizeGB: 15.2,
            monthlyCost: '$0.39 USD'
          }
        }
      });
      return;
    }

    // Get actual bucket statistics
    const CODE_BUCKET = process.env.GCS_CODE_BUCKET || 'petwash-code-backups';
    const FIRESTORE_BUCKET = process.env.GCS_FIRESTORE_BUCKET || 'petwash-firestore-backups';

    const codeStats = await getBucketStats(storage, CODE_BUCKET);
    const firestoreStats = await getBucketStats(storage, FIRESTORE_BUCKET);

    const totalFiles = codeStats.fileCount + firestoreStats.fileCount;
    const totalSizeGB = codeStats.totalSizeGB + firestoreStats.totalSizeGB;
    const monthlyCost = (totalSizeGB * 0.026).toFixed(2); // GCS Standard Storage pricing

    // Get backup logs from Firestore
    const backupLogsSnapshot = await firestoreDb
      .collection('backup_logs')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const recentBackups = backupLogsSnapshot.docs.map(doc => doc.data());

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      report: {
        codeBackups: {
          bucket: CODE_BUCKET,
          totalFiles: codeStats.fileCount,
          totalSizeGB: codeStats.totalSizeGB,
          oldestBackup: codeStats.oldestFile,
          newestBackup: codeStats.newestFile
        },
        firestoreBackups: {
          bucket: FIRESTORE_BUCKET,
          totalFiles: firestoreStats.fileCount,
          totalSizeGB: firestoreStats.totalSizeGB,
          oldestBackup: firestoreStats.oldestFile,
          newestBackup: firestoreStats.newestFile
        },
        totalStorage: {
          totalFiles,
          totalSizeGB: Number(totalSizeGB.toFixed(2)),
          monthlyCost: `$${monthlyCost} USD`,
          currency: 'USD'
        },
        recentBackups: recentBackups.slice(0, 5)
      }
    });

  } catch (error: any) {
    logger.error('[Backup Report] Failed to generate report', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper: Get bucket statistics
 */
async function getBucketStats(storage: Storage, bucketName: string) {
  try {
    const [files] = await storage.bucket(bucketName).getFiles();
    
    let totalSize = 0;
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;

    files.forEach(file => {
      const metadata = file.metadata;
      totalSize += parseInt(metadata.size || '0', 10);
      
      const created = new Date(metadata.timeCreated);
      if (!oldestDate || created < oldestDate) oldestDate = created;
      if (!newestDate || created > newestDate) newestDate = created;
    });

    return {
      fileCount: files.length,
      totalSizeGB: Number((totalSize / (1024 ** 3)).toFixed(2)),
      oldestFile: oldestDate?.toISOString().split('T')[0] || 'N/A',
      newestFile: newestDate?.toISOString().split('T')[0] || 'N/A'
    };
  } catch (error) {
    logger.warn(`[Backup Report] Could not access bucket ${bucketName}`, error);
    return {
      fileCount: 0,
      totalSizeGB: 0,
      oldestFile: 'N/A',
      newestFile: 'N/A'
    };
  }
}

export default router;
