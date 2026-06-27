import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import * as enterpriseSchema from "@shared/schema-enterprise";
import * as unifiedPlatformSchema from "@shared/schema-unified-platform";
import * as paymentsSchema from "@shared/schema-payments";
import * as treasurySchema from "@shared/schema-treasury";
import * as waitlistSchema from "@shared/schema-waitlist";
import * as dealGateSchema from "@shared/schema-deal-gate";
import * as conversionSchema from "@shared/schema-conversion";

neonConfig.webSocketConstructor = ws;

const combinedSchema = {
  ...schema,
  ...enterpriseSchema,
  ...unifiedPlatformSchema.unifiedPlatformSchemas,
  ...paymentsSchema,
  ...treasurySchema,
  ...waitlistSchema,
  ...dealGateSchema,
  ...conversionSchema,
};

// --- DATABASE "AUTO-HEAL" PATTERN (2025 Production Standard) ---

// Flag to track if database is available
export const isDatabaseAvailable = !!process.env.DATABASE_URL;

// Log status at startup (non-crashing)
if (!isDatabaseAvailable) {
  console.warn('--------------------------------------------------');
  console.warn('⚠️ DATABASE_URL not set - database features disabled');
  console.warn('   Server will start but database operations will fail');
  console.warn('--------------------------------------------------');
}

// DIAGNOSTIC (2026-06-17): production /api/health showed db.ok:false within minutes of
// boot — the classic Neon + Cloud Run connection-exhaustion signature. On Neon you MUST
// use the POOLED endpoint (host contains "-pooler") so autoscaled instances don't blow
// past Neon's direct-connection cap. Warn loudly if DATABASE_URL is the direct host.
if (isDatabaseAvailable && process.env.DATABASE_URL && !/-pooler\./.test(process.env.DATABASE_URL)) {
  console.warn('--------------------------------------------------');
  console.warn('⚠️ DATABASE_URL does NOT look like a Neon POOLED endpoint (no "-pooler" in host).');
  console.warn('   Under Cloud Run autoscaling this exhausts Neon connections → db.ok:false.');
  console.warn('   Fix: set DATABASE_URL to the Neon pooled string (…-pooler.…neon.tech).');
  console.warn('--------------------------------------------------');
}

// Create pool with connection resilience settings
// Uses a dummy connection string if DATABASE_URL is missing to prevent TypeScript errors
// Actual usage will check isDatabaseAvailable first
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  max: 10, // Cap per-instance connections (was 20) so N Cloud Run instances stay under Neon's limit
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 10000, // 10 seconds (increased for cloud environments)
});

// The "Auto-Heal" Listener - Prevents pool errors from crashing server
pool.on('error', (err, client) => {
  // Only log if database was supposed to be available
  if (isDatabaseAvailable) {
    console.error('--------------------------------------------------');
    console.error('❌ Unexpected error on idle database client:', err);
    console.error('   Client:', client ? 'exists' : 'null');
    console.error('   Time:', new Date().toISOString());
    console.error('--------------------------------------------------');
  }
  // Do NOT exit process; the pool will try to reconnect new clients automatically
});

// Create drizzle instance
export const db = drizzle({ client: pool, schema: combinedSchema });

if (isDatabaseAvailable) {
  console.log('[Database] Pool initialized with auto-heal error handling');
}