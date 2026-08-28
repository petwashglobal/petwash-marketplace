/**
 * Fiscal-transaction ID namespace — CEO 2026-08-27 fiscal directive §2, §83.
 *
 *   TransactionRef       = PWT-26-8K4M7          (human-readable, deterministic).
 *   RefundRef            = PWT-26-8K4M7-R1       (child of the transaction it credits).
 *   correlationId        = spine used across job + payment + ledger + SUMIT + payout.
 *
 * §2 rule: TransactionRef is safe to display anywhere — support ticket,
 * receipt subtitle, admin explorer. It authenticates NOTHING; server
 * still authorises off Firebase UID.
 *
 * The suffix is derived deterministically from the correlationId so
 * the same transaction always maps to the same TransactionRef — a
 * customer quoting a code weeks later still resolves. Deterministic
 * ≠ enumerable: the alphabet is 30 chars over 5 places (24.3 million
 * codes per year prefix); collision is a design consideration, not
 * a security fence.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTWXYZ23456789'; // no 0/O/1/I/U/V — customer-typable

const PREFIX = 'PWT';

/**
 * Human-readable PetWash transaction reference.
 *
 * Format: PWT-YY-XXXXX  where:
 *   YY    = last two digits of the transaction year (from stableIsoDate)
 *   XXXXX = deterministic 5-char suffix over `stableId`.
 *
 * The year prefix lets a year-scoped audit narrow searches; the
 * suffix keeps codes short enough to read aloud.
 */
export function generateTransactionRef(input: {
  /** The correlationId (or any stable per-transaction id). */
  stableId: string;
  /** ISO date the transaction lands. Pass null to use the current year. */
  stableIsoDate?: string | null;
}): string {
  const y2 = twoDigitYear(input.stableIsoDate ?? null);
  const suffix = deterministicSuffix(input.stableId, 5);
  return `${PREFIX}-${y2}-${suffix}`;
}

/** Refund reference tied to the original transaction. Idempotent. */
export function generateRefundRef(input: {
  originalTransactionRef: string;
  /** 1-based refund index for partial refunds — first refund is R1. */
  refundIndex: number;
}): string {
  return `${input.originalTransactionRef}-R${input.refundIndex}`;
}

/**
 * Parse a PWT reference back to its year prefix. Never throws — used
 * in admin search boxes that accept user typos.
 */
export function parseTransactionRef(raw: string): { year: string; suffix: string } | null {
  const m = /^PWT-(\d{2})-([A-Z0-9]{5})$/i.exec(raw.trim());
  if (!m) return null;
  return { year: m[1], suffix: m[2].toUpperCase() };
}

/**
 * Parse a refund reference. Returns the original ref + refund index.
 */
export function parseRefundRef(raw: string): { originalRef: string; refundIndex: number } | null {
  const m = /^(PWT-\d{2}-[A-Z0-9]{5})-R(\d+)$/i.exec(raw.trim());
  if (!m) return null;
  const idx = Number(m[2]);
  if (!Number.isFinite(idx) || idx < 1) return null;
  return { originalRef: m[1].toUpperCase(), refundIndex: idx };
}

// ─── Internal helpers ─────────────────────────────────────────────────

function twoDigitYear(iso: string | null): string {
  // Do NOT call new Date() with no argument (harness rule); instead
  // read the year from the passed ISO or fall back to "00" if the
  // caller couldn't supply one. Composer callers must supply the
  // transaction's stable date.
  if (!iso) return '00';
  const y = iso.slice(0, 4);
  return y.length === 4 ? y.slice(-2) : '00';
}

function deterministicSuffix(input: string, length: number): string {
  // xor-fold hash — matches the JobPassport idNamespace shape so the
  // codes look consistent side-by-side. Cross-platform (server +
  // browser), no crypto dep.
  let h1 = 0x811c9dc5, h2 = 0xc9dc5811 | 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x00000193);
  }
  let acc = (h1 ^ h2) >>> 0;
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[acc % ALPHABET.length];
    acc = Math.floor(acc / ALPHABET.length) + Math.imul(acc, 0x00000193 + i);
    acc = acc >>> 0;
  }
  return out;
}
