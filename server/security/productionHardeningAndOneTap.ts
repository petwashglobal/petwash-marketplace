/**
 * 🔒 PRODUCTION HARDENING + SECURE ONE-TAP MOBILE OPS LOGIN
 *
 * WHAT THIS DOES:
 *  1. Blocks 4 unsafe debug/test endpoints in production (404)
 *  2. Protects same endpoints with admin auth in development
 *  3. Provides secure one-tap login links for mobile ops staff
 *
 * FEATURES:
 *  - HMAC-signed tokens with 10-minute expiry
 *  - Firebase custom token auto-login flow
 *  - Session cookie creation via existing /api/auth/session
 *  - Admin-only link generation endpoint
 */

import type { Express, Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import type * as firebaseAdmin from "firebase-admin";
import { logger } from "../lib/logger";

type Ctx = {
  app: Express;
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
  admin: typeof firebaseAdmin;
};

const SENSITIVE_PATHS = [
  "/api/auth/firebase-admin-test",         // exposes Admin SDK internals
  "/api/auth/session/test",                // exposes cookie config
  "/api/test-purchase",                    // can create fake tx
  "/api/test/send-tax-report-and-backup",  // triggers heavy jobs
];

const IS_PROD = process.env.NODE_ENV === "production";
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/, "");
const MOBILE_LINK_SECRET = process.env.MOBILE_LINK_SECRET || "";
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || "";
const FIREBASE_AUTH_DOMAIN = process.env.VITE_FIREBASE_AUTH_DOMAIN || "";
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || "";

/* ------------------------ helpers: HMAC-signed token ------------------------ */

function signOneTapToken(payload: object, ttlSec = 600): string {
  if (!MOBILE_LINK_SECRET) throw new Error("MOBILE_LINK_SECRET not set");
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSec, v: 1 };
  const json = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = crypto.createHmac("sha256", MOBILE_LINK_SECRET).update(json).digest("base64url");
  return `${json}.${sig}`;
}

function verifyOneTapToken(token: string): any {
  if (!MOBILE_LINK_SECRET) throw new Error("MOBILE_LINK_SECRET not set");
  const [json, sig] = token.split(".");
  if (!json || !sig) throw new Error("Bad token");
  const check = crypto.createHmac("sha256", MOBILE_LINK_SECRET).update(json).digest("base64url");
  if (check !== sig) throw new Error("Signature mismatch");
  const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) throw new Error("Token expired");
  return payload;
}

/* --------------------- HTML: auto-sign with custom token flow ----------------- */
/**
 * Returns a tiny HTML/JS page that:
 *   1) Loads Firebase (modular v9 CDN)
 *   2) Uses a server-minted custom token to sign in
 *   3) Pulls an ID token and POSTs to /api/auth/session to set the httpOnly cookie
 *   4) Redirects to /m (mobile ops hub)
 *
 * No app code changes required on the client.
 */
function autoSignHtml(opts: { customToken: string; redirect?: string }) {
  const redirect = opts.redirect || "/m";
  const apiKey = FIREBASE_API_KEY;
  const authDomain = FIREBASE_AUTH_DOMAIN;
  const projectId = FIREBASE_PROJECT_ID;

  if (!apiKey || !authDomain || !projectId) {
    return `<!doctype html><meta charset="utf-8"><title>Pet Wash – One-Tap</title>
    <body style="font-family: system-ui, -apple-system; padding:24px">
      <h1>Missing Firebase Web config</h1>
      <p>Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID.</p>
    </body>`;
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Pet Wash – One-Tap Login</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,body{background:#ffffff;color:#111;margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui}
      .wrap{max-width:560px;margin:16vh auto;padding:24px}
      .card{border:1px solid #e5e7eb;border-radius:12px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.05)}
      .muted{color:#6b7280;font-size:14px}
      .spinner{width:18px;height:18px;border:2px solid #d1d5db;border-top-color:#111;border-radius:50%;display:inline-block;animation:spin .8s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}
      pre{background:#f3f4f6;padding:12px;border-radius:6px;overflow-x:auto;font-size:13px}
    </style>
    <script type="module">
      import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
      import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

      const firebaseConfig = {
        apiKey: ${JSON.stringify(apiKey)},
        authDomain: ${JSON.stringify(authDomain)},
        projectId: ${JSON.stringify(projectId)},
      };

      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);

      (async () => {
        try {
          const customToken = ${JSON.stringify(opts.customToken)};
          const cred = await signInWithCustomToken(auth, customToken);
          const idToken = await cred.user.getIdToken(true);

          const res = await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ idToken }),
          });

          if (!res.ok) {
            const txt = await res.text();
            throw new Error("Session creation failed: " + txt);
          }

          location.replace(${JSON.stringify(redirect)});
        } catch (err) {
          console.error(err);
          const el = document.getElementById("status");
          el.textContent = "One-tap login failed. Please sign in manually.";
          const pre = document.getElementById("err");
          pre.textContent = String(err?.message || err);
          document.getElementById("fallback").style.display = "block";
        }
      })();
    </script>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span class="spinner"></span>
          <strong>Signing you in securely…</strong>
        </div>
        <div id="status" class="muted">Creating a secure session for the Ops Hub</div>
        <div id="fallback" style="display:none;margin-top:16px">
          <a href="/signin" style="color:#2563eb">Go to Sign In</a>
          <pre id="err" class="muted" style="white-space:pre-wrap;margin-top:10px"></pre>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

/* --------------------- apply all changes (call this once) ------------------- */

export function applySecurityAndOneTap(ctx: Ctx) {
  const { app, requireAdmin, admin } = ctx;

  /* 1) Production hardening for unsafe debug endpoints */
  if (IS_PROD) {
    app.all(SENSITIVE_PATHS, (_req, res) => res.status(404).send("Not Found"));
    logger.info("🔒 [Security] Debug endpoints disabled in production", { paths: SENSITIVE_PATHS });
  } else {
    app.all(SENSITIVE_PATHS, (req, res, next) => requireAdmin(req, res, next));
    logger.info("🔐 [Security] Debug endpoints protected with admin auth", { paths: SENSITIVE_PATHS });
  }

  /* 2) Secure one-tap link issuer (ADMIN ONLY)
     POST /api/ops/one-tap/create
     body: { uid?: string, email?: string, redirect?: string }
     returns: { url: "https://.../ops/one-tap?token=..." }
  */
  app.post("/api/ops/one-tap/create", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (!BASE_URL) return res.status(400).json({ error: "BASE_URL not configured" });

      const { uid, email, redirect } = (req.body || {}) as { uid?: string; email?: string; redirect?: string };
      let targetUid = uid;

      if (!targetUid && email) {
        const byEmail = await admin.auth().getUserByEmail(email).catch(() => null);
        if (!byEmail) return res.status(404).json({ error: "User not found by email" });
        targetUid = byEmail.uid;
      }
      if (!targetUid) return res.status(400).json({ error: "Provide uid or email" });

      // one-tap token payload (no PII beyond uid)
      const token = signOneTapToken({ uid: targetUid, kind: "ops_one_tap" }, 10 * 60); // 10 min TTL
      const url = `${BASE_URL}/ops/one-tap?token=${encodeURIComponent(token)}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ""}`;
      
      logger.info("🔐 [OneTap] Generated secure link", { uid: targetUid, ttl: "10 minutes" });
      res.json({ url, ttlSec: 600 });
    } catch (err: any) {
      logger.error("❌ [OneTap] Link generation failed", err);
      res.status(500).json({ error: err?.message || "Internal error" });
    }
  });

  /* 3) One-tap consumer
     GET /ops/one-tap?token=...&redirect=/m
     Verifies token, mints Firebase custom token, serves tiny HTML that signs-in and sets pw_session via /api/auth/session
  */
  app.get("/ops/one-tap", async (req: Request, res: Response) => {
    try {
      const token = String(req.query.token || "");
      const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "/m";
      if (!token) return res.status(400).send("Missing token");

      const { uid } = verifyOneTapToken(token);
      if (!uid) return res.status(400).send("Invalid token payload");

      // Mint a Firebase Custom Token for the user
      const customToken = await admin.auth().createCustomToken(uid, { ops: true });

      logger.info("✅ [OneTap] Valid token verified, serving auto-login page", { uid });
      
      // Serve the auto-sign HTML (will set session cookie via existing /api/auth/session)
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(autoSignHtml({ customToken, redirect }));
    } catch (err: any) {
      logger.error("❌ [OneTap] Token verification failed", err);
      res.status(400).send("One-tap link invalid or expired");
    }
  });

  /* 4) Employee one-tap consumer (simpler - token is already Firebase custom token)
     GET /ops/one-tap-employee?token=FIREBASE_CUSTOM_TOKEN&redirect=/m
     Takes Firebase custom token directly, serves auto-login HTML
  */
  app.get("/ops/one-tap-employee", async (req: Request, res: Response) => {
    try {
      const customToken = String(req.query.token || "");
      const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "/m";
      
      if (!customToken) {
        return res.status(400).send("Missing token");
      }

      logger.info("✅ [Employee OneTap] Serving auto-login page with Firebase custom token");
      
      // Serve the auto-sign HTML (will set session cookie via existing /api/auth/session)
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8").send(autoSignHtml({ customToken, redirect }));
    } catch (err: any) {
      logger.error("❌ [Employee OneTap] Failed", err);
      res.status(400).send("One-tap login failed");
    }
  });
}
