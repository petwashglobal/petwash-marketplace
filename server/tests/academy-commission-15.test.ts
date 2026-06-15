/**
 * Academy (pet training) commission must be the uniform 15%.
 *
 * academy.ts priced platformFee from a PER-TRAINER `trainer.commissionRate`,
 * which could diverge from 15% and produced NaN when a trainer had no rate set
 * (parseFloat(undefined)/100 = NaN). CEO-confirmed: 15% on every paid service.
 *
 * Fix: use the shared PETWASH_COMMISSION_RATE constant (same as PetSitter/Walk).
 * Source-introspection guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SERVER = path.resolve(__dirname, '..');
const academySrc = fs.readFileSync(path.join(SERVER, 'routes', 'academy.ts'), 'utf8');
// Read the canonical constant's value straight from the schema source text
// (avoid importing @shared/schema — it pulls in the DB and won't load in tests).
const schemaSrc = fs.readFileSync(path.resolve(SERVER, '..', 'shared', 'schema.ts'), 'utf8');

describe('academy commission — uniform 15%', () => {
  it('the canonical PETWASH_COMMISSION_RATE constant is 0.15', () => {
    expect(schemaSrc).toMatch(/export const PETWASH_COMMISSION_RATE = 0\.15/);
  });

  it('prices platformFee from PETWASH_COMMISSION_RATE, not the per-trainer rate', () => {
    expect(academySrc).toMatch(/const platformFee = totalAmount \* PETWASH_COMMISSION_RATE/);
    expect(academySrc).not.toMatch(/platformFee = totalAmount \* \(parseFloat\(trainer\.commissionRate\)/);
  });

  it('imports the shared constant', () => {
    expect(academySrc).toMatch(/PETWASH_COMMISSION_RATE,?\s*\n?.*from '@shared\/schema'|PETWASH_COMMISSION_RATE/);
  });
});
