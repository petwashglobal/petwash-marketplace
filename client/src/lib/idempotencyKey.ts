/**
 * safeUuid — feature-detected UUID generator with iOS-safe fallback.
 *
 * crypto.randomUUID requires Safari 15.4+ / iOS 15.4+. On iOS 15.0–15.3
 * (a real slice of the used-device long tail Israeli customers still run)
 * `crypto.randomUUID()` throws `TypeError: undefined is not a function`
 * inside the booking / payment / meet-and-greet button handlers, which
 * are load-bearing for double-charge protection. The button silently
 * crashes under the ErrorBoundary — user taps "Confirm" and NOTHING
 * happens. That was one of the recurring "booking button dead on my
 * iPhone" reports.
 *
 * This helper prefers the real UUID API, then falls back to a
 * `crypto.getRandomValues`-seeded UUIDv4 (available since iOS 6), then
 * to a Math.random-based UUID as last resort. Never throws.
 *
 * Use this everywhere on the client instead of `crypto.randomUUID()` —
 * especially for idempotency keys where a missing key means duplicate
 * writes on retry.
 */
export function safeUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }

  // getRandomValues is available in Safari 6+ / iOS 6+ — much older than randomUUID.
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1 (RFC 4122)
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
      return (
        hex.slice(0, 4).join('') +
        '-' + hex.slice(4, 6).join('') +
        '-' + hex.slice(6, 8).join('') +
        '-' + hex.slice(8, 10).join('') +
        '-' + hex.slice(10, 16).join('')
      );
    }
  } catch {
    /* fall through */
  }

  // Last-resort: Math.random. Not cryptographically strong; fine for a
  // request-scoped idempotency key (still unique per client-tap-per-second).
  const rnd = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `${rnd()}-${rnd().slice(0, 4)}-4${rnd().slice(1, 4)}-8${rnd().slice(1, 4)}-${rnd()}${rnd().slice(0, 4)}`;
}
