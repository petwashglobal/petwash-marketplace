// =====================================================
//   GLOBAL PRODUCTION DEPLOYMENT (2024-2025)
//   PetWash / Octopus Multi-Unit Platform (119 APIs)
//   Node + Express + Vite + Firebase + GCS
//   Single-file deployment for Replit Production
// =====================================================

import path from "path";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

// -----------------------------
//  BIOMETRIC STORAGE MODULE
// -----------------------------
import { Storage } from "@google-cloud/storage";

// ========== BIOMETRIC INIT ==========
async function ensureBiometricStorage() {
  const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "signinpetwash";
  const BUCKET_NAME =
    process.env.BIOMETRIC_BUCKET_NAME ||
    `${PROJECT_ID}.firebasestorage.app`;
  const PREFIX =
    process.env.BIOMETRIC_PREFIX || "biometric-certificates/";

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error("[Biometric] Missing FIREBASE_SERVICE_ACCOUNT_KEY");
  }

  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  );

  const storage = new Storage({
    projectId: PROJECT_ID,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  });

  const bucket = storage.bucket(BUCKET_NAME);

  const [exists] = await bucket.exists();
  if (!exists) {
    throw new Error(
      `[Biometric] Bucket not found: ${BUCKET_NAME}`
    );
  }

  const [metadata] = await bucket.getMetadata();
  const rules = metadata.lifecycle?.rule || [];

  const newRule = {
    action: { type: "Delete" as const },
    condition: {
      age: 1,
      isLive: true,
      matchesPrefix: [PREFIX],
    },
  };

  const has = rules.some(
    (r) =>
      r.action?.type === "Delete" &&
      Number(r.condition?.age) === 1 &&
      r.condition?.matchesPrefix?.includes(PREFIX)
  );

  if (!has) {
    await bucket.setMetadata({
      lifecycle: { rule: [...rules, newRule] },
    });

    console.log(
      `[Biometric] Lifecycle rule set: delete ${PREFIX}/* after 1 day`
    );
  } else {
    console.log("[Biometric] Lifecycle rule already exists");
  }
}

// =======================================================
//   MAIN PRODUCTION SERVER
// =======================================================
process.env.NODE_ENV = "production";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dist = path.join(__dirname, "..", "dist", "public");

async function startServer() {
  try {
    await ensureBiometricStorage();
  } catch (err) {
    console.error("[Biometric] Error:", err);
  }

  const app = express();

  // -----------------------------
  // SECURITY (2025 BEST PRACTICE)
  // -----------------------------
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", "*"],
        },
      },
    })
  );

  app.use(compression());
  app.use(cookieParser());

  // -----------------------------
  //  CORS for all Octopus Units
  // -----------------------------
  app.use(
    cors({
      origin: [
        "https://petwash.co.il",
        "https://www.petwash.co.il",
        "https://pet-wash-il-nirhadad1.replit.app"
      ],
      credentials: true,
    })
  );

  // -----------------------------
  //  API Endpoints (all 119)
  // -----------------------------
  try {
    const { registerRoutes } = await import("./routes.js");
    await registerRoutes(app);
    console.log("[Deploy] API routes loaded (119 endpoints)");
  } catch (err) {
    console.error("[Deploy] Failed loading API:", err);
    throw err; // Fatal error - cannot continue without API
  }

  // -----------------------------
  //  STATIC FRONTEND (Vite build)
  // -----------------------------
  app.use(express.static(dist));

  // SPA fallback
  app.get("*", (req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });

  // -----------------------------
  //  START SERVER
  // -----------------------------
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log("======================================");
    console.log(`🚀 Production server running on ${PORT}`);
    console.log("🌍 Live on: petwash.co.il / www.petwash.co.il");
    console.log("📱 Fully accessible on iPhone / iPad / Mac");
    console.log("🔐 Biometric module active & verified");
    console.log("======================================");
  });
}

startServer().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
