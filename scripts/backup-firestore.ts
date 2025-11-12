#!/usr/bin/env tsx
/**
 * Manual Firestore Backup Script
 * Run: npx tsx scripts/backup-firestore.ts
 */

import { performFirestoreExport } from '../server/services/gcsBackupService';
import { logger } from '../server/lib/logger';

async function runBackup() {
  logger.info('🚀 Starting manual Firestore backup...');
  
  const result = await performFirestoreExport();
  
  if (result.success) {
    logger.info(`✅ Backup successful!`);
    logger.info(`   Collections: ${result.collections}`);
    logger.info(`   Total Documents: ${result.totalDocs}`);
    logger.info(`   GCS Path: ${result.gcsPath}`);
    process.exit(0);
  } else {
    logger.error(`❌ Backup failed: ${result.error}`);
    process.exit(1);
  }
}

runBackup().catch((error) => {
  logger.error('Fatal error during backup:', error);
  process.exit(1);
});
