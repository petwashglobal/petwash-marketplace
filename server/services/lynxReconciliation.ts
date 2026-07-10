/**
 * Nayax Lynx bay-sales reconciliation (2026-07-11).
 *
 * Pure transform over a machine's `lastSales` rows (the PULL feed — Nayax Lynx is
 * pull, not push) into an operator reconciliation summary for Tower Control:
 * totals, settled-vs-unsettled, authorize/settle discrepancies, per-payment-method
 * breakdown, and the prepaid (member QR-redeem) slice — the transactions that are
 * OURS to have a fiscal receipt for (public card sales at the bay are Nayax's/the
 * operator's, not PetWash's — see memory kfar-saba-live-money-not-recorded).
 *
 * READ-ONLY analytics; never moves money or touches the wash ledger.
 */

/** One row as returned by GET /operational/v1/machines/{id}/lastSales (subset). */
export interface LynxSaleRow {
  TransactionID?: number | string | null;
  MachineID?: number | string | null;
  MachineName?: string | null;
  AuthorizationValue?: number | null;
  SettlementValue?: number | null;
  CurrencyCode?: string | null;
  PaymentMethod?: string | null;
  RecognitionMethod?: string | null;
  ProductName?: string | null;
  AuthorizationDateTimeGMT?: string | null;
  SettlementDateTimeGMT?: string | null;
  SiteName?: string | null;
}

export interface ReconciledRow {
  transactionId: string | null;
  authorized: number;
  settled: number | null;
  currency: string | null;
  paymentMethod: string | null;
  product: string | null;
  authorizedAt: string | null;
  settledAt: string | null;
  isPrepaid: boolean;        // member/QR-redeem (ours to receipt)
  isSettled: boolean;
  hasDiscrepancy: boolean;   // authorized !== settled (settlement drift)
  needsAttention: boolean;   // unsettled OR discrepancy
}

export interface ReconciliationSummary {
  machineId: string;
  machineName: string | null;
  siteName: string | null;
  currency: string | null;
  totalCount: number;
  settledCount: number;
  unsettledCount: number;
  discrepancyCount: number;
  prepaidCount: number;      // member QR-redeems (PetWash-owned)
  publicCardCount: number;   // non-prepaid (Nayax/operator-owned)
  needsAttentionCount: number;
  sumAuthorized: number;
  sumSettled: number;
  byPaymentMethod: Record<string, { count: number; sumSettled: number }>;
  rows: ReconciledRow[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function looksPrepaid(row: LynxSaleRow): boolean {
  const hay = `${row.PaymentMethod ?? ''} ${row.RecognitionMethod ?? ''}`.toLowerCase();
  return hay.includes('prepaid') || hay.includes('wallet') || hay.includes('card balance');
}

/**
 * Summarize a machine's last-sales rows. Defensive: tolerates missing/null fields
 * and non-array input (returns an empty summary) so a partial Lynx response can
 * never crash the Tower feed.
 */
export function summarizeBaySales(machineId: string, rows: unknown): ReconciliationSummary {
  const list: LynxSaleRow[] = Array.isArray(rows) ? (rows as LynxSaleRow[]) : [];

  const reconciled: ReconciledRow[] = list.map((r) => {
    const authorized = Number(r.AuthorizationValue) || 0;
    const rawSettled = r.SettlementValue;
    const settled = rawSettled === null || rawSettled === undefined ? null : Number(rawSettled) || 0;
    const isSettled = settled !== null && Boolean(r.SettlementDateTimeGMT);
    // Only compare drift once actually settled; an unsettled row isn't a discrepancy.
    const hasDiscrepancy = isSettled && settled !== null && round2(settled) !== round2(authorized);
    return {
      transactionId: r.TransactionID != null ? String(r.TransactionID) : null,
      authorized: round2(authorized),
      settled: settled === null ? null : round2(settled),
      currency: r.CurrencyCode ?? null,
      paymentMethod: r.PaymentMethod ?? null,
      product: r.ProductName ? String(r.ProductName).trim() : null,
      authorizedAt: r.AuthorizationDateTimeGMT ?? null,
      settledAt: r.SettlementDateTimeGMT ?? null,
      isPrepaid: looksPrepaid(r),
      isSettled,
      hasDiscrepancy,
      needsAttention: !isSettled || hasDiscrepancy,
    };
  });

  const byPaymentMethod: Record<string, { count: number; sumSettled: number }> = {};
  for (const row of reconciled) {
    const key = row.paymentMethod || 'Unknown';
    const bucket = (byPaymentMethod[key] ||= { count: 0, sumSettled: 0 });
    bucket.count += 1;
    bucket.sumSettled = round2(bucket.sumSettled + (row.settled ?? 0));
  }

  const prepaidCount = reconciled.filter((r) => r.isPrepaid).length;
  return {
    machineId,
    machineName: list.find((r) => r.MachineName)?.MachineName ?? null,
    siteName: list.find((r) => r.SiteName)?.SiteName ?? null,
    currency: list.find((r) => r.CurrencyCode)?.CurrencyCode ?? null,
    totalCount: reconciled.length,
    settledCount: reconciled.filter((r) => r.isSettled).length,
    unsettledCount: reconciled.filter((r) => !r.isSettled).length,
    discrepancyCount: reconciled.filter((r) => r.hasDiscrepancy).length,
    prepaidCount,
    publicCardCount: reconciled.length - prepaidCount,
    needsAttentionCount: reconciled.filter((r) => r.needsAttention).length,
    sumAuthorized: round2(reconciled.reduce((s, r) => s + r.authorized, 0)),
    sumSettled: round2(reconciled.reduce((s, r) => s + (r.settled ?? 0), 0)),
    byPaymentMethod,
    rows: reconciled,
  };
}
