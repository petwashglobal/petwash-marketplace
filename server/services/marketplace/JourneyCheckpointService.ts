/**
 * JourneyCheckpointService — CEO PROGRAM 32 (Abandoned Journeys).
 *
 * Pure evaluator + pluggable store. A journey checkpoint is a
 * small, structured record the wizard writes as it progresses so
 * the user can RESUME (signup, pet profile, provider application,
 * booking request, checkout, Shop cart, eGift purchase, refund,
 * document action) exactly where they left off.
 *
 * Doctrine:
 *   § Server checkpoint. Not localStorage — the doctrine's rule
 *     is "no duplicate action" and "resume on any device", both of
 *     which require the server to know the last step.
 *   § The evaluator NEVER re-runs a completed step (idempotence).
 *   § A stale checkpoint older than the caller-supplied TTL is
 *     EXPIRED and the caller must NOT auto-resume it — the user
 *     starts fresh.
 */

export type CheckpointKind =
  | 'SIGNUP'
  | 'PET_PROFILE'
  | 'PROVIDER_APPLICATION'
  | 'BOOKING_REQUEST'
  | 'CHECKOUT'
  | 'SHOP_CART'
  | 'EGIFT_PURCHASE'
  | 'REFUND'
  | 'DOCUMENT_ACTION';

export interface JourneyCheckpoint {
  kind: CheckpointKind;
  ownerUid: string;
  step: string;                             // stable slug for the wizard step
  payload: Record<string, unknown>;
  updatedAt: string;                        // ISO
}

export interface CheckpointStore {
  put(cp: JourneyCheckpoint): Promise<void> | void;
  get(ownerUid: string, kind: CheckpointKind): Promise<JourneyCheckpoint | undefined> | (JourneyCheckpoint | undefined);
  delete(ownerUid: string, kind: CheckpointKind): Promise<void> | void;
}

export class InMemoryCheckpointStore implements CheckpointStore {
  private byKey = new Map<string, JourneyCheckpoint>();
  private k(uid: string, kind: CheckpointKind): string { return `${uid}:${kind}`; }
  put(cp: JourneyCheckpoint): void { this.byKey.set(this.k(cp.ownerUid, cp.kind), cp); }
  get(uid: string, kind: CheckpointKind): JourneyCheckpoint | undefined { return this.byKey.get(this.k(uid, kind)); }
  delete(uid: string, kind: CheckpointKind): void { this.byKey.delete(this.k(uid, kind)); }
  clear(): void { this.byKey.clear(); }
}

/**
 * Module-level default store — the runtime singleton every checkpoint
 * caller reads. Defaults to an InMemoryCheckpointStore so a wizard
 * that hasn't yet been persistence-migrated still works within a
 * single process. A Drizzle-backed PgCheckpointStore lands as a
 * follow-up; boot code swaps it in via setDefaultCheckpointStore().
 *
 * Tests use setDefaultCheckpointStore(new InMemoryCheckpointStore())
 * in beforeEach to isolate scenarios.
 */
let _defaultStore: CheckpointStore = new InMemoryCheckpointStore();

export function getDefaultCheckpointStore(): CheckpointStore {
  return _defaultStore;
}

export function setDefaultCheckpointStore(store: CheckpointStore): void {
  _defaultStore = store;
}

export type ResumeOutcome =
  | { code: 'NO_CHECKPOINT' }
  | { code: 'EXPIRED'; deletedCheckpoint: JourneyCheckpoint }
  | { code: 'RESUME'; checkpoint: JourneyCheckpoint };

export async function evaluateResume(input: {
  ownerUid: string;
  kind: CheckpointKind;
  store: CheckpointStore;
  ttlMs: number;
  now?: Date;
}): Promise<ResumeOutcome> {
  const cp = await input.store.get(input.ownerUid, input.kind);
  if (!cp) return { code: 'NO_CHECKPOINT' };
  const now = input.now ?? new Date();
  const then = new Date(cp.updatedAt).getTime();
  if (!Number.isFinite(then)) {
    await input.store.delete(input.ownerUid, input.kind);
    return { code: 'EXPIRED', deletedCheckpoint: cp };
  }
  if (now.getTime() - then > input.ttlMs) {
    await input.store.delete(input.ownerUid, input.kind);
    return { code: 'EXPIRED', deletedCheckpoint: cp };
  }
  return { code: 'RESUME', checkpoint: cp };
}
