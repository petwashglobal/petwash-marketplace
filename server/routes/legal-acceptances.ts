/**
 * Legal acceptance endpoints — the canonical evidence API for the
 * `legal_acceptances` ledger (migration 0127).
 *
 * CORRECTED FRAMING (CEO 2026-08-26 §11): this endpoint is NOT
 * "the ONE server surface every client legal page uses". Today it is
 * the CANONICAL EVIDENCE API. Actual write coverage lives in a mix of:
 *   • This endpoint (direct calls from surfaces already migrated).
 *   • Migration dual-writes fired from legacy acceptance surfaces
 *     (see `provider-declarations.ts`, `legal-consent.ts`,
 *     `consent-center.ts`, and the /api/consent/onboarding handler in
 *     `routes.ts`). Those dual-writes are BEST-EFFORT SHADOW today,
 *     not authoritative — reconciliation is a follow-up (§7).
 *
 *   POST /api/legal/accept
 *     body: { documentKey, versionExpected?, language, snapshotUrl?,
 *             deviceFingerprint?, metadata? }
 *     auth: Firebase Bearer (validateFirebaseToken via mount).
 *     Server RESOLVES the canonical docVersion + snapshotText from
 *     the shared/lib/legalDocumentRegistry — client's `snapshotText`
 *     is IGNORED to prevent evidence forgery. Client may send
 *     `versionExpected` to detect a race with a mid-flight doc bump
 *     (410 GONE if the version moved on since render).
 *     → 200 { ok, acceptance: { id, docVersion, acceptedAt, ... } }
 *
 *   GET /api/legal/my-acceptances     — user self
 *   GET /api/admin/legal-acceptances/:userId — super_admin only
 *
 * The writer service (LegalAcceptanceService) is idempotent per
 * (userId, documentKey, docVersion) so a re-submit on refresh does
 * not create duplicate rows. IMPORTANT: idempotency means this ledger
 * answers "has ever accepted this version" (CEO §10). Lifecycle
 * (grant/withdraw/re-grant for marketing consent) stays in the
 * consent_ledger + notification_preferences — this canonical table
 * is grant-evidence-only.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  recordLegalAcceptance,
  listUserLegalAcceptances,
} from '../services/LegalAcceptanceService';
import { isSuperAdminVerified } from '../middleware/rbac';
import { logger } from '../lib/logger';
import {
  LEGAL_DOCUMENT_KEYS,
  getLegalDocument,
} from '@shared/lib/legalDocumentRegistry';

const router = Router();

// Whitelisted keys are derived from the canonical registry
// (shared/lib/legalDocumentRegistry.ts) — no hand-maintained list.
// A new document is added there and this whitelist updates automatically
// (CEO 2026-08-26 §1-2).
const KNOWN_DOCUMENT_KEYS = LEGAL_DOCUMENT_KEYS;

// CEO 2026-08-26 §5: the client is NOT trusted to declare the docVersion
// or the snapshotText. It sends the key + the language it displayed +
// (optionally) the version it THOUGHT it was rendering — the server
// resolves the canonical version from the registry and rejects a stale
// render with 410 GONE. snapshotText is IGNORED entirely; the server
// derives evidence from the registry (or leaves it null when the text
// source is a client-side page not yet available server-side).
const acceptSchema = z.object({
  documentKey: z.string().min(1).max(80),
  /** Optional stale-render check; server rejects if != currentVersion. */
  versionExpected: z.string().min(1).max(40).optional(),
  language: z.enum(['he', 'en', 'ar', 'ru', 'fr', 'es']),
  snapshotUrl: z.string().url().max(2000).optional(),
  deviceFingerprint: z.string().max(200).optional(),
  metadata: z.record(z.any()).optional(),
});

router.post('/accept', async (req: Request, res: Response) => {
  const userId = (req as any).firebaseUser?.uid;
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false, error: 'Invalid input',
      details: parsed.error.flatten(),
    });
  }
  const { documentKey, versionExpected, language, snapshotUrl, deviceFingerprint, metadata } = parsed.data;

  const doc = getLegalDocument(documentKey);
  if (!doc || !KNOWN_DOCUMENT_KEYS.has(documentKey)) {
    logger.warn('[LegalAccept] Rejected unknown documentKey', { userId, documentKey });
    return res.status(400).json({ ok: false, error: 'Unknown document', hint: 'Add the key to shared/lib/legalDocumentRegistry.ts.' });
  }

  // Language sanity: client MUST accept in a language the registry
  // actually supports for this document. A mismatched language is
  // dishonest evidence (CEO §3).
  if (!doc.languages.includes(language)) {
    return res.status(400).json({
      ok: false, error: 'Language not available for this document',
      supportedLanguages: doc.languages,
    });
  }

  // Stale-render check: if the client sent versionExpected and it does
  // not match the registry's currentVersion, the user was looking at
  // an outdated doc. 410 GONE + newVersion so the client can re-render.
  if (versionExpected && versionExpected !== doc.currentVersion) {
    return res.status(410).json({
      ok: false, error: 'Document version changed since render',
      code: 'VERSION_STALE',
      requested: versionExpected,
      current: doc.currentVersion,
    });
  }

  // AUTHORITATIVE policy at this endpoint (CEO §1): this is the user
  // explicitly accepting via /api/legal/accept — failure must not
  // silently succeed. Any write error returns 500 and the client is
  // expected to retry; we never mint a false "you accepted" UI.
  const writeResult = await recordLegalAcceptance({
    userId,
    documentKey,
    docVersion: doc.currentVersion,
    language,
    // Trust ONLY req.ip (Express + trust proxy). Raw X-Forwarded-For is
    // caller-controlled — same rule as PR #2158 for signed provider IPs.
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get('user-agent') || null,
    deviceFingerprint: deviceFingerprint ?? null,
    // snapshotText intentionally omitted here: the client does not
    // supply it and static-page documents don't have a server-owned
    // body yet. When the registry evolves to `consentSnapshot` /
    // `providerDeclaration` text sources, this writer can derive
    // snapshotText from the resolved doc.text[language]. Until then
    // we prefer no evidence over dishonest evidence.
    snapshotText: undefined,
    snapshotUrl: snapshotUrl ?? null,
    source: 'client',
    actorRole: 'self',
    metadata: {
      ...(metadata || {}),
      scope: doc.scope,
      textSourceKind: doc.textSource.kind,
    },
  });

  if (!writeResult.ok) {
    return res.status(500).json({
      ok: false,
      error: 'Could not record acceptance',
      errorCode: writeResult.errorCode,
    });
  }
  const acceptance = writeResult.row;

  return res.json({
    ok: true,
    alreadyAccepted: writeResult.alreadyAccepted,
    acceptance: {
      id: acceptance.id,
      documentKey: acceptance.documentKey,
      docVersion: acceptance.docVersion,
      language: acceptance.language,
      acceptedAt: acceptance.acceptedAt.toISOString(),
    },
  });
});

router.get('/my-acceptances', async (req: Request, res: Response) => {
  const userId = (req as any).firebaseUser?.uid;
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  const rows = await listUserLegalAcceptances(userId);
  return res.json({
    ok: true,
    acceptances: rows.map((r) => ({
      documentKey: r.documentKey,
      docVersion: r.docVersion,
      language: r.language,
      acceptedAt: r.acceptedAt.toISOString(),
      source: r.source,
    })),
  });
});

// Admin — full evidence view for one user.
router.get('/admin/legal-acceptances/:userId', async (req: Request, res: Response) => {
  // #240 migration: paired shape — allowlist + email_verified.
  if (!isSuperAdminVerified(req as any)) {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });

  const rows = await listUserLegalAcceptances(userId);
  return res.json({
    ok: true,
    userId,
    acceptances: rows.map((r) => ({
      id: r.id,
      documentKey: r.documentKey,
      docVersion: r.docVersion,
      language: r.language,
      acceptedAt: r.acceptedAt.toISOString(),
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      snapshotHash: r.snapshotHash,
      snapshotUrl: r.snapshotUrl,
      source: r.source,
      actorRole: r.actorRole,
    })),
  });
});

export default router;
