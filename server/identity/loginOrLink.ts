/**
 * loginOrLink — resolve a Firebase login to ONE canonical PetWash user via the
 * `identity_accounts` table, so the same human is a single user_id across providers
 * (Google-you and Apple-you stop becoming two separate accounts).
 *
 * SDD: docs/design/2026-05-25-smart-identity-routing.md (loginOrLink algorithm).
 *
 * FLAG-GATED foundation: behind `ff.identity.unified.enabled` (default OFF). This module
 * is NOT wired into the live login path yet — callers will adopt it one flow at a time
 * once the flag is enabled. Importing/landing it changes no runtime behavior on its own.
 *
 * Lane note: identity-linking is this workstream's lane; the verification engine
 * (verification_challenges) is owned separately. These do not overlap.
 */
import { db } from '../db';
import { identityAccounts, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';

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
 * Resolve a Firebase identity to one canonical user.
 *
 * 1. Already linked  → return the existing canonical user (no write).
 * 2. Verified email matches an existing user → LINK this provider to that user
 *    (this is what merges Google-you and Apple-you).
 * 3. Brand-new human → record the primary link under the provider account id
 *    (current convention: canonical id == Firebase uid). The caller is responsible
 *    for ensuring the matching `users` row exists.
 */
export async function loginOrLink(identity: FirebaseIdentity): Promise<LoginOrLinkResult> {
  // 1. Existing link?
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

  // 2. Attach to an existing user with the SAME verified email.
  if (identity.email && identity.emailVerified) {
    const [byEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, identity.email))
      .limit(1);
    if (byEmail) {
      await linkIdentity(byEmail.id, identity);
      logger.info('[identity] linked provider to existing user by verified email', {
        userId: byEmail.id,
        provider: identity.provider,
      });
      return { userId: byEmail.id, action: 'linked', linked: true };
    }
  }

  // 3. Brand-new human.
  await linkIdentity(identity.providerAccountId, identity, /* isPrimary */ true);
  return { userId: identity.providerAccountId, action: 'new', linked: true };
}
