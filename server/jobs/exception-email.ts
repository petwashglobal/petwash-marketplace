/**
 * PetWash Finance Exception Email
 *
 * Sends a daily plain-HTML summary of wallet exceptions to FINANCE_ALERT_EMAIL.
 * Gate: only runs when EXCEPTION_EMAIL_ENABLED=true.
 * Schedule: 06:00 UTC daily (= 08:00 IL winter / 09:00 IL summer — close enough for first pass).
 *
 * Reuses the same 4 signal queries as the /admin/wallet/exception-summary endpoint.
 * No special formatting — plain HTML table per spec.
 */

import cron from 'node-cron';
import sgMail from '@sendgrid/mail';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? '';
const FINANCE_ALERT_EMAIL = process.env.FINANCE_ALERT_EMAIL ?? '';
const EXCEPTION_EMAIL_ENABLED = process.env.EXCEPTION_EMAIL_ENABLED === 'true';

async function buildExceptionSummary(): Promise<{
  staleHoldsOver72h: { count: number; totalCents: number };
  refundExceedsHold: { count: number; totalCents: number };
  negativeBalances:  { count: number };
  unresolvedAnomalies: { count: number };
  topOffenders: Array<{ userId: string; issueCount: number; description: string }>;
}> {
  const offenderMap = new Map<string, { stale: number; ref: number; neg: number; dbl: number }>();
  const bump = (uid: string | null, f: 'stale' | 'ref' | 'neg' | 'dbl') => {
    if (!uid) return;
    if (!offenderMap.has(uid)) offenderMap.set(uid, { stale: 0, ref: 0, neg: 0, dbl: 0 });
    offenderMap.get(uid)![f]++;
  };

  const negRows: any  = await db.execute(sql`
    SELECT user_id FROM wallet_accounts
    WHERE cash_wallet_balance_cents < 0 OR pending_balance_cents < 0
  `);
  const negList = negRows?.rows ?? negRows ?? [];
  for (const r of negList) bump(r.user_id, 'neg');

  const staleRows: any = await db.execute(sql`
    SELECT owner_id AS user_id, wallet_hold_cents FROM booking_requests
    WHERE finance_state = 'hold_active' AND created_at < NOW() - INTERVAL '72 hours'
    UNION ALL
    SELECT user_id, wallet_hold_cents FROM trainer_bookings
    WHERE finance_state = 'hold_active' AND created_at < NOW() - INTERVAL '72 hours'
  `);
  const staleList = staleRows?.rows ?? staleRows ?? [];
  for (const r of staleList) bump(r.user_id, 'stale');
  const staleCents = staleList.reduce((a: number, r: any) => a + Number(r.wallet_hold_cents ?? 0), 0);

  const refRows: any = await db.execute(sql`
    SELECT owner_id AS user_id, wallet_hold_cents, wallet_refunded_cents FROM booking_requests
    WHERE wallet_refunded_cents > wallet_hold_cents AND wallet_hold_cents > 0
    UNION ALL
    SELECT user_id, wallet_hold_cents, wallet_refunded_cents FROM trainer_bookings
    WHERE wallet_refunded_cents > wallet_hold_cents AND wallet_hold_cents > 0
  `);
  const refList = refRows?.rows ?? refRows ?? [];
  for (const r of refList) bump(r.user_id, 'ref');
  const refExcessCents = refList.reduce((a: number, r: any) => a + Math.max(0, Number(r.wallet_refunded_cents ?? 0) - Number(r.wallet_hold_cents ?? 0)), 0);

  const dblRows: any = await db.execute(sql`
    SELECT booking_id, MIN(user_id) AS user_id, COUNT(*) AS debit_count
    FROM wallet_ledger_entries
    WHERE event_type = 'debit' AND booking_id IS NOT NULL AND booking_id != ''
    GROUP BY booking_id HAVING COUNT(*) > 1
  `);
  const dblList = dblRows?.rows ?? dblRows ?? [];
  for (const r of dblList) bump(r.user_id, 'dbl');

  const topOffenders = Array.from(offenderMap.entries())
    .map(([userId, c]) => {
      const issueCount = c.stale + c.ref + c.neg + c.dbl;
      const parts: string[] = [];
      if (c.stale) parts.push(`${c.stale} stale hold${c.stale > 1 ? 's' : ''}`);
      if (c.ref)   parts.push(`${c.ref} refund${c.ref > 1 ? 's' : ''} exceed hold`);
      if (c.neg)   parts.push(`${c.neg} negative balance${c.neg > 1 ? 's' : ''}`);
      if (c.dbl)   parts.push(`${c.dbl} double debit${c.dbl > 1 ? 's' : ''}`);
      return { userId, issueCount, description: parts.join(', ') };
    })
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 5);

  return {
    staleHoldsOver72h:   { count: staleList.length, totalCents: staleCents },
    refundExceedsHold:   { count: refList.length,   totalCents: refExcessCents },
    negativeBalances:    { count: negList.length },
    unresolvedAnomalies: { count: negList.length + staleList.length + refList.length + dblList.length },
    topOffenders,
  };
}

function ilsCents(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}

function buildHtml(s: Awaited<ReturnType<typeof buildExceptionSummary>>, asOf: string): string {
  const totalIssues = s.staleHoldsOver72h.count + s.refundExceedsHold.count + s.negativeBalances.count;
  const status = totalIssues === 0 ? '✅ All Clear' : `⚠ ${totalIssues} issue${totalIssues !== 1 ? 's' : ''} found`;

  const offenderRows = s.topOffenders.length > 0
    ? s.topOffenders.map(o =>
        `<tr><td style="font-family:monospace;font-size:12px">${o.userId}</td>` +
        `<td style="text-align:center;font-weight:bold;color:#dc2626">${o.issueCount}</td>` +
        `<td style="font-size:12px;color:#555">${o.description}</td></tr>`
      ).join('')
    : '<tr><td colspan="3" style="color:#888;text-align:center">No offenders</td></tr>';

  return `<!DOCTYPE html>
<html lang="he">
<head><meta charset="utf-8"><title>PetWash Finance Exception Report</title></head>
<body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:20px">
  <h2 style="border-bottom:2px solid #C5A55A;padding-bottom:8px;color:#C5A55A">
    PetWash — Finance Exception Report
  </h2>
  <p style="font-size:13px;color:#555">Generated: ${asOf}</p>
  <p style="font-size:16px;font-weight:bold">${status}</p>

  <table width="100%" cellpadding="8" cellspacing="0" border="0"
         style="border-collapse:collapse;margin:16px 0">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="text-align:left;font-size:13px">Signal</th>
        <th style="text-align:right;font-size:13px">Count</th>
        <th style="text-align:right;font-size:13px">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom:1px solid #eee">
        <td>Stale Holds > 72h</td>
        <td style="text-align:right;font-weight:bold;color:${s.staleHoldsOver72h.count > 0 ? '#d97706' : '#16a34a'}">${s.staleHoldsOver72h.count}</td>
        <td style="text-align:right;font-family:monospace">${ilsCents(s.staleHoldsOver72h.totalCents)}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee">
        <td>Refund Exceeds Hold</td>
        <td style="text-align:right;font-weight:bold;color:${s.refundExceedsHold.count > 0 ? '#dc2626' : '#16a34a'}">${s.refundExceedsHold.count}</td>
        <td style="text-align:right;font-family:monospace">${ilsCents(s.refundExceedsHold.totalCents)}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee">
        <td>Negative Balances</td>
        <td style="text-align:right;font-weight:bold;color:${s.negativeBalances.count > 0 ? '#dc2626' : '#16a34a'}">${s.negativeBalances.count}</td>
        <td style="text-align:right;font-family:monospace">—</td>
      </tr>
      <tr>
        <td>Total Unresolved Anomalies</td>
        <td style="text-align:right;font-weight:bold;color:${s.unresolvedAnomalies.count > 0 ? '#ea580c' : '#16a34a'}">${s.unresolvedAnomalies.count}</td>
        <td style="text-align:right;font-family:monospace">—</td>
      </tr>
    </tbody>
  </table>

  <h3 style="font-size:14px;margin-top:24px">Top Offenders</h3>
  <table width="100%" cellpadding="6" cellspacing="0" border="0"
         style="border-collapse:collapse">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="text-align:left;font-size:12px">User ID</th>
        <th style="text-align:center;font-size:12px">Issues</th>
        <th style="text-align:left;font-size:12px">Details</th>
      </tr>
    </thead>
    <tbody>${offenderRows}</tbody>
  </table>

  <p style="font-size:11px;color:#aaa;margin-top:32px">
    PetWash Finance Operations · Auto-generated · Do not reply
  </p>
</body>
</html>`;
}

async function sendExceptionEmail(): Promise<void> {
  if (!SENDGRID_API_KEY || !FINANCE_ALERT_EMAIL) {
    logger.warn('[ExceptionEmail] SENDGRID_API_KEY or FINANCE_ALERT_EMAIL not set — skipping');
    return;
  }
  try {
    const summary = await buildExceptionSummary();
    const asOf = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const html = buildHtml(summary, asOf);

    sgMail.setApiKey(SENDGRID_API_KEY);
    await sgMail.send({
      to: FINANCE_ALERT_EMAIL,
      from: 'noreply@petwash.co.il',
      subject: `PetWash Finance Exception Report — ${new Date().toISOString().split('T')[0]}`,
      html,
    });
    logger.info('[ExceptionEmail] Sent successfully', { to: FINANCE_ALERT_EMAIL, asOf });
  } catch (err: any) {
    logger.error('[ExceptionEmail] Failed to send', { error: err.message });
  }
}

export function startExceptionEmailJob(): void {
  if (!EXCEPTION_EMAIL_ENABLED) {
    logger.info('[ExceptionEmail] Disabled (EXCEPTION_EMAIL_ENABLED != true) — skipping');
    return;
  }
  // 06:00 UTC = 08:00 IL winter / 09:00 IL summer
  cron.schedule('0 6 * * *', () => {
    logger.info('[ExceptionEmail] Daily cron fired — sending exception report');
    sendExceptionEmail().catch((e) => logger.error('[ExceptionEmail] Unhandled error', { error: e?.message }));
  }, { timezone: 'UTC' });

  logger.info('[ExceptionEmail] Daily cron scheduled (06:00 UTC)');
}
