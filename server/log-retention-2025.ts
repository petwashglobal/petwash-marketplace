/**
 * 7-Year Log Retention System
 * Israeli Legal Compliance - Tax Law & Privacy Protection
 * 
 * Requirements:
 * - Invoices & Financial Records: 7 years (Israeli Tax Ordinance)
 * - Authentication Logs: 7 years (Privacy Protection Law)
 * - Access Logs: 7 years (Data Protection)
 * - Automatic archival to cold storage
 * - Fast retrieval when needed
 */

import { Storage } from '@google-cloud/storage';
import { logger } from './lib/logger';
import { db as adminDb } from './lib/firebase-admin';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// GCS buckets for log retention
const LOGS_BUCKET = process.env.GCS_LOGS_BUCKET || 'petwash-logs-retention';
const COLD_STORAGE_CLASS = 'COLDLINE'; // Cost-effective for 7-year retention

let storage: Storage | null = null;

function getStorageClient(): Storage {
  if (!storage) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        storage = new Storage({ credentials });
      } else {
        storage = new Storage();
      }
    } catch (error) {
      logger.error('[Log Retention] Failed to initialize storage', error);
      storage = new Storage();
    }
  }
  return storage;
}

// ============================================
// LOG TYPES
// ============================================

export interface AuthenticationLog {
  userId: string;
  email: string;
  action: 'login' | 'logout' | 'passkey_register' | 'passkey_auth' | 'password_change' | 'failed_login';
  method: 'password' | 'passkey' | 'google' | 'facebook' | 'apple';
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
  deviceId?: string;
  timestamp: Date;
}

export interface AccessLog {
  userId: string;
  email: string;
  resource: string;
  action: 'view' | 'create' | 'update' | 'delete' | 'download';
  resourceType: 'document' | 'user_data' | 'financial_record' | 'pet_data' | 'voucher';
  granted: boolean;
  denialReason?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export interface FinancialLog {
  transactionId: string;
  userId: string;
  type: 'purchase' | 'refund' | 'voucher_redeem' | 'payment_method_change';
  amount: number;
  currency: string;
  paymentMethod: string;
  invoiceNumber?: string;
  taxId?: string;
  timestamp: Date;
}

export interface SystemLog {
  level: 'info' | 'warn' | 'error' | 'critical';
  service: string;
  message: string;
  details?: any;
  userId?: string;
  requestId?: string;
  timestamp: Date;
}

// ============================================
// LOG ARCHIVAL
// ============================================

/**
 * Archive logs to GCS cold storage
 * Runs daily at midnight
 */
export async function archiveDailyLogs(date: Date): Promise<{
  success: boolean;
  archived: { type: string; count: number; size: string }[];
  error?: string;
}> {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  logger.info(`[Log Retention] Starting daily log archival for ${dateStr}`);
  
  const archived: { type: string; count: number; size: string }[] = [];
  
  try {
    // Archive authentication logs
    const authResult = await archiveLogsByType('authentication', date);
    archived.push(authResult);
    
    // Archive access logs
    const accessResult = await archiveLogsByType('access', date);
    archived.push(accessResult);
    
    // Archive financial logs
    const financialResult = await archiveLogsByType('financial', date);
    archived.push(financialResult);
    
    // Archive system logs
    const systemResult = await archiveLogsByType('system', date);
    archived.push(systemResult);
    
    logger.info('[Log Retention] Daily archival complete', { archived });
    
    return {
      success: true,
      archived
    };
  } catch (error) {
    logger.error('[Log Retention] Daily archival failed', error);
    return {
      success: false,
      archived,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Archive logs by type
 */
async function archiveLogsByType(
  logType: 'authentication' | 'access' | 'financial' | 'system',
  date: Date
): Promise<{ type: string; count: number; size: string }> {
  const dateStr = date.toISOString().split('T')[0];
  const collectionName = `${logType}_logs`;
  
  // Query logs for this date
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const logsSnapshot = await adminDb
    .collection(collectionName)
    .where('timestamp', '>=', startOfDay)
    .where('timestamp', '<=', endOfDay)
    .get();
  
  if (logsSnapshot.empty) {
    logger.info(`[Log Retention] No ${logType} logs to archive for ${dateStr}`);
    return { type: logType, count: 0, size: '0 KB' };
  }
  
  // Convert to JSON
  const logs = logsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  const jsonData = JSON.stringify(logs, null, 2);
  
  // Compress
  const compressed = await gzip(Buffer.from(jsonData, 'utf-8'));
  
  // Calculate integrity hash
  const hash = crypto.createHash('sha256').update(compressed).digest('hex');
  
  // Upload to GCS
  const storageClient = getStorageClient();
  const fileName = `${logType}/${dateStr.substring(0, 4)}/${dateStr}.json.gz`;
  
  const file = storageClient.bucket(LOGS_BUCKET).file(fileName);
  
  await file.save(compressed, {
    metadata: {
      contentType: 'application/gzip',
      contentEncoding: 'gzip',
      metadata: {
        logType,
        date: dateStr,
        count: logs.length.toString(),
        sha256: hash,
        retentionUntil: getRetentionExpiryDate(date).toISOString()
      }
    }
  });
  
  // Set storage class after upload
  await file.setStorageClass(COLD_STORAGE_CLASS);
  
  const sizeMB = (compressed.length / 1024 / 1024).toFixed(2);
  logger.info(`[Log Retention] Archived ${logs.length} ${logType} logs (${sizeMB} MB) to ${fileName}`);
  
  // Delete from Firestore after successful archival
  const batch = adminDb.batch();
  logsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  return {
    type: logType,
    count: logs.length,
    size: `${sizeMB} MB`
  };
}

/**
 * Calculate retention expiry date (7 years from now)
 */
function getRetentionExpiryDate(logDate: Date): Date {
  const expiry = new Date(logDate);
  expiry.setFullYear(expiry.getFullYear() + 7);
  return expiry;
}

// ============================================
// LOG RETRIEVAL
// ============================================

/**
 * Retrieve archived logs for a specific date
 * Used for legal compliance, audits, investigations
 */
export async function retrieveArchivedLogs(
  logType: 'authentication' | 'access' | 'financial' | 'system',
  date: Date
): Promise<any[]> {
  const dateStr = date.toISOString().split('T')[0];
  const fileName = `${logType}/${dateStr.substring(0, 4)}/${dateStr}.json.gz`;
  
  logger.info(`[Log Retention] Retrieving archived logs: ${fileName}`);
  
  try {
    const storageClient = getStorageClient();
    const file = storageClient.bucket(LOGS_BUCKET).file(fileName);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      logger.warn(`[Log Retention] Archived logs not found: ${fileName}`);
      return [];
    }
    
    // Download
    const [compressed] = await file.download();
    
    // Decompress
    const jsonBuffer = await gunzip(compressed);
    const logs = JSON.parse(jsonBuffer.toString('utf-8'));
    
    logger.info(`[Log Retention] Retrieved ${logs.length} logs from ${fileName}`);
    
    return logs;
  } catch (error) {
    logger.error('[Log Retention] Failed to retrieve archived logs', error);
    return [];
  }
}

/**
 * Search archived logs by date range
 */
export async function searchArchivedLogs(
  logType: 'authentication' | 'access' | 'financial' | 'system',
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  logger.info(`[Log Retention] Searching archived logs: ${logType} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  const results: any[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dailyLogs = await retrieveArchivedLogs(logType, current);
    results.push(...dailyLogs);
    
    // Next day
    current.setDate(current.getDate() + 1);
  }
  
  logger.info(`[Log Retention] Search complete: Found ${results.length} logs`);
  
  return results;
}

// ============================================
// ACTIVE LOGGING
// ============================================

/**
 * Log authentication event
 */
export async function logAuthentication(log: AuthenticationLog): Promise<void> {
  try {
    await adminDb.collection('authentication_logs').add({
      ...log,
      timestamp: log.timestamp || new Date()
    });
  } catch (error) {
    logger.error('[Log Retention] Failed to log authentication', error);
  }
}

/**
 * Log access event
 */
export async function logAccess(log: AccessLog): Promise<void> {
  try {
    await adminDb.collection('access_logs').add({
      ...log,
      timestamp: log.timestamp || new Date()
    });
  } catch (error) {
    logger.error('[Log Retention] Failed to log access', error);
  }
}

/**
 * Log financial transaction
 */
export async function logFinancial(log: FinancialLog): Promise<void> {
  try {
    await adminDb.collection('financial_logs').add({
      ...log,
      timestamp: log.timestamp || new Date()
    });
  } catch (error) {
    logger.error('[Log Retention] Failed to log financial transaction', error);
  }
}

/**
 * Log system event
 */
export async function logSystem(log: SystemLog): Promise<void> {
  try {
    await adminDb.collection('system_logs').add({
      ...log,
      timestamp: log.timestamp || new Date()
    });
  } catch (error) {
    logger.error('[Log Retention] Failed to log system event', error);
  }
}

// ============================================
// RETENTION MONITORING
// ============================================

/**
 * Check for logs approaching expiry
 * Alert before automatic deletion
 */
export async function checkRetentionExpiry(): Promise<void> {
  logger.info('[Log Retention] Checking for logs approaching 7-year expiry...');
  
  try {
    const storageClient = getStorageClient();
    const [files] = await storageClient.bucket(LOGS_BUCKET).getFiles();
    
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    let expiringCount = 0;
    
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const retentionUntil = metadata.metadata?.retentionUntil;
      
      if (retentionUntil && typeof retentionUntil === 'string') {
        const expiryDate = new Date(retentionUntil);
        
        if (expiryDate <= thirtyDaysFromNow && expiryDate > now) {
          expiringCount++;
          logger.warn(`[Log Retention] Log file approaching expiry: ${file.name} (expires: ${expiryDate.toISOString()})`);
        }
      }
    }
    
    if (expiringCount > 0) {
      logger.info(`[Log Retention] ${expiringCount} log files approaching 7-year expiry`);
    }
  } catch (error) {
    logger.error('[Log Retention] Failed to check retention expiry', error);
  }
}

/**
 * Get retention summary
 */
export async function getRetentionSummary(): Promise<{
  totalFiles: number;
  totalSize: string;
  oldestLog: string;
  newestLog: string;
  expiringIn30Days: number;
}> {
  try {
    const storageClient = getStorageClient();
    const [files] = await storageClient.bucket(LOGS_BUCKET).getFiles();
    
    let totalSize = 0;
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;
    let expiringCount = 0;
    
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      totalSize += parseInt(String(metadata.size || '0'), 10);
      
      const fileDateStr = metadata.metadata?.date || metadata.timeCreated;
      const fileDate = typeof fileDateStr === 'string' ? new Date(fileDateStr) : new Date();
      
      if (!oldestDate || fileDate < oldestDate) {
        oldestDate = fileDate;
      }
      
      if (!newestDate || fileDate > newestDate) {
        newestDate = fileDate;
      }
      
      const retentionUntil = metadata.metadata?.retentionUntil;
      if (retentionUntil && typeof retentionUntil === 'string') {
        const expiryDate = new Date(retentionUntil);
        if (expiryDate <= thirtyDaysFromNow && expiryDate > now) {
          expiringCount++;
        }
      }
    }
    
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    return {
      totalFiles: files.length,
      totalSize: `${sizeMB} MB`,
      oldestLog: oldestDate ? oldestDate.toISOString().split('T')[0] : 'N/A',
      newestLog: newestDate ? newestDate.toISOString().split('T')[0] : 'N/A',
      expiringIn30Days: expiringCount
    };
  } catch (error) {
    logger.error('[Log Retention] Failed to get retention summary', error);
    return {
      totalFiles: 0,
      totalSize: '0 MB',
      oldestLog: 'N/A',
      newestLog: 'N/A',
      expiringIn30Days: 0
    };
  }
}
