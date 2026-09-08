/**
 * consumeOneShotProof — the ONE answer to "has this proof already been spent?"
 *
 * Three different proof tokens in this codebase are one-use credentials:
 *
 *   StepUpService          money step-up proof   (jti, Redis SETNX)
 *   emailVerifiedToken     email OTP proof       (nonce)
 *   TwilioSMSService       sms-verified JWT      (nonce)
 *
 * Each had, or was about to get, its own idea of what "spent" means. The SMS
 * one used a per-process `Map`, which is not a shared answer at all: on Cloud
 * Run the replay simply lands on the other instance and succeeds. Rather than
 * add a third dialect for the email token, all three now ask the same question
 * of the same store, so there is exactly one place where the semantics of
 * "spent" — atomicity, TTL, and what happens when the store is down — live.
 *
 * ── Atomicity ───────────────────────────────────────────────────────────────
 * SETNX (`SET key val NX EX ttl`) is a single Redis command. Two concurrent
 * requests bearing the same token both reach it; exactly one gets OK. There is
 * deliberately NO read-then-write here — a `get` followed by a `set` reopens
 * the exact race this exists to close.
 *
 * ── Fail-closed ─────────────────────────────────────────────────────────────
 * If the store cannot be reached, the proof is REFUSED. A proof whose replay
 * status cannot be established is not a proof. This is a deliberate
 * availability-for-safety trade: a Redis outage turns into "request a new
 * code", never into "waved through".
 *
 * ── Replay vs outage is DECIDED, never inferred ─────────────────────────────
 * A component whose whole job is telling "already spent" apart from "I could
 * not check" must not sit on a Redis call that returns the same `false` for
 * both. `redis.setNx()` does exactly that, and the first version of this file
 * tried to recover the distinction afterwards by asking `redis.isConnected()`.
 *
 * That was wrong, and would have shipped the very misdiagnosis this module
 * exists to prevent. A Redis command can time out, be rejected mid-flight, or
 * return a ReplyError while the client still reports itself connected — the
 * `error` event that clears `isEnabled` fires on CONNECTION faults, not on
 * every command fault. In that window an infrastructure failure would have
 * been reported to the customer as `already_used`: "you already used this",
 * about a proof they had never spent.
 *
 * So the outcome is now decided at the Redis API boundary, where it is
 * actually knowable — `setNxStrict` returns 'SET' | 'EXISTS' | 'UNAVAILABLE',
 * and 'EXISTS' can only come from a COMPLETED `SET .. NX` that replied nil.
 * Nothing here reads connection state.
 *
 * StepUpService's own consume collapses both outcomes into `false`, so an
 * operator staring at a refusal cannot tell a replay from an outage. This
 * returns them as distinct reasons so the route can answer 401 "already used"
 * versus 503 "try again in a moment", and so support can tell the two apart
 * from a log line.
 */
import { logger } from './logger';
import { redis } from '../services/redis';

export type OneShotRefusal = 'already_used' | 'store_unavailable' | 'no_id' | 'expired';

export type OneShotResult = { ok: true } | { ok: false; reason: OneShotRefusal };

export interface OneShotClaim {
  /** Key namespace — one per proof family, e.g. 'stepup' | 'emailproof' | 'smsproof'. */
  scope: string;
  /**
   * The proof's own unique id: its jti / nonce. MUST be unique per mint, and
   * MUST come from inside the signed payload — burning something the bearer
   * chose would let them pick an id nobody else will ever present.
   *
   * Never the destination (email / phone) or a uid: this becomes a Redis key,
   * and a key is the wrong home for PII.
   */
  id: string;
  /**
   * How long the "spent" marker must live, in seconds. Pass the proof's OWN
   * remaining lifetime — the marker only has to outlive the thing it guards.
   * Slack for clock skew is added here, not by the caller.
   */
  ttlSeconds: number;
  /**
   * FULL keys (not scoped ids) written by a PREVIOUS key format for this same
   * proof family, checked before the new marker is claimed.
   *
   * Renaming the key namespace of a one-shot control silently un-spends every
   * proof burnt under the old name: the new code looks for a key nobody wrote
   * yet, finds nothing, and accepts a replay. The window is one TTL wide and
   * lands exactly at deploy — and "one proof, one use" is not a property that
   * gets to lapse during a rollout because the affected proofs are rare.
   *
   * Reading these is additive: it can only ever REFUSE a proof the new key
   * would have accepted, so it introduces no race. Remove a legacy key from
   * this list once more than (max proof TTL + skew) has elapsed in production.
   */
  legacyKeys?: readonly string[];
  /** Non-PII context for the audit line (uid, purpose, …). Never the token. */
  context?: Record<string, unknown>;
}

/**
 * Slack added to the marker's TTL.
 *
 * The proof's remaining lifetime is computed against the clock of whichever
 * instance is asking. A second instance running ~20s behind would still
 * consider the token live after the first instance's marker had expired — and
 * a spent nonce that outlives its own marker is replayable. 30s covers the
 * skew Cloud Run instances realistically show, and costs nothing: the keys are
 * tiny and expire on their own.
 */
const CLOCK_SKEW_SLACK_SECONDS = 30;

export async function consumeOneShotProof(claim: OneShotClaim): Promise<OneShotResult> {
  // No id means there is nothing to dedupe on, which means one-shot cannot be
  // established. Refuse rather than wave through — "I couldn't check" and
  // "it's fine" are not the same answer.
  if (!claim.id) {
    logger.warn('[oneShotProof] refused a proof with no id — one-shot cannot be established', {
      scope: claim.scope, ...claim.context,
    });
    return { ok: false, reason: 'no_id' };
  }
  if (!Number.isFinite(claim.ttlSeconds) || claim.ttlSeconds <= 0) {
    return { ok: false, reason: 'expired' };
  }

  const key = `oneshot:${claim.scope}:${claim.id}`;
  const ttl = Math.ceil(claim.ttlSeconds) + CLOCK_SKEW_SLACK_SECONDS;

  // Legacy markers FIRST. If this proof was spent under an older key format,
  // it is spent — the rename must not resurrect it. A read we cannot perform
  // is not a "no": it fails closed like everything else here.
  for (const legacyKey of claim.legacyKeys ?? []) {
    let seen: 'YES' | 'NO' | 'UNAVAILABLE';
    try {
      seen = await redis.existsStrict(legacyKey);
    } catch {
      seen = 'UNAVAILABLE';
    }
    if (seen === 'UNAVAILABLE') {
      logger.error('[oneShotProof] could not read a legacy marker — refusing (fail-closed)', {
        scope: claim.scope, jti: claim.id, ...claim.context,
      });
      return { ok: false, reason: 'store_unavailable' };
    }
    if (seen === 'YES') {
      logger.warn('[oneShotProof] REPLAY refused — proof was consumed under the LEGACY key', {
        scope: claim.scope, jti: claim.id, legacyKey, ...claim.context,
      });
      return { ok: false, reason: 'already_used' };
    }
  }

  let outcome: 'SET' | 'EXISTS' | 'UNAVAILABLE';
  try {
    outcome = await redis.setNxStrict(key, '1', ttl);
  } catch {
    // setNxStrict already maps its own throws to 'UNAVAILABLE'; this is
    // belt-and-braces so an unexpected throw can never become a pass.
    outcome = 'UNAVAILABLE';
  }

  if (outcome === 'UNAVAILABLE') {
    // NOT 'already_used'. We do not know whether this proof was spent, and
    // saying we do would blame the customer for our outage.
    logger.error('[oneShotProof] store unreachable — refusing the proof (fail-closed)', {
      scope: claim.scope, jti: claim.id, ...claim.context,
    });
    return { ok: false, reason: 'store_unavailable' };
  }

  if (outcome === 'EXISTS') {
    logger.warn('[oneShotProof] REPLAY refused — proof already consumed', {
      scope: claim.scope, jti: claim.id, ...claim.context,
    });
    return { ok: false, reason: 'already_used' };
  }

  // Audit the burn. Matches the issuance line by jti so an operator can walk
  // a proof from mint to spend.
  logger.info('[oneShotProof] proof consumed', { scope: claim.scope, jti: claim.id, ...claim.context });
  return { ok: true };
}
