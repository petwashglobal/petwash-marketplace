/**
 * /api/admin/brain — read-only aggregator for the CEO Operations Brain.
 *
 * Hard rules:
 *   - READ-ONLY. No POST / PATCH / DELETE on this router. Mutations stay
 *     on their respective domain routes (stations, payments, etc.).
 *   - DOES NOT touch K9000 runtime, Nayax flow, wallet logic, or Tranzila.
 *   - DOES NOT fabricate. Each section returns one of:
 *       { wired: true, ...real data }      — backed by real schema
 *       { wired: false, reason: string }   — surfaces gap in the UI
 *     Frontend renders "not wired yet" for any panel where wired === false.
 *   - All queries are bounded: LIMIT clauses on lists, time windows on sums.
 *
 * Gate: requireBrainAccess (super-admin email allowlist OR ceo|cfo|ops_lead role).
 *
 * Single endpoint:
 *   GET /api/admin/brain/summary
 *     → { stations, revenue, approvals, alerts, activity, agreements,
 *         generatedAt, gaps[] }
 *
 *  PR-2 will add per-section endpoints + the missing aggregations.
 */
import { Router, type Request, type Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from '../lib/logger';
import { requireBrainAccess } from '../middleware/requireBrainAccess';
import { sumitClient } from '../services/SumitClient';

const router = Router();

// All routes here are sensitive — gate every request.
router.use(requireBrainAccess);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ms = { hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000 };

function notWired(reason: string) {
  return { wired: false, reason };
}

async function safeQuery<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (err: any) {
    // Most likely cause: table doesn't exist or column was renamed since the
    // schema imported. Log it but don't 500 — the dashboard must still load.
    logger.warn(`[brain] ${label} failed: ${err?.message ?? err}`);
    return { ok: false, error: String(err?.message ?? err).slice(0, 200) };
  }
}

// ─── Stations panel ──────────────────────────────────────────────────────────
async function loadStations() {
  const result = await safeQuery(async () => {
    const rows = await db.execute(sql`
      SELECT
        s.id,
        s.station_code            AS "stationCode",
        s.station_name            AS "stationName",
        s.identity_number         AS "serialNumber",
        s.address,
        s.city,
        s.country_id              AS "countryId",
        s.latitude,
        s.longitude,
        s.operational_status      AS "operationalStatus",
        s.health_status           AS "healthStatus",
        s.last_heartbeat          AS "lastHeartbeat",
        s.total_washes_completed  AS "totalWashes",
        s.nayax_terminal_id       AS "nayaxTerminalId"
      FROM pet_wash_stations s
      ORDER BY s.last_heartbeat DESC NULLS LAST
      LIMIT 200
    `);

    const rowsArr = (result as any).rows as any[];
    const now = Date.now();
    return rowsArr.map(r => {
      const hb = r.lastHeartbeat ? new Date(r.lastHeartbeat).getTime() : null;
      const minutesSinceHeartbeat = hb ? Math.round((now - hb) / 60_000) : null;
      // Health derives from BOTH heartbeat freshness and DB-stored status.
      // We don't override DB status — just surface staleness.
      const heartbeatStale = hb !== null && minutesSinceHeartbeat! > 15;
      return { ...r, minutesSinceHeartbeat, heartbeatStale };
    });
  }, 'loadStations');

  if (!result.ok) {
    return notWired('pet_wash_stations table not reachable');
  }
  return {
    wired: true,
    total: result.value.length,
    online: result.value.filter(s => s.operationalStatus === 'active' && !s.heartbeatStale).length,
    offline: result.value.filter(s => s.operationalStatus !== 'active' || s.heartbeatStale).length,
    stations: result.value,
  };
}

// ─── Revenue panel ───────────────────────────────────────────────────────────
async function loadRevenue() {
  const result = await safeQuery(async () => {
    const since24h = new Date(Date.now() - ms.day);
    const since7d = new Date(Date.now() - ms.week);
    const since30d = new Date(Date.now() - ms.month);

    // pwPayments stores integer cents. Sum gross (customer paid) and net (PetWash kept).
    // Filter to terminal states only — exclude CREATED/AUTHORISED so pending charges
    // don't inflate the number.
    const TERMINAL = sql`status IN ('CAPTURED', 'SETTLED', 'captured', 'settled')`;

    const rows = await db.execute(sql`
      SELECT
        SUM(CASE WHEN created_at >= ${since24h} THEN gross_cents ELSE 0 END)     AS "grossCents24h",
        SUM(CASE WHEN created_at >= ${since24h} THEN net_revenue_cents ELSE 0 END) AS "netCents24h",
        SUM(CASE WHEN created_at >= ${since7d}  THEN gross_cents ELSE 0 END)     AS "grossCents7d",
        SUM(CASE WHEN created_at >= ${since7d}  THEN net_revenue_cents ELSE 0 END) AS "netCents7d",
        SUM(CASE WHEN created_at >= ${since30d} THEN gross_cents ELSE 0 END)     AS "grossCents30d",
        SUM(CASE WHEN created_at >= ${since30d} THEN net_revenue_cents ELSE 0 END) AS "netCents30d",
        COUNT(*) FILTER (WHERE created_at >= ${since24h})                        AS "txCount24h",
        COUNT(*) FILTER (WHERE created_at >= ${since7d})                         AS "txCount7d"
      FROM pw_payments
      WHERE ${TERMINAL}
    `);

    // Vertical split (k9000 vs marketplace) — last 30d.
    const byVertical = await db.execute(sql`
      SELECT
        vertical,
        SUM(gross_cents) AS "grossCents",
        SUM(net_revenue_cents) AS "netCents",
        COUNT(*) AS "txCount"
      FROM pw_payments
      WHERE ${TERMINAL} AND created_at >= ${since30d}
      GROUP BY vertical
      ORDER BY SUM(gross_cents) DESC
    `);

    return {
      totals: ((rows as any).rows[0] ?? {}),
      byVertical: (byVertical as any).rows,
    };
  }, 'loadRevenue');

  if (!result.ok) {
    return notWired('pw_payments table not reachable');
  }
  return { wired: true, ...result.value };
}

// ─── Approvals queue ─────────────────────────────────────────────────────────
async function loadApprovals() {
  const result = await safeQuery(async () => {
    const rows = await db.execute(sql`
      SELECT
        application_id     AS "applicationId",
        first_name         AS "firstName",
        last_name          AS "lastName",
        email,
        provider_type      AS "providerType",
        city,
        biometric_status   AS "biometricStatus",
        background_check_status AS "backgroundCheckStatus",
        criminal_check_status   AS "criminalCheckStatus",
        self_declaration_at     AS "selfDeclarationAt",
        requires_enhanced_verification AS "requiresEnhancedVerification",
        created_at         AS "createdAt"
      FROM provider_applications
      WHERE COALESCE(status, 'pending') NOT IN ('approved', 'rejected', 'withdrawn')
      ORDER BY created_at ASC
      LIMIT 50
    `);
    return (rows as any).rows;
  }, 'loadApprovals');

  if (!result.ok) {
    return notWired('provider_applications table not reachable');
  }
  return { wired: true, total: result.value.length, applications: result.value };
}

// ─── Alerts panel ────────────────────────────────────────────────────────────
async function loadAlerts() {
  const result = await safeQuery(async () => {
    const rows = await db.execute(sql`
      SELECT
        a.id,
        a.station_id    AS "stationId",
        a.alert_type    AS "alertType",
        a.severity,
        a.status,
        a.title,
        a.message       AS "message",
        a.triggered_at  AS "triggeredAt",
        a.created_at    AS "createdAt"
      FROM station_alerts a
      WHERE a.status IN ('open', 'acknowledged')
      ORDER BY
        CASE a.severity
          WHEN 'critical' THEN 0
          WHEN 'warning'  THEN 1
          ELSE 2
        END,
        a.triggered_at DESC
      LIMIT 50
    `);
    return (rows as any).rows;
  }, 'loadAlerts');

  if (!result.ok) {
    return notWired('station_alerts table not reachable');
  }
  return { wired: true, total: result.value.length, alerts: result.value };
}

// ─── System faults (live runtime errors captured by faultReporter) ────────────
// Reads the canonical admin_alerts table for category='system' faults written by
// server/lib/faultReporter.ts (5xx handler + client /api/errors/log). Surfaces
// the "line of fault" + first-seen→last-seen so the CEO SEES live crashes in the
// Octopus Control Tower instead of them being buried in Cloud Run logs. Read-only.
async function loadSystemFaults() {
  const result = await safeQuery(async () => {
    const rows = await db.execute(sql`
      SELECT
        a.id,
        a.severity,
        a.status,
        a.title,
        a.message,
        a.source,
        a.metadata ->> 'faultLine'  AS "faultLine",
        a.created_at  AS "firstSeenAt",
        a.updated_at  AS "lastSeenAt"
      FROM admin_alerts a
      WHERE a.category = 'system'
        AND a.status IN ('open', 'acknowledged')
      ORDER BY
        CASE a.severity
          WHEN 'critical' THEN 0
          WHEN 'warning'  THEN 1
          ELSE 2
        END,
        a.updated_at DESC
      LIMIT 50
    `);
    return (rows as any).rows;
  }, 'loadSystemFaults');

  if (!result.ok) {
    return notWired('admin_alerts table not reachable');
  }
  return { wired: true, total: result.value.length, faults: result.value };
}

// ─── Activity feed (recent payments + recent applications, merged) ────────────
async function loadActivity() {
  const since = new Date(Date.now() - ms.day);

  const payments = await safeQuery(async () => {
    const rows = await db.execute(sql`
      SELECT
        payment_id     AS "id",
        vertical,
        gross_cents    AS "grossCents",
        status         AS "status",
        created_at     AS "at"
      FROM pw_payments
      WHERE created_at >= ${since}
      ORDER BY created_at DESC
      LIMIT 25
    `);
    return ((rows as any).rows as any[]).map(r => ({
      kind: 'payment',
      id: r.id,
      label: `${r.vertical} · ${r.status}`,
      amountCents: r.grossCents,
      at: r.at,
    }));
  }, 'activity:payments');

  const apps = await safeQuery(async () => {
    const rows = await db.execute(sql`
      SELECT
        application_id AS "id",
        provider_type  AS "providerType",
        first_name     AS "firstName",
        last_name      AS "lastName",
        created_at     AS "at"
      FROM provider_applications
      WHERE created_at >= ${since}
      ORDER BY created_at DESC
      LIMIT 25
    `);
    return ((rows as any).rows as any[]).map(r => ({
      kind: 'application',
      id: r.id,
      label: `${r.providerType} · ${r.firstName} ${r.lastName}`,
      amountCents: null,
      at: r.at,
    }));
  }, 'activity:applications');

  if (!payments.ok && !apps.ok) {
    return notWired('no activity sources reachable');
  }

  const merged = [
    ...(payments.ok ? payments.value : []),
    ...(apps.ok ? apps.value : []),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 50);

  return {
    wired: true,
    sources: {
      payments: payments.ok ? payments.value.length : 0,
      applications: apps.ok ? apps.value.length : 0,
    },
    events: merged,
  };
}

// ─── Agreements ledger ───────────────────────────────────────────────────────
// Surfaces signed_documents (timestamp + signer) — but the gap (IP, hash chain)
// is called out explicitly in the response so the UI can warn.
async function loadAgreements() {
  const result = await safeQuery(async () => {
    const rows = await db.execute(sql`
      SELECT
        id,
        document_type    AS "documentType",
        document_title   AS "documentTitle",
        signed_by        AS "signedBy",
        signed_date      AS "signedAt",
        document_hash    AS "documentHash",
        previous_document_hash AS "previousDocumentHash",
        status
      FROM signed_documents
      ORDER BY signed_date DESC NULLS LAST
      LIMIT 50
    `);
    return (rows as any).rows;
  }, 'loadAgreements');

  if (!result.ok) {
    return notWired('signed_documents table not reachable');
  }

  // Provider self-declaration is stored separately on provider_applications.
  // Read it for the same view (immutable: timestamp + IP captured at signing).
  const decls = await safeQuery(async () => {
    const rows = await db.execute(sql`
      SELECT
        application_id   AS "applicationId",
        user_id          AS "userId",
        self_declaration_at AS "signedAt",
        self_declaration_ip AS "ip"
      FROM provider_applications
      WHERE self_declaration_at IS NOT NULL
      ORDER BY self_declaration_at DESC
      LIMIT 50
    `);
    return (rows as any).rows;
  }, 'loadAgreements:declarations');

  return {
    wired: true,
    documents: result.value,
    providerDeclarations: decls.ok ? decls.value : [],
    notes: [
      'signed_documents: document_hash + previous_document_hash form a chain.',
      'Provider self-declarations capture timestamp + IP at signing.',
      'PR-2 will surface chain verification status (validated vs broken vs missing).',
    ],
  };
}

// ─── Payments panel — SUMIT + UPay clearing + Nayax online (the money arm) ────
// Octopus "arm" for the charging + fiscal-invoice rail. Reports whether money
// can actually move, WITHOUT ever returning a secret value (presence booleans
// only) and WITHOUT moving any money. When SUMIT creds are present it runs the
// SAFE getvatrate auth probe (authenticates; issues no document, charges
// nothing). UPay is SUMIT's built-in clearing/acquirer — enabled on the SUMIT
// account, not a separate API — so its readiness == SUMIT wired.
async function loadPayments() {
  const enabled = process.env.SUMIT_ENABLED === 'true';
  const companyId = (process.env.SUMIT_COMPANY_ID || '').trim();
  // A real SUMIT company id is numeric; guard against a pasted instruction blob.
  const companyIdConfigured = /^\d{3,}$/.test(companyId);
  const apiKeyConfigured = Boolean(process.env.SUMIT_API_KEY);
  const webhookSecretConfigured = Boolean(process.env.SUMIT_WEBHOOK_SECRET);
  const sandbox = process.env.SUMIT_SANDBOX !== 'false';
  const wired = sumitClient.isWired();

  const blockers: string[] = [];
  if (!enabled) blockers.push('SUMIT_ENABLED is not "true"');
  if (!companyIdConfigured) blockers.push('SUMIT_COMPANY_ID missing or not a clean numeric id');
  if (!apiKeyConfigured) blockers.push('SUMIT_API_KEY missing');
  if (!webhookSecretConfigured) blockers.push('SUMIT_WEBHOOK_SECRET missing');

  // Nayax online card rail (sibling of the SUMIT/UPay redirect rail).
  const nayaxKey = (process.env.NAYAX_API_KEY || '').toLowerCase();
  const nayaxLive = Boolean(nayaxKey) && !nayaxKey.includes('placeholder');
  if (!nayaxLive) blockers.push('NAYAX_API_KEY missing/placeholder → online card rail in DEMO_MODE');

  // Safe live auth probe — only when SUMIT creds present (else it's pointless).
  let liveProbe: { ran: boolean; ok?: boolean; reachable?: boolean; authRejected?: boolean; reason?: string } =
    { ran: false, reason: 'SUMIT creds not configured — probe skipped' };
  if (companyIdConfigured && apiKeyConfigured) {
    const probe = await safeQuery(() => sumitClient.connectionTest(), 'sumitConnectionTest');
    liveProbe = probe.ok
      ? { ran: true, ok: probe.value.ok, reachable: probe.value.reachable, authRejected: probe.value.authRejected, reason: probe.value.reason }
      : { ran: true, ok: false, reason: probe.error };
  }

  const ready = wired && liveProbe.ok === true && nayaxLive;

  return {
    wired: true,   // the ARM is live — it reports real config + probe state
    ready,         // can the money rail actually charge a card end-to-end?
    sumit: {
      enabled, companyIdConfigured, apiKeyConfigured, webhookSecretConfigured, wired, sandbox,
      chargeEndpoint: '/billing/payments/beginredirect/',
      recurringEndpoint: '/billing/recurring/charge/',
      docEndpoint: '/accounting/documents/create/',
    },
    upay: {
      role: 'SUMIT built-in clearing / acquirer (סליקה) — enabled on the SUMIT account, no separate API',
      clearingReady: wired,
    },
    nayaxOnline: { live: nayaxLive, mode: nayaxLive ? 'live' : 'DEMO_MODE (placeholder key)' },
    itaConnection: 'SUMIT ↔ רשות המסים active (verified 2026-07-03)',
    liveProbe,
    blockers,
    note: 'Secrets never returned — presence booleans only. Probe (getvatrate) moves no money and issues no document.',
  };
}

// ─── Integrations panel — the platform's HANDS (Sheets/Drive/email/jobs) ─────
// The 2026-07-05 360 audit found these pipelines run fail-soft but BLIND: the
// Sheets ops-log has a retry queue nobody watches, tax-doc Drive archival is
// visible only in raw pw_tax_documents, the async Google job queue has no
// dashboard, and the EmailSpendGuard circuit state lives in memory. This arm
// surfaces data that ALREADY EXISTS — read-only, no new pipelines.
async function loadIntegrations() {
  const [sheets, asyncJobs, taxArchive] = await Promise.all([
    safeQuery(async () => {
      const { getReconciliationReport } = await import('../services/googleSheetsIntegration');
      return getReconciliationReport();
    }, 'sheetsReconciliation'),
    safeQuery(async () => {
      const rows = await db.execute(sql`
        SELECT status, COUNT(*)::int AS cnt, MIN(created_at) AS oldest
        FROM pw_async_jobs
        WHERE status IN ('PENDING', 'PROCESSING', 'FAILED')
        GROUP BY status
      `);
      const byStatus: Record<string, { count: number; oldest: string | null }> = {};
      for (const r of rows.rows as any[]) {
        byStatus[String(r.status)] = { count: Number(r.cnt), oldest: r.oldest ? String(r.oldest) : null };
      }
      return byStatus;
    }, 'asyncJobs'),
    safeQuery(async () => {
      const rows = await db.execute(sql`
        SELECT archive_status, COUNT(*)::int AS cnt
        FROM pw_tax_documents
        GROUP BY archive_status
      `);
      const byStatus: Record<string, number> = {};
      for (const r of rows.rows as any[]) byStatus[String(r.archive_status)] = Number(r.cnt);
      return byStatus;
    }, 'taxArchive'),
  ]);

  let emailGuard: any = null;
  try {
    const { emailSpendGuard } = await import('../services/EmailSpendGuard');
    emailGuard = emailSpendGuard.snapshot();
  } catch (err: any) {
    emailGuard = { error: String(err?.message ?? err).slice(0, 120) };
  }

  // "attention" = anything an operator should look at NOW.
  const attention: string[] = [];
  if (sheets.ok && sheets.value.failed > 0) attention.push(`${sheets.value.failed} Sheets ops-log writes failed permanently`);
  if (sheets.ok && sheets.value.pending > 20) attention.push(`${sheets.value.pending} Sheets writes stuck pending`);
  const failedJobs = asyncJobs.ok ? (asyncJobs.value['FAILED']?.count ?? 0) : 0;
  if (failedJobs > 0) attention.push(`${failedJobs} async Google jobs FAILED (Drive archival / Sheets export / SUMIT sync)`);
  if (taxArchive.ok && (taxArchive.value['FAILED'] ?? 0) > 0) attention.push(`${taxArchive.value['FAILED']} tax documents failed Drive archival (7-year ITA retention)`);
  if (emailGuard?.circuitOpen) attention.push('Email spend-guard circuit OPEN — outbound email is being rejected');

  // This tsc config does not narrow safeQuery's union in a ternary (same
  // baseline quirk as loadPayments' probe.error) — read the message explicitly.
  const errMsg = (r: { ok: boolean }): string => (r as { error?: string }).error ?? 'unknown';

  return {
    wired: true,
    sheets: sheets.ok ? sheets.value : { error: errMsg(sheets) },
    asyncJobs: asyncJobs.ok ? asyncJobs.value : { error: errMsg(asyncJobs) },
    taxArchive: taxArchive.ok ? taxArchive.value : { error: errMsg(taxArchive) },
    emailGuard,
    attention,
    note: 'Read-only view of pipelines that already exist (Sheets retry queue, pw_async_jobs, pw_tax_documents.archive_status, EmailSpendGuard). No new pipelines, no secrets.',
  };
}

// ─── GET /api/admin/brain/summary ────────────────────────────────────────────
router.get('/summary', async (_req: Request, res: Response) => {
  const [stations, revenue, approvals, alerts, systemFaults, activity, agreements, payments, integrations] = await Promise.all([
    loadStations(),
    loadRevenue(),
    loadApprovals(),
    loadAlerts(),
    loadSystemFaults(),
    loadActivity(),
    loadAgreements(),
    loadPayments(),
    loadIntegrations(),
  ]);

  const gaps: string[] = [];
  if (!('wired' in stations) || stations.wired === false) gaps.push('stations');
  if (!('wired' in revenue) || revenue.wired === false) gaps.push('revenue');
  if (!('wired' in approvals) || approvals.wired === false) gaps.push('approvals');
  if (!('wired' in alerts) || alerts.wired === false) gaps.push('alerts');
  if (!('wired' in systemFaults) || systemFaults.wired === false) gaps.push('systemFaults');
  if (!('wired' in activity) || activity.wired === false) gaps.push('activity');
  if (!('wired' in agreements) || agreements.wired === false) gaps.push('agreements');
  // Payments arm is "wired" as a monitor, but flag it as a gap when the money
  // rail can't actually charge (so the brain shows red until SUMIT/UPay is live).
  if (!('ready' in payments) || payments.ready !== true) gaps.push('payments');
  // Integrations arm: gap when any pipeline needs operator attention NOW.
  if (Array.isArray((integrations as any).attention) && (integrations as any).attention.length > 0) gaps.push('integrations');

  res.json({
    generatedAt: new Date().toISOString(),
    gaps,
    stations,
    revenue,
    approvals,
    alerts,
    systemFaults,
    activity,
    agreements,
    payments,
    integrations,
  });
});

// ─── GET /api/admin/brain/stations/unmapped ─────────────────────────────────
// PR-5 ops visibility: lists kiosk_machines rows that have NO matching
// pet_wash_stations row (bridged via nayax_terminal_id). When a kiosk is in
// this list, station_alerts written for it are dropped by the
// stationAlertWriter helper — ops needs to backfill the enterprise registry
// before alerts can flow.
//
// Read-only. No FK change, no schema migration. Returns at most 200 rows.
router.get('/stations/unmapped', async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        k.kiosk_id           AS "kioskId",
        k.name               AS "name",
        k.location           AS "location",
        k.nayax_terminal_id  AS "nayaxTerminalId",
        k.status             AS "status",
        k.is_online          AS "isOnline",
        k.last_heartbeat     AS "lastHeartbeat"
      FROM kiosk_machines k
      WHERE k.nayax_terminal_id IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM pet_wash_stations s
           WHERE s.nayax_terminal_id = k.nayax_terminal_id
         )
      ORDER BY k.last_heartbeat DESC NULLS LAST
      LIMIT 200
    `);

    const rows = ((result as any).rows as any[]) ?? [];

    res.json({
      total: rows.length,
      kiosks: rows.map(r => ({
        ...r,
        bridgeReason: !r.nayaxTerminalId
          ? 'no_terminal_id'
          : 'no_pet_wash_stations_row',
      })),
      notes: [
        'Each kiosk in this list cannot receive alerts via the current bridge.',
        'Fix: insert a pet_wash_stations row with the same nayax_terminal_id ' +
          'as the kiosk, OR populate kiosk_machines.nayax_terminal_id if it is null.',
        'After backfill, alerts from station-heartbeat-monitor + nayax-events ' +
          'will start landing in station_alerts.',
      ],
    });
  } catch (err: any) {
    logger.error('[Brain] stations/unmapped failed', { error: err?.message ?? String(err) });
    res.status(500).json({ error: 'UNMAPPED_QUERY_FAILED', message: String(err?.message ?? err).slice(0, 200) });
  }
});

export default router;
