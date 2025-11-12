#!/usr/bin/env tsx
/**
 * Environment Variable Sanity Check
 * Verifies presence of required secrets WITHOUT logging their values
 * Run at server startup to catch missing credentials early
 */

interface EnvCheck {
  key: string;
  required: boolean;
  category: string;
}

const ENV_CHECKS: EnvCheck[] = [
  // Core Infrastructure
  { key: 'DATABASE_URL', required: true, category: 'Database' },
  { key: 'SESSION_SECRET', required: true, category: 'Security' },
  
  // Firebase
  { key: 'FIREBASE_SERVICE_ACCOUNT_KEY', required: true, category: 'Firebase' },
  { key: 'VITE_FIREBASE_API_KEY', required: true, category: 'Firebase' },
  { key: 'VITE_FIREBASE_APP_ID', required: true, category: 'Firebase' },
  
  // Monitoring
  { key: 'SENTRY_DSN', required: true, category: 'Monitoring' },
  { key: 'ALERTS_SLACK_WEBHOOK', required: true, category: 'Monitoring' },
  { key: 'METRICS_AUTH_TOKEN', required: true, category: 'Monitoring' },
  
  // Email & SMS
  { key: 'SENDGRID_API_KEY', required: true, category: 'Email' },
  { key: 'TWILIO_ACCOUNT_SID', required: false, category: 'SMS' },
  { key: 'TWILIO_AUTH_TOKEN', required: false, category: 'SMS' },
  
  // OAuth Providers
  { key: 'TIKTOK_CLIENT_KEY', required: false, category: 'OAuth' },
  { key: 'TIKTOK_CLIENT_SECRET', required: false, category: 'OAuth' },
  { key: 'FACEBOOK_APP_ID', required: false, category: 'OAuth' },
  { key: 'FACEBOOK_APP_SECRET', required: false, category: 'OAuth' },
  { key: 'INSTAGRAM_CLIENT_ID', required: false, category: 'OAuth' },
  { key: 'INSTAGRAM_CLIENT_SECRET', required: false, category: 'OAuth' },
  
  // Payment & Business
  { key: 'NAYAX_API_KEY', required: false, category: 'Payments' },
  { key: 'HUBSPOT_PORTAL_ID', required: false, category: 'CRM' },
];

function checkEnvironment() {
  console.log('\n🔍 Environment Variable Sanity Check\n');
  console.log('═'.repeat(60));
  
  const results = {
    present: [] as string[],
    missing: {
      required: [] as string[],
      optional: [] as string[],
    },
    byCategory: {} as Record<string, { present: number; total: number }>,
  };
  
  // Check each variable
  for (const check of ENV_CHECKS) {
    const value = process.env[check.key];
    const isPresent = !!value && value.trim().length > 0;
    
    // Track by category
    if (!results.byCategory[check.category]) {
      results.byCategory[check.category] = { present: 0, total: 0 };
    }
    results.byCategory[check.category].total++;
    
    if (isPresent) {
      results.present.push(check.key);
      results.byCategory[check.category].present++;
    } else {
      if (check.required) {
        results.missing.required.push(check.key);
      } else {
        results.missing.optional.push(check.key);
      }
    }
  }
  
  // Report by category
  console.log('\n📊 Status by Category:\n');
  Object.entries(results.byCategory).forEach(([category, stats]) => {
    const percentage = Math.round((stats.present / stats.total) * 100);
    const icon = stats.present === stats.total ? '✅' : stats.present > 0 ? '⚠️' : '❌';
    console.log(`${icon} ${category.padEnd(15)} ${stats.present}/${stats.total} (${percentage}%)`);
  });
  
  // Missing required variables (CRITICAL)
  if (results.missing.required.length > 0) {
    console.log('\n❌ CRITICAL: Missing Required Secrets:\n');
    results.missing.required.forEach(key => {
      console.log(`   • ${key}`);
    });
    console.log('\n⚠️  Server may fail to start or experience errors!\n');
  }
  
  // Missing optional variables (WARNING)
  if (results.missing.optional.length > 0) {
    console.log('\n⚠️  Optional Features Disabled (missing secrets):\n');
    results.missing.optional.forEach(key => {
      console.log(`   • ${key}`);
    });
  }
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  const totalPresent = results.present.length;
  const totalChecked = ENV_CHECKS.length;
  const percentage = Math.round((totalPresent / totalChecked) * 100);
  
  if (results.missing.required.length === 0) {
    console.log(`✅ All required secrets present (${totalPresent}/${totalChecked} total, ${percentage}%)`);
  } else {
    console.log(`❌ Missing ${results.missing.required.length} required secret(s)`);
    process.exit(1); // Exit with error if required secrets missing
  }
  
  console.log('═'.repeat(60) + '\n');
}

// Run check
checkEnvironment();

export {};
