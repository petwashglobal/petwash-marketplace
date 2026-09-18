/**
 * The rescue for gift cards that were born unusable — and the guards on it,
 * because it edits live customer money records.
 *
 * #2633 stopped NEW gift cards being created in 'PENDING', a state nothing in
 * the eVoucher lifecycle accepts. It did nothing for the ones already sold:
 * those buyers were charged and those recipients still cannot claim. This
 * endpoint brings them back.
 *
 * Runs against a real Postgres engine (pglite) so the WHERE scoping is proved
 * on actual rows, not asserted on source text — the whole risk here is a repair
 * touching more than it should.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const { pg, testDb } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PGlite: PG } = require('@electric-sql/pglite');
  const { drizzle: dz } = require('drizzle-orm/pglite');
  const client = new PG();
  return { pg: client, testDb: dz(client) };
});

vi.mock('../db', () => ({ db: testDb, pool: { query: (t: string, p?: unknown[]) => pg.query(t, p as any[]) } }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../middleware/auditLog', () => ({ logAuditEvent: vi.fn(async () => undefined) }));

import express from 'express';
import request from 'supertest';
import router from '../routes/admin-egift-rescue';

const app = express();
app.use(express.json());
app.use((req, _res, next) => { (req as any).firebaseUser = { uid: 'admin-uid' }; next(); });
app.use('/api/admin/egift-rescue', router);

beforeAll(async () => {
  await pg.exec(`
    CREATE TABLE e_vouchers (
      id text PRIMARY KEY, code_hash text NOT NULL, code_last4 text NOT NULL,
      type text NOT NULL, currency text NOT NULL DEFAULT 'ILS',
      initial_amount numeric(12,2) NOT NULL, remaining_amount numeric(12,2) NOT NULL,
      status text NOT NULL DEFAULT 'ISSUED',
      purchaser_email text, recipient_email text, purchaser_uid text, owner_uid text,
      nayax_tx_id text, sumit_document_id text, eligible_services jsonb DEFAULT '["all"]',
      expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), activated_at timestamptz
    );
  `);
});

beforeEach(async () => {
  await pg.exec(`
    DELETE FROM e_vouchers;
    INSERT INTO e_vouchers (id, code_hash, code_last4, type, initial_amount, remaining_amount, status, recipient_email) VALUES
      ('v-dead-1','h1','1111','FIXED',100.00,100.00,'PENDING','a@example.com'),
      ('v-dead-2','h2','2222','FIXED',250.00,250.00,'PENDING','b@example.com'),
      ('v-live',  'h3','3333','FIXED',500.00,500.00,'ISSUED','c@example.com'),
      ('v-spent', 'h4','4444','FIXED',100.00,  0.00,'REDEEMED','d@example.com'),
      ('v-killed','h5','5555','FIXED',300.00,300.00,'CANCELLED','e@example.com');
  `);
});

const statusOf = async (id: string) =>
  (await pg.query<{ status: string }>('SELECT status FROM e_vouchers WHERE id = $1', [id])).rows[0].status;

describe('the survey is read-only', () => {
  it('reports the dead ones and their value without changing anything', async () => {
    const res = await request(app).get('/api/admin/egift-rescue');
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.deadCount).toBe(2);
    expect(res.body.totalValueMinor).toBe(35_000); // ₪100 + ₪250
    expect(await statusOf('v-dead-1')).toBe('PENDING');
  });

  it('names the recipients who are waiting', async () => {
    const res = await request(app).get('/api/admin/egift-rescue');
    const emails = res.body.vouchers.map((v: any) => v.recipientEmail);
    expect(emails).toContain('a@example.com');
    expect(emails).toContain('b@example.com');
  });
});

describe('the repair refuses to run by accident', () => {
  it('a POST without the confirmation changes nothing', async () => {
    const res = await request(app).post('/api/admin/egift-rescue').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('CONFIRMATION_REQUIRED');
    expect(await statusOf('v-dead-1')).toBe('PENDING');
  });

  it('a wrong confirmation word changes nothing', async () => {
    const res = await request(app).post('/api/admin/egift-rescue').send({ confirm: 'yes' });
    expect(res.status).toBe(400);
    expect(await statusOf('v-dead-1')).toBe('PENDING');
  });
});

describe('the repair touches ONLY the dead ones', () => {
  it('revives every PENDING voucher', async () => {
    const res = await request(app).post('/api/admin/egift-rescue').send({ confirm: 'REPAIR' });
    expect(res.status).toBe(200);
    expect(res.body.repaired).toBe(2);
    expect(await statusOf('v-dead-1')).toBe('ISSUED');
    expect(await statusOf('v-dead-2')).toBe('ISSUED');
  });

  it('never re-opens a REDEEMED gift or revives a CANCELLED one', async () => {
    await request(app).post('/api/admin/egift-rescue').send({ confirm: 'REPAIR' });
    expect(await statusOf('v-spent')).toBe('REDEEMED');
    expect(await statusOf('v-killed')).toBe('CANCELLED');
    expect(await statusOf('v-live')).toBe('ISSUED');
  });

  it('never changes an amount', async () => {
    await request(app).post('/api/admin/egift-rescue').send({ confirm: 'REPAIR' });
    const rows = await pg.query<{ initial_amount: string; remaining_amount: string }>(
      "SELECT initial_amount, remaining_amount FROM e_vouchers WHERE id = 'v-dead-2'",
    );
    expect(Number(rows.rows[0].initial_amount)).toBe(250);
    expect(Number(rows.rows[0].remaining_amount)).toBe(250);
  });

  it('running it twice is safe — the second run finds nothing', async () => {
    await request(app).post('/api/admin/egift-rescue').send({ confirm: 'REPAIR' });
    const second = await request(app).post('/api/admin/egift-rescue').send({ confirm: 'REPAIR' });
    expect(second.body.repaired).toBe(0);
  });

  it('it does NOT email anyone — telling recipients is a deliberate decision', async () => {
    const res = await request(app).post('/api/admin/egift-rescue').send({ confirm: 'REPAIR' });
    expect(res.body.note).toMatch(/no email was sent/i);
  });
});
