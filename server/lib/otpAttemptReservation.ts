/**
 * Reserve one verification-code attempt BEFORE the code is compared.
 *
 * SECURITY 2026-09-13. The Redis-backed code checks (TwilioSMSService.verifyCode
 * and /api/onboarding-verification/verify-email-code) read a JSON blob, compared
 * the code, then wrote `attempts + 1` back from the value they had read. Under
 * concurrency every request reads the same count, every request gets to compare
 * the code, and every request writes back the same small number, so a burst of
 * parallel guesses never reaches the lock. Proven for the Postgres twin of this
 * bug (UnifiedVerificationService): 200 parallel wrong guesses → 200 real code
 * checks, never locked. With the reservation → exactly 5 checks, then locked.
 *
 * The rule this helper enforces:
 *   - INCR a dedicated counter key atomically. Redis INCR is atomic, so N
 *     concurrent callers receive N distinct values 1..N.
 *   - Only a caller whose value is <= max may compare the code. That bounds the
 *     number of real comparisons for one issued code to `max`, however many
 *     requests arrive at once.
 *
 * FAIL CLOSED: the project's redis wrapper returns 0 from incr() on any error or
 * when Redis is disabled. A successful INCR can never return 0, so 0 means "could
 * not reserve" and the caller must refuse — never compare. Treating 0 as "under
 * the limit" would silently remove the lock whenever Redis hiccups.
 *
 * The counter key must be deleted when a NEW code is issued and when a code is
 * verified, otherwise failures against an old code carry over to the next one.
 */

export interface AttemptCounterStore {
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
}

export type OtpAttemptReservation =
  | { ok: true; attempt: number; remaining: number }
  | { ok: false; reason: 'exhausted' | 'unavailable'; attempt: number };

export async function reserveOtpAttempt(
  store: AttemptCounterStore,
  key: string,
  maxAttempts: number,
  ttlSeconds: number,
): Promise<OtpAttemptReservation> {
  let attempt: number;
  try {
    attempt = await store.incr(key);
  } catch {
    return { ok: false, reason: 'unavailable', attempt: 0 };
  }

  if (!Number.isInteger(attempt) || attempt < 1) {
    return { ok: false, reason: 'unavailable', attempt: 0 };
  }

  // Refresh on every reservation, not only the first: if the very first
  // expire() failed, the counter would otherwise never expire.
  if (ttlSeconds > 0) {
    try { await store.expire(key, ttlSeconds); } catch { /* the INCR already counted; that is what matters */ }
  }

  if (attempt > maxAttempts) {
    return { ok: false, reason: 'exhausted', attempt };
  }
  return { ok: true, attempt, remaining: maxAttempts - attempt };
}
