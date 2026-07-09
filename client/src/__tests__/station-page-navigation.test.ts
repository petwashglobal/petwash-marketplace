/**
 * StationPage navigation → Waze / Google / Apple Maps — regression pin (2026-07-09).
 *
 * CEO: add Waze + Google Maps + Apple Maps navigation to the location section so a
 * customer can open the station in their preferred maps app. StationPage already
 * had two inline buttons (Google + Waze) but NO Apple Maps and no device
 * detection. Swapped them for the canonical NavigationButton (Waze + Google +
 * Apple Maps + per-platform detection + brand styling), fed the station's real
 * coords/address.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'pages', 'StationPage.tsx'), 'utf8');
const NAV = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'NavigationButton.tsx'), 'utf8');

describe('StationPage offers Waze / Google / Apple navigation (2026-07-09)', () => {
  it('renders the canonical NavigationButton with the station coords', () => {
    expect(SRC).toMatch(/import \{ NavigationButton \} from '@\/components\/NavigationButton'/);
    expect(SRC).toMatch(/<NavigationButton[\s\S]*?latitude=\{lat\}[\s\S]*?longitude=\{lng\}/);
  });

  it('no longer uses the old inline Google/Waze window.open buttons', () => {
    expect(SRC).not.toMatch(/window\.open\(`https:\/\/www\.google\.com\/maps\/search/);
    expect(SRC).not.toMatch(/window\.open\(`https:\/\/waze\.com\/ul/);
  });

  it('the shared NavigationButton actually supports all three maps apps', () => {
    expect(NAV).toMatch(/waze\.com\/ul/);
    expect(NAV.toLowerCase()).toMatch(/google\.com\/maps/);
    expect(NAV.toLowerCase()).toMatch(/maps\.apple\.com|maps:\/\//);
  });
});
