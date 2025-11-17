import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import * as enterpriseSchema from "@shared/schema-enterprise";
import * as unifiedPlatformSchema from "@shared/schema-unified-platform";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const combinedSchema = { 
  ...schema, 
  ...enterpriseSchema,
  ...unifiedPlatformSchema.unifiedPlatformSchemas
};

// --- DATABASE "AUTO-HEAL" PATTERN (2025 Production Standard) ---

// Create pool with connection resilience settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Neon serverless uses WebSocket, so traditional pool settings don't fully apply
  // But we can still configure timeouts and limits
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
  // Do NOT exit process; the pool will try to reconnect new clients automatically
  // In production, you might want to send this to a monitoring service
});

// Pool connect success logging (helpful for debugging)
console.log('[Database] Pool initialized with auto-heal error handling');

export const db = drizzle({ client: pool, schema: combinedSchema });