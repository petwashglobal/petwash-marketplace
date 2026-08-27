/**
 * GET /api/jobs/:jobRef — READ-ONLY JobPassport endpoint.
 *
 * CEO 2026-08-27 §6 + §60. Composes the canonical JobPassport on
 * demand for the authenticated viewer. Never mutates. Never authorises
 * anything — pure projection over existing authorities.
 *
 * Also accepts direct booking IDs (BR-..., SIT-..., W-...) for
 * support / admin lookup:
 *   GET /api/jobs/by-booking/:source/:bookingId
 * where source ∈ { booking_requests | sitter_bookings | walk_bookings }.
 *
 * The route path uses the CEO §2 jobRef term but every endpoint
 * accepts the legacy booking-id form as well; a follow-up will lift
 * both into a single lookup once the correlation spine (§3) exists.
 *
 * Auth: `validateFirebaseToken` (mounted globally at /api). The
 * viewer's actor kind is DERIVED — customer by default; escalated to
 * PETWASH_STAFF via isSuperAdmin; the composer decides PROVIDER by
 * matching viewer.uid against the assigned fulfiller.
 */

import { Router, type Request, type Response } from 'express';
import { logger } from '../lib/logger';
import { isSuperAdmin } from '../middleware/rbac';
import { composeJobPassport } from '../services/jobPassport/composer';
import {
  issueHandoff, verifyHandoff, revokeHandoff, inspectHandoff,
  HANDOFF_PURPOSES, type HandoffPurpose,
} from '../services/jobPassport/handoffCredentials';
import type { ActorIdentity, ActorKind } from '@shared/lib/jobPassport/actorRegistry';
import { parseJobRef, truncateUid } from '@shared/lib/jobPassport/idNamespace';

const router = Router();

/**
 * Resolve the viewer's ActorIdentity from the request. NEVER trusts
 * the body — reads only from validateFirebaseToken's decoded token +
 * the isSuperAdmin allowlist.
 *
 * Note: `PROVIDER` kind is NOT set here — the composer picks it when
 * viewer.uid matches the assigned fulfiller. That way this route
 * doesn't need to know provider_services membership; the composer's
 * per-vertical joins already do.
 */
function resolveViewer(req: Request): ActorIdentity | null {
  const uid = (req as any).firebaseUser?.uid;
  const email = (req as any).firebaseUser?.email || '';
  if (!uid) return null;
  const kind: ActorKind = isSuperAdmin(email) ? 'PETWASH_STAFF' : 'CUSTOMER';
  return { kind, uid };
}

/**
 * GET /api/jobs/by-booking/:source/:bookingId
 *
 * Explicit lookup by booking authority + id. Used by support and by
 * clients that know the underlying booking id (e.g. deep links from
 * pre-jobRef notifications).
 */
router.get('/by-booking/:source/:bookingId', async (req: Request, res: Response) => {
  const viewer = resolveViewer(req);
  if (!viewer || !viewer.uid) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }
  const source = String(req.params.source);
  const bookingId = String(req.params.bookingId);
  // Whitelist matches the composer's dispatch switch. Adding a new
  // platform composer means adding its table here — no wildcard.
  const KNOWN_SOURCES = [
    'sitter_bookings',
    'walk_bookings',
    'booking_requests',
    'trainer_bookings',
    'shop_orders',
    'k9000_wash_events',
    'egift_guest_orders',
  ];
  if (!KNOWN_SOURCES.includes(source)) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_SOURCE' });
  }

  // For the participant check the composer needs to see PROVIDER
  // *candidacy*. Try CUSTOMER first; if the composer returns null and
  // the viewer isn't already staff, retry as PROVIDER — the composer
  // will accept the one that matches the assigned fulfiller. Fallback
  // resolves the actor kind without leaking existence.
  const asCustomer = await composeJobPassport({
    sourceHint: source as any,
    bookingId,
    viewer: { ...viewer, kind: 'CUSTOMER' },
  });
  if (asCustomer) return res.json({ ok: true, ...asCustomer });

  if (viewer.kind !== 'PETWASH_STAFF') {
    const asProvider = await composeJobPassport({
      sourceHint: source as any,
      bookingId,
      viewer: { ...viewer, kind: 'PROVIDER' },
    });
    if (asProvider) return res.json({ ok: true, ...asProvider });
  }

  // Privacy 404 — same response as truly-missing, per §34 pattern.
  logger.info('[JobPassport] not-found or not-participant', {
    viewerUidTail: truncateUid(viewer.uid),
    source,
    bookingIdTail: bookingId.slice(-8),
  });
  return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
});

/**
 * GET /api/jobs/:jobRef
 *
 * Human-friendly lookup by PW-XXXXXX. The jobRef is deterministic
 * from the booking id (§13 discipline: this is a display code, not
 * an auth token — the participant check still fires below), but we
 * do NOT have a jobRef → bookingId index yet. Follow-up.
 *
 * Today: return 501 with a hint pointing at /by-booking. The composer
 * infrastructure is in place; the search index is Phase 2.
 */
router.get('/:jobRef', async (req: Request, res: Response) => {
  const viewer = resolveViewer(req);
  if (!viewer || !viewer.uid) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }
  const parsed = parseJobRef(String(req.params.jobRef));
  if (!parsed) {
    return res.status(400).json({ ok: false, error: 'INVALID_JOB_REF' });
  }
  // Phase 1 (§60) doesn't include the jobRef → bookingId reverse index.
  // Return a stable pointer so clients that already have the raw
  // bookingId use the /by-booking form, and the admin explorer can
  // wire the reverse index in Phase 2.
  return res.status(501).json({
    ok: false,
    error: 'JOBREF_INDEX_NOT_READY',
    hint: 'Use GET /api/jobs/by-booking/:source/:bookingId until the jobRef → bookingId index lands (§60/§61 Phase 2).',
    platform: parsed.platform.platformCode,
  });
});

// ─── Handoff credential routes (§13, §14, §46) ──────────────────────
//
// Wire-only sweep 2026-08-27: handoffCredentials.ts (SHA-256-hashed, rate-
// limited, 15-min TTL, revocable, in-memory Phase 1) was shipped in
// 20376d25a with unit tests, but had no HTTP route. Nothing could
// actually issue or verify a code. These endpoints close that loop.
//
// Auth: same validateFirebaseToken as the composer routes. The issuer
// must be a participant on the job (customer OR assigned provider OR
// staff) — checked by composing the passport and asserting the viewer
// matches. Verification is checked by RESOLVING the code, then
// asserting the caller is entitled to consume THAT purpose (staff for
// PICKUP, customer for ENTRY / START, machine acceptor for REDEMPTION).

/**
 * Small helper: resolve (source, bookingId) → composed passport for the
 * viewer, trying CUSTOMER then PROVIDER. Returns null when the viewer
 * is not a participant (§34 privacy — the route responds with 404).
 */
async function passportForParticipant(
  viewer: ActorIdentity,
  source: string,
  bookingId: string,
) {
  const KNOWN_SOURCES = [
    'sitter_bookings', 'walk_bookings', 'booking_requests',
    'trainer_bookings', 'shop_orders', 'k9000_wash_events', 'egift_guest_orders',
  ];
  if (!KNOWN_SOURCES.includes(source)) return null;

  const asCustomer = await composeJobPassport({
    sourceHint: source as any, bookingId,
    viewer: { ...viewer, kind: 'CUSTOMER' },
  });
  if (asCustomer) return asCustomer;
  if (viewer.kind !== 'PETWASH_STAFF') {
    const asProvider = await composeJobPassport({
      sourceHint: source as any, bookingId,
      viewer: { ...viewer, kind: 'PROVIDER' },
    });
    if (asProvider) return asProvider;
  }
  return null;
}

/**
 * POST /api/jobs/handoff/issue
 *
 * Body: { source, bookingId, purpose, ttlSeconds? }
 *
 * Only a participant on the job (customer / assigned provider / staff)
 * can issue. `ttlSeconds` is capped server-side to 15 minutes.
 * Response: { ok, jobRef, purpose, code, expiresAt } — the code is
 * returned ONCE and only to the issuer. Never logged.
 */
router.post('/handoff/issue', async (req: Request, res: Response) => {
  const viewer = resolveViewer(req);
  if (!viewer || !viewer.uid) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }
  const source = String(req.body?.source ?? '');
  const bookingId = String(req.body?.bookingId ?? '');
  const purposeRaw = String(req.body?.purpose ?? '');
  const ttlSeconds = Math.min(Math.max(Number(req.body?.ttlSeconds ?? 900), 60), 900);

  if (!HANDOFF_PURPOSES.includes(purposeRaw as HandoffPurpose)) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_PURPOSE' });
  }
  const purpose = purposeRaw as HandoffPurpose;

  const envelope = await passportForParticipant(viewer, source, bookingId);
  if (!envelope) {
    // §34 privacy 404 — same shape as unknown-source or non-participant.
    return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  }

  const cred = issueHandoff({
    jobRef: envelope.passport.jobRef,
    purpose,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    scopeHints: { platform: envelope.passport.platform },
  });

  logger.info('[JobPassport] handoff issued', {
    viewerUidTail: truncateUid(viewer.uid),
    jobRef: cred.jobRef,
    purpose: cred.purpose,
  });

  return res.json({
    ok: true,
    jobRef: cred.jobRef,
    purpose: cred.purpose,
    code: cred.code,
    expiresAt: cred.expiresAt.toISOString(),
  });
});

/**
 * POST /api/jobs/handoff/verify
 *
 * Body: { source, bookingId, purpose, code }
 *
 * The verifier must ALSO be a participant on the job — a random caller
 * can't brute-force codes on somebody else's job.
 */
router.post('/handoff/verify', async (req: Request, res: Response) => {
  const viewer = resolveViewer(req);
  if (!viewer || !viewer.uid) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }
  const source = String(req.body?.source ?? '');
  const bookingId = String(req.body?.bookingId ?? '');
  const purposeRaw = String(req.body?.purpose ?? '');
  const code = String(req.body?.code ?? '');

  if (!HANDOFF_PURPOSES.includes(purposeRaw as HandoffPurpose)) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_PURPOSE' });
  }
  const purpose = purposeRaw as HandoffPurpose;

  const envelope = await passportForParticipant(viewer, source, bookingId);
  if (!envelope) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

  const result = verifyHandoff({
    jobRef: envelope.passport.jobRef,
    purpose,
    code,
    caller: { kind: viewer.kind === 'PETWASH_STAFF' ? 'STAFF' : 'CUSTOMER', uid: viewer.uid },
  });

  // Never leak WHY inside the JSON body beyond the enumerated errorCode
  // (safe — enumerated per §46). Same-shape response on success/failure.
  if (result.ok) {
    return res.json({ ok: true, jobRef: result.jobRef, purpose: result.purpose });
  }
  return res.status(400).json({ ok: false, errorCode: result.errorCode });
});

/**
 * POST /api/jobs/handoff/revoke
 *
 * Body: { source, bookingId, purpose }
 *
 * §46 revocable. Idempotent. Only participants can revoke.
 */
router.post('/handoff/revoke', async (req: Request, res: Response) => {
  const viewer = resolveViewer(req);
  if (!viewer || !viewer.uid) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }
  const source = String(req.body?.source ?? '');
  const bookingId = String(req.body?.bookingId ?? '');
  const purposeRaw = String(req.body?.purpose ?? '');
  if (!HANDOFF_PURPOSES.includes(purposeRaw as HandoffPurpose)) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_PURPOSE' });
  }
  const purpose = purposeRaw as HandoffPurpose;

  const envelope = await passportForParticipant(viewer, source, bookingId);
  if (!envelope) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

  revokeHandoff(envelope.passport.jobRef, purpose);
  return res.json({ ok: true, jobRef: envelope.passport.jobRef, purpose });
});

/**
 * GET /api/jobs/handoff/status?source=…&bookingId=…&purpose=…
 *
 * Read-only status probe. Never returns the plaintext code — that's
 * only exposed by /issue at creation time.
 */
router.get('/handoff/status', async (req: Request, res: Response) => {
  const viewer = resolveViewer(req);
  if (!viewer || !viewer.uid) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }
  const source = String(req.query?.source ?? '');
  const bookingId = String(req.query?.bookingId ?? '');
  const purposeRaw = String(req.query?.purpose ?? '');
  if (!HANDOFF_PURPOSES.includes(purposeRaw as HandoffPurpose)) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_PURPOSE' });
  }
  const purpose = purposeRaw as HandoffPurpose;

  const envelope = await passportForParticipant(viewer, source, bookingId);
  if (!envelope) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });

  const status = inspectHandoff(envelope.passport.jobRef, purpose);
  return res.json({
    ok: true,
    jobRef: envelope.passport.jobRef,
    purpose,
    ...status,
    expiresAt: status.expiresAt?.toISOString(),
  });
});

export default router;
