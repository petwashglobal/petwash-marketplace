import crypto from 'crypto';

/**
 * safeEqual — constant-time string comparison for secrets, tokens and HMACs.
 *
 * `a !== b` on a secret leaks its length and matching prefix through response
 * timing. 30 files in this codebase already use crypto.timingSafeEqual; this
 * helper is the one-liner for the nine `!==` sites the 2026-09-12 sweep found
 * on the wallet / pass / activation rails. Length mismatch returns false
 * without throwing; null/undefined never match anything.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
