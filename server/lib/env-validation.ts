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
  // Note: Using VITE_ prefix to match Replit secrets configuration
  VITE_FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Project ID is required")
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
  
  // NOTE: env-validation previously used NAYAX_SECRET_KEY which is wrong.
  // All server code reads NAYAX_SECRET — this is the correct key name.
  NAYAX_SECRET: z.string().optional()
    .describe("Nayax API signing secret (used by nayaxService, nayaxFirestoreService)"),

  NAYAX_TERMINAL_SECRET: z.string().optional()
    .describe("Shared secret for Nayax-terminal → Cloud Run wallet redemption requests (fail-closed if absent)"),
  
  // ===== TAX & COMPLIANCE (ISRAEL) =====
  ITA_CLIENT_ID: z.string().optional()
    .describe("Israeli Tax Authority OAuth2 client ID"),
  
  ITA_CLIENT_SECRET: z.string().optional()
    .describe("Israeli Tax Authority OAuth2 client secret"),

  // ===== KYC / DOCUMENT SECURITY =====
  DOCUMENT_ENCRYPTION_KEY: z.string().min(32).optional()
    .describe("AES-256-GCM master key for provider KYC / biometric document encryption (min 32 chars)"),

  // ===== TREASURY FIELD ENCRYPTION =====
  // Required in production. Generate with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  // Store in GCP Secret Manager / AWS SSM — never in source code.
  // Israeli Privacy Protection Regulations (Data Security) 5777-2017, Article 9.
  TREASURY_FIELD_ENCRYPTION_KEY: z.string().min(64).optional()
    .describe("AES-256-GCM key (64 hex chars) for encrypting IBAN and account number at rest"),

  KYC_SALT: z.string().optional()
    .describe("Salt for KYC hash derivation — required for provider onboarding"),

  IP_HASH_SALT: z.string().min(16).optional()
    .describe("HMAC-SHA256 salt for IP hashing in login_security_events — required in production (min 16 chars)"),

  // ===== K9000 IoT MACHINE CONTROL =====
  MACHINE_SECRET_KEY: z.string().optional()
    .describe("HMAC secret shared with K9000 IoT controllers — must match hardware config"),

  MACHINE_ACTIVATION_URL: z.string().url().optional()
    .describe("HTTP endpoint of K9000 IoT controller — absent = DEMO MODE (machine not commanded)"),

  // ===== PRESTIGE PASS / WALLET TOKENS =====
  PASS_TOKEN_SECRET: z.string().min(32).optional()
    .describe("HMAC secret for K9000 mobile QR tokens — must be ≥ 32 chars; falls back to COOKIE_SECRET"),

  PRESTIGE_QR_SECRET: z.string().min(16).optional()
    .describe("HMAC secret for 45-second kiosk QR tokens — hard-throws in production if absent"),

  PASS_LINK_SECRET: z.string().min(16).optional()
    .describe("HMAC secret for 72-hour wallet email link tokens — falls back to PRESTIGE_QR_SECRET if absent (wrong)"),

  WALLET_LINK_SECRET: z.string().min(32).optional()
    .describe("HMAC secret for gift-card wallet pass links — falls back to COOKIE_SECRET if absent"),

  // ===== SENDGRID TEMPLATES =====
  SENDGRID_TEMPLATE_ID_MEMBER_PASS: z.string().optional()
    .describe("SendGrid dynamic template ID for Prestige Pass delivery email — blank = SendGrid 400"),

  // ===== MOBILE AUTH =====
  MOBILE_LINK_SECRET: z.string().optional()
    .describe("JWT signing secret for mobile one-tap auth links — throws if absent when route is called"),
  
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
  console.log(`   → Firebase: ${env.VITE_FIREBASE_PROJECT_ID ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   → JWT Secrets: ${env.JWT_SECRET && env.JWT_REFRESH_SECRET ? '✅ Configured' : '❌ Missing'}`);
  
  console.log("\n💳 Payment Gateway:");
  console.log(`   → Nayax API key:           ${env.NAYAX_API_KEY ? '✅ Configured' : '⚠️  MISSING — NayaxOnlinePaymentService in DEMO MODE'}`);
  console.log(`   → Nayax merchant ID:        ${env.NAYAX_MERCHANT_ID ? '✅ Configured' : '⚠️  MISSING — demo mode'}`);
  console.log(`   → Nayax signing secret:     ${env.NAYAX_SECRET ? '✅ Configured' : '⚠️  MISSING — nayaxService will CRASH in production'}`);
  console.log(`   → Nayax terminal secret:    ${env.NAYAX_TERMINAL_SECRET ? '✅ Configured' : '❌ MISSING — ALL terminal wallet redemptions BLOCKED (fail-closed)'}`);

  console.log("\n🏭 K9000 IoT:");
  console.log(`   → Machine secret key:       ${env.MACHINE_SECRET_KEY ? '✅ Configured' : '❌ MISSING — K9000 HMAC verification disabled; kiosk coupon uses fallback secret'}`);
  console.log(`   → Machine activation URL:   ${env.MACHINE_ACTIVATION_URL ? '✅ Configured' : '❌ MISSING — K9000 in DEMO MODE; machine will not start (wallet will be debited in dev)'}`);
  console.log(`   → Pass token secret:        ${env.PASS_TOKEN_SECRET ? '✅ Configured' : '❌ MISSING — K9000 QR tokens use COOKIE_SECRET fallback (ok if COOKIE_SECRET ≥ 32 chars)'}`);

  console.log("\n🎴 Prestige Pass / Wallet:");
  console.log(`   → Prestige QR secret:       ${env.PRESTIGE_QR_SECRET ? '✅ Configured' : '❌ MISSING — FATAL in production (throws on startup)'}`);
  console.log(`   → Pass link secret:         ${env.PASS_LINK_SECRET ? '✅ Configured' : '⚠️  MISSING — wallet email links fall back to PRESTIGE_QR_SECRET (wrong key type)'}`);
  console.log(`   → Wallet link secret:       ${env.WALLET_LINK_SECRET ? '✅ Configured' : '⚠️  MISSING — wallet pass links fall back to COOKIE_SECRET'}`);
  console.log(`   → SendGrid pass template:   ${env.SENDGRID_TEMPLATE_ID_MEMBER_PASS ? '✅ Configured' : '⚠️  MISSING — pass delivery email has blank templateId (SendGrid 400)'}`);

  console.log("\n🔐 Provider KYC / Docs:");
  console.log(`   → Document encryption key:  ${env.DOCUMENT_ENCRYPTION_KEY ? '✅ Configured' : '❌ MISSING — provider KYC documents stored UNENCRYPTED in GCS'}`);
  console.log(`   → KYC salt:                 ${env.KYC_SALT ? '✅ Configured' : '❌ MISSING — KYC hash derivation throws at runtime'}`);
  console.log(`   → IP hash salt:             ${env.IP_HASH_SALT ? '✅ Configured' : '❌ MISSING — login IP hashes use dev-only placeholder (FATAL in production)'}`);

  console.log("\n🏦 Treasury / Finance:");
  console.log(`   → Treasury encryption key:  ${env.TREASURY_FIELD_ENCRYPTION_KEY ? '✅ Configured' : '❌ MISSING — IBAN/account stored UNENCRYPTED in production (FATAL)'}`);

  console.log("\n📱 Mobile Auth:");
  console.log(`   → Mobile link secret:       ${env.MOBILE_LINK_SECRET ? '✅ Configured' : '❌ MISSING — mobile one-tap link generation throws when called'}`);

  console.log("\n📝 Integrations:");
  console.log(`   → DocuSeal (E-Signature): ${env.DOCUSEAL_API_KEY ? '✅ Enabled' : '⚠️  Demo Mode'}`);
  console.log(`   → ITA (Israeli Tax): ${env.ITA_CLIENT_ID ? '✅ Enabled' : '⚠️  Disabled'}`);
  console.log(`   → Weather APIs: ${env.OPENWEATHER_API_KEY || env.WEATHERAPI_KEY ? '✅ Enabled' : '⚠️  Disabled'}`);
  
  // ── Production hard-stop for biometric document encryption ─────────────────
  // DOCUMENT_ENCRYPTION_KEY is optional in the schema so we can start the server
  // in dev/staging without it.  In production we MUST have it — without it, provider
  // KYC document uploads throw at runtime (encryptBiometricBuffer throws).
  // Fail fast here instead of surfacing a crash only on the first upload attempt.
  if (env.NODE_ENV === 'production' && !env.DOCUMENT_ENCRYPTION_KEY) {
    console.error('\n❌ FATAL: DOCUMENT_ENCRYPTION_KEY is not set in production.');
    console.error('   Provider KYC document uploads will throw and all provider');
    console.error('   onboarding will be BLOCKED until this secret is added.');
    console.error('   → Set it in GCP Secret Manager and bind to the Cloud Run revision.');
    console.error('   → Minimum length: 32 characters (AES-256-GCM key).\n');
    throw new Error(
      '[env-validation] DOCUMENT_ENCRYPTION_KEY is required in production. ' +
      'Add it to GCP Secret Manager and redeploy.'
    );
  }

  // ── Production hard-stop for treasury field encryption ───────────────────────
  // TREASURY_FIELD_ENCRYPTION_KEY is required in production to encrypt IBAN and
  // account number at rest (Israeli Privacy Protection Regulations 5777-2017, Art. 9).
  // Without it, secretFieldCrypto throws on the first seedFromEnv() call.
  // We fail fast here rather than at runtime.
  if (env.NODE_ENV === 'production' && !env.TREASURY_FIELD_ENCRYPTION_KEY) {
    console.error('\n❌ FATAL: TREASURY_FIELD_ENCRYPTION_KEY is not set in production.');
    console.error('   Treasury IBAN and account number will not be encrypted at rest.');
    console.error('   All provider payouts will be BLOCKED until this secret is added.');
    console.error('   → Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('   → Set it in GCP Secret Manager and bind to the Cloud Run revision.\n');
    throw new Error(
      '[env-validation] TREASURY_FIELD_ENCRYPTION_KEY is required in production. ' +
      'Add a 64-hex-char key to GCP Secret Manager and redeploy.'
    );
  }

  // ── Production hard-stop for IP hash salt ────────────────────────────────────
  // IP_HASH_SALT is used in AuthEventService to HMAC-hash raw IPs before storage.
  // Without it, login IP hashes fall back to a dev-only placeholder — any attacker
  // who reads the source code could compute the same HMAC and reverse-lookup IPs.
  if (env.NODE_ENV === 'production' && !env.IP_HASH_SALT) {
    console.error('\n❌ FATAL: IP_HASH_SALT is not set in production.');
    console.error('   Login IP hashes in login_security_events would use a known dev placeholder,');
    console.error('   making HMAC protection effectively useless (attacker can reverse IPs).');
    console.error('   → Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('   → Set it in GCP Secret Manager and bind to the Cloud Run revision.\n');
    throw new Error(
      '[env-validation] IP_HASH_SALT is required in production. ' +
      'Add a 64-hex-char value to GCP Secret Manager and redeploy.'
    );
  }

  // ── Production hard-stop for K9000 QR token signing ─────────────────────────  // PASS_TOKEN_SECRET (or COOKIE_SECRET fallback) powers the HMAC-signed 45-second
  // QR tokens used by the K9000 mobile redeem flow.  Without it every QR scan
  // returns MISSING_SECRET and the machine will not start.
  const passTokenSecret = env.PASS_TOKEN_SECRET ?? env.COOKIE_SECRET ?? '';
  if (env.NODE_ENV === 'production' && passTokenSecret.length < 32) {
    console.error('\n❌ FATAL: PASS_TOKEN_SECRET is not set (or < 32 chars) in production.');
    console.error('   K9000 mobile QR generation will return MISSING_SECRET for every user.');
    console.error('   → Set PASS_TOKEN_SECRET in GCP Secret Manager (≥ 32 random chars).\n');
    throw new Error(
      '[env-validation] PASS_TOKEN_SECRET is required in production for K9000 QR tokens.'
    );
  }

  console.log("\n✅ System Integrity Verified. Environment is secure.\n");
  
  return env;
}

/**
 * Pre-validated environment singleton
 * Import this instead of process.env for type-safe access
 */
export const env = validateEnv();
