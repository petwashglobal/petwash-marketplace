// server/index.ts - Pet Wash Platform 2025 Deployment

import path from "node:path";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import cors from "cors";

// Biometric storage already implemented and working
import { ensureBiometricStorage } from "./infra/biometricStorage";

const app = express();

// 1. Basic security hardening
app.use(helmet({
  contentSecurityPolicy: false // CSP configured separately if needed
}));

// 2. JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. CORS – allow main domains only
const allowedOrigins = [
  "https://petwash.co.il",
  "https://www.petwash.co.il",
  "https://pet-wash-il-nirhadad1.replit.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // mobile apps, curl etc
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn("[CORS] Blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

// 4. Biometric storage init (already confirmed in logs)
ensureBiometricStorage().catch((err) => {
  console.error("[BiometricStorage] Failed to init:", err);
});

// 5. Simple healthcheck for Replit and for us
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});

// 6. API routes – connect existing routers here
// Example:
// import apiRouter from "./api";
// app.use("/api", apiRouter);

// 7. Serve static frontend from dist
const distDir = path.resolve(__dirname, "..", "dist", "public");
const indexHtmlPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexHtmlPath)) {
  console.error("[Startup] dist/public/index.html not found. Did you run `npm run build`?");
}

app.use("/assets", express.static(path.join(distDir, "assets"), {
  maxAge: "7d",
  immutable: true
}));

app.use(express.static(distDir));

// 8. Catch-all route – return index.html for SPA routes
app.get("*", (_req, res, next) => {
  fs.readFile(indexHtmlPath, "utf8", (err, html) => {
    if (err) {
      console.error("[Startup] Failed to read index.html:", err);
      return next(err);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
});

// 9. Error handler – so we do not get silent white screen
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Express Error]", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? String(err) : "Unexpected error"
  });
});

// 10. Start server
const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  console.log(`[Server] Listening on port ${port} in ${process.env.NODE_ENV || "development"} mode`);
});

export default app;
