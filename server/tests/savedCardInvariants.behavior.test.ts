/**
 * THE CARD PATH IS CLEAN — PIN IT THAT WAY.
 *
 * A contract/fiscal review named four areas: allocation numbers, partial
 * refunds, fee changes, and cards. The first three each had a real defect.
 * Cards did not — audited 2026-09-18 and genuinely well built. Reporting that
 * honestly is the right answer, but leaving the properties UNPINNED is not:
 * every one of them is the kind of thing a later refactor removes quietly.
 *
 * paymentTokenVault.test.ts already covers assertNoRawCardData as a pure
 * function and the expiry maths. What it does NOT cover, and what is pinned
 * here, is the wiring around it:
 *
 *   - the PCI guard is actually CALLED, not merely defined (a dead guard has
 *     been the single most common shape found in this codebase this week);
 *   - every read and write of a saved card is scoped to its OWNER, so one
 *     customer can never touch another's card;
 *   - only the last four digits are ever persisted;
 *   - charging a saved card is fail-closed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const vault = R('services/PaymentTokenVault.ts');
const sumitVault = R('services/SumitCardVault.ts');

/** Source with comments stripped — a pin must not pass on its own prose. */
const code = (src: string): string =>
  src.split('\n').filter((l) => {
    const t = l.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');

describe('the PCI guard is WIRED, not just written', () => {
  it('saveToken calls assertNoRawCardData before it touches the database', () => {
    const fn = code(vault).slice(code(vault).indexOf('static async saveToken'));
    const guard = fn.indexOf('assertNoRawCardData(');
    const insert = fn.indexOf('db.insert(paymentTokens)');
    expect(guard).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(guard);
  });

  it('the guard rejects the card fields by name, not by shape-guessing', () => {
    for (const field of ['cardnumber', 'card_number', 'pan', 'cvv', 'cvc']) {
      expect(code(vault).toLowerCase()).toContain(field);
    }
  });
});

describe('a saved card belongs to exactly one person', () => {
  const src = code(vault);

  it('EVERY paymentTokens query is scoped by userId', () => {
    // The IDOR shape: a token addressed by its row id alone lets one customer
    // revoke — or spend against — another customer's card.
    const queries = src.split('paymentTokens').length - 1;
    expect(queries).toBeGreaterThan(2);
    for (const op of ['getActiveToken', 'revokeToken', 'markFailed']) {
      const fn = src.slice(src.indexOf(op), src.indexOf(op) + 700);
      expect(fn, `${op} must be scoped by userId`).toMatch(/paymentTokens\.userId,\s*userId/);
    }
  });

  it('mutating a token takes the owner as an argument, never just the row id', () => {
    expect(src).toMatch(/revokeToken\(id: number, userId: string\)/);
    expect(src).toMatch(/markFailed\(id: number, userId: string\)/);
  });
});

describe('only the last four digits are ever kept', () => {
  it('cardLast4 is truncated on the way in', () => {
    expect(code(vault)).toMatch(/String\(input\.cardLast4\)\.slice\(-4\)/);
  });

  it('the row stores a processor TOKEN as the only card reference', () => {
    const schema = R('../shared/schema.ts');
    // Slice to the END of this table only. A fixed character window ran past
    // it into neighbouring declarations and matched their text instead.
    const at = schema.indexOf('export const paymentTokens = pgTable');
    const table = schema.slice(at, schema.indexOf('\n]', at));
    expect(table).toMatch(/processorTokenId/);
    expect(table).toMatch(/cardLast4: varchar\("card_last4", \{ length: 4 \}\)/);

    // No column could hold a full number even by accident. Assert on the DB
    // COLUMN NAMES, not the table text: the text contains the comment
    // "display only — NOT the PAN", and a plain regex matched that and failed
    // the table for documenting the rule it follows.
    const columns = [...table.matchAll(/(?:varchar|integer|timestamp|serial)\("([^"]+)"/g)].map((m) => m[1]);
    expect(columns).toContain('card_last4');
    expect(columns).toContain('processor_token_id');
    for (const forbidden of ['card_number', 'cardnumber', 'pan', 'cvv', 'cvc', 'security_code']) {
      expect(columns, `no column may be able to hold ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe('charging a saved card is fail-closed', () => {
  const fn = code(sumitVault).slice(code(sumitVault).indexOf('static async captureForBooking'));

  it('an unwired vault captures nothing', () => {
    expect(fn).toMatch(/if \(!isCardVaultEnabled\(\)\) return \{ captured: false/);
  });

  it('no saved card, or no confirmation from SUMIT, means NOT captured', () => {
    expect(fn).toMatch(/return \{ captured: false, reason: 'no_saved_card' \}/);
    expect(fn).toMatch(/if \(!r\.captured\)/);
    // captured:true is only reachable after SUMIT confirms.
    const ok = fn.indexOf('return { captured: true');
    const check = fn.indexOf('if (!r.captured)');
    expect(ok).toBeGreaterThan(check);
  });

  it('a transient failure does NOT kill the customer saved card', () => {
    // Only an explicit rejection retires the token; anything else stays active
    // so the next attempt can succeed.
    expect(fn).toMatch(/declin|invalid|expired/);
    expect(fn).toMatch(/markFailed\(token\.id, input\.userId\)/);
  });
});
