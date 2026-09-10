/** The busy state says what is happening, not "…" (iPhone screenshot 2026-09-10). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
const SRC = fs.readFileSync(path.resolve(__dirname, 'SignUpLuxury.tsx'), 'utf8');
describe('SignUpLuxury — busy labels', () => {
  it('the SMS button and the Continue CTA name the action while busy', () => {
    expect(SRC).toContain("busy ? (he ? 'שולח קוד…' : 'Sending code…')");
    expect(SRC).toContain("busy ? (he ? 'שולח…' : 'Sending…')");
    expect(SRC).not.toMatch(/busy \? '…' : \(he \? '(המשך|שלחו לי קוד ב-SMS)'/);
  });
});
