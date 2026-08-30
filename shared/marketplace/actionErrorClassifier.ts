/**
 * actionErrorClassifier — CEO DEEP-LOGIC §32, §43, §46, §47.
 *
 * Action handlers can fail for very different reasons and the caller
 * (Action Brain executor + client + retry loops) MUST NOT treat them
 * the same. The prior wire converted every thrown error into a
 * generic UNKNOWN failure, which:
 *   • hid transient network/database timeouts as "final failures"
 *   • called external-money uncertainty a hard FAILED even when the
 *     domain hadn't been consulted (§43 — a SUMIT/Nayax timeout is
 *     NOT proof the transaction failed)
 *   • made recovery paths that rely on domain reconciliation
 *     impossible.
 *
 * The taxonomy:
 *   • VALIDATION_FINAL     — bad input; retry cannot help.
 *   • PERMISSION_FINAL     — actor is not authorized; retry cannot
 *                            help. (RBAC / IDENTITY_CONFLICT)
 *   • CONFLICT_STALE       — the entity state moved (stale preview,
 *                            already-cancelled, quote version drift).
 *                            The UI should refresh and re-decide.
 *   • DEPENDENCY_RETRYABLE — a downstream (DB / cache / third-party)
 *                            is transiently unavailable. The Action
 *                            Brain may retry on the same idempotency
 *                            claim.
 *   • UNKNOWN_OUTCOME      — the mutation may or may not have
 *                            happened. Reconciliation is REQUIRED
 *                            before the caller decides. NEVER
 *                            report a definitive FAILED here.
 *
 * The classifier is a pure function so both the shared executor and
 * server-side callers use the exact same mapping.
 */

export type ActionErrorClass =
  | 'VALIDATION_FINAL'
  | 'PERMISSION_FINAL'
  | 'CONFLICT_STALE'
  | 'DEPENDENCY_RETRYABLE'
  | 'UNKNOWN_OUTCOME';

export interface ActionErrorClassification {
  errorClass: ActionErrorClass;
  reasonCode: string;
  retryable: boolean;
  reconciliationRequired: boolean;
}

const RETRYABLE_MESSAGE_PATTERNS: RegExp[] = [
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENETUNREACH/i,
  /EAI_AGAIN/i,
  /getaddrinfo/i,
  /timeout/i,
  /temporary/i,
  /rate limit(?:ed)?/i,
  /too many connections/i,
  /connection terminated/i,
  /connection refused/i,
];

const CONFLICT_MESSAGE_PATTERNS: RegExp[] = [
  /stale/i,
  /already (?:cancel|complet|accept|declin|refund|paid|confirm)/i,
  /conflict/i,
  /version mismatch/i,
  /outdated/i,
];

const PERMISSION_MESSAGE_PATTERNS: RegExp[] = [
  /forbidden/i,
  /not authoriz(?:ed|ation)/i,
  /permission denied/i,
  /identity conflict/i,
];

const UNKNOWN_MESSAGE_PATTERNS: RegExp[] = [
  /payment (?:gateway|provider)/i,
  /sumit/i,
  /nayax/i,
  /external transaction/i,
  /outbound (?:call|http)/i,
  /webhook (?:delivery|reply) uncertain/i,
];

const VALIDATION_MESSAGE_PATTERNS: RegExp[] = [
  /invalid input/i,
  /missing required/i,
  /must be (?:a |an )?(?:string|number|boolean|integer)/i,
  /schema validation/i,
  /malformed/i,
];

interface ErrorLike {
  code?: string | number;
  message?: string;
  reasonCode?: string;
}

function normalise(err: unknown): ErrorLike {
  if (err && typeof err === 'object') return err as ErrorLike;
  return { message: String(err ?? '') };
}

/**
 * The pure classifier. Consult explicit `reasonCode` first, then the
 * error's `code`, then the message pattern set. Defaults to
 * UNKNOWN_OUTCOME — because for anything unrecognised we CANNOT
 * safely tell the caller "final failed"; reconciliation with the
 * domain is required (§47).
 */
export function classifyHandlerError(err: unknown): ActionErrorClassification {
  const e = normalise(err);
  const raw =
    (typeof e.reasonCode === 'string' && e.reasonCode) ||
    (typeof e.code === 'string' && e.code) ||
    (typeof e.code === 'number' && String(e.code)) ||
    '';
  const msg = typeof e.message === 'string' ? e.message : '';

  const bagMatch = (patterns: RegExp[]) => patterns.some((rx) => rx.test(msg) || rx.test(raw));

  // §43 priority — external money uncertainty (SUMIT / Nayax /
  // gateway timeouts) is UNKNOWN_OUTCOME even when the message also
  // matches a generic "timeout" pattern. Reconciliation with the
  // domain must precede any retry decision.
  if (raw === 'UNKNOWN_OUTCOME' || bagMatch(UNKNOWN_MESSAGE_PATTERNS)) {
    return { errorClass: 'UNKNOWN_OUTCOME', reasonCode: raw || 'UNKNOWN_OUTCOME', retryable: false, reconciliationRequired: true };
  }
  if (raw === 'VALIDATION_FINAL' || bagMatch(VALIDATION_MESSAGE_PATTERNS)) {
    return { errorClass: 'VALIDATION_FINAL', reasonCode: raw || 'VALIDATION_FINAL', retryable: false, reconciliationRequired: false };
  }
  if (raw === 'PERMISSION_FINAL' || bagMatch(PERMISSION_MESSAGE_PATTERNS)) {
    return { errorClass: 'PERMISSION_FINAL', reasonCode: raw || 'PERMISSION_FINAL', retryable: false, reconciliationRequired: false };
  }
  if (raw === 'CONFLICT_STALE' || bagMatch(CONFLICT_MESSAGE_PATTERNS)) {
    return { errorClass: 'CONFLICT_STALE', reasonCode: raw || 'CONFLICT_STALE', retryable: false, reconciliationRequired: true };
  }
  if (raw === 'DEPENDENCY_RETRYABLE' || bagMatch(RETRYABLE_MESSAGE_PATTERNS)) {
    return { errorClass: 'DEPENDENCY_RETRYABLE', reasonCode: raw || 'DEPENDENCY_RETRYABLE', retryable: true, reconciliationRequired: false };
  }
  // §47 default — we do NOT know that the mutation is final-failed.
  return { errorClass: 'UNKNOWN_OUTCOME', reasonCode: 'UNKNOWN_OUTCOME', retryable: false, reconciliationRequired: true };
}
