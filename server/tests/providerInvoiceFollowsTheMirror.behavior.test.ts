/**
 * ONE JOB, TWO ROWS — THE INVOICE MUST REACH BOTH (2026-09-18).
 *
 * A Sitter Suite stay and a Walk My Pet walk are mirrored into
 * booking_requests so the provider's job inbox can show them
 * (legacyBookingBridge). Each row has its own provider_invoice_number:
 *
 *   the sitter types it in the provider inbox → booking_requests
 *   the payout gate for a sitter stay reads   → sitter_bookings
 *
 * So a provider could do exactly what was asked and stay blocked for a missing
 * invoice — the failure that made me check this at all.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const pg = new PGlite();
vi.mock('../db', () => ({ pool: { query: (t: string, p?: unknown[]) => pg.query(t, p as any[]) } }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { copyInvoiceToLegacyRow, copyInvoiceToMirrorRequest } from '../lib/providerInvoiceLink';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const ref = (table: string, id: string) => JSON.stringify({ legacyRef: { table, id }, bridged: true });

beforeAll(async () => {
  await pg.exec(`
    CREATE TABLE booking_requests (
      request_id text PRIMARY KEY, quote_breakdown jsonb,
      provider_invoice_number text, provider_invoice_submitted_at timestamptz, updated_at timestamptz);
    CREATE TABLE sitter_bookings (
      booking_id text PRIMARY KEY, provider_invoice_number text, provider_invoice_submitted_at timestamptz);
    CREATE TABLE walk_bookings (
      booking_id text PRIMARY KEY, provider_invoice_number text, provider_invoice_submitted_at timestamptz);
  `);
});

beforeEach(async () => {
  await pg.exec(`DELETE FROM booking_requests; DELETE FROM sitter_bookings; DELETE FROM walk_bookings;`);
});

const invoiceOn = async (table: string, id: string) =>
  (await pg.query<any>(`SELECT provider_invoice_number AS n FROM ${table} WHERE ${table === 'booking_requests' ? 'request_id' : 'booking_id'} = $1`, [id])).rows[0]?.n ?? null;

describe('typed in the provider inbox → reaches the row the payout gate reads', () => {
  it('sitter stay', async () => {
    await pg.query(`INSERT INTO booking_requests VALUES ('BR-1', $1::jsonb, 'INV-77', now(), now())`, [ref('sitter_bookings', 'SITTER_abc')]);
    await pg.query(`INSERT INTO sitter_bookings VALUES ('SITTER_abc', NULL, NULL)`);
    await copyInvoiceToLegacyRow('BR-1', 'INV-77');
    expect(await invoiceOn('sitter_bookings', 'SITTER_abc')).toBe('INV-77');
  });

  it('walk', async () => {
    await pg.query(`INSERT INTO booking_requests VALUES ('BR-2', $1::jsonb, 'INV-88', now(), now())`, [ref('walk_bookings', 'WALK-2026-1')]);
    await pg.query(`INSERT INTO walk_bookings VALUES ('WALK-2026-1', NULL, NULL)`);
    await copyInvoiceToLegacyRow('BR-2', 'INV-88');
    expect(await invoiceOn('walk_bookings', 'WALK-2026-1')).toBe('INV-88');
  });

  it('a booking with no mirror (a plain marketplace job) is left alone', async () => {
    await pg.query(`INSERT INTO booking_requests VALUES ('BR-3', '{}'::jsonb, 'INV-99', now(), now())`);
    await expect(copyInvoiceToLegacyRow('BR-3', 'INV-99')).resolves.toBeUndefined();
  });

  it('an unknown legacy table is never written to', async () => {
    await pg.query(`INSERT INTO booking_requests VALUES ('BR-4', $1::jsonb, 'X', now(), now())`, [ref('trainer_bookings', 'T-1')]);
    await expect(copyInvoiceToLegacyRow('BR-4', 'X')).resolves.toBeUndefined();
  });
});

describe('typed on the original row → reaches the provider inbox mirror', () => {
  it('sitter stay', async () => {
    await pg.query(`INSERT INTO booking_requests VALUES ('BR-5', $1::jsonb, NULL, NULL, now())`, [ref('sitter_bookings', 'SITTER_xyz')]);
    await pg.query(`INSERT INTO sitter_bookings VALUES ('SITTER_xyz', 'INV-11', now())`);
    await copyInvoiceToMirrorRequest('sitter_bookings', 'SITTER_xyz', 'INV-11');
    expect(await invoiceOn('booking_requests', 'BR-5')).toBe('INV-11');
  });

  it('walk', async () => {
    await pg.query(`INSERT INTO booking_requests VALUES ('BR-6', $1::jsonb, NULL, NULL, now())`, [ref('walk_bookings', 'WALK-9')]);
    await pg.query(`INSERT INTO walk_bookings VALUES ('WALK-9', 'INV-22', now())`);
    await copyInvoiceToMirrorRequest('walk_bookings', 'WALK-9', 'INV-22');
    expect(await invoiceOn('booking_requests', 'BR-6')).toBe('INV-22');
  });
});

describe('an invoice already recorded is never overwritten', () => {
  it('the number a provider entered first stands', async () => {
    await pg.query(`INSERT INTO booking_requests VALUES ('BR-7', $1::jsonb, 'NEW', now(), now())`, [ref('sitter_bookings', 'SITTER_done')]);
    await pg.query(`INSERT INTO sitter_bookings VALUES ('SITTER_done', 'ORIGINAL', now())`);
    await copyInvoiceToLegacyRow('BR-7', 'NEW');
    expect(await invoiceOn('sitter_bookings', 'SITTER_done')).toBe('ORIGINAL');
  });
});

describe('a copy failure never fails the provider’s save', () => {
  it('a missing row is not an error', async () => {
    await expect(copyInvoiceToMirrorRequest('sitter_bookings', 'nope', 'X')).resolves.toBeUndefined();
    await expect(copyInvoiceToLegacyRow('nope', 'X')).resolves.toBeUndefined();
  });
});

describe('all three routes keep the pair in step', () => {
  it('booking inbox, walk and sitter each copy across', () => {
    expect(read('routes/booking-requests.ts')).toContain('await copyInvoiceToLegacyRow(req.params.requestId, invoiceNumber);');
    expect(read('routes/walk-my-pet.ts')).toContain("await copyInvoiceToMirrorRequest('walk_bookings', req.params.bookingId, invoiceNumber);");
    expect(read('routes/sitter-suite.ts')).toContain("await copyInvoiceToMirrorRequest('sitter_bookings', req.params.bookingId, invoiceNumber);");
  });

  it('the table name comes from a whitelist, never from the request', () => {
    const lib = read('lib/providerInvoiceLink.ts');
    expect(lib).toContain("const LEGACY_TABLES = ['sitter_bookings', 'walk_bookings'] as const;");
    expect(lib).toContain('LEGACY_TABLES.includes(table as LegacyInvoiceTable)');
  });
});
