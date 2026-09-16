/**
 * How long an e-voucher (E-Gift card) is worth money. ONE number, one place.
 *
 * Our published Terms say it, in English and in Hebrew:
 *   "E-vouchers are valid for 60 months (5 years) from purchase date"
 *   "שוברים דיגיטליים תקפים ל-60 חודשים (5 שנים) מתאריך הרכישה"
 * and, for anything issued before that policy: "their original expiry date or
 * 5 years from purchase, whichever is longer".
 *
 * The purchase paths already used 60 (`expiresInMonths: 60`). Three places did
 * not and wrote 365 days instead — most damagingly server/nayaxService.ts,
 * which stamped a one-year expiry onto a voucher a customer had just PAID for.
 * After that date the redeem routes read it as EXPIRED and the remaining
 * balance became unreachable: the card died four years before we said it would.
 *
 * Import this instead of writing a duration inline.
 */

/** Months an e-voucher stays valid from purchase (Terms §E-Vouchers). */
export const EVOUCHER_VALIDITY_MONTHS = 60;

/**
 * The expiry an e-voucher purchased at `from` must carry.
 * Defaults to now, so `evoucherExpiry()` is the value for a voucher issued today.
 */
export function evoucherExpiry(from: Date = new Date()): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + EVOUCHER_VALIDITY_MONTHS);
  return d;
}

/**
 * The expiry to SHOW on a wallet pass for a voucher.
 *
 * A null `expiresAt` means the voucher has no expiry recorded — and the redeem
 * routes treat null as still valid (`expires_at IS NULL OR expires_at > NOW()`).
 * Showing "expires in 12 months" on such a pass made Apple/Google grey the card
 * out while the money behind it was still live, so the holder believed it was
 * dead. Fall back to the full validity period instead, measured from when the
 * voucher was created when we know that.
 */
export function evoucherPassExpiry(expiresAt: Date | string | null | undefined, createdAt?: Date | string | null): Date {
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const base = createdAt ? new Date(createdAt) : new Date();
  return evoucherExpiry(Number.isNaN(base.getTime()) ? new Date() : base);
}
