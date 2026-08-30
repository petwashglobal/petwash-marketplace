/**
 * SupportCaseAutoCloseEvaluator — CEO PROGRAM 13 (Support Case timing).
 *
 * Pure evaluator. Doctrine: a support case may be auto-closed only
 * after the resolution has been visible to the opener for the
 * caller-supplied window (business decision), AND only if the
 * opener did not reopen or dispute it.
 *
 * Returns AUTO_CLOSE / STAY_OPEN with a stable reasonCode.
 */

export interface AutoCloseInput {
  status: 'OPEN' | 'ADMIN_ASSIGNED' | 'PENDING_ACTOR' | 'RESOLVED' | 'CLOSED';
  resolvedAt?: string;                       // ISO
  hasOpenerReopened?: boolean;
  now?: Date;
  /** Business decision — days after RESOLVED that the case auto-closes. */
  autoCloseAfterDays?: number;
}

export type AutoCloseOutcome =
  | { code: 'AUTO_CLOSE' }
  | { code: 'STAY_OPEN'; reasonCode:
      | 'NOT_RESOLVED'
      | 'REOPENED'
      | 'POLICY_NOT_CONFIGURED'
      | 'WINDOW_NOT_ELAPSED'
      | 'ALREADY_CLOSED' };

export function evaluateAutoClose(input: AutoCloseInput): AutoCloseOutcome {
  if (input.status === 'CLOSED') return { code: 'STAY_OPEN', reasonCode: 'ALREADY_CLOSED' };
  if (input.status !== 'RESOLVED') return { code: 'STAY_OPEN', reasonCode: 'NOT_RESOLVED' };
  if (input.hasOpenerReopened) return { code: 'STAY_OPEN', reasonCode: 'REOPENED' };
  if (typeof input.autoCloseAfterDays !== 'number') return { code: 'STAY_OPEN', reasonCode: 'POLICY_NOT_CONFIGURED' };
  if (!input.resolvedAt) return { code: 'STAY_OPEN', reasonCode: 'NOT_RESOLVED' };
  const now = input.now ?? new Date();
  const resolved = Date.parse(input.resolvedAt);
  if (!Number.isFinite(resolved)) return { code: 'STAY_OPEN', reasonCode: 'NOT_RESOLVED' };
  const gapDays = (now.getTime() - resolved) / (24 * 60 * 60 * 1000);
  if (gapDays < input.autoCloseAfterDays) return { code: 'STAY_OPEN', reasonCode: 'WINDOW_NOT_ELAPSED' };
  return { code: 'AUTO_CLOSE' };
}
