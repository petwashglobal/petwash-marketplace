/**
 * AlertEngine — the brain behind the unified Admin Alerts Center ("מרכז התראות").
 *
 * Responsibilities:
 *   • createOrUpdateAlert()  — idempotent upsert keyed by dedupeKey. At most ONE
 *       non-terminal alert per condition (enforced by the partial unique index in
 *       migration 0062). A recurring sweep therefore never spams duplicates, and an
 *       already-acknowledged/snoozed alert keeps its status on re-detection.
 *   • resolveClearedByPrefix() — auto-resolves alerts whose underlying condition is
 *       gone (the dedupeKey is no longer in the current offending set). Only touches
 *       auto-created alerts, never manual ones.
 *   • runAlertSweep() — scans the detection points the council mapped and reconciles
 *       the alert table to reality. Each detector is independently try/caught so one
 *       bad query can never sink the whole sweep.
 *
 * Detectors are pure read queries + upserts (no side effects on business data).
 * Adding a detector = add one async function and call it from runAlertSweep().
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../lib/logger";
import type { AlertCategory, AlertSeverity } from "@shared/schema-admin-alerts";

export interface CreateAlertInput {
  dedupeKey: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  source?: string;            // defaults 'auto_sweep'
  dueAt?: Date | null;
  metadata?: Record<string, unknown>;
}

/**
 * Idempotent upsert. Matches the partial unique index
 * (dedupe_key WHERE status NOT IN ('resolved','dismissed')) so concurrent sweeps
 * are race-safe. On conflict we refresh severity/title/message/metadata but
 * PRESERVE status, assignment and acknowledgement — re-detecting a condition must
 * not silently re-open an alert an admin already acted on.
 */
export async function createOrUpdateAlert(input: CreateAlertInput): Promise<void> {
  const meta = JSON.stringify(input.metadata ?? {});
  try {
    await db.execute(sql`
      INSERT INTO admin_alerts
        (dedupe_key, category, severity, status, title, message,
         linked_entity_type, linked_entity_id, source, due_at, metadata)
      VALUES
        (${input.dedupeKey}, ${input.category}, ${input.severity}, 'open',
         ${input.title}, ${input.message}, ${input.linkedEntityType ?? null},
         ${input.linkedEntityId ?? null}, ${input.source ?? "auto_sweep"},
         ${input.dueAt ?? null}, ${meta}::jsonb)
      ON CONFLICT (dedupe_key) WHERE status NOT IN ('resolved','dismissed')
      DO UPDATE SET
        severity   = EXCLUDED.severity,
        title      = EXCLUDED.title,
        message    = EXCLUDED.message,
        metadata   = EXCLUDED.metadata,
        updated_at = NOW()
    `);
  } catch (e) {
    logger.error("[AlertEngine] createOrUpdateAlert failed", {
      dedupeKey: input.dedupeKey, error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Auto-resolve alerts under a dedupeKey prefix whose condition has cleared.
 * `currentKeys` = dedupeKeys still offending this sweep. Anything matching the
 * prefix but NOT in currentKeys is resolved. Only auto-created alerts are touched.
 * Returns the number resolved.
 */
export async function resolveClearedByPrefix(prefix: string, currentKeys: string[]): Promise<number> {
  try {
    // Postgres `<> ALL(empty)` is TRUE → when nothing offends, all auto alerts
    // under the prefix resolve. We pass a text[] built from the current keys.
    const keysArray = sql`ARRAY[${sql.join(currentKeys.map((k) => sql`${k}`), sql`, `)}]::text[]`;
    const res: any = await db.execute(sql`
      UPDATE admin_alerts
      SET status = 'resolved', resolved_at = NOW(), resolved_by = 'system',
          resolution_note = 'condition cleared (auto)', source = 'auto_resolved', updated_at = NOW()
      WHERE source IN ('auto_sweep', 'auto_resolved')
        AND status NOT IN ('resolved', 'dismissed')
        AND dedupe_key LIKE ${prefix + "%"}
        AND ${currentKeys.length === 0 ? sql`TRUE` : sql`dedupe_key <> ALL(${keysArray})`}
    `);
    return Number(res?.rowCount ?? res?.rows?.length ?? 0);
  } catch (e) {
    logger.error("[AlertEngine] resolveClearedByPrefix failed", {
      prefix, error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}

function rowsOf(res: any): any[] {
  return res?.rows ?? res ?? [];
}

// ─── Detectors ────────────────────────────────────────────────────────────────

/** Payment captured/settled but never activated (no invoice + no settlement). */
async function detectPaidNotActivated(): Promise<{ created: number; resolved: number }> {
  const PREFIX = "paid_not_activated:";
  const res = await db.execute(sql`
    SELECT payment_id, gross_cents, vertical, transaction_type, created_at
    FROM pw_payments
    WHERE status IN ('captured','settled') AND invoice_id IS NULL AND settled_at IS NULL
    ORDER BY created_at ASC
    LIMIT 500
  `);
  const rows = rowsOf(res);
  const keys: string[] = [];
  for (const r of rows) {
    const key = `${PREFIX}${r.payment_id}`;
    keys.push(key);
    const ageMs = Date.now() - new Date(r.created_at).getTime();
    const severity: AlertSeverity = ageMs > 1000 * 60 * 60 * 24 ? "critical" : "warning";
    const amount = (Number(r.gross_cents) / 100).toFixed(2);
    await createOrUpdateAlert({
      dedupeKey: key, category: "payment", severity,
      title: "תשלום שולם אך לא הופעל",
      message: `תשלום ${r.payment_id} (${amount} ₪, ${r.vertical}) נגבה אך לא הופעל/לא הופקה חשבונית.`,
      linkedEntityType: "payment", linkedEntityId: String(r.payment_id),
      metadata: { vertical: r.vertical, transactionType: r.transaction_type, grossCents: Number(r.gross_cents) },
    });
  }
  const resolved = await resolveClearedByPrefix(PREFIX, keys);
  return { created: keys.length, resolved };
}

/** Bay in fault or offline state. */
async function detectBayStatus(): Promise<{ created: number; resolved: number }> {
  const PREFIX = "bay_status:";
  const res = await db.execute(sql`
    SELECT id, station_code, side, status, last_fault_code
    FROM station_bays
    WHERE status IN ('fault','offline')
  `);
  const rows = rowsOf(res);
  const keys: string[] = [];
  for (const r of rows) {
    const key = `${PREFIX}${r.id}`;
    keys.push(key);
    const isFault = r.status === "fault";
    const sideHe = r.side === "left" ? "שמאל" : r.side === "right" ? "ימין" : r.side;
    await createOrUpdateAlert({
      dedupeKey: key, category: "bay",
      severity: isFault ? "critical" : "warning",
      title: isFault ? "תקלת תא" : "תא לא מקוון",
      message: `תא ${sideHe} בתחנה ${r.station_code ?? r.id} במצב ${r.status}${r.last_fault_code ? ` (קוד: ${r.last_fault_code})` : ""}.`,
      linkedEntityType: "bay", linkedEntityId: String(r.id),
      metadata: { stationCode: r.station_code, side: r.side, status: r.status, faultCode: r.last_fault_code },
    });
  }
  const resolved = await resolveClearedByPrefix(PREFIX, keys);
  return { created: keys.length, resolved };
}

/** Failed async jobs — SUMIT document issuance + email fallback. */
async function detectFailedAsyncJobs(): Promise<{ created: number; resolved: number }> {
  const PREFIX = "async_job_failed:";
  const res = await db.execute(sql`
    SELECT id, job_type, last_error
    FROM pw_async_jobs
    WHERE status = 'FAILED' AND (job_type LIKE 'SUMIT%' OR job_type = 'SEND_GMAIL_FALLBACK')
    ORDER BY id DESC
    LIMIT 500
  `);
  const rows = rowsOf(res);
  const keys: string[] = [];
  for (const r of rows) {
    const key = `${PREFIX}${r.id}`;
    keys.push(key);
    const isSumit = String(r.job_type).startsWith("SUMIT");
    await createOrUpdateAlert({
      dedupeKey: key,
      category: isSumit ? "finance_doc" : "egift",
      severity: isSumit ? "critical" : "warning",
      title: isSumit ? "הפקת מסמך SUMIT נכשלה" : "שליחת אימייל נכשלה",
      message: `משימה ${r.job_type} (#${r.id}) נכשלה${r.last_error ? `: ${String(r.last_error).slice(0, 180)}` : ""}.`,
      linkedEntityType: "job", linkedEntityId: String(r.id),
      metadata: { jobType: r.job_type, lastError: r.last_error ? String(r.last_error).slice(0, 480) : null },
    });
  }
  const resolved = await resolveClearedByPrefix(PREFIX, keys);
  return { created: keys.length, resolved };
}

/** Spare part at/below its reorder point. */
async function detectLowStock(): Promise<{ created: number; resolved: number }> {
  const PREFIX = "stock_low:";
  const res = await db.execute(sql`
    SELECT id, part_name, part_number, quantity_in_stock, reorder_point
    FROM spare_parts
    WHERE quantity_in_stock <= reorder_point
    ORDER BY quantity_in_stock ASC
    LIMIT 500
  `);
  const rows = rowsOf(res);
  const keys: string[] = [];
  for (const r of rows) {
    const key = `${PREFIX}${r.id}`;
    keys.push(key);
    const qty = Number(r.quantity_in_stock);
    await createOrUpdateAlert({
      dedupeKey: key, category: "stock",
      severity: qty <= 0 ? "critical" : "warning",
      title: qty <= 0 ? "מלאי אזל" : "מלאי נמוך",
      message: `${r.part_name ?? r.part_number ?? r.id}: ${qty} במלאי (נקודת הזמנה ${r.reorder_point}).`,
      linkedEntityType: "item", linkedEntityId: String(r.id),
      metadata: { partNumber: r.part_number, quantityInStock: qty, reorderPoint: Number(r.reorder_point) },
    });
  }
  const resolved = await resolveClearedByPrefix(PREFIX, keys);
  return { created: keys.length, resolved };
}

/** Logistics/warehouse consumable (shampoo, conditioner, supplies, parts) at/below
 *  its reorder level. Complements detectLowStock (which only covers spare_parts) —
 *  this covers logistics_inventory, the real consumables the stations burn through.
 *  Only items with reorder_level > 0 trigger, so default-0 rows never spam.
 *  Idempotent via dedupe prefix; auto-resolves when restocked above the level. */
async function detectLowConsumables(): Promise<{ created: number; resolved: number }> {
  const PREFIX = "consumable_low:";
  const res = await db.execute(sql`
    SELECT id, sku, product_name, product_name_he, category, quantity, unit, reorder_level
    FROM logistics_inventory
    WHERE reorder_level > 0 AND quantity <= reorder_level
    ORDER BY quantity ASC
    LIMIT 500
  `);
  const rows = rowsOf(res);
  const keys: string[] = [];
  for (const r of rows) {
    const key = `${PREFIX}${r.id}`;
    keys.push(key);
    const qty = Number(r.quantity);
    const name = r.product_name_he || r.product_name || r.sku || r.id;
    const unit = r.unit || "יח'";
    await createOrUpdateAlert({
      dedupeKey: key, category: "stock",
      severity: qty <= 0 ? "critical" : "warning",
      title: qty <= 0 ? "מלאי אזל" : "מלאי נמוך",
      message: `${name}: ${qty} ${unit} במלאי (נקודת הזמנה ${r.reorder_level}).`,
      linkedEntityType: "item", linkedEntityId: String(r.id),
      metadata: { sku: r.sku, category: r.category, quantity: qty, reorderLevel: Number(r.reorder_level) },
    });
  }
  const resolved = await resolveClearedByPrefix(PREFIX, keys);
  return { created: keys.length, resolved };
}

/** Station offline / out of service. */
async function detectStationOffline(): Promise<{ created: number; resolved: number }> {
  const PREFIX = "station_offline:";
  const res = await db.execute(sql`
    SELECT id, name, status FROM stations
    WHERE status IN ('offline','out_of_service')
    LIMIT 500
  `);
  const rows = rowsOf(res);
  const keys: string[] = [];
  for (const r of rows) {
    const key = `${PREFIX}${r.id}`;
    keys.push(key);
    await createOrUpdateAlert({
      dedupeKey: key, category: "station",
      severity: "critical",
      title: "תחנה לא מקוונת",
      message: `תחנה ${r.name ?? r.id} במצב ${r.status}.`,
      linkedEntityType: "station", linkedEntityId: String(r.id),
      metadata: { status: r.status },
    });
  }
  const resolved = await resolveClearedByPrefix(PREFIX, keys);
  return { created: keys.length, resolved };
}

/** Provider 6-month reconfirmation overdue. */
async function detectReconfirmationOverdue(): Promise<{ created: number; resolved: number }> {
  const PREFIX = "reconfirmation_overdue:";
  const res = await db.execute(sql`
    SELECT id, provider_id, due_at FROM reconfirmation_records
    WHERE completed_at IS NULL AND status <> 'completed' AND due_at < NOW()
    LIMIT 500
  `);
  const rows = rowsOf(res);
  const keys: string[] = [];
  for (const r of rows) {
    const key = `${PREFIX}${r.id}`;
    keys.push(key);
    await createOrUpdateAlert({
      dedupeKey: key, category: "expiry",
      severity: "warning",
      title: "אישור מחדש של ספק חורג",
      message: `אישור מחדש (6 חודשים) לספק ${r.provider_id} עבר את מועד היעד.`,
      linkedEntityType: "provider", linkedEntityId: String(r.provider_id),
      metadata: { dueAt: r.due_at },
    });
  }
  const resolved = await resolveClearedByPrefix(PREFIX, keys);
  return { created: keys.length, resolved };
}

/**
 * Provider insurance expiring or expired. Israeli marketplace providers must carry
 * their own cover; a lapsed policy is a payout-gate + liability risk. Surfaces in
 * the admin Alerts Center so ops can chase a renewal. Only providers who actually
 * uploaded a policy (insurance_cert_url) and whose expiry is within 30 days (or
 * past) are flagged. The provider-facing renewal SMS/email is a separate piece —
 * this is the admin-side detector the sweep was missing.
 */
async function detectInsuranceExpiring(): Promise<{ created: number; resolved: number }> {
  const PREFIX = "insurance_expiring:";
  const res = await db.execute(sql`
    SELECT id, insurance_expires_at, insurance_expires_at < NOW() AS expired
    FROM provider_applications
    WHERE insurance_expires_at IS NOT NULL
      AND insurance_cert_url IS NOT NULL
      AND insurance_expires_at < NOW() + INTERVAL '30 days'
    LIMIT 500
  `);
  const rows = rowsOf(res);
  const keys: string[] = [];
  for (const r of rows) {
    const key = `${PREFIX}${r.id}`;
    keys.push(key);
    const expired = r.expired === true || r.expired === "t" || r.expired === 1;
    await createOrUpdateAlert({
      dedupeKey: key,
      category: "expiry",
      severity: expired ? "critical" : "warning",
      title: expired ? "ביטוח ספק פג" : "ביטוח ספק עומד לפוג",
      message: expired
        ? `הביטוח של ספק ${r.id} פג. יש לחסום תשלום ולבקש חידוש.`
        : `הביטוח של ספק ${r.id} עומד לפוג בקרוב (${r.insurance_expires_at}).`,
      linkedEntityType: "provider",
      linkedEntityId: String(r.id),
      metadata: { insuranceExpiresAt: r.insurance_expires_at, expired },
    });
  }
  const resolved = await resolveClearedByPrefix(PREFIX, keys);
  return { created: keys.length, resolved };
}

export interface SweepResult {
  ran: boolean;
  detectors: Record<string, { created: number; resolved: number } | { error: string }>;
  totalActive: number;
}

/** Runs every detector independently and reports per-detector outcomes. */
export async function runAlertSweep(): Promise<SweepResult> {
  const detectors: SweepResult["detectors"] = {};
  const run = async (name: string, fn: () => Promise<{ created: number; resolved: number }>) => {
    try {
      detectors[name] = await fn();
    } catch (e) {
      detectors[name] = { error: e instanceof Error ? e.message : String(e) };
      logger.error(`[AlertEngine] detector '${name}' failed`, { error: detectors[name] });
    }
  };

  await run("paidNotActivated", detectPaidNotActivated);
  await run("bayStatus", detectBayStatus);
  await run("failedAsyncJobs", detectFailedAsyncJobs);
  await run("lowStock", detectLowStock);
  await run("lowConsumables", detectLowConsumables);
  await run("stationOffline", detectStationOffline);
  await run("reconfirmationOverdue", detectReconfirmationOverdue);
  await run("insuranceExpiring", detectInsuranceExpiring);

  let totalActive = 0;
  try {
    const res: any = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM admin_alerts WHERE status NOT IN ('resolved','dismissed')
    `);
    totalActive = Number(rowsOf(res)[0]?.n ?? 0);
  } catch { /* non-fatal */ }

  logger.info("[AlertEngine] sweep complete", { detectors, totalActive });
  return { ran: true, detectors, totalActive };
}
