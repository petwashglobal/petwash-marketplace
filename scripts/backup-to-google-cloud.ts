/**
 * PetWash™ Complete Database Backup to Google Cloud Storage
 * Backs up all tables to Google Cloud as JSON files
 */

import { db } from '../server/db';
import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import { 
  users, 
  petWashVouchers2025, 
  voucherUsageHistory,
  washPackages,
  washHistory,
  eVouchers,
  sessions
} from '../shared/schema';

const BACKUP_BUCKET = process.env.BIOMETRIC_BUCKET_NAME || 'signinpetwash.firebasestorage.app';
const BACKUP_PREFIX = 'database-backups/';

// Initialize Google Cloud Storage with proper credentials
function initializeStorage() {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (credentialsJson && credentialsJson.startsWith('{')) {
    // Parse JSON credentials from environment variable
    const credentials = JSON.parse(credentialsJson);
    return new Storage({
      projectId: credentials.project_id,
      credentials
    });
  } else {
    // Use default credentials
    return new Storage();
  }
}

async function backupAllData() {
  console.log('🔄 Starting complete database backup to Google Cloud Storage...');
  
  const storage = initializeStorage();
  const bucket = storage.bucket(BACKUP_BUCKET);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = `${BACKUP_PREFIX}${timestamp}/`;

  try {
    // Backup Users
    console.log('📦 Backing up users...');
    const usersData = await db.select().from(users);
    await bucket.file(`${backupFolder}users.json`).save(JSON.stringify(usersData, null, 2));
    console.log(`✅ Users backed up: ${usersData.length} records`);

    // Backup Vouchers 2025
    console.log('📦 Backing up vouchers 2025...');
    const vouchersData = await db.select().from(petWashVouchers2025);
    await bucket.file(`${backupFolder}vouchers-2025.json`).save(JSON.stringify(vouchersData, null, 2));
    console.log(`✅ Vouchers 2025 backed up: ${vouchersData.length} records`);

    // Backup Voucher Usage History
    console.log('📦 Backing up voucher usage history...');
    const usageHistoryData = await db.select().from(voucherUsageHistory);
    await bucket.file(`${backupFolder}voucher-usage-history.json`).save(JSON.stringify(usageHistoryData, null, 2));
    console.log(`✅ Voucher usage history backed up: ${usageHistoryData.length} records`);

    // Backup Wash Packages
    console.log('📦 Backing up wash packages...');
    const packagesData = await db.select().from(washPackages);
    await bucket.file(`${backupFolder}wash-packages.json`).save(JSON.stringify(packagesData, null, 2));
    console.log(`✅ Wash packages backed up: ${packagesData.length} records`);

    // Backup Wash History
    console.log('📦 Backing up wash history...');
    const washHistoryData = await db.select().from(washHistory);
    await bucket.file(`${backupFolder}wash-history.json`).save(JSON.stringify(washHistoryData, null, 2));
    console.log(`✅ Wash history backed up: ${washHistoryData.length} records`);

    // Backup E-Vouchers
    console.log('📦 Backing up e-vouchers...');
    const eVouchersData = await db.select().from(eVouchers);
    await bucket.file(`${backupFolder}e-vouchers.json`).save(JSON.stringify(eVouchersData, null, 2));
    console.log(`✅ E-vouchers backed up: ${eVouchersData.length} records`);

    // Create backup metadata
    const metadata = {
      backup_timestamp: timestamp,
      backup_date: new Date().toISOString(),
      tables_backed_up: [
        { name: 'users', count: usersData.length },
        { name: 'vouchers_2025', count: vouchersData.length },
        { name: 'voucher_usage_history', count: usageHistoryData.length },
        { name: 'wash_packages', count: packagesData.length },
        { name: 'wash_history', count: washHistoryData.length },
        { name: 'e_vouchers', count: eVouchersData.length }
      ],
      total_records: usersData.length + vouchersData.length + usageHistoryData.length + 
                     packagesData.length + washHistoryData.length + eVouchersData.length,
      bucket: BACKUP_BUCKET,
      backup_location: backupFolder
    };

    await bucket.file(`${backupFolder}backup-metadata.json`).save(JSON.stringify(metadata, null, 2));

    console.log('\n✅ BACKUP COMPLETE!');
    console.log('📊 Summary:');
    console.log(`   - Total records backed up: ${metadata.total_records}`);
    console.log(`   - Backup location: gs://${BACKUP_BUCKET}/${backupFolder}`);
    console.log(`   - Timestamp: ${timestamp}`);
    console.log('\n📁 Backed up files:');
    metadata.tables_backed_up.forEach(table => {
      console.log(`   - ${table.name}: ${table.count} records`);
    });

    return metadata;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

// Run backup
backupAllData()
  .then((metadata) => {
    console.log('\n🎉 Database backup to Google Cloud Storage successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Database backup failed:', error);
    process.exit(1);
  });
