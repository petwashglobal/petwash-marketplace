import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Live findings 2026-09-12 (CEO home button sweep, support@ test account):
 *  1. home → "הוסיפו את החיה הראשונה שלכם" → /pets crashed with
 *     "R.map is not a function": four pages share the react-query key
 *     '/api/pets' but cache different shapes (object vs array).
 *  2. The membership-card QR is a 45-second token refreshed every 110 s —
 *     expired on screen most of the time.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', '..', p), 'utf8');
const PETS = R('client/src/pages/Pets.tsx');
const HOME = R('client/src/pages/PrestigeHome.tsx');
const PP = R('server/routes/prestige-pass.ts');

describe('/pets tolerates whatever shape the shared /api/pets cache holds', () => {
  it('renders from petList, which accepts both an array and { pets: [...] }', () => {
    expect(PETS).toMatch(/const petList: Pet\[\] = Array\.isArray\(pets\)/);
    expect(PETS).toContain('petList.map((pet, index)');
    expect(PETS).toContain('petList.length === 0');
    expect(PETS).not.toMatch(/\bpets\.map\(/);
    expect(PETS).not.toMatch(/\bpets\.length === 0/);
  });
});

describe('the live membership QR is refreshed inside its TTL', () => {
  it('server TTL is 45 s and the home refreshes every 40 s (was 110 s)', () => {
    expect(PP).toContain('const QR_TTL_SECONDS = 45;');
    const block = HOME.slice(HOME.indexOf("queryKey: ['/api/prestige-pass/token/generate']"));
    const opts = block.slice(0, block.indexOf('refetchIntervalInBackground') + 60);
    expect(opts).toContain('refetchInterval: 40_000');
    expect(opts).toContain('staleTime: 0');
    expect(opts).not.toContain('110_000');
  });
});
