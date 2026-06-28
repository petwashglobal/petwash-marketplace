/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  THE MONEY RULEBOOK — single source of truth for the money pipeline        ║
 * ║  charge → receipt → payout → refund, plus commission & discount policy.    ║
 * ║                                                                            ║
 * ║  Same contract as the auth Rulebook: plain-language truth + machine        ║
 * ║  checks the Referee runs against the LIVE code, failing the build on       ║
 * ║  drift. This is the highest-stakes domain — real money — so every rule     ║
 * ║  here is a guardrail against a money leak or a double-charge.              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
import type { RuleCheck } from '../auth/authRulebook';

export interface MoneyRule {
  id: string;
  plain: string;
  status: 'enforced' | 'config-gated' | 'known-gap';
  checks: RuleCheck[];
}

export const MONEY_RULEBOOK = {
  domain: 'money/charge-receipt-payout',
  version: '1.0.0',
  updated: '2026-06-28',

  rules: [
    {
      id: 'receipt.exactly-once',
      plain: 'A booking charge issues EXACTLY ONE customer receipt. A duplicate call (webhook retry, double-submit, two call-sites) must return the existing active receipt — never mint a second tax document.',
      status: 'enforced',
      checks: [
        { id: 'receipt.guard', says: 'generateReceipt has the exactly-once guard (active customer_payment receipt per booking).',
          file: 'server/services/IsraeliDigitalReceiptService.ts',
          mustContain: ['Exactly-once guard', "receiptType, 'customer_payment'", 'Duplicate suppressed'] },
      ],
    },
    {
      id: 'commission.single-rate',
      plain: 'Platform commission is a flat 15%. It must be the SAME number everywhere — a drift between files is a silent money bug. (Today it is duplicated across 3 services; the Referee watches they stay equal until consolidated.)',
      status: 'enforced',
      checks: [
        { id: 'commission.receipt', says: 'Commission = 15% in the receipt service.',
          file: 'server/services/IsraeliDigitalReceiptService.ts', mustContain: ['PLATFORM_COMMISSION_RATE = 0.15'] },
        { id: 'commission.reconciliation', says: 'Commission = 15% in the reconciliation service (must match).',
          file: 'server/services/FinancialReconciliationService.ts', mustContain: ['PLATFORM_COMMISSION_RATE = 0.15'] },
      ],
    },
    {
      id: 'receipt.sumit-issuer',
      plain: 'SUMIT (OfficeGuy) is the licensed fiscal issuer and is env-gated: it only fires HTTP when SUMIT_ENABLED=true with all credentials. Off → safe no-op (never a fake "issued"). isWired() is the single gate.',
      status: 'config-gated',
      checks: [
        { id: 'sumit.gated', says: 'SUMIT only acts when SUMIT_ENABLED=true and wired.',
          file: 'server/services/SumitClient.ts', mustContain: ["process.env.SUMIT_ENABLED === 'true'", 'function isWired()'] },
      ],
    },
    {
      id: 'discount.k9000-only',
      plain: 'Discounts apply to the K9000 WASH price ONLY (member 5/7/10%) — never to marketplace bookings, JV, or eGift. Hard rule (a leak here = paying out more than collected).',
      status: 'enforced',
      checks: [
        { id: 'discount.scope', says: 'Member discount is documented + scoped to the K9000 wash price only.',
          file: 'shared/schema-member-discount.ts', mustContain: ['K9000 WASH price ONLY'] },
      ],
    },
    {
      id: 'einvoice.shaam-threshold-single-source',
      plain: 'The B2B electronic-invoicing (ITA / SHAAM allocation) trigger must read the date-aware, EX-VAT threshold from the single source (isShaamAllocationRequired) — NEVER a hardcoded number. The old ₪25,000 hardcode let B2B invoices ₪5k–₪25k skip ITA e-invoicing (2026 threshold is ₪5,000). Council-found 2026-06-28.',
      status: 'enforced',
      checks: [
        { id: 'einvoice.usesCanonicalThreshold', says: 'The ITA e-invoicing gate uses isShaamAllocationRequired, not a hardcoded threshold.',
          file: 'server/enterprise/israeliTax.ts',
          mustContain: ['isShaamAllocationRequired(data.amountBeforeVAT'],
          mustNotContain: ['totalAmount >= 25000'] },
      ],
    },
    {
      id: 'k9000.cortina-prepaid-safe',
      plain: 'The K9000 pre-paid redeem-at-bay (Nayax Cortina Static-QR) is DARK until NAYAX_CORTINA_ENABLED=true. It is Try-Confirm-Cancel: authorise RESERVES (no debit), settlement COMMITS via the existing atomic authorizeRedemption (the card is NEVER charged), and void RELEASES an un-debited hold — but a void AFTER a committed debit is flagged as a reconciliation break, NEVER auto-refunded (refund rail is a known gap). Wire-format pre-aligned to the verified Cortina spec (2026-06-29).',
      status: 'config-gated',
      checks: [
        { id: 'cortina.dark-gated', says: 'All Cortina handlers are dark until NAYAX_CORTINA_ENABLED.',
          file: 'server/routes/nayax-cortina.ts',
          mustContain: ["if (!cortinaEnabled()) return res.status(503)", "router.post('/void'", "k9000_reconciliation_breaks"],
          mustNotContain: ['refundToWallet', 'reverseEntry'] },
      ],
    },
    {
      id: 'escrow.single-source',
      plain: 'KNOWN GAP (task #30): escrow state is split across 3 stores (Firestore escrow_payments + Postgres billingRecords + escrowHoldings). It should be single-sourced. Declared here as a tracked gap — read-only reconciliation first, no blind migration. No failing check yet (would block the gate on a real, accepted gap); the Referee will get a hard check once consolidated.',
      status: 'known-gap',
      checks: [],
    },
  ] as MoneyRule[],
};

export type MoneyRulebook = typeof MONEY_RULEBOOK;
