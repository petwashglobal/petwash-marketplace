import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Outlook (desktop, Windows) renders mail with the Word engine, which does not
 * support CSS gradients. It does not fall back — it paints NO background at
 * all. Every PetWash header, hero and button built on a gradient therefore
 * rendered as light-or-gold text on white: unreadable, in the client most
 * likely to open a business email.
 *
 * 54 elements across 13 templates carried light text on a gradient surface.
 *
 * The fix is NOT to drop the gradient — modern clients render it fine and it is
 * the brand look. It is to declare a solid colour FIRST, taken from the
 * gradient's own first stop:
 *
 *     background:#0f172a;background:linear-gradient(160deg,#0f172a,…)
 *
 * Outlook keeps the solid and ignores what it cannot parse; every other client
 * applies the later gradient. Nothing is lost and nothing goes invisible.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'server', 'email', 'templates');
const FILES = [
  ...fs.readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'logo-base64.ts')
    .map((f) => path.join(DIR, f)),
  path.join(ROOT, 'server', 'services', 'IsraeliDigitalReceiptService.ts'),
];

describe('every gradient background has a solid fallback for Outlook', () => {
  it('no gradient surface is declared without a preceding solid colour', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/background:\s*(linear-gradient\([^)]*\))/g)) {
        const grad = m[1];
        // a hairline/ornament fading to transparent paints nothing on its own;
        // losing it in Outlook costs a decorative line, not legibility
        if (grad.includes('transparent')) continue;
        const before = src.slice(Math.max(0, m.index! - 40), m.index!);
        // the solid may be a literal hex or an interpolated brand colour
        if (!/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8}|\$\{[^}]+\});\s*$/.test(before)) {
          offenders.push(`${path.basename(file)}: ${grad.slice(0, 60)}`);
        }
      }
    }
    expect(offenders, `gradients that vanish in Outlook:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the scan is actually looking at templates', () => {
    expect(FILES.length).toBeGreaterThan(20);
  });
});
