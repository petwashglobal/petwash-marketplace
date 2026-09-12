/**
 * A VERIFIED PAYMENT IS NOT THE SAME AS A PAYMENT FOR *THIS* ORDER (2026-09-13).
 *
 * Every SUMIT hosted-page return handler re-verifies the transaction id with
 * SUMIT (good) and compares the amount (good) — and then fulfils whatever
 * order the QUERYSTRING named. Nothing checked that the verified transaction
 * was created for that order.
 *
 * The attack, with no special access:
 *   1. start two identical purchases (same amount) → ext=A, ext=B
 *   2. pay only A                                   → txn T is genuinely valid
 *   3. GET …/return?ID=T&ext=B
 *   T verifies, amounts match, B is fulfilled. Repeat for B, C, D…
 *
 * SUMIT echoes the ExternalIdentifier we sent when we opened the page, so the
 * binding is one comparison. server/routes/save-card.ts has done it since it
 * was written; the three money-in return handlers did not. This is that same
 * check, in one place, for all of them.
 *
 * Fail-OPEN on a missing field is deliberate and narrow: if SUMIT's payload
 * carries no external identifier at all we cannot bind, and refusing would
 * strand a customer who really did pay. The amount check still applies, and
 * the caller logs the unbound case so it is visible in reconciliation.
 */

/** Pull SUMIT's echoed external identifier out of a raw transaction payload, whatever it is named. */
export function readSumitExternalRef(raw: unknown): string | null {
  const r = raw as Record<string, any> | null | undefined;
  const found =
    r?.ExternalIdentifier ?? r?.ExternalID ?? r?.ExternalId ??
    r?.Data?.ExternalIdentifier ?? r?.Data?.ExternalID ?? r?.Data?.ExternalId ??
    r?.Payment?.ExternalIdentifier ?? r?.Payment?.ExternalID;
  if (found == null) return null;
  const s = String(found);
  return s.length === 0 ? null : s;
}

/**
 * True when SUMIT says this transaction belongs to a DIFFERENT order than the
 * one we are about to fulfil. False when they match, and false when SUMIT
 * carried no identifier (see the fail-open note above).
 */
export function sumitExternalRefMismatch(raw: unknown, expectedExternalRef: string): boolean {
  const found = readSumitExternalRef(raw);
  if (found === null) return false;
  return found !== expectedExternalRef;
}
