/**
 * WalletLedgerAuthorityService — CEO PROGRAM 18 (Wallet).
 *
 * Pure evaluator. Doctrine: "AI never calculates balance. Ledger
 * authority." This service computes balance ONLY from an ordered
 * ledger of entries (credits + debits + holds + releases). Anyone
 * who wants to display or gate on a balance MUST consult this
 * service — no other component may sum arbitrary rows.
 *
 * The evaluator NEVER extrapolates. If an entry has an unknown
 * kind it refuses (LEDGER_INTEGRITY_UNKNOWN_KIND) rather than
 * guessing.
 */

export type LedgerEntryKind =
  | 'CREDIT'                                 // top-up, refund into wallet
  | 'DEBIT'                                  // paid from wallet
  | 'HOLD'                                   // reserved (pending capture)
  | 'RELEASE'                                // hold released (unbooked / cancelled)
  | 'ADJUSTMENT_POSITIVE'                    // admin/system correction (+)
  | 'ADJUSTMENT_NEGATIVE';                   // admin/system correction (-)

export interface LedgerEntry {
  entryId: string;
  kind: LedgerEntryKind;
  amountCents: number;                       // always positive; sign is on `kind`
  currency: 'ILS';
  createdAt: string;                         // ISO
}

export interface BalanceProjection {
  availableCents: number;
  heldCents: number;
  currency: 'ILS';
  entryCount: number;
  lastEntryAt: string | null;
}

export type BalanceOutcome =
  | { code: 'OK'; projection: BalanceProjection }
  | { code: 'LEDGER_INTEGRITY_UNKNOWN_KIND'; offendingEntryId: string; kind: string }
  | { code: 'CURRENCY_MISMATCH'; expected: 'ILS'; got: string; offendingEntryId: string };

export function projectWalletBalance(entries: LedgerEntry[]): BalanceOutcome {
  let available = 0;
  let held = 0;
  let lastAt: string | null = null;
  for (const e of entries) {
    if (e.currency !== 'ILS') {
      return { code: 'CURRENCY_MISMATCH', expected: 'ILS', got: e.currency, offendingEntryId: e.entryId };
    }
    switch (e.kind) {
      case 'CREDIT':               available += e.amountCents; break;
      case 'DEBIT':                available -= e.amountCents; break;
      case 'HOLD':
        available -= e.amountCents;
        held     += e.amountCents;
        break;
      case 'RELEASE':
        available += e.amountCents;
        held     -= e.amountCents;
        break;
      case 'ADJUSTMENT_POSITIVE':  available += e.amountCents; break;
      case 'ADJUSTMENT_NEGATIVE':  available -= e.amountCents; break;
      default: {
        const _exhaustive: never = e.kind;
        return { code: 'LEDGER_INTEGRITY_UNKNOWN_KIND', offendingEntryId: e.entryId, kind: e.kind as string };
      }
    }
    lastAt = e.createdAt;
  }
  return {
    code: 'OK',
    projection: {
      availableCents: available,
      heldCents: held,
      currency: 'ILS',
      entryCount: entries.length,
      lastEntryAt: lastAt,
    },
  };
}
