/**
 * Nayax → SUMIT fiscal bridge (2026-07-11).
 *
 * PetWash is the STATION OPERATOR: when a customer pays by public credit card at the
 * K9000 reader, Nayax clears the money and settles it to PetWash. That is PetWash
 * revenue, so Israeli law requires a fiscal document (חשבונית מס/קבלה) for it. There
 * is no native one-click Nayax↔SUMIT connector; the legal mechanism is that SUMIT
 * (our ITA-approved issuer of record) issues the document for each Nayax-cleared sale,
 * recording it as an already-paid credit-card payment.
 *
 * This bridge pulls a bay's transactions from the Lynx `lastSales` PULL feed and, for
 * each SETTLED PUBLIC-CARD sale, issues one SUMIT InvoiceAndReceipt (full VAT) via the
 * existing SumitClient. It NEVER documents prepaid (member QR-redeem) transactions —
 * those were already documented when the customer paid us (double-doc guard).
 *
 * SAFETY:
 *  - TRIPLE-DARK: no document is issued unless SUMIT is wired AND Lynx is wired AND
 *    NAYAX_SUMIT_BRIDGE_ENABLED=true. Default is DRY-RUN (preview only).
 *  - IDEMPOTENT: a deterministic idempotency key `nayax-bay:<TransactionID>` means
 *    SUMIT returns the same document for a repeated transaction — a re-run can never
 *    issue a second document for the same bay sale.
 *  - Reuses the CPA per-class mapping (K9000_PUBLIC_CARD ≡ K9000_WASH: full VAT,
 *    PetWash principal) — no invented tax logic.
 */
import { LynxClient } from './LynxClient';
import { sumitClient } from './SumitClient';
import { getSumitDocumentMapping } from './sumitDocumentMapping';
import type { LynxSaleRow } from './lynxReconciliation';
import { terminalForMachine, terminalLabel } from './nayaxTerminals';
import { logger } from '../lib/logger';
import { issueSaleWithClaim, type SaleIssuanceStore } from './nayaxSaleIssuance';
import { ISRAEL_VAT_RATE, israeliFiscalDate } from '@shared/israel-compliance-config';

// Re-exported so the Nayax fiscal surface has one import site; the definition
// lives in the shared config because SumitClient needs it too and this module
// already imports SumitClient.
export { israeliFiscalDate };

// Single source of truth — canonical rate (env-overridable) from israel-compliance-config.
// Bay prices are VAT-inclusive consumer prices; we back the VAT out for the SUMIT line.
const VAT_RATE = ISRAEL_VAT_RATE;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The explicit go-live flag ON TOP OF SUMIT + Lynx being wired. Default OFF. */
export function bridgeEnabled(): boolean {
  return (process.env.NAYAX_SUMIT_BRIDGE_ENABLED || '').trim().toLowerCase() === 'true';
}

/**
 * How a Nayax transaction's turnover is represented fiscally.
 *
 * FOUR states, because reality has four — an earlier draft had three and could
 * not express what SUMIT actually contains:
 *
 *   HISTORICAL_EXISTING_INDIVIDUAL
 *     A pre-cutover transaction that DOES have its own individual final SUMIT
 *     document. 481 of these demonstrably exist (#10002–#10482, issued
 *     05/09/2026). Recording history as "consolidated" when individual finals
 *     exist would be a second falsehood on top of the first.
 *
 *   HISTORICAL_CONSOLIDATED
 *     A pre-cutover transaction whose turnover is covered by ONE consolidated
 *     SUMIT document built from the Nayax report. This is the treatment the
 *     bookkeeper originally instructed, and it MUST stay representable — she may
 *     still direct it for some historical set.
 *
 *   HISTORICAL_UNRESOLVED
 *     A pre-cutover settled transaction with no established fiscal treatment.
 *     The honest default. Never silently promoted to either state above.
 *
 *   POST_CUTOVER_INDIVIDUAL
 *     At/after the cutover: one settled transaction ↔ one SUMIT document,
 *     issued by this bridge.
 *
 * ── WHAT THIS ENUM IS NOT ────────────────────────────────────────────────────
 * It is a LABEL, not the place accounting relationships live. The factual
 * relationship between a transaction and the documents that cover it belongs in
 * a link/coverage record (FiscalDocumentLink below), because the relationship is
 * many-to-one, can change, and is OBSERVED rather than decided by this code.
 * Only the cutover comparison is ours to compute; every other assignment records
 * what the bookkeeper directed or what SUMIT was observed to contain.
 */
export const FISCAL_TREATMENT = {
  HISTORICAL_EXISTING_INDIVIDUAL: 'HISTORICAL_EXISTING_INDIVIDUAL',
  HISTORICAL_CONSOLIDATED: 'HISTORICAL_CONSOLIDATED',
  HISTORICAL_UNRESOLVED: 'HISTORICAL_UNRESOLVED',
  POST_CUTOVER_INDIVIDUAL: 'POST_CUTOVER_INDIVIDUAL',
} as const;
export type FiscalTreatment = (typeof FISCAL_TREATMENT)[keyof typeof FISCAL_TREATMENT];

/**
 * A purely FACTUAL reconciliation observation, carrying no treatment.
 *
 * Used for a settled transaction seen with no matching SUMIT document while no
 * production cutover has been chosen. It is deliberately NOT one of the
 * FISCAL_TREATMENT values: "historical" is relative to a boundary, and until that
 * boundary exists the word means nothing. Calling such a row
 * HISTORICAL_UNRESOLVED before a cutover is set states a treatment the data does
 * not support — the same class of error as naming a VAT period.
 *
 * Once a cutover is chosen and these transactions fall before it, they may then be
 * recorded as HISTORICAL_UNRESOLVED, unless the bookkeeper directs otherwise.
 */
export const RECONCILIATION_OBSERVATION = {
  SETTLED_NO_DOCUMENT: 'SETTLED_NO_DOCUMENT',
} as const;
export type ReconciliationObservation =
  (typeof RECONCILIATION_OBSERVATION)[keyof typeof RECONCILIATION_OBSERVATION];

/** How a SUMIT document relates to a Nayax transaction. */
export const FISCAL_LINK_TYPE = {
  /** One document issued for this one transaction. */
  INDIVIDUAL_ORIGINAL: 'INDIVIDUAL_ORIGINAL',
  /** One document covering this transaction among many. */
  CONSOLIDATED_COVERAGE: 'CONSOLIDATED_COVERAGE',
  /** A credit / refund document against this transaction. */
  CREDIT_REFUND: 'CREDIT_REFUND',
} as const;
export type FiscalLinkType = (typeof FISCAL_LINK_TYPE)[keyof typeof FISCAL_LINK_TYPE];

/** How we came to believe a link exists — provenance is part of the fact. */
export const FISCAL_LINK_SOURCE = {
  /** Read back from SUMIT: the document carries this transaction's ExternalReference. */
  SUMIT_EXTERNAL_REFERENCE: 'SUMIT_EXTERNAL_REFERENCE',
  /** This bridge issued it and recorded the returned document id. */
  BRIDGE_ISSUED: 'BRIDGE_ISSUED',
  /** The bookkeeper stated the coverage. Never inferred by us. */
  BOOKKEEPER_DIRECTED: 'BOOKKEEPER_DIRECTED',
  /** A human recorded it manually, with a note. */
  MANUAL: 'MANUAL',
} as const;
export type FiscalLinkSource = (typeof FISCAL_LINK_SOURCE)[keyof typeof FISCAL_LINK_SOURCE];

/**
 * An OBSERVED relationship between one Nayax transaction and one SUMIT document.
 *
 * Many links may point at the same document (consolidated coverage), and one
 * transaction may carry several (an original plus a later credit). Nothing here
 * decides treatment; it records what exists, who says so, and when we saw it.
 */
export interface FiscalDocumentLink {
  nayaxTransactionId: string;
  sumitDocumentId: string;
  sumitDocumentNumber?: string | null;
  sumitDocumentType?: string | null;
  linkType: FiscalLinkType;
  source: FiscalLinkSource;
  /** When WE observed this, not when the document was issued. */
  observedAt: string;
  note?: string;
}


/**
 * The instant that separates automatic issuance from withholding. Controlled
 * ACCOUNTING configuration: once set in production it is not a developer's to move.
 *
 * It does NOT by itself assign a treatment. At/after it, a settled transaction is
 * POST_CUTOVER_INDIVIDUAL. Before it, the transaction is simply WITHHELD — which of
 * the three historical treatments applies is recorded separately, from the
 * bookkeeper's direction and from what SUMIT is observed to contain.
 *
 * Returns null when unset or unparseable — and the bridge then refuses to issue
 * anything at all (see bridgeWired). That is deliberate. The failure mode of a
 * missing cutover is not "issue nothing"; without this guard it is "individually
 * invoice the entire history", which is exactly what happened on 05/09/2026 when
 * a backfill ran with the cutover set to 2026-01-01.
 */
export function fiscalCutoverAt(): Date | null {
  const raw = (process.env.NAYAX_SUMIT_CUTOVER_AT || '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True only when everything needed to actually ISSUE is in place. */
export function bridgeWired(): {
  sumit: boolean; lynx: boolean; flag: boolean; cutover: boolean; canIssue: boolean;
} {
  const sumit = sumitClient.isWired();
  const lynx = LynxClient.isWired();
  const flag = bridgeEnabled();
  // FAIL CLOSED: no cutover configured → this bridge issues nothing.
  const cutover = fiscalCutoverAt() !== null;
  return { sumit, lynx, flag, cutover, canIssue: sumit && lynx && flag && cutover };
}

/**
 * Split candidate sales by AUTOMATIC-ISSUANCE ELIGIBILITY. PURE.
 *
 * ── WITHHELD IS AN ENGINEERING DECISION. TREATMENT IS AN ACCOUNTING STATE. ──
 * This function decides only the first, and the return type says so. An earlier
 * version returned `{ eligible, historical }` and, with no cutover configured,
 * put every candidate into `historical` — asserting a pre-cutover classification
 * from a boundary that did not exist. The words were later corrected while the
 * API still encoded the old assumption. It no longer does.
 *
 * `eligible` — permitted for automatic issuance: settled at/after the cutover.
 * `withheld` — NOT permitted for automatic issuance. Nothing more. It carries no
 *              fiscal treatment, no claim about consolidation, and no claim that
 *              the sale is "historical" — that word needs a boundary to mean
 *              anything, and with no cutover there is none.
 *
 * With no cutover: eligible = [], withheld = every candidate. Factually correct
 * and treatment-free.
 *
 * A sale with no readable settlement timestamp is WITHHELD because eligibility
 * cannot be established — not because it is old.
 */
/**
 * Turn a Nayax settlement timestamp into a real instant — explicitly, never via
 * bare `new Date(str)`.
 *
 * WHY THIS EXISTS (measured 2026-09-06): the Nayax field is `SettlementDateTimeGMT`,
 * but Nayax sends it WITHOUT a zone marker. JavaScript resolves a zone-less
 * timestamp in the HOST process's timezone, so the same wash resolves to two
 * different instants on two different machines:
 *
 *   new Date('2026-09-05 22:30:00')  on a UTC server   -> 2026-09-05T22:30Z -> Israel day 06/09
 *   new Date('2026-09-05 22:30:00')  on this dev laptop -> 2026-09-05T12:30Z -> Israel day 05/09
 *
 * A wrong day is not cosmetic here. The bookkeeper's 2026-09-06 ruling is that the
 * document's ISSUE DATE alone determines the reporting period, so a day that slips
 * across a month boundary moves income into the wrong VAT period.
 *
 * Rules:
 *  - An explicit offset or trailing Z is trusted as sent.
 *  - A zone-less `YYYY-MM-DD[T ]HH:mm[:ss]` is read as UTC, because the field says GMT.
 *  - EVERYTHING ELSE returns null. In particular a DD/MM/YYYY string (the shape the
 *    Excel export uses) is refused rather than guessed: when both halves are <= 12 it
 *    would silently parse as a different month, and a fiscal date must never be a guess.
 *    Returning null makes the sale unissuable (NO_SETTLEMENT_TIME) instead of misdated.
 */
export function parseNayaxSettlementInstant(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  // Explicit zone (…Z or …+03:00 / …-0500): trust what was sent.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Zone-less ISO-shaped: the field is named GMT, so read it as UTC explicitly.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
  if (m) {
    const [, y, mo, da, hh, mi, ss] = m;
    const d = new Date(Date.UTC(
      Number(y), Number(mo) - 1, Number(da), Number(hh), Number(mi), Number(ss ?? '0'),
    ));
    // Date.UTC happily rolls 2026-13-45 over; reject anything that did not round-trip.
    if (
      d.getUTCFullYear() !== Number(y) || d.getUTCMonth() !== Number(mo) - 1 ||
      d.getUTCDate() !== Number(da) || d.getUTCHours() !== Number(hh)
    ) return null;
    return d;
  }

  // Unrecognised shape (DD/MM/YYYY included) — refuse rather than guess.
  return null;
}


export function applyFiscalCutover(
  sales: DocumentableSale[],
  cutoverAt: Date | null,
): { eligible: DocumentableSale[]; withheld: DocumentableSale[] } {
  if (!cutoverAt) return { eligible: [], withheld: [...sales] };
  const eligible: DocumentableSale[] = [];
  const withheld: DocumentableSale[] = [];
  for (const s of sales) {
    const t = parseNayaxSettlementInstant(s.settledAt);
    if (t && t.getTime() >= cutoverAt.getTime()) eligible.push(s);
    else withheld.push(s);
  }
  return { eligible, withheld };
}

/** Prepaid (member QR-redeem) is ALREADY documented when the customer paid us — never
 *  re-document it here. Everything else settled is a public sale we must document. */
function looksPrepaid(row: LynxSaleRow): boolean {
  const hay = `${row.PaymentMethod ?? ''} ${row.RecognitionMethod ?? ''}`.toLowerCase();
  return hay.includes('prepaid') || hay.includes('wallet') || hay.includes('card balance');
}

/** A bay sale PetWash must issue a fiscal document for. */
export interface DocumentableSale {
  transactionId: string;
  machineId?: string;      // Nayax MachineID → station/bay via the terminal registry
  totalInclVat: number;    // what the customer paid (VAT-inclusive)
  amountBeforeVat: number; // backed out for the SUMIT line (VATIncluded:false)
  vatAmount: number;
  currency: string;
  cardLast4?: string;
  cardBrand?: string;
  machineName?: string;
  siteName?: string;
  authorizedAt?: string;
  /** Settlement instant — the ONLY field the fiscal cutover is judged on. */
  settledAt?: string;
  reference?: string;      // Nayax external-clearing reference for the audit trail
}

/** Deterministic idempotency key — the guarantee SUMIT never issues twice per tx. */
export function idempotencyKeyFor(transactionId: string | number): string {
  return `nayax-bay:${transactionId}`;
}

/**
 * PURE: select the SETTLED, non-prepaid, positive-amount sales that need a document.
 * Defensive: tolerates null/partial rows and non-array input.
 */
export function selectDocumentableSales(rows: unknown): DocumentableSale[] {
  const list: LynxSaleRow[] = Array.isArray(rows) ? (rows as LynxSaleRow[]) : [];
  const out: DocumentableSale[] = [];
  for (const r of list) {
    const settled = r.SettlementValue !== null && r.SettlementValue !== undefined && Boolean(r.SettlementDateTimeGMT);
    if (!settled) continue;            // only settled money gets a receipt
    if (looksPrepaid(r)) continue;     // prepaid = already ours-documented
    const total = round2(Number(r.SettlementValue) || 0);
    if (!(total > 0)) continue;
    const amountBeforeVat = round2(total / (1 + VAT_RATE));
    const cardNum = typeof (r as any).CardNumber === 'string' ? (r as any).CardNumber : '';
    out.push({
      transactionId: String(r.TransactionID),
      machineId: r.MachineID != null ? String(r.MachineID) : undefined,
      totalInclVat: total,
      amountBeforeVat,
      vatAmount: round2(total - amountBeforeVat),
      currency: r.CurrencyCode ?? 'ILS',
      cardLast4: cardNum ? cardNum.replace(/\D/g, '').slice(-4) || undefined : undefined,
      cardBrand: (r as any).CardBrand ?? undefined,
      machineName: r.MachineName ?? undefined,
      siteName: r.SiteName ?? undefined,
      authorizedAt: r.AuthorizationDateTimeGMT ?? undefined,
      settledAt: r.SettlementDateTimeGMT ?? undefined,
      reference: (r as any).PaymentServiceTransactionID ? String((r as any).PaymentServiceTransactionID) : String(r.TransactionID),
    });
  }
  return out;
}

/**
 * The catalogue item every FUTURE K9000 wash is billed against.
 *
 * 2026-09-06 — the 481 documents issued on 05/09/2026 are attached to a SUMIT item
 * literally named `PetWash rail verification`, an engineering test name that became
 * the business product label; SUMIT's product report therefore reads
 * "PetWash rail verification — ₪20,945, 99.9%". Those documents and that catalogue
 * record are NOT touched: editing the item could alter how already-issued documents
 * present. A NEW item is used from the cutover forward instead.
 *
 * The item is the PRODUCT and must stay stable — station and bay belong on the
 * document LINE, never in the item name, or SUMIT ends up with one "product" per bay.
 */
/**
 * The customer every K9000 bay document is issued to.
 *
 * All 481 existing documents (#10002–#10482) carry exactly this name, and the
 * fiscal bridge's own GENERAL_CUSTOMER_NAME is the same string. This service
 * previously used 'לקוח מזדמן' — a second generic customer that would have split
 * SUMIT's customer report between the history and everything issued afterwards,
 * the same failure the catalogue-item name caused on the product report.
 *
 * Not a developer's string to change: it is how the station's turnover is
 * grouped in the books. Only the bookkeeper changes it.
 */
export const K9000_GENERAL_CUSTOMER = 'לקוח כללי – תחנות Pet Wash';

export const K9000_INCOME_ITEM = {
  name: 'שטיפת כלבים בשירות עצמי – Pet Wash™',
  externalId: 'PETWASH-K9000-WASH',
} as const;


/**
 * Reasons a settled sale must NOT produce a fiscal document.
 *
 * Separate from the cutover: the cutover asks "is this in the automated era?",
 * these ask "is this sale safe to document at all?". Both must pass.
 */
export const ISSUANCE_BLOCKER = {
  /** Not shekels. buildReceiptInput emits ILS unconditionally, so issuing a
   *  foreign-currency sale would silently re-denominate it — an AUD 10.00 wash
   *  invoiced as ₪10.00. The one real AUD transaction (3467932838) was held out
   *  of the 2026-09 backfill by hand for exactly this reason; this makes that
   *  judgement a property of the code instead of the operator. */
  NON_ILS: 'NON_ILS',
  /** Machine absent from NAYAX_TERMINALS: the document would carry no station or
   *  bay, and an unregistered machine may not be ours at all. */
  UNKNOWN_MACHINE: 'UNKNOWN_MACHINE',
  /** No readable settlement instant — eligibility cannot be established, and a
   *  legal document must never be dated on a timestamp we could not read. */
  NO_SETTLEMENT_TIME: 'NO_SETTLEMENT_TIME',
  /** Nothing was collected. */
  NON_POSITIVE_AMOUNT: 'NON_POSITIVE_AMOUNT',
} as const;
export type IssuanceBlocker = (typeof ISSUANCE_BLOCKER)[keyof typeof ISSUANCE_BLOCKER];

/** EVERY reason this sale may not be documented. PURE. Empty = safe to issue. */
export function issuanceBlockers(sale: DocumentableSale): IssuanceBlocker[] {
  const out: IssuanceBlocker[] = [];
  if ((sale.currency || 'ILS') !== 'ILS') out.push(ISSUANCE_BLOCKER.NON_ILS);
  if (!sale.machineId || !terminalForMachine(sale.machineId)) {
    out.push(ISSUANCE_BLOCKER.UNKNOWN_MACHINE);
  }
  if (!parseNayaxSettlementInstant(sale.settledAt)) {
    out.push(ISSUANCE_BLOCKER.NO_SETTLEMENT_TIME);
  }
  if (!(Number(sale.totalInclVat) > 0)) out.push(ISSUANCE_BLOCKER.NON_POSITIVE_AMOUNT);
  return out;
}

/** Fail-closed convenience over issuanceBlockers(). */
export function isIssuable(sale: DocumentableSale): boolean {
  return issuanceBlockers(sale).length === 0;
}

/** PURE: build the exact SumitClient.createCustomerReceipt input for a bay sale. */
export function buildReceiptInput(sale: DocumentableSale) {
  const mapping = getSumitDocumentMapping('K9000_PUBLIC_CARD'); // InvoiceAndReceipt, full VAT
  // Tag the document to the STATION + BAY (the terminal registry), so each invoice
  // reads "…כפר סבא פארק ולד — ימין" instead of a bare machine number.
  const terminal = terminalForMachine(sale.machineId);
  const where = terminal ? terminalLabel(terminal) : (sale.machineName || 'עמדת PetWash');
  return {
    idempotencyKey: idempotencyKeyFor(sale.transactionId),
    // Walk-up retail sale — no PII is collected at the bay, so every document is
    // issued to the one general station customer the existing 481 already use.
    customer: { name: K9000_GENERAL_CUSTOMER },
    description: `${K9000_INCOME_ITEM.name} — ${where}`,
    // One stable product; the bay lives on the line, not in the item name.
    item: { name: K9000_INCOME_ITEM.name, externalId: K9000_INCOME_ITEM.externalId },
    lineDescription: where,
    // Fiscal date = when the wash actually closed at the bay, not when this
    // request happens to reach SUMIT. Bookkeeper-directed 2026-09-06: the issue
    // date determines the reporting period, so it must not drift with our retries.
    // A sale with no readable settledAt never reaches here — issuanceBlockers
    // withholds it (NO_SETTLEMENT_TIME).
    documentDate: parseNayaxSettlementInstant(sale.settledAt) ?? undefined,
    amountBeforeVat: sale.amountBeforeVat,
    vatAmount: sale.vatAmount,
    totalAmount: sale.totalInclVat,
    currency: 'ILS' as const,
    documentType: mapping.documentType as 'InvoiceAndReceipt',
    card: { last4: sale.cardLast4, brand: sale.cardBrand },
    context: {
      source: 'nayax-sumit-bridge',
      nayaxTransactionId: sale.transactionId,
      nayaxReference: sale.reference,
      machine: sale.machineName,
      machineId: sale.machineId,
      stationId: terminal?.stationId,
      bay: terminal?.bay,
      deviceId: terminal?.deviceId,
      site: sale.siteName,
    },
  };
}

export interface BridgeRunResult {
  ok: boolean;
  dryRun: boolean;
  wired: ReturnType<typeof bridgeWired>;
  machineId: string;
  candidateCount: number;
  issued: number;
  failed: number;
  status?: number;
  error?: string;
  rows: Array<{
    transactionId: string;
    total: number;
    documentType: 'InvoiceAndReceipt';
    issued?: boolean;
    sumitDocumentId?: string;
    reason?: string;
  }>;
  /** ISO instant at/after which a settled transaction is individually invoiced. */
  fiscalCutoverAt?: string | null;
  /** Settled sales not permitted for automatic issuance. Carries no treatment. */
  withheldCount?: number;
  /** Eligible sales blocked by an issuance guard (currency, machine, timestamp). */
  blockedCount?: number;
}

/**
 * Pull a machine's last sales and (unless dry-run) issue a SUMIT document per
 * documentable public-card sale. DEFAULTS TO DRY-RUN — pass { dryRun: false } to
 * actually issue, which additionally requires bridgeWired().canIssue.
 */
export async function reconcileMachineToSumit(
  machineId: string,
  opts?: {
    dryRun?: boolean;
    /**
     * The claim ledger. REQUIRED for live issuance — it is the duplicate guard.
     * Omitting it does not fall back to unguarded issuance; the run refuses.
     */
    claimStore?: SaleIssuanceStore | null;
  },
): Promise<BridgeRunResult> {
  const wired = bridgeWired();
  const dryRun = opts?.dryRun === false ? !wired.canIssue : true; // live only when explicitly asked AND fully wired
  const feed = await LynxClient.getLastSales(machineId);
  if (!feed.ok) {
    return { ok: false, dryRun, wired, machineId, candidateCount: 0, issued: 0, failed: 0, status: feed.status, error: feed.error, rows: [] };
  }
  const candidates = selectDocumentableSales(feed.data);

  // FISCAL CUTOVER — applied before a single document is considered.
  //
  // The only decision made here is ELIGIBILITY FOR AUTOMATIC ISSUANCE. A withheld
  // transaction is given no treatment: it may later be recorded as
  // HISTORICAL_EXISTING_INDIVIDUAL (481 already are), HISTORICAL_CONSOLIDATED or
  // HISTORICAL_UNRESOLVED — from the bookkeeper's direction and from what SUMIT is
  // observed to contain, never inferred here, and never merely because a boundary
  // was later drawn after it.
  const cutoverAt = fiscalCutoverAt();
  const { eligible: sales, withheld } = applyFiscalCutover(candidates, cutoverAt);
  if (withheld.length) {
    logger.info('[NayaxSumitBridge] withheld from automatic issuance (no treatment assigned)', {
      machineId, withheld: withheld.length,
      cutoverAt: cutoverAt ? cutoverAt.toISOString() : null,
    });
  }

  // Second gate: a sale may be in the automated era and still be unsafe to
  // document (foreign currency, unregistered machine, unreadable timestamp).
  const blocked = sales.filter((s) => !isIssuable(s));
  const issuable = sales.filter(isIssuable);
  for (const s of blocked) {
    logger.warn('[NayaxSumitBridge] blocked from issuance', {
      machineId, transactionId: s.transactionId, blockers: issuanceBlockers(s),
    });
  }

  const rows: BridgeRunResult['rows'] = [];
  let issued = 0;
  let failed = 0;

  // ── ISSUANCE IS CLAIM-GUARDED ────────────────────────────────────────────
  //
  // Every create goes through the claim ledger (nayax_sale_issuance_attempts),
  // whose unique index on (machine_id, nayax_transaction_id) is what stops a
  // repeated run from issuing a SECOND tax invoice for the same wash.
  //
  // This used to call createCustomerReceipt directly, selecting candidates from
  // the live feed alone and recording nothing afterwards. The deterministic key
  // it relied on reaches SUMIT only as an Idempotency-Key header and an
  // ExternalReference, and SUMIT deduplicates on NEITHER — which is exactly why
  // findDocumentByExternalReference exists. Run hourly over a rolling window,
  // that issued a fresh invoice for every eligible wash, every hour.
  //
  // Without a store there is no guard, so issuance REFUSES rather than falling
  // back. A caller with no persistence can preview and nothing else.
  const store = opts?.claimStore ?? null;
  if (!dryRun && issuable.length > 0 && !store) {
    logger.error('[NayaxSumitBridge] refusing to issue: no claim store, no duplicate guard', {
      machineId, issuable: issuable.length,
    });
    return {
      ok: false, dryRun, wired, machineId,
      candidateCount: issuable.length, issued: 0, failed: 0, rows: [],
      blockedCount: blocked.length,
      fiscalCutoverAt: cutoverAt ? cutoverAt.toISOString() : null,
      withheldCount: withheld.length,
      error: 'no_claim_store',
    };
  }

  for (const sale of issuable) {
    if (dryRun) {
      rows.push({ transactionId: sale.transactionId, total: sale.totalInclVat, documentType: 'InvoiceAndReceipt', issued: false });
      continue;
    }
    try {
      const r = await issueSaleWithClaim({ store: store!, sumit: sumitClient }, sale);
      if (r.issued) {
        issued++;
        rows.push({ transactionId: sale.transactionId, total: sale.totalInclVat, documentType: 'InvoiceAndReceipt', issued: true, sumitDocumentId: r.documentId });
      } else {
        // A sale whose claim was unavailable is NOT a failure — another run owns
        // it, or it is already documented. Counting it as failed would invite a
        // retry, which is the behaviour being removed.
        if (r.state !== 'ALREADY_CLAIMED') failed++;
        rows.push({ transactionId: sale.transactionId, total: sale.totalInclVat, documentType: 'InvoiceAndReceipt', issued: false, reason: r.reason });
      }
    } catch (err: any) {
      failed++;
      logger.error('[NayaxSumitBridge] issue failed', { machineId, transactionId: sale.transactionId, err: err?.message });
      rows.push({ transactionId: sale.transactionId, total: sale.totalInclVat, documentType: 'InvoiceAndReceipt', issued: false, reason: 'exception' });
    }
  }

  return {
    ok: true, dryRun, wired, machineId,
    candidateCount: issuable.length, issued, failed, rows,
    blockedCount: blocked.length,
    fiscalCutoverAt: cutoverAt ? cutoverAt.toISOString() : null,
    withheldCount: withheld.length,
  };
}
