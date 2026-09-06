/**
 * K9000 sale → SUMIT invoice: the CLAIM LEDGER that makes the income rail safe
 * to run on a schedule.
 *
 * WHAT WAS WRONG
 * --------------
 * The sale path selected candidates purely from the live Nayax feed, consulted
 * nothing persisted, and recorded nothing afterwards. The hourly cron claimed to
 * be "idempotent (deterministic key per Nayax tx), so overlapping runs can never
 * double-issue a document". It was not:
 *
 *   - the deterministic key reaches SUMIT only as an Idempotency-Key header and
 *     an ExternalReference, and SUMIT deduplicates on neither. That is precisely
 *     why findDocumentByExternalReference exists — if SUMIT deduplicated,
 *     read-before-recreate would be pointless;
 *   - nothing wrote a sale's document into nayax_fiscal_document_links, so the
 *     next run re-selected every wash that had already been invoiced.
 *
 * An hourly cron over a rolling window would have issued a fresh tax invoice for
 * every eligible wash, every hour. Tax invoices cannot be withdrawn.
 *
 * THE FIX
 * -------
 *   1. CLAIM  — INSERT the claim. The unique index on
 *               (machine_id, nayax_transaction_id) IS the duplicate guard: the
 *               second run's insert loses, and a lost insert means "someone else
 *               owns this sale", never "go ahead".
 *   2. CREATE — call SUMIT.
 *   3. SETTLE — record the document id, or fall to PENDING_LOOKUP.
 *
 * The claim is written BEFORE the HTTP call, so a crash mid-flight still leaves
 * a row saying when to search. Recovery reads SUMIT by ExternalReference around
 * that attempt instant and only a definitive ABSENT, inside a budget of one,
 * permits a recreate.
 *
 * FAIL-CLOSED
 * -----------
 * Issuance REQUIRES a store. Without persistence there is no duplicate guard, so
 * a caller that supplies none can preview and nothing else — see
 * `issueSalesWithClaims`, which refuses rather than falling back to the old
 * unguarded behaviour.
 */
import {
  buildReceiptInput,
  idempotencyKeyFor,
  type DocumentableSale,
} from './nayaxSumitBridge';
import { logger } from '../lib/logger';

export const SALE_ISSUANCE_STATE = {
  READY: 'READY',
  CLAIMED: 'CLAIMED',
  PENDING_LOOKUP: 'PENDING_LOOKUP',
  ISSUED: 'ISSUED',
  NEEDS_RECONCILIATION: 'NEEDS_RECONCILIATION',
} as const;
export type SaleIssuanceState =
  (typeof SALE_ISSUANCE_STATE)[keyof typeof SALE_ISSUANCE_STATE];

/** Document types a K9000 sale invoice could legitimately have been filed as. */
export const SALE_DOCUMENT_TYPES = ['InvoiceAndReceipt'] as const;

export interface SaleClaim {
  state: SaleIssuanceState;
  externalReference: string;
  firstCreateAttemptAt: Date | null;
  attemptCount: number;
  sumitDocumentId?: string | null;
}

export interface SaleIssuanceStore {
  /**
   * Take the claim for this sale, or return null if it is already claimed or
   * issued. MUST be atomic — the unique index does the work, so a duplicate
   * insert losing the race returns null rather than raising.
   */
  claim(sale: DocumentableSale, now: Date): Promise<SaleClaim | null>;
  /** Read an existing claim, for recovery. */
  get(machineId: string, transactionId: string): Promise<SaleClaim | null>;
  settle(
    machineId: string,
    transactionId: string,
    next: {
      state: SaleIssuanceState;
      documentId?: string;
      documentNumber?: string;
      lastError?: string;
    },
  ): Promise<void>;
  recordDocumentLink(input: {
    nayaxTransactionId: string;
    sumitDocumentId: string;
    sumitDocumentNumber?: string;
    note?: string;
  }): Promise<void>;
}

export interface SaleSumitPort {
  createCustomerReceipt(
    input: ReturnType<typeof buildReceiptInput>,
  ): Promise<{ wired?: boolean; sumitDocumentId?: string | null; reason?: string } | null>;
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

export type SaleIssuanceOutcome =
  | { issued: true; transactionId: string; documentId: string; recovered?: boolean }
  | {
      issued: false;
      transactionId: string;
      state: SaleIssuanceState | 'ALREADY_CLAIMED';
      reason: string;
    };

/**
 * Issue ONE sale, claim first.
 *
 * A sale whose claim cannot be taken is skipped — never issued "just in case".
 * Losing the claim race means another run owns it, and the safe reading of an
 * unavailable claim is always "do not create".
 */
export async function issueSaleWithClaim(
  deps: { store: SaleIssuanceStore; sumit: SaleSumitPort; now?: () => Date },
  sale: DocumentableSale,
): Promise<SaleIssuanceOutcome> {
  const now = deps.now ?? (() => new Date());
  const machineId = String(sale.machineId ?? '');
  const txId = String(sale.transactionId);

  // ── 1. CLAIM (before any HTTP call) ──────────────────────────────────────
  const claim = await deps.store.claim(sale, now());
  if (!claim) {
    // The claim is held or the sale is already documented. Either way we do NOT
    // create. Read the row only to report accurately — never to decide.
    const existing = await deps.store.get(machineId, txId);
    if (existing?.state === SALE_ISSUANCE_STATE.ISSUED && existing.sumitDocumentId) {
      return { issued: true, transactionId: txId, documentId: existing.sumitDocumentId };
    }
    return {
      issued: false, transactionId: txId,
      state: 'ALREADY_CLAIMED', reason: 'claim_not_available',
    };
  }
  if (claim.state === SALE_ISSUANCE_STATE.ISSUED && claim.sumitDocumentId) {
    return { issued: true, transactionId: txId, documentId: claim.sumitDocumentId };
  }

  // ── 2. CREATE ────────────────────────────────────────────────────────────
  const result = await deps.sumit.createCustomerReceipt(buildReceiptInput(sale));

  // ── 3. SETTLE ────────────────────────────────────────────────────────────
  // "No exception" is not evidence a document exists. Only an id is.
  if (result && result.wired && result.sumitDocumentId) {
    await deps.store.settle(machineId, txId, {
      state: SALE_ISSUANCE_STATE.ISSUED,
      documentId: result.sumitDocumentId,
    });
    await deps.store.recordDocumentLink({
      nayaxTransactionId: txId,
      sumitDocumentId: result.sumitDocumentId,
      note: 'issued by the Nayax→SUMIT bridge',
    });
    return { issued: true, transactionId: txId, documentId: result.sumitDocumentId };
  }

  const reason = result?.reason || (result?.wired === false ? 'not_wired' : 'no_document_id');
  await deps.store.settle(machineId, txId, {
    state: SALE_ISSUANCE_STATE.PENDING_LOOKUP,
    lastError: reason,
  });
  logger.warn('[NayaxSale] create returned no document id — parked for lookup', {
    machineId, transactionId: txId, reason,
  });
  return {
    issued: false, transactionId: txId,
    state: SALE_ISSUANCE_STATE.PENDING_LOOKUP, reason,
  };
}

/**
 * Resolve a sale claim whose create outcome is unknown, by READING SUMIT.
 *
 * Centred on first_create_attempt_at — never the settlement time. Measured on
 * the 481 real K9000 documents the service→issue gap ran to a median of 30 days
 * and a maximum of 56, so a settlement-centred window would report ABSENT for
 * 95% of documents that genuinely exist, and each of those would authorise a
 * duplicate.
 */
export async function recoverSaleClaim(
  deps: { store: SaleIssuanceStore; sumit: SaleSumitPort; now?: () => Date },
  sale: DocumentableSale,
  maxRecreates = 1,
): Promise<SaleIssuanceOutcome> {
  const machineId = String(sale.machineId ?? '');
  const txId = String(sale.transactionId);
  const existing = await deps.store.get(machineId, txId);
  if (!existing) {
    return { issued: false, transactionId: txId, state: SALE_ISSUANCE_STATE.READY, reason: 'no_claim' };
  }
  if (existing.state === SALE_ISSUANCE_STATE.ISSUED && existing.sumitDocumentId) {
    return { issued: true, transactionId: txId, documentId: existing.sumitDocumentId };
  }

  const lookup = await deps.sumit.findDocumentByExternalReference({
    externalReference: existing.externalReference || idempotencyKeyFor(txId),
    documentTypes: [...SALE_DOCUMENT_TYPES],
    createAttemptAt: existing.firstCreateAttemptAt ?? undefined,
  });

  if (lookup.outcome === 'FOUND') {
    await deps.store.settle(machineId, txId, {
      state: SALE_ISSUANCE_STATE.ISSUED,
      documentId: lookup.documentId,
      documentNumber: lookup.documentNumber,
    });
    await deps.store.recordDocumentLink({
      nayaxTransactionId: txId,
      sumitDocumentId: lookup.documentId,
      sumitDocumentNumber: lookup.documentNumber,
      note: 'recovered by ExternalReference lookup — document already existed',
    });
    return { issued: true, transactionId: txId, documentId: lookup.documentId, recovered: true };
  }

  // FOUND_MISMATCH: the reference exists under an unexpected type. A human looks.
  // INCONCLUSIVE: we could not read SUMIT. Silence is not absence.
  if (lookup.outcome !== 'ABSENT') {
    const reason = lookup.outcome === 'FOUND_MISMATCH'
      ? 'reference_exists_under_unexpected_type'
      : `lookup_inconclusive:${lookup.reason}`;
    await deps.store.settle(machineId, txId, {
      state: SALE_ISSUANCE_STATE.NEEDS_RECONCILIATION, lastError: reason,
    });
    return {
      issued: false, transactionId: txId,
      state: SALE_ISSUANCE_STATE.NEEDS_RECONCILIATION, reason,
    };
  }

  if (existing.attemptCount > maxRecreates) {
    await deps.store.settle(machineId, txId, {
      state: SALE_ISSUANCE_STATE.NEEDS_RECONCILIATION, lastError: 'recreate_budget_exhausted',
    });
    return {
      issued: false, transactionId: txId,
      state: SALE_ISSUANCE_STATE.NEEDS_RECONCILIATION, reason: 'recreate_budget_exhausted',
    };
  }

  // Definitively ABSENT and inside the budget: exactly one more attempt.
  await deps.store.settle(machineId, txId, { state: SALE_ISSUANCE_STATE.READY });
  return issueSaleWithClaim(deps, sale);
}

/**
 * Issue a batch, claim-guarded.
 *
 * FAIL-CLOSED: with no store there is no duplicate guard, so this refuses rather
 * than quietly reverting to the unguarded behaviour that made a repeated run
 * dangerous in the first place.
 */
export async function issueSalesWithClaims(
  deps: { store: SaleIssuanceStore | null | undefined; sumit: SaleSumitPort; now?: () => Date },
  sales: DocumentableSale[],
): Promise<{ refused?: string; outcomes: SaleIssuanceOutcome[] }> {
  if (!deps.store) {
    logger.error('[NayaxSale] refusing to issue without a claim store — no duplicate guard');
    return { refused: 'no_claim_store', outcomes: [] };
  }
  const store = deps.store;
  const outcomes: SaleIssuanceOutcome[] = [];
  for (const sale of sales) {
    outcomes.push(await issueSaleWithClaim({ ...deps, store }, sale));
  }
  return { outcomes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Postgres implementation
// ─────────────────────────────────────────────────────────────────────────────

export interface QueryablePool {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

function mapClaim(r: any): SaleClaim {
  return {
    state: r.state as SaleIssuanceState,
    externalReference: r.external_reference,
    firstCreateAttemptAt: r.first_create_attempt_at ?? null,
    attemptCount: Number(r.attempt_count ?? 0),
    sumitDocumentId: r.sumit_document_id ?? null,
  };
}

/**
 * The live store.
 *
 * `claim` is ONE statement, and the unique index does the mutual exclusion:
 *
 *  - a first run INSERTs and wins;
 *  - a concurrent run conflicts, and the DO UPDATE is guarded by a WHERE that
 *    excludes rows already CLAIMED or ISSUED, so it updates nothing and RETURNING
 *    yields no row — which this maps to null, i.e. "someone else owns this sale".
 *
 * COALESCE keeps the FIRST attempt instant across retries, because that is the
 * instant recovery centres its SUMIT search on. Overwriting it on a later pass
 * would move the window away from where the document actually is.
 */
export function pgSaleIssuanceStore(pool: QueryablePool): SaleIssuanceStore {
  return {
    async claim(sale, now) {
      const machineId = String(sale.machineId ?? '');
      const txId = String(sale.transactionId);
      const settledAt = sale.settledAt ? new Date(sale.settledAt) : null;
      const { rows } = await pool.query(
        `INSERT INTO nayax_sale_issuance_attempts
           (nayax_transaction_id, machine_id, amount_minor, currency, settled_at,
            state, external_reference, first_create_attempt_at, last_attempt_at,
            attempt_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, 1)
         ON CONFLICT (machine_id, nayax_transaction_id) DO UPDATE
            SET state                   = $6,
                first_create_attempt_at = COALESCE(
                  nayax_sale_issuance_attempts.first_create_attempt_at,
                  EXCLUDED.first_create_attempt_at),
                last_attempt_at         = EXCLUDED.last_attempt_at,
                attempt_count           = nayax_sale_issuance_attempts.attempt_count + 1,
                updated_at              = NOW()
          WHERE nayax_sale_issuance_attempts.state NOT IN ($6, $9)
         RETURNING state, external_reference, first_create_attempt_at,
                   attempt_count, sumit_document_id`,
        [
          txId, machineId,
          Math.round(Number(sale.totalInclVat) * 100),
          sale.currency || 'ILS',
          settledAt && !Number.isNaN(settledAt.getTime()) ? settledAt : null,
          SALE_ISSUANCE_STATE.CLAIMED,
          idempotencyKeyFor(txId),
          now,
          SALE_ISSUANCE_STATE.ISSUED,
        ],
      );
      return rows[0] ? mapClaim(rows[0]) : null;
    },

    async get(machineId, transactionId) {
      const { rows } = await pool.query(
        `SELECT state, external_reference, first_create_attempt_at,
                attempt_count, sumit_document_id
           FROM nayax_sale_issuance_attempts
          WHERE machine_id = $1 AND nayax_transaction_id = $2
          LIMIT 1`,
        [machineId, transactionId],
      );
      return rows[0] ? mapClaim(rows[0]) : null;
    },

    async settle(machineId, transactionId, next) {
      await pool.query(
        `UPDATE nayax_sale_issuance_attempts
            SET state                 = $3,
                sumit_document_id     = COALESCE($4, sumit_document_id),
                sumit_document_number = COALESCE($5, sumit_document_number),
                last_error            = $6,
                updated_at            = NOW()
          WHERE machine_id = $1 AND nayax_transaction_id = $2`,
        [
          machineId, transactionId, next.state,
          next.documentId ?? null, next.documentNumber ?? null, next.lastError ?? null,
        ],
      );
    },

    async recordDocumentLink(input) {
      await pool.query(
        `INSERT INTO nayax_fiscal_document_links
           (nayax_transaction_id, sumit_document_id, sumit_document_number,
            sumit_document_type, link_type, source, note)
         VALUES ($1, $2, $3, 'InvoiceAndReceipt', 'INDIVIDUAL_ORIGINAL', 'BRIDGE_ISSUED', $4)
         ON CONFLICT DO NOTHING`,
        [
          input.nayaxTransactionId, input.sumitDocumentId,
          input.sumitDocumentNumber ?? null, input.note ?? null,
        ],
      );
    },
  };
}
