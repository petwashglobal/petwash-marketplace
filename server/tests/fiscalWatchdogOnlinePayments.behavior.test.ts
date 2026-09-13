/**
 * Fiscal watchdog — online payments (Upay via SUMIT) ↔ official documents,
 * the fiscal outbox, and PRODUCTION scheduling (2026-09-13).
 *
 * Found: startFiscalWatchdog() was only called in the DEVELOPMENT boot branch of
 * server/index.ts, so production never ran the watchdog. And it only checked the
 * Nayax claim ledger — nothing compared card payments with documents.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../db', () => ({ pool: {}, db: {}, isDatabaseAvailable: true }));
vi.mock('../lib/guarded-sendgrid', () => ({ sendGuardedEmail: vi.fn() }));
vi.mock('../services/FiscalSettlementIngest', () => ({ matchBankForPeriod: vi.fn() }));

import { evaluateOnlinePayments, evaluateFiscalOutbox, ONLINE_PAYMENTS_SQL, type OnlinePaymentRow } from '../services/FiscalWatchdogService';

const NOW = new Date('2026-09-13T12:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);
const row = (over: Partial<OnlinePaymentRow>): OnlinePaymentRow => ({
  payment_id: '555001', surface: 'wallet_purchase', order_ref: 'ext-1', claimed_at: hoursAgo(5),
  document_key: 'sumit:p1', expected_minor: 10000, receipt_count: 1, receipt_total_minor: 10000, receipt_sumit_doc: '900001',
  ...over,
});
const checks = (r: ReturnType<typeof evaluateOnlinePayments>) => ({
  critical: r.exceptions.map((e) => e.check), warn: r.warnings.map((e) => e.check),
});

describe('evaluateOnlinePayments', () => {
  const run = (rows: OnlinePaymentRow[], sumitWired = true) => checks(evaluateOnlinePayments(rows, { now: NOW, sumitWired }));

  it('a paid order with one matching SUMIT document is clean', () => {
    expect(run([row({})])).toEqual({ critical: [], warn: [] });
  });
  it('money with no order to deliver', () => {
    expect(run([row({ document_key: null, receipt_count: 0 })]).critical).toEqual(['PAID_WITHOUT_ORDER']);
  });
  it('paid, but no official document after 2h', () => {
    expect(run([row({ receipt_count: 0, receipt_total_minor: null, receipt_sumit_doc: null })]).critical).toEqual(['PAID_WITHOUT_DOCUMENT']);
  });
  it('two documents for one payment', () => {
    expect(run([row({ receipt_count: 2 })]).critical).toContain('DUPLICATE_DOCUMENT');
  });
  it('document amount differs from the order', () => {
    expect(run([row({ receipt_total_minor: 11800 })]).critical).toContain('DOCUMENT_AMOUNT_MISMATCH');
    expect(run([row({ receipt_total_minor: 10001 })]).critical).toEqual([]); // 1 agora tolerance
  });
  it('local receipt never reached SUMIT: warning < 24h, critical after', () => {
    expect(run([row({ receipt_sumit_doc: null, claimed_at: hoursAgo(5) })]).warn).toEqual(['NOT_ISSUED_AT_SUMIT']);
    expect(run([row({ receipt_sumit_doc: null, claimed_at: hoursAgo(30) })]).critical).toEqual(['NOT_ISSUED_AT_SUMIT']);
    expect(run([row({ receipt_sumit_doc: null, claimed_at: hoursAgo(30) })], false)).toEqual({ critical: [], warn: [] });
  });
  it('in-flight payments (< 2h) are not judged yet', () => {
    expect(run([row({ receipt_count: 0, claimed_at: hoursAgo(1) })])).toEqual({ critical: [], warn: [] });
  });
  it('booking payments are reported as withheld (accountant decision), never as a failure', () => {
    expect(run([row({ surface: 'booking', receipt_count: 0 })])).toEqual({ critical: [], warn: ['PAYMENT_DOCUMENT_WITHHELD'] });
  });
  it('the ₪1 save-card verification is skipped (SUMIT’s own document is final)', () => {
    expect(run([row({ surface: 'save_card', document_key: null, receipt_count: 0 })])).toEqual({ critical: [], warn: [] });
  });
});

describe('evaluateFiscalOutbox', () => {
  it('failed jobs are critical; pending > 24h is a warning', () => {
    const r = evaluateFiscalOutbox([
      { kind: 'sumit_receipt_dispatch', source_key: 'receipt:PW-1', status: 'failed_needs_review', attempts: 8, created_at: hoursAgo(50), last_error: 'SUMIT Status 1' },
      { kind: 'shop_receipt', source_key: 'shop:9', status: 'pending', attempts: 3, created_at: hoursAgo(30), last_error: null },
      { kind: 'shop_receipt', source_key: 'shop:10', status: 'pending', attempts: 1, created_at: hoursAgo(2), last_error: null },
    ], { now: NOW });
    expect(r.exceptions.map((e) => e.check)).toEqual(['OUTBOX_FAILED']);
    expect(r.warnings.map((e) => e.check)).toEqual(['OUTBOX_STALE']);
  });
});

describe('the online-payments SQL runs against a real Postgres engine', () => {
  it('joins claims → purchase / guest eGift / shop order → receipts by the real document keys', async () => {
    const pg = new PGlite();
    await pg.exec(readFileSync(join(__dirname, '../../migrations/0154_sumit_payment_claims.sql'), 'utf8'));
    await pg.exec(`
      CREATE TABLE purchases (id text PRIMARY KEY, surface text, surface_ref_id text, amount_cents bigint);
      CREATE TABLE egift_guest_orders (id serial PRIMARY KEY, external_id text, amount_ils_cents int);
      CREATE TABLE shop_orders (id serial PRIMARY KEY, order_number text, payment_ref text);
      CREATE TABLE digital_receipts (id serial PRIMARY KEY, booking_id text, total_amount numeric(12,2), sumit_document_id text, is_voided boolean NOT NULL DEFAULT false);

      INSERT INTO sumit_payment_claims (payment_id, order_ref, surface, claimed_at) VALUES
        (1, 'ext-topup', 'wallet_purchase', now() - interval '5 hours'),
        (2, 'ext-shop',  'wallet_purchase', now() - interval '5 hours'),
        (3, 'eg-1',      'egift_guest',     now() - interval '5 hours'),
        (4, 'ext-lost',  'wallet_purchase', now() - interval '5 hours');
      INSERT INTO purchases VALUES ('p-topup', 'wallet_topup', 'ext-topup', 10000), ('p-shop', 'shop', 'ext-shop', 12990);
      INSERT INTO shop_orders (order_number, payment_ref) VALUES ('PW-SHOP-7', '2');
      INSERT INTO egift_guest_orders (external_id, amount_ils_cents) VALUES ('eg-1', 25000);
      INSERT INTO digital_receipts (booking_id, total_amount, sumit_document_id) VALUES
        ('sumit:p-topup', 100.00, '900001'),
        ('shop:PW-SHOP-7', 129.90, '900002'),
        ('shop:PW-SHOP-7', 129.90, NULL),
        ('egift_guest:eg-1', 250.00, '900003');
    `);
    const { rows } = await pg.query<any>(ONLINE_PAYMENTS_SQL);
    const by = Object.fromEntries(rows.map((r: any) => [String(r.payment_id), r]));
    expect(by['1']).toMatchObject({ document_key: 'sumit:p-topup', receipt_count: 1, receipt_sumit_doc: '900001' });
    expect(Number(by['1'].expected_minor)).toBe(10000);
    expect(by['2']).toMatchObject({ document_key: 'shop:PW-SHOP-7', receipt_count: 2 });
    expect(Number(by['2'].receipt_total_minor)).toBe(12990);
    expect(by['3']).toMatchObject({ document_key: 'egift_guest:eg-1', receipt_count: 1 });
    expect(by['4'].document_key).toBeNull();

    const verdict = evaluateOnlinePayments(rows as any, { sumitWired: true });
    const found = verdict.exceptions.map((e) => `${e.check}:${e.ref}`).sort();
    expect(found).toEqual(['DUPLICATE_DOCUMENT:sumit-payment:2', 'PAID_WITHOUT_ORDER:sumit-payment:4']);
  });
});

describe('production actually runs it', () => {
  it('BackgroundJobProcessor schedules the watchdog under a leader lock', () => {
    const src = readFileSync(join(__dirname, '../backgroundJobs.ts'), 'utf8');
    const i = src.indexOf("acquireLock('fiscalWatchdog')");
    expect(i).toBeGreaterThan(0);
    expect(src.slice(i, i + 400)).toContain('runFiscalWatchdogTick');
  });
  it('findings are mirrored into the admin alert center and cleared ones auto-resolve', () => {
    const src = readFileSync(join(__dirname, '../services/FiscalWatchdogService.ts'), 'utf8');
    expect(src).toContain("dedupeKey = `fiscal_watchdog:${e.check}:${e.ref}`");
    expect(src).toContain("resolveClearedByPrefix('fiscal_watchdog:', keys)");
    const rd = src.indexOf('export async function recordAndDistribute(run: WatchdogRun): Promise<void> {');
    expect(src.slice(rd, rd + 120)).toContain('await mirrorToAlerts(run);');
  });
});
