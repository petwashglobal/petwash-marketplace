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
    expect(signup).toContain('body[data-pw-page="signup"]');
    expect(signup).toContain('padding-top:0 !important');
  });

  it('keeps /signup black even though the main app shell defaults to white', () => {
    expect(css).toContain('SIGNUP EXCEPTION');
    expect(css).toContain('body[data-pw-page="signup"]');
    expect(css).toContain('#petwash-signup-page.sl-shell');
    expect(css).toMatch(/background(?:-color)?:\s*#000000\s*!important/);
  });

  it('bumps the cache purge version when signup shell rendering changes', () => {
    expect(main).toContain('2026-06-04-signup-clean-auth-surface');
    expect(html).toContain('2026-06-04-inline-signup-clean-auth-surface');
  });

  it('keeps the mobile hero hierarchy locked to logo first, headline second', () => {
    expect(signup).toContain('--gold:#b0841c');
    expect(signup).toContain('petwash-logo-white-tight.png');
    expect(signup).toContain('.sl-frame{ gap:10px; padding:max(6px, env(safe-area-inset-top))');
    expect(signup).toContain('.sl-logo{ width:min(86vw, 382px)');
    expect(signup).toContain('.sl-h1{ font-size:clamp(23px,6vw,28px)');
    expect(signup).toContain('.sl-card,.sl-trustCard,.sl-secBadge{ display:none }');
    expect(signup).toContain('.sl-divPaw{ display:none }');
    expect(signup).toContain('.sl-dog{ width:min(42vw, 162px)');
    expect(signup).toContain('@media(max-width:380px)');
    expect(signup).toContain('.sl-dogWrap{ display:none }');
    expect(signup).toContain('grid-template-columns:minmax(360px,.9fr) minmax(360px,1.1fr)');
    expect(signup).toContain('.sl-logo{ width:min(48vw, 420px); min-width:360px');
    expect(signup).toContain('@media(max-height:500px) and (orientation:landscape)');
    expect(signup).toContain('grid-template-columns:minmax(240px,.74fr) minmax(320px,1.26fr)');
    expect(signup).toContain('.sl-logo{ width:min(42vw, 280px); min-width:0; max-width:100% }');
    expect(signup).not.toContain('.sl-heroCta');
    expect(signup).not.toContain('<YahooIcon />');
    expect(signup).not.toMatch(/#d8ad55|#f4d48a|rgba\(244,212,138/);
  });

  it('keeps phone signup controls honest, dark, and narrow before account verification', () => {
    expect(signup).toContain('sl-terms--quick');
    expect(signup).toContain('if (!requireTerms()) return;');
    expect(signup).toContain('sl-inlineError');
    expect(signup).toContain('role="alert"');
    expect(signup).toContain('const readyForSubmit = terms && !busy');
    expect(signup).toContain('disabled={!readyForSubmit}');
    expect(signup).toContain('sl-submitHint');
    expect(signup).not.toContain('sl-entryBtn');
    expect(signup).not.toContain('entryBtn');
    expect(signup).not.toContain('EntryCodeField');
    expect(signup).not.toContain('sl-entryStatus');
    expect(signup).not.toContain('sl-adv');
    expect(signup).not.toContain('sl-consent');
    expect(signup).not.toContain('sl-wallets');
    expect(signup).not.toContain('sl-wbtn');
    expect(signup).not.toContain('sl-soonPill');
    expect(signup).not.toContain('Mobile Wallet Consent');
    expect(signup).not.toContain('Face ID / Biometric Consent');
    expect(signup).not.toContain('Save Password to My Device');
    expect(signup).not.toContain('Remember Me for 30 Days');
    expect(signup).not.toContain('Add to Apple Wallet');
    expect(signup).not.toContain('Next-Time Entry');
    expect(signup).toContain('background:rgba(0,0,0,.55) !important');
    expect(signup).toContain('.PhoneInputInput{');
    expect(signup).toContain('color:var(--white) !important');
  });
});
