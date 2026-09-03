/**
 * SoftMergeService — read-only projection + write-path guardrails for
 * the CEO-approved legacy-duplicate soft-merge model (D6, auth-rebuild
 * Phase 6.b).
 *
 * ─── MODEL ─────────────────────────────────────────────────────────
 *
 * A super-admin marks SECONDARY as merged INTO PRIMARY by writing
 * `users.merged_into_uid = <PRIMARY_UID>` on the SECONDARY row.
 * Identity resolution follows that pointer (see identityResolver).
 *
 * Money / tax / audit / booking / receipt rows are NEVER re-parented.
 * They stay on their original UID as immutable evidence and remain
 * queryable through the SECONDARY. Only IDENTITY resolution changes.
 *
 * Reversible: clearing merged_into_uid restores both identities.
 *
 * ─── WHAT LIVES HERE ───────────────────────────────────────────────
 *
 * previewMerge(primary, secondary)
 *   Read-only projection. Assembles what a support engineer needs to
 *   see BEFORE approving a merge:
 *     - identity: emails, phone, id_number presence
 *     - auth providers on each side
 *     - passkeys on each side
 *     - open sessions on each side
 *     - money: wallet balances, loyalty points, gift card balance
 *     - bookings: counts
 *     - provider state
 *     - staff / admin privileges
 *     - conflict flags requiring human judgement
 *
 *   NEVER writes. NEVER reads raw idNumber (returns presence only).
 *   Emails / phones are masked in the response (last-4 shown for phone,
 *   first-char + domain for email).
 *
 * validateMergeRequest(primary, secondary)
 *   The write-side guardrails: self-merge rejection, already-merged
 *   detection, chain-detection, existence checks. Runs BEFORE any
 *   write. Every rejection includes a machine-readable code so the
 *   admin UI can render a specific message.
 *
 * ─── WHAT DOESN'T LIVE HERE ────────────────────────────────────────
 *
 * The actual UPDATE statement that writes merged_into_uid + emits the
 * audit event lives in the router handler alongside the transaction
 * and step-up proof — the router owns the write, this service owns
 * the *understanding* of what a merge would do.
 */
import { db } from '../db';
import {
  users,
  identityAccounts,
  userPasskeys,
  sessionsPw,
  walletAccounts,
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { resolveCanonicalUid } from '../identity/identityResolver';

// ─── Types the API returns ──────────────────────────────────────────

export interface UidProjection {
  uid: string;
  exists: boolean;
  isMergedSecondary: boolean;
  mergedIntoUid: string | null;

  identity: {
    emailMasked: string | null;
    emailVerified: boolean;
    phoneMasked: string | null;
    hasIdNumber: boolean;
    firstName: string | null;
    lastName: string | null;
    role: string | null;
    userStatus: string | null;
    accessLevel: number | null;
    blocked: boolean;
  };

  authProviders: Array<{
    provider: string;
    emailMasked: string | null;
    emailVerified: boolean;
    isPrimary: boolean;
    linkedAt: string | null;
    lastUsedAt: string | null;
  }>;

  passkeys: {
    count: number;
    activeCount: number;
    lastUsedAt: string | null;
  };

  activeSessions: {
    count: number;
  };

  money: {
    hasWallet: boolean;
    cashWalletBalanceCents: number;
    egiftBalanceCents: number;
    loyaltyPointsBalance: number;
    washPackageCredits: number;
    lifetimeEarnedCents: number;
  };

  privileges: {
    role: string | null;
    accessLevel: number | null;
  };
}

export interface MergePreview {
  primary: UidProjection;
  secondary: UidProjection;
  conflicts: Array<{
    code: string;
    severity: 'BLOCK' | 'WARN' | 'INFO';
    detail: string;
  }>;
  recommendation: 'PROCEED' | 'REVIEW' | 'REJECT';
  generatedAt: string;
}

// ─── Masking helpers (never leak raw PII in responses) ──────────────

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const head = email.slice(0, 1);
  return `${head}***@${email.slice(at + 1)}`;
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 2) return '**';
  return `${'*'.repeat(Math.max(2, digits.length - 2))}${digits.slice(-2)}`;
}

// ─── Per-UID projector ──────────────────────────────────────────────

async function projectUid(uid: string): Promise<UidProjection> {
  const [u] = await db.select().from(users).where(eq(users.id, uid)).limit(1);

  if (!u) {
    return {
      uid,
      exists: false,
      isMergedSecondary: false,
      mergedIntoUid: null,
      identity: {
        emailMasked: null,
        emailVerified: false,
        phoneMasked: null,
        hasIdNumber: false,
        firstName: null,
        lastName: null,
        role: null,
        userStatus: null,
        accessLevel: null,
        blocked: false,
      },
      authProviders: [],
      passkeys: { count: 0, activeCount: 0, lastUsedAt: null },
      activeSessions: { count: 0 },
      money: {
        hasWallet: false,
        cashWalletBalanceCents: 0,
        egiftBalanceCents: 0,
        loyaltyPointsBalance: 0,
        washPackageCredits: 0,
        lifetimeEarnedCents: 0,
      },
      privileges: { role: null, accessLevel: null },
    };
  }

  const ia = await db
    .select({
      provider: identityAccounts.provider,
      email: identityAccounts.email,
      emailVerified: identityAccounts.emailVerified,
      isPrimary: identityAccounts.isPrimary,
      linkedAt: identityAccounts.linkedAt,
      lastUsedAt: identityAccounts.lastUsedAt,
    })
    .from(identityAccounts)
    .where(eq(identityAccounts.userId, uid));

  // Passkey counts (active vs total). `isRevoked` was added in
  // migration 0134 and is nullable/false on legacy rows.
  const pkRows = await db
    .select({
      isRevoked: userPasskeys.isRevoked,
      lastUsedAt: userPasskeys.lastUsedAt,
    })
    .from(userPasskeys)
    .where(eq(userPasskeys.userId, uid));

  const passkeyCount = pkRows.length;
  const passkeyActiveCount = pkRows.filter((r) => r.isRevoked !== true).length;
  const passkeyLastUsedAt = pkRows
    .map((r) => r.lastUsedAt)
    .filter(Boolean)
    .sort()
    .pop();

  const [sessCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sessionsPw)
    .where(sql`${sessionsPw.userId} = ${uid} AND ${sessionsPw.revokedAt} IS NULL`);

  const [w] = await db
    .select()
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, uid))
    .limit(1);

  return {
    uid,
    exists: true,
    isMergedSecondary: !!u.mergedIntoUid,
    mergedIntoUid: u.mergedIntoUid ?? null,
    identity: {
      emailMasked: maskEmail(u.email),
      // users table doesn't carry a persistent emailVerified scalar in
      // some legacy shapes — trust the strongest identity_accounts
      // row instead (below).
      emailVerified: ia.some((r) => r.emailVerified === true && (r.email ?? '') === (u.email ?? '')),
      phoneMasked: maskPhone(u.phone),
      hasIdNumber: !!(u.idNumberEnc || u.idNumberHash),
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      role: u.role ?? null,
      userStatus: u.userStatus ?? null,
      accessLevel: u.accessLevel ?? null,
      blocked: u.blocked === true,
    },
    authProviders: ia.map((r) => ({
      provider: r.provider,
      emailMasked: maskEmail(r.email),
      emailVerified: r.emailVerified === true,
      isPrimary: r.isPrimary === true,
      linkedAt: r.linkedAt ? new Date(r.linkedAt).toISOString() : null,
      lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : null,
    })),
    passkeys: {
      count: passkeyCount,
      activeCount: passkeyActiveCount,
      lastUsedAt: passkeyLastUsedAt ? new Date(passkeyLastUsedAt as any).toISOString() : null,
    },
    activeSessions: { count: sessCount?.n ?? 0 },
    money: {
      hasWallet: !!w,
      cashWalletBalanceCents: w?.cashWalletBalanceCents ?? 0,
      egiftBalanceCents: w?.egiftBalanceCents ?? 0,
      loyaltyPointsBalance: w?.loyaltyPointsBalance ?? 0,
      washPackageCredits: w?.washPackageCredits ?? 0,
      lifetimeEarnedCents: w?.lifetimeEarnedCents ?? 0,
    },
    privileges: {
      role: u.role ?? null,
      accessLevel: u.accessLevel ?? null,
    },
  };
}

// ─── Conflict evaluator ─────────────────────────────────────────────

function evaluateConflicts(
  primary: UidProjection,
  secondary: UidProjection,
): { conflicts: MergePreview['conflicts']; recommendation: MergePreview['recommendation'] } {
  const conflicts: MergePreview['conflicts'] = [];

  if (!primary.exists) {
    conflicts.push({ code: 'PRIMARY_NOT_FOUND', severity: 'BLOCK', detail: 'Primary UID has no users row.' });
  }
  if (!secondary.exists) {
    conflicts.push({ code: 'SECONDARY_NOT_FOUND', severity: 'BLOCK', detail: 'Secondary UID has no users row.' });
  }
  if (primary.isMergedSecondary) {
    conflicts.push({
      code: 'PRIMARY_IS_ALREADY_A_SECONDARY',
      severity: 'BLOCK',
      detail: `Primary ${primary.uid} is itself merged into ${primary.mergedIntoUid}. Merge cannot chain — pick the true primary.`,
    });
  }
  if (secondary.isMergedSecondary) {
    conflicts.push({
      code: 'SECONDARY_ALREADY_MERGED',
      severity: 'BLOCK',
      detail: `Secondary ${secondary.uid} is already merged into ${secondary.mergedIntoUid}. Unmerge first if you need to change the target.`,
    });
  }

  // Money conflicts — both sides having balances is a WARN, not a
  // BLOCK. Merging does NOT touch balances (money stays on original
  // uid). But support should know before proceeding.
  const primaryHasMoney =
    primary.money.cashWalletBalanceCents > 0 ||
    primary.money.egiftBalanceCents > 0 ||
    primary.money.loyaltyPointsBalance > 0 ||
    primary.money.washPackageCredits > 0;
  const secondaryHasMoney =
    secondary.money.cashWalletBalanceCents > 0 ||
    secondary.money.egiftBalanceCents > 0 ||
    secondary.money.loyaltyPointsBalance > 0 ||
    secondary.money.washPackageCredits > 0;
  if (primaryHasMoney && secondaryHasMoney) {
    conflicts.push({
      code: 'BOTH_SIDES_HAVE_MONEY',
      severity: 'WARN',
      detail:
        'Both sides carry non-zero balances. Soft-merge does NOT move balances — they remain on original uid. If the user expects balances to combine, that is a separate ledger operation (out of scope for soft-merge).',
    });
  }

  // Privilege conflicts — if one side is staff/admin/super_admin and
  // the merge target isn't, the ADMIN role would effectively "move"
  // (identity resolution now returns the primary; capability lookup
  // runs against the primary uid). That's a real change of authority
  // and needs human review.
  const PRIVILEGED = new Set(['admin', 'super_admin', 'management', 'staff', 'ceo', 'finance']);
  const secondaryIsPrivileged = PRIVILEGED.has(secondary.identity.role ?? '');
  const primaryIsPrivileged = PRIVILEGED.has(primary.identity.role ?? '');
  if (secondaryIsPrivileged && !primaryIsPrivileged) {
    conflicts.push({
      code: 'SECONDARY_IS_PRIVILEGED',
      severity: 'WARN',
      detail: `Secondary has role=${secondary.identity.role}; primary has role=${primary.identity.role ?? 'null'}. Merging routes future auth to primary — privilege effectively moves. Confirm the intent.`,
    });
  }
  if (primaryIsPrivileged && secondaryIsPrivileged && primary.identity.role !== secondary.identity.role) {
    conflicts.push({
      code: 'BOTH_PRIVILEGED_DIFFERENT_ROLES',
      severity: 'WARN',
      detail: `Both sides are privileged with different roles (${primary.identity.role} vs ${secondary.identity.role}). Confirm which role the user should operate as.`,
    });
  }

  // Blocked user cannot be a primary target (would resurrect access).
  if (primary.identity.blocked) {
    conflicts.push({
      code: 'PRIMARY_BLOCKED',
      severity: 'BLOCK',
      detail: 'Primary user is currently blocked. Cannot route another identity into a blocked account.',
    });
  }

  // Active sessions on secondary won't be revoked by soft-merge (they
  // resolve to primary on next request), but support should know.
  if (secondary.activeSessions.count > 0) {
    conflicts.push({
      code: 'SECONDARY_HAS_ACTIVE_SESSIONS',
      severity: 'INFO',
      detail: `Secondary has ${secondary.activeSessions.count} active session(s). Post-merge, those sessions resolve to primary. Consider revoking them if audit clarity is important.`,
    });
  }

  // Passkeys on both sides — soft-merge does NOT re-parent passkey
  // rows (they stay on their original uid), but identity resolution
  // will return primary for a passkey-authenticated login from the
  // secondary's credential. INFO-level surfacing.
  if (primary.passkeys.activeCount > 0 && secondary.passkeys.activeCount > 0) {
    conflicts.push({
      code: 'BOTH_HAVE_PASSKEYS',
      severity: 'INFO',
      detail: `Primary has ${primary.passkeys.activeCount} active passkey(s), secondary has ${secondary.passkeys.activeCount}. All will authenticate as primary after merge.`,
    });
  }

  const anyBlock = conflicts.some((c) => c.severity === 'BLOCK');
  const anyWarn = conflicts.some((c) => c.severity === 'WARN');
  const recommendation: MergePreview['recommendation'] = anyBlock
    ? 'REJECT'
    : anyWarn
    ? 'REVIEW'
    : 'PROCEED';

  return { conflicts, recommendation };
}

/**
 * Read-only preview. See top-of-file docstring for what it does not do.
 */
export async function previewMerge(primaryUid: string, secondaryUid: string): Promise<MergePreview> {
  const [primary, secondary] = await Promise.all([projectUid(primaryUid), projectUid(secondaryUid)]);
  const { conflicts, recommendation } = evaluateConflicts(primary, secondary);
  return {
    primary,
    secondary,
    conflicts,
    recommendation,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Write-side validation (called BEFORE any UPDATE) ───────────────

export type ValidateMergeError =
  | { code: 'SELF_MERGE'; uid: string }
  | { code: 'PRIMARY_NOT_FOUND'; uid: string }
  | { code: 'SECONDARY_NOT_FOUND'; uid: string }
  | { code: 'SECONDARY_ALREADY_MERGED'; into: string }
  | { code: 'PRIMARY_IS_ALREADY_A_SECONDARY'; into: string }
  | { code: 'PREVIEW_STALE_OR_MISSING' }
  | { code: 'RECOMMENDATION_REJECT'; conflicts: MergePreview['conflicts'] };

/**
 * Runs the write-side gate. Returns ok:true when a merge is safe to
 * write, otherwise a structured error. Callers must ALSO verify a
 * fresh preview against the confirmedPreviewAt timestamp — this
 * function only enforces the identity-shape invariants that survive
 * across preview→write.
 */
export async function validateMergeRequest(
  primaryUid: string,
  secondaryUid: string,
): Promise<{ ok: true } | { ok: false; error: ValidateMergeError }> {
  if (!primaryUid || !secondaryUid) {
    return { ok: false, error: { code: 'PRIMARY_NOT_FOUND', uid: primaryUid || secondaryUid } };
  }
  if (primaryUid === secondaryUid) {
    return { ok: false, error: { code: 'SELF_MERGE', uid: primaryUid } };
  }

  // Neither side may already be merged (chain protection). Resolve
  // both — resolution against a primary is a no-op that confirms
  // existence.
  const [pRes, sRes] = await Promise.all([
    resolveCanonicalUid(primaryUid),
    resolveCanonicalUid(secondaryUid),
  ]);

  if (!pRes.ok) {
    if (pRes.error.code === 'NOT_FOUND') return { ok: false, error: { code: 'PRIMARY_NOT_FOUND', uid: primaryUid } };
    logger.error('[SoftMergeService] Primary resolve failed', { primaryUid, error: pRes.error });
    return { ok: false, error: { code: 'PRIMARY_NOT_FOUND', uid: primaryUid } };
  }
  if (!sRes.ok) {
    if (sRes.error.code === 'NOT_FOUND') return { ok: false, error: { code: 'SECONDARY_NOT_FOUND', uid: secondaryUid } };
    logger.error('[SoftMergeService] Secondary resolve failed', { secondaryUid, error: sRes.error });
    return { ok: false, error: { code: 'SECONDARY_NOT_FOUND', uid: secondaryUid } };
  }

  if (pRes.result.canonicalUid !== primaryUid) {
    return { ok: false, error: { code: 'PRIMARY_IS_ALREADY_A_SECONDARY', into: pRes.result.canonicalUid } };
  }
  if (sRes.result.canonicalUid !== secondaryUid) {
    return { ok: false, error: { code: 'SECONDARY_ALREADY_MERGED', into: sRes.result.canonicalUid } };
  }

  return { ok: true };
}
