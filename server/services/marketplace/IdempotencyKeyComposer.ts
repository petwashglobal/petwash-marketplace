/**
 * IdempotencyKeyComposer — CEO doctrine (idempotency discipline).
 *
 * Pure evaluator. Every mutating action MUST attach an idempotency
 * key composed from the action + actor + entity + optional
 * per-attempt salt. Duplicate submissions collide on the same key
 * and the middleware short-circuits them (see server P0-141).
 *
 * The composer NEVER hashes or stores — it only derives the
 * canonical key string. Downstream stores hash it themselves.
 */

export interface KeyComposeInput {
  actionType: string;                       // ActionCatalog slug
  actorUid: string;
  entityRef: { kind: string; id: string };
  /** Optional per-attempt salt when the same actor may legitimately retry (e.g. after PAYMENT_UNCERTAIN reconcile). */
  attemptSalt?: string;
}

/**
 * A canonical key string. Deterministic — the same inputs always
 * produce the same output.
 */
export function composeIdempotencyKey(input: KeyComposeInput): string {
  const parts = [
    input.actionType.trim(),
    input.actorUid.trim(),
    `${input.entityRef.kind.trim()}:${input.entityRef.id.trim()}`,
  ];
  if (input.attemptSalt && input.attemptSalt.trim()) {
    parts.push(`salt=${input.attemptSalt.trim()}`);
  }
  return parts.join('|');
}

/**
 * Two composes match iff their canonical keys match. Wraps the
 * composer for callers that only need the boolean predicate.
 */
export function isSameIdempotencyKey(a: KeyComposeInput, b: KeyComposeInput): boolean {
  return composeIdempotencyKey(a) === composeIdempotencyKey(b);
}
