import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CEO, 2026-09-19: "why i cannot have apple button add to wallet like others
 * and i press yes".
 *
 * The server could build a signed .pkpass the whole time — production logs for
 * the 72h to that date show [AppleWallet] Generating pkpass running to
 * completion, with no error after it. But NO client file referenced
 * /api/prestige-pass/apple-wallet, so the member pass page had no button. Two
 * passes were generated in three days because there was nothing to press.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..');
const R = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('the member pass offers Add to Apple Wallet', () => {
  it('the button points at the endpoint that actually builds a signed pass', () => {
    const src = R('client/src/components/AddToAppleWallet.tsx');
    expect(src).toContain('/api/prestige-pass/apple-wallet');
  });

  it('it is a navigation, not a fetch — iOS installs a pass from a navigation', () => {
    const src = R('client/src/components/AddToAppleWallet.tsx');
    expect(src).toMatch(/<a\b/);
    // fetching the bytes and building a blob URL is how you get
    // "Safari cannot download this file"
    expect(src).not.toMatch(/fetch\(|createObjectURL/);
  });

  it('the member pass page actually renders it', () => {
    const page = R('client/src/pages/PrestigePassWallet.tsx');
    expect(page).toContain('AddToAppleWallet');
    expect(page).toMatch(/import \{ AddToAppleWallet \}/);
  });

  it('some client file references the pass endpoint at all', () => {
    // the regression in one line: before this, the answer was zero files
    const dir = path.join(ROOT, 'client', 'src');
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('prestige-pass/apple-wallet')) {
          hits.push(path.relative(ROOT, p));
        }
      }
    };
    walk(dir);
    expect(hits.length, 'no client file offers the member Apple Wallet pass').toBeGreaterThan(0);
  });
});
