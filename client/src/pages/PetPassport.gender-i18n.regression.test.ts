import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'PetPassport.tsx'), 'utf8');

describe('PetPassport.tsx gender i18n (agent finding #1)', () => {
  it('English side renders human labels, not the raw enum', () => {
    // Before the fix, the tr() first argument was pet.gender (the raw enum
    // 'male'|'female'|'unknown'), which shipped the raw enum value to the
    // English UI instead of "Male"/"Female"/"Unknown".
    expect(SRC).toMatch(/pet\.gender === 'male' \? 'Male' : pet\.gender === 'female' \? 'Female' : 'Unknown'/);
  });

  it('Hebrew side keeps its crafted labels', () => {
    expect(SRC).toMatch(/pet\.gender === 'male' \? 'זכר' : pet\.gender === 'female' \? 'נקבה' : 'לא ידוע'/);
  });

  it('does not reintroduce the raw pet.gender leak on the English side', () => {
    const stripped = SRC.replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/tr\(pet\.gender,/);
  });
});
