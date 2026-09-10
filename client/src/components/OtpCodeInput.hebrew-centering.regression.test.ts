/**
 * OTP digits must sit in the middle of their boxes in Hebrew mode.
 *
 * iPhone, 2026-09-10: every digit hugged the LEFT edge of its box. Tailwind's
 * `text-center` (0,1,0) loses to index.css `html[lang="he"] * { text-align:
 * inherit }` (0,1,1); the input inherits `start`, and inside the dir="ltr"
 * row that is the left edge. An inline style outranks the rule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, 'OtpCodeInput.tsx'), 'utf8');

describe('OtpCodeInput — Hebrew centering', () => {
  it('centres each digit with an inline style, not a Tailwind class alone', () => {
    const input = SRC.slice(SRC.indexOf('<input'), SRC.indexOf('/>', SRC.indexOf('<input')));
    expect(input).toContain("style={{ textAlign: 'center' }}");
    expect(input).toContain('inputMode="numeric"');
  });
  it('the digit row stays LTR so box order equals code order', () => {
    expect(SRC).toMatch(/<div className="[^"]*justify-center[^"]*" dir="ltr">/);
  });
});
