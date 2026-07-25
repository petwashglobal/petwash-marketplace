/**
 * Regression pin — marketing-legal (2026-07-25): no fabricated social proof.
 *
 * PetWash is early-stage (2 stations; PetTrek not launched). "Join thousands of
 * happy pet owners" / "thousands trust PetTrek" are invented social proof — a
 * BLOCK-class claim under the marketing-legal guardrail. These must stay gone.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('no fabricated social proof in public copy', () => {
  it('HowItWorks does not claim "thousands of happy pet owners"', () => {
    expect(read('components/marketplace/HowItWorks.tsx')).not.toMatch(/thousands of happy pet owners|לאלפי בעלי חיות/);
  });
  it('PlatformHub does not claim "thousands of happy pet owners"', () => {
    expect(read('pages/PlatformHub.tsx')).not.toMatch(/thousands of happy pet owners|לאלפי בעלי חיות/);
  });
  it('PetTrek does not claim "thousands of pet parents trust PetTrek"', () => {
    const i18n = read('lib/i18n.ts');
    const line = i18n.split('\n').find(l => l.includes('pettrek.readyToBookSubtitle')) || '';
    expect(line).not.toMatch(/thousands of pet parents|לאלפי הורים|آلاف|тысячам|milliers|miles de/);
  });
});
