/**
 * /api/me/profile — CEO P0-MY-ACCOUNT task #161.
 *
 * Contract:
 *   GET  /api/me/profile
 *     200 → { snapshot: CanonicalSnapshot, completeness: CompletenessOutcome }
 *
 *   PATCH /api/me/profile
 *     body: Partial<{firstName, lastName, dateOfBirth, language,
 *                    profileImageUrl, address, city, postalCode, country}>
 *     200 → { snapshot, completeness, fannedOut }
 *     400 → { error: 'NO_FIELDS' | 'FIELD_NOT_WRITABLE' }
 *     401 → auth_required
 *     409 → { error: 'UPDATE_PARTIAL_ROLLBACK_REQUIRED',
 *             reasonCode, snapshot }
 *
 *   POST /api/me/contact-change/initiate
 *     body: { kind: 'MOBILE' | 'EMAIL', value }
 *     200 → { state: 'PROPOSED', proposedValue }
 *     400 → { error: 'INVALID_VALUE' | 'MISSING_KIND' }
 *
 *   POST /api/me/contact-change/verify
 *     body: { kind, otpCode }
 *     200 → { state: 'VERIFIED_PENDING_COMMIT' }
 *     400 → { error: 'OTP_WRONG' | 'OTP_EXPIRED' | 'MAX_OTP_ATTEMPTS' }
 *
 *   POST /api/me/contact-change/commit
 *     body: { kind }
 *     200 → { snapshot, completeness }
 *     409 → { error: 'DUPLICATE_VALUE' | 'FIREBASE_UPDATE_FAILED' }
 *
 *   POST /api/me/contact-change/cancel
 *     body: { kind }
 *     200 → { state: 'CANCELLED' }
 *
 * Discipline:
 *   • uid derives from Firebase token; NEVER from body.
 *   • email / phone changes go through the state machine — the
 *     direct PATCH refuses them (UpdateProfileService enforces).
 *   • Every response includes the completeness projection so the
 *     client's Attention brain re-renders in one round-trip.
 *
 * The route file itself carries only the HTTP shape; every decision
 * lives in the pure services (UpdateProfileService,
 * ProfileCompletenessService, ContactChangeStateMachine).
 */
import { Router, type Request, type Response } from 'express';
import { logger } from '../lib/logger';

const router = Router();

router.get('/profile', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    // Wired against a snapshot loader + ProfileCompletenessService.
    // The loader implementation lands in a follow-up commit that
    // reads the canonical users row and its verification flags.
    return res.status(501).json({ error: 'not_implemented', reason: 'awaiting_loader_wire' });
  } catch (err: any) {
    logger.error('[MeProfile] GET unhandled', { error: err?.message });
    return res.status(500).json({ error: 'profile_unavailable' });
  }
});

router.patch('/profile', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    // Wired against UpdateProfileService in a follow-up commit that
    // instantiates writeCanonical / updateFirebaseDisplayName /
    // refreshPrestigeMirror against real DB + Firebase Admin.
    return res.status(501).json({ error: 'not_implemented', reason: 'awaiting_effects_wire' });
  } catch (err: any) {
    logger.error('[MeProfile] PATCH unhandled', { error: err?.message });
    return res.status(500).json({ error: 'profile_unavailable' });
  }
});

router.post('/contact-change/initiate', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    const kind = String(req.body?.kind ?? '').toUpperCase();
    const value = String(req.body?.value ?? '').trim();
    if (kind !== 'MOBILE' && kind !== 'EMAIL') return res.status(400).json({ error: 'MISSING_KIND' });
    if (!value) return res.status(400).json({ error: 'INVALID_VALUE' });
    return res.status(501).json({ error: 'not_implemented', reason: 'awaiting_otp_wire' });
  } catch (err: any) {
    logger.error('[MeProfile] contact-change/initiate', { error: err?.message });
    return res.status(500).json({ error: 'contact_change_unavailable' });
  }
});

router.post('/contact-change/verify', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    return res.status(501).json({ error: 'not_implemented', reason: 'awaiting_otp_wire' });
  } catch (err: any) {
    logger.error('[MeProfile] contact-change/verify', { error: err?.message });
    return res.status(500).json({ error: 'contact_change_unavailable' });
  }
});

router.post('/contact-change/commit', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    return res.status(501).json({ error: 'not_implemented', reason: 'awaiting_otp_wire' });
  } catch (err: any) {
    logger.error('[MeProfile] contact-change/commit', { error: err?.message });
    return res.status(500).json({ error: 'contact_change_unavailable' });
  }
});

router.post('/contact-change/cancel', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid as string | undefined;
    if (!uid) return res.status(401).json({ error: 'auth_required' });
    return res.status(200).json({ state: 'CANCELLED' });
  } catch (err: any) {
    logger.error('[MeProfile] contact-change/cancel', { error: err?.message });
    return res.status(500).json({ error: 'contact_change_unavailable' });
  }
});

export default router;
