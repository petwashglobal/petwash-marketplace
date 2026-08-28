/**
 * Pet species canonical enum — cross-file source-pin regression.
 *
 * CEO §22 (2026-08-28) fix: until shared/lib/petSpecies.ts existed
 * four surfaces defined their own species enum and drifted (missing
 * turtle here, missing reptile there, a rogue `snake` tile on one
 * surface). A pet added on one screen could fail Zod on another.
 *
 * Rule: every KYA surface consumes SPECIES_VALUES from this module.
 * A future author adding a species must land it here first. A
 * refactor that opens a parallel list in one of the three surfaces
 * trips this test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { SPECIES_VALUES, SPECIES_LABELS, normalizeLegacySpecies } from '../../shared/lib/petSpecies';

const PETS_TSX     = fs.readFileSync(path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'Pets.tsx'), 'utf8');
const ADD_PET_TSX  = fs.readFileSync(path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'AddPetPassport.tsx'), 'utf8');
const SCHEMA_TS    = fs.readFileSync(path.resolve(__dirname, '..', '..', 'shared', 'firestore-schema.ts'), 'utf8');

describe('shared/lib/petSpecies — canonical enum', () => {
  it('exports the 10 canonical values in a stable order', () => {
    expect(SPECIES_VALUES).toEqual([
      'dog', 'cat', 'bird', 'rabbit', 'guinea_pig', 'hamster',
      'reptile', 'turtle', 'fish', 'other',
    ]);
  });

  it('labels every canonical value with HE + EN + emoji', () => {
    for (const s of SPECIES_VALUES) {
      const label = SPECIES_LABELS[s];
      expect(label).toBeDefined();
      expect(label.he).toBeTruthy();
      expect(label.en).toBeTruthy();
      expect(label.emoji).toBeTruthy();
    }
  });

  it('normalizeLegacySpecies handles case, aliases, and unknowns', () => {
    // Case + whitespace + hyphen
    expect(normalizeLegacySpecies('Dog')).toBe('dog');
    expect(normalizeLegacySpecies(' CAT ')).toBe('cat');
    expect(normalizeLegacySpecies('guinea-pig')).toBe('guinea_pig');
    // Aliases
    expect(normalizeLegacySpecies('snake')).toBe('reptile');
    expect(normalizeLegacySpecies('lizard')).toBe('reptile');
    expect(normalizeLegacySpecies('gecko')).toBe('reptile');
    expect(normalizeLegacySpecies('tortoise')).toBe('turtle');
    expect(normalizeLegacySpecies('canine')).toBe('dog');
    expect(normalizeLegacySpecies('feline')).toBe('cat');
    expect(normalizeLegacySpecies('cavy')).toBe('guinea_pig');
    // Unknown → other so the UI still renders
    expect(normalizeLegacySpecies('velociraptor')).toBe('other');
    expect(normalizeLegacySpecies(undefined)).toBe('other');
    expect(normalizeLegacySpecies('')).toBe('other');
  });
});

describe('Every KYA surface consumes the canonical source', () => {
  it('client/src/pages/Pets.tsx imports SPECIES_VALUES from petSpecies', () => {
    expect(PETS_TSX).toMatch(/from ['"]@shared\/lib\/petSpecies['"]/);
    expect(PETS_TSX).toMatch(/SPECIES_VALUES/);
    // Ban the hand-rolled list this file used to carry.
    expect(PETS_TSX).not.toMatch(/species: z\.enum\(\[['"]dog['"], ?['"]cat['"]/);
  });

  it('client/src/pages/AddPetPassport.tsx imports the canonical source', () => {
    expect(ADD_PET_TSX).toMatch(/from ['"]@shared\/lib\/petSpecies['"]/);
    expect(ADD_PET_TSX).toMatch(/SPECIES_VALUES/);
    // Ban the rogue `snake → reptile` tile mapping that drifted from the
    // canonical enum.
    expect(ADD_PET_TSX).not.toMatch(/key:\s*['"]snake['"]/);
  });

  it("shared/firestore-schema.ts references the canonical enum in its comment", () => {
    // The doc-comment must point new authors at petSpecies.ts so they
    // don't fork the enum again. The values themselves stay inlined for
    // Zod's compile-time literal-tuple checking.
    expect(SCHEMA_TS).toMatch(/shared\/lib\/petSpecies\.ts/);
  });
});
