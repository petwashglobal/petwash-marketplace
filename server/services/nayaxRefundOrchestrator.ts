/**
 * Nayax refund → SUMIT credit document: ORCHESTRATION.
 *
 * nayaxRefundRail.ts holds the pure decisions. This file performs the I/O that
 * acts on them, and it exists as a separate module so the ordering guarantees
 * below can be tested without a database and without SUMIT.
 *
 * THE ORDERING GUARANTEE
 * ----------------------
 * A fiscal document is an irreversible legal artefact, and the only way to be
 * sure we can find one we may have created is to have written down that we were
 * about to create it. So:
 *
 *   1. CLAIM  — persist first_create_attempt_at and move to CLAIMED.
 *   2. CREATE — call SUMIT.
 *   3. SETTLE — record the returned document id, or fall to PENDING_LOOKUP.
 *
 * The claim is written BEFORE the HTTP call, never after. If the process dies
 * between 1 and 3, recovery still knows when to search. If it died between
 * "create" and an after-the-fact claim, it would not — and the only remaining
 * option would be a blind recreate, which is how duplicate tax documents happen.
 *
 * WHY THE CLAIM IS ALSO A LOCK
 * ----------------------------
 * The claim UPDATE is conditional on the current state, so two concurrent
 * callers cannot both proceed to create. The loser is told the claim is already
 * in flight; it does not wait, retry or create.
 *
 * WHY "NO EXCEPTION" IS NOT SUCCESS
 * ---------------------------------
 * SumitClient.createCreditDocument deliberately NEVER THROWS — its contract says
 * a credit-document hiccup must not fail a refund the customer is already owed.
 * That is right for the refund itself and lethal here: silence is not evidence a
 * document exists. Only a returned document id is, which is what
 * interpretCreditResult enforces. Everything else becomes PENDING_LOOKUP.
 *
 * WHAT THIS FILE WILL NOT DO
 * --------------------------
 *  - It will not resolve which sale a refund reverses. Nayax does not tell us,
 *    and a matcher's candidate is not authority (see ORIGINAL_RESOLUTION_SOURCE).
 *  - It will not create a second document on an INCONCLUSIVE lookup.
 *  - It will not state a fiscal treatment or a VAT conclusion anywhere. It
 *    records observations; the bookkeeper decides what they mean.
 */
import {
  REFUND_STATE,
  type RefundState,
  type RefundBlocker,
  type RefundEventView,
  refundBlockers,
  refundExternalReference,
  recoveryDecision,
  interpretCreditResult,
} from './nayaxRefundRail';
import { terminalForMachine, terminalLabel } from './nayaxTerminals';
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';
import { logger } from '../lib/logger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Document types a Nayax refund credit could legitimately have been filed as. */
export const CREDIT_DOCUMENT_TYPES = ['CreditInvoiceAndReceipt'] as const;

/** A persisted refund row, as the orchestrator needs to see it. */
export interface RefundRow extends RefundEventView {
  state: RefundState;
  externalReference: string;
  firstCreateAttemptAt?: Date | null;
  attemptCount: number;
  /** The Nayax close of the REFUND itself — the credit document's fiscal date. */
  refundSettledAt?: Date | null;
  sumitCreditDocumentId?: string | null;
}

/**
 * Persistence the orchestrator depends on. An interface rather than direct SQL
 * so the ordering guarantees above are testable without a database — the
 * Postgres implementation is pgRefundStore() below.
 */
export interface RefundStore {
  load(machineId: string, refundTransactionId: string): Promise<RefundRow | null>;
  /**
   * Atomically take the claim: set first_create_attempt_at (only if not already
   * set — a recovery pass must keep the ORIGINAL attempt instant, since that is
   * the instant the search window is centred on), bump attempt_count, move to
   * CLAIMED. Returns null when another caller holds the claim.
   */
  claim(
    machineId: string,
    refundTransactionId: string,
    now: Date,
  ): Promise<{ firstCreateAttemptAt: Date; attemptCount: number } | null>;
  settle(
    machineId: string,
    refundTransactionId: string,
    next: {
      state: RefundState;
      documentId?: string;
      documentNumber?: string;
      lastError?: string;
    },
  ): Promise<void>;
  /** Record transaction ↔ document. The canonical fiscal linkage. */
  recordCreditLink(input: {
    nayaxTransactionId: string;
    sumitDocumentId: string;
    sumitDocumentNumber?: string;
    note?: string;
  }): Promise<void>;
}

/** The SumitClient surface used here — narrowed so tests can supply a double. */
export interface SumitCreditPort {
  createCreditDocument(input: {
    idempotencyKey: string;
    originalSumitDocumentId?: string | number;
    customer: { name: string };
    description: string;
    amountBeforeVat: number;
    vatAmount: number;
    totalAmount: number;
    currency: 'ILS';
    documentDate?: Date;
    context?: Record<string, unknown>;
  }): Promise<{ wired?: boolean; sumitDocumentId?: string | null; reason?: string } | null>;
  findDocumentByExternalReference(input: {
    externalReference: string;
    documentTypes: string[];
    createAttemptAt: Date | null | undefined;
  }): Promise<
    | { outcome: 'FOUND'; documentId: string; documentNumber?: string; documentType?: string }
    | { outcome: 'FOUND_MISMATCH'; documentId: string; documentNumber?: string; documentType?: string }
    | { outcome: 'ABSENT' }
    | { outcome: 'INCONCLUSIVE'; reason: string }
  >;
}

export interface RefundDeps {
  store: RefundStore;
  sumit: SumitCreditPort;
  /** Injected for tests; defaults to the live terminal registry. */
  knownMachine?: (machineId: string | undefined) => boolean;
  now?: () => Date;
}

export type IssuanceOutcome =
  | { issued: false; state: RefundState; withheld: RefundBlocker[]; reason: 'blocked' }
  | { issued: false; state: RefundState; reason: 'not_found' | 'claim_in_flight' | 'pending_lookup' }
  | { issued: true; state: 'ISSUED'; documentId: string };

function defaultKnownMachine(machineId: string | undefined): boolean {
  return Boolean(machineId && terminalForMachine(machineId));
}

/** VAT-inclusive minor units → the three amounts a SUMIT document needs. */
export function splitInclusiveMinor(amountMinor: number): {
  totalAmount: number; amountBeforeVat: number; vatAmount: number;
} {
  const total = round2(amountMinor / 100);
  const amountBeforeVat = round2(total / (1 + ISRAEL_VAT_RATE));
  return { totalAmount: total, amountBeforeVat, vatAmount: round2(total - amountBeforeVat) };
}

/**
 * Issue the credit document for one observed refund — claim first, create
 * second, settle third.
 */
export async function attemptCreditIssuance(
  deps: RefundDeps,
  machineId: string,
  refundTransactionId: string,
): Promise<IssuanceOutcome> {
  const knownMachine = deps.knownMachine ?? defaultKnownMachine;
  const now = deps.now ?? (() => new Date());

  const row = await deps.store.load(machineId, refundTransactionId);
  if (!row) return { issued: false, state: REFUND_STATE.OBSERVED, reason: 'not_found' };

  // Already settled — never touch a document that exists.
  if (row.state === REFUND_STATE.ISSUED && row.sumitCreditDocumentId) {
    return { issued: true, state: 'ISSUED', documentId: row.sumitCreditDocumentId };
  }

  const blockers = refundBlockers(row, knownMachine);
  if (blockers.length > 0) {
    // Nothing is written to SUMIT and the row is not advanced: a blocked refund
    // is simply not issuable yet. Whether it ever becomes issuable depends on a
    // person or on Nayax naming the parent — not on retrying.
    return { issued: false, state: row.state, withheld: blockers, reason: 'blocked' };
  }

  // ── 1. CLAIM (before any HTTP call) ──────────────────────────────────────
  const claim = await deps.store.claim(machineId, refundTransactionId, now());
  if (!claim) {
    return { issued: false, state: REFUND_STATE.CLAIMED, reason: 'claim_in_flight' };
  }

  const terminal = terminalForMachine(machineId);
  const where = terminal ? terminalLabel(terminal) : machineId;
  const amounts = splitInclusiveMinor(row.amountMinor);

  // ── 2. CREATE ────────────────────────────────────────────────────────────
  const result = await deps.sumit.createCreditDocument({
    idempotencyKey: row.externalReference,
    originalSumitDocumentId: row.originalFiscalDocumentId ?? undefined,
    customer: { name: 'לקוח כללי – תחנות Pet Wash' },
    description: `זיכוי – שטיפת כלבים בשירות עצמי – Pet Wash™ — ${where}`,
    ...amounts,
    currency: 'ILS',
    // The credit is dated by the Nayax REFUND close, for the same reason the sale
    // is dated by the sale's close (bookkeeper, 2026-09-06).
    documentDate: row.refundSettledAt ?? undefined,
    context: { refundTransactionId, machineId, originalTransactionId: row.originalTransactionId },
  });

  // ── 3. SETTLE ────────────────────────────────────────────────────────────
  const verdict = interpretCreditResult(result);
  if (verdict.state === REFUND_STATE.ISSUED && verdict.documentId) {
    await deps.store.settle(machineId, refundTransactionId, {
      state: REFUND_STATE.ISSUED,
      documentId: verdict.documentId,
    });
    await deps.store.recordCreditLink({
      nayaxTransactionId: refundTransactionId,
      sumitDocumentId: verdict.documentId,
      note: `credit for refund ${refundTransactionId}`,
    });
    return { issued: true, state: 'ISSUED', documentId: verdict.documentId };
  }

  // No document id came back. That is NOT a failure we may retry blindly — the
  // document may or may not exist. Park it for recovery to read the truth.
  await deps.store.settle(machineId, refundTransactionId, {
    state: REFUND_STATE.PENDING_LOOKUP,
    lastError: verdict.reason,
  });
  logger.warn('[NayaxRefund] credit create returned no document id — parked for lookup', {
    refundTransactionId, machineId, reason: verdict.reason,
  });
  return { issued: false, state: REFUND_STATE.PENDING_LOOKUP, reason: 'pending_lookup' };
}

export type RecoveryOutcome =
  | { state: RefundState; recreated: boolean; documentId?: string; reason: string };

/**
 * Resolve a claim whose create outcome is unknown, by READING SUMIT.
 *
 * The search is centred on first_create_attempt_at — the moment we asked for the
 * document — never on the Nayax settlement time. Measured on the 480 real K9000
 * documents, the service→issue gap ran to a median of 30 days and a maximum of
 * 56, so a window centred on the wash would report ABSENT for 95% of documents
 * that genuinely exist, and every one of those would authorise a duplicate.
 */
export async function recoverClaim(
  deps: RefundDeps,
  machineId: string,
  refundTransactionId: string,
): Promise<RecoveryOutcome> {
  const row = await deps.store.load(machineId, refundTransactionId);
  if (!row) return { state: REFUND_STATE.OBSERVED, recreated: false, reason: 'not_found' };
  if (row.state === REFUND_STATE.ISSUED && row.sumitCreditDocumentId) {
    return {
      state: REFUND_STATE.ISSUED, recreated: false,
      documentId: row.sumitCreditDocumentId, reason: 'already_issued',
    };
  }

  const lookup = await deps.sumit.findDocumentByExternalReference({
    externalReference: row.externalReference || refundExternalReference(refundTransactionId),
    documentTypes: [...CREDIT_DOCUMENT_TYPES],
    createAttemptAt: row.firstCreateAttemptAt ?? undefined,
  });

  const decision = recoveryDecision(lookup, row.attemptCount);

  if (lookup.outcome === 'FOUND') {
    await deps.store.settle(machineId, refundTransactionId, {
      state: REFUND_STATE.ISSUED,
      documentId: lookup.documentId,
      documentNumber: lookup.documentNumber,
    });
    await deps.store.recordCreditLink({
      nayaxTransactionId: refundTransactionId,
      sumitDocumentId: lookup.documentId,
      sumitDocumentNumber: lookup.documentNumber,
      note: 'recovered by ExternalReference lookup — document already existed',
    });
    return {
      state: REFUND_STATE.ISSUED, recreated: false,
      documentId: lookup.documentId, reason: decision.reason,
    };
  }

  if (!decision.recreate) {
    await deps.store.settle(machineId, refundTransactionId, {
      state: decision.state,
      lastError: decision.reason,
    });
    return { state: decision.state, recreated: false, reason: decision.reason };
  }

  // Definitively ABSENT and inside the recreate budget: exactly one more attempt,
  // which re-enters the claim→create→settle path (and so re-checks the blockers).
  await deps.store.settle(machineId, refundTransactionId, { state: REFUND_STATE.READY });
  const retry = await attemptCreditIssuance(deps, machineId, refundTransactionId);
  return {
    state: retry.issued ? REFUND_STATE.ISSUED : retry.state,
    recreated: true,
    documentId: retry.issued ? retry.documentId : undefined,
    reason: decision.reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Postgres implementation
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal pool surface, so this file does not drag the db module into tests. */
export interface QueryablePool {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

/**
 * The live store.
 *
 * Two details carry the safety:
 *
 *  - `claim` is ONE conditional UPDATE. The state predicate is the lock: a row
 *    already CLAIMED cannot be claimed again, so two workers cannot both reach
 *    the create call. COALESCE keeps the FIRST attempt instant forever, because
 *    that is the instant recovery centres its search on — overwriting it on a
 *    later pass would move the window away from where the document actually is.
 *
 *  - `confirmedCreditedMinor` is summed from AMOUNTS of refunds already ISSUED,
 *    not from a count of link rows. nayax_fiscal_document_links records that a
 *    credit exists, not how large it was, so counting rows could authorise a
 *    second credit that overdraws the original.
 */
export function pgRefundStore(pool: QueryablePool): RefundStore {
  return {
    async load(machineId, refundTransactionId) {
      const { rows } = await pool.query(
        `SELECT r.*,
                l.sumit_document_id AS original_fiscal_document_id,
                w.amount_cents      AS original_amount_minor,
                COALESCE((
                  SELECT SUM(c.amount_minor)
                    FROM nayax_refund_events c
                   WHERE c.original_transaction_id = r.original_transaction_id
                     AND c.state = $3
                     AND c.id <> r.id
                ), 0)               AS confirmed_credited_minor
           FROM nayax_refund_events r
           LEFT JOIN nayax_fiscal_document_links l
                  ON l.nayax_transaction_id = r.original_transaction_id
                 AND l.link_type = 'INDIVIDUAL_ORIGINAL'
           LEFT JOIN k9000_wash_events w
                  ON w.nayax_transaction_id = r.original_transaction_id
          WHERE r.machine_id = $1 AND r.refund_transaction_id = $2
          LIMIT 1`,
        [machineId, refundTransactionId, REFUND_STATE.ISSUED],
      );
      const r = rows[0];
      if (!r) return null;
      return {
        refundTransactionId: r.refund_transaction_id,
        machineId: r.machine_id,
        amountMinor: Number(r.amount_minor),
        currency: r.currency,
        originalTransactionId: r.original_transaction_id,
        originalResolutionSource: r.original_resolution_source,
        originalFiscalDocumentId: r.original_fiscal_document_id,
        originalAmountMinor:
          r.original_amount_minor == null ? null : Number(r.original_amount_minor),
        confirmedCreditedMinor: Number(r.confirmed_credited_minor ?? 0),
        reversalIsFinal: r.reversal_is_final === true,
        state: r.state as RefundState,
        externalReference: r.external_reference,
        firstCreateAttemptAt: r.first_create_attempt_at ?? null,
        attemptCount: Number(r.attempt_count ?? 0),
        // refund_settled_at, NEVER observed_at: observed_at is when we saw it.
        refundSettledAt: r.refund_settled_at ?? null,
        sumitCreditDocumentId: r.sumit_credit_document_id ?? null,
      };
    },

    async claim(machineId, refundTransactionId, now) {
      const { rows } = await pool.query(
        `UPDATE nayax_refund_events
            SET state                   = $4,
                first_create_attempt_at = COALESCE(first_create_attempt_at, $3),
                last_attempt_at         = $3,
                attempt_count           = attempt_count + 1,
                updated_at              = NOW()
          WHERE machine_id = $1
            AND refund_transaction_id = $2
            AND state <> $4
            AND state <> $5
          RETURNING first_create_attempt_at, attempt_count`,
        [machineId, refundTransactionId, now, REFUND_STATE.CLAIMED, REFUND_STATE.ISSUED],
      );
      const r = rows[0];
      if (!r) return null;
      return {
        firstCreateAttemptAt: r.first_create_attempt_at,
        attemptCount: Number(r.attempt_count),
      };
    },

    async settle(machineId, refundTransactionId, next) {
      await pool.query(
        `UPDATE nayax_refund_events
            SET state                        = $3,
                sumit_credit_document_id     = COALESCE($4, sumit_credit_document_id),
                sumit_credit_document_number = COALESCE($5, sumit_credit_document_number),
                last_error                   = $6,
                updated_at                   = NOW()
          WHERE machine_id = $1 AND refund_transaction_id = $2`,
        [
          machineId, refundTransactionId, next.state,
          next.documentId ?? null, next.documentNumber ?? null, next.lastError ?? null,
        ],
      );
    },

    async recordCreditLink(input) {
      await pool.query(
        `INSERT INTO nayax_fiscal_document_links
           (nayax_transaction_id, sumit_document_id, sumit_document_number,
            sumit_document_type, link_type, source, note)
         VALUES ($1, $2, $3, 'CreditInvoiceAndReceipt', 'CREDIT_REFUND', 'BRIDGE_ISSUED', $4)
         ON CONFLICT DO NOTHING`,
        [
          input.nayaxTransactionId, input.sumitDocumentId,
          input.sumitDocumentNumber ?? null, input.note ?? null,
        ],
      );
    },
  };
}
