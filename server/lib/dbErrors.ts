/**
 * Postgres error classification that sees through Drizzle's wrapper.
 *
 * Drizzle throws `Error("Failed query: insert into …")` with the real pg
 * error on `.cause`; `err.code` on the wrapper is undefined. Code that checked
 * `err.code === '23505'` therefore treated a duplicate-key RACE as a fatal
 * failure — customAuth's Firebase→customer bridge answered 500 on a new
 * account's first screen when five guarded requests raced to create the same
 * customers row (CEO sign-in, 2026-09-10 07:10Z).
 */
export function pgErrorCode(err: unknown): string | undefined {
  let e: any = err;
  for (let depth = 0; e && depth < 5; depth++) {
    if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) return e.code;
    e = e.cause;
  }
  return undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  if (pgErrorCode(err) === '23505') return true;
  const msg = String((err as any)?.message ?? '');
  const causeMsg = String((err as any)?.cause?.message ?? '');
  return /unique|duplicate key/i.test(msg) || /unique|duplicate key/i.test(causeMsg);
}
