/**
 * A SITTER COULD NEVER BE PAID (2026-09-18).
 *
 * Provider money moves only when a Pet Wash admin says yes (CEO 2026-09-13),
 * and the approval queue lists held ESCROW rows. Sitter Suite stays are not
 * escrow rows — the Sitter Suite has its own table and its own completion path
 * — so money owed to a sitter never appeared in the queue and there was no
 * route to approve it. Sitters were also the only providers with nowhere to
 * record their own tax invoice (migration 0159 covered bookings and walks).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const pg = new PGlite();
vi.mock('../db', () => ({ pool: { query: (t: string, p?: unknown[]) => pg.query(t, p as any[]) } }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { loadSitterStayEvidence, buildJobEvidenceReport } from '../services/jobEvidenceLoader';
import { evaluateJobEvidence } from '../services/jobEvidence';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

beforeAll(async () => {
  await pg.exec(`
    CREATE TABLE users (id text PRIMARY KEY, phone text, phone_hash text, phone_e164 text);
    CREATE TABLE sitter_profiles (id int PRIMARY KEY, user_id text NOT NULL);
    CREATE TABLE sitter_bookings (
      booking_id text PRIMARY KEY, owner_id text, sitter_id int, status text, payout_status text,
      start_date timestamp, end_date timestamp, started_at timestamp, completed_at timestamp,
      service_address_lat numeric(10,7), service_address_lng numeric(10,7),
      sitter_payout_cents int, total_charge_cents int, provider_invoice_number text);
    CREATE TABLE booking_disputes (id serial PRIMARY KEY, booking_id text, status text);

    INSERT INTO users VALUES ('sitter-uid', null, 'H-S', null), ('owner-uid', null, 'H-O', null);
    INSERT INTO sitter_profiles VALUES (7, 'sitter-uid');

    -- an honest 2-day stay, invoice recorded
    INSERT INTO sitter_bookings VALUES ('SITTER_ok', 'owner-uid', 7, 'completed', 'pending',
      now() - interval '3 days', now() - interval '1 day', now() - interval '3 days', now() - interval '1 day',
      32.1782, 34.9076, 90000, 103500, 'INV-2026-77');

    -- same stay, no invoice recorded
    INSERT INTO sitter_bookings VALUES ('SITTER_noinv', 'owner-uid', 7, 'completed', 'pending',
      now() - interval '3 days', now() - interval '1 day', now() - interval '3 days', now() - interval '1 day',
      32.1782, 34.9076, 90000, 103500, NULL);

    -- the sitter booked their own stay through a second account with their phone
    INSERT INTO sitter_bookings VALUES ('SITTER_self', 'sitter-uid', 7, 'completed', 'pending',
      now() - interval '3 days', now() - interval '1 day', now() - interval '3 days', now() - interval '1 day',
      32.1782, 34.9076, 90000, 103500, 'INV-9');
  `);
});

describe('a sitter stay now has evidence like every other job', () => {
  it('reads the stay: both parties, the real times, the invoice', async () => {
    const ev = await loadSitterStayEvidence('SITTER_ok');
    expect(ev).toMatchObject({
      jobId: 'SITTER_ok', providerUid: 'sitter-uid', ownerUid: 'owner-uid',
      providerInvoiceRequired: true, providerInvoiceNumber: 'INV-2026-77',
    });
    expect(ev!.actualEnd).toBeInstanceOf(Date);
    expect(evaluateJobEvidence(ev!).verdict).toBe('clear');
  });

  it('no invoice recorded → blocked, the same rule walkers and trainers live by', async () => {
    const r = await buildJobEvidenceReport('SITTER_noinv');
    expect(r!.verdict).toBe('blocked');
    expect(r!.findings.map((f) => f.code)).toContain('PROVIDER_INVOICE_MISSING');
  });

  it('the sitter booking themself is caught', async () => {
    const r = await buildJobEvidenceReport('SITTER_self');
    expect(r!.verdict).toBe('blocked');
    expect(r!.findings.map((f) => f.code)).toContain('SELF_BOOKING_SAME_ACCOUNT');
  });

  it('SITTER_* ids route to the sitter table, not booking_requests', async () => {
    expect(read('services/jobEvidenceLoader.ts')).toContain("/^SITTER_/i.test(jobId) ? await loadSitterStayEvidence(jobId)");
  });
});

describe('the admin queue and the admin yes', () => {
  const esc = read('routes/escrow.ts');

  it('finished stays that are owed money join the same queue', () => {
    expect(esc).toContain('async function listSitterStaysAwaitingPayout(');
    expect(esc).toContain('eq(sitterBookings.status, "completed"), eq(sitterBookings.payoutStatus, "pending")');
    expect(esc).toContain('const items = [...escrowItems, ...sitterItems];');
    expect(esc).toContain('kind: "sitter_stay" as const');
  });

  it('approving one needs an admin, a written reason, and the evidence first', () => {
    const i = esc.indexOf('router.post("/admin/sitter-stay/:bookingId/approve-payout", requireAdmin');
    expect(i).toBeGreaterThan(0);
    const body = esc.slice(i, i + 3600);
    expect(body).toContain('REASON_REQUIRED');
    const evidenceAt = body.indexOf('buildJobEvidenceReport(bookingId)');
    const gateAt = body.indexOf('evidence?.verdict === "blocked" && !(override && reason.length >= 20)');
    const claimAt = body.indexOf('.set({ payoutStatus: "approved"');
    expect(evidenceAt).toBeGreaterThan(0);
    expect(gateAt).toBeGreaterThan(evidenceAt);
    expect(claimAt).toBeGreaterThan(gateAt);
    // the gate returns a code, never the evidence detail
    expect(body).toContain('error: "EVIDENCE_BLOCKED"');
  });

  it('two admins cannot approve the same stay twice', () => {
    const i = esc.indexOf('router.post("/admin/sitter-stay/:bookingId/approve-payout", requireAdmin');
    const body = esc.slice(i, i + 3600);
    expect(body).toContain('eq(sitterBookings.payoutStatus, "pending")))');
    expect(body).toContain('if (claimed.length === 0) return res.status(409).json({ error: "PAYOUT_NOT_PENDING" });');
  });

  it('the payout carries the approving admin, so it is never a system release', () => {
    const i = esc.indexOf('router.post("/admin/sitter-stay/:bookingId/approve-payout", requireAdmin');
    expect(esc.slice(i, i + 3600)).toContain('approvedByUid: adminUid,');
  });
});

describe('the sitter can record their own invoice', () => {
  it('sitter-only, completed stays only, sane invoice numbers', () => {
    const src = read('routes/sitter-suite.ts');
    const i = src.indexOf("router.post('/bookings/:bookingId/provider-invoice'");
    expect(i).toBeGreaterThan(0);
    const body = src.slice(i, i + 2200);
    expect(body).toContain('INVALID_INVOICE_NUMBER');
    expect(body).toContain("Only the sitter can record their invoice");
    expect(body).toContain("JOB_NOT_COMPLETED");
  });

  it('migration 0162 adds the column sitter stays were missing', () => {
    const sql = readFileSync(join(__dirname, '../../migrations/0162_sitter_provider_invoice.sql'), 'utf8');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS provider_invoice_number');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS provider_invoice_submitted_at');
  });
});

describe('the admin screen can actually approve what it lists', () => {
  const ui = readFileSync(join(__dirname, '../../client/src/pages/admin/AdminPayoutApprovals.tsx'), 'utf8');

  it('a sitter stay posts to the sitter route, an escrow hold to the escrow route', () => {
    expect(ui).toContain("item.kind === 'sitter_stay'");
    expect(ui).toContain('/api/escrow/admin/sitter-stay/${encodeURIComponent(item.bookingId ?? \'\')}/approve-payout');
    expect(ui).toContain('/api/escrow/admin/${encodeURIComponent(item.escrowId ?? \'\')}/approve-release');
  });

  it('rows keep a stable id even without an escrow id', () => {
    expect(ui).toContain("const rowId = item.escrowId ?? item.bookingId ?? '';");
    expect(ui).not.toMatch(/key=\{item\.escrowId\}/);
  });
});
