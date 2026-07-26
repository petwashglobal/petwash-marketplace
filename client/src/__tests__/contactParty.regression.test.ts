/**
 * Regression pin — unified contact control (2026-07-26).
 *
 * One consistent Call/Text/Email control replaces the scattered per-page tel:
 * links, adds the missing Text (SMS) channel, and kills the dead "Message"
 * no-op button on WalkTracking. Hides any channel with no value.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const comp = read('components/ContactParty.tsx');
const pos = read('pages/provider-os/POSJobs.tsx');
const walk = read('pages/WalkTracking.tsx');

describe('ContactParty', () => {
  it('offers call, text and email channels', () => {
    expect(comp).toMatch(/href=\{`tel:\$\{tel\}`\}/);
    expect(comp).toMatch(/sms:/);
    expect(comp).toMatch(/href=\{`mailto:\$\{email\}`\}/);
  });
  it('hides when there is neither phone nor email (no dead links)', () => {
    expect(comp).toMatch(/if \(!hasPhone && !hasEmail\) return null/);
  });
  it('sanitizes the phone for the tel/sms href', () => {
    expect(comp).toMatch(/cleanPhone/);
  });
  it('provider job view uses it to contact the client', () => {
    expect(pos).toMatch(/<ContactParty[\s\S]{0,120}who="client"/);
  });
  it('walk tracking uses it (the dead Message button is gone)', () => {
    expect(walk).toMatch(/<ContactParty/);
    expect(walk).not.toMatch(/luxury-btn-secondary[\s\S]{0,60}Message/);
  });
});
