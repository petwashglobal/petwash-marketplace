import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'AddPetPassport.tsx'), 'utf8');

// Regression pin for audit finding #8 (2026-08-18): the species grid on the
// pet-passport add flow was missing hamster and reptile. Owners of those
// pets could not add them from the passport flow, so their entries silently
// fell back to the wrong species tile.

describe('AddPetPassport.tsx species tiles (agent finding #8)', () => {
  const REQUIRED_API_SPECIES = ['dog', 'cat', 'fish', 'bird', 'reptile', 'rabbit', 'guinea_pig', 'hamster', 'other'];

  it('grid covers every canonical pet-passport species', () => {
    for (const s of REQUIRED_API_SPECIES) {
      expect(SRC).toMatch(new RegExp(`api:\\s*'${s}',`));
    }
  });

  it('adds explicit reptile tile alongside snake (snake still maps to reptile)', () => {
    expect(SRC).toMatch(/key:\s*'snake',\s*api:\s*'reptile'/);
    expect(SRC).toMatch(/key:\s*'reptile',\s*api:\s*'reptile'/);
  });

  it('adds hamster tile with matching API species', () => {
    expect(SRC).toMatch(/key:\s*'hamster',\s*api:\s*'hamster'/);
  });
});
