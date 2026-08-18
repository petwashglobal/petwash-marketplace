import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'PrestigePassWallet.tsx'), 'utf8');

describe('PrestigePassWallet.tsx species picker (agent finding #6)', () => {
  const REQUIRED_SPECIES = ['dog', 'cat', 'rabbit', 'bird', 'guinea_pig', 'hamster', 'reptile', 'fish', 'other'];

  it('picker covers every species the pet passport supports', () => {
    for (const s of REQUIRED_SPECIES) {
      expect(SRC).toMatch(new RegExp(`key:\\s*'${s}',`));
    }
  });

  it('bilingual labels are supplied per species (no raw enum leak in UI)', () => {
    // A raw enum leak would render `{t}` (the enum key) as the visible label.
    const stripped = SRC.replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/label=\{t\}\s*\/>\s*\{t\}/);
    expect(SRC).toMatch(/en:\s*'Dog',\s*he:\s*'כלב'/);
    expect(SRC).toMatch(/en:\s*'Guinea pig',\s*he:\s*'שרקן'/);
    expect(SRC).toMatch(/en:\s*'Reptile',\s*he:\s*'זוחל'/);
    expect(SRC).toMatch(/en:\s*'Fish',\s*he:\s*'דג'/);
  });

  it('does not reintroduce the truncated 5-species tuple', () => {
    const stripped = SRC.replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/\['dog','cat','rabbit','bird','other'\]\s*as\s*const/);
  });
});
