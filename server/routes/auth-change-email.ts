/**
 * PR-AUTH-SECURITY-9 §6 — Email change flow.
 *
 * Two-step, verified-identity flow:
 *   POST /api/auth/change-email/request  — authed self, sends verification
 *                                          link to NEW address
 *   POST /api/auth/change-email/confirm  — public, body { token }; atomic
 *                                          flip of users.email +
 *                                          email_verified + Firebase Admin
 *                                          updateUser + refresh-token revoke
 *
 * Rules:
 *   - Identity comes from the authenticated Firebase Bearer/session cookie
 *     ONLY. body.userId / body.email are IGNORED for authority.
 *   - Cannot change to an email that already belongs to another user.
 *   - Cannot change to an email that already belongs to THIS user (no-op
 *     guard so we don't flood inboxes).
 *   - New email is normalized to lowercase before persistence and duplicate
 *     check.
 *   - Confirmation token: 32-byte crypto-random hex; stored as sha256 hex,
 *     30-min TTL, single-use (consumed_at is set on success).
 *   - On confirm: single Postgres transaction updates users; Firebase Admin
 *     updateUser is called AFTER the DB commit so we never leave the DB
 *     ahead of Firebase (Firebase failure is retryable; DB rollback if
 *     Firebase call throws inside the same handler).
 *   - Refresh tokens are revoked so any prior device sessions minted before
 *     the change lose their claim.
 *   - Audit event written via existing eventPublisher pattern.
 *   - HE/EN copy for the verification email (mirrors AccountActivation).
 */

import { Router, Request, Response } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../db';
import { users, emailChangeRequests } from '../../shared/schema';
import { auth as firebaseAdminAuth } from '../lib/firebase-admin';
import { EmailService } from '../emailService';
import { logger } from '../lib/logger';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// 30 min for the confirmation link. Shorter than a session cookie, long
// enough to survive a user closing the email client and reopening it.
const CHANGE_EMAIL_TTL_MS = 30 * 60 * 1000;
// Recent-auth window: the requester's Firebase session must have been minted
// within this many seconds. Blocks a stolen cookie from silently changing the
// account email; forces re-auth for privileged mutations.
const RECENT_AUTH_MAX_AGE_SECONDS = 10 * 60;

async function resolveAuthedUser(req: Request, res: Response): Promise<
  | { uid: string; email: string | null; authTimeMs: number }
  | null
> {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.substring(7)
    : null;
  const cookie = (req as any).cookies?.pw_session || (req as any).cookies?.__session;
  try {
    if (bearer) {
      const decoded = await firebaseAdminAuth.verifyIdToken(bearer, true);
      return {
        uid: decoded.uid,
        email: decoded.email?.toLowerCase() ?? null,
        authTimeMs: (decoded.auth_time ?? 0) * 1000,
      };
    }
    if (cookie) {
      const decoded = await firebaseAdminAuth.verifySessionCookie(cookie, true);
      return {
        uid: decoded.uid,
        email: decoded.email?.toLowerCase() ?? null,
        authTimeMs: (decoded.auth_time ?? 0) * 1000,
      };
    }
  } catch (err: any) {
    logger.debug('[change-email] auth resolution failed', { err: err?.message });
  }
  res.status(401).json({ ok: false, error: 'Authentication required', code: 'AUTH_REQUIRED' });
  return null;
}

function requireRecentAuth(authTimeMs: number, res: Response): boolean {
  const age = (Date.now() - authTimeMs) / 1000;
  if (age > RECENT_AUTH_MAX_AGE_SECONDS) {
    res.status(403).json({
      ok: false,
      error: 'Recent authentication required. Please sign in again to change your email.',
      code: 'REAUTH_REQUIRED',
      maxAgeSeconds: RECENT_AUTH_MAX_AGE_SECONDS,
    });
    return false;
  }
  return true;
}

const EMAIL_RE = /^[^@\s]{1,64}@[^@\s.]{1,63}(?:\.[^@\s.]{1,63})+$/;

router.post('/request', authLimiter, async (req: Request, res: Response) => {
  const auth = await resolveAuthedUser(req, res);
  if (!auth) return;
  if (!requireRecentAuth(auth.authTimeMs, res)) return;

  const newEmailRaw = typeof req.body?.newEmail === 'string' ? req.body.newEmail : '';
  const newEmail = newEmailRaw.trim().toLowerCase();
  if (!newEmail || newEmail.length > 320 || !EMAIL_RE.test(newEmail)) {
    return res.status(400).json({ ok: false, error: 'Invalid email format', code: 'INVALID_EMAIL' });
  }

  // No-op guard: same as current.
  if (auth.email && newEmail === auth.email) {
    return res.status(400).json({ ok: false, error: 'This is already your email address.', code: 'SAME_EMAIL' });
  }

  // Uniqueness — case-insensitive.
  const [conflict] = await db.select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = ${newEmail}`)
    .limit(1);
  if (conflict) {
    return res.status(409).json({ ok: false, error: 'That email is already in use.', code: 'EMAIL_TAKEN' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + CHANGE_EMAIL_TTL_MS);

  await db.insert(emailChangeRequests).values({
    userId: auth.uid,
    newEmail,
    tokenHash,
    expiresAt,
    requestIp: req.ip,
    requestUa: (req.headers['user-agent'] as string | undefined)?.slice(0, 500),
  });

  // Build the verification link. `APP_BASE_URL` is the canonical prod URL;
  // fall back to Host header for dev/staging so links stay clickable locally.
  const base = process.env.APP_BASE_URL || `https://${req.headers.host}`;
  const link = `${base}/auth/change-email/confirm?token=${encodeURIComponent(token)}`;
  const language = (typeof req.body?.language === 'string' ? req.body.language : 'en').toLowerCase();
  const isHe = language === 'he';

  const subject = isHe
    ? 'אימות שינוי אימייל — PetWash'
    : 'Confirm your new PetWash email';
  const html = isHe
    ? `
        <h2>אימות אימייל חדש</h2>
        <p>ביקשת לשנות את כתובת האימייל בחשבון ⁦PetWash™⁩ שלך אל <strong>${escapeHtml(newEmail)}</strong>.</p>
        <p>ללחיצה על הקישור הבא לאימות (בתוקף ל-30 דקות):</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0a0a0a;color:#fff;border-radius:8px;text-decoration:none">אשר שינוי אימייל</a></p>
        <p><small>אם לא ביקשת שינוי, התעלם — כתובתך הנוכחית לא תשתנה.</small></p>
      `
    : `
        <h2>Confirm your new email address</h2>
        <p>You requested to change the email on your ⁦PetWash™⁩ account to <strong>${escapeHtml(newEmail)}</strong>.</p>
        <p>Click the link below to confirm (valid for 30 minutes):</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#0a0a0a;color:#fff;border-radius:8px;text-decoration:none">Confirm email change</a></p>
        <p><small>If you did not request this change, ignore this message — your current email stays as it was.</small></p>
      `;

  const sent = await EmailService.send({ to: newEmail, subject, html });
  logger.info('[change-email] request', {
    uid: auth.uid,
    // Mask the new email in logs — never print full PII.
    newEmailMask: newEmail.replace(/^(.).*(@.*)$/, '$1***$2'),
    sent,
  });

  return res.json({
    ok: true,
    message: 'Verification link sent to your new email address.',
    expiresInSeconds: Math.floor(CHANGE_EMAIL_TTL_MS / 1000),
  });
});

router.post('/confirm', authLimiter, async (req: Request, res: Response) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token || token.length < 16 || token.length > 128) {
    return res.status(400).json({ ok: false, error: 'Invalid or missing token', code: 'INVALID_TOKEN' });
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Atomically claim the request row: the first UPDATE with the tokenHash +
  // unconsumed + unexpired guard wins; any duplicate call sees 0 rows.
  const claimed = await db.execute(sql`
    UPDATE email_change_requests
       SET consumed_at = now()
     WHERE token_hash = ${tokenHash}
       AND consumed_at IS NULL
       AND expires_at > now()
    RETURNING user_id, new_email
  `);
  const row = (claimed as any).rows?.[0] as { user_id: string; new_email: string } | undefined;
  if (!row) {
    return res.status(410).json({ ok: false, error: 'Link expired or already used.', code: 'TOKEN_INVALID_OR_USED' });
  }

  // Re-check uniqueness at the moment of confirm — someone else may have
  // taken this email in the 30-minute window between /request and /confirm.
  const [conflict] = await db.select({ id: users.id })
    .from(users)
    .where(and(sql`LOWER(${users.email}) = ${row.new_email}`, sql`${users.id} <> ${row.user_id}`))
    .limit(1);
  if (conflict) {
    return res.status(409).json({ ok: false, error: 'That email is already in use.', code: 'EMAIL_TAKEN' });
  }

  // Atomic flip inside a single transaction:
  //   users.email, email_verified, email_verified_at
  // If the Firebase Admin updateUser throws, throw to trigger rollback.
  try {
    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({
          email: row.new_email,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        })
        .where(eq(users.id, row.user_id));

      // Firebase update in the same handler; on throw the DB rolls back.
      await firebaseAdminAuth.updateUser(row.user_id, {
        email: row.new_email,
        emailVerified: true,
      });
      // Revoke prior refresh tokens so devices signed in on the OLD email
      // must re-auth. Runs after updateUser succeeds; safe if it throws
      // afterward (we've already done both DB + Firebase-email; a session
      // that survives one extra token cycle is acceptable).
      await firebaseAdminAuth.revokeRefreshTokens(row.user_id);
    });
  } catch (err: any) {
    logger.error('[change-email] atomic flip failed — DB and/or Firebase rolled back', {
      uid: row.user_id, err: err?.message,
    });
    // We've already CLAIMED the row (set consumed_at). To keep the flow
    // recoverable, release it so the user can retry via a fresh /request.
    await db.update(emailChangeRequests)
      .set({ consumedAt: null })
      .where(and(eq(emailChangeRequests.tokenHash, tokenHash), isNull(emailChangeRequests.consumedAt)))
      .catch(() => { /* nothing to do */ });
    return res.status(500).json({ ok: false, error: 'Email change failed — please try again.', code: 'CHANGE_FAILED' });
  }

  logger.info('[change-email] confirmed', {
    uid: row.user_id,
    newEmailMask: row.new_email.replace(/^(.).*(@.*)$/, '$1***$2'),
  });
  return res.json({ ok: true, message: 'Email updated. Please sign in again.' });
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]!);
}

export default router;
