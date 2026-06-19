/**
 * Expansion & Marketing — READ-ONLY admin observability.
 *
 * Two CEO "Business OS" spec modules, both PURE SELECT over tables that
 * ALREADY exist. No schema, no money math, no runtime change.
 *
 *   GET /api/admin/location-scoring   — Franchise / location LEAD scoring (§9)
 *   GET /api/admin/marketing-campaigns — Local Marketing Engine tracking (§25)
 *
 * ── §9 Franchise / Location Scoring ──────────────────────────────────────────
 * Honesty (platform skill §2 — never fake data): there is currently NO
 * franchise-application / location-lead / site-scoring table in the schema.
 * `franchisees` holds SIGNED partners, not prospective sites being evaluated,
 * and `crm_leads` is the CUSTOMER (B2C) sales CRM, not a site pipeline.
 * Therefore this endpoint returns:
 *   - leads: []            (no leads are invented)
 *   - leadsTracked: false  + a clear note
 *   - model: {...}         the scoring FRAMEWORK from the spec (factor list,
 *                          weights, status pipeline) so the CEO sees the
 *                          methodology even before a leads table exists.
 *   - signedFranchisees: a real COUNT of existing franchisees (context only).
 *
 * ── §25 Local Marketing Engine ───────────────────────────────────────────────
 * Lists the REAL marketing surfaces that exist:
 *   - promotional_campaigns (+ campaign_redemptions) — the promo-code campaign
 *     engine. Sales attributed = SUM(discountApplied) + redemption COUNT, with
 *     first-time vs repeat customer split derived from redemption history.
 *   - coupons (+ coupon_redemptions) — the coupon engine, grouped by
 *     channelSource (sms / push / email / app_banner / qr / referral) = the
 *     "local marketing channel". Attribution = COUNT + SUM over coupon_redemptions.
 *
 * Not linkable (declared honestly, never faked):
 *   - bay_sessions records a `source` of 'promo_coupon' but does NOT store the
 *     promo CODE, so a wash cannot be traced back to a specific campaign/coupon.
 *     We report the bay_sessions promo_coupon COUNT as a ceiling, flagged as
 *     not-attributable-to-a-specific-code.
 *
 * Mounted under /api/admin/* so it inherits the full admin security stack
 * (validateFirebaseToken + adminLimiter + requireRole). A second inline
 * requireAdmin gate is applied on every route for defence in depth.
 */
import { Router, type Request, type Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { requireAdmin } from '../adminAuth';
import {
  franchisees,
  promotionalCampaigns,
  campaignRedemptions,
  coupons,
  couponRedemptions,
  baySessions,
} from '@shared/schema';
import { logger } from '../lib/logger';

const router = Router();

// Per-aggregate guard: one failing SELECT must not blank the whole report.
async function safe<T>(
  errors: string[],
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    errors.push(label);
    logger.error(`[expansion-marketing] aggregate failed: ${label}`, err);
    return fallback;
  }
}

// =============================================================================
// §9 — FRANCHISE / LOCATION LEAD SCORING (model-only; no leads table exists)
// =============================================================================

/**
 * The scoring MODEL from the CEO spec. This is the documented framework, not a
 * live score over real leads (there are none yet). Weights sum to 100 so a
 * future leads table can be scored 0–100 directly off these factors.
 */
const LOCATION_SCORING_MODEL = {
  scaleMax: 100,
  factors: [
    { key: 'dogsInArea', weight: 15, label: 'Dog density in catchment', labelHe: 'צפיפות כלבים באזור', higherIsBetter: true },
    { key: 'apartments', weight: 12, label: 'Apartment / high-rise residents (no home wash)', labelHe: 'דיירי דירות / מגדלים (ללא רחיצה בבית)', higherIsBetter: true },
    { key: 'parking', weight: 8, label: 'Parking availability', labelHe: 'זמינות חניה', higherIsBetter: true },
    { key: 'visibility', weight: 10, label: 'Street visibility / signage exposure', labelHe: 'נראות מהרחוב / חשיפת שילוט', higherIsBetter: true },
    { key: 'utilities', weight: 10, label: 'Utilities readiness (water, drainage, power)', labelHe: 'מוכנות תשתיות (מים, ניקוז, חשמל)', higherIsBetter: true },
    { key: 'rent', weight: 10, label: 'Monthly rent (lower is better)', labelHe: 'שכר דירה חודשי (נמוך עדיף)', higherIsBetter: false },
    { key: 'competitor', weight: 8, label: 'Competitor proximity (further is better)', labelHe: 'קרבת מתחרים (רחוק עדיף)', higherIsBetter: false },
    { key: 'traffic', weight: 10, label: 'Foot / vehicle traffic', labelHe: 'תנועת הולכי רגל / רכבים', higherIsBetter: true },
    { key: 'estWashesPerDay', weight: 10, label: 'Estimated washes / day', labelHe: 'הערכת רחיצות ליום', higherIsBetter: true },
    { key: 'roi', weight: 7, label: 'Projected ROI / payback period', labelHe: 'תשואה צפויה / תקופת החזר', higherIsBetter: true },
  ],
  // Lead pipeline stages a future leads table should move through.
  pipeline: [
    { key: 'new', label: 'New', labelHe: 'חדש' },
    { key: 'contacted', label: 'Contacted', labelHe: 'נוצר קשר' },
    { key: 'site-photos', label: 'Site photos', labelHe: 'תמונות אתר' },
    { key: 'utilities', label: 'Utilities check', labelHe: 'בדיקת תשתיות' },
    { key: 'legal', label: 'Legal review', labelHe: 'בדיקה משפטית' },
    { key: 'financial', label: 'Financial review', labelHe: 'בדיקה פיננסית' },
    { key: 'approved', label: 'Approved', labelHe: 'אושר' },
    { key: 'rejected', label: 'Rejected', labelHe: 'נדחה' },
  ],
} as const;

router.get('/location-scoring', requireAdmin, async (_req: Request, res: Response) => {
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];

  // Real context: how many SIGNED franchisees exist (NOT leads being scored).
  const [signed] = await safe(
    errors,
    'signedFranchisees',
    () => db.select({ count: sql<number>`count(*)::int` }).from(franchisees),
    [{ count: 0 }] as { count: number }[],
  );

  return res.json({
    wired: true,
    readOnly: true,
    generatedAt,
    // No franchise/location LEAD table exists — we never fabricate leads.
    leadsTracked: false,
    leads: [],
    pipelineCounts: LOCATION_SCORING_MODEL.pipeline.reduce(
      (acc, s) => ({ ...acc, [s.key]: 0 }),
      {} as Record<string, number>,
    ),
    signedFranchisees: signed?.count ?? 0,
    model: LOCATION_SCORING_MODEL,
    note:
      'location-leads not tracked yet — no franchise-application / site-scoring table exists in the schema. ' +
      'The scoring model below is the documented framework from the expansion spec; once a leads table is added, ' +
      'each prospective site can be scored 0–100 against these weighted factors and moved through the pipeline. ' +
      'The "signed franchisees" count is real context, not a lead pipeline.',
    factorErrors: errors,
  });
});

// =============================================================================
// §25 — LOCAL MARKETING ENGINE (real campaigns + coupons; honest attribution)
// =============================================================================

router.get('/marketing-campaigns', requireAdmin, async (_req: Request, res: Response) => {
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];

  // 1) Promotional campaigns (the promo-code engine) — list with real config.
  const campaigns = await safe(
    errors,
    'promotionalCampaigns',
    () =>
      db
        .select({
          id: promotionalCampaigns.id,
          name: promotionalCampaigns.name,
          slug: promotionalCampaigns.slug,
          status: promotionalCampaigns.status,
          promoCode: promotionalCampaigns.promoCode,
          discountType: promotionalCampaigns.discountType,
          discountValue: promotionalCampaigns.discountValue,
          currency: promotionalCampaigns.discountCurrency,
          startAt: promotionalCampaigns.startAt,
          endAt: promotionalCampaigns.endAt,
          maxRedemptions: promotionalCampaigns.maxRedemptions,
          currentRedemptions: promotionalCampaigns.currentRedemptions,
        })
        .from(promotionalCampaigns)
        .orderBy(sql`${promotionalCampaigns.startAt} desc nulls last`)
        .limit(200),
    [] as any[],
  );

  // 1b) Per-campaign attribution from campaign_redemptions (real orders).
  // sales = SUM(discountApplied is the value moved through the code), and we
  // split first-time vs repeat by whether the user appears more than once
  // across ALL campaign redemptions.
  const redemptionAgg = await safe(
    errors,
    'campaignRedemptionAgg',
    () =>
      db
        .select({
          campaignId: campaignRedemptions.campaignId,
          redemptions: sql<number>`count(*)::int`,
          uniqueUsers: sql<number>`count(distinct ${campaignRedemptions.userId})::int`,
          discountTotal: sql<number>`coalesce(sum(${campaignRedemptions.discountApplied}), 0)::float`,
          bookingsLinked: sql<number>`count(${campaignRedemptions.bookingId})::int`,
          ordersLinked: sql<number>`count(${campaignRedemptions.orderId})::int`,
        })
        .from(campaignRedemptions)
        .groupBy(campaignRedemptions.campaignId),
    [] as any[],
  );
  const aggByCampaign = new Map<number, any>(
    redemptionAgg.map((r: any) => [r.campaignId, r]),
  );

  // First-time vs repeat across the whole campaign-redemption history.
  // A user is "repeat" once they have >1 redemption total. We count, per user,
  // their first redemption as first-time and the rest as repeat.
  const newVsRepeat = await safe(
    errors,
    'campaignNewVsRepeat',
    () =>
      db.execute(sql`
        with per_user as (
          select ${campaignRedemptions.userId} as uid, count(*)::int as n
          from ${campaignRedemptions}
          group by ${campaignRedemptions.userId}
        )
        select
          coalesce(count(*) filter (where n = 1), 0)::int as first_time_customers,
          coalesce(count(*) filter (where n > 1), 0)::int as repeat_customers,
          coalesce(sum(greatest(n - 1, 0)), 0)::int as repeat_redemptions,
          coalesce(count(*), 0)::int as total_customers
        from per_user
      `),
    { rows: [{ first_time_customers: 0, repeat_customers: 0, repeat_redemptions: 0, total_customers: 0 }] } as any,
  );
  const nvr = (newVsRepeat as any).rows?.[0] ?? {
    first_time_customers: 0,
    repeat_customers: 0,
    repeat_redemptions: 0,
    total_customers: 0,
  };

  const campaignsOut = campaigns.map((c: any) => {
    const agg = aggByCampaign.get(c.id);
    return {
      ...c,
      attribution: {
        redemptions: agg?.redemptions ?? 0,
        uniqueCustomers: agg?.uniqueUsers ?? 0,
        // "Sales attributed" here = total discount value moved through the code.
        // This is the value tracked in campaign_redemptions; it is NOT gross
        // order revenue (which is not stored on the redemption row).
        discountValueAttributed: agg?.discountTotal ?? 0,
        bookingsLinked: agg?.bookingsLinked ?? 0,
        ordersLinked: agg?.ordersLinked ?? 0,
      },
    };
  });

  // 2) Coupon engine grouped by channelSource (the local marketing channel).
  const couponChannels = await safe(
    errors,
    'couponChannels',
    () =>
      db
        .select({
          channel: sql<string>`coalesce(${coupons.channelSource}, 'unspecified')`,
          couponCount: sql<number>`count(*)::int`,
          activeCount: sql<number>`count(*) filter (where ${coupons.isActive} = true)::int`,
          totalRedemptions: sql<number>`coalesce(sum(${coupons.totalRedemptions}), 0)::int`,
        })
        .from(coupons)
        .groupBy(sql`coalesce(${coupons.channelSource}, 'unspecified')`)
        .orderBy(sql`count(*) desc`),
    [] as any[],
  );

  // 2b) Coupon redemption money attribution (real ledger, in agorot → ILS).
  const [couponMoney] = await safe(
    errors,
    'couponRedemptionMoney',
    () =>
      db
        .select({
          redemptions: sql<number>`count(*)::int`,
          uniqueCustomers: sql<number>`count(distinct ${couponRedemptions.userId})::int`,
          grossBeforeIls: sql<number>`coalesce(sum(${couponRedemptions.amountBeforeCents}), 0)::float / 100`,
          discountIls: sql<number>`coalesce(sum(${couponRedemptions.discountAmountCents}), 0)::float / 100`,
          netAfterIls: sql<number>`coalesce(sum(${couponRedemptions.amountAfterCents}), 0)::float / 100`,
        })
        .from(couponRedemptions),
    [{ redemptions: 0, uniqueCustomers: 0, grossBeforeIls: 0, discountIls: 0, netAfterIls: 0 }] as any[],
  );

  // 3) bay_sessions promo ceiling — washes initiated via a promo/coupon, but
  // NOT attributable to a specific code (bay_sessions stores no code).
  const [bayPromo] = await safe(
    errors,
    'bayPromoSessions',
    () =>
      db
        .select({
          promoSessions: sql<number>`count(*) filter (where ${baySessions.source} = 'promo_coupon')::int`,
          promoSessionsCompleted: sql<number>`count(*) filter (where ${baySessions.source} = 'promo_coupon' and ${baySessions.status} = 'completed')::int`,
        })
        .from(baySessions),
    [{ promoSessions: 0, promoSessionsCompleted: 0 }] as any[],
  );

  return res.json({
    wired: true,
    readOnly: true,
    generatedAt,
    promotionalCampaigns: {
      count: campaignsOut.length,
      campaigns: campaignsOut,
      customerMix: {
        firstTimeCustomers: nvr.first_time_customers,
        repeatCustomers: nvr.repeat_customers,
        repeatRedemptions: nvr.repeat_redemptions,
        totalCustomers: nvr.total_customers,
        note:
          'First-time vs repeat is derived from campaign_redemptions history: a customer with exactly one ' +
          'redemption is first-time; more than one makes them a repeat customer.',
      },
    },
    couponEngine: {
      byChannel: couponChannels,
      money: couponMoney ?? { redemptions: 0, uniqueCustomers: 0, grossBeforeIls: 0, discountIls: 0, netAfterIls: 0 },
      note:
        'Coupons are grouped by channelSource (sms / push / email / app_banner / qr / referral / admin) = the ' +
        'local marketing channel. Money figures are real sums over coupon_redemptions (agorot → ILS).',
    },
    bayWashAttribution: {
      promoSessions: bayPromo?.promoSessions ?? 0,
      promoSessionsCompleted: bayPromo?.promoSessionsCompleted ?? 0,
      attributable: false,
      note:
        'bay_sessions records source = "promo_coupon" but stores no promo/coupon CODE, so an individual K9000 ' +
        'wash cannot be traced to a specific campaign or coupon. This count is a ceiling of promo-driven washes, ' +
        'not per-code attribution.',
    },
    factorErrors: errors,
  });
});

export default router;
