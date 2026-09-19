import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CEO's rule, 2026-09-19: "use logo black or white not like this box … if white
 * use other logo as rule".
 *
 * #2662 pointed the shared constant at the white wordmark, which is right for
 * the dark headers most PetWash emails have — and WRONG for the five templates
 * whose logo sits on white. Those shipped a white logo on a white background:
 * invisible. Caught while rendering the e-gift sample, before it was sent.
 *
 * The rule, mechanically: a template whose logo sits on a light background must
 * use PETWASH_LOGO_ON_LIGHT; a dark one must use PETWASH_LOGO_ON_DARK. The
 * deprecated PETWASH_LOGO_BASE64 alias resolves to ON_DARK, so it is only safe
 * on a dark surface.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'server', 'email', 'templates');

/** the background immediately above the logo tag, if we can see one */
function backgroundAboveLogo(src: string): string | null {
  const i = src.search(/PETWASH_LOGO_(ON_LIGHT|ON_DARK|BASE64)/);
  if (i < 0) return null;
  const before = src.slice(Math.max(0, i - 700), i);
  const m = [...before.matchAll(/background(?:-color)?:\s*([^;"'`]+)/g)];
  return m.length ? m[m.length - 1][1].trim() : null;
}

const LIGHT = /^(white|#fff|#ffffff|#f[0-9a-f]{2}|#f[0-9a-f]{5}|#e[0-9a-f]{5})/i;

describe('the email logo contrasts with the background it sits on', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'logo-base64.ts');

  it('no template puts a WHITE logo on a light background', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(DIR, f), 'utf8');
      if (!/PETWASH_LOGO_(ON_DARK|BASE64)/.test(src)) continue;
      const bg = backgroundAboveLogo(src);
      if (bg && LIGHT.test(bg)) offenders.push(`${f} (logo on ${bg})`);
    }
    expect(offenders, `white logo on a light background — invisible:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the five known light templates use the dark wordmark', () => {
    for (const f of [
      'egift-activation-2026.ts',
      'egift-purchase-confirmation-2026.ts',
      'welcome-customer-signup-2026.ts',
      'welcome-franchise-application-2026.ts',
      'welcome-provider-signup-2026.ts',
    ]) {
      const src = fs.readFileSync(path.join(DIR, f), 'utf8');
      expect(src, f).toContain('PETWASH_LOGO_ON_LIGHT');
      expect(src, f).not.toContain('PETWASH_LOGO_BASE64');
    }
  });
});
