/**
 * Lane C · Journey Brain Phase 2 behavioural tests.
 *
 * Every function in server/services/journeyCheckpoints.ts is exercised
 * against a fake pg.Pool. The service is pure "call pool, translate
 * row, log-and-swallow on error" — behaviour tests confirm:
 *   • UPSERT shape (single INSERT ... ON CONFLICT DO UPDATE)
 *   • expires_at > now() filter on reads (expired rows are absent)
 *   • fail-soft on DB error — never throws
 *   • prune uses `expires_at <= now()`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import {
  clearCheckpoint,
  getActiveCheckpoint,
  listActiveCheckpoints,
  pruneExpiredCheckpoints,
  saveCheckpoint,
} from '../services/journeyCheckpoints';

function makePool(queryImpl: (text: string, params: unknown[]) => Promise<any>) {
  const query = vi.fn((text: string, params: unknown[]) => queryImpl(text, params));
  return { query } as unknown as Pool & { query: ReturnType<typeof vi.fn> };
}

let logSpy: any;
beforeEach(() => {
  logSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  logSpy.mockRestore();
});

describe('journeyCheckpoints · saveCheckpoint', () => {
  it('UPSERTs with ON CONFLICT DO UPDATE (never stacks)', async () => {
    let seenSql = '';
    let seenParams: unknown[] = [];
    const pool = makePool(async (text, params) => {
      seenSql = text;
      seenParams = params;
      return { rowCount: 1, rows: [] };
    });
    await saveCheckpoint(pool, {
      userUid: 'u1',
      domain: 'sitter_book',
      payload: { step: 3, providerId: 'p9' },
    });
    expect(seenSql).toMatch(/INSERT INTO journey_checkpoints/);
    expect(seenSql).toMatch(/ON CONFLICT \(user_uid, domain\) DO UPDATE/);
    expect(seenParams[0]).toBe('u1');
    expect(seenParams[1]).toBe('sitter_book');
    // Payload JSON-stringified
    expect(JSON.parse(String(seenParams[2]))).toEqual({ step: 3, providerId: 'p9' });
    // Expiry in the future (72h default) — allow a wide window
    const expiresAt = seenParams[3] as Date;
    const nowMs = Date.now();
    const t = expiresAt.getTime();
    expect(t).toBeGreaterThan(nowMs);
    expect(t).toBeLessThan(nowMs + 80 * 3600 * 1000);
  });

  it('uses custom ttlHours when provided', async () => {
    let seenParams: unknown[] = [];
    const pool = makePool(async (_t, params) => {
      seenParams = params;
      return { rowCount: 1, rows: [] };
    });
    await saveCheckpoint(pool, {
      userUid: 'u2',
      domain: 'shop_checkout',
      payload: {},
      ttlHours: 1,
    });
    const expiresAt = seenParams[3] as Date;
    const dtMs = expiresAt.getTime() - Date.now();
    expect(dtMs).toBeGreaterThan(30 * 60 * 1000);
    expect(dtMs).toBeLessThan(90 * 60 * 1000);
  });

  it('is fail-soft — DB error does NOT throw', async () => {
    const pool = makePool(async () => {
      throw new Error('pg down');
    });
    await expect(
      saveCheckpoint(pool, { userUid: 'u3', domain: 'walk_book', payload: {} }),
    ).resolves.not.toThrow();
  });
});

describe('journeyCheckpoints · getActiveCheckpoint', () => {
  it('filters by user + domain + `expires_at > now()`', async () => {
    let seenSql = '';
    const pool = makePool(async (text) => {
      seenSql = text;
      return { rowCount: 0, rows: [] };
    });
    await getActiveCheckpoint(pool, { userUid: 'u1', domain: 'sitter_book' });
    expect(seenSql).toMatch(/WHERE user_uid = \$1/);
    expect(seenSql).toMatch(/AND domain = \$2/);
    expect(seenSql).toMatch(/AND expires_at > now\(\)/);
    expect(seenSql).toMatch(/LIMIT 1/);
  });

  it('returns null when no row (expired or absent)', async () => {
    const pool = makePool(async () => ({ rowCount: 0, rows: [] }));
    const got = await getActiveCheckpoint(pool, { userUid: 'u1', domain: 'sitter_book' });
    expect(got).toBeNull();
  });

  it('maps DB row to camelCase JourneyCheckpointRow', async () => {
    const now = new Date();
    const pool = makePool(async () => ({
      rowCount: 1,
      rows: [
        {
          id: 'row-1',
          user_uid: 'u1',
          domain: 'sitter_book',
          payload: { step: 4 },
          expires_at: now,
          created_at: now,
          updated_at: now,
        },
      ],
    }));
    const got = await getActiveCheckpoint(pool, { userUid: 'u1', domain: 'sitter_book' });
    expect(got?.id).toBe('row-1');
    expect(got?.userUid).toBe('u1');
    expect(got?.domain).toBe('sitter_book');
    expect(got?.payload).toEqual({ step: 4 });
    expect(got?.expiresAt.getTime()).toBe(now.getTime());
  });

  it('is fail-soft — DB error returns null, does NOT throw', async () => {
    const pool = makePool(async () => {
      throw new Error('pg down');
    });
    const got = await getActiveCheckpoint(pool, { userUid: 'u1', domain: 'sitter_book' });
    expect(got).toBeNull();
  });
});

describe('journeyCheckpoints · listActiveCheckpoints', () => {
  it('orders by updated_at DESC and filters expired', async () => {
    let seenSql = '';
    const pool = makePool(async (text) => {
      seenSql = text;
      return { rowCount: 0, rows: [] };
    });
    await listActiveCheckpoints(pool, { userUid: 'u1' });
    expect(seenSql).toMatch(/WHERE user_uid = \$1[\s\S]*AND expires_at > now\(\)/);
    expect(seenSql).toMatch(/ORDER BY updated_at DESC/);
  });

  it('is fail-soft — DB error returns [], does NOT throw', async () => {
    const pool = makePool(async () => {
      throw new Error('pg down');
    });
    const got = await listActiveCheckpoints(pool, { userUid: 'u1' });
    expect(got).toEqual([]);
  });
});

describe('journeyCheckpoints · clearCheckpoint', () => {
  it('DELETEs by (user, domain)', async () => {
    let seenSql = '';
    let seenParams: unknown[] = [];
    const pool = makePool(async (text, params) => {
      seenSql = text;
      seenParams = params;
      return { rowCount: 1, rows: [] };
    });
    await clearCheckpoint(pool, { userUid: 'u1', domain: 'sitter_book' });
    expect(seenSql).toMatch(/DELETE FROM journey_checkpoints/);
    expect(seenSql).toMatch(/WHERE user_uid = \$1 AND domain = \$2/);
    expect(seenParams).toEqual(['u1', 'sitter_book']);
  });

  it('is fail-soft — DB error does NOT throw', async () => {
    const pool = makePool(async () => {
      throw new Error('pg down');
    });
    await expect(
      clearCheckpoint(pool, { userUid: 'u1', domain: 'sitter_book' }),
    ).resolves.not.toThrow();
  });
});

describe('journeyCheckpoints · pruneExpiredCheckpoints', () => {
  it('DELETEs rows with `expires_at <= now()`', async () => {
    let seenSql = '';
    const pool = makePool(async (text) => {
      seenSql = text;
      return { rowCount: 7, rows: [] };
    });
    const n = await pruneExpiredCheckpoints(pool);
    expect(seenSql).toMatch(/DELETE FROM journey_checkpoints/);
    expect(seenSql).toMatch(/WHERE expires_at <= now\(\)/);
    expect(n).toBe(7);
  });

  it('is fail-soft — DB error returns 0, does NOT throw', async () => {
    const pool = makePool(async () => {
      throw new Error('pg down');
    });
    const n = await pruneExpiredCheckpoints(pool);
    expect(n).toBe(0);
  });
});

describe('journeyCheckpoints · migration source pin', () => {
  it('migration 0144 declares the table with UNIQUE (user_uid, domain) and a domain CHECK', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const sql = readFileSync(
      resolve(process.cwd(), 'migrations/0144_journey_checkpoints_2026_09_03.sql'),
      'utf8',
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS journey_checkpoints/);
    expect(sql).toMatch(/UNIQUE INDEX IF NOT EXISTS uq_journey_checkpoints_user_domain/);
    expect(sql).toMatch(/domain IN \(\s*'walk_book',\s*'sitter_book',\s*'marketplace_book',\s*'shop_checkout',\s*'egift',\s*'provider_apply'\s*\)/);
    expect(sql).toMatch(/expires_at\s+TIMESTAMPTZ NOT NULL/);
  });
});
