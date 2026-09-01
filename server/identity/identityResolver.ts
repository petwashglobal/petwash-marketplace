/**
 * Canonical identity resolver (auth-rebuild Phase 6.b).
 *
 * When a legacy duplicate identity has been soft-merged into a primary
 * (see server/routes/admin-identity-soft-merge.ts + migration 0138),
 * the SECONDARY user row carries `merged_into_uid = <PRIMARY_UID>`.
 *
 * `resolveCanonicalUid(uid)` follows that pointer so any auth-time
 * operation resolves to the PRIMARY, regardless of which historical
 * UID the caller arrived with. Money / tax / booking / audit rows
 * are NEVER re-parented — this resolver is only for identity
 * resolution (session mint, role check, capability lookup).
 *
 * Safety rules encoded here:
 *
 *   1. **Self-merge rejection** — `merged_into_uid = <this uid>` is
 *      never followed. A row cannot merge into itself.
 *   2. **Loop protection** — the resolver tracks visited UIDs and
 *      breaks if the chain would revisit one. The soft-merge write
 *      path also rejects loops before writing, but the resolver
 *      never trusts stored state to be loop-free.
 *   3. **Chain-length cap** — soft-merges chain at most `MAX_CHAIN`
 *      hops. In practice merges are 1 hop (secondary → primary) and
 *      Phase 6.b's write path refuses to merge a row that is itself
 *      already a merge target (a chain-of-two is a merge conflict
 *      requiring manual admin action). The cap here is defensive.
 *   4. **Unknown UID** — if the input UID has no users row, resolver
 *      returns null. Never fabricates.
 *   5. **Already-primary** — a row with `merged_into_uid IS NULL`
 *      resolves to itself. That is the ordinary case.
 *   6. **Never bumps privileges** — the resolver reads only
 *      `users.id` / `users.merged_into_uid`. It does NOT look at
 *      `role` or `roles` — the caller must run those through the
 *      capabilities aggregator against the RESOLVED uid.
 *
 * Read-only. Never writes. Never mutates the DB.
 */
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

const MAX_CHAIN = 4;

export interface ResolveResult {
  /** The resolved primary UID. */
  canonicalUid: string;
  /** The chain walked (input first, primary last). Length 1 for the ordinary case. */
  chain: string[];
  /** Whether the input UID was itself a secondary (i.e. we followed at least one hop). */
  wasSecondary: boolean;
}

export type ResolveError =
  | { code: 'NOT_FOUND'; uid: string }
  | { code: 'LOOP_DETECTED'; chain: string[] }
  | { code: 'CHAIN_TOO_LONG'; chain: string[] }
  | { code: 'SELF_MERGE'; uid: string };

/**
 * Follow users.merged_into_uid to the canonical primary.
 * Returns { ok: true, ...ResolveResult } on success, otherwise a
 * structured error. Never throws for known conditions.
 */
export async function resolveCanonicalUid(
  inputUid: string,
): Promise<{ ok: true; result: ResolveResult } | { ok: false; error: ResolveError }> {
  if (!inputUid || typeof inputUid !== 'string') {
    return { ok: false, error: { code: 'NOT_FOUND', uid: String(inputUid ?? '') } };
  }

  const chain: string[] = [];
  const visited = new Set<string>();
  let cursor = inputUid;

  for (let hop = 0; hop < MAX_CHAIN + 1; hop++) {
    if (visited.has(cursor)) {
      logger.error('[identityResolver] LOOP_DETECTED', {
        inputUid,
        chain: [...chain, cursor],
      });
      return { ok: false, error: { code: 'LOOP_DETECTED', chain: [...chain, cursor] } };
    }
    visited.add(cursor);
    chain.push(cursor);

    const [row] = await db
      .select({ id: users.id, mergedIntoUid: users.mergedIntoUid })
      .from(users)
      .where(eq(users.id, cursor))
      .limit(1);

    if (!row) {
      // Unknown at first hop → NOT_FOUND. Unknown mid-chain → chain
      // points at a UID that has been deleted; treat as broken chain.
      if (chain.length === 1) {
        return { ok: false, error: { code: 'NOT_FOUND', uid: inputUid } };
      }
      logger.error('[identityResolver] Broken chain: mid-chain UID missing', {
        inputUid,
        chain,
      });
      return { ok: false, error: { code: 'NOT_FOUND', uid: cursor } };
    }

    const next = row.mergedIntoUid;
    if (!next) {
      return {
        ok: true,
        result: {
          canonicalUid: cursor,
          chain,
          wasSecondary: chain.length > 1,
        },
      };
    }

    if (next === cursor) {
      // Someone wrote merged_into_uid = id. Refuse to follow — that's
      // a data corruption we should surface, not silently normalise.
      logger.error('[identityResolver] SELF_MERGE detected', { uid: cursor });
      return { ok: false, error: { code: 'SELF_MERGE', uid: cursor } };
    }

    cursor = next;
  }

  logger.error('[identityResolver] CHAIN_TOO_LONG', { inputUid, chain });
  return { ok: false, error: { code: 'CHAIN_TOO_LONG', chain } };
}

/**
 * Best-effort resolver — returns the canonical UID or the input UID
 * on any error. Callers who want the error must use resolveCanonicalUid
 * directly. This helper is for code paths where a resolution failure
 * must NOT block auth (e.g. a legacy session cookie that predates the
 * merge; we accept the token and continue on the input UID rather
 * than logging the user out because a mid-chain row went missing).
 * The Phase 6.b write path guarantees chains stay clean.
 */
export async function resolveCanonicalUidOrSelf(inputUid: string): Promise<string> {
  const res = await resolveCanonicalUid(inputUid);
  if (res.ok) return res.result.canonicalUid;
  return inputUid;
}
