/**
 * Activation pre-flight for the K9000 fiscal rail.
 *
 * WHY THIS EXISTS
 * ---------------
 * Twice on 2026-09-06/07 I reported production state I had inferred rather than
 * checked, and was wrong both times — once claiming schema was missing because a
 * CI job showed "skipped", once treating a green deploy as proof. Switching this
 * rail on issues irreversible tax documents, so the decision must not rest on
 * anyone's reading of a dashboard.
 *
 * Hence the one rule this module encodes:
 *
 *     UNKNOWN IS NOT PASS.
 *
 * A check that could not be performed is reported as UNKNOWN and blocks
 * activation exactly as a FAIL does. "We couldn't tell" has caused more damage
 * here than "it's broken", because it reads like success in a summary.
 *
 * READ-ONLY. This module performs no writes, issues no document, and changes no
 * flag. It answers one question — may the rail be switched on — and nothing else.
 */

export type CheckStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export interface CheckResult {
  id: string;
  /** What this proves, in the operator's terms. */
  title: string;
  status: CheckStatus;
  /** Why it is in that state. Always populated for FAIL and UNKNOWN. */
  detail: string;
  /** What the operator should do next. Only for FAIL / UNKNOWN. */
  remedy?: string;
}

/**
 * The instant the 481 historical documents were issued. A cutover at or before
 * this would re-admit already-documented history into automatic issuance, which
 * is how the backfill produced per-transaction documents for the whole year in
 * the first place. Rejected explicitly rather than left to an operator's memory.
 */
export const HISTORICAL_BACKFILL_INSTANT = new Date('2026-09-05T09:30:00Z');

export interface PreflightInputs {
  /** From bridgeWired(): are SUMIT credentials, feed and flag present. */
  wired: { sumit: boolean; lynx: boolean; flag: boolean; cutover: boolean };
  cutoverAt: Date | null;
  now: Date;
  /** Machine ids the operator intends to activate. */
  expectedMachineIds: string[];
  /** Machine ids the terminal registry actually knows, with station + bay. */
  registeredMachineIds: string[];
  /**
   * Schema presence. `null` means the check could not run (no DB reachable) —
   * which is UNKNOWN, never PASS.
   */
  tablesPresent: Record<string, boolean> | null;
  /** Whether the claim ledger's unique index exists. null = could not check. */
  claimUniqueIndexPresent: boolean | null;
  /**
   * Unfinished claims. Activation requires zero: a PENDING_LOOKUP or
   * NEEDS_RECONCILIATION row is a document whose existence is unresolved, and
   * issuing more on top of that buries it. null = could not check.
   */
  unresolvedClaims: { pendingLookup: number; needsReconciliation: number } | null;
  /**
   * Whether the transaction feed delivers continuously. A manual Excel export is
   * NOT a feed — the rail must not be activated on top of one.
   */
  continuousFeed: boolean | null;
}

const REQUIRED_TABLES = [
  'nayax_sale_issuance_attempts',
  'nayax_refund_events',
  'nayax_fiscal_document_links',
];

export function runPreflight(i: PreflightInputs): CheckResult[] {
  const out: CheckResult[] = [];

  // ── SUMIT credentials ────────────────────────────────────────────────────
  out.push(i.wired.sumit
    ? { id: 'sumit', title: 'SUMIT is wired', status: 'PASS', detail: 'credentials present' }
    : {
        id: 'sumit', title: 'SUMIT is wired', status: 'FAIL',
        detail: 'SUMIT_ENABLED / API key / company id / webhook secret incomplete',
        remedy: 'Set the missing SUMIT_* variables. Never issue with partial credentials.',
      });

  // ── Continuous feed ──────────────────────────────────────────────────────
  if (i.continuousFeed === null) {
    out.push({
      id: 'feed', title: 'Transactions arrive continuously', status: 'UNKNOWN',
      detail: 'feed delivery could not be verified',
      remedy: 'Verify Lynx/Dispatcher/SQS delivery before activating. Do not assume.',
    });
  } else if (!i.continuousFeed) {
    out.push({
      id: 'feed', title: 'Transactions arrive continuously', status: 'FAIL',
      detail: 'no continuous delivery — a manual Excel export is not a feed',
      remedy: 'Obtain the Lynx operational permission or a Dispatcher/SQS feed from Nayax support.',
    });
  } else {
    out.push({ id: 'feed', title: 'Transactions arrive continuously', status: 'PASS', detail: 'feed reachable' });
  }

  // ── Cutover ──────────────────────────────────────────────────────────────
  if (!i.cutoverAt) {
    out.push({
      id: 'cutover', title: 'Fiscal cutover is set', status: 'FAIL',
      detail: 'NAYAX_SUMIT_CUTOVER_AT is unset — every sale would be withheld',
      remedy: 'Set it to the instant automatic issuance should begin.',
    });
  } else if (i.cutoverAt.getTime() <= HISTORICAL_BACKFILL_INSTANT.getTime()) {
    out.push({
      id: 'cutover', title: 'Fiscal cutover is set', status: 'FAIL',
      detail:
        `cutover ${i.cutoverAt.toISOString()} is at or before the historical backfill ` +
        `(${HISTORICAL_BACKFILL_INSTANT.toISOString()}) — already-documented washes would ` +
        'be admitted into automatic issuance',
      remedy: 'Choose a NEW instant after the backfill. Never reuse 05/09 12:30.',
    });
  } else if (i.cutoverAt.getTime() > i.now.getTime() + 90 * 24 * 3600_000) {
    out.push({
      id: 'cutover', title: 'Fiscal cutover is set', status: 'FAIL',
      detail: `cutover ${i.cutoverAt.toISOString()} is more than 90 days out — nothing would ever issue`,
      remedy: 'Set a realistic activation instant.',
    });
  } else {
    out.push({
      id: 'cutover', title: 'Fiscal cutover is set', status: 'PASS',
      detail: `cutover ${i.cutoverAt.toISOString()}`,
    });
  }

  // ── Terminal registry ────────────────────────────────────────────────────
  const missing = i.expectedMachineIds.filter((m) => !i.registeredMachineIds.includes(m));
  out.push(missing.length === 0
    ? {
        id: 'terminals', title: 'Every bay is registered', status: 'PASS',
        detail: `${i.expectedMachineIds.length} machines registered`,
      }
    : {
        id: 'terminals', title: 'Every bay is registered', status: 'FAIL',
        detail: `unregistered: ${missing.join(', ')}`,
        remedy: 'Add them to nayaxTerminals.ts with the real station and bay. Never guess a serial.',
      });

  // ── Schema ───────────────────────────────────────────────────────────────
  if (i.tablesPresent === null) {
    out.push({
      id: 'schema', title: 'Fiscal tables exist', status: 'UNKNOWN',
      detail: 'could not reach the database to check',
      remedy: 'Check against the real DB. A skipped migration job is NOT evidence either way.',
    });
  } else {
    const absent = REQUIRED_TABLES.filter((t) => !i.tablesPresent![t]);
    out.push(absent.length === 0
      ? { id: 'schema', title: 'Fiscal tables exist', status: 'PASS', detail: REQUIRED_TABLES.join(', ') }
      : {
          id: 'schema', title: 'Fiscal tables exist', status: 'FAIL',
          detail: `missing: ${absent.join(', ')}`,
          remedy: 'gh workflow run petwash-ci.yml -R <repo> -f run_migrations=true --ref main',
        });
  }

  // ── The duplicate guard itself ───────────────────────────────────────────
  if (i.claimUniqueIndexPresent === null) {
    out.push({
      id: 'guard', title: 'Duplicate-invoice guard is in place', status: 'UNKNOWN',
      detail: 'could not verify the unique index on the claim ledger',
      remedy: 'Verify uq_nayax_sale_issuance exists. Without it, a repeated run can double-issue.',
    });
  } else {
    out.push(i.claimUniqueIndexPresent
      ? {
          id: 'guard', title: 'Duplicate-invoice guard is in place', status: 'PASS',
          detail: 'uq_nayax_sale_issuance present',
        }
      : {
          id: 'guard', title: 'Duplicate-invoice guard is in place', status: 'FAIL',
          detail: 'the claim ledger has no unique index — the guard IS that index',
          remedy: 'Apply migration 0148 before activating.',
        });
  }

  // ── No unfinished claims ─────────────────────────────────────────────────
  if (i.unresolvedClaims === null) {
    out.push({
      id: 'unresolved', title: 'No unresolved claims', status: 'UNKNOWN',
      detail: 'could not read the claim ledger',
      remedy: 'Check for PENDING_LOOKUP / NEEDS_RECONCILIATION rows before activating.',
    });
  } else {
    const { pendingLookup, needsReconciliation } = i.unresolvedClaims;
    out.push(pendingLookup + needsReconciliation === 0
      ? { id: 'unresolved', title: 'No unresolved claims', status: 'PASS', detail: 'ledger clean' }
      : {
          id: 'unresolved', title: 'No unresolved claims', status: 'FAIL',
          detail: `${pendingLookup} PENDING_LOOKUP, ${needsReconciliation} NEEDS_RECONCILIATION`,
          remedy: 'Resolve each against SUMIT first. Issuing on top of them buries the question.',
        });
  }

  // ── The activation flag, reported last: it is the switch, not a precondition ──
  out.push({
    id: 'flag', title: 'Bridge flag', status: i.wired.flag ? 'PASS' : 'FAIL',
    detail: i.wired.flag ? 'NAYAX_SUMIT_BRIDGE_ENABLED=true' : 'NAYAX_SUMIT_BRIDGE_ENABLED is not true',
    ...(i.wired.flag ? {} : { remedy: 'Set it LAST — only once every other check above passes.' }),
  });

  return out;
}

/**
 * The verdict.
 *
 * READY only when every check passed. An UNKNOWN blocks exactly as a FAIL does —
 * that is the whole point of this module.
 */
export function preflightVerdict(results: CheckResult[]): {
  ready: boolean; failed: string[]; unknown: string[];
} {
  const failed = results.filter((r) => r.status === 'FAIL').map((r) => r.id);
  const unknown = results.filter((r) => r.status === 'UNKNOWN').map((r) => r.id);
  return { ready: failed.length === 0 && unknown.length === 0, failed, unknown };
}

/** Human-readable report. */
export function formatPreflight(results: CheckResult[]): string {
  const icon = (s: CheckStatus) => (s === 'PASS' ? '  PASS  ' : s === 'FAIL' ? '  FAIL  ' : ' UNKNOWN');
  const lines = results.map((r) => {
    const head = `[${icon(r.status)}] ${r.title}`;
    const body = `            ${r.detail}`;
    const rem = r.remedy ? `\n            → ${r.remedy}` : '';
    return `${head}\n${body}${rem}`;
  });
  const v = preflightVerdict(results);
  const verdict = v.ready
    ? '\nREADY — every check passed.'
    : `\nNOT READY — failed: [${v.failed.join(', ') || 'none'}]  unverifiable: [${v.unknown.join(', ') || 'none'}]` +
      '\nAn unverifiable check blocks activation exactly as a failure does.';
  return `${lines.join('\n')}\n${verdict}`;
}
