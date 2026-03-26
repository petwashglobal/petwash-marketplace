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

// ── 3.2C: Auto-escalate SLA-breached disputes ─────────────────────────────
async function autoEscalateSlaBreachedDisputes(): Promise<void> {
  try {
    const candidatesRaw: any = await db.execute(sql`
      SELECT case_ref, amount_disputed_cents, opened_at
      FROM dispute_cases
      WHERE status IN ('open', 'investigating')
        AND escalated_at IS NULL
        AND (
          (amount_disputed_cents >= 50000 AND opened_at < NOW() - INTERVAL '24 hours') OR
          (amount_disputed_cents <  50000 AND opened_at < NOW() - INTERVAL '72 hours')
        )
    `);
    const candidates: any[] = candidatesRaw?.rows ?? candidatesRaw ?? [];
    if (candidates.length === 0) return;

    for (const dc of candidates) {
      const slaLabel = Number(dc.amount_disputed_cents) >= 50000 ? '24h' : '72h';
      const now = new Date();
      await db.execute(sql`
        UPDATE dispute_cases
        SET status = 'escalated', escalated_at = ${now}, escalated_by = 'system',
            escalation_note = ${'Auto-escalated: SLA (' + slaLabel + ') exceeded'}, updated_at = ${now}
        WHERE case_ref = ${dc.case_ref} AND escalated_at IS NULL
      `);
      await db.execute(sql`
        INSERT INTO finance_alerts (alert_type, severity, entity_type, entity_id, detail)
        VALUES ('sla_breach_auto_escalated', 'critical', 'dispute_case', ${dc.case_ref},
                ${JSON.stringify({ caseRef: dc.case_ref, slaLabel, amountCents: dc.amount_disputed_cents })})
      `);
    }
    logger.info('[AutoEscalate] Escalated SLA-breached disputes', { count: candidates.length });
  } catch (err: any) {
    logger.error('[AutoEscalate] error', { error: err.message });
  }
}

// ── 3.3B: Daily alert digest ──────────────────────────────────────────────
async function sendDailyAlertDigest(): Promise<void> {
  try {
    if (!SENDGRID_API_KEY || !FINANCE_ALERT_EMAIL) return;
    sgMail.setApiKey(SENDGRID_API_KEY);

    // Alerts from the last 24 hours that are still unacknowledged
    const rawAlerts: any = await db.execute(sql`
      SELECT id, alert_type, severity, entity_type, entity_id, detail, created_at
      FROM finance_alerts
      WHERE acknowledged_at IS NULL
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY severity DESC, created_at DESC
    `);
    const alerts: any[] = rawAlerts?.rows ?? rawAlerts ?? [];
    if (alerts.length === 0) {
      logger.info('[AlertDigest] No unacknowledged alerts — skipping digest');
      return;
    }

    const grouped: Record<string, any[]> = {};
    for (const a of alerts) {
      const key = `${a.severity}:${a.alert_type}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    }

    const rows = Object.entries(grouped).map(([key, items]) => {
      const [severity, type] = key.split(':');
      return `<tr><td>${severity.toUpperCase()}</td><td>${type}</td><td>${items.length}</td></tr>`;
    }).join('');

    const html = `<h2>PetWash Finance — Daily Alert Digest</h2>
<p>${alerts.length} unacknowledged alert(s) from the last 24 hours:</p>
<table border="1" cellpadding="6" style="border-collapse:collapse;">
  <thead><tr><th>Severity</th><th>Type</th><th>Count</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p>Log in to the Admin Wallet Dashboard to acknowledge and action these alerts.</p>`;

    await sgMail.send({
      to: FINANCE_ALERT_EMAIL,
      from: FINANCE_ALERT_EMAIL,
      subject: `[PetWash Finance] Daily Alert Digest — ${todayIso()} — ${alerts.length} alert(s)`,
      html,
    });

    // Record delivery
    for (const a of alerts) {
      await db.execute(sql`
        INSERT INTO finance_alert_deliveries (alert_id, delivery_type, recipient_email, status)
        VALUES (${a.id ?? null}, 'digest', ${FINANCE_ALERT_EMAIL}, 'sent')
      `);
    }

    logger.info('[AlertDigest] Sent daily digest', { count: alerts.length });
  } catch (err: any) {
    logger.error('[AlertDigest] error', { error: err.message });
  }
}

// ── 3.3B: Escalation ladder (every 30 min) ───────────────────────────────
async function runEscalationLadder(): Promise<void> {
  try {
    // Escalation thresholds for unacknowledged critical alerts
    const LEVELS = [
      { level: 1, minMinutes: 30 },
      { level: 2, minMinutes: 120 },
      { level: 3, minMinutes: 360 },
    ];

    for (const { level, minMinutes } of LEVELS) {
      const candidatesRaw: any = await db.execute(sql`
        SELECT id, alert_type, entity_type, entity_id, created_at
        FROM finance_alerts
        WHERE severity = 'critical'
          AND acknowledged_at IS NULL
          AND (escalation_level IS NULL OR escalation_level < ${level})
          AND created_at <= NOW() - (${minMinutes} || ' minutes')::interval
      `);
      const candidates: any[] = candidatesRaw?.rows ?? candidatesRaw ?? [];
      if (candidates.length === 0) continue;

      for (const a of candidates) {
        // Update escalation level (idempotent — only move forward)
        await db.execute(sql`
          UPDATE finance_alerts SET escalation_level = ${level}, escalated_at = NOW()
          WHERE id = ${a.id} AND (escalation_level IS NULL OR escalation_level < ${level})
        `);

        // Record delivery
        await db.execute(sql`
          INSERT INTO finance_alert_deliveries (alert_id, delivery_type, recipient_email, status)
          VALUES (${a.id}, 'escalation', ${FINANCE_ALERT_EMAIL}, 'sent')
        `);

        // Send escalation email if configured
        if (SENDGRID_API_KEY && FINANCE_ALERT_EMAIL) {
          sgMail.setApiKey(SENDGRID_API_KEY);
          await sgMail.send({
            to: FINANCE_ALERT_EMAIL,
            from: FINANCE_ALERT_EMAIL,
            subject: `[PetWash Finance] CRITICAL Alert Escalation Level ${level} — ${a.alert_type}`,
            html: `<h2>Critical Finance Alert — Escalation Level ${level}</h2>
<p>Alert <strong>${a.alert_type}</strong> (entity: ${a.entity_type} / ${a.entity_id}) remains unacknowledged after ${minMinutes} minutes.</p>
<p>Please log in immediately to review and acknowledge this alert.</p>`,
          });
        }
      }
      logger.info('[EscalationLadder] Escalated alerts', { level, count: candidates.length });
    }
  } catch (err: any) {
    logger.error('[EscalationLadder] error', { error: err.message });
  }
}

// ── 3.5A: Score yesterday's forecast against actuals ─────────────────────────
async function scoreForecastAccuracyJob(): Promise<void> {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yd = yesterday.toISOString().slice(0, 10);

    const closeRaw: any = await db.execute(sql`
      SELECT * FROM finance_close_records WHERE close_date = ${yd} LIMIT 1
    `);
    const closeRecord = (closeRaw?.rows ?? closeRaw)?.[0];
    if (!closeRecord) { logger.info('[ForecastAccuracy] No close record for yesterday — skipping', { yd }); return; }

    const actualPayouts = Number(closeRecord.payout_total_cents  ?? 0);
    const actualRefunds = Number(closeRecord.refund_total_cents   ?? 0);
    const actualVat     = Number(closeRecord.vat_liability_cents  ?? 0);
    const actualNetNeed = actualPayouts + actualRefunds + actualVat;

    const snapRaw: any = await db.execute(sql`
      SELECT * FROM cash_forecast_snapshots WHERE generated_at < ${yd}::date ORDER BY generated_at DESC LIMIT 5
    `);
    const snaps: any[] = snapRaw?.rows ?? snapRaw ?? [];
    let scored = 0;

    for (const snap of snaps) {
      const fc = snap.forecast_json;
      if (!fc?.byDay) continue;
      const dayFc = fc.byDay.find((d: any) => d.date === yd);
      if (!dayFc) continue;
      const existing: any = await db.execute(sql`
        SELECT id FROM cash_forecast_accuracy WHERE target_date = ${yd} AND forecast_generated_at = ${snap.generated_at} LIMIT 1
      `);
      if ((existing?.rows ?? existing)?.[0]) continue;
      const forecastNet = dayFc.netCashNeedCents ?? 0;
      const absErr      = Math.abs(forecastNet - actualNetNeed);
      const pctErr      = actualNetNeed > 0 ? ((absErr / actualNetNeed) * 100) : 0;
      await db.execute(sql`
        INSERT INTO cash_forecast_accuracy
          (forecast_generated_at, horizon_days, target_date,
           forecast_payouts_cents, actual_payouts_cents,
           forecast_refunds_cents, actual_refunds_cents,
           forecast_vat_cents, actual_vat_cents,
           forecast_net_cash_need_cents, actual_net_cash_need_cents,
           abs_error_cents, pct_error)
        VALUES
          (${snap.generated_at}, ${fc.horizonDays ?? 14}, ${yd},
           ${dayFc.payoutsCents ?? 0}, ${actualPayouts},
           ${dayFc.refundsCents ?? 0}, ${actualRefunds},
           ${dayFc.vatCents    ?? 0}, ${actualVat},
           ${forecastNet}, ${actualNetNeed},
           ${absErr}, ${pctErr.toFixed(2)})
      `);
      scored++;
    }
    logger.info('[ForecastAccuracy] Scored', { yd, scored });
  } catch (err: any) {
    logger.error('[ForecastAccuracy] Job error', { error: err.message });
  }
}

// ── 3.5E: Weekly executive digest (Monday 08:00 IL) ──────────────────────────
const EXECUTIVE_DIGEST_ENABLED = process.env.EXECUTIVE_DIGEST_ENABLED === 'true';

async function sendExecutiveDigestJob(): Promise<void> {
  try {
    if (!EXECUTIVE_DIGEST_ENABLED) return;
    const now = new Date();
    const monday = new Date(now); monday.setDate(now.getDate() - now.getDay() + 1);
    const fromDate = monday.toISOString().slice(0, 10);
    const sun = new Date(monday); sun.setDate(sun.getDate() + 6);
    const toDate = sun.toISOString().slice(0, 10);

    // Idempotency
    const existRaw: any = await db.execute(sql`
      SELECT id FROM executive_digest_log WHERE period_start = ${fromDate} AND status = 'sent' LIMIT 1
    `);
    if ((existRaw?.rows ?? existRaw)?.[0]) { logger.info('[ExecDigest] Already sent this week', { fromDate }); return; }

    // Get recipients
    const rolesRaw: any = await db.execute(sql`
      SELECT DISTINCT ur.uid, u.email FROM finance_user_roles ur
      LEFT JOIN users u ON u.uid = ur.uid
      WHERE ur.role = 'finance_admin'
    `).catch(() => ({ rows: [] }));
    const recipients: string[] = (rolesRaw?.rows ?? rolesRaw ?? []).filter((r: any) => r.email).map((r: any) => r.email);
    const sentTo = recipients.join(',') || 'system';

    await db.execute(sql`
      INSERT INTO executive_digest_log (period_start, period_end, sent_to, status, summary_json)
      VALUES (${fromDate}, ${toDate}, ${sentTo}, 'sent', ${JSON.stringify({ auto: true, recipients })}::jsonb)
    `);

    // Send email if configured
    if (SENDGRID_API_KEY && recipients.length > 0) {
      sgMail.setApiKey(SENDGRID_API_KEY);
      await sgMail.send({
        to: recipients,
        from: process.env.SENDGRID_FROM_EMAIL ?? 'finance@petwash.co.il',
        subject: `[PetWash Finance] Executive Weekly Digest — ${fromDate} to ${toDate}`,
        html: `<h2>PetWash Finance — Executive Weekly Digest</h2><p>Week: <strong>${fromDate}</strong> to <strong>${toDate}</strong></p><p>Log in to the Admin Wallet Dashboard → Executive tab to view the full KPI snapshot.</p>`,
      }).catch((e: any) => logger.warn('[ExecDigest] Email send failed', { error: e.message }));
    }

    logger.info('[ExecDigest] Weekly digest sent', { fromDate, toDate, recipients: recipients.length });
  } catch (err: any) {
    logger.error('[ExecDigest] Job error', { error: err.message });
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

  // Auto-escalate SLA-breached disputes every hour
  cron.schedule('15 * * * *', autoEscalateSlaBreachedDisputes, { timezone: 'Asia/Jerusalem' });
  logger.info('[DailyCloseReminder] Auto-escalation job started (:15 every hour)');

  // 3.3B: Daily alert digest at 07:30 IL
  cron.schedule('30 7 * * *', sendDailyAlertDigest, { timezone: 'Asia/Jerusalem' });
  logger.info('[DailyCloseReminder] Daily alert digest job started (07:30 IL)');

  // 3.3B: Escalation ladder every 30 minutes
  cron.schedule('*/30 * * * *', runEscalationLadder, { timezone: 'Asia/Jerusalem' });
  logger.info('[DailyCloseReminder] Escalation ladder job started (every 30 min)');

  // 3.4B: Payout scheduling automation — check enabled schedules every 15 minutes
  cron.schedule('*/15 * * * *', runPayoutSchedules, { timezone: 'Asia/Jerusalem' });
  logger.info('[DailyCloseReminder] Payout schedule runner started (every 15 min)');

  // 3.5A: Score forecast accuracy daily at 02:00 IL (after close window)
  cron.schedule('0 2 * * *', scoreForecastAccuracyJob, { timezone: 'Asia/Jerusalem' });
  logger.info('[DailyCloseReminder] Forecast accuracy scorer started (02:00 IL daily)');

  // 3.5E: Weekly executive digest — Monday 08:00 IL
  cron.schedule('0 8 * * 1', sendExecutiveDigestJob, { timezone: 'Asia/Jerusalem' });
  logger.info('[DailyCloseReminder] Executive digest job started (Monday 08:00 IL)');
}

// ─── 3.4B: Payout schedule runner ─────────────────────────────────────────────
async function runPayoutSchedules(): Promise<void> {
  try {
    const schedulesRaw: any = await db.execute(sql`SELECT * FROM payout_schedules WHERE enabled = true`);
    const schedules = (schedulesRaw?.rows ?? schedulesRaw ?? []);
    const now = new Date();

    for (const s of schedules) {
      try {
        const eligible = isScheduleEligible(s, now);
        if (!eligible) continue;

        // Check if already ran recently (idempotency guard — within last hour for non-daily)
        const guardHours = s.cadence === 'daily' ? 20 : s.cadence === 'weekly' ? 160 : s.cadence === 'fortnightly' ? 336 : 700;
        const lastRun = s.last_run_at ? new Date(s.last_run_at) : null;
        if (lastRun && (now.getTime() - lastRun.getTime()) < guardHours * 3600 * 1000) continue;

        // Find eligible entries
        const divisionCondition = s.division_code ? sql` AND division_code = ${s.division_code}` : sql``;
        const entryRaw: any = await db.execute(sql`
          SELECT COALESCE(SUM(net_cents),0) AS net_total, COUNT(*)::int AS entry_count
          FROM provider_payout_entries WHERE status='earned'${divisionCondition}
        `);
        const netTotal   = Number((entryRaw?.rows ?? entryRaw)?.[0]?.net_total    ?? 0);
        const entryCount = Number((entryRaw?.rows ?? entryRaw)?.[0]?.entry_count  ?? 0);

        if (netTotal < (s.min_batch_net_cents || 0) || entryCount === 0) {
          await db.execute(sql`
            INSERT INTO payout_schedule_runs (schedule_id, result, summary)
            VALUES (${s.id}, 'skipped', ${JSON.stringify({ reason: 'Below threshold', netTotal, entryCount })}::jsonb)
          `);
          continue;
        }

        const batchId = `SCHED-${s.id}-${Date.now()}`;
        const batchNote = `Auto-created by schedule ${s.id} (${s.cadence})`;
        await db.execute(sql`
          INSERT INTO payout_batches (batch_id, status, gross_total_cents, commission_total_cents, net_total_cents, entry_count, created_by_uid, notes)
          SELECT ${batchId}, 'created',
            SUM(gross_cents), SUM(gross_cents - net_cents), SUM(net_cents), COUNT(*),
            'system', ${batchNote}
          FROM provider_payout_entries WHERE status='earned'${divisionCondition}
        `);
        await db.execute(sql`
          UPDATE provider_payout_entries SET status='batched', payout_batch_id=${batchId}
          WHERE status='earned'${divisionCondition}
        `);
        await db.execute(sql`UPDATE payout_schedules SET last_run_at = NOW() WHERE id = ${s.id}`);
        await db.execute(sql`
          INSERT INTO payout_schedule_runs (schedule_id, result, batch_id, summary)
          VALUES (${s.id}, 'created', ${batchId}, ${JSON.stringify({ netTotal, entryCount })}::jsonb)
        `);
        logger.info('[PayoutSchedule] Batch created', { scheduleId: s.id, batchId, netTotal, entryCount });
      } catch (err: any) {
        await db.execute(sql`
          INSERT INTO payout_schedule_runs (schedule_id, result, summary)
          VALUES (${s.id}, 'failed', ${JSON.stringify({ error: err.message })}::jsonb)
        `).catch(() => {});
        logger.error('[PayoutSchedule] Run failed', { scheduleId: s.id, error: err.message });
      }
    }
  } catch (err: any) {
    logger.error('[PayoutSchedule] Job error', { error: err.message });
  }
}

function isScheduleEligible(s: any, now: Date): boolean {
  const dow = now.getDay(); // 0=Sun
  const dom = now.getDate();
  if (s.cadence === 'daily') return true;
  if (s.cadence === 'weekly')      return s.day_of_week  != null ? dow === s.day_of_week  : dow === 0;
  if (s.cadence === 'fortnightly') return s.day_of_week  != null ? dow === s.day_of_week  : dow === 0;
  if (s.cadence === 'monthly')     return s.day_of_month != null ? dom === s.day_of_month : dom === 1;
  return false;
}
