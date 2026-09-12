/**
 * k9000RedemptionFiscal — the fiscal document for a wash paid from STORED VALUE.
 *
 * WHY (audit 2026-09-12, gap G1): a bay redemption debited the wallet and wrote
 * the credit ledger, the wash event and the audit ledger — and issued NO SUMIT
 * document. The code assumed the value was taxed at purchase; but WALLET_TOPUP
 * and EGIFT_PURCHASE are issued as 0%-VAT stored-value receipts, and the CPA
 * decision table (sumitDocumentMapping.ts) puts the tax event at
 * EGIFT_REDEMPTION — "eGift/credit consumed for a taxable service — full VAT at
 * redemption". Nothing ever issued that class. This module does, exactly per
 * that table, for the three stored-value rails:
 *
 *   gift_credit · wallet_balance · promo_coupon  →  EGIFT_REDEMPTION
 *   wash_package                                 →  nothing (K9000_WASH was
 *                                                   FULL_VAT at purchase)
 *   loyalty_benefit                              →  nothing (no money moved)
 *
 * The document is linked to the redemption in nayax_fiscal_document_links
 * (link_type K9000_REDEMPTION_RECEIPT) so reconciliation can prove
 * "value redeemed ⇒ document exists" (gap G7).
 *
 * DARK by default: K9000_REDEMPTION_FISCAL_ENABLED=true switches it on. Until
 * the CPA + a SUMIT sandbox run confirm the treatment, it must not issue — the
 * open hosted-checkout question (gap G4) means a wrong flip could double-issue.
 * Never throws into the money path: a fiscal failure is enqueued to the fiscal
 * outbox, never a lost wash.
 *
 * This module states what the code does; it holds no VAT opinion of its own.
 */
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

export type RedemptionFiscalInput = {
  redemptionType: 'wash_package' | 'wallet_balance' | 'gift_credit' | 'loyalty_benefit' | 'promo_coupon';
  userId: string;
  /** Our TXN-… id on the credit_transactions row — the idempotency handle. */
  txnId: string;
  amountCents: number;
  washId: string;
  kioskId: string;
  bayId: string;
  side: string;
  correlationId: string;
};

export type RedemptionFiscalOutcome =
  | { status: 'skipped'; reason: 'flag_off' | 'not_stored_value' | 'zero_amount' }
  | { status: 'issued'; receiptNumber: string; receiptId?: number; enqueued: false }
  | { status: 'enqueued' }
  | { status: 'failed'; error: string };

export const K9000_REDEMPTION_RECEIPT_LINK_TYPE = 'K9000_REDEMPTION_RECEIPT';
export const K9000_REDEMPTION_RECEIPT_SOURCE = 'K9000_REDEMPTION';

/** The three rails whose value was loaded at 0% and is taxed on spend (CPA table). */
export const STORED_VALUE_RAILS = new Set(['gift_credit', 'wallet_balance', 'promo_coupon']);

export function redemptionFiscalEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.K9000_REDEMPTION_FISCAL_ENABLED || '').trim().toLowerCase() === 'true';
}

export function redemptionFiscalSourceKey(txnId: string): string {
  return `k9000-redeem:${txnId}`;
}

export interface RedemptionFiscalDeps {
  enabled: () => boolean;
  lookupCustomer: (userId: string) => Promise<{ email: string; name: string; phone?: string } | null>;
  generateReceipt: (params: Record<string, unknown>) => Promise<{ success: boolean; receiptNumber?: string; receiptId?: number; error?: string }>;
  /** Run inline; on throw persist to the fiscal outbox. Returns { enqueued } when it could not run. */
  runWithOutbox: <T>(sourceKey: string, payload: Record<string, unknown>, runNow: () => Promise<T>) => Promise<{ enqueued: boolean; result?: T }>;
  recordLink: (row: { txnId: string; receiptNumber: string; receiptId?: number; note: string }) => Promise<void>;
}

/** Build the exact receipt params — exported so the behaviour test can pin them. */
export function buildRedemptionReceiptParams(input: RedemptionFiscalInput, customer: { email: string; name: string; phone?: string }) {
  const amount = input.amountCents / 100;
  return {
    platform: 'k9000',
    paymentClass: 'EGIFT_REDEMPTION' as const,
    bookingId: redemptionFiscalSourceKey(input.txnId),
    customerEmail: customer.email,
    customerName: customer.name,
    customerPhone: customer.phone,
    serviceDescription: `K9000 self-service wash paid from stored value (${input.redemptionType})`,
    serviceDescriptionHe: `שטיפה עצמית K9000 — תשלום מיתרה טעונה (${input.redemptionType})`,
    subtotalAmount: amount,
    platformFeeAmount: 0,
    totalAmount: amount,
    paymentMethod: 'stored_value',
    metadata: {
      washId: input.washId,
      kioskId: input.kioskId,
      bayId: input.bayId,
      side: input.side,
      redemptionType: input.redemptionType,
      correlationId: input.correlationId,
      txnId: input.txnId,
    },
  };
}

export async function issueRedemptionFiscalDocument(
  input: RedemptionFiscalInput,
  deps: RedemptionFiscalDeps = defaultDeps(),
): Promise<RedemptionFiscalOutcome> {
  if (!deps.enabled()) return { status: 'skipped', reason: 'flag_off' };
  if (!STORED_VALUE_RAILS.has(input.redemptionType)) return { status: 'skipped', reason: 'not_stored_value' };
  if (!(input.amountCents > 0)) return { status: 'skipped', reason: 'zero_amount' };

  try {
    const customer = (await deps.lookupCustomer(input.userId)) || { email: '', name: '' };
    const params = buildRedemptionReceiptParams(input, customer);
    const sourceKey = redemptionFiscalSourceKey(input.txnId);
    const run = await deps.runWithOutbox(sourceKey, params, async () => {
      const r = await deps.generateReceipt(params);
      if (!r.success || !r.receiptNumber) throw new Error(r.error || 'receipt_not_issued');
      return r;
    });
    if (run.enqueued || !run.result) {
      logger.warn('[K9000 Fiscal] redemption document enqueued to the fiscal outbox', { txnId: input.txnId, correlationId: input.correlationId });
      return { status: 'enqueued' };
    }
    await deps.recordLink({
      txnId: input.txnId,
      receiptNumber: run.result.receiptNumber!,
      receiptId: run.result.receiptId,
      note: `EGIFT_REDEMPTION for ${input.redemptionType} wash ${input.washId}`,
    });
    logger.info('[K9000 Fiscal] redemption document issued', { txnId: input.txnId, receiptNumber: run.result.receiptNumber });
    return { status: 'issued', receiptNumber: run.result.receiptNumber!, receiptId: run.result.receiptId, enqueued: false };
  } catch (err: any) {
    // Never into the money path — the wash already happened; recon (G7) will
    // surface a redemption without a document.
    logger.error('[K9000 Fiscal] redemption document FAILED (wash unaffected; recon will flag it)', {
      txnId: input.txnId, correlationId: input.correlationId, error: err?.message,
    });
    return { status: 'failed', error: String(err?.message || err) };
  }
}

function defaultDeps(): RedemptionFiscalDeps {
  return {
    enabled: () => redemptionFiscalEnabled(),
    lookupCustomer: async (userId) => {
      const { db } = await import('../db');
      const { users } = await import('@shared/schema');
      const [u] = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName, phone: users.phone })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!u) return null;
      return { email: u.email || '', name: [u.firstName, u.lastName].filter(Boolean).join(' '), phone: u.phone || undefined };
    },
    generateReceipt: async (params) => {
      const { IsraeliDigitalReceiptService } = await import('./IsraeliDigitalReceiptService');
      return IsraeliDigitalReceiptService.generateReceipt(params as any);
    },
    runWithOutbox: async (sourceKey, payload, runNow) => {
      const { pool } = await import('../db');
      const { runFiscalDocumentAndPersistOnFailure } = await import('./fiscalDocumentOutbox');
      const r = await runFiscalDocumentAndPersistOnFailure({ pool, kind: 'digital_receipt', sourceKey, payload, runNow });
      return { enqueued: r.enqueued, result: r.result };
    },
    recordLink: async (row) => {
      const { db } = await import('../db');
      const { nayaxFiscalDocumentLinks } = await import('@shared/schema');
      await db.insert(nayaxFiscalDocumentLinks).values({
        nayaxTransactionId: row.txnId,
        sumitDocumentId: row.receiptNumber,
        sumitDocumentNumber: row.receiptNumber,
        sumitDocumentType: 'InvoiceAndReceipt',
        linkType: K9000_REDEMPTION_RECEIPT_LINK_TYPE,
        source: K9000_REDEMPTION_RECEIPT_SOURCE,
        note: row.note,
      } as any).onConflictDoNothing();
    },
  };
}
