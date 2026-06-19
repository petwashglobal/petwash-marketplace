/**
 * admin-retention.ts — Customer Winback Engine (§27) + Review Engine logic (§26)
 *
 * READ-ONLY / PREVIEW. Mounted at /api/admin (under the /api/admin/ middleware
 * stack in routes.ts, plus explicit requireAdmin per route for defense-in-depth).
 *
 *   GET /api/admin/winback        — detect inactive customer segments (PURE SELECT)
 *   GET /api/admin/review-funnel  — review-ask eligibility + funnel (PURE SELECT)
 *
 * STRICT GUARANTEES:
 *   • Nothing is ever sent, posted, queued, or written. SELECT-only.
 *   • The "suggested action" on each winback segment is a LABEL ONLY — a hint
 *     for a human operator. No message is dispatched.
 *   • Honest: when a backing table does not exist (e.g. there is no reviews
 *     table for K9000 station washes), the field is `null` + a clear note.
 *     Never fabricated.
 *   • Internal-only. We do NOT expose a per-customer "score". We return small
 *     capped sample lists (id / email / last-activity) so an operator can act.
 *
 * Real columns only — verified against shared/schema.ts on 2026-06-19:
 *   users(id, email, firstName?, createdAt, lastLoginAt, role)
 *   bay_sessions(userId, status, source, startedAt)            — K9000 washes
 *   wallet_accounts(walletId, userId, washPackageCredits, createdAt)
 *   credit_transactions(walletId, creditType, transactionType, createdAt)
 *   e_vouchers(ownerUid, status, activatedAt)
 *   bookings(userId, status, completedAt, refundRequestedAt,
 *            customerReviewId, customerRating)                  — marketplace
 *   super_app_reviews(bookingId, rating, createdAt)             — marketplace reviews
 *
 * There is NO reviews table for K9000 station washes — review-funnel reports
 * that honestly and falls back to the eligible-to-ask count from bay_sessions.
 */
import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import {
  users,
  baySessions,
  walletAccounts,
  creditTransactions,
  eVouchers,
  bookings,
  superAppReviews,
} from '../../shared/schema';
import { and, eq, gte, lt, lte, sql, inArray, isNull, isNotNull, desc, count } from 'drizzle-orm';
import { requireAdmin } from '../adminAuth';
import { logger } from '../lib/logger';

const router = Router();

// How many sample customers to return per segment (operator preview only).
const SAMPLE_CAP = 25;

const now = () => new Date();
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

/** Suggested operator ACTION LABELS — suggestions only, nothing is sent. */
type ActionLabel = 'reminder' | 'care_tip' | 'small_credit' | 'birthday_offer';

interface WinbackSample {
  userId: string;
  email: string | null;
  name: string | null;
  lastActivityAt: string | null;
}
interface WinbackSegment {
  key: string;
  title: string;
  titleHe: string;
  description: string;
  descriptionHe: string;
  suggestedAction: ActionLabel;
  /** null when the segment could not be computed (table/columns unavailable). */
  count: number | null;
  sample: WinbackSample[];
  note?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// GET /api/admin/winback — inactive-customer detection (PURE SELECT)
// ───────────────────────────────────────────────────────────────────────────
router.get('/winback', requireAdmin, async (_req: Request, res: Response) => {
  const segments: WinbackSegment[] = [];
  const generatedAt = now().toISOString();

  // Helper: map a raw user row to a sample record.
  const toSample = (r: any): WinbackSample => ({
    userId: r.userId ?? r.id,
    email: r.email ?? null,
    name: r.firstName ?? null,
    lastActivityAt: r.lastActivityAt ? new Date(r.lastActivityAt).toISOString() : null,
  });

  // ── Segment 1: bought a wash package but no wash in 30 days ───────────────
  // wallet_accounts.washPackageCredits > 0 (has package) AND no completed
  // bay_session in the last 30 days.
  try {
    const cutoff = daysAgo(30);
    const recentWashUserIds = db
      .select({ userId: baySessions.userId })
      .from(baySessions)
      .where(and(
        eq(baySessions.status, 'completed'),
        gte(baySessions.startedAt, cutoff),
        isNotNull(baySessions.userId),
      ));

    const rows = await db
      .select({
        userId: walletAccounts.userId,
        email: users.email,
        firstName: users.firstName,
        lastActivityAt: walletAccounts.lastActivityAt,
      })
      .from(walletAccounts)
      .leftJoin(users, eq(users.id, walletAccounts.userId))
      .where(and(
        gte(walletAccounts.washPackageCredits, 1),
        sql`${walletAccounts.userId} NOT IN ${recentWashUserIds}`,
      ))
      .limit(SAMPLE_CAP);

    const total = await db
      .select({ c: count() })
      .from(walletAccounts)
      .where(and(
        gte(walletAccounts.washPackageCredits, 1),
        sql`${walletAccounts.userId} NOT IN ${recentWashUserIds}`,
      ));

    segments.push({
      key: 'package_no_wash_30d',
      title: 'Bought a package — no wash in 30 days',
      titleHe: 'רכשו חבילה — לא התרחצו 30 יום',
      description: 'Customers with unused wash-package credits and no completed wash in the last 30 days.',
      descriptionHe: 'לקוחות עם יתרת חבילות רחצה שלא התרחצו ב-30 הימים האחרונים.',
      suggestedAction: 'reminder',
      count: total[0]?.c ?? 0,
      sample: rows.map(toSample),
    });
  } catch (err) {
    logger.error('[winback] segment package_no_wash_30d failed', err);
    segments.push({
      key: 'package_no_wash_30d',
      title: 'Bought a package — no wash in 30 days',
      titleHe: 'רכשו חבילה — לא התרחצו 30 יום',
      description: 'Customers with unused wash-package credits and no completed wash in the last 30 days.',
      descriptionHe: 'לקוחות עם יתרת חבילות רחצה שלא התרחצו ב-30 הימים האחרונים.',
      suggestedAction: 'reminder',
      count: null,
      sample: [],
      note: 'Could not compute (query error). See server logs.',
    });
  }

  // ── Segment 2: used exactly 1 wash then stopped ───────────────────────────
  // Exactly one completed bay_session ever, and that session is older than
  // 21 days (they tried once and did not come back).
  try {
    const cutoff = daysAgo(21);
    const oneWashUsers = await db
      .select({
        userId: baySessions.userId,
        washes: count(),
        lastWash: sql<string>`max(${baySessions.startedAt})`,
      })
      .from(baySessions)
      .where(and(eq(baySessions.status, 'completed'), isNotNull(baySessions.userId)))
      .groupBy(baySessions.userId)
      .having(sql`count(*) = 1 AND max(${baySessions.startedAt}) < ${cutoff}`)
      .limit(500);

    const ids = oneWashUsers.map((r) => r.userId).filter(Boolean) as string[];
    let sample: WinbackSample[] = [];
    if (ids.length) {
      const sampleIds = ids.slice(0, SAMPLE_CAP);
      const urows = await db
        .select({ id: users.id, email: users.email, firstName: users.firstName })
        .from(users)
        .where(inArray(users.id, sampleIds));
      const byId = new Map(urows.map((u) => [u.id, u]));
      sample = oneWashUsers.slice(0, SAMPLE_CAP).map((r) => ({
        userId: r.userId as string,
        email: byId.get(r.userId as string)?.email ?? null,
        name: byId.get(r.userId as string)?.firstName ?? null,
        lastActivityAt: r.lastWash ? new Date(r.lastWash).toISOString() : null,
      }));
    }

    segments.push({
      key: 'one_wash_then_stopped',
      title: 'Tried once — never returned',
      titleHe: 'התרחצו פעם אחת — לא חזרו',
      description: 'Customers with exactly one completed wash, more than 21 days ago.',
      descriptionHe: 'לקוחות עם רחצה אחת בלבד, לפני יותר מ-21 יום.',
      suggestedAction: 'care_tip',
      count: oneWashUsers.length,
      sample,
    });
  } catch (err) {
    logger.error('[winback] segment one_wash_then_stopped failed', err);
    segments.push({
      key: 'one_wash_then_stopped',
      title: 'Tried once — never returned',
      titleHe: 'התרחצו פעם אחת — לא חזרו',
      description: 'Customers with exactly one completed wash, more than 21 days ago.',
      descriptionHe: 'לקוחות עם רחצה אחת בלבד, לפני יותר מ-21 יום.',
      suggestedAction: 'care_tip',
      count: null,
      sample: [],
      note: 'Could not compute (query error). See server logs.',
    });
  }

  // ── Segment 3: eGift redeemed but no second purchase ──────────────────────
  // e_vouchers with status REDEEMED bound to an ownerUid, where that owner has
  // no later 'issue' credit_transaction (i.e. no second purchase after redeem).
  try {
    const redeemed = await db
      .select({
        ownerUid: eVouchers.ownerUid,
        activatedAt: eVouchers.activatedAt,
      })
      .from(eVouchers)
      .where(and(eq(eVouchers.status, 'REDEEMED'), isNotNull(eVouchers.ownerUid)))
      .limit(2000);

    const candidates: { ownerUid: string; activatedAt: Date | null }[] = [];
    for (const r of redeemed) {
      if (!r.ownerUid) continue;
      // Does this owner's wallet have any 'issue' credit txn after redemption?
      const wallet = await db
        .select({ walletId: walletAccounts.walletId })
        .from(walletAccounts)
        .where(eq(walletAccounts.userId, r.ownerUid))
        .limit(1);
      let hasSecondPurchase = false;
      if (wallet[0]?.walletId) {
        const after = r.activatedAt ?? new Date(0);
        const second = await db
          .select({ id: creditTransactions.id })
          .from(creditTransactions)
          .where(and(
            eq(creditTransactions.walletId, wallet[0].walletId),
            eq(creditTransactions.transactionType, 'issue'),
            gte(creditTransactions.createdAt, after),
          ))
          .limit(1);
        hasSecondPurchase = second.length > 0;
      }
      if (!hasSecondPurchase) {
        candidates.push({ ownerUid: r.ownerUid, activatedAt: r.activatedAt as any });
      }
    }

    const sampleIds = candidates.slice(0, SAMPLE_CAP).map((c) => c.ownerUid);
    let sample: WinbackSample[] = [];
    if (sampleIds.length) {
      const urows = await db
        .select({ id: users.id, email: users.email, firstName: users.firstName })
        .from(users)
        .where(inArray(users.id, sampleIds));
      const byId = new Map(urows.map((u) => [u.id, u]));
      sample = candidates.slice(0, SAMPLE_CAP).map((c) => ({
        userId: c.ownerUid,
        email: byId.get(c.ownerUid)?.email ?? null,
        name: byId.get(c.ownerUid)?.firstName ?? null,
        lastActivityAt: c.activatedAt ? new Date(c.activatedAt).toISOString() : null,
      }));
    }

    segments.push({
      key: 'egift_redeemed_no_repeat',
      title: 'eGift redeemed — no second purchase',
      titleHe: 'מומש גיפט — אין רכישה שנייה',
      description: 'Customers who redeemed an e-gift but never made a follow-on purchase.',
      descriptionHe: 'לקוחות שמימשו כרטיס מתנה אך לא ביצעו רכישה נוספת.',
      suggestedAction: 'small_credit',
      count: candidates.length,
      sample,
    });
  } catch (err) {
    logger.error('[winback] segment egift_redeemed_no_repeat failed', err);
    segments.push({
      key: 'egift_redeemed_no_repeat',
      title: 'eGift redeemed — no second purchase',
      titleHe: 'מומש גיפט — אין רכישה שנייה',
      description: 'Customers who redeemed an e-gift but never made a follow-on purchase.',
      descriptionHe: 'לקוחות שמימשו כרטיס מתנה אך לא ביצעו רכישה נוספת.',
      suggestedAction: 'small_credit',
      count: null,
      sample: [],
      note: 'Could not compute (query error). See server logs.',
    });
  }

  // ── Segment 4: joined wallet but never washed ─────────────────────────────
  // Has a wallet_account but zero completed bay_sessions ever.
  try {
    const washedUserIds = db
      .select({ userId: baySessions.userId })
      .from(baySessions)
      .where(and(eq(baySessions.status, 'completed'), isNotNull(baySessions.userId)));

    const rows = await db
      .select({
        userId: walletAccounts.userId,
        email: users.email,
        firstName: users.firstName,
        lastActivityAt: walletAccounts.createdAt,
      })
      .from(walletAccounts)
      .leftJoin(users, eq(users.id, walletAccounts.userId))
      .where(sql`${walletAccounts.userId} NOT IN ${washedUserIds}`)
      .limit(SAMPLE_CAP);

    const total = await db
      .select({ c: count() })
      .from(walletAccounts)
      .where(sql`${walletAccounts.userId} NOT IN ${washedUserIds}`);

    segments.push({
      key: 'wallet_never_washed',
      title: 'Joined wallet — never washed',
      titleHe: 'נרשמו לארנק — מעולם לא התרחצו',
      description: 'Customers with a wallet account but no completed wash on record.',
      descriptionHe: 'לקוחות עם חשבון ארנק שמעולם לא ביצעו רחצה.',
      suggestedAction: 'care_tip',
      count: total[0]?.c ?? 0,
      sample: rows.map(toSample),
    });
  } catch (err) {
    logger.error('[winback] segment wallet_never_washed failed', err);
    segments.push({
      key: 'wallet_never_washed',
      title: 'Joined wallet — never washed',
      titleHe: 'נרשמו לארנק — מעולם לא התרחצו',
      description: 'Customers with a wallet account but no completed wash on record.',
      descriptionHe: 'לקוחות עם חשבון ארנק שמעולם לא ביצעו רחצה.',
      suggestedAction: 'care_tip',
      count: null,
      sample: [],
      note: 'Could not compute (query error). See server logs.',
    });
  }

  // ── Segment 5: station user not returned in 45 days ───────────────────────
  // Has at least one completed bay_session, but the most recent is > 45 days old.
  try {
    const cutoff = daysAgo(45);
    const lapsed = await db
      .select({
        userId: baySessions.userId,
        lastWash: sql<string>`max(${baySessions.startedAt})`,
      })
      .from(baySessions)
      .where(and(eq(baySessions.status, 'completed'), isNotNull(baySessions.userId)))
      .groupBy(baySessions.userId)
      .having(sql`max(${baySessions.startedAt}) < ${cutoff}`)
      .limit(1000);

    const ids = lapsed.map((r) => r.userId).filter(Boolean) as string[];
    let sample: WinbackSample[] = [];
    if (ids.length) {
      const sampleIds = ids.slice(0, SAMPLE_CAP);
      const urows = await db
        .select({ id: users.id, email: users.email, firstName: users.firstName })
        .from(users)
        .where(inArray(users.id, sampleIds));
      const byId = new Map(urows.map((u) => [u.id, u]));
      sample = lapsed.slice(0, SAMPLE_CAP).map((r) => ({
        userId: r.userId as string,
        email: byId.get(r.userId as string)?.email ?? null,
        name: byId.get(r.userId as string)?.firstName ?? null,
        lastActivityAt: r.lastWash ? new Date(r.lastWash).toISOString() : null,
      }));
    }

    segments.push({
      key: 'station_lapsed_45d',
      title: 'Station regular — gone 45 days',
      titleHe: 'לקוח עמדה — נעלם 45 יום',
      description: 'Customers who washed before but have not returned to a station in 45 days.',
      descriptionHe: 'לקוחות שהתרחצו בעבר אך לא חזרו לעמדה כבר 45 יום.',
      suggestedAction: 'birthday_offer',
      count: lapsed.length,
      sample,
    });
  } catch (err) {
    logger.error('[winback] segment station_lapsed_45d failed', err);
    segments.push({
      key: 'station_lapsed_45d',
      title: 'Station regular — gone 45 days',
      titleHe: 'לקוח עמדה — נעלם 45 יום',
      description: 'Customers who washed before but have not returned to a station in 45 days.',
      descriptionHe: 'לקוחות שהתרחצו בעבר אך לא חזרו לעמדה כבר 45 יום.',
      suggestedAction: 'birthday_offer',
      count: null,
      sample: [],
      note: 'Could not compute (query error). See server logs.',
    });
  }

  return res.json({
    generatedAt,
    readOnly: true,
    sampleCap: SAMPLE_CAP,
    note: 'Detection preview only. Nothing is sent. "suggestedAction" is a label for a human operator, not an automated action.',
    actionLabels: {
      reminder: { en: 'Gentle reminder', he: 'תזכורת עדינה' },
      care_tip: { en: 'Pet-care tip', he: 'טיפ טיפוח' },
      small_credit: { en: 'Small goodwill credit', he: 'זיכוי קטן' },
      birthday_offer: { en: 'Birthday / comeback offer', he: 'הצעת חזרה / יום הולדת' },
    },
    segments,
  });
});

// ───────────────────────────────────────────────────────────────────────────
// GET /api/admin/review-funnel — Review Engine logic (§26), PURE SELECT
// ───────────────────────────────────────────────────────────────────────────
router.get('/review-funnel', requireAdmin, async (_req: Request, res: Response) => {
  const generatedAt = now().toISOString();

  // The Review Engine POLICY (documented, NOT executed here):
  //   1. Ask the customer INTERNALLY first (in-app rating prompt).
  //   2. If they rate 4–5★  → invite them to leave a public Google review.
  //   3. If they rate 1–3★  → open a support ticket instead (recover privately).
  // Eligibility to ASK: wash completed, no open support ticket, no refund
  // requested. (There is no support-tickets table yet — see note below.)
  const policy = {
    summary: 'Ask internally first; route 4-5★ to a public Google review, route 1-3★ to a support ticket.',
    summaryHe: 'שואלים בפנים קודם; 4-5 כוכבים → ביקורת גוגל, 1-3 כוכבים → פנייה לתמיכה.',
    askEligibility: [
      'wash / booking completed',
      'no open support ticket',
      'no refund requested',
    ],
    routing: {
      highRating: { threshold: '4-5', action: 'invite_google_review' },
      lowRating: { threshold: '1-3', action: 'open_support_ticket' },
    },
    enforced: false,
    note: 'This is the documented policy only. This endpoint does NOT send invites or open tickets — it is read-only preview.',
  };

  // ── Station washes (K9000) — eligible-to-ask count ────────────────────────
  // NO reviews table exists for station washes. We honestly report the
  // eligible-to-ask population and flag that reviews are not tracked yet.
  let stationWashes: any = {
    eligibleToAsk: null,
    asked: null,
    reviewed: null,
    highRating: null,
    lowRating: null,
    reviewsTracked: false,
    note: 'No reviews table exists for K9000 station washes. Showing eligible-to-ask only (completed washes). Asked/reviewed/star-split are not tracked yet.',
  };
  try {
    // Eligible = completed bay_sessions tied to a real user.
    // We cannot subtract "open support ticket" (no table) or refund (station
    // washes have no refund column on the session) — disclosed in note.
    const elig = await db
      .select({ c: count() })
      .from(baySessions)
      .where(and(eq(baySessions.status, 'completed'), isNotNull(baySessions.userId)));
    stationWashes.eligibleToAsk = elig[0]?.c ?? 0;
  } catch (err) {
    logger.error('[review-funnel] station washes failed', err);
    stationWashes.note = 'Could not compute eligible-to-ask for station washes (query error). See server logs.';
  }

  // ── Marketplace bookings — full funnel (reviews ARE tracked) ──────────────
  // bookings has status/completedAt/refundRequestedAt/customerReviewId;
  // super_app_reviews has rating (1-5). This is a real funnel.
  let marketplace: any = {
    eligibleToAsk: null,
    asked: null,
    reviewed: null,
    highRating: null,
    lowRating: null,
    reviewsTracked: true,
    note: null,
  };
  try {
    // Eligible to ask: completed, no refund requested.
    const elig = await db
      .select({ c: count() })
      .from(bookings)
      .where(and(eq(bookings.status, 'completed'), isNull(bookings.refundRequestedAt)));
    marketplace.eligibleToAsk = elig[0]?.c ?? 0;

    // Reviewed: completed bookings that have a customerReviewId linked.
    const reviewed = await db
      .select({ c: count() })
      .from(bookings)
      .where(and(eq(bookings.status, 'completed'), isNotNull(bookings.customerReviewId)));
    marketplace.reviewed = reviewed[0]?.c ?? 0;
    // "asked" is not separately tracked; reviewed is a lower bound of asked.
    marketplace.asked = null;

    // Star split from super_app_reviews (the canonical marketplace reviews).
    const high = await db
      .select({ c: count() })
      .from(superAppReviews)
      .where(gte(superAppReviews.rating, 4));
    const low = await db
      .select({ c: count() })
      .from(superAppReviews)
      .where(lte(superAppReviews.rating, 3));
    marketplace.highRating = high[0]?.c ?? 0;
    marketplace.lowRating = low[0]?.c ?? 0;
    marketplace.note = '"asked" is not separately tracked; reviewed = bookings with a linked review. Star split from super_app_reviews.';
  } catch (err) {
    logger.error('[review-funnel] marketplace funnel failed', err);
    marketplace = {
      eligibleToAsk: null,
      asked: null,
      reviewed: null,
      highRating: null,
      lowRating: null,
      reviewsTracked: true,
      note: 'Could not compute marketplace funnel (query error). See server logs.',
    };
  }

  return res.json({
    generatedAt,
    readOnly: true,
    policy,
    stationWashes,
    marketplace,
  });
});

export default router;
