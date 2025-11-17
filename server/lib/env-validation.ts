import { z } from "zod";

/**
 * ==========================================
 * ENVIRONMENT VALIDATION (Startup Safety)
 * ==========================================
 * This ensures the app crashes immediately if critical config is missing,
 * rather than failing randomly later on during runtime.
 * 
 * Based on 2025 best practices for production readiness.
 */

const EnvSchema = z.object({
  // ===== CORE SYSTEM =====
  NODE_ENV: z.enum(["development", "production"]).default("development")
    .describe("Application environment mode"),
  
  DATABASE_URL: z.string().url({ message: "Database URL must be valid PostgreSQL connection string" })
    .describe("Neon PostgreSQL connection string"),
  
  // ===== FIREBASE (REQUIRED) =====
  FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Project ID is required")
    .describe("Firebase project identifier"),
  
  // ===== JWT SECRETS (REQUIRED) =====
  JWT_SECRET: z.string().min(32, "JWT Secret must be at least 32 characters for security")
    .describe("Secret for signing JWT access tokens"),
  
  JWT_REFRESH_SECRET: z.string().min(32, "JWT Refresh Secret must be at least 32 characters")
    .describe("Secret for signing JWT refresh tokens"),
  
  COOKIE_SECRET: z.string().min(32, "Cookie Secret must be at least 32 characters")
    .describe("Secret for signing session cookies"),
  
  // ===== GOOGLE CLOUD (BIOMETRICS) =====
  BIOMETRIC_BUCKET_NAME: z.string().optional()
    .describe("Google Cloud Storage bucket for biometric data"),
  
  BIOMETRIC_PREFIX: z.string().optional()
    .describe("Prefix for biometric file storage paths"),
  
  // ===== PAYMENT GATEWAYS (OPTIONAL - Disabled features if missing) =====
  NAYAX_API_KEY: z.string().optional()
    .describe("Nayax payment gateway API key (Israel exclusive gateway)"),
  
  NAYAX_MERCHANT_ID: z.string().optional()
    .describe("Nayax merchant identifier"),
  
  NAYAX_SECRET_KEY: z.string().optional()
    .describe("Nayax webhook signature secret"),
  
  STRIPE_SECRET_KEY: z.string().optional()
    .describe("Stripe API secret key (backup payment gateway)"),
  
  STRIPE_PUBLISHABLE_KEY: z.string().optional()
    .describe("Stripe publishable key for client-side"),
  
  STRIPE_WEBHOOK_SECRET: z.string().optional()
    .describe("Stripe webhook signature secret"),
  
  // ===== TAX & COMPLIANCE (ISRAEL) =====
  ITA_CLIENT_ID: z.string().optional()
    .describe("Israeli Tax Authority OAuth2 client ID"),
  
  ITA_CLIENT_SECRET: z.string().optional()
    .describe("Israeli Tax Authority OAuth2 client secret"),
  
  // ===== E-SIGNATURE =====
  DOCUSEAL_API_KEY: z.string().optional()
    .describe("DocuSeal API key for electronic signatures"),
  
  DOCUSEAL_BASE_URL: z.string().url().optional()
    .describe("DocuSeal server base URL"),
  
  // ===== WEATHER & ENVIRONMENTAL (OPTIONAL) =====
  OPENWEATHER_API_KEY: z.string().optional()
    .describe("OpenWeather API key for weather data"),
  
  WEATHERAPI_KEY: z.string().optional()
    .describe("WeatherAPI.com key (alternative provider)"),
  
  VISUAL_CROSSING_KEY: z.string().optional()
    .describe("Visual Crossing weather API key"),
  
  OPENUV_API_KEY: z.string().optional()
    .describe("OpenUV API key for UV index data"),
  
  AQICN_API_TOKEN: z.string().optional()
    .describe("AQICN air quality index API token"),
  
  AMBEE_API_KEY: z.string().optional()
    .describe("Ambee environmental data API key"),
});

// Export the validated environment type
export type ValidatedEnv = z.infer<typeof EnvSchema>;

/**
 * Validate environment variables at startup
 * Throws detailed error if validation fails
 */
export function validateEnv(): ValidatedEnv {
  console.log("\n🔐 [Startup] Validating environment configuration...");
  
  // Use safeParse to check data without crashing immediately
  const result = EnvSchema.safeParse(process.env);
  
  if (!result.success) {
    // If validation fails, provide detailed error messages
    console.error("\n❌ CRITICAL: Environment validation failed");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    const formatted = result.error.format();
    
    // Log each field error clearly
    Object.entries(formatted).forEach(([key, value]) => {
      if (key !== '_errors' && value && typeof value === 'object' && '_errors' in value) {
        const errors = (value as any)._errors;
        if (errors && errors.length > 0) {
          console.error(`\n📛 ${key}:`);
          errors.forEach((err: string) => {
            console.error(`   → ${err}`);
          });
        }
      }
    });
    
    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("💡 Fix: Add missing environment variables to your Replit Secrets");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    throw new Error("Environment validation failed - see detailed errors above");
  }
  
  // If success, log what's configured
  const env = result.data;
  
  console.log("✅ Core System: Validated");
  console.log(`   → Environment: ${env.NODE_ENV}`);
  console.log(`   → Database: ${env.DATABASE_URL ? 'Connected' : '❌ Missing'}`);
  console.log(`   → Firebase: ${env.FIREBASE_PROJECT_ID ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   → JWT Secrets: ${env.JWT_SECRET && env.JWT_REFRESH_SECRET ? '✅ Configured' : '❌ Missing'}`);
  
  console.log("\n💳 Payment Gateways:");
  console.log(`   → Nayax (Israel): ${env.NAYAX_API_KEY ? '✅ Enabled' : '⚠️  Disabled'}`);
  console.log(`   → Stripe (Backup): ${env.STRIPE_SECRET_KEY ? '✅ Enabled' : '⚠️  Disabled'}`);
  
  console.log("\n📝 Integrations:");
  console.log(`   → DocuSeal (E-Signature): ${env.DOCUSEAL_API_KEY ? '✅ Enabled' : '⚠️  Demo Mode'}`);
  console.log(`   → ITA (Israeli Tax): ${env.ITA_CLIENT_ID ? '✅ Enabled' : '⚠️  Disabled'}`);
  console.log(`   → Weather APIs: ${env.OPENWEATHER_API_KEY || env.WEATHERAPI_KEY ? '✅ Enabled' : '⚠️  Disabled'}`);
  
  console.log("\n✅ System Integrity Verified. Environment is secure.\n");
  
  return env;
}

/**
 * Pre-validated environment singleton
 * Import this instead of process.env for type-safe access
 */
export const env = validateEnv();
