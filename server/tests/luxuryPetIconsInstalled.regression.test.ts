import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CEO, 2026-09-19: "find my luxary emojies use them instead i got all shapes
 * trendy no basic imojies", and then "find luxary might be hidden mages or
 * icons".
 *
 * They were hidden in attached_assets/ as 1024px renders. The whole delivery
 * mechanism already existed and had never been used: client/public/pet-icons/
 * held nothing but its README, so VITE_PET_ICONS_ENABLED stayed off and every
 * surface rendered the registry's fallback emoji.
 *
 * PetIcon falls back per-icon on a 404, so the flag is safe to hold on while
 * the set is completed one file at a time.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const ICONS = path.join(ROOT, 'client', 'public', 'pet-icons');

/** installed so far — each must be a real key in the registry */
const INSTALLED = ['cat', 'snake', 'rabbit', 'horse', 'pony', 'botanical-leaf'];

describe('the luxury pet icons are installed and switched on', () => {
  const registry = fs.readFileSync(
    path.join(ROOT, 'client', 'src', 'lib', 'petIconRegistry.ts'), 'utf8',
  );

  it.each(INSTALLED)('%s.png exists', (key) => {
    expect(fs.existsSync(path.join(ICONS, `${key}.png`))).toBe(true);
  });

  it.each(INSTALLED)('%s is a real registry key, so PetIcon can find it', (key) => {
    // keys are written bare or quoted (botanical-leaf needs quotes)
    expect(registry).toMatch(new RegExp(`['"]?${key}['"]?\\s*:\\s*\\{`));
  });

  it('every icon is small enough to ship — an icon is not a hero image', () => {
    for (const key of INSTALLED) {
      const kb = fs.statSync(path.join(ICONS, `${key}.png`)).size / 1024;
      expect(kb, `${key}.png is ${Math.round(kb)}KB`).toBeLessThan(200);
    }
  });

  it('the production build turns the icons on', () => {
    const ci = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'petwash-ci.yml'), 'utf8');
    expect(ci).toContain("VITE_PET_ICONS_ENABLED: 'true'");
  });

  it('PetIcon still falls back to emoji, so missing keys never break a screen', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'client', 'src', 'components', 'PetIcon.tsx'), 'utf8',
    );
    expect(src).toMatch(/onError/);
    expect(src).toMatch(/PET_ICONS_ENABLED \|\| failed/);
  });
});
