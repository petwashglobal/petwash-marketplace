/**
 * SendGrid key validator false-positive — regression pin (2026-07-09).
 *
 * The startup config validator (server/index.ts) checked SENDGRID_API_KEY with
 *     /^SG\.[A-Za-z0-9_-]{20,}$/
 * but a real SendGrid key is SG.<id>.<secret> — it has a SECOND dot separating
 * the two parts. The character class excluded '.', so the rule false-flagged
 * EVERY valid key as "🚨 FATAL … unexpected format" at every boot (harmless —
 * email kept working — but alarming noise that looked like an outage cause).
 * Fixed to /^SG\.[\w.-]{20,}$/, which permits the separator dot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const INDEX = fs.readFileSync(path.resolve(__dirname, '..', 'index.ts'), 'utf8');

// A fabricated key with the canonical SG.<id>.<secret> shape — NOT a real key.
const CANONICAL_SHAPE = 'SG.' + 'a'.repeat(22) + '.' + 'b'.repeat(43);
const FIXED = /^SG\.[\w.-]{20,}$/;
const OLD_BUGGY = /^SG\.[A-Za-z0-9_-]{20,}$/;

describe('SendGrid key validator accepts the real SG.<id>.<secret> format (2026-07-09)', () => {
  it('the fixed regex accepts a canonical two-dot SendGrid key', () => {
    expect(FIXED.test(CANONICAL_SHAPE)).toBe(true);
  });

  it('the OLD regex would have wrongly rejected it (the bug being fixed)', () => {
    expect(OLD_BUGGY.test(CANONICAL_SHAPE)).toBe(false);
  });

  it('the fixed regex still rejects an obviously-wrong value', () => {
    expect(FIXED.test('not-a-sendgrid-key')).toBe(false);
    expect(FIXED.test('SG.short')).toBe(false);
  });

  it('server/index.ts uses the fixed pattern, not the buggy one', () => {
    expect(INDEX).toMatch(/key: 'SENDGRID_API_KEY',\s*\n\s*pattern: \/\^SG\\\.\[\\w\.-\]\{20,\}\$\//);
    expect(INDEX).not.toMatch(/pattern: \/\^SG\\\.\[A-Za-z0-9_-\]\{20,\}\$\//);
  });
});
