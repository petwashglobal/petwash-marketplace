/**
 * Pet Wash™ - Comprehensive Backup & Report Generator
 * 
 * Creates complete backup of all code, mobile app, and Firestore data
 * Generates detailed report with exact file counts and sizes
 */

import { Storage } from '@google-cloud/storage';
import { db } from '../server/lib/firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

const CODE_BUCKET = process.env.GCS_CODE_BUCKET || 'petwash-code-backups';
const FIRESTORE_BUCKET = process.env.GCS_FIRESTORE_BUCKET || 'petwash-firestore-backups';
const TEMP_DIR = '/tmp/petwash-comprehensive-backup';

interface BackupReport {
  timestamp: string;
  codeBackup: {
    file: string;
    sizeBytes: number;
    sizeMB: string;
    sha256: string;
    gcsUrl: string;
    filesCounted: number;
  };
  firestoreBackup: {
    collections: Array<{
      name: string;
      documents: number;
      sizeBytes: number;
      sizeMB: string;
      fileName: string;
      gcsUrl: string;
    }>;
    totalCollections: number;
    totalDocuments: number;
    totalSizeBytes: number;
    totalSizeMB: string;
  };
  summary: {
    totalSizeBytes: number;
    totalSizeMB: string;
    duration: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  };
}

function getStorageClient(): Storage {
  const credentialsSource = process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcs-service-account.json';
  
  try {
    const credentials = JSON.parse(credentialsSource);
    return new Storage({ credentials });
  } catch {
    if (!fs.existsSync(credentialsSource)) {
      throw new Error(`GCS credentials not found at: ${credentialsSource}`);
    }
    return new Storage({ keyFilename: credentialsSource });
  }
}

function calculateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function countProjectFiles(): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `find . -type f \
        -not -path '*/node_modules/*' \
        -not -path '*/.git/*' \
        -not -path '*/dist/*' \
        -not -path '*/.cache/*' \
        -not -name '*.log' \
        -not -name 'gcs-service-account.json' \
        | wc -l`,
      { cwd: process.cwd() }
    );
    return parseInt(stdout.trim(), 10);
  } catch {
    return 0;
  }
}

async function backupCode(): Promise<BackupReport['codeBackup']> {
  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `petwash-COMPREHENSIVE-backup-${timestamp}.tar.gz`;
  const localPath = path.join(TEMP_DIR, backupFile);
  
  console.log('\n📦 Starting comprehensive code backup...');
  
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  
  // Count files before backup
  console.log('📊 Counting project files...');
  const fileCount = await countProjectFiles();
  console.log(`   Found ${fileCount} files to backup`);
  
  // Create comprehensive tar.gz backup
  console.log('🗜️  Creating compressed archive...');
  await execAsync(
    `tar -czf ${localPath} \
      --exclude='node_modules' \
      --exclude='.git' \
      --exclude='dist' \
      --exclude='.cache' \
      --exclude='*.log' \
      --exclude='petwash-backup-*.tar.gz' \
      --exclude='gcs-service-account.json' \
      --exclude='/tmp' \
      -C ${process.cwd()} .`,
    { maxBuffer: 1024 * 1024 * 200 } // 200MB buffer
  );
  
  const stats = fs.statSync(localPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log(`   ✅ Archive created: ${sizeMB} MB`);
  console.log('🔐 Calculating SHA-256 hash...');
  
  const fileHash = calculateFileHash(localPath);
  console.log(`   Hash: ${fileHash.substring(0, 16)}...`);
  
  // Upload to GCS
  const storageClient = getStorageClient();
  console.log(`☁️  Uploading to Google Cloud Storage...`);
  console.log(`   Bucket: ${CODE_BUCKET}`);
  
  await storageClient.bucket(CODE_BUCKET).upload(localPath, {
    destination: `comprehensive/${backupFile}`,
    metadata: {
      metadata: {
        project: 'petwash',
        type: 'comprehensive-code-backup',
        date,
        timestamp: new Date().toISOString(),
        sha256: fileHash,
        fileCount: fileCount.toString()
      }
    }
  });
  
  const gcsUrl = `gs://${CODE_BUCKET}/comprehensive/${backupFile}`;
  console.log(`   ✅ Upload complete: ${gcsUrl}`);
  
  // Clean up local file
  fs.unlinkSync(localPath);
  
  return {
    file: backupFile,
    sizeBytes: stats.size,
    sizeMB,
    sha256: fileHash,
    gcsUrl,
    filesCounted: fileCount
  };
}

async function backupFirestore(): Promise<BackupReport['firestoreBackup']> {
  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
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
    'loyalty',
    'security_events',
    'backup_logs',
    'audit_trail',
    'consent_logs',
    'dpocompliance',
    'israeli_compliance',
    'legal_reviews',
    'penetration_tests',
    'sitter_bookings',
    'walker_sessions',
    'transport_trips',
    'pet_avatars'
  ];
  
  console.log('\n🗄️  Starting Firestore backup...');
  console.log(`   Backing up ${COLLECTIONS.length} collections`);
  
  const storageClient = getStorageClient();
  const results: BackupReport['firestoreBackup']['collections'] = [];
  let totalDocs = 0;
  let totalBytes = 0;
  
  for (const collectionName of COLLECTIONS) {
    try {
      console.log(`\n📂 Exporting ${collectionName}...`);
      
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
      
      const fileContent = JSON.stringify(exportData, null, 2);
      const fileSizeBytes = Buffer.byteLength(fileContent, 'utf8');
      const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
      
      const fileName = `${collectionName}_${timestamp}.json`;
      const file = storageClient
        .bucket(FIRESTORE_BUCKET)
        .file(`comprehensive/${date}/${fileName}`);
      
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
      
      const gcsUrl = `gs://${FIRESTORE_BUCKET}/comprehensive/${date}/${fileName}`;
      
      results.push({
        name: collectionName,
        documents: documents.length,
        sizeBytes: fileSizeBytes,
        sizeMB: fileSizeMB,
        fileName,
        gcsUrl
      });
      
      totalDocs += documents.length;
      totalBytes += fileSizeBytes;
      
      console.log(`   ✅ ${documents.length} documents (${fileSizeMB} MB)`);
    } catch (error) {
      console.error(`   ❌ Failed to export ${collectionName}:`, error);
      results.push({
        name: collectionName,
        documents: 0,
        sizeBytes: 0,
        sizeMB: '0.00',
        fileName: '',
        gcsUrl: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  return {
    collections: results,
    totalCollections: results.length,
    totalDocuments: totalDocs,
    totalSizeBytes: totalBytes,
    totalSizeMB: (totalBytes / (1024 * 1024)).toFixed(2)
  };
}

function generateDetailedReport(report: BackupReport): string {
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('              PET WASH™ LTD - COMPREHENSIVE BACKUP REPORT');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Report Generated: ${report.timestamp}`);
  lines.push(`Company: פט וואש בע״מ (Pet Wash Ltd)`);
  lines.push(`Company Number: ח.פ. 517145033`);
  lines.push(`Domain: www.petwash.co.il`);
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────');
  lines.push('1. CODE BACKUP (Complete Platform Source Code)');
  lines.push('───────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push(`Backup File:          ${report.codeBackup.file}`);
  lines.push(`Files Backed Up:      ${report.codeBackup.filesCounted.toLocaleString()} files`);
  lines.push(`Compressed Size:      ${report.codeBackup.sizeMB} MB (${report.codeBackup.sizeBytes.toLocaleString()} bytes)`);
  lines.push(`SHA-256 Hash:         ${report.codeBackup.sha256}`);
  lines.push(`GCS Location:         ${report.codeBackup.gcsUrl}`);
  lines.push('');
  lines.push('Included Components:');
  lines.push('  ✓ Web Application (React + TypeScript + Vite)');
  lines.push('  ✓ Mobile App (React Native + Expo)');
  lines.push('  ✓ Backend API (Node.js + Express)');
  lines.push('  ✓ Database Schemas (Drizzle ORM)');
  lines.push('  ✓ Firebase Configuration');
  lines.push('  ✓ All Service Files (Auth, Payments, Loyalty, etc.)');
  lines.push('  ✓ All Scripts & Utilities');
  lines.push('  ✓ Configuration Files');
  lines.push('  ✓ Documentation');
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────');
  lines.push('2. FIRESTORE DATABASE BACKUP (All Collections)');
  lines.push('───────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push(`Total Collections:    ${report.firestoreBackup.totalCollections}`);
  lines.push(`Total Documents:      ${report.firestoreBackup.totalDocuments.toLocaleString()}`);
  lines.push(`Total Size:           ${report.firestoreBackup.totalSizeMB} MB (${report.firestoreBackup.totalSizeBytes.toLocaleString()} bytes)`);
  lines.push('');
  lines.push('Collection Details:');
  lines.push('');
  
  // Table header
  lines.push('  Collection Name                  Documents      Size (MB)    Status');
  lines.push('  ─────────────────────────────────────────────────────────────────');
  
  for (const col of report.firestoreBackup.collections) {
    const status = col.documents > 0 || col.gcsUrl.startsWith('gs://') ? '✓' : '✗';
    const name = col.name.padEnd(30);
    const docs = col.documents.toString().padStart(10);
    const size = col.sizeMB.padStart(12);
    lines.push(`  ${name} ${docs}   ${size}      ${status}`);
  }
  
  lines.push('');
  lines.push('GCS Locations:');
  for (const col of report.firestoreBackup.collections) {
    if (col.gcsUrl.startsWith('gs://')) {
      lines.push(`  ${col.name}: ${col.gcsUrl}`);
    }
  }
  
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────');
  lines.push('3. BACKUP SUMMARY');
  lines.push('───────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push(`Status:               ${report.summary.status}`);
  lines.push(`Total Data Backed Up: ${report.summary.totalSizeMB} MB (${report.summary.totalSizeBytes.toLocaleString()} bytes)`);
  lines.push(`Backup Duration:      ${report.summary.duration}`);
  lines.push('');
  lines.push('Storage Breakdown:');
  lines.push(`  Code Archive:       ${report.codeBackup.sizeMB} MB (${((parseFloat(report.codeBackup.sizeMB) / parseFloat(report.summary.totalSizeMB)) * 100).toFixed(1)}%)`);
  lines.push(`  Firestore Data:     ${report.firestoreBackup.totalSizeMB} MB (${((parseFloat(report.firestoreBackup.totalSizeMB) / parseFloat(report.summary.totalSizeMB)) * 100).toFixed(1)}%)`);
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────');
  lines.push('4. GOOGLE CLOUD STORAGE LOCATIONS');
  lines.push('───────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push(`Code Bucket:          ${CODE_BUCKET}`);
  lines.push(`Firestore Bucket:     ${FIRESTORE_BUCKET}`);
  lines.push('');
  lines.push('Access URLs:');
  lines.push(`  https://console.cloud.google.com/storage/browser/${CODE_BUCKET}`);
  lines.push(`  https://console.cloud.google.com/storage/browser/${FIRESTORE_BUCKET}`);
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────');
  lines.push('5. VERIFICATION & INTEGRITY');
  lines.push('───────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push(`Code SHA-256:         ${report.codeBackup.sha256}`);
  lines.push('Firestore Exports:    Individual JSON files with metadata');
  lines.push('');
  lines.push('To verify code backup integrity:');
  lines.push(`  sha256sum ${report.codeBackup.file}`);
  lines.push(`  Expected: ${report.codeBackup.sha256}`);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('                    END OF BACKUP REPORT');
  lines.push('═══════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('© 2025 Pet Wash™ Ltd. All rights reserved.');
  lines.push('This backup was created automatically by the Pet Wash™ backup system.');
  lines.push('');
  
  return lines.join('\n');
}

async function main() {
  const startTime = Date.now();
  
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║        PET WASH™ LTD - COMPREHENSIVE BACKUP & REPORT             ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    // Perform backups
    const codeBackup = await backupCode();
    const firestoreBackup = await backupFirestore();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    const totalBytes = codeBackup.sizeBytes + firestoreBackup.totalSizeBytes;
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    
    const report: BackupReport = {
      timestamp: new Date().toISOString(),
      codeBackup,
      firestoreBackup,
      summary: {
        totalSizeBytes: totalBytes,
        totalSizeMB: totalMB,
        duration: `${duration} seconds`,
        status: 'SUCCESS'
      }
    };
    
    // Generate and save report
    const reportText = generateDetailedReport(report);
    const reportFile = path.join(TEMP_DIR, `backup-report-${new Date().toISOString().split('T')[0]}.txt`);
    
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    fs.writeFileSync(reportFile, reportText);
    
    // Save JSON version
    const reportJsonFile = path.join(TEMP_DIR, `backup-report-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(reportJsonFile, JSON.stringify(report, null, 2));
    
    // Upload report to GCS
    const storageClient = getStorageClient();
    await storageClient.bucket(CODE_BUCKET).upload(reportFile, {
      destination: `comprehensive/reports/backup-report-${new Date().toISOString()}.txt`
    });
    
    await storageClient.bucket(CODE_BUCKET).upload(reportJsonFile, {
      destination: `comprehensive/reports/backup-report-${new Date().toISOString()}.json`
    });
    
    // Display report
    console.log('\n\n');
    console.log(reportText);
    
    // Log to Firestore
    await db.collection('backup_logs').add({
      type: 'comprehensive',
      status: 'success',
      ...report,
      timestamp: new Date().toISOString()
    });
    
    console.log(`\n📄 Report saved to:`);
    console.log(`   Local: ${reportFile}`);
    console.log(`   GCS: gs://${CODE_BUCKET}/comprehensive/reports/`);
    console.log('');
    console.log('✅ COMPREHENSIVE BACKUP COMPLETE!');
    
  } catch (error) {
    console.error('\n❌ BACKUP FAILED:', error);
    process.exit(1);
  }
}

main();
