import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CEO, 2026-09-19: "we have two logo black and white againts background".
 *
 * Every email template pointed at petwash-logo-official.png — a 3072x1186,
 * 870KB BLACK wordmark whose matte renders as a WHITE BOX when placed on a
 * dark header, which is what nearly every PetWash email has. Confirmed by
 * rendering the booking confirmation that day: a white rectangle around the
 * wordmark, centred on the black header.
 *
 * The right assets already existed:
 *   petwash-logo-black-bg.png  white wordmark, RGBA, 31KB  -> dark headers
 *   petwash-logo-white-bg.png  black wordmark             -> light sections
 *
 * Separately, the digital receipt drew the brand as TEXT (<h1>PetWash™</h1>)
 * while every other email used the asset. Brand rule: the real logo file,
 * never a redrawn or typed substitute.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATES = path.join(ROOT, 'server', 'email', 'templates');

describe('email logo matches the background it sits on', () => {
  it('both logo variants are published, named for their background', () => {
    const src = fs.readFileSync(path.join(TEMPLATES, 'logo-base64.ts'), 'utf8');
    expect(src).toContain('PETWASH_LOGO_ON_DARK');
    expect(src).toContain('PETWASH_LOGO_ON_LIGHT');
    expect(src).toContain('petwash-logo-black-bg.png');
    expect(src).toContain('petwash-logo-white-bg.png');
  });

  it('no email template still points at the white-box logo', () => {
    const offenders: string[] = [];
    for (const f of fs.readdirSync(TEMPLATES)) {
      if (!f.endsWith('.ts')) continue;
      const src = fs.readFileSync(path.join(TEMPLATES, f), 'utf8');
      // the comment in logo-base64.ts names the old file on purpose
      const code = f === 'logo-base64.ts' ? src.replace(/\/\*[\s\S]*?\*\//g, '') : src;
      if (code.includes('petwash-logo-official')) offenders.push(f);
    }
    expect(offenders, `still using the 870KB white-box logo: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the digital receipt uses the real logo asset, not typed text', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'server', 'services', 'IsraeliDigitalReceiptService.ts'), 'utf8',
    );
    expect(src).toContain('brand/petwash-logo-black-bg.png');
    expect(src).not.toMatch(/<h1[^>]*>⁦?PetWash™?⁩?<\/h1>/);
  });

  it('the dark-header asset is small enough to belong in an email', () => {
    const p = path.join(ROOT, 'client', 'public', 'brand', 'petwash-logo-black-bg.png');
    expect(fs.statSync(p).size).toBeLessThan(120 * 1024);
  });
});
