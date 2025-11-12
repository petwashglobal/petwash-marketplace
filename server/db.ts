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

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema: combinedSchema });