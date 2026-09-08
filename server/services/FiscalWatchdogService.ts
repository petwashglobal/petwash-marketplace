/**
 * FISCAL WATCHDOG — production A↔C control, evidenced and distributed.
 *
 * Runs the Nayax↔SUMIT 1:1 invariants against the claim ledger
 * (nayax_sale_issuance_attempts, migration 0148), records the run durably
 * (fiscal_watchdog_runs, migration 0149) and distributes the verdict to the
 * configured recipient group.
 *
 * ── WHAT THIS LEG CAN AND CANNOT PROVE ──────────────────────────────────────
 * The claim ledger is OUR record of what we issued. Checking it proves the
 * issuance rail is internally consistent — no sale claimed twice, no claim
 * stuck mid-flight, no ISSUED row without a document id, no amount drift.
 *
 * It does NOT prove the four-way reconciliation. That needs the Nayax
 * settlement statement (B) and the bank (D), which arrive as files and are not
 * yet ingested in production. So this service reports its own leg honestly and
 * marks B and D as NOT_CHECKED — never CLOSED. The full four-layer engine
 * lives in the fiscal bridge (src/watchdog.ts) and is run against exports.
 *
 * ── RULES ───────────────────────────────────────────────────────────────────
 *   • READ-ONLY on fiscal state. It never issues, credits, deletes, re-dates or
 *     alters a document, and never adjusts a figure to make totals agree.
 *   • It never assigns accounting meaning. Exceptions are reported; treatment
 *     is the bookkeeper's decision.
 *   • Emails carry counts, totals and transaction/document identifiers only —
 *     never a card number, cardholder name or customer contact detail.
 *   • A recipient it cannot resolve is reported as unresolved, never guessed.
 */

import { createHash } from 'node:crypto';
import { pool, isDatabaseAvailable } from '../db';
import { logger } from '../lib/logger';
import { sendGuardedEmail } from '../lib/guarded-sendgrid';

export type WatchdogStatus =
  | 'FAIL'
  | 'PENDING_SOURCE'
  | 'PENDING_STATEMENT'
  | 'PENDING_BANK'
  | 'AC_PASS_ONLY';

export interface WatchdogException {
  check: string;
  /** transaction@machine — an identifier, never customer data. */
  ref: string;
  amountMinor?: number;
  detail: string;
}

export interface WatchdogRun {
  runId: string;
  runKind: 'daily' | 'monthly' | 'manual';
  period: string | null;
  status: WatchdogStatus;
  acResult: 'PASS' | 'FAIL';
  abResult: 'NOT_CHECKED';
  bdResult: 'NOT_CHECKED';
  sourceALatestAt: Date | null;
  sourceCFetchedAt: Date;
  sourcesFresh: boolean;
  txnCount: number;
  expectInvoiceCount: number;
  documentedCount: number;
  documentedMinor: number;
  exceptions: WatchdogException[];
  warnings: WatchdogException[];
}

/**
 * The recipient group. Configured, with a documented default.
 *
 * Addresses are only defaulted where this repository or a received document
 * evidences them:
 *   nir.h@petwash.co.il      — Nayax statement distribution, Neon billing
 *   support@petwash.co.il    — Nayax statement distribution
 *   ido.s@petwash.co.il      — routes.ts super-admin note
 *
 * The bookkeeper's address is DELIBERATELY not defaulted. The Nayax email
 * showed only Gmail's abbreviated "michalm", and guessing a bookkeeper's
 * address in order to send her fiscal reports would be worse than leaving it
 * unset — the report would silently go nowhere, or somewhere wrong. Set
 * FISCAL_WATCHDOG_RECIPIENTS to include her once confirmed.
 */
const DEFAULT_RECIPIENTS = [
  'nir.h@petwash.co.il',
  'support@petwash.co.il',
  'ido.s@petwash.co.il',
];

export function resolveRecipients(): { to: string[]; unresolved: string[] } {
  const raw = (process.env.FISCAL_WATCHDOG_RECIPIENTS || '').trim();
  if (raw) {
    const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const valid = list.filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    const bad = list.filter((e) => !valid.includes(e));
    return { to: valid, unresolved: bad };
  }
  // No bookkeeper address is invented. Name the gap instead.
  return { to: DEFAULT_RECIPIENTS, unresolved: ['bookkeeper (set FISCAL_WATCHDOG_RECIPIENTS)'] };
}

/**
 * A↔C invariants over the claim ledger. PURE over the rows it is given, so the
 * rules are testable without a database.
 */
export function evaluateClaimLedger(rows: Array<{
  nayax_transaction_id: string;
  machine_id: string;
  amount_minor: number;
  currency: string;
  settled_at: Date | null;
  state: string;
  external_reference: string;
  sumit_document_id: string | null;
  sumit_document_number: string | null;
  attempt_count: number;
  last_error: string | null;
}>): { exceptions: WatchdogException[]; warnings: WatchdogException[]; documented: number; documentedMinor: number } {
  const exceptions: WatchdogException[] = [];
  const warnings: WatchdogException[] = [];
  let documented = 0;
  let documentedMinor = 0;

  const byIdentity = new Map<string, number>();
  const byReference = new Map<string, string[]>();
  const byDocument = new Map<string, string[]>();

  for (const r of rows) {
    const ref = `${r.nayax_transaction_id}@${r.machine_id}`;

    // Identity must be unique on machine + transaction (migration 0148).
    byIdentity.set(ref, (byIdentity.get(ref) ?? 0) + 1);
    // External reference must be unique too.
    byReference.set(r.external_reference, [...(byReference.get(r.external_reference) ?? []), ref]);
    // And one SUMIT document must never back two claims.
    if (r.sumit_document_id) {
      byDocument.set(r.sumit_document_id, [...(byDocument.get(r.sumit_document_id) ?? []), ref]);
    }

    if (r.state === 'ISSUED') {
      // An ISSUED claim with no document id is the worst state in the table:
      // it says "done" while nothing exists to prove it.
      if (!r.sumit_document_id) {
        exceptions.push({ check: 'ISSUED_WITHOUT_DOCUMENT', ref, amountMinor: r.amount_minor,
          detail: 'claim is ISSUED but carries no SUMIT document id' });
      } else {
        documented++;
        documentedMinor += r.amount_minor;
      }
      if (!r.sumit_document_number) {
        warnings.push({ check: 'ISSUED_WITHOUT_NUMBER', ref,
          detail: 'document id present but number missing — the human-readable reference is absent' });
      }
    }

    // A claim stuck mid-flight is money collected with issuance unresolved.
    if (r.state === 'CLAIMED' || r.state === 'PENDING_FISCAL') {
      const stuckFor = r.settled_at ? Math.floor((Date.now() - r.settled_at.getTime()) / 3_600_000) : null;
      const detail = `claim is ${r.state}${stuckFor !== null ? ` and the sale settled ${stuckFor}h ago` : ''}`
        + `${r.last_error ? ` — last error: ${r.last_error.slice(0, 160)}` : ''}`;
      if (stuckFor !== null && stuckFor > 24) {
        exceptions.push({ check: 'CLAIM_STUCK', ref, amountMinor: r.amount_minor, detail });
      } else {
        warnings.push({ check: 'CLAIM_IN_FLIGHT', ref, amountMinor: r.amount_minor, detail });
      }
    }

    if (r.state === 'NEEDS_REVIEW') {
      warnings.push({ check: 'WITHHELD_FOR_REVIEW', ref, amountMinor: r.amount_minor,
        detail: `withheld, awaiting a human decision${r.last_error ? ` — ${r.last_error.slice(0, 160)}` : ''}` });
    }

    if (r.currency !== 'ILS' && r.sumit_document_id) {
      exceptions.push({ check: 'CURRENCY_MISMATCH', ref, amountMinor: r.amount_minor,
        detail: `${r.currency} sale carries a document (#${r.sumit_document_number ?? '?'}) — foreign currency must be withheld` });
    }
    if (r.amount_minor <= 0 && r.sumit_document_id) {
      exceptions.push({ check: 'NON_POSITIVE_DOCUMENTED', ref, amountMinor: r.amount_minor,
        detail: 'a non-positive amount carries a document' });
    }
    if (r.attempt_count > 5 && r.state !== 'ISSUED') {
      warnings.push({ check: 'REPEATED_ATTEMPTS', ref,
        detail: `${r.attempt_count} attempts and still ${r.state}` });
    }
  }

  for (const [ref, n] of byIdentity) {
    if (n > 1) exceptions.push({ check: 'DUPLICATE_CLAIM', ref, detail: `${n} claims for one machine+transaction — the 0148 unique index should make this impossible` });
  }
  for (const [extRef, refs] of byReference) {
    if (refs.length > 1) exceptions.push({ check: 'DUPLICATE_EXTERNAL_REFERENCE', ref: refs.join(', '), detail: `${refs.length} claims share external reference ${extRef}` });
  }
  for (const [docId, refs] of byDocument) {
    if (refs.length > 1) exceptions.push({ check: 'DOCUMENT_REUSED', ref: refs.join(', '), detail: `SUMIT document ${docId} backs ${refs.length} different claims` });
  }

  return { exceptions, warnings, documented, documentedMinor };
}

/** Run the A↔C leg against production and return the verdict. Never throws. */
export async function runFiscalWatchdog(opts: {
  runKind?: 'daily' | 'monthly' | 'manual';
  period?: string | null;
} = {}): Promise<WatchdogRun | null> {
  if (!isDatabaseAvailable) {
    logger.warn('[FiscalWatchdog] no DATABASE_URL — skipped');
    return null;
  }
  const runKind = opts.runKind ?? 'daily';
  const period = opts.period ?? null;
  const runId = `fw-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}-${runKind}`;
  const sourceCFetchedAt = new Date();

  const params: unknown[] = [];
  let where = '';
  if (period) {
    where = `WHERE to_char(settled_at, 'YYYY-MM') = $1`;
    params.push(period);
  }
  const { rows } = await pool.query(
    `SELECT nayax_transaction_id, machine_id, amount_minor, currency, settled_at,
            state, external_reference, sumit_document_id, sumit_document_number,
            attempt_count, last_error
       FROM nayax_sale_issuance_attempts ${where}`,
    params,
  );

  const { exceptions, warnings, documented, documentedMinor } = evaluateClaimLedger(rows);

  const latest = rows
    .map((r: { settled_at: Date | null }) => r.settled_at)
    .filter((d: Date | null): d is Date => !!d)
    .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0] ?? null;

  const maxAgeH = Number(process.env.WATCHDOG_MAX_SOURCE_AGE_HOURS ?? '48');
  const sourcesFresh = !latest || (Date.now() - latest.getTime()) / 3_600_000 <= maxAgeH;

  const acResult: 'PASS' | 'FAIL' = exceptions.length ? 'FAIL' : 'PASS';
  // B and D are not ingested in production, so this can never be CLOSED here.
  const status: WatchdogStatus =
      exceptions.length ? 'FAIL'
    : !sourcesFresh     ? 'PENDING_SOURCE'
    : 'AC_PASS_ONLY';

  return {
    runId, runKind, period, status, acResult,
    abResult: 'NOT_CHECKED', bdResult: 'NOT_CHECKED',
    sourceALatestAt: latest, sourceCFetchedAt, sourcesFresh,
    txnCount: rows.length,
    expectInvoiceCount: rows.filter((r: { state: string }) => r.state === 'ISSUED' || r.state === 'CLAIMED' || r.state === 'PENDING_FISCAL').length,
    documentedCount: documented,
    documentedMinor,
    exceptions, warnings,
  };
}

const ils = (minor: number) => `₪${(minor / 100).toFixed(2)}`;

/** The report body. Identifiers and money only — no cardholder or customer data. */
export function renderReport(run: WatchdogRun, recipients: { to: string[]; unresolved: string[] }): string {
  const rows = (list: WatchdogException[]) => list.length
    ? `<ul>${list.map((e) => `<li><code>${e.check}</code> — ${e.ref}${e.amountMinor !== undefined ? ` · ${ils(e.amountMinor)}` : ''}<br><small>${e.detail}</small></li>`).join('')}</ul>`
    : '<p>None.</p>';

  return `
    <h2>PetWash — Fiscal Watchdog</h2>
    <p><strong>Run:</strong> ${run.runId} (${run.runKind})<br>
       <strong>Period:</strong> ${run.period ?? 'all claims'}<br>
       <strong>Status:</strong> <strong>${run.status}</strong></p>

    <h3>Legs</h3>
    <table cellpadding="6" border="1" style="border-collapse:collapse">
      <tr><td>A&harr;C&nbsp; Nayax &harr; SUMIT (claim ledger)</td><td><strong>${run.acResult}</strong></td></tr>
      <tr><td>A&harr;B&nbsp; Nayax internal consistency</td><td>${run.abResult}</td></tr>
      <tr><td>B&harr;D&nbsp; statement &harr; bank</td><td>${run.bdResult}</td></tr>
    </table>
    <p><small>A&harr;B and B&harr;D are NOT checked here: the Nayax settlement statement and the
    bank statement arrive as files and are not yet ingested in production. This run therefore
    <strong>cannot</strong> report a month CLOSED — it verifies the issuance rail only. The full
    four-layer reconciliation is run against exports in the fiscal bridge.</small></p>

    <h3>Counts</h3>
    <p>claims in scope <strong>${run.txnCount}</strong> ·
       documented <strong>${run.documentedCount}</strong> (${ils(run.documentedMinor)}) ·
       critical <strong>${run.exceptions.length}</strong> ·
       warnings <strong>${run.warnings.length}</strong></p>
    <p>source freshness: latest settled sale
       ${run.sourceALatestAt ? run.sourceALatestAt.toISOString() : 'n/a'} —
       <strong>${run.sourcesFresh ? 'FRESH' : 'STALE'}</strong></p>

    <h3>Critical</h3>${rows(run.exceptions)}
    <h3>Warnings</h3>${rows(run.warnings)}

    <p><small>Read-only: nothing was issued, credited, altered or deleted, and no figure was
    adjusted to make totals agree. Fiscal treatment of every finding is the bookkeeper's
    decision.<br>
    Recipients: ${recipients.to.join(', ')}${recipients.unresolved.length ? ` · UNRESOLVED: ${recipients.unresolved.join(', ')}` : ''}</small></p>
  `;
}

/** Persist the run, then distribute. Delivery outcome is recorded either way. */
export async function recordAndDistribute(run: WatchdogRun): Promise<void> {
  const recipients = resolveRecipients();
  const html = renderReport(run, recipients);
  const reportHash = createHash('sha256').update(html).digest('hex');

  // Send only when it matters: any critical, or a monthly report. A daily
  // all-clear does not need to reach four inboxes — alert fatigue is how a real
  // CRITICAL gets ignored.
  const shouldSend = run.exceptions.length > 0 || run.runKind === 'monthly' || !run.sourcesFresh;
  let deliveryState = 'not_attempted';
  let deliveryError: string | null = null;
  let sentAt: Date | null = null;

  if (shouldSend && recipients.to.length) {
    try {
      const r = await sendGuardedEmail({
        service: 'fiscal:watchdog',
        msg: {
          to: recipients.to,
          from: 'alerts@petwash.co.il',
          subject: `${run.exceptions.length ? '🔴 CRITICAL' : run.sourcesFresh ? 'Fiscal watchdog' : '⚠ STALE'}`
            + ` — ${run.status}${run.period ? ` · ${run.period}` : ''}`
            + `${run.exceptions.length ? ` · ${run.exceptions.length} finding(s)` : ''}`,
          html,
        },
      });
      deliveryState = r.ok ? 'sent' : 'failed';
      deliveryError = r.ok ? null : (r.reason ?? 'blocked');
      sentAt = r.ok ? new Date() : null;
    } catch (e) {
      deliveryState = 'failed';
      deliveryError = (e as Error).message;
    }
  }

  try {
    await pool.query(
      `INSERT INTO fiscal_watchdog_runs
         (run_id, run_kind, period, finished_at, status, ac_result, ab_result, bd_result,
          source_a_latest_at, source_c_fetched_at, sources_fresh,
          txn_count, expect_invoice_count, documented_count, documented_minor,
          critical_count, warning_count, exceptions, recipients,
          delivery_state, delivery_error, sent_at, report_hash)
       VALUES ($1,$2,$3,now(),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20,$21,$22)
       ON CONFLICT (run_id) DO NOTHING`,
      [
        run.runId, run.runKind, run.period, run.status, run.acResult, run.abResult, run.bdResult,
        run.sourceALatestAt, run.sourceCFetchedAt, run.sourcesFresh,
        run.txnCount, run.expectInvoiceCount, run.documentedCount, run.documentedMinor,
        run.exceptions.length, run.warnings.length,
        JSON.stringify(run.exceptions), JSON.stringify(recipients),
        deliveryState, deliveryError, sentAt, reportHash,
      ],
    );
  } catch (e) {
    // Evidence must not be lost silently. If the record cannot be written the
    // run still happened, so say so loudly rather than pretending it did not.
    logger.error('[FiscalWatchdog] could not persist run evidence', {
      runId: run.runId, status: run.status, err: (e as Error).message,
    });
  }

  logger.info('[FiscalWatchdog] run complete', {
    runId: run.runId, status: run.status, critical: run.exceptions.length,
    warnings: run.warnings.length, delivery: deliveryState,
    unresolvedRecipients: recipients.unresolved.length,
  });
}
