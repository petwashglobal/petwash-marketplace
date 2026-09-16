/**
 * Migration 0161 — extending gift cards that were sold with a 1-year expiry.
 *
 * This one UPDATEs customer money rows, so it is tested against a real Postgres
 * engine (pglite) rather than trusted by eye. The invariants:
 *   · a card expiring EARLIER than the promise moves to exactly 60 months
 *   · a card already expiring LATER is never shortened
 *   · a card with NO expiry is left alone — redemption treats NULL as valid, so
 *     writing a date there would take something away
 *   · running it twice changes nothing the second time
 */
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SQL = readFileSync(join(__dirname, '../../migrations/0161_evoucher_validity_matches_terms.sql'), 'utf8');

describe('0161 only ever extends', () => {
  it('short → 60 months; longer, exact and NULL untouched; idempotent', async () => {
    const pg = new PGlite();
    await pg.exec(`
      CREATE TABLE e_vouchers (id text PRIMARY KEY, created_at timestamptz NOT NULL, expires_at timestamptz);
      INSERT INTO e_vouchers VALUES
        ('sold-with-1-year', '2026-01-01', '2027-01-01'),
        ('already-longer',   '2026-01-01', '2040-01-01'),
        ('no-expiry',        '2026-01-01', NULL),
        ('already-exact',    '2026-01-01', '2031-01-01');
    `);

    const read = async () => Object.fromEntries((await pg.query<any>(
      `SELECT id, to_char(expires_at, 'YYYY-MM-DD') AS e FROM e_vouchers ORDER BY id`,
    )).rows.map((r: any) => [r.id, r.e]));

    await pg.exec(SQL);
    const after = await read();
    expect(after).toEqual({
      'sold-with-1-year': '2031-01-01',   // +4 years of life restored
      'already-longer':   '2040-01-01',   // never shortened
      'no-expiry':        null,           // never given an expiry it did not have
      'already-exact':    '2031-01-01',
    });

    await pg.exec(SQL);
    expect(await read()).toEqual(after);
  });

  it('the file never shortens: it writes the promise, gated on being below it', () => {
    expect(SQL).toContain("SET expires_at = created_at + INTERVAL '60 months'");
    expect(SQL).toContain("AND expires_at < created_at + INTERVAL '60 months'");
    expect(SQL).toContain('WHERE expires_at IS NOT NULL');
    // No DELETE, no DROP, no touching anything but this one column.
    expect(SQL).not.toMatch(/\b(DELETE|DROP|TRUNCATE|ALTER)\b/i);
  });
});
