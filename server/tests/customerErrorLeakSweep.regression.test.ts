/**
 * AGENT-14 privacy lane — regression PIN for the customer-facing routes
 * migrated off raw `error.message` responses.
 *
 * SECONDARY to server/tests/clientSafeErrorMessage.behavior.test.ts (which
 * actually executes the filter). This file only stops the migrated files from
 * silently regressing to `res.json({ error: err.message })`, and enforces the
 * second half of the rule: sanitising the RESPONSE must never delete the
 * server-side LOG. A handler that swallows the error entirely is just as bad
 * as one that leaks it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');

const MIGRATED = [
  'server/routes/unified-vouchers.ts',
  'server/routes/escrow.ts',
  'server/routes/user-addresses.ts',
  'server/routes/marketplace-bookings.ts',
  'server/routes/shop.ts',
  'server/routes/pricing.ts',
  'server/routes/compliance.ts',
  'server/routes/provider-search.ts',
];

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

/** Lines that send a response (res.json / res.status(...).json / return res...). */
function responseLines(src: string): Array<{ n: number; text: string }> {
  return src
    .split(/\r?\n/)
    .map((text, i) => ({ n: i + 1, text }))
    .filter(({ text }) => /\bres\s*\.\s*(status\([^)]*\)\s*\.)?json\s*\(/.test(text));
}

describe('AGENT-14 · customer-facing routes never echo raw error text', () => {
  for (const rel of MIGRATED) {
    it(`${rel} — no response body renders err.message / error.message / .stack`, () => {
      const offenders = responseLines(read(rel)).filter(({ text }) =>
        /:\s*(err|error|e|walletError|multerErr)\s*(\?\.)?\.(message|stack)\b/.test(text),
      );
      expect(offenders.map((o) => `${rel}:${o.n} ${o.text.trim()}`)).toEqual([]);
    });

    it(`${rel} — no response body renders a stack at all`, () => {
      const offenders = responseLines(read(rel)).filter(({ text }) => /\.stack\b/.test(text));
      expect(offenders.map((o) => `${rel}:${o.n} ${o.text.trim()}`)).toEqual([]);
    });
  }

  it('every migrated file still logs server-side (errors are sanitized, not swallowed)', () => {
    for (const rel of MIGRATED) {
      const src = read(rel);
      const logs = (src.match(/\b(logger\.(error|warn)|console\.(error|warn))\s*\(/g) || []).length;
      expect(logs, `${rel} lost its server-side error logging`).toBeGreaterThan(0);
    }
  });

  it('unified-vouchers: every catch block logs before responding', () => {
    // 5 of the 11 catch blocks in this file previously responded with the raw
    // exception text and logged NOTHING at all — the error was invisible to
    // support unless the customer pasted it back. Pin that gap closed.
    const src = read('server/routes/unified-vouchers.ts');
    const catches = src.split(/\}\s*catch\s*\(\s*err/).slice(1);
    expect(catches.length).toBeGreaterThanOrEqual(11);
    const silent = catches.filter((block) => !/logger\.(error|warn)\s*\(/.test(block.slice(0, 500)));
    expect(silent.length, 'a catch block responds without logging').toBe(0);
  });
});
