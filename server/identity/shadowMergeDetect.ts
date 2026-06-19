/**
 * shadowMergeDetect — OBSERVATIONAL ONLY. Detects whether a just-logged-in
 * Firebase identity WOULD link to a DIFFERENT existing PetWash user than the
 * one the login currently resolves to.
 *
 * ⚠️ SHADOW MODE. This module NEVER:
 *   - changes which user a login resolves to,
 *   - calls loginOrLink / linkIdentity / any merge,
 *   - flips the IDENTITY_UNIFIED_ENABLED flag,
 *   - mutates users / identity_accounts / any table.
 * It only READS (pure SELECTs) and LOGS / records an audit-ledger breadcrumb.
 *
 * Purpose: give us real-world evidence of how many logins WOULD be merged if
 * the unified-identity flag were ever turned on — without touching the riskiest
 * path on the platform. All callers wrap this in try/catch; a shadow failure
 * must NEVER affect login.
 */
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, and, ne } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../middleware/auditLog';

export interface ShadowIdentityInput {
  /** The user id the live login ALREADY resolved to (unchanged by shadow). */
  currentUserId: string;
  /** 'google.com' | 'apple.com' | 'password' | 'phone' | ... (Firebase providerId) */
  provider: string;
  /** Verified email from the Firebase identity (null/undefined if absent/unverified). */
  email?: string | null;
  emailVerified?: boolean;
  /** Verified phone (E.164) from the Firebase identity. */
  phone?: string | null;
  phoneVerified?: boolean;
  ip?: string;
  userAgent?: string;
  traceId?: string;
}

export interface ShadowMergeFinding {
  wouldLinkToUserId: string;
  matchedOn: 'email' | 'phone';
}

/**
 * Compute whether this identity WOULD link to a different user. Pure read.
 * Returns the first finding (verified email preferred, then verified phone).
 * Returns null when nothing would merge (the common case).
 */
export async function detectShadowMerge(
  input: ShadowIdentityInput,
): Promise<ShadowMergeFinding | null> {
  // 1. Verified-email match against a DIFFERENT existing user.
  if (input.email && input.emailVerified) {
    const [byEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, input.email), ne(users.id, input.currentUserId)))
      .limit(1);
    if (byEmail) {
      return { wouldLinkToUserId: byEmail.id, matchedOn: 'email' };
    }
  }

  // 2. Verified-phone match against a DIFFERENT existing user.
  if (input.phone && input.phoneVerified) {
    const [byPhone] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, input.phone), ne(users.id, input.currentUserId)))
      .limit(1);
    if (byPhone) {
      return { wouldLinkToUserId: byPhone.id, matchedOn: 'phone' };
    }
  }

  return null;
}

/**
 * Run the shadow detection + log/record. Fully self-contained and fail-soft —
 * the caller may still wrap it in try/catch, but this function also swallows
 * every error so a shadow failure can never bubble into the login flow.
 */
export async function runShadowMergeProbe(input: ShadowIdentityInput): Promise<void> {
  try {
    const finding = await detectShadowMerge(input);
    if (!finding) return;

    logger.info('[IdentityShadow] would-link', {
      currentUserId: input.currentUserId,
      wouldLinkToUserId: finding.wouldLinkToUserId,
      matchedOn: finding.matchedOn,
      provider: input.provider,
    });

    // Lightweight audit-ledger breadcrumb — distinct action type, NO PII payload.
    // Reuses the existing audit_events ledger (no new table / no migration).
    await logAuditEvent({
      actorUserId: input.currentUserId,
      actorRole: 'system',
      actionType: 'IDENTITY_SHADOW_WOULD_MERGE',
      targetType: 'user',
      targetId: finding.wouldLinkToUserId,
      ip: input.ip,
      userAgent: input.userAgent,
      traceId: input.traceId,
      severity: 'info',
      metadata: {
        matchedOn: finding.matchedOn,
        provider: input.provider,
        // NO raw email/phone — only the fact + the two user ids.
        note: 'SHADOW — nothing merged. Observational only.',
      },
    });
  } catch (err) {
    // Never let shadow detection affect login.
    logger.warn('[IdentityShadow] probe failed (non-blocking)', {
      currentUserId: input.currentUserId,
      error: String(err),
    });
  }
}
