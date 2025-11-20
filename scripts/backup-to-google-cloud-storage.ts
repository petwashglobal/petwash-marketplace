/**
 * PetWash™ Complete Database Backup to Google Cloud Storage
 * External backup to Google servers for disaster recovery
 */

import { db } from '../server/db';
import { Storage } from '@google-cloud/storage';
import { sql } from 'drizzle-orm';

const BACKUP_BUCKET = process.env.BIOMETRIC_BUCKET_NAME || 'petwash-backups';
const BACKUP_PREFIX = 'petwash-database-backups/';

// Initialize Google Cloud Storage with credentials from environment
function initializeGoogleStorage() {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (credentialsJson && credentialsJson.startsWith('{')) {
    // Parse JSON credentials
    const credentials = JSON.parse(credentialsJson);
    return new Storage({
      projectId: credentials.project_id,
      credentials
    });
  } else {
    // Use default application credentials
    return new Storage();
  }
}

async function backupToGoogleCloud() {
  console.log('🌐 PetWash™ External Backup to Google Cloud Storage');
  console.log('===================================================\n');

  try {
    const storage = initializeGoogleStorage();
    const bucket = storage.bucket(BACKUP_BUCKET);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${BACKUP_PREFIX}${timestamp}/`;

    console.log(`📦 Backup destination: gs://${BACKUP_BUCKET}/${backupPath}`);
    console.log(`⏰ Timestamp: ${timestamp}\n`);

    // Step 1: Discover all tables
    console.log('📋 Step 1: Discovering database tables...');
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const tableNames = tablesResult.rows.map((r: any) => r.table_name);
    console.log(`✅ Found ${tableNames.length} tables\n`);

    // Step 2: Backup each table
    console.log('📦 Step 2: Backing up tables to Google Cloud...');
    const backupData: any = {
      backup_info: {
        timestamp,
        backup_date: new Date().toISOString(),
        destination: `gs://${BACKUP_BUCKET}/${backupPath}`,
        total_tables: tableNames.length
      },
      tables: {}
    };

    let totalRecords = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const tableName of tableNames) {
      try {
        const data = await db.execute(sql.raw(`SELECT * FROM ${tableName}`));
        const recordCount = data.rows.length;
        
        backupData.tables[tableName] = {
          count: recordCount,
          data: data.rows
        };

        totalRecords += recordCount;
        successCount++;
        
        // Upload table data to Google Cloud
        const tableFile = `${backupPath}tables/${tableName}.json`;
        await bucket.file(tableFile).save(JSON.stringify({
          table: tableName,
          count: recordCount,
          data: data.rows,
          backed_up_at: new Date().toISOString()
        }, null, 2), {
          contentType: 'application/json',
          metadata: {
            'petwash-table': tableName,
            'record-count': recordCount.toString(),
            'backup-timestamp': timestamp
          }
        });

        console.log(`   ✅ ${tableName}: ${recordCount} records → Google Cloud`);
      } catch (error: any) {
        console.log(`   ⚠️  ${tableName}: ${error.message}`);
        errorCount++;
      }
    }

    // Step 3: Upload complete backup summary
    console.log('\n📊 Step 3: Creating backup summary...');
    const summary = {
      ...backupData.backup_info,
      statistics: {
        total_tables: tableNames.length,
        successful_backups: successCount,
        failed_backups: errorCount,
        total_records: totalRecords
      },
      tables_summary: Object.entries(backupData.tables).map(([name, info]: [string, any]) => ({
        table: name,
        records: info.count
      })),
      platforms: {
        database: 'PostgreSQL (Neon)',
        storage: 'Google Cloud Storage (Firebase)',
        bucket: BACKUP_BUCKET,
        backup_path: backupPath
      },
      security: {
        voucher_signing: 'ES256 JWS',
        encryption: 'Google Cloud Server-Side Encryption',
        access_control: 'IAM Permissions'
      }
    };

    // Upload summary to Google Cloud
    await bucket.file(`${backupPath}backup-summary.json`).save(
      JSON.stringify(summary, null, 2),
      {
        contentType: 'application/json',
        metadata: {
          'petwash-backup': 'summary',
          'backup-timestamp': timestamp
        }
      }
    );

    // Upload complete data file
    await bucket.file(`${backupPath}complete-backup.json`).save(
      JSON.stringify(backupData, null, 2),
      {
        contentType: 'application/json',
        metadata: {
          'petwash-backup': 'complete',
          'backup-timestamp': timestamp
        }
      }
    );

    console.log('✅ Summary uploaded to Google Cloud\n');

    // Success output
    console.log('===================================================');
    console.log('✅ EXTERNAL BACKUP TO GOOGLE CLOUD COMPLETE!');
    console.log('===================================================\n');
    console.log('📊 Backup Statistics:');
    console.log(`   - Total Tables: ${summary.statistics.total_tables}`);
    console.log(`   - Successful: ${summary.statistics.successful_backups}`);
    console.log(`   - Failed: ${summary.statistics.failed_backups}`);
    console.log(`   - Total Records: ${summary.statistics.total_records}`);
    console.log(`\n📍 Google Cloud Location:`);
    console.log(`   - Bucket: ${BACKUP_BUCKET}`);
    console.log(`   - Path: ${backupPath}`);
    console.log(`   - Full URL: gs://${BACKUP_BUCKET}/${backupPath}`);
    console.log(`\n🔐 Security:`);
    console.log(`   - Encryption: Google Cloud Server-Side Encryption`);
    console.log(`   - Access: IAM-controlled`);
    console.log(`   - Voucher Security: ES256 JWS + SHA-256`);
    console.log(`\n✅ Your PetWash™ data is now safely backed up to Google Cloud!`);

    return summary;
  } catch (error: any) {
    console.error('\n❌ Google Cloud backup failed:', error.message);
    
    if (error.code === 403) {
      console.error('\n⚠️  Permission Error:');
      console.error('   The service account needs Storage Object Creator permissions.');
      console.error('   Contact Google Cloud admin to grant permissions to:');
      console.error(`   ${error.message}`);
    } else if (error.code === 404) {
      console.error('\n⚠️  Bucket Not Found:');
      console.error(`   Bucket "${BACKUP_BUCKET}" does not exist.`);
      console.error('   Create the bucket in Google Cloud Console first.');
    } else {
      console.error('\nFull error:', error);
    }
    
    throw error;
  }
}

// Run backup
backupToGoogleCloud()
  .then((summary) => {
    console.log('\n🎉 External backup successful!');
    console.log(`\nBackup stored at: gs://${summary.platforms.bucket}/${summary.platforms.backup_path}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 External backup failed');
    process.exit(1);
  });
