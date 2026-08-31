/**
 * PgCheckpointStore — CEO Journey Brain Phase 2 (task #141).
 *
 * Drizzle-backed persistence for JourneyCheckpoint. Implements the
 * CheckpointStore interface (server/services/marketplace/JourneyCheckpointService.ts)
 * so callers stay interface-agnostic and boot code can pick either
 * this store or the in-memory default via setDefaultCheckpointStore.
 *
 * The row shape lives in shared/schema.ts::journeyCheckpoints and
 * carries a UNIQUE (owner_uid, kind) constraint — put() is an
 * upsert-on-conflict so a wizard that writes twice for the same
 * (uid, kind) overwrites without a duplicate-key error.
 *
 * Never throws on a not-found — get() returns undefined and the
 * caller (typically evaluateResume) handles NO_CHECKPOINT.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { journeyCheckpoints, type JourneyCheckpointRow } from '@shared/schema';
import type {
  CheckpointKind,
  CheckpointStore,
  JourneyCheckpoint,
} from './JourneyCheckpointService';

function rowToCheckpoint(row: JourneyCheckpointRow): JourneyCheckpoint {
  return {
    kind: row.kind as CheckpointKind,
    ownerUid: row.ownerUid,
    step: row.step,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PgCheckpointStore implements CheckpointStore {
  async put(cp: JourneyCheckpoint): Promise<void> {
    // ON CONFLICT (owner_uid, kind) DO UPDATE — matches the unique
    // index shipped in shared/schema.ts.
    await db
      .insert(journeyCheckpoints)
      .values({
        ownerUid: cp.ownerUid,
        kind: cp.kind,
        step: cp.step,
        payload: cp.payload,
      })
      .onConflictDoUpdate({
        target: [journeyCheckpoints.ownerUid, journeyCheckpoints.kind],
        set: {
          step: cp.step,
          payload: cp.payload,
          updatedAt: new Date(),
        },
      });
  }

  async get(uid: string, kind: CheckpointKind): Promise<JourneyCheckpoint | undefined> {
    const [row] = await db
      .select()
      .from(journeyCheckpoints)
      .where(and(eq(journeyCheckpoints.ownerUid, uid), eq(journeyCheckpoints.kind, kind)))
      .limit(1);
    if (!row) return undefined;
    return rowToCheckpoint(row);
  }

  async delete(uid: string, kind: CheckpointKind): Promise<void> {
    await db
      .delete(journeyCheckpoints)
      .where(and(eq(journeyCheckpoints.ownerUid, uid), eq(journeyCheckpoints.kind, kind)));
  }
}
