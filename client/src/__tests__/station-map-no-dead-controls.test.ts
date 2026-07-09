/**
 * StationMap dead-control removal — regression pin (2026-07-09).
 *
 * The /map page rendered a search Input + "Use My Location" + "Filters" buttons
 * that looked fully enabled but had ZERO handlers — a dead-click on a page a
 * customer visits to find a wash station. Live search needs the interactive map
 * (still "coming soon"), so the fake controls were removed (consistent with the
 * fake-stats removal already in this file). The honest next-step — the working
 * "View Station List" button — remains.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'pages', 'StationMap.tsx'), 'utf8');

describe('StationMap has no dead controls (2026-07-09)', () => {
  it('the handler-less search input is gone', () => {
    expect(SRC).not.toMatch(/data-testid="input-search-location"/);
  });

  it('the handler-less "Use My Location" and "Filters" buttons are gone', () => {
    expect(SRC).not.toMatch(/data-testid="button-current-location"/);
    expect(SRC).not.toMatch(/data-testid="button-filters"/);
  });

  it('the working "View Station List" next-step remains', () => {
    expect(SRC).toMatch(/data-testid="button-view-list"/);
    expect(SRC).toMatch(/setLocation\("\/locations"\)/);
  });
});
