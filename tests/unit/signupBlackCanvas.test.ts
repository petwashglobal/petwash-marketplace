import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('signup black luxury canvas', () => {
  const signup = read('client/src/pages/SignUpLuxury.tsx');
  const css = read('client/src/index.css');
  const main = read('client/src/main.tsx');

  it('marks the standalone signup page so global white resets cannot bleed into it', () => {
    expect(signup).toContain('data-pw-page');
    expect(signup).toContain('signup');
    expect(signup).toContain('petwash-signup-page');
  });

  it('keeps /signup black even though the main app shell defaults to white', () => {
    expect(css).toContain('SIGNUP EXCEPTION');
    expect(css).toContain('body[data-pw-page="signup"]');
    expect(css).toContain('#petwash-signup-page.sl-shell');
    expect(css).toMatch(/background(?:-color)?:\s*#000000\s*!important/);
  });

  it('bumps the cache purge version when signup shell rendering changes', () => {
    expect(main).toContain('2026-06-02-signup-black-canvas-hotfix');
  });
});
