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

const VAT_RATE = 0.18; // Israeli VAT (bay prices are VAT-inclusive consumer prices)
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The explicit go-live flag ON TOP OF SUMIT + Lynx being wired. Default OFF. */
export function bridgeEnabled(): boolean {
  return (process.env.NAYAX_SUMIT_BRIDGE_ENABLED || '').trim().toLowerCase() === 'true';
}

/** True only when everything needed to actually ISSUE is in place. */
export function bridgeWired(): { sumit: boolean; lynx: boolean; flag: boolean; canIssue: boolean } {
  const sumit = sumitClient.isWired();
  const lynx = LynxClient.isWired();
  const flag = bridgeEnabled();
  return { sumit, lynx, flag, canIssue: sumit && lynx && flag };
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
      reference: (r as any).PaymentServiceTransactionID ? String((r as any).PaymentServiceTransactionID) : String(r.TransactionID),
    });
  }
  return out;
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
    // Walk-up retail sale → a generic casual customer (no PII collected at the bay).
    customer: { name: 'לקוח מזדמן' },
    description: `רחיצת חיית מחמד בשירות עצמי K9000 — ${where}`,
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
  const sales = selectDocumentableSales(feed.data);
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

  return { ok: true, dryRun, wired, machineId, candidateCount: sales.length, issued, failed, rows };
}
