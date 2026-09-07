/**
 * StepUpService — short-lived, purpose-bound re-auth proof (Phase 7, CEO
 * auth-rebuild directive 2026-09-01 §10).
 *
 * Sensitive operations (change mobile / email / bank / payout, delete
 * account, important admin actions, password changes) require FRESH
 * proof of identity — not just the presence of a valid long-lived
 * session cookie. This service issues and verifies that proof.
 *
 * Design:
 *   - After the caller re-authenticates via passkey / password / OTP,
 *     server calls issueStepUpProof(uid, purpose) → returns an HMAC-
 *     signed opaque token with TTL 5 min (configurable).
 *   - Client includes the token as `X-StepUp-Proof: <token>` on the
 *     sensitive request.
 *   - Server verifies via verifyStepUpProof(uid, purpose, token). No
 *     DB write, no Redis round-trip — verification is a pure HMAC
 *     equality + TTL check.
 *   - The token is BOUND to (uid, purpose) — a proof issued for
 *     'change_mobile' cannot be reused for 'delete_account'.
 *
 * Why HMAC (not a DB row):
 *   - Zero storage. No Redis dependency.
 *   - Server can be horizontally scaled without a shared session store
 *     for the step-up proof itself (the base session cookie already
 *     handles horizontal scale).
 *   - Revocation is TTL-only — that's a deliberate simplification: the
 *     proof lives 5 minutes; a stolen proof buys the attacker 5 minutes
 *     of one sensitive action. If shorter-window revocation becomes a
 *     requirement, add a small "revoked proof jti" Redis set later.
 *
 * Secret:
 *   Reads STEP_UP_HMAC_SECRET from env. In production this MUST be
 *   distinct from any other HMAC secret. Fail-CLOSED if missing.
 *
 * ── v2 (2026-09-06), CEO verification directive §7-8 ────────────────────────
 *
 * v1 bound a proof to (uid, purpose) only. That is not narrow enough for
 * money: "the customer proved who they are, for payouts" would authorise ANY
 * payout, at any amount, to any destination, for the whole TTL. The directive
 * is explicit — a payout proof must not authorise a refund, a wallet
 * adjustment, a bank change, or a different payout.
 *
 * So v2 adds two things and keeps everything else:
 *
 *   BINDING   an optional (operation, targetId, amount) tuple hashed into the
 *             MAC. A proof minted for {payout, po_123, 4200} verifies ONLY
 *             against that exact tuple. Unbound v2 proofs still work for the
 *             identity-change purposes where there is no target to bind to.
 *
 *   ONE-USE   an optional consumption check through the canonical Redis
 *             service. TTL-only was a deliberate v1 simplification; for money
 *             it is not enough, because a proof observed in flight can be
 *             replayed for the rest of its window. consumeStepUpProof() burns
 *             the jti atomically (SETNX), so the second use of a one-shot
 *             proof fails even inside the TTL. Fail-CLOSED when Redis is
 *             unavailable: a money proof that cannot be checked for replay is
 *             not a proof.
 *
 * v1 tokens keep verifying — the version tag distinguishes them — so nothing
 * already issued breaks.
 *
 * The proof NEVER contains the OTP, and issuing one NEVER moves money. It is
 * evidence that authorisation happened; the money service remains the only
 * thing allowed to change a balance, and re-checks its own state.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { consumeOneShotProof } from '../lib/oneShotProof';

/** Closed set of sensitive operations. Extend deliberately. */
export const STEP_UP_PURPOSES = [
  'change_email',
  'change_mobile',
  'change_password',
  // Rebinding WHERE money goes. Distinct from executing a payout — different
  // risk, different audit weight, and a proof for one must not cover the other.
  'change_payout',
  // Executing one specific payout. Always bound to (operation, targetId,
  // amount); see assertMoneyProofIsBound.
  'payout_action',
  'delete_account',
  'link_provider',
  'unlink_provider',
  'admin_dangerous_action',
] as const;
export type StepUpPurpose = (typeof STEP_UP_PURPOSES)[number];

const DEFAULT_TTL_SECONDS = 5 * 60; // 5 minutes
const TOKEN_VERSION_V1 = 'v1';
/**
 * v2 fingerprint = (operation, targetId, amountMinor).
 * v3 fingerprint = (operation, targetId, amountMinor, currency).
 *
 * A new version rather than a quiet change of meaning. v2 tokens exist in the
 * wild for their TTL, and "v2 meant one thing yesterday and another today" is
 * not an auditable wire format. Version-aware decoding below lets in-flight v2
 * identity proofs finish their short life, while NO v1 or v2 proof can ever
 * satisfy a money purpose.
 */
const TOKEN_VERSION_V2 = 'v2';
const TOKEN_VERSION = 'v3';

/**
 * Purposes that move or redirect money. These may only be issued WITH a
 * binding, and are always one-use. Enforced in issueStepUpProof so a caller
 * cannot mint a broad money proof by omitting an argument.
 */
const MONEY_PURPOSES: ReadonlySet<string> = new Set(['payout_action', 'change_payout']);

/**
 * What a proof is allowed to do, beyond "this person, this kind of action".
 *
 * `amount` is in minor units and is part of the MAC, so a proof for 42.00 does
 * not authorise 4200.00 — the single most valuable thing to bind on a money
 * path.
 */
export interface StepUpBinding {
  operation: string;
  targetId: string;
  amountMinor?: number;
  /**
   * ISO-4217, REQUIRED whenever amountMinor is present.
   *
   * An amount with no currency is not an amount. Binding 5000 without ILS
   * means a proof for ₪50.00 and a proof for A$50.00 carry the same
   * fingerprint and are interchangeable — and the two are not worth the same
   * thing. Added before the binding model spreads past ILS-only payouts,
   * because retrofitting it later means invalidating live proofs on a money
   * path instead of a dead one.
   */
  currency?: string;
}

/**
 * The currencies this platform actually deals in. Mirrors the canonical
 * `Currency` union in server/services/unified-booking/types.ts — kept as a
 * runtime Set here because a TypeScript union cannot check a string that
 * arrives from a request body at runtime.
 *
 * This is a real allowlist, not a shape check. Trimming and upper-casing alone
 * would let "BANANA" satisfy a "currency required" test while binding a money
 * proof to a currency that does not exist.
 */
const SUPPORTED_CURRENCIES: ReadonlySet<string> = new Set([
  'ILS', 'USD', 'EUR', 'GBP', 'AUD', 'CAD',
]);

/**
 * Currencies compare case-insensitively and without surrounding space, so
 * 'ils', 'ILS' and ' ILS ' are ONE binding rather than three incompatible
 * ones. Normalising at the fingerprint makes that true on both the issue and
 * the verify side from a single line.
 */
function normaliseCurrency(c: string | undefined): string {
  return (c ?? '').trim().toUpperCase();
}

/** True only for a currency we deliberately support. */
function isSupportedCurrency(c: string | undefined): boolean {
  return SUPPORTED_CURRENCIES.has(normaliseCurrency(c));
}

/**
 * Minor units are whole numbers. A fractional or unsafe amount cannot be
 * represented faithfully in the MAC, and "1000.0000000001" must never be
 * treated as equal to "1000".
 */
function isValidAmountMinor(a: number | undefined): boolean {
  return typeof a === 'number' && Number.isSafeInteger(a) && a > 0;
}

/**
 * PURPOSE-SPECIFIC BINDING REQUIREMENTS.
 *
 * "money purpose -> needs a binding" was too weak: it let an AMOUNTLESS
 * payout_action mint, which authorises a payout of any size to the bound
 * target. The two money purposes are not the same shape and must not share
 * one rule.
 *
 *   payout_action   EXECUTING one payout. operation + targetId + amountMinor
 *                   + currency, all mandatory. There is no such thing as
 *                   authorising "a payout" without a sum.
 *   change_payout   REBINDING where money goes. operation + targetId (the
 *                   exact destination-change request). No amount, because no
 *                   sum is being authorised.
 *
 * An operation string must never be used to smuggle one purpose through the
 * other — the purpose decides the rule, not a free-text field.
 */
function bindingRequirementFailure(
  purpose: string,
  binding: StepUpBinding | undefined,
): string | null {
  if (!MONEY_PURPOSES.has(purpose)) {
    if (binding && (!binding.operation || !binding.targetId)) return 'incomplete_binding';
    if (binding?.amountMinor != null && !isSupportedCurrency(binding.currency)) {
      return 'amount_without_supported_currency';
    }
    return null;
  }

  if (!binding) return 'money_proof_requires_binding';
  if (!binding.operation || !binding.targetId) return 'incomplete_binding';

  if (purpose === 'payout_action') {
    if (!isValidAmountMinor(binding.amountMinor)) return 'payout_requires_amount_minor';
    if (!isSupportedCurrency(binding.currency)) return 'payout_requires_supported_currency';
    return null;
  }

  // change_payout: a destination, not a sum. An amount is not required, but if
  // one is supplied it still has to be coherent.
  if (binding.amountMinor != null) {
    if (!isValidAmountMinor(binding.amountMinor)) return 'invalid_amount_minor';
    if (!isSupportedCurrency(binding.currency)) return 'amount_without_supported_currency';
  }
  return null;
}

function bindingFingerprint(b: StepUpBinding | undefined, secret: string): string {
  if (!b) return '-';
  // Hashed rather than inlined: keeps the token opaque and fixed-length
  // regardless of how long a targetId is, and keeps operation names out of a
  // token that may end up in a log.
  const canonical = [
    b.operation,
    b.targetId,
    b.amountMinor == null ? '' : String(b.amountMinor),
    normaliseCurrency(b.currency),
  ].join('\u0000');
  return b64url(createHmac('sha256', secret).update(canonical, 'utf8').digest()).slice(0, 22);
}

/**
 * The v2 canonical input, kept ONLY so an in-flight v2 identity proof can
 * still be verified for the rest of its TTL. Never reachable for a money
 * purpose — decodeStepUpProof refuses any non-v3 version there.
 *
 * Delete once no v2 token can still be alive (TTL is at most 30 minutes).
 */
function bindingFingerprintV2(b: StepUpBinding | undefined, secret: string): string {
  if (!b) return '-';
  const canonical = [b.operation, b.targetId, b.amountMinor == null ? '' : String(b.amountMinor)].join('\u0000');
  return b64url(createHmac('sha256', secret).update(canonical, 'utf8').digest()).slice(0, 22);
}

/** Key namespace for this proof family in the shared one-shot store. */
const STEP_UP_ONE_SHOT_SCOPE = 'stepup';

export interface DecodedProof {
  version: string;
  uid: string;
  purpose: string;
  issuedAt: number;
  expiresAt: number;
  /** Also the jti a one-use consumption is recorded against. */
  nonce: string;
  /** '-' when the proof carries no binding (v1, or an unbound v2). */
  bindingFingerprint: string;
}

function loadSecret(): string {
  const raw = process.env.STEP_UP_HMAC_SECRET || '';
  if (!raw || raw.length < 32) {
    // Fail CLOSED — the caller receives false from verifyStepUpProof
    // and cannot issue via issueStepUpProof. We log the misconfig
    // once so ops sees it in the boot line.
    logger.error('[StepUpService] STEP_UP_HMAC_SECRET missing or < 32 chars — step-up service is CLOSED');
    return '';
  }
  return raw;
}

function b64url(input: Buffer): string {
  return input.toString('base64url');
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(payload, 'utf8').digest());
}

/**
 * Issue a step-up proof for (uid, purpose). Returns null when the
 * service is misconfigured (no secret) — callers must fail-CLOSED.
 */
export function issueStepUpProof(
  uid: string,
  purpose: StepUpPurpose,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  binding?: StepUpBinding,
): { token: string; expiresAt: Date; jti: string } | null {
  const secret = loadSecret();
  if (!secret) return null;
  if (!uid || !STEP_UP_PURPOSES.includes(purpose)) return null;

  // One rule, per purpose, enforced at ISSUE — so a caller cannot mint a broad
  // money proof by omitting an argument, and every future call site inherits
  // the constraint instead of having to remember it.
  const requirementFailure = bindingRequirementFailure(purpose, binding);
  if (requirementFailure) {
    logger.error('[StepUpService] refused to issue a proof', {
      uid, purpose, reason: requirementFailure, operation: binding?.operation,
    });
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(30, Math.min(30 * 60, ttlSeconds)); // clamp 30s..30min
  const expiresAt = now + ttl;
  const nonce = b64url(randomBytes(12));
  const bindFp = bindingFingerprint(binding, secret);

  const payload = [TOKEN_VERSION, uid, purpose, String(now), String(expiresAt), nonce, bindFp].join('.');
  const mac = sign(payload, secret);
  const token = `${b64url(Buffer.from(payload, 'utf8'))}.${mac}`;

  // Audit issuance. The nonce is the jti a consumption is recorded against, so
  // an operator can match an issue to its use. No token, no OTP, no PII.
  logger.info('[StepUpService] Step-up proof issued', {
    uid,
    purpose,
    jti: nonce,
    bound: !!binding,
    operation: binding?.operation,
    targetId: binding?.targetId,
    amountMinor: binding?.amountMinor,
    currency: normaliseCurrency(binding?.currency) || undefined,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  });

  return { token, expiresAt: new Date(expiresAt * 1000), jti: nonce };
}

/**
 * Verify a step-up proof. Returns true only when:
 *   - service is configured (secret present)
 *   - token is well-formed
 *   - MAC verifies in constant time
 *   - decoded uid matches the passed uid
 *   - decoded purpose matches the passed purpose
 *   - now < expiresAt
 * Any other case returns false. Never throws.
 */
export function verifyStepUpProof(
  uid: string,
  purpose: StepUpPurpose,
  token: string | null | undefined,
  binding?: StepUpBinding,
): boolean {
  return decodeStepUpProof(uid, purpose, token, binding) !== null;
}

/**
 * Verify and return the decoded proof, or null.
 *
 * Same checks as verifyStepUpProof plus the binding comparison, and it hands
 * back the jti so a caller can burn it with consumeStepUpProof().
 */
export function decodeStepUpProof(
  uid: string,
  purpose: StepUpPurpose,
  token: string | null | undefined,
  binding?: StepUpBinding,
): DecodedProof | null {
  const secret = loadSecret();
  if (!secret) return null;
  if (!token || !uid || !STEP_UP_PURPOSES.includes(purpose)) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, macB64] = parts;
    const payload = fromB64url(payloadB64).toString('utf8');
    const expectedMac = sign(payload, secret);
    // Constant-time compare — reject on length mismatch first.
    const providedMac = Buffer.from(macB64, 'utf8');
    const expected = Buffer.from(expectedMac, 'utf8');
    if (providedMac.length !== expected.length) return null;
    if (!timingSafeEqual(providedMac, expected)) return null;

    // MAC verified — now decode + check claims.
    const fields = payload.split('.');
    // v1: 6 fields, no binding. v2: 7, the last being the binding fingerprint.
    if (fields.length !== 6 && fields.length !== 7) return null;
    const decoded: DecodedProof = {
      version: fields[0],
      uid: fields[1],
      purpose: fields[2],
      issuedAt: Number(fields[3]),
      expiresAt: Number(fields[4]),
      nonce: fields[5],
      bindingFingerprint: fields[6] ?? '-',
    };
    if (
      decoded.version !== TOKEN_VERSION
      && decoded.version !== TOKEN_VERSION_V2
      && decoded.version !== TOKEN_VERSION_V1
    ) return null;
    if (decoded.uid !== uid) return null;
    if (decoded.purpose !== purpose) return null;
    if (!Number.isFinite(decoded.expiresAt)) return null;
    if (Math.floor(Date.now() / 1000) >= decoded.expiresAt) return null;

    /**
     * ONLY v3 CAN AUTHORISE MONEY.
     *
     * v1 has no binding field at all, so "this person, for payouts" would
     * authorise any payout. v2 has a binding but its fingerprint does not
     * include the currency, so a v2 proof for 5000 cannot distinguish ILS from
     * AUD. Neither is an acceptable authorisation for moving money, and an old
     * token must not become weaker-but-accepted just because it is still
     * inside its TTL.
     *
     * v1 and v2 remain valid for the identity-change purposes they were
     * designed for, so in-flight change_email / change_mobile proofs finish
     * their short life rather than logging people out mid-flow.
     */
    if (decoded.version !== TOKEN_VERSION && MONEY_PURPOSES.has(purpose)) return null;

    // The binding must match EXACTLY, in both directions: a bound proof
    // cannot be replayed against a different target, and an unbound proof
    // cannot be presented where a binding is required.
    // Fingerprint per the token's OWN version: a v2 proof was minted without
    // currency in the canonical input, so recomputing it the v3 way would
    // reject an in-flight identity proof that is perfectly valid.
    const expectedFp = decoded.version === TOKEN_VERSION
      ? bindingFingerprint(binding, secret)
      : bindingFingerprintV2(binding, secret);
    if (decoded.bindingFingerprint !== expectedFp) return null;

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Atomically burn a proof so it cannot be replayed inside its TTL.
 *
 * TTL-only was v1's deliberate simplification, and it is fine for "change my
 * email": the worst case is the same change applied twice. It is NOT fine for
 * money, where a replay inside the window is a second payout.
 *
 * SETNX on the jti — the first caller wins, every later one is refused. The
 * key is given the proof's own remaining lifetime, so nothing accumulates.
 *
 * FAIL-CLOSED. If Redis is unavailable this returns false and the operation
 * must not proceed: a money proof whose replay status cannot be established
 * is not a proof. That is a deliberate availability-for-safety trade on the
 * money path only — identity-change purposes do not call this.
 */
export async function consumeStepUpProof(proof: DecodedProof): Promise<boolean> {
  const remaining = proof.expiresAt - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return false;

  /**
   * The SETNX, the fail-closed rule and the marker TTL now live in
   * server/lib/oneShotProof.ts, because the email and SMS proofs need the
   * identical answer and a second dialect of "has this been spent" is exactly
   * the duplication the verification consolidation exists to remove.
   *
   * Semantics here are UNCHANGED: first caller wins, every later one refused,
   * and an unreachable store refuses rather than waves through. The shared
   * helper distinguishes replay from outage; this function's contract is a
   * boolean, so both still collapse to false for existing callers.
   */
  const result = await consumeOneShotProof({
    scope: STEP_UP_ONE_SHOT_SCOPE,
    id: `${proof.uid}:${proof.nonce}`,
    ttlSeconds: remaining,
    context: { uid: proof.uid, purpose: proof.purpose },
  });

  // Audit consumption, matching the issuance line by jti.
  logger.info('[StepUpService] Step-up proof consumption', {
    uid: proof.uid, purpose: proof.purpose, jti: proof.nonce, claimed: result.ok,
  });
  if (!result.ok) {
    logger.warn('[StepUpService] step-up proof refused at consumption', {
      uid: proof.uid, purpose: proof.purpose, jti: proof.nonce, reason: result.reason,
    });
  }
  return result.ok;
}

/**
 * The one call a money operation should make.
 *
 * Verifies the proof against the EXACT operation, target and amount, then
 * burns it. Returns false on any failure, and never throws.
 *
 * It does not, and must not, move money. It answers one question —
 * "is this specific action authorised, right now, once?" — and the money
 * service still re-checks its own canonical state and applies the change
 * idempotently.
 */
export async function authoriseMoneyAction(input: {
  uid: string;
  purpose: Extract<StepUpPurpose, 'payout_action' | 'change_payout'>;
  token: string | null | undefined;
  operation: string;
  targetId: string;
  amountMinor?: number;
  /** ISO-4217. Required whenever amountMinor is given — see StepUpBinding. */
  currency?: string;
}): Promise<{ ok: true } | { ok: false; reason: 'INVALID_PROOF' | 'ALREADY_CONSUMED' | 'BINDING_REQUIREMENT_NOT_MET' }> {
  // The caller passing an amount without a currency is a programming error on
  // a money path, so it is refused loudly instead of silently authorising a
  // currency-agnostic amount.
  const authFailure = bindingRequirementFailure(input.purpose, {
    operation: input.operation,
    targetId: input.targetId,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
  if (authFailure) {
    // The same rule as issue time. An amountless payout_action must be
    // impossible to MINT and impossible to AUTHORISE — a caller that reaches
    // here without an amount is a programming error on a money path, refused
    // loudly before Redis is touched.
    logger.error('[StepUpService] money action refused — binding requirement not met', {
      uid: input.uid, purpose: input.purpose, operation: input.operation, reason: authFailure,
    });
    return { ok: false, reason: 'BINDING_REQUIREMENT_NOT_MET' };
  }
  const proof = decodeStepUpProof(input.uid, input.purpose, input.token, {
    operation: input.operation,
    targetId: input.targetId,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
  if (!proof) {
    logger.warn('[StepUpService] money action refused — no valid bound proof', {
      uid: input.uid, purpose: input.purpose, operation: input.operation, targetId: input.targetId,
    });
    return { ok: false, reason: 'INVALID_PROOF' };
  }
  const burned = await consumeStepUpProof(proof);
  if (!burned) return { ok: false, reason: 'ALREADY_CONSUMED' };
  return { ok: true };
}

/**
 * Express middleware that requires a valid step-up proof for the given
 * purpose. Reads the token from `X-StepUp-Proof`. Requires req.firebaseUser.
 * On failure returns 401 { error: 'STEP_UP_REQUIRED', purpose }.
 *
 * Usage: mount BEFORE the sensitive handler.
 *
 *   router.post('/api/me/change-mobile',
 *     validateFirebaseToken,
 *     requireStepUp('change_mobile'),
 *     changeMobileHandler,
 *   );
 */
export function requireStepUp(purpose: StepUpPurpose) {
  return function stepUpMiddleware(req: Request, res: Response, next: NextFunction) {
    const uid = req.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    const token = (req.headers['x-stepup-proof'] as string) || undefined;
    if (!verifyStepUpProof(uid, purpose, token || null)) {
      logger.warn('[StepUpService] Step-up denied', { uid, purpose, hasToken: !!token });
      return res.status(401).json({
        error: 'STEP_UP_REQUIRED',
        purpose,
        hint: 'Re-authenticate with your passkey or password, then include the returned X-StepUp-Proof header.',
      });
    }
    return next();
  };
}
