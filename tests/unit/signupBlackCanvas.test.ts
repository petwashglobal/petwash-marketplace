import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('signup black luxury canvas', () => {
  const signup = read('client/src/pages/SignUpLuxury.tsx');
  const css = read('client/src/index.css');
  const main = read('client/src/main.tsx');
  const html = read('client/index.html');

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
    expect(main).toContain('2026-06-02-signup-logo-hierarchy-hotfix');
    expect(html).toContain('2026-06-02-inline-signup-logo-hierarchy-purge');
  });

  it('keeps the mobile hero hierarchy locked to logo first, headline second', () => {
    expect(signup).toContain('--gold:#b0841c');
    expect(signup).toContain('.sl-logo{ width:clamp(300px,82vw,430px)');
    expect(signup).toContain('.sl-h1{ font-size:clamp(28px,7.1vw,34px)');
    expect(signup).toContain('.sl-logo{ width:clamp(360px,58vw,520px)');
    expect(signup).toContain('.sl-heroCta{ display:flex }');
    expect(signup).not.toMatch(/#d8ad55|#f4d48a|rgba\(244,212,138/);
  });
});
