/**
 * StaleStateDetector — CEO PROGRAM 40 (Action Resilience).
 *
 * Pure evaluator. Two devices, two windows, offline reconnects, late
 * webhooks — the client can hold a stale copy of an entity while the
 * server has already advanced its state. The detector answers:
 *
 *   "Given the state the client saw at time T (expectedVersion) and
 *   the server's current state, is the mutation the client is about
 *   to attempt STILL VALID?"
 *
 * Two flavours:
 *   • version-based: caller provides expectedVersion + serverVersion
 *     (monotonically increasing per-entity revision).
 *   • status-based: caller provides expectedStatus + serverStatus and
 *     a list of "mutation-safe" statuses; if serverStatus is no
 *     longer in the safe set, the mutation is STALE.
 */

export type StaleOutcome =
  | { code: 'FRESH' }
  | { code: 'STALE'; reasonCode: 'VERSION_ADVANCED' | 'STATUS_ADVANCED' | 'STATUS_TERMINAL'; serverState?: string };

export interface VersionCheckInput {
  expectedVersion: number | string;
  serverVersion: number | string;
}

export function checkVersion(input: VersionCheckInput): StaleOutcome {
  const a = typeof input.expectedVersion === 'string' ? Number(input.expectedVersion) : input.expectedVersion;
  const b = typeof input.serverVersion === 'string' ? Number(input.serverVersion) : input.serverVersion;
  if (Number.isFinite(a) && Number.isFinite(b)) {
    return a === b ? { code: 'FRESH' } : { code: 'STALE', reasonCode: 'VERSION_ADVANCED', serverState: String(b) };
  }
  // Non-numeric versions (e.g. UUIDs) — treat any mismatch as advance.
  return String(input.expectedVersion) === String(input.serverVersion)
    ? { code: 'FRESH' }
    : { code: 'STALE', reasonCode: 'VERSION_ADVANCED', serverState: String(input.serverVersion) };
}

export interface StatusCheckInput {
  expectedStatus: string;
  serverStatus: string;
  /** Statuses under which the mutation is safe to attempt. */
  mutationSafeStatuses: string[];
  /** Optional set of statuses that are TERMINAL (cannot advance further). */
  terminalStatuses?: string[];
}

export function checkStatus(input: StatusCheckInput): StaleOutcome {
  const safe = new Set(input.mutationSafeStatuses.map((s) => s.toUpperCase()));
  const terminal = new Set((input.terminalStatuses ?? []).map((s) => s.toUpperCase()));
  const server = input.serverStatus.toUpperCase();
  const expected = input.expectedStatus.toUpperCase();

  if (terminal.has(server) && server !== expected) {
    return { code: 'STALE', reasonCode: 'STATUS_TERMINAL', serverState: input.serverStatus };
  }
  if (!safe.has(server)) {
    return { code: 'STALE', reasonCode: 'STATUS_ADVANCED', serverState: input.serverStatus };
  }
  return { code: 'FRESH' };
}
