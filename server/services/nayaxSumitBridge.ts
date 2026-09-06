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
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

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
 * The instant separating the two treatments. Controlled ACCOUNTING configuration:
 * once set in production it is not a developer's to move.
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
 * Split candidate sales by fiscal treatment. PURE.
 *
 * `eligible`   — settled at/after the cutover → POST_CUTOVER_INDIVIDUAL, this
 *                bridge issues exactly one document each.
 * `historical` — settled before the cutover. Withheld, always. Which historical
 *                treatment actually applies (EXISTING_INDIVIDUAL / CONSOLIDATED /
 *                UNRESOLVED) is NOT decided here — that comes from the link
 *                records and the bookkeeper. All this function guarantees is
 *                that the bridge never auto-invoices a pre-cutover transaction.
 *
 * A sale with no readable settlement timestamp is treated as HISTORICAL: we do
 * not issue a legal document on a date we could not read.
 */
export function applyFiscalCutover(
  sales: DocumentableSale[],
  cutoverAt: Date | null,
): { eligible: DocumentableSale[]; historical: DocumentableSale[] } {
  if (!cutoverAt) return { eligible: [], historical: [...sales] };
  const eligible: DocumentableSale[] = [];
  const historical: DocumentableSale[] = [];
  for (const s of sales) {
    const t = s.settledAt ? new Date(s.settledAt) : null;
    if (t && !Number.isNaN(t.getTime()) && t.getTime() >= cutoverAt.getTime()) eligible.push(s);
    else historical.push(s);
  }
  return { eligible, historical };
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
export const K9000_INCOME_ITEM = {
  name: 'שטיפת כלבים בשירות עצמי – Pet Wash™',
  externalId: 'PETWASH-K9000-WASH',
} as const;

/** PURE: build the exact SumitClient.createCustomerReceipt input for a bay sale. */
export function buildReceiptInput(sale: DocumentableSale) {
  const mapping = getSumitDocumentMapping('K9000_PUBLIC_CARD'); // InvoiceAndReceipt, full VAT
  // Tag the document to the STATION + BAY (the terminal registry), so each invoice
  // reads "…כפר סבא פארק ולד — ימין" instead of a bare machine number.
  const terminal = terminalForMachine(sale.machineId);
  const where = terminal ? terminalLabel(terminal) : (sale.machineName || 'עמדת PetWash');
  return {
    idempotencyKey: idempotencyKeyFor(sale.transactionId),
    // Walk-up retail sale → a generic casual customer (no PII collected at the bay).
    customer: { name: 'לקוח מזדמן' },
    description: `${K9000_INCOME_ITEM.name} — ${where}`,
    // One stable product; the bay lives on the line, not in the item name.
    item: { name: K9000_INCOME_ITEM.name, externalId: K9000_INCOME_ITEM.externalId },
    lineDescription: where,
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
  /** ISO instant separating HISTORICAL_CONSOLIDATED from POST_CUTOVER_INDIVIDUAL. */
  fiscalCutoverAt?: string | null;
  /** Settled sales withheld because they precede the cutover. Never auto-invoiced. */
  historicalWithheld?: number;
}

/**
 * Pull a machine's last sales and (unless dry-run) issue a SUMIT document per
 * documentable public-card sale. DEFAULTS TO DRY-RUN — pass { dryRun: false } to
 * actually issue, which additionally requires bridgeWired().canIssue.
 */
export async function reconcileMachineToSumit(
  machineId: string,
  opts?: { dryRun?: boolean },
): Promise<BridgeRunResult> {
  const wired = bridgeWired();
  const dryRun = opts?.dryRun === false ? !wired.canIssue : true; // live only when explicitly asked AND fully wired
  const feed = await LynxClient.getLastSales(machineId);
  if (!feed.ok) {
    return { ok: false, dryRun, wired, machineId, candidateCount: 0, issued: 0, failed: 0, status: feed.status, error: feed.error, rows: [] };
  }
  const candidates = selectDocumentableSales(feed.data);

  // FISCAL CUTOVER — applied before a single document is considered.
  // Anything settled before the cutover belongs to the consolidated historical
  // document and is withheld here. This bridge must never be the thing that turns
  // historical turnover into per-transaction invoices.
  const cutoverAt = fiscalCutoverAt();
  const { eligible: sales, historical } = applyFiscalCutover(candidates, cutoverAt);
  if (historical.length) {
    logger.info('[NayaxSumitBridge] withheld pre-cutover sales (historical — treatment not decided here)', {
      machineId, withheld: historical.length,
      cutoverAt: cutoverAt ? cutoverAt.toISOString() : null,
    });
  }

  const rows: BridgeRunResult['rows'] = [];
  let issued = 0;
  let failed = 0;

  for (const sale of sales) {
    if (dryRun) {
      rows.push({ transactionId: sale.transactionId, total: sale.totalInclVat, documentType: 'InvoiceAndReceipt', issued: false });
      continue;
    }
    try {
      const r = await sumitClient.createCustomerReceipt(buildReceiptInput(sale));
      if (r.wired && r.sumitDocumentId) {
        issued++;
        rows.push({ transactionId: sale.transactionId, total: sale.totalInclVat, documentType: 'InvoiceAndReceipt', issued: true, sumitDocumentId: r.sumitDocumentId });
      } else {
        failed++;
        rows.push({ transactionId: sale.transactionId, total: sale.totalInclVat, documentType: 'InvoiceAndReceipt', issued: false, reason: r.reason || 'no_document_id' });
      }
    } catch (err: any) {
      failed++;
      logger.error('[NayaxSumitBridge] issue failed', { machineId, transactionId: sale.transactionId, err: err?.message });
      rows.push({ transactionId: sale.transactionId, total: sale.totalInclVat, documentType: 'InvoiceAndReceipt', issued: false, reason: 'exception' });
    }
  }

  return {
    ok: true, dryRun, wired, machineId,
    candidateCount: sales.length, issued, failed, rows,
    fiscalCutoverAt: cutoverAt ? cutoverAt.toISOString() : null,
    historicalWithheld: historical.length,
  };
}
