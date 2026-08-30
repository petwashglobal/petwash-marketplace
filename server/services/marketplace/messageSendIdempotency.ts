/**
 * messageSendIdempotency — CEO DEEP-LOGIC §9, §15.
 *
 * The prior thread-chat send handler had no replay protection. On
 * flaky mobile networks:
 *   1. tap Send
 *   2. network response lost
 *   3. tap Send again
 * created TWO messages, TWO unread bumps, TWO push notifications.
 *
 * This module gives the send path a `(senderUid, threadId,
 * clientMessageId)` triple → resolved message mapping. The first send
 * wins; a second send with the SAME triple resolves to the same
 * message id without another insert.
 *
 * Scope:
 *   • The store is a bounded per-process Map. Cloud Run horizontal
 *     scaling means an instance-A first send + instance-B replay is
 *     NOT deduped by this layer alone. A durable table with a UNIQUE
 *     (senderUid, threadId, clientMessageId) constraint is the
 *     stronger form and requires a schema change (CEO-gated); this
 *     module is the first-pass protection until that lands.
 *   • booking-chat.ts already has DB-backed idempotency via
 *     bookingMessages.metadata->>'clientMessageId'. This module is
 *     used by thread-chat.ts (the chatThreadMessages table has no
 *     metadata column yet).
 */

const MAX_ENTRIES = 20_000;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface Entry {
  resolvedMessageId: string;
  expiresAt: number;
}

const store = new Map<string, Entry>();

function key(senderUid: string, threadId: string, clientMessageId: string): string {
  return `${senderUid}::${threadId}::${clientMessageId}`;
}

/** Bounded eviction — drop expired entries, then oldest insertions. */
function sweep(now: number): void {
  if (store.size <= MAX_ENTRIES) return;
  store.forEach((v, k) => {
    if (v.expiresAt < now) store.delete(k);
  });
  if (store.size <= MAX_ENTRIES) return;
  const it = store.keys();
  let dropped = 0;
  while (store.size > MAX_ENTRIES && dropped < 1024) {
    const next = it.next();
    if (next.done) break;
    store.delete(next.value);
    dropped += 1;
  }
}

/**
 * Look up a resolved message for a (senderUid, threadId,
 * clientMessageId). Returns the message id if a prior send already
 * resolved this triple; returns null when this triple is unseen.
 */
export function findPriorSend(
  senderUid: string,
  threadId: string,
  clientMessageId: string,
  now: number = Date.now(),
): string | null {
  const entry = store.get(key(senderUid, threadId, clientMessageId));
  if (!entry) return null;
  if (entry.expiresAt < now) {
    store.delete(key(senderUid, threadId, clientMessageId));
    return null;
  }
  return entry.resolvedMessageId;
}

/**
 * Record that `(senderUid, threadId, clientMessageId)` resolved to
 * `resolvedMessageId`. Called AFTER the send transaction commits
 * so a mid-flight abort never registers a phantom message id.
 */
export function recordSendResolution(
  senderUid: string,
  threadId: string,
  clientMessageId: string,
  resolvedMessageId: string,
  now: number = Date.now(),
): void {
  store.set(key(senderUid, threadId, clientMessageId), {
    resolvedMessageId,
    expiresAt: now + TTL_MS,
  });
  sweep(now);
}

/** For tests. */
export function _resetSendIdempotencyForTests(): void {
  store.clear();
}
