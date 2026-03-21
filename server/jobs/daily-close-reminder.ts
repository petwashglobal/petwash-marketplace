/**
 * PetWash Finance — Daily Close Reminder
 *
 * Phase 3.0D: Sends email reminders if today's finance close is still open.
 * Checkpoints: 18:00, 20:00, 22:00 Asia/Jerusalem.
 * Stops immediately once the day is closed.
 * No duplicate reminders per checkpoint per date.
 *
 * Gate: DAILY_CLOSE_REMINDER_ENABLED=true
 */

import cron from 'node-cron';
import sgMail from '@sendgrid/mail';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

const SENDGRID_API_KEY    = process.env.SENDGRID_API_KEY    ?? '';
const FINANCE_ALERT_EMAIL = process.env.FINANCE_ALERT_EMAIL ?? '';
const ENABLED             = process.env.DAILY_CLOSE_REMINDER_ENABLED === 'true';

// In-memory: tracks which (date, checkpoint) pairs have been emailed this process run.
// Key: `${dateIso}:${checkpoint}` e.g. "2026-03-21:18"
const SENT = new Set<string>();

function nowJerusalem(): Date {
  // Build a date object representing current Israel time
  const s = new Intl.DateTimeFormat('en-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  // Returns something like "21/03/2026, 18:05" — parse it
  const [datePart, timePart] = s.split(', ');
  const [day, mon, yr] = datePart.split('/');
  const [hh, mm] = timePart.split(':');
  return new Date(`${yr}-${mon}-${day}T${hh}:${mm}:00`);
}

function todayIso(): string {
  const now = nowJerusalem();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function currentHourIl(): number {
  return nowJerusalem().getHours();
}

async function isTodayClosed(dateIso: string): Promise<boolean> {
  const row: any = await db.execute(sql`
    SELECT status FROM finance_close_records
    WHERE close_date = ${dateIso}::date AND status = 'closed'
    LIMIT 1
  `);
  return (row?.rows ?? row ?? []).length > 0;
}

async function buildChecklistCounts(): Promise<{
  anomalies: number;
  staleHolds: number;
  pendingDisputes: number;
  pendingApprovals: number;
}> {
  const now72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const [anomR, staleR, dispR, apprR] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM wallet_accounts
      WHERE cash_wallet_balance_cents < 0 OR pending_balance_cents < 0
    `),
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM wallet_ledger_entries
      WHERE entry_type='hold' AND reversed=false AND created_at < ${now72h}
    `),
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM dispute_cases WHERE status NOT IN ('resolved','dismissed')
    `),
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM refund_approvals WHERE status='pending'
    `),
  ]);

  const n = (r: any) => Number((r?.rows ?? r ?? [])[0]?.cnt ?? 0);
  return {
    anomalies:        n(anomR),
    staleHolds:       n(staleR),
    pendingDisputes:  n(dispR),
    pendingApprovals: n(apprR),
  };
}

async function sendReminder(dateIso: string, checkpoint: number, counts: Awaited<ReturnType<typeof buildChecklistCounts>>): Promise<void> {
  if (!SENDGRID_API_KEY || !FINANCE_ALERT_EMAIL) {
    logger.warn('[DailyCloseReminder] SENDGRID_API_KEY or FINANCE_ALERT_EMAIL not set — skipping email');
    return;
  }

  const blocked = [
    counts.anomalies       > 0 ? `${counts.anomalies} anomaly/anomalies`          : null,
    counts.staleHolds      > 0 ? `${counts.staleHolds} stale hold(s) >72h`        : null,
    counts.pendingDisputes > 0 ? `${counts.pendingDisputes} open dispute(s)`       : null,
    counts.pendingApprovals> 0 ? `${counts.pendingApprovals} pending approval(s)`  : null,
  ].filter(Boolean);

  const allClear = blocked.length === 0;
  const subject  = allClear
    ? `[PetWash Finance] Close Reminder — ${dateIso} — All clear, close now`
    : `[PetWash Finance] Close Reminder — ${dateIso} — ${blocked.length} blocker(s) remaining`;

  const html = `
<html><body style="font-family:monospace;font-size:13px;color:#111">
<h2 style="color:#1a1a2e">PetWash Finance — Daily Close Reminder</h2>
<p><strong>Date:</strong> ${dateIso}</p>
<p><strong>Time:</strong> ${checkpoint}:00 Israel</p>
<hr/>
<h3>Checklist Status</h3>
<table style="border-collapse:collapse;width:100%">
  <tr style="background:#f5f5f5"><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Gate</th><th style="padding:6px 10px;border:1px solid #ddd">Count</th><th style="padding:6px 10px;border:1px solid #ddd">Status</th></tr>
  ${[
    ['No open anomalies',        counts.anomalies],
    ['No stale holds (>72h)',    counts.staleHolds],
    ['No pending disputes',      counts.pendingDisputes],
    ['No pending approvals',     counts.pendingApprovals],
  ].map(([label, cnt]) => `
  <tr>
    <td style="padding:6px 10px;border:1px solid #ddd">${label}</td>
    <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${cnt}</td>
    <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;color:${cnt === 0 ? 'green' : 'red'}">${cnt === 0 ? '✓ Clear' : '✗ Blocked'}</td>
  </tr>`).join('')}
</table>
${allClear
  ? '<p style="color:green;font-weight:bold">✓ All gates clear. You can close today now.</p>'
  : `<p style="color:red;font-weight:bold">✗ ${blocked.length} blocker(s) must be resolved before close.</p><ul>${blocked.map(b => `<li>${b}</li>`).join('')}</ul>`}
<hr/>
<p style="color:#888;font-size:11px">This is an automated reminder from PetWash Finance. Sent at checkpoint ${checkpoint}:00 IL.</p>
</body></html>`;

  sgMail.setApiKey(SENDGRID_API_KEY);
  await sgMail.send({
    to:      FINANCE_ALERT_EMAIL,
    from:    process.env.SENDGRID_FROM_EMAIL ?? 'finance@petwash.co.il',
    subject,
    html,
  });

  logger.info('[DailyCloseReminder] Reminder sent', { dateIso, checkpoint, blocked });
}

async function checkAndSend(): Promise<void> {
  try {
    const dateIso = todayIso();
    const hour    = currentHourIl();

    // Reminder checkpoints: 18, 20, 22
    const CHECKPOINTS = [18, 20, 22];
    const checkpoint  = CHECKPOINTS.find(c => hour >= c && hour < c + 2);
    if (checkpoint === undefined) return; // Not a reminder window

    const sentKey = `${dateIso}:${checkpoint}`;
    if (SENT.has(sentKey)) return; // Already sent for this checkpoint today

    // Check if today is already closed
    const closed = await isTodayClosed(dateIso);
    if (closed) {
      // Day is closed — clear any pending sentKeys for today (reset for next day)
      for (const key of SENT) { if (key.startsWith(dateIso)) SENT.delete(key); }
      return;
    }

    // Build checklist and send
    const counts = await buildChecklistCounts();
    await sendReminder(dateIso, checkpoint, counts);
    SENT.add(sentKey);
  } catch (err: any) {
    logger.error('[DailyCloseReminder] error during check', { error: err.message });
  }
}

export function startDailyCloseReminder(): void {
  if (!ENABLED) {
    logger.info('[DailyCloseReminder] DAILY_CLOSE_REMINDER_ENABLED not set — job disabled');
    return;
  }

  // Run hourly, every day
  cron.schedule('0 * * * *', checkAndSend, { timezone: 'Asia/Jerusalem' });
  logger.info('[DailyCloseReminder] Hourly reminder job started (checkpoints: 18:00, 20:00, 22:00 IL)');
}
