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
import { eq, desc, and } from 'drizzle-orm';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { requireStepUp } from '../services/StepUpService';
import { issueLinkChallenge, verifyLinkChallenge } from '../services/LinkChallengeService';
import { linkAdditionalProvider } from '../identity/loginOrLink';
import admin from '../lib/firebase-admin';
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
  provider: z.enum(['google', 'apple', 'facebook', 'passkey']),
  idToken: z.string().min(20),
});

/**
 * Map a Firebase sign-in-provider string (from decoded claims) to
 * the canonical PetWash provider name we store in identity_accounts.
 * Returns null if the token was minted by a provider we don't accept
 * for linking (which currently means "anything other than the four
 * we recognise").
 */
function providerFromDecoded(decoded: any): string | null {
  const raw = (decoded?.firebase?.sign_in_provider as string) || '';
  switch (raw) {
    case 'google.com':
      return 'google';
    case 'apple.com':
      return 'apple';
    case 'facebook.com':
      return 'facebook';
    case 'password':
      return 'password';
    case 'phone':
      return 'phone';
    case 'custom':
      // The custom-token feeders (WebAuthn) mint passkey identities.
      return 'passkey';
    default:
      return null;
  }
}

router.post(
  '/link/initiate',
  validateFirebaseToken,
  requireStepUp('link_provider'),
  async (req: Request, res: Response) => {
    const parsed = InitiateBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        expected: { provider: 'google|apple|facebook|passkey', idToken: '<Firebase ID token>' },
      });
    }
    const { provider, idToken } = parsed.data;
    const callerUid = req.firebaseUser!.uid;

    // 1. Verify the OTHER-provider Firebase ID token. `checkRevoked=true`
    //    protects against a revoked-account link attempt.
    let decoded: any;
    try {
      decoded = await admin.auth().verifyIdToken(idToken, true);
    } catch (err: any) {
      logger.warn('[identity/link/initiate] provider token verify failed', {
        callerUid,
        provider,
        code: err?.code,
      });
      return res.status(401).json({ error: 'PROVIDER_TOKEN_INVALID' });
    }

    // 2. The token's own provider must match the client-declared one —
    //    a Google-provider token cannot be pushed as an Apple link.
    const decodedProvider = providerFromDecoded(decoded);
    if (!decodedProvider || decodedProvider !== provider) {
      return res.status(400).json({
        error: 'PROVIDER_MISMATCH',
        detail: `Client declared ${provider} but the ID token was minted by ${decodedProvider ?? 'unknown'}.`,
      });
    }

    // 3. Extract the identity we would be linking. providerAccountId
    //    is Firebase's uid on the OTHER account.
    const providerAccountId = String(decoded.uid || '');
    if (!providerAccountId) {
      return res.status(400).json({ error: 'PROVIDER_ACCOUNT_ID_MISSING' });
    }
    const email = (decoded.email as string | undefined) ?? null;
    const emailVerified = decoded.email_verified === true;

    // 4. Refuse identity-vs-self: the caller cannot "link" their own
    //    primary provider to themselves via /initiate. That's a no-op
    //    with a confusing UX; return a specific code.
    if (providerAccountId === callerUid) {
      return res.status(409).json({ error: 'SAME_IDENTITY' });
    }

    // 5. Refuse if that identity is already linked to ANY user.
    //    Cross-user linking of an existing identity is exactly what
    //    D6 forbids — the person on the other side hasn't consented.
    const [existing] = await db
      .select({ userId: identityAccounts.userId })
      .from(identityAccounts)
      .where(
        and(
          eq(identityAccounts.provider, provider),
          eq(identityAccounts.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.userId === callerUid) {
        return res.status(409).json({ error: 'ALREADY_LINKED_TO_YOU' });
      }
      logger.warn('[identity/link/initiate] refused — identity owned by another user', {
        callerUid,
        provider,
      });
      return res.status(409).json({ error: 'IDENTITY_OWNED_BY_ANOTHER' });
    }

    // 6. Mint the challenge. Bound to (uid, provider, providerAccountId,
    //    email, emailVerified) so it can't be swapped between identities.
    const challenge = issueLinkChallenge({
      uid: callerUid,
      provider,
      providerAccountId,
      email,
      emailVerified,
    });
    if (!challenge) {
      logger.error('[identity/link/initiate] challenge service unavailable');
      return res.status(500).json({ error: 'CHALLENGE_SERVICE_UNAVAILABLE' });
    }

    logger.info('[identity/link/initiate] challenge issued', {
      callerUid,
      provider,
      providerAccountIdHint: providerAccountId.slice(-6),
    });

    return res.json({
      ok: true,
      challengeToken: challenge.token,
      expiresAt: challenge.expiresAt.toISOString(),
      preview: {
        provider,
        providerAccountIdHint: providerAccountId.slice(-6),
        email,
        emailVerified,
      },
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
    const parsed = ConfirmBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        expected: { challengeToken: '<opaque>', confirm: true },
      });
    }
    const { challengeToken } = parsed.data;
    const callerUid = req.firebaseUser!.uid;

    // 1. Verify challenge — MAC + TTL + uid-binding all in the helper.
    const check = verifyLinkChallenge(challengeToken, callerUid);
    if (!check.ok) {
      logger.warn('[identity/link/confirm] challenge rejected', {
        callerUid,
        reason: check.reason,
      });
      const status = check.reason === 'EXPIRED' ? 410 : 401;
      return res.status(status).json({ error: 'CHALLENGE_INVALID', reason: check.reason });
    }
    const { challenge } = check;

    // 2. Race-recheck: the identity may have been claimed between
    //    /initiate and /confirm. Refuse if now owned by anyone else.
    const [existing] = await db
      .select({ userId: identityAccounts.userId })
      .from(identityAccounts)
      .where(
        and(
          eq(identityAccounts.provider, challenge.provider),
          eq(identityAccounts.providerAccountId, challenge.providerAccountId),
        ),
      )
      .limit(1);
    if (existing) {
      if (existing.userId === callerUid) {
        return res.status(200).json({
          ok: true,
          alreadyLinked: true,
          provider: challenge.provider,
        });
      }
      return res.status(409).json({ error: 'IDENTITY_OWNED_BY_ANOTHER' });
    }

    // 3. Write the link via the canonical primitive. Never call
    //    loginOrLink from here — that path is for unauthenticated
    //    login resolution, not authenticated linking.
    try {
      await linkAdditionalProvider(callerUid, {
        provider: challenge.provider,
        providerAccountId: challenge.providerAccountId,
        email: challenge.email,
        emailVerified: challenge.emailVerified,
      });
    } catch (err: any) {
      logger.error('[identity/link/confirm] linkAdditionalProvider failed', {
        callerUid,
        provider: challenge.provider,
        error: err?.message,
      });
      return res.status(500).json({ error: 'LINK_WRITE_FAILED' });
    }

    logger.info('[identity/link/confirm] linked', {
      callerUid,
      provider: challenge.provider,
      providerAccountIdHint: challenge.providerAccountId.slice(-6),
    });

    return res.json({
      ok: true,
      provider: challenge.provider,
      providerAccountIdHint: challenge.providerAccountId.slice(-6),
      linkedAt: new Date().toISOString(),
    });
  },
);

// ─── POST /api/identity/link/unlink ──────────────────────────────────
// Detach an already-linked provider. Refuses to leave the account
// with ZERO auth methods (that would lock the user out permanently).
// Step-up gated with a distinct purpose ('unlink_provider') so a
// challenge minted for /link/initiate cannot be replayed here.
const UnlinkBody = z.object({
  provider: z.enum(['google', 'apple', 'facebook', 'passkey']),
  providerAccountId: z.string().min(1),
});

router.post(
  '/link/unlink',
  validateFirebaseToken,
  requireStepUp('unlink_provider'),
  async (req: Request, res: Response) => {
    const parsed = UnlinkBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        expected: { provider: 'google|apple|facebook|passkey', providerAccountId: '<sub>' },
      });
    }
    const { provider, providerAccountId } = parsed.data;
    const callerUid = req.firebaseUser!.uid;

    // Refuse if the caller has only one active link — unlink would
    // orphan the account. The user may still delete the account
    // separately via the delete-account flow.
    const links = await db
      .select({
        provider: identityAccounts.provider,
        providerAccountId: identityAccounts.providerAccountId,
      })
      .from(identityAccounts)
      .where(eq(identityAccounts.userId, callerUid));

    if (links.length <= 1) {
      return res.status(409).json({ error: 'LAST_LINK_FORBIDDEN' });
    }
    const target = links.find(
      (l) => l.provider === provider && l.providerAccountId === providerAccountId,
    );
    if (!target) {
      return res.status(404).json({ error: 'LINK_NOT_FOUND' });
    }

    try {
      await db
        .delete(identityAccounts)
        .where(
          and(
            eq(identityAccounts.userId, callerUid),
            eq(identityAccounts.provider, provider),
            eq(identityAccounts.providerAccountId, providerAccountId),
          ),
        );
    } catch (err: any) {
      logger.error('[identity/link/unlink] delete failed', {
        callerUid,
        provider,
        error: err?.message,
      });
      return res.status(500).json({ error: 'UNLINK_FAILED' });
    }

    logger.info('[identity/link/unlink] unlinked', {
      callerUid,
      provider,
      providerAccountIdHint: providerAccountId.slice(-6),
    });

    return res.json({
      ok: true,
      provider,
      providerAccountIdHint: providerAccountId.slice(-6),
    });
  },
);

export default router;
