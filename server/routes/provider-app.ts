/**
 * PetWash™ Care — Provider App API
 *
 * The backend surface the native iOS provider app calls. The whole router is
 * inert unless PROVIDER_APP_API_ENABLED === "true" (OFF in production) so it
 * can be developed against safely.
 *
 * Implemented (safe, non-sensitive):
 *   POST /api/provider-app/auth/passkey/challenge   — random sign-in challenge
 *   GET  /api/provider-app/onboarding/jurisdictions — jurisdiction list
 *   GET  /api/provider-app/onboarding/declarations  — structure only (wording PENDING counsel)
 *   GET  /api/provider-app/onboarding/activation    — activation status
 *
 * NOT implemented (return 501 — require security review + Israeli counsel):
 *   POST /api/provider-app/auth/passkey/verify      — WebAuthn server validation
 *   POST /api/provider-app/documents                — Identity Vault intake (KYC)
 *   POST /api/provider-app/signature                — Evidence-Vault e-signature sealing
 */

import { Router, type Request, type Response } from "express";
import { randomBytes } from "crypto";

const router = Router();

const isEnabled = (): boolean => process.env.PROVIDER_APP_API_ENABLED === "true";

// Kill-switch: the entire provider-app surface is disabled unless explicitly
// turned on. Off in production — no new attack surface ships by default.
router.use("/api/provider-app", (_req: Request, res: Response, next) => {
  if (!isEnabled()) {
    return res.status(503).json({
      error: "provider_app_api_disabled",
      message: "PetWash Care provider API is not enabled in this environment.",
    });
  }
  next();
});

// ── Implemented (safe, non-sensitive) ──────────────────────────────────────

router.post("/api/provider-app/auth/passkey/challenge", (_req: Request, res: Response) => {
  // Single-use random challenge for the WebAuthn assertion. Real replay-protection
  // (server-side storage + expiry) lands with the /verify implementation.
  res.json({ challenge: randomBytes(32).toString("base64") });
});

router.get("/api/provider-app/onboarding/jurisdictions", (_req: Request, res: Response) => {
  res.json([
    { id: "il", name: "Israel" },
    { id: "us-ca", name: "California, USA" },
  ]);
});

router.get("/api/provider-app/onboarding/declarations", (req: Request, res: Response) => {
  // Declaration WORDING is blocked pending Israeli counsel (Amendment 13 — special
  // sensitivity data). Structure only; bodies stay PENDING_COUNSEL until approved.
  const _jurisdiction = String(req.query.jurisdiction ?? "il");
  res.json([
    { id: "truthfulness", title: "Truthfulness of information", body: "PENDING_COUNSEL", required: true },
    { id: "right-to-work", title: "Right to work / business registration", body: "PENDING_COUNSEL", required: true },
    { id: "insurance", title: "Insurance status", body: "PENDING_COUNSEL", required: true },
    { id: "privacy", title: "Privacy notice & data-processing consent", body: "PENDING_COUNSEL", required: true },
  ]);
});

router.get("/api/provider-app/onboarding/activation", (_req: Request, res: Response) => {
  res.json({ state: "inReview", message: "Your documents are being reviewed." });
});

// ── Not implemented — require security review + counsel ─────────────────────

function notImplemented(res: Response, why: string) {
  return res.status(501).json({ error: "not_implemented", message: why });
}

router.post("/api/provider-app/auth/passkey/verify", (_req: Request, res: Response) =>
  notImplemented(res, "Passkey verification needs server-side WebAuthn validation + security review."));

router.post("/api/provider-app/documents", (_req: Request, res: Response) =>
  notImplemented(res, "Document intake needs the Identity Vault + security review (KYC)."));

router.post("/api/provider-app/signature", (_req: Request, res: Response) =>
  notImplemented(res, "E-signature sealing needs the Evidence-Vault + counsel-approved contract."));

export const providerAppRouter = router;
