/**
 * PgCheckpointStore — CEO Journey Brain Phase 2 (task #141 wire).
 *
 * Drizzle-backed implementation of CheckpointStore. Persists to the
 * journey_checkpoints table (shared/schema.ts) which is keyed by
 * UNIQUE(owner_uid, kind) so PUT is an upsert-on-conflict, GET is a
 * simple index lookup, DELETE is a targeted row remove.
 *
 * Called via the module-level getDefaultCheckpointStore() singleton
 * that ships in JourneyCheckpointService.ts. Boot code calls
 * setDefaultCheckpointStore(new PgCheckpointStore()) once the DB
 * pool is ready; every wizard and every AttentionFeed probe
 * transparently reads persistent state from then on.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { journeyCheckpoints } from '@shared/schema';
import type {
  CheckpointKind,
  CheckpointStore,
  JourneyCheckpoint,
} from './JourneyCheckpointService';

export class PgCheckpointStore implements CheckpointStore {
  async put(cp: JourneyCheckpoint): Promise<void> {
    // Upsert on the UNIQUE(owner_uid, kind) index so a resume-in-flight
    // that PUTs twice for the same wizard step never accumulates rows.
    await db.insert(journeyCheckpoints).values({
      ownerUid: cp.ownerUid,
      kind: cp.kind,
      step: cp.step,
      payload: cp.payload,
      updatedAt: new Date(cp.updatedAt),
    }).onConflictDoUpdate({
      target: [journeyCheckpoints.ownerUid, journeyCheckpoints.kind],
      set: {
        step: cp.step,
        payload: cp.payload,
        updatedAt: sql`NOW()`,
      },
    });
  }

  async get(uid: string, kind: CheckpointKind): Promise<JourneyCheckpoint | undefined> {
    const rows = await db
      .select({
        ownerUid: journeyCheckpoints.ownerUid,
        kind: journeyCheckpoints.kind,
        step: journeyCheckpoints.step,
        payload: journeyCheckpoints.payload,
        updatedAt: journeyCheckpoints.updatedAt,
      })
      .from(journeyCheckpoints)
      .where(and(
        eq(journeyCheckpoints.ownerUid, uid),
        eq(journeyCheckpoints.kind, kind),
      ))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return {
      ownerUid: row.ownerUid,
      // Row.kind is DB varchar; narrow to CheckpointKind. If a legacy
      // row carries an unknown kind the caller's dispatch will treat
      // it as unknown — the store itself does not validate the value.
      kind: row.kind as CheckpointKind,
      step: row.step,
      payload: (row.payload as Record<string, unknown>) ?? {},
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async delete(uid: string, kind: CheckpointKind): Promise<void> {
    await db
      .delete(journeyCheckpoints)
      .where(and(
        eq(journeyCheckpoints.ownerUid, uid),
        eq(journeyCheckpoints.kind, kind),
      ));
  }
}
