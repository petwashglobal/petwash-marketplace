/**
 * ProviderHome — luxury provider home, same visual language as the customer home
 * but PROVIDER-SCOPED. Source-introspection guards lock in the scope rule
 * (provider = zero wash) + brand so they can't silently regress.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(ROOT, 'pages', 'ProviderHome.tsx'), 'utf8');

describe('ProviderHome (provider luxury home)', () => {
  it('is provider-scoped — NO wash/credits/Prestige/Send-a-Gift', () => {
    expect(home).not.toMatch(/Wash Credits|washCredits|Book Wash|Prestige Points|Send a Gift|Buy Package/i);
  });

  it('shows the three provider platforms + PetTrek coming-soon, no wash platform', () => {
    expect(home).toMatch(/PetSitter/);
    expect(home).toMatch(/Walk My Pet/);
    expect(home).toMatch(/Academy/);
    expect(home).toMatch(/PetTrek/);
    expect(home).toMatch(/soon: true/);
  });

  it('uses bright gold + real logo + ₪ (and drops wash from upcoming jobs)', () => {
    expect(home).toMatch(/#D4AF37/);
    // Inline <img src="/brand/petwash-logo-official.png"> was replaced by
    // the shared <PetWashLogo> component (renders the same real asset —
    // see client/src/components/brand/PetWashLogo.tsx).
    expect(home).toMatch(/PetWashLogo/);
    expect(home).toMatch(/₪/);
    expect(home).toMatch(/includes\('wash'\)/); // filters wash out of upcoming
  });

  it('reads live provider endpoints (no fake numbers)', () => {
    expect(home).toMatch(/\/api\/provider-profile\/me/);
    expect(home).toMatch(/\/api\/provider-dashboard\/v2\/stats/);
    expect(home).toMatch(/\/api\/provider-dashboard\/v2\/earnings/);
    expect(home).toMatch(/\/api\/provider-dashboard\/v2\/upcoming/);
  });

  it('availability toggle posts to the real endpoint', () => {
    expect(home).toMatch(/\/api\/provider-dashboard\/availability/);
  });

  it('every nav target is a concrete route (no dead taps)', () => {
    for (const r of ['/provider-os?m=jobs', '/provider/earnings', '/provider/tasks', '/provider-compliance', '/notifications', '/inbox']) {
      expect(home).toContain(r);
    }
  });
});
