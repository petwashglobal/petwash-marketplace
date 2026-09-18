/**
 * CEO 2026-08-28 §12 — the "person about to hold the leash" invariant.
 *
 * The KYA-scoped pet safety flags (aggression / escape risk / allergies /
 * medications / vet contact / feeding & handling notes) live on the pet
 * record. When the owner books a walk or a sitter, the client builds a
 * `petSafetySnapshot` blob and sends it in the POST payload — see
 *   client/src/pages/walk-my-pet/BookingFlow.tsx (petSafetySnapshot = …)
 *   client/src/pages/sitter-suite/BookingFlow.tsx (petSafetySnapshot = …)
 *
 * Until this commit both server routes destructured only the primary
 * fields and silently dropped `petSafetySnapshot`. Providers saw an
 * empty specialInstructions field on their Today card and only found
 * out about the biter after grabbing the leash.
 *
 * This test pins the wire: the routes MUST read the field off req.body
 * AND persist it into the corresponding booking row. Rename or drop
 * either half and CI fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const R = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', 'routes', rel), 'utf8');
const S = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', '..', 'shared', rel), 'utf8');

describe('booking routes accept + persist petSafetySnapshot (CEO §12)', () => {
  describe('walk-my-pet /walks/book', () => {
    const src = R('walk-my-pet.ts');
    // 2026-09-18: these demanded the raw body value be destructured as
    // `petSafetySnapshot` and then type-coerced. The route was hardened past
    // that: the client's value is bound to clientSafetySnapshot — named so
    // nobody mistakes it for authority — and the snapshot that gets STORED is
    // built by the server from the owner's actual pet row
    // (buildServerSafetySnapshot), with a non-medical projection as the only
    // fallback for a cross-user or unknown petId. The pins were asserting the
    // weaker "trust the client, just check its type" shape.
    it('the client value is bound as clientSafetySnapshot — never treated as authority', () => {
      expect(src).toMatch(/petSafetySnapshot:\s*clientSafetySnapshot/);
      expect(src).not.toMatch(/petSafetySnapshot:\s*petSafetySnapshot/);
    });
    it('what gets stored is built by the SERVER from the pet row', () => {
      expect(src).toMatch(/buildServerSafetySnapshot\(/);
      // The fallback for a cross-user / unknown petId is non-medical only.
      expect(src).toMatch(/safeSnapshot = \{/);
      expect(src).toMatch(/aggressionWarning:\s*typeof c\.aggressionWarning === 'string'/);
      // No medical field may be copied straight off the client's object.
      const proj = src.slice(src.indexOf('safeSnapshot = {'), src.indexOf('safeSnapshot = {') + 900);
      for (const medical of ['allergies', 'medications', 'vetContact', 'vetPhone']) {
        expect(proj).not.toContain(`c.${medical}`);
      }
    });
    it('writes the snapshot into the walk_bookings insert', () => {
      expect(src).toMatch(/petSafetySnapshot:\s*safeSnapshot/);
    });
    it('the persistence lives BEFORE the transaction insert (not on a fallthrough branch)', () => {
      // Anchor on the renamed binding — `petSafetySnapshot,` no longer exists.
      const idxDestructure = src.indexOf('petSafetySnapshot: clientSafetySnapshot');
      const idxWrite = src.indexOf('petSafetySnapshot: safeSnapshot');
      const idxInsert = src.indexOf('tx.insert(walkBookings)');
      expect(idxDestructure).toBeGreaterThan(0);
      expect(idxWrite).toBeGreaterThan(idxDestructure);
      // Insert runs via db.transaction; the write must be inside the values() call
      // just above the transaction runs. Prove ordering.
      expect(idxWrite).toBeLessThan(idxInsert === -1 ? Number.MAX_SAFE_INTEGER : idxInsert);
    });
  });

  describe('sitter-suite /bookings', () => {
    const src = R('sitter-suite.ts');
    it('the client value is bound as clientSafetySnapshot — never treated as authority', () => {
      expect(src).toMatch(/petSafetySnapshot:\s*clientSafetySnapshot/);
    });
    it('what gets stored is built by the SERVER from the canonical pet', () => {
      expect(src).toMatch(/buildServerSafetySnapshot\(canonicalPet, clientSafetySnapshot/);
      // No canonical pet resolved → store nothing rather than the client's word.
      expect(src).toMatch(/safeSnapshot = null/);
    });
    it('writes the snapshot into the sitter_bookings insert', () => {
      expect(src).toMatch(/petSafetySnapshot:\s*safeSnapshot/);
    });
  });

  describe('schema — both tables carry the column', () => {
    const schema = S('schema.ts');
    it('walk_bookings has pet_safety_snapshot jsonb', () => {
      // Anchor to the walkBookings table specifically.
      const start = schema.indexOf('export const walkBookings = pgTable("walk_bookings"');
      const end = schema.indexOf('export const', start + 10);
      expect(start).toBeGreaterThan(0);
      const block = schema.slice(start, end);
      expect(block).toMatch(/petSafetySnapshot:\s*jsonb\("pet_safety_snapshot"\)/);
    });
    it('sitter_bookings has pet_safety_snapshot jsonb', () => {
      const start = schema.indexOf('export const sitterBookings = pgTable("sitter_bookings"');
      const end = schema.indexOf('export const', start + 10);
      expect(start).toBeGreaterThan(0);
      const block = schema.slice(start, end);
      expect(block).toMatch(/petSafetySnapshot:\s*jsonb\("pet_safety_snapshot"\)/);
    });
  });

  describe('migration — additive column on both tables', () => {
    it('migration 0132 adds pet_safety_snapshot to both booking tables', () => {
      const migPath = path.resolve(
        __dirname, '..', '..', 'migrations',
        '0132_booking_pet_safety_snapshot_2026_08_28.sql',
      );
      const sql = fs.readFileSync(migPath, 'utf8');
      expect(sql).toMatch(/ALTER TABLE walk_bookings\s*\n\s*ADD COLUMN IF NOT EXISTS pet_safety_snapshot jsonb/);
      expect(sql).toMatch(/ALTER TABLE sitter_bookings\s*\n\s*ADD COLUMN IF NOT EXISTS pet_safety_snapshot jsonb/);
    });
  });
});
