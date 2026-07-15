/**
 * Nayax event manual-import mapper (2026-07-15).
 *
 * Turns rows exported from a Nayax Core / MoMa transaction report into
 * `nayax_transaction_events` inserts, so Tower Control reconciliation works
 * TODAY — before Nayax confirms webhook capability and without the Lynx user
 * token (the pull rail in admin-lynx stays dark until that token lands).
 *
 * HARD RULES (money-integrity):
 *   • Import is RECORD-ONLY. It never awards loyalty points and never touches
 *     wallet balances — `loyaltyAwarded` is always false and processingStatus
 *     is 'imported_manual'. Points are only ever awarded by the signed
 *     webhook path (routes/nayax-monyx-events.ts), which has the 5-rule guard.
 *   • Dedup is enforced by the UNIQUE constraint on external_transaction_id;
 *     the route inserts with ON CONFLICT DO NOTHING, so re-uploading the same
 *     report is safe and counted as `duplicates`, never a second row.
 *
 * Nayax report headers vary by report type and locale, so mapping is
 * alias-based and case/space-insensitive. A row missing a transaction id or a
 * parseable amount is SKIPPED with a reason — never guessed.
 */
import { terminalForMachine } from './nayaxTerminals';
import type { InsertNayaxTransactionEvent } from '@shared/schema';

// ── Channel classifier ───────────────────────────────────────────────────────
// Canonical home for payment-channel classification (the webhook route carries
// an identical inline copy; fold it into this export on its next edit).
export function classifyChannel(paymentText: string): string {
  const s = (paymentText || '').toLowerCase();
  if (s.includes('monyx'))                                   return 'monyx_qr';
  if (s.includes('petwash'))                                 return 'petwash_wallet_qr';
  if (s.includes('apple'))                                   return 'apple_pay';
  if (s.includes('google'))                                  return 'google_pay';
  if (s.includes('prepaid') || s.includes('loyalty') ||
      s.includes('campaign') || s.includes('punch'))         return 'loyalty_prepaid';
  if (s.includes('card') || s.includes('credit') ||
      s.includes('tap') || s.includes('nfc') ||
      s.includes('emv') || s.includes('contactless'))        return 'tap_card';
  return 'unknown';
}

// ── Header aliases ───────────────────────────────────────────────────────────
// Keys are normalized: lowercase, alphanumerics only.
const HEADER_ALIASES: Record<string, string[]> = {
  transactionId: ['transactionid', 'transid', 'externalid', 'externaltransactionid', 'siteid'],
  machineId:     ['machineid', 'machinenumber', 'machine'],
  terminalId:    ['deviceid', 'devicenumber', 'terminalid', 'deviceserial'],
  payment:       ['paymentmethod', 'paymenttype', 'paymentchannel', 'cardbrand', 'paymentsource'],
  amount:        ['amount', 'settlementvalue', 'chargedamount', 'totalamount', 'price', 'amountgross'],
  currency:      ['currency', 'currencycode'],
  time:          ['machinetime', 'datetime', 'settlementtime', 'transactiontime', 'date', 'timestamp', 'authorizationtime'],
  status:        ['status', 'transactionstatus', 'approvalstatus', 'result'],
  eventType:     ['eventtype', 'type'],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Map a raw row's keys onto our canonical field names via the alias table. */
function pickFields(row: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    if (value === null || value === undefined) continue;
    normalized[normalizeHeader(rawKey)] = String(value).trim();
  }
  const out: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      if (normalized[alias] !== undefined && normalized[alias] !== '') {
        out[field] = normalized[alias];
        break;
      }
    }
  }
  return out;
}

// ── Row mapping ──────────────────────────────────────────────────────────────
export interface MappedImportRow {
  ok: true;
  event: InsertNayaxTransactionEvent;
  warnings: string[]; // recorded but non-blocking (unknown machine, non-ILS…)
}
export interface SkippedImportRow {
  ok: false;
  reason: string;
}

const APPROVED_WORDS = ['approved', 'settled', 'completed', 'success', 'ok', 'authorized'];
const REFUND_WORDS   = ['refund', 'reversed', 'chargeback'];
const DECLINE_WORDS  = ['declined', 'failed', 'cancelled', 'canceled', 'error', 'void'];

function normalizeStatus(raw: string): string {
  const s = (raw || '').toLowerCase();
  if (!s) return 'approved'; // settlement reports list settled sales; absence of a status column means the row IS a sale
  if (REFUND_WORDS.some((w) => s.includes(w)))   return 'refunded';
  if (DECLINE_WORDS.some((w) => s.includes(w)))  return 'declined';
  if (APPROVED_WORDS.some((w) => s.includes(w))) return 'approved';
  return s.slice(0, 32);
}

/** Parse Nayax report timestamps: "DD/MM/YYYY HH:mm[:ss]" (IL locale) or ISO.
 *  The IL regex MUST run first — JS `new Date('05/07/2026')` silently parses
 *  as US MM/DD (May 7), which would shift every ambiguous IL date. */
export function parseReportTime(raw: string): Date | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, dd, mm, yyyy, hh, mi, ss] = m;
    const d = new Date(
      Number(yyyy), Number(mm) - 1, Number(dd),
      Number(hh), Number(mi), Number(ss || '0'),
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function mapImportRow(
  row: Record<string, unknown>,
  importedBy: string,
): MappedImportRow | SkippedImportRow {
  const f = pickFields(row);
  const warnings: string[] = [];

  if (!f.transactionId) return { ok: false, reason: 'missing transaction id' };
  if (!f.machineId)     return { ok: false, reason: 'missing machine id' };

  const amount = parseFloat((f.amount || '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(amount)) return { ok: false, reason: 'missing/unparseable amount' };

  const when = parseReportTime(f.time || '');
  if (!when) return { ok: false, reason: 'missing/unparseable transaction time' };

  const terminal = terminalForMachine(f.machineId);
  if (!terminal) warnings.push(`unknown machine ${f.machineId} — not in NAYAX_TERMINALS`);

  const currency = (f.currency || 'ILS').toUpperCase().slice(0, 3);
  if (currency !== 'ILS') {
    // The LEFT Kfar Saba machine was mis-set to USD in Nayax Core — record the
    // row (it is real money) but flag it so reconciliation shows the problem.
    warnings.push(`non-ILS currency ${currency} — check machine currency setting in Nayax Core`);
  }

  const event: InsertNayaxTransactionEvent = {
    externalTransactionId: f.transactionId,
    machineId: f.machineId,
    terminalId: f.terminalId || terminal?.deviceId || null,
    stationId: terminal?.stationId || null,
    paymentChannel: classifyChannel(f.payment || ''),
    eventType: (f.eventType || 'transaction').toLowerCase().slice(0, 32),
    approvalStatus: normalizeStatus(f.status || ''),
    amountGross: amount.toFixed(2),
    amountNet: null,
    currency,
    transactionTime: when,
    rawPayload: { source: 'manual_import', importedBy, row },
    processingStatus: 'imported_manual',
    loyaltyAwarded: false, // NEVER award from a manual import
    loyaltyPointsAwarded: 0,
  };

  return { ok: true, event, warnings };
}
