/**
 * /api/identity/link/* — Phase 6 account linking (CEO D6, corrected).
 *
 * NEW COLLISION path (this file):
 *   - GET  /api/identity/links   — list linked providers on the authed user
 *   - POST /api/identity/link/initiate  — start a link with 2-sided proof
 *   - POST /api/identity/link/confirm   — confirm and write the link
 *
 * LEGACY DUPLICATES path (admin tool, separate router):
 *   - POST /api/admin/identity/merge    — super-admin soft-merge tool
 *   - see server/routes/admin-identity-merge.ts
 *
 * D6 CORRECTIONS BAKED IN:
 *   * Matching email is NOT proof of matching person. This endpoint
 *     NEVER auto-links across accounts.
 *   * new-collision link requires BOTH:
 *       (a) session-recent authentication on the currently-signed-in
 *           account (step-up proof for purpose='link_provider'), AND
 *       (b) a fresh Firebase ID token for the OTHER provider's
 *           identity, verified server-side within this request.
 *     Both must be present. The step-up proof is verified via
 *     StepUpService. If either is missing → 401 STEP_UP_REQUIRED.
 *   * The link write goes through linkAdditionalProvider() (the
 *     distinct-from-loginOrLink safe-link primitive). Never
 *     loginOrLink() from an unauthenticated context.
 *
 * PHASE 6.a — SHIPPED HERE:
 *   * GET /api/identity/links (live — reads identity_accounts)
 *   * POST /api/identity/link/initiate (returns 501 NOT_YET_IMPLEMENTED
 *     with the required-body shape as documentation)
 *   * POST /api/identity/link/confirm (returns 501 same)
 *
 * PHASE 6.b — DELIVERS THE FULL FLOWS:
 *   The initiate/confirm implementations land alongside the client
 *   linking UI. The scaffolding here CLAIMS the endpoint namespace so
 *   nobody else invents a parallel path, and encodes the required
 *   proof shape in the 501 responses so the future implementer has a
 *   contract to hit.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { identityAccounts } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { requireStepUp } from '../services/StepUpService';
import { logger } from '../lib/logger';

const router = Router();

// ─── GET /api/identity/links ───────────────────────────────────────────
// Returns the list of linked providers for the authed user. Read-only.
// Client uses this to render the "Signed in with Google, Apple, phone,
// passkey" list under Account Security.
router.get('/links', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  try {
    const rows = await db
      .select({
        provider: identityAccounts.provider,
        providerAccountId: identityAccounts.providerAccountId,
        email: identityAccounts.email,
        emailVerified: identityAccounts.emailVerified,
        displayName: identityAccounts.displayName,
        isPrimary: identityAccounts.isPrimary,
        linkedAt: identityAccounts.linkedAt,
        lastUsedAt: identityAccounts.lastUsedAt,
      })
      .from(identityAccounts)
      .where(eq(identityAccounts.userId, uid))
      .orderBy(desc(identityAccounts.isPrimary), desc(identityAccounts.linkedAt));

    return res.json({
      userId: uid,
      links: rows.map((r) => ({
        provider: r.provider,
        // NEVER return providerAccountId in full — it's the Firebase sub.
        // Return a truncated hint so support can correlate without
        // exposing the whole ID to the client.
        providerAccountIdHint: r.providerAccountId ? r.providerAccountId.slice(-6) : null,
        email: r.email,
        emailVerified: r.emailVerified,
        displayName: r.displayName,
        isPrimary: r.isPrimary,
        linkedAt: r.linkedAt,
        lastUsedAt: r.lastUsedAt,
      })),
    });
  } catch (err: any) {
    logger.error('[me/identity/links] GET failed', { uid, error: err?.message });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

// ─── POST /api/identity/link/initiate ─────────────────────────────────
// Phase 6.b implementation stub. Server SHAPE:
//   headers: X-StepUp-Proof: <token issued for purpose 'link_provider'>
//   body: { provider: 'google'|'apple'|'facebook', idToken: '<Firebase ID token from the OTHER provider>' }
// Server MUST verify the ID token, extract (provider, providerAccountId,
// email, emailVerified) from decoded claims, and issue a link-challenge
// token that the /confirm endpoint accepts.
//
// Until Phase 6.b lands, this returns 501 with the required-body shape
// so callers can build against the contract.
const InitiateBody = z.object({
  provider: z.enum(['google', 'apple', 'facebook']),
  idToken: z.string().min(20),
});

router.post(
  '/link/initiate',
  validateFirebaseToken,
  requireStepUp('link_provider'),
  async (req: Request, res: Response) => {
    const body = InitiateBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        expected: { provider: 'google|apple|facebook', idToken: '<Firebase ID token>' },
      });
    }
    // Phase 6.b will implement — for now return 501 with the shape
    // and a pointer.
    return res.status(501).json({
      error: 'NOT_YET_IMPLEMENTED',
      phase: '6.b',
      note: 'Endpoint scaffold — full flow implements dual-sided proof + link-challenge token. See server/routes/me-identity-links.ts docstring for the contract.',
    });
  },
);

// ─── POST /api/identity/link/confirm ──────────────────────────────────
// Phase 6.b implementation stub. Body:
//   { challengeToken: '<from initiate>', confirm: true }
// On success writes identity_accounts row via linkAdditionalProvider().
const ConfirmBody = z.object({
  challengeToken: z.string().min(20),
  confirm: z.literal(true),
});

router.post(
  '/link/confirm',
  validateFirebaseToken,
  requireStepUp('link_provider'),
  async (req: Request, res: Response) => {
    const body = ConfirmBody.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        expected: { challengeToken: '<opaque>', confirm: true },
      });
    }
    return res.status(501).json({
      error: 'NOT_YET_IMPLEMENTED',
      phase: '6.b',
      note: 'Endpoint scaffold — will consume the challenge token from /initiate and call linkAdditionalProvider().',
    });
  },
);

export default router;
