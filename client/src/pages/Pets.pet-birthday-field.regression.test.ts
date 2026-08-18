import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'Pets.tsx'), 'utf8');

describe('Pets.tsx birthday/birthdate field bridge (agent finding #4)', () => {
  it('Pet interface accepts both canonical `birthday` and legacy `birthdate`', () => {
    expect(SRC).toMatch(/birthday\?:\s*string;/);
    expect(SRC).toMatch(/birthdate\?:\s*string;/);
  });

  it('handleEditPet hydrates form.birthdate from either field', () => {
    expect(SRC).toMatch(/birthdate:\s*pet\.birthday\s*\?\?\s*pet\.birthdate\s*\?\?\s*''/);
  });

  it('render uses birthday-first fallback so new-flow pets show age', () => {
    expect(SRC).toMatch(/getAge\(pet\.birthday\s*\?\?\s*pet\.birthdate\s*\?\?\s*''\)/);
  });

  it('does not reintroduce the raw pet.birthdate read that returned empty for new pets', () => {
    const stripped = SRC.replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/getAge\(pet\.birthdate\)/);
  });
});
