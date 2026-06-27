/**
 * AdminDailyBriefService — the "admin brain" morning brief (CEO Trend Bible §20 +
 * Booking Rescue §19). READ-ONLY aggregation of what is stuck / valuable / at-risk
 * today, plus an estimated recoverable ₪. Money-SAFE: it only SELECTs; it never
 * mutates a booking, lead, balance, or payout.
 *
 * Degrades gracefully — every query is wrapped, so the brief works BEFORE the
 * Deal Gate / Rescue migrations (0081/0082) are applied (missing table → that
 * section just reads 0) and gets richer once they are.
 */
import { pool } from "../db";
import { logger } from "../lib/logger";

async function safeRows(sql: string, params: any[] = []): Promise<any[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } catch (e: any) {
    // 42P01 = undefined_table (migration not applied yet) → treat as empty, no noise.
    if (e?.code !== "42P01") logger.warn("[DailyBrief] query failed", { error: e?.message });
    return [];
  }
}
const num = (v: any) => Number(v ?? 0) || 0;

export interface DailyBrief {
  generatedAt: string;
  wired: boolean;
  conversion: {
    activeLeads: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    recoverableCents: number;
    topLeads: Array<{ leadType: string; status: string; score: number; valueCents: number; city: string | null; lastEventType: string | null }>;
  };
  bookings: { acceptedUnpaid: number; paymentPending: number; cancelled24h: number };
  demand: { waitlistByPlatform: Record<string, number>; topCities: Array<{ city: string; count: number }> };
  pawFinder: { activeLostPosts: number; pendingReview: number };
  suggestedActions: string[];
  summary: string;
}

export async function buildDailyBrief(): Promise<DailyBrief> {
  // ── Conversion leads (Rescue) ──────────────────────────────────────────────
  const leadRows = await safeRows(
    `SELECT status, lead_type, score, value_estimate_cents, city, last_event_type
       FROM conversion_leads
      WHERE status NOT IN ('CONVERTED','LOST','CLOSED')`,
  );
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let recoverableCents = 0;
  for (const r of leadRows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byType[r.lead_type] = (byType[r.lead_type] || 0) + 1;
    // "Recoverable" = leads stuck at payment/decision stage carry estimated value.
    if (["PAYMENT_PENDING", "WAITING_PROVIDER", "WAITING_CUSTOMER", "REMINDER_SENT", "ACTIVE"].includes(r.status)) {
      recoverableCents += num(r.value_estimate_cents);
    }
  }
  const topLeads = [...leadRows]
    .sort((a, b) => num(b.score) - num(a.score))
    .slice(0, 10)
    .map(r => ({ leadType: r.lead_type, status: r.status, score: num(r.score), valueCents: num(r.value_estimate_cents), city: r.city ?? null, lastEventType: r.last_event_type ?? null }));

  // ── Bookings stuck (Deal Gate status events + live booking_requests) ────────
  const acceptedUnpaid = num((await safeRows(
    `SELECT COUNT(*)::int AS n FROM booking_requests
      WHERE status IN ('accepted') AND payment_held_at IS NULL`,
  ))[0]?.n);
  const paymentPending = num((await safeRows(
    `SELECT COUNT(*)::int AS n FROM booking_requests WHERE status = 'payment_pending'`,
  ))[0]?.n);
  const cancelled24h = num((await safeRows(
    `SELECT COUNT(*)::int AS n FROM booking_status_events
      WHERE new_status IN ('CANCELLED_BY_CUSTOMER','CANCELLED_BY_PROVIDER')
        AND created_at > NOW() - INTERVAL '24 hours'`,
  ))[0]?.n);

  // ── Demand (waitlist) ──────────────────────────────────────────────────────
  const wlPlatform = await safeRows(
    `SELECT platform_key, COUNT(*)::int AS n FROM waitlist_entries GROUP BY platform_key`,
  );
  const waitlistByPlatform: Record<string, number> = {};
  for (const r of wlPlatform) waitlistByPlatform[r.platform_key] = num(r.n);
  const topCities = (await safeRows(
    `SELECT city, COUNT(*)::int AS n FROM waitlist_entries
      WHERE city IS NOT NULL AND city <> '' GROUP BY city ORDER BY n DESC LIMIT 5`,
  )).map(r => ({ city: r.city, count: num(r.n) }));

  // ── Paw Finder (community) ─────────────────────────────────────────────────
  const activeLostPosts = num((await safeRows(
    `SELECT COUNT(*)::int AS n FROM paw_finder_posts WHERE status = 'published' AND post_type = 'lost'`,
  ))[0]?.n);
  const pendingReview = num((await safeRows(
    `SELECT COUNT(*)::int AS n FROM paw_finder_posts WHERE status = 'pending_review'`,
  ))[0]?.n);

  // ── Suggested actions (deterministic; AI = advisory layer later) ────────────
  const actions: string[] = [];
  if (acceptedUnpaid > 0) actions.push(`Chase ${acceptedUnpaid} accepted-but-unpaid booking(s) before they expire.`);
  if (paymentPending > 0) actions.push(`${paymentPending} booking(s) awaiting payment — send pay-now reminder.`);
  if ((byStatus["WAITING_PROVIDER"] || 0) > 0) actions.push(`${byStatus["WAITING_PROVIDER"]} customer(s) waiting on a provider — offer "contact more providers".`);
  if (pendingReview > 0) actions.push(`${pendingReview} Paw Finder post(s) need moderation approval.`);
  const topCity = topCities[0];
  if (topCity) actions.push(`Highest demand: ${topCity.city} (${topCity.count} waitlist signups) — consider supply/station there.`);
  if (recoverableCents > 0) actions.push(`Estimated recoverable value sitting in stuck leads: ₪${(recoverableCents / 100).toLocaleString("en-IL")}.`);
  if (actions.length === 0) actions.push("All clear — no stuck leads or pending actions detected.");

  const summary =
    `${leadRows.length} active lead(s); ${acceptedUnpaid} accepted-unpaid, ${paymentPending} awaiting payment; ` +
    `${activeLostPosts} active lost-pet alert(s); ` +
    `estimated recoverable ₪${(recoverableCents / 100).toLocaleString("en-IL")}.`;

  return {
    generatedAt: new Date().toISOString(),
    wired: true,
    conversion: { activeLeads: leadRows.length, byStatus, byType, recoverableCents, topLeads },
    bookings: { acceptedUnpaid, paymentPending, cancelled24h },
    demand: { waitlistByPlatform, topCities },
    pawFinder: { activeLostPosts, pendingReview },
    suggestedActions: actions,
    summary,
  };
}
