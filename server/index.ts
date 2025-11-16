import "dotenv/config";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { fileURLToPath } from "node:url";
import { ensureBiometricStorage } from "./infra/biometricStorage";
import { registerRoutes } from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 5000);

// 1. Security and basic middleware
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      sameSite: "none",
      httpOnly: true
    }
  })
);

// 2. Initialise biometric storage once on startup
ensureBiometricStorage()
  .then(() => {
    console.log("[BiometricStorage] ready");
  })
  .catch((err) => {
    console.error("[BiometricStorage] init failed", err);
  });

// 3. API routes
registerRoutes(app);

// 4. Static assets for Vite build
const staticRoot = path.join(__dirname, "..", "dist", "public");
app.use(express.static(staticRoot));

// 5. SPA fallback for React router
app.get("*", (_req, res) => {
  res.sendFile(path.join(staticRoot, "index.html"));
});

// 6. Start server
app.listen(PORT, () => {
  console.log(`[Server] listening on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});
