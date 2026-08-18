import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'PetPassportHome.tsx'), 'utf8');

describe('PetPassportHome.tsx dead-CTA honesty (agent findings #2 + #3)', () => {
  it('Vaccines tile no longer bait-and-switches to /pets', () => {
    // Before: onClick={() => navigate('/pets')} on the Vaccines tile
    // After:  onClick={() => notReady('חיסונים', 'Vaccines')}
    expect(SRC).toMatch(/label=\{tr\('חיסונים', 'Vaccines'\)\}\s*onClick=\{\(\) => notReady\('חיסונים', 'Vaccines'\)\}/);
  });

  it('Insurance tile no longer bait-and-switches to /pets', () => {
    expect(SRC).toMatch(/label=\{tr\('ביטוחים', 'Insurance'\)\}\s*onClick=\{\(\) => notReady\('ביטוחים', 'Insurance'\)\}/);
  });

  it('Reminders / Vet / Clinics quick-actions surface a coming-soon toast', () => {
    expect(SRC).toMatch(/label=\{tr\('תזכורות', 'Reminders'\)\}\s*onClick=\{\(\) => notReady\('תזכורות', 'Reminders'\)\}/);
    expect(SRC).toMatch(/label=\{tr\('וטרינר', 'Vet'\)\}\s*onClick=\{\(\) => notReady\('וטרינר', 'Vet'\)\}/);
    expect(SRC).toMatch(/label=\{tr\('בתי חולים', 'Clinics'\)\}\s*onClick=\{\(\) => notReady\('בתי חולים', 'Clinics'\)\}/);
  });

  it('notReady helper surfaces a bilingual coming-soon toast', () => {
    expect(SRC).toMatch(/description: tr\('בקרוב — עדיין בפיתוח', 'Coming soon — still in development'\)/);
  });
});
