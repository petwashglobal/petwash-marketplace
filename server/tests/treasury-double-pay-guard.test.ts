/**
 * Treasury double-pay guard — regression pin.
 *
 * Security cross-exam 2026-07-05 finding #1 (HIGH): POST /api/treasury/batches
 * could put the SAME station settlement into two payout batches, disbursing a
 * station's money twice. There was no uniqueness on payout_batch_items.
 * settlement_id and no "already batched" check.
 *
 * Three guarantees pinned here (source-level, no DB needed):
 *   1. Migration 0089 adds a UNIQUE index on payout_batch_items(settlement_id).
 *   2. The create-batch SELECT excludes settlements already in a batch item.
 *   3. The item INSERT is ON CONFLICT (settlement_id) DO NOTHING.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const TREASURY_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'treasury.ts'),
  'utf8',
);
const MIGRATION = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'migrations', '0089_payout_batch_items_settlement_unique.sql'),
  'utf8',
);

describe('treasury double-pay guard — cross-exam #1', () => {
  it('migration 0089 creates a UNIQUE index on payout_batch_items(settlement_id)', () => {
    expect(MIGRATION).toMatch(/CREATE UNIQUE INDEX[\s\S]*payout_batch_items[\s\S]*\(settlement_id\)/i);
  });

  it('migration 0089 dedupes existing rows before enforcing uniqueness (cannot fail on prod data)', () => {
    expect(MIGRATION).toMatch(/DELETE FROM payout_batch_items/i);
    expect(MIGRATION).toMatch(/a\.id > b\.id/);
  });

  it('create-batch SELECT excludes settlements already in a payout batch item', () => {
    expect(TREASURY_SRC).toMatch(/id NOT IN \(SELECT settlement_id FROM payout_batch_items\)/);
  });

  it('rejects with 409 when a requested settlement is already batched', () => {
    expect(TREASURY_SRC).toMatch(/alreadyBatched/);
    expect(TREASURY_SRC).toMatch(/status\(409\)/);
  });

  it('item INSERT is ON CONFLICT (settlement_id) DO NOTHING (last-line-of-defense)', () => {
    expect(TREASURY_SRC).toMatch(/INSERT INTO payout_batch_items[\s\S]*ON CONFLICT \(settlement_id\) DO NOTHING/);
  });
});
