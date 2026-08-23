/**
 * StationPage navigation — Google Maps + Apple Maps only, NO Waze.
 *
 * 2026-07-09: original pin required Waze + Google + Apple.
 * 2026-08-23 (CEO): Waze support removed — "kill the waze, it's need new pet
 * wash waze, not good mislead people". Test inverted to REJECT any waze.com
 * URL emitted from the canonical NavigationButton (Google + Apple only).
 * Reinstate once a verified PetWash Waze Places listing exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'pages', 'StationPage.tsx'), 'utf8');
const NAV = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'NavigationButton.tsx'), 'utf8');

describe('StationPage navigation — Google + Apple only (2026-08-23 Waze-kill)', () => {
  it('renders the canonical NavigationButton with the station coords', () => {
    expect(SRC).toMatch(/import \{ NavigationButton \} from '@\/components\/NavigationButton'/);
    expect(SRC).toMatch(/<NavigationButton[\s\S]*?latitude=\{lat\}[\s\S]*?longitude=\{lng\}/);
  });

  it('no longer uses the old inline Google/Waze window.open buttons', () => {
    expect(SRC).not.toMatch(/window\.open\(`https:\/\/www\.google\.com\/maps\/search/);
    expect(SRC).not.toMatch(/window\.open\(`https:\/\/waze\.com\/ul/);
  });

  it('the shared NavigationButton emits Google + Apple links but NEVER a waze.com URL', () => {
    // WAZE-KILL guard: any live `waze.com/ul?...` construction in the
    // shared component means Waze crept back in. Only allow the substring
    // to appear inside a comment block (WAZE-KILL header explanation).
    const withoutComments = NAV
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/waze\.com\/ul/);
    expect(NAV.toLowerCase()).toMatch(/google\.com\/maps/);
    expect(NAV.toLowerCase()).toMatch(/maps\.apple\.com|maps:\/\//);
  });
});
