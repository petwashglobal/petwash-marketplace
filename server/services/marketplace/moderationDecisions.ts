/**
 * moderationDecisions — CEO DEEP-LOGIC §16, §17, §18.
 *
 * Two-stage moderation handshake for WARN_BEFORE_SEND. The prior wire
 * blocked only BLOCK / BLOCK_AND_REVIEW / SAFETY_ESCALATION — every
 * WARN_BEFORE_SEND outcome fell through and SENT immediately,
 * contradicting the name. This module owns the missing state.
 *
 * Handshake:
 *   1. Client POSTs a message. Policy → WARN_BEFORE_SEND.
 *   2. Server issues a signed `moderationDecisionId` token bound to
 *      (sender, thread, exact message hash, policy version, category)
 *      and returns HTTP 409 with { status: "WARNING_REQUIRED",
 *      moderationDecisionId, category, reasonCode: "MODERATION_WARN",
 *      overridable: true }.
 *   3. UI shows: "Keep communication on PetWash. [Edit] [Send Anyway]".
 *   4. Client POSTs again with the same message + moderationDecisionId.
 *   5. Server verifies the signature + bindings + expiry. Valid →
 *      proceed with persistence. Invalid → issue a fresh warning (409
 *      with a new token).
 *
 * BLOCK-family outcomes NEVER reach this path — they always return
 * 403 MODERATION_BLOCK. Which outcomes are overridable is a policy
 * decision baked into evaluateMessage(); this module only implements
 * the handshake for outcomes that the policy already labelled as
 * "warn, don't hard-block" (§17).
 *
 * ALLOW_WITH_NOTICE (§18): a separate helper returns a `notice`
 * payload the caller can include on a normal 200/201 response so the
 * UI can render "For safety, keep payments on PetWash."
 */
import crypto from 'crypto';
import type { PolicyCategory } from '@shared/marketplace/policyEngine';

const WARNING_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

// The signing secret comes from env in production. A random run-scoped
// fallback keeps dev usable without a new required env var — tokens
// simply don't survive a restart, which for a 15-minute warning window
// is acceptable (the client re-arms on the next send).
const WARNING_TOKEN_SECRET =
  process.env.MODERATION_WARN_TOKEN_SECRET ||
  crypto.randomBytes(32).toString('hex');

export interface WarningTokenBindings {
  senderUid: string;
  threadId: string;
  safeContentHash: string;   // sha256 hex of the exact sanitized body
  policyVersion: string;
  category: PolicyCategory;
}

interface DecodedToken extends WarningTokenBindings {
  issuedAt: number;
  expiresAt: number;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload: string): string {
  return base64url(
    crypto.createHmac('sha256', WARNING_TOKEN_SECRET).update(payload).digest(),
  );
}

/**
 * Hash the sanitized body. Kept out of the token — a client re-send
 * carries the body and the server recomputes the hash. Storing the
 * body in the token would defeat retention discipline.
 */
export function hashSafeContent(safeContent: string): string {
  return crypto.createHash('sha256').update(safeContent).digest('hex');
}

export function issueWarningToken(bindings: WarningTokenBindings, now: number = Date.now()): string {
  const decoded: DecodedToken = {
    ...bindings,
    issuedAt: now,
    expiresAt: now + WARNING_TOKEN_TTL_MS,
  };
  const body = base64url(Buffer.from(JSON.stringify(decoded), 'utf8'));
  const sig = sign(body);
  return `${body}.${sig}`;
}

/**
 * Verify the token. Returns null on any mismatch — invalid signature,
 * expiry, or binding drift (sender / thread / body hash / policy
 * version / category). Callers treat null the same as no token: issue
 * a fresh warning.
 */
export function verifyWarningToken(
  token: string | undefined | null,
  expected: WarningTokenBindings,
  now: number = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [body, sig] = parts;
  if (sign(body) !== sig) return { ok: false, reason: 'bad_signature' };
  let decoded: DecodedToken;
  try {
    decoded = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof decoded.expiresAt !== 'number' || decoded.expiresAt < now) {
    return { ok: false, reason: 'expired' };
  }
  if (decoded.senderUid !== expected.senderUid) return { ok: false, reason: 'sender_mismatch' };
  if (decoded.threadId !== expected.threadId) return { ok: false, reason: 'thread_mismatch' };
  if (decoded.safeContentHash !== expected.safeContentHash) return { ok: false, reason: 'body_mismatch' };
  if (decoded.policyVersion !== expected.policyVersion) return { ok: false, reason: 'policy_version_mismatch' };
  if (decoded.category !== expected.category) return { ok: false, reason: 'category_mismatch' };
  return { ok: true };
}

/**
 * Notice payload for ALLOW_WITH_NOTICE — attached to a successful
 * send response so the UI can render an educational line.
 */
export interface AllowWithNoticePayload {
  noticeCode: 'ALLOW_WITH_NOTICE';
  category: PolicyCategory | null;
}
export function buildAllowNoticePayload(category?: PolicyCategory): AllowWithNoticePayload {
  return { noticeCode: 'ALLOW_WITH_NOTICE', category: category ?? null };
}
