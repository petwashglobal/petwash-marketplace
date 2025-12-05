import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import * as enterpriseSchema from "@shared/schema-enterprise";
import * as unifiedPlatformSchema from "@shared/schema-unified-platform";

neonConfig.webSocketConstructor = ws;

// CRITICAL: Graceful handling for missing DATABASE_URL
// Don't crash startup - log warning and allow server to start in degraded mode
if (!process.env.DATABASE_URL) {
  console.error('--------------------------------------------------');
  console.error('⚠️ WARNING: DATABASE_URL is not set!');
  console.error('   Database features will be unavailable.');
  console.error('   Set DATABASE_URL in Replit Secrets for full functionality.');
  console.error('--------------------------------------------------');
}

const combinedSchema = { 
  ...schema, 
  ...enterpriseSchema,
  ...unifiedPlatformSchema.unifiedPlatformSchemas
};

// --- DATABASE "AUTO-HEAL" PATTERN (2025 Production Standard) ---

// Create pool with connection resilience settings - only if DATABASE_URL exists
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum connections
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 10000, // 10 seconds (increased for cloud environments)
  });

  // The "Auto-Heal" Listener - Prevents pool errors from crashing server
  pool.on('error', (err, client) => {
    console.error('--------------------------------------------------');
    console.error('❌ Unexpected error on idle database client:', err);
    console.error('   Client:', client ? 'exists' : 'null');
    console.error('   Time:', new Date().toISOString());
    console.error('--------------------------------------------------');
  });

  db = drizzle({ client: pool, schema: combinedSchema });
  console.log('[Database] Pool initialized with auto-heal error handling');
} else {
  console.log('[Database] Running without database connection');
}

export { pool, db };