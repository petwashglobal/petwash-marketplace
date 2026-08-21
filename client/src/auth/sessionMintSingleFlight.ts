/**
 * Single-flight guard for server session-cookie minting.
 *
 * WHY (Evil-hunt 2026-08-20 P0-B):
 * The previous AuthProvider bootstrapped session mint like this:
 *   await Promise.race([
 *     ensureServerSession(user).then((ok) => { sessionOk = ok; }),
 *     new Promise<void>((r) => setTimeout(r, 6000)),
 *   ]);
 *   // If the 6s watchdog won, a background retry loop kicked off
 *   // MORE ensureServerSession() calls at 1.5s intervals (up to 4).
 *
 * The watchdog did NOT cancel the in-flight fetch. If the server was
 * slow (8s), we ended up with up to FIVE simultaneous POST
 * /api/auth/session for the same UID:
 *   - duplicated telemetry
 *   - cookie-overwrite ordering races (last write wins — often the
 *     older token)
 *   - unnecessary Firebase Admin verify work
 *   - subtle session drift between what /whoami and /api/* see
 *
 * This helper coalesces every concurrent request for the same uid into
 * a single in-flight promise, resolved once by the underlying network
 * call. The watchdog still controls when the UI is revealed — but it no
 * longer influences the number of network operations.
 */

type MintFn = () => Promise<boolean>;

const inflight = new Map<string, Promise<boolean>>();

/**
 * Coalesce concurrent mint requests for the same uid. All callers get
 * the same promise; when it settles the entry is removed so a later
 * request (e.g. after failure) creates a fresh flight.
 */
export function singleFlightMint(uid: string, doMint: MintFn): Promise<boolean> {
  if (!uid) {
    // Never coalesce anonymous flights — behave as pass-through.
    return doMint();
  }
  const existing = inflight.get(uid);
  if (existing) return existing;

  // eslint-disable-next-line prefer-const
  let flight!: Promise<boolean>;
  flight = (async () => {
    try {
      return await doMint();
    } finally {
      // Only remove the entry we own — a later flight for the same uid
      // (e.g. after a failure retry) may already have replaced us.
      if (inflight.get(uid) === flight) {
        inflight.delete(uid);
      }
    }
  })();

  inflight.set(uid, flight);
  return flight;
}

/**
 * Whether there is an in-flight mint for the given uid. Used by the
 * background retry loop to decide whether to wait or to spawn a fresh
 * attempt; NEVER used to double-spawn.
 */
export function hasInflightMint(uid: string): boolean {
  return inflight.has(uid);
}

/** Diagnostics for tests only. */
export function _inflightSize(): number {
  return inflight.size;
}

/** Reset between tests. */
export function _resetInflightForTests(): void {
  inflight.clear();
}
