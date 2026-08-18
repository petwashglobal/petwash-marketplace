import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'PetPassportHome.tsx'), 'utf8');

// Updated 2026-08-18 COMPETITIVE (WhatIDog gap): Vaccines / Reminders / Vet
// now navigate to /pets where the per-pet PetHealthPanel already implements
// nextVaccineDate + enableVaccineReminders + /api/pets/:id/health-events.
// Insurance and Clinics stay on the honest coming-soon toast until we ship
// those surfaces.
describe('PetPassportHome.tsx CTA wiring', () => {
  it('Vaccines tile navigates to /pets (real PetHealthPanel is there)', () => {
    expect(SRC).toMatch(/label=\{tr\('חיסונים', 'Vaccines'\)\}\s*onClick=\{\(\) => navigate\(['"]\/pets['"]\)\}/);
  });

  it('Reminders quick-action navigates to /pets (real reminder engine is there)', () => {
    expect(SRC).toMatch(/label=\{tr\('תזכורות', 'Reminders'\)\}\s*onClick=\{\(\) => navigate\(['"]\/pets['"]\)\}/);
  });

  it('Vet quick-action navigates to /pets (real vet-visit events are there)', () => {
    expect(SRC).toMatch(/label=\{tr\('וטרינר', 'Vet'\)\}\s*onClick=\{\(\) => navigate\(['"]\/pets['"]\)\}/);
  });

  it('Insurance tile stays on honest coming-soon toast', () => {
    expect(SRC).toMatch(/label=\{tr\('ביטוחים', 'Insurance'\)\}\s*onClick=\{\(\) => notReady\('ביטוחים', 'Insurance'\)\}/);
  });

  it('Clinics quick-action stays on honest coming-soon toast', () => {
    expect(SRC).toMatch(/label=\{tr\('בתי חולים', 'Clinics'\)\}\s*onClick=\{\(\) => notReady\('בתי חולים', 'Clinics'\)\}/);
  });

  it('notReady helper still surfaces a bilingual coming-soon toast', () => {
    expect(SRC).toMatch(/description: tr\('בקרוב — עדיין בפיתוח', 'Coming soon — still in development'\)/);
  });
});
