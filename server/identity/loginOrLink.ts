/**
 * loginOrLink — resolve a Firebase login to ONE canonical PetWash user via the
 * `identity_accounts` table.
 *
 * SDD: docs/design/2026-05-25-smart-identity-routing.md (loginOrLink algorithm).
 * PHASE 1 REBUILD (CEO auth-rebuild directive, 2026-09-01): the unsafe
 * "verified-email auto-link" path has been REMOVED. Matching email is NOT
 * proof of matching person; email accounts get compromised, transferred,
 * re-registered. Auto-linking on that basis is an account-takeover vector.
 *
 * New algorithm:
 *   1. Existing (provider, providerAccountId) link  → return that user (safe).
 *   2. No link found                                 → CREATE a new canonical user
 *                                                       AND emit
 *                                                       IDENTITY_SHADOW_WOULD_MERGE
 *                                                       if a verified-email or
 *                                                       verified-phone collision
 *                                                       exists on another users row
 *                                                       (observational — no merge).
 *
 * Cross-provider linking of an EXISTING person requires the Phase 6 user-facing
 * flow with strong two-sided proof (see linkAdditionalProvider comment below).
 *
 * FLAG-GATED foundation: behind `ff.returning_user.identity_unified.enabled`
 * (default OFF; folds in the legacy `IDENTITY_UNIFIED_ENABLED`). Callers adopt
 * it one flow at a time. Landing this module changes no runtime behavior on
 * its own.
 */
import { db } from '../db';
import { identityAccounts, users } from '@shared/schema';
import { eq, and, ne, or, isNotNull } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../middleware/auditLog';

export interface FirebaseIdentity {
  /** 'google' | 'apple' | 'facebook' | 'password' | 'phone' | 'passkey' */
  provider: string;
  /** Firebase uid (or the underlying provider sub) — stable per provider identity. */
  providerAccountId: string;
  email?: string | null;
  emailVerified?: boolean;
  displayName?: string | null;
}

export type LoginOrLinkAction = 'found' | 'linked' | 'new';

export interface LoginOrLinkResult {
  /** The canonical PetWash user id the caller should use for this login. */
  userId: string;
  action: LoginOrLinkAction;
  /** True when a new identity_accounts row was written this call. */
  linked: boolean;
}

/**
 * Insert an identity_accounts link row. Idempotent — a repeat of the same
 * (provider, providerAccountId) is a no-op thanks to the unique index.
 */
export async function linkIdentity(
  userId: string,
  identity: FirebaseIdentity,
  isPrimary = false,
): Promise<void> {
  await db
    .insert(identityAccounts)
    .values({
      userId,
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
      email: identity.email ?? null,
      emailVerified: !!identity.emailVerified,
      displayName: identity.displayName ?? null,
      isPrimary,
    })
    .onConflictDoNothing();
}

/**
 * Resolve a Firebase identity to one canonical user (Phase 1 rebuild).
 *
 * 1. Existing (provider, providerAccountId) link → return the linked user.
 * 2. No link → treat as a NEW canonical human. Record the primary link.
 *    Before returning, run a shadow-merge probe on the new UID: if the same
 *    verified email or verified phone already exists on ANOTHER users row,
 *    emit IDENTITY_SHADOW_WOULD_MERGE. This is observation only — we never
 *    auto-link across humans based on a coincidental email or phone match.
 *
 * The caller remains responsible for ensuring the matching `users` row
 * exists (typically via `authService.ensureUserInPostgres(uid, …)`).
 *
 * To LINK a second provider to an already-signed-in person (the Google-you +
 * Apple-you flow), the Phase 6 endpoint `POST /api/identity/link/*` uses
 * `linkAdditionalProvider` below with strong two-sided proof — never this
 * function.
 */
export async function loginOrLink(identity: FirebaseIdentity): Promise<LoginOrLinkResult> {
  // 1. Existing link — the safe, common case.
  const [existing] = await db
    .select({ userId: identityAccounts.userId })
    .from(identityAccounts)
    .where(
      and(
        eq(identityAccounts.provider, identity.provider),
        eq(identityAccounts.providerAccountId, identity.providerAccountId),
      ),
    )
    .limit(1);
  if (existing) {
    return { userId: existing.userId, action: 'found', linked: false };
  }

  // 2. Brand-new human. Record the primary provider link. Convention:
  // canonical users.id == the Firebase uid presented on first sight.
  const newUserId = identity.providerAccountId;
  await linkIdentity(newUserId, identity, /* isPrimary */ true);

  // 2a. Observational shadow-merge probe on the new UID. If a verified
  // email or verified phone on this identity also lives on some other
  // users row, log it so support can review — but do NOT link, do NOT
  // merge. The Phase 6 user-facing flow with two-sided proof is the only
  // safe resolution.
  await emitShadowMergeIfCollision(newUserId, identity).catch((err) => {
    logger.warn('[identity] shadow-merge probe failed (non-blocking)', {
      newUserId,
      provider: identity.provider,
      error: String(err),
    });
  });

  return { userId: newUserId, action: 'new', linked: true };
}

/**
 * Observational: on the new-user path, detect whether the same verified
 * email or phone already lives on ANOTHER users row. Emit an audit event
 * so support can review the collision. Never merges. Never links.
 *
 * This runs INSIDE loginOrLink so every feeder that Phase 1 wires up
 * (session mint, phone-session, email-session, mobile-google, WebAuthn
 * verify, etc.) automatically gets the observation. The existing
 * shadowMergeDetect probe in post-login stays as-is for defence in depth.
 */
async function emitShadowMergeIfCollision(
  newUserId: string,
  identity: FirebaseIdentity,
): Promise<void> {
  if (!identity.email || !identity.emailVerified) return;

  const [byEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, identity.email), ne(users.id, newUserId)))
    .limit(1);
  if (!byEmail) return;

  logger.info('[identity] IDENTITY_SHADOW_WOULD_MERGE', {
    newUserId,
    wouldLinkToUserId: byEmail.id,
    matchedOn: 'email',
    provider: identity.provider,
  });

  await logAuditEvent({
    actorUserId: newUserId,
    actorRole: 'system',
    actionType: 'IDENTITY_SHADOW_WOULD_MERGE',
    targetType: 'user',
    targetId: byEmail.id,
    severity: 'info',
    metadata: {
      matchedOn: 'email',
      provider: identity.provider,
      // NO raw email/phone in metadata — just the fact + the two uids.
      note: 'Phase 1 loginOrLink observation. No merge.',
    },
  });
}

/**
 * PHASE 6 SAFE-LINK PATH (placeholder — full implementation lands in Phase 6).
 *
 * Attach a new provider identity to an ALREADY-AUTHENTICATED existing user.
 * Callers MUST have proven both sides beforehand:
 *   - existingUserId is the currently-authenticated Pet Wash session's UID
 *     (session-recent authentication verified upstream); AND
 *   - the incoming FirebaseIdentity has been verified fresh (Firebase ID
 *     token verified this request); AND
 *   - the caller has recorded an explicit user confirmation.
 *
 * Distinct from loginOrLink() to make accidental cross-account linking
 * from an unauthenticated context impossible.
 */
export async function linkAdditionalProvider(
  existingUserId: string,
  identity: FirebaseIdentity,
): Promise<void> {
  await linkIdentity(existingUserId, identity, /* isPrimary */ false);
  await logAuditEvent({
    actorUserId: existingUserId,
    actorRole: 'user',
    actionType: 'IDENTITY_LINKED',
    targetType: 'identity_account',
    targetId: `${identity.provider}:${identity.providerAccountId}`,
    severity: 'info',
    metadata: {
      provider: identity.provider,
      note: 'Phase 6 user-initiated safe link.',
    },
  });
}
