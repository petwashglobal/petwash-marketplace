/**
 * A member card must never print a Firebase UID where a name belongs.
 * Regression pin — 2026-09-19.
 *
 * WHAT HAPPENED
 * The CEO opened his own Prestige pass on an iPhone and the card read:
 *
 *     Premium Member
 *     vdiboz7IrU
 *
 * That is `pass.userId.slice(0, 10)` — the first ten characters of his raw
 * Firebase UID — rendered as his name, on the card he is meant to show a
 * station reader. Two call sites did it: the PremiumMemberCard `ownerName`
 * prop and the full-screen pass view.
 *
 * It was not a missing-data problem. The SAME /api/prestige-pass/wallet
 * response already carried the real identity (the member card block showed
 * "NIR HADAD" correctly two cards further up the same page). The server's
 * displayName lookup was simply too shallow — session.displayName ||
 * passData.firstName — and both are routinely empty for a Google signup whose
 * profile lives in Postgres. So the client fell through to the UID.
 *
 * Two rules, pinned here because both halves have to hold:
 *   1. the client never falls back to a UID — a missing name shows a neutral
 *      label ("Member" / "חבר");
 *   2. the server looks the name up properly before giving up.
 *
 * Source-pinned rather than behavioural: the bug is a fallback expression, and
 * an expression is exactly the thing a render test can pass right over when the
 * fixture happens to supply a name.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PAGE = readFileSync(path.join(ROOT, 'client/src/pages/PrestigePassWallet.tsx'), 'utf8');
const ROUTE = readFileSync(path.join(ROOT, 'server/routes/prestige-pass.ts'), 'utf8');

describe('the Prestige card never shows a Firebase UID as a name', () => {
  it('does not fall back to any slice of pass.userId for a display name', () => {
    const offenders = PAGE.split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /\buserId\s*\.\s*slice\s*\(/.test(line) && !line.startsWith('//'));

    expect(
      offenders,
      'pass.userId is the raw Firebase UID. Slicing it into a name is what put ' +
      '"vdiboz7IrU" on the CEO\'s card. Show a neutral label instead — ' +
      `PremiumMemberCard already renders 'Member' for an undefined ownerName.\n` +
      offenders.map((o) => `  line ${o.n}: ${o.line}`).join('\n'),
    ).toEqual([]);
  });

  it('keeps a neutral human label as the fallback for the pass view', () => {
    expect(PAGE).toMatch(/const name = walletData\?\.displayName \|\| \(he \? '[^']+' : '[^']+'\)/);
  });

  it('server resolves the name from the users table before giving up', () => {
    // The shallow two-source lookup is what made the client fall through at all.
    expect(ROUTE).toMatch(/SELECT first_name, last_name FROM users WHERE id = \$1/);
    // …and it must still be reached only when the cheap sources came back empty,
    // so a 30s-polling wallet screen does not add a query per poll.
    const idx = ROUTE.indexOf('SELECT first_name, last_name FROM users WHERE id = $1');
    expect(ROUTE.slice(Math.max(0, idx - 400), idx)).toContain('if (!displayName)');
  });
});
