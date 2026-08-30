/**
 * RebookingSpanEvaluator — CEO PROGRAM 29 companion.
 *
 * Pure evaluator. Given a prior booking's start time + a chosen
 * cadence (weekly / biweekly / monthly), returns the next N
 * candidate start times shifted forward from the prior start.
 * Client uses this as the default set of dates the user picks
 * from when tapping "Book Again".
 */

export type Cadence = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM_DAYS';

export interface RebookInput {
  priorStartAt: string;                      // ISO
  cadence: Cadence;
  customIntervalDays?: number;               // required when cadence === 'CUSTOM_DAYS'
  numberOfCandidates?: number;               // default 4
  now?: Date;
}

export type SpanOutcome =
  | { code: 'OK'; candidates: string[] }
  | { code: 'INVALID_INPUT'; reasonCode: 'BAD_PRIOR' | 'BAD_CUSTOM_DAYS' };

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
}

export function buildRebookSpan(input: RebookInput): SpanOutcome {
  const start = Date.parse(input.priorStartAt);
  if (!Number.isFinite(start)) return { code: 'INVALID_INPUT', reasonCode: 'BAD_PRIOR' };
  const now = input.now ?? new Date();
  const n = Math.max(1, Math.min(12, input.numberOfCandidates ?? 4));

  let step: (from: string) => string;
  switch (input.cadence) {
    case 'WEEKLY':   step = (f) => addDays(f, 7); break;
    case 'BIWEEKLY': step = (f) => addDays(f, 14); break;
    case 'MONTHLY':  step = (f) => addMonths(f, 1); break;
    case 'CUSTOM_DAYS':
      if (!Number.isFinite(input.customIntervalDays as number) || (input.customIntervalDays as number) <= 0) {
        return { code: 'INVALID_INPUT', reasonCode: 'BAD_CUSTOM_DAYS' };
      }
      step = (f) => addDays(f, input.customIntervalDays as number);
      break;
    default:
      return { code: 'INVALID_INPUT', reasonCode: 'BAD_PRIOR' };
  }

  const candidates: string[] = [];
  let cursor = input.priorStartAt;
  while (candidates.length < n) {
    cursor = step(cursor);
    if (Date.parse(cursor) > now.getTime()) {
      candidates.push(cursor);
    }
  }
  return { code: 'OK', candidates };
}
