/** The busy state says what is happening, not "…" (iPhone screenshot 2026-09-10). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
const SRC = fs.readFileSync(path.resolve(__dirname, 'SignUpLuxury.tsx'), 'utf8');
describe('SignUpLuxury — busy labels', () => {
  it('the SMS button and the Continue CTA name the action while busy', () => {
    // 2026-09-14: text goes through L(hebrew, english) so Arabic and Russian
    // visitors get their language (signupLuxury.i18n.ts). Same labels.
    expect(SRC).toContain("busy ? (L('שולח קוד…', 'Sending code…'))");
    expect(SRC).toContain("busy ? (L('שולח…', 'Sending…'))");
    expect(SRC).not.toMatch(/busy \? '…' : \(L\('(המשך|שלחו לי קוד ב-SMS)'/);
  });
});
