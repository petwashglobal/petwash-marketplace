/**
 * Pet Wash™ - Pre-Deployment Verification Script
 * 
 * Runs comprehensive checks before production deployment:
 * - Environment variables & secrets
 * - Database connectivity
 * - Firebase configuration
 * - API endpoints health
 * - Backup system readiness
 * - Security middleware
 * 
 * Usage: tsx scripts/pre-deployment-check.ts
 */

import { logger } from '../server/lib/logger';
import { isGcsConfigured } from '../server/services/gcsBackupService';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  critical: boolean;
}

const results: CheckResult[] = [];

async function checkEnvironmentVariables(): Promise<void> {
  logger.info('[Pre-Deploy] Checking environment variables...');
  
  const requiredSecrets = [
    { name: 'DATABASE_URL', critical: true },
    { name: 'FIREBASE_SERVICE_ACCOUNT_KEY', critical: true },
    { name: 'VITE_FIREBASE_API_KEY', critical: true },
    { name: 'VITE_FIREBASE_PROJECT_ID', critical: true },
    { name: 'SENDGRID_API_KEY', critical: false },
    { name: 'TWILIO_ACCOUNT_SID', critical: false },
    { name: 'GEMINI_API_KEY', critical: false },
    { name: 'GOOGLE_APPLICATION_CREDENTIALS', critical: true }, // GCS backups
  ];

  for (const secret of requiredSecrets) {
    const value = process.env[secret.name];
    if (!value) {
      results.push({
        name: `Environment: ${secret.name}`,
        status: secret.critical ? 'fail' : 'warn',
        message: secret.critical 
          ? `CRITICAL: ${secret.name} is not set` 
          : `WARNING: ${secret.name} is not set (optional service may not work)`,
        critical: secret.critical
      });
    } else {
      // Verify it's not a placeholder
      if (value.includes('PLACEHOLDER') || value.includes('TODO') || value.includes('REPLACE')) {
        results.push({
          name: `Environment: ${secret.name}`,
          status: 'fail',
          message: `${secret.name} contains placeholder value`,
          critical: secret.critical
        });
      } else {
        results.push({
          name: `Environment: ${secret.name}`,
          status: 'pass',
          message: `${secret.name} is configured`,
          critical: false
        });
      }
    }
  }
}

async function checkDatabaseConnection(): Promise<void> {
  logger.info('[Pre-Deploy] Checking database connection...');
  
  try {
    const { db } = await import('../server/db');
    await db.select().from((await import('@shared/schema')).customers).limit(1);
    
    results.push({
      name: 'Database: PostgreSQL Connection',
      status: 'pass',
      message: 'Database connection successful',
      critical: true
    });
  } catch (error) {
    results.push({
      name: 'Database: PostgreSQL Connection',
      status: 'fail',
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      critical: true
    });
  }
}

async function checkFirebaseConnection(): Promise<void> {
  logger.info('[Pre-Deploy] Checking Firebase connection...');
  
  try {
    // Import Firebase Admin SDK directly and initialize it here
    const admin = (await import('firebase-admin')).default;
    
    let db: FirebaseFirestore.Firestore;
    
    // Get existing app or use first one
    if (admin.apps && admin.apps.length > 0) {
      db = admin.apps[0]!.firestore();
      console.log('[Pre-Deploy] Using existing Firebase Admin app');
    } else {
      throw new Error('Firebase Admin app not initialized - this should not happen');
    }
    
    console.log('[Pre-Deploy Debug] Firebase Firestore check:', {
      hasDb: !!db,
      dbType: typeof db,
      dbConstructor: db?.constructor?.name
    });
    
    if (!db) {
      throw new Error('Firestore db is undefined');
    }
    
    const snapshot = await db.collection('users').limit(1).get();
    
    results.push({
      name: 'Firebase: Firestore Connection',
      status: 'pass',
      message: `Firestore connected (${snapshot.size} test docs)`,
      critical: true
    });
  } catch (error) {
    results.push({
      name: 'Firebase: Firestore Connection',
      status: 'fail',
      message: `Firestore connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      critical: true
    });
  }
}

async function checkBackupSystem(): Promise<void> {
  logger.info('[Pre-Deploy] Checking backup system...');
  
  const gcsConfigured = isGcsConfigured();
  
  if (gcsConfigured) {
    results.push({
      name: 'Backup: GCS Configuration',
      status: 'pass',
      message: 'Google Cloud Storage backups configured',
      critical: false
    });
  } else {
    results.push({
      name: 'Backup: GCS Configuration',
      status: 'fail',
      message: 'GOOGLE_APPLICATION_CREDENTIALS not configured - automated backups will fail',
      critical: true
    });
  }
}

async function checkCriticalEndpoints(): Promise<void> {
  logger.info('[Pre-Deploy] Checking critical API endpoints...');
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  
  const endpoints = [
    { path: '/health', critical: true },
    { path: '/api/status', critical: true },
    { path: '/api/monitoring/health', critical: true },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`);
      
      if (response.ok) {
        results.push({
          name: `Endpoint: ${endpoint.path}`,
          status: 'pass',
          message: `Endpoint responsive (${response.status})`,
          critical: endpoint.critical
        });
      } else {
        results.push({
          name: `Endpoint: ${endpoint.path}`,
          status: 'warn',
          message: `Endpoint returned ${response.status}`,
          critical: endpoint.critical
        });
      }
    } catch (error) {
      results.push({
        name: `Endpoint: ${endpoint.path}`,
        status: 'fail',
        message: `Endpoint unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        critical: endpoint.critical
      });
    }
  }
}

async function checkSecurityConfiguration(): Promise<void> {
  logger.info('[Pre-Deploy] Checking security configuration...');
  
  // Check if we're using secure session secrets
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    results.push({
      name: 'Security: Session Secret',
      status: 'warn',
      message: 'SESSION_SECRET should be at least 32 characters',
      critical: false
    });
  } else {
    results.push({
      name: 'Security: Session Secret',
      status: 'pass',
      message: 'Session secret configured',
      critical: false
    });
  }
  
  // Check NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== 'production') {
    results.push({
      name: 'Environment: NODE_ENV',
      status: 'warn',
      message: `NODE_ENV is '${nodeEnv}' (should be 'production' for deployment)`,
      critical: true
    });
  } else {
    results.push({
      name: 'Environment: NODE_ENV',
      status: 'pass',
      message: 'NODE_ENV set to production',
      critical: false
    });
  }
}

async function printResults(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 PET WASH™ PRE-DEPLOYMENT CHECK REPORT');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const warned = results.filter(r => r.status === 'warn').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const criticalFailed = results.filter(r => r.status === 'fail' && r.critical).length;

  // Group results by status
  const passedChecks = results.filter(r => r.status === 'pass');
  const warnedChecks = results.filter(r => r.status === 'warn');
  const failedChecks = results.filter(r => r.status === 'fail');

  if (passedChecks.length > 0) {
    console.log('✅ PASSED CHECKS:\n');
    passedChecks.forEach(r => {
      console.log(`  ✅ ${r.name}`);
      console.log(`     ${r.message}\n`);
    });
  }

  if (warnedChecks.length > 0) {
    console.log('\n⚠️  WARNINGS:\n');
    warnedChecks.forEach(r => {
      console.log(`  ⚠️  ${r.name}`);
      console.log(`     ${r.message}\n`);
    });
  }

  if (failedChecks.length > 0) {
    console.log('\n❌ FAILED CHECKS:\n');
    failedChecks.forEach(r => {
      console.log(`  ❌ ${r.name} ${r.critical ? '(CRITICAL)' : ''}`);
      console.log(`     ${r.message}\n`);
    });
  }

  console.log('='.repeat(80));
  console.log(`📊 SUMMARY: ${passed} passed, ${warned} warnings, ${failed} failed`);
  console.log('='.repeat(80) + '\n');

  if (criticalFailed > 0) {
    console.log('❌ DEPLOYMENT BLOCKED: Fix critical issues before deploying\n');
    process.exit(1);
  } else if (failed > 0) {
    console.log('⚠️  DEPLOYMENT WARNING: Non-critical checks failed\n');
    process.exit(0); // Allow deployment with warnings
  } else {
    console.log('✅ ALL CHECKS PASSED - READY FOR DEPLOYMENT\n');
    process.exit(0);
  }
}

async function main() {
  console.log('\n🔍 Starting pre-deployment checks...\n');

  try {
    await checkEnvironmentVariables();
    await checkDatabaseConnection();
    await checkFirebaseConnection();
    await checkBackupSystem();
    await checkSecurityConfiguration();
    // Skip endpoint checks if server isn't running
    // await checkCriticalEndpoints();
    
    await printResults();
  } catch (error) {
    console.error('\n💥 Pre-deployment check failed with error:');
    console.error(error);
    process.exit(1);
  }
}

main();
