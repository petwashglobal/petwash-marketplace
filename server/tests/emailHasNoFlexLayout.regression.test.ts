import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Outlook (desktop, Windows) renders mail with the Word engine. It does not
 * support `display:flex` — the container's children fall back to block, so a
 * row that was meant to sit side by side stacks vertically.
 *
 * Six rows across four templates were laid out with flex, including the top
 * row of the e-gift card (brand block beside the ornament) and the Privilege
 * card's "Member Since / ID" footer, which is precisely the kind of row that
 * looks broken when it stacks.
 *
 * All are tables now. A table is the email-safe way to put two things on one
 * line, and it renders identically in every client.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'server', 'email', 'templates');
const FILES = [
  ...fs.readdirSync(DIR).filter((f) => f.endsWith('.ts')).map((f) => path.join(DIR, f)),
  path.join(ROOT, 'server', 'services', 'IsraeliDigitalReceiptService.ts'),
];

describe('email templates lay out with tables, not flex', () => {
  it('no template uses display:flex', () => {
    const offenders = FILES
      .filter((f) => fs.readFileSync(f, 'utf8').includes('display:flex'))
      .map((f) => path.basename(f));
    expect(offenders, `flex rows stack in Outlook: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no template uses display:grid either', () => {
    const offenders = FILES
      .filter((f) => fs.readFileSync(f, 'utf8').includes('display:grid'))
      .map((f) => path.basename(f));
    expect(offenders, `grid is not supported in email: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the scan is looking at real templates', () => {
    expect(FILES.length).toBeGreaterThan(20);
  });
});
