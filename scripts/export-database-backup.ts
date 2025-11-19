/**
 * PetWash™ Complete Database Export
 * Exports all tables to local JSON files for backup
 */

import { db } from '../server/db';
import fs from 'fs';
import path from 'path';
import { 
  users, 
  petWashVouchers2025, 
  voucherUsageHistory,
  washPackages,
  washHistory,
  eVouchers
} from '../shared/schema';

async function exportAllData() {
  console.log('🔄 Starting complete database export...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'database-backups', timestamp);
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  try {
    // Export Users
    console.log('📦 Exporting users...');
    const usersData = await db.select().from(users);
    fs.writeFileSync(
      path.join(backupDir, 'users.json'),
      JSON.stringify(usersData, null, 2)
    );
    console.log(`✅ Users exported: ${usersData.length} records`);

    // Export Vouchers 2025
    console.log('📦 Exporting vouchers 2025...');
    const vouchersData = await db.select().from(petWashVouchers2025);
    fs.writeFileSync(
      path.join(backupDir, 'vouchers-2025.json'),
      JSON.stringify(vouchersData, null, 2)
    );
    console.log(`✅ Vouchers 2025 exported: ${vouchersData.length} records`);

    // Export Voucher Usage History
    console.log('📦 Exporting voucher usage history...');
    const usageHistoryData = await db.select().from(voucherUsageHistory);
    fs.writeFileSync(
      path.join(backupDir, 'voucher-usage-history.json'),
      JSON.stringify(usageHistoryData, null, 2)
    );
    console.log(`✅ Voucher usage history exported: ${usageHistoryData.length} records`);

    // Export Wash Packages
    console.log('📦 Exporting wash packages...');
    const packagesData = await db.select().from(washPackages);
    fs.writeFileSync(
      path.join(backupDir, 'wash-packages.json'),
      JSON.stringify(packagesData, null, 2)
    );
    console.log(`✅ Wash packages exported: ${packagesData.length} records`);

    // Export Wash History
    console.log('📦 Exporting wash history...');
    const washHistoryData = await db.select().from(washHistory);
    fs.writeFileSync(
      path.join(backupDir, 'wash-history.json'),
      JSON.stringify(washHistoryData, null, 2)
    );
    console.log(`✅ Wash history exported: ${washHistoryData.length} records`);

    // Export E-Vouchers
    console.log('📦 Exporting e-vouchers...');
    const eVouchersData = await db.select().from(eVouchers);
    fs.writeFileSync(
      path.join(backupDir, 'e-vouchers.json'),
      JSON.stringify(eVouchersData, null, 2)
    );
    console.log(`✅ E-vouchers exported: ${eVouchersData.length} records`);

    // Create backup metadata
    const metadata = {
      backup_timestamp: timestamp,
      backup_date: new Date().toISOString(),
      backup_directory: backupDir,
      tables_exported: [
        { name: 'users', count: usersData.length },
        { name: 'vouchers_2025', count: vouchersData.length },
        { name: 'voucher_usage_history', count: usageHistoryData.length },
        { name: 'wash_packages', count: packagesData.length },
        { name: 'wash_history', count: washHistoryData.length },
        { name: 'e_vouchers', count: eVouchersData.length }
      ],
      total_records: usersData.length + vouchersData.length + usageHistoryData.length + 
                     packagesData.length + washHistoryData.length + eVouchersData.length
    };

    fs.writeFileSync(
      path.join(backupDir, 'backup-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('\n✅ EXPORT COMPLETE!');
    console.log('📊 Summary:');
    console.log(`   - Total records exported: ${metadata.total_records}`);
    console.log(`   - Backup location: ${backupDir}`);
    console.log(`   - Timestamp: ${timestamp}`);
    console.log('\n📁 Exported files:');
    metadata.tables_exported.forEach(table => {
      console.log(`   - ${table.name}: ${table.count} records`);
    });

    return metadata;
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  }
}

// Run export
exportAllData()
  .then((metadata) => {
    console.log('\n🎉 Database export successful!');
    console.log('\n📤 To upload to Google Cloud Storage, run:');
    console.log(`   gsutil -m cp -r ${metadata.backup_directory} gs://your-bucket/backups/`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Database export failed:', error);
    process.exit(1);
  });
