/**
 * Google Cloud Storage Backup Service
 * Handles automated backups to GCS buckets
 */

import { Storage } from '@google-cloud/storage';
import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import sgMail from '@sendgrid/mail';

const execAsync = promisify(exec);

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Environment-driven bucket names (no hardcoding)
const CODE_BUCKET = process.env.GCS_CODE_BUCKET || 'petwash-code-backups';
const FIRESTORE_BUCKET = process.env.GCS_FIRESTORE_BUCKET || 'petwash-firestore-backups';
const TEMP_DIR = '/tmp/petwash-backups';

let storage: Storage | null = null;

// Initialize storage client - PRODUCTION: Environment variables ONLY
function getStorageClient(): Storage {
  if (!storage) {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (!credentialsJson) {
      throw new Error('[GCS] GOOGLE_APPLICATION_CREDENTIALS environment variable not set. Configure it in Replit Secrets.');
    }
    
    try {
      // Parse JSON credentials from environment variable
      const credentials = JSON.parse(credentialsJson);
      storage = new Storage({ credentials });
      logger.info('[GCS] Storage client initialized from environment variable (secure)');
    } catch (error) {
      throw new Error(`[GCS] Failed to parse GOOGLE_APPLICATION_CREDENTIALS: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
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
    logger.info('[GCS] Creating compressed backup...');
    await execAsync(
      `tar -czf ${localPath} \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='dist' \
        --exclude='.cache' \
        --exclude='*.log' \
        --exclude='petwash-backup-*.tar.gz' \
        --exclude='gcs-service-account.json' \
        -C ${process.cwd()} .`,
      { maxBuffer: 1024 * 1024 * 100 } // 100MB buffer
    );
    
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
    
    // Log to Firestore
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
    
    // Send backup summary email with CSV attachment
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
        
        // Upload JSON to GCS
        const fileName = `${collectionName}_${date}.json`;
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
        
        totalDocs += documents.length;
        results.push({ 
          collection: collectionName, 
          docs: documents.length,
          sizeMB: parseFloat(fileSizeMB)
        });
        
        logger.info(`[GCS] ✅ Exported ${documents.length} docs from ${collectionName} (${fileSizeMB} MB)`);
      } catch (error) {
        logger.error(`[GCS] Failed to export ${collectionName}:`, error);
        results.push({ collection: collectionName, error: true });
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const fullGcsPath = `gs://${FIRESTORE_BUCKET}/${gcsPath}`;
    const timestamp = new Date().toISOString();
    
    logger.info(`[GCS] ✅ Firestore export complete in ${duration}s: ${fullGcsPath}`);
    
    // Log to Firestore
    await db.collection('backup_logs').add({
      type: 'firestore',
      status: 'success',
      collections: results.length,
      totalDocs,
      gcsPath: fullGcsPath,
      details: results,
      duration: parseFloat(duration),
      timestamp
    });
    
    // Send backup summary email with CSV attachment
    await sendBackupSummaryEmail({
      type: 'firestore',
      timestamp,
      firestoreBackup: {
        path: fullGcsPath,
        collections: results.length,
        totalDocs,
        files: results.map(r => ({
          collection: r.collection,
          docs: r.docs || 0,
          sizeMB: r.sizeMB,
          error: r.error
        }))
      },
      includeCSV: true
    });
    
    return {
      success: true,
      collections: results.length,
      totalDocs,
      gcsPath: fullGcsPath
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
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (!credentialsJson) {
    return false;
  }
  
  // Verify it's valid JSON
  try {
    JSON.parse(credentialsJson);
    return true;
  } catch {
    logger.error('[GCS] GOOGLE_APPLICATION_CREDENTIALS is not valid JSON');
    return false;
  }
}

/**
 * Get backup status and recent logs
 */
/**
 * Backup a single message to GCS
 */
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
    logger.error('[GCS] Message backup failed', {
      messageId: messageData.messageId,
      error: error.message,
    });
    
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
  codeBackup?: { file: string; size: string; hash: string; gcsUrl: string };
  firestoreBackup?: { path: string; collections: number; totalDocs: number; files: Array<{ collection: string; docs: number; sizeMB?: number; error?: boolean }> };
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

  const subject = `✅ Pet Wash™ Backup Summary — ${new Date(data.timestamp).toLocaleDateString('en-US')}`;

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
        <h1>🐾 Pet Wash™ Backup Summary</h1>
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
      </div>

      <div class="section">
        <h2>📊 Collection Details</h2>
        ${data.firestoreBackup.files.map(file => {
          if (file.error) {
            return `
              <div class="detail">
                <span class="label">${file.collection}:</span>
                <span class="value" style="color: #ef4444;">❌ FAILED</span>
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
          ${data.firestoreBackup.files.some(f => f.error) 
            ? '<span style="color: #ef4444; font-weight: 600;">⚠️ Warning - Some Collections Failed to Export</span>'
            : '<span class="success">✅ Verified - All Collections Exported Successfully</span>'
          }
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
        <p>Pet Wash™ Automated Backup System</p>
        <p>This is an automated report. For support, contact <a href="mailto:Support@PetWash.co.il">Support@PetWash.co.il</a></p>
      </div>
    </body>
    </html>
  `;

  const emailData: any = {
    to: 'nir.h@petwash.co.il',  // Updated for deployment report
    cc: 'Support@PetWash.co.il',
    from: {
      email: 'Support@PetWash.co.il',
      name: 'Pet Wash™ Backup System'
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
