/**
 * SUMIT PaymentIDs are integers (official schema). Anything else is refused
 * before it reaches SUMIT or a database key.
 */
export function parseSumitPaymentId(raw: unknown): number | null {
  const s = String(raw ?? '').trim();
  if (!/^[1-9]\d{0,15}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}
