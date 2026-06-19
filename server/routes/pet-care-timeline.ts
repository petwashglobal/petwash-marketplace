/**
 * pet-care-timeline.ts — Pet-Care Timeline (§5) + Smart-Reminders PREVIEW (§6)
 *
 * READ-ONLY. This router NEVER sends an SMS, email, or push. The admin
 * "reminder preview" endpoint shows what WOULD be sent so the team can sanity
 * -check audience and copy before any campaign is wired — it does not send.
 *
 * Conflict-avoidance: ALL server code for this feature lives in this one file.
 * routes.ts gains only an import line + one `app.use('/api', petCareTimelineRouter)`.
 *
 * Data model reality (verified against shared/schema.ts + firestore-schema.ts):
 *   - Pet profiles live in FIRESTORE at users/{uid}/pets/{petId} (NOT the
 *     Postgres `pets` table). Fields: name, photoUrl, birthday (YYYY-MM-DD),
 *     species, breed. There is NO per-pet wash log.
 *   - Wash / booking / money history lives in POSTGRES keyed by userId
 *     (= Firebase UID): wash_history, bay_sessions, credit_transactions,
 *     e_vouchers. None of these reference a petId.
 *
 * Consequence (stated honestly): the timeline blends PER-PET profile data
 * (birthday) from Firestore with PER-OWNER wash/credit data from Postgres.
 * We cannot attribute a specific wash to a specific pet — the hardware/booking
 * records don't carry a pet id — so wash data is the owner's, labelled as such.
 *
 * Heuristics are clearly labelled and configurable:
 *   - NEXT_WASH_INTERVAL_DAYS: suggested cadence (last wash + N days). A
 *     heuristic, NOT a medical recommendation.
 *   - BIRTHDAY_LOOKAHEAD_DAYS: how far ahead a birthday counts as "upcoming".
 *   - REMINDER_DUE_DAYS: owner counts as "due for next wash" after this many
 *     days since last wash.
 *   - PACKAGE_ALMOST_EMPTY_UNITS: wash-package credits at/under this = "almost
 *     empty".
 * When data is missing, fields are null — never invented.
 */
import { Router } from 'express';
import { db as firestore } from '../lib/firebase-admin';
import { db } from '../db';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { requireAdmin } from '../adminAuth';
import {
  washHistory,
  baySessions,
  creditTransactions,
  walletAccounts,
  eVouchers,
} from '../../shared/schema';
import { and, desc, eq, gte, lte, inArray, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

// ── Heuristic constants (configurable; clearly NOT medical advice) ──────────
const NEXT_WASH_INTERVAL_DAYS = 24;   // suggested cadence: last wash + N days
const BIRTHDAY_LOOKAHEAD_DAYS = 30;   // birthday within N days = "upcoming"
const REMINDER_DUE_DAYS = 24;         // owner due for next wash after N days
const PACKAGE_ALMOST_EMPTY_UNITS = 1; // wash credits at/under this = almost empty
const SAMPLE_CAP = 25;                // max rows in any preview sample list

const DAY_MS = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  const t = d instanceof Date ? d : new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

/**
 * Number of days until the NEXT occurrence of a YYYY-MM-DD birthday
 * (month/day only; year ignored). null if unparseable. 0 = today.
 */
function daysUntilBirthday(birthday: string | undefined | null): number | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next.getTime() < today.getTime()) {
    next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  }
  return daysBetween(next, today);
}

// ============================================================================
// §5 — GET /api/pet-care-timeline/:petId   (owner-scoped, read-only)
// ============================================================================
router.get('/pet-care-timeline/:petId', validateFirebaseToken, async (req, res) => {
  const uid = req.firebaseUser!.uid;
  const { petId } = req.params;

  // ── Owner-scope: the pet must belong to the requesting user ──────────────
  // Firestore stores pets under users/{uid}/pets/{petId}; reading at the
  // caller's own uid path enforces ownership. We additionally verify the doc
  // exists and is not soft-deleted, and 403 on any owner mismatch.
  let pet: any = null;
  try {
    const petDoc = await firestore.doc(`users/${uid}/pets/${petId}`).get();
    if (!petDoc.exists || petDoc.data()?.deletedAt) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    const data = petDoc.data()!;
    // Defense in depth: if the doc carries an owner uid, it must match caller.
    if (data.uid && data.uid !== uid) {
      logger.warn('[PetCareTimeline] owner mismatch', { uid, petId });
      return res.status(403).json({ error: 'Not your pet' });
    }
    pet = {
      id: petId,
      name: data.name ?? null,
      species: data.species ?? null,
      breed: data.breed ?? null,
      photoUrl: data.photoUrl ?? null,
      birthday: data.birthday ?? null,
    };
  } catch (error) {
    logger.error('[PetCareTimeline] pet lookup failed', { uid, petId, error });
    return res.status(500).json({ error: 'Failed to load pet' });
  }

  const now = new Date();

  // ── Wash history (PER-OWNER — wash records carry no petId) ───────────────
  // Two sources: wash_history (loyalty/package washes) and bay_sessions
  // (kiosk sessions). Merge, newest first.
  let washes: Array<{ date: string | null; source: string; status: string | null; program: string | null }> = [];
  try {
    const [historyRows, bayRows] = await Promise.all([
      db
        .select({ createdAt: washHistory.createdAt, status: washHistory.status })
        .from(washHistory)
        .where(eq(washHistory.userId, uid))
        .orderBy(desc(washHistory.createdAt))
        .limit(50),
      db
        .select({
          startedAt: baySessions.startedAt,
          endedAt: baySessions.endedAt,
          status: baySessions.status,
          program: baySessions.washProgram,
        })
        .from(baySessions)
        .where(eq(baySessions.userId, uid))
        .orderBy(desc(baySessions.startedAt))
        .limit(50),
    ]);

    const merged = [
      ...historyRows.map((r) => ({
        date: iso(r.createdAt as any),
        source: 'wash_package',
        status: r.status ?? null,
        program: null as string | null,
      })),
      ...bayRows.map((r) => ({
        date: iso((r.endedAt ?? r.startedAt) as any),
        source: 'kiosk',
        status: r.status ?? null,
        program: r.program ?? null,
      })),
    ].filter((w) => w.date);

    merged.sort((a, b) => (b.date! > a.date! ? 1 : b.date! < a.date! ? -1 : 0));
    washes = merged.slice(0, 30);
  } catch (error) {
    logger.error('[PetCareTimeline] wash history failed', { uid, petId, error });
    washes = [];
  }

  const lastWashDate = washes.length ? washes[0].date : null;
  let daysSinceLastWash: number | null = null;
  let suggestedNextWashDate: string | null = null;
  if (lastWashDate) {
    const last = new Date(lastWashDate);
    daysSinceLastWash = daysBetween(now, last);
    suggestedNextWashDate = iso(addDays(last, NEXT_WASH_INTERVAL_DAYS));
  }

  // ── Birthday (PER-PET, from Firestore profile) ───────────────────────────
  const daysUntilBday = daysUntilBirthday(pet.birthday);

  // ── eGift / credit used (PER-OWNER, from Postgres) ───────────────────────
  // Sum of redeem-type credit_transactions on this user's wallet(s).
  let creditUsed: {
    egiftRedeemedCents: number | null;
    washPackageUnitsRedeemed: number | null;
    walletWashCreditsRemaining: number | null;
  } = { egiftRedeemedCents: null, washPackageUnitsRedeemed: null, walletWashCreditsRemaining: null };
  try {
    const wallets = await db
      .select({ walletId: walletAccounts.walletId, washCredits: walletAccounts.washPackageCredits })
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, uid));

    const walletIds = wallets.map((w) => w.walletId);
    const walletWashCreditsRemaining = wallets.reduce((a, w) => a + (w.washCredits ?? 0), 0);

    let egiftRedeemedCents = 0;
    let washPackageUnitsRedeemed = 0;
    if (walletIds.length) {
      const redeemRows = await db
        .select({
          creditType: creditTransactions.creditType,
          amountCents: creditTransactions.amountCents,
          amountUnits: creditTransactions.amountUnits,
        })
        .from(creditTransactions)
        .where(
          and(
            inArray(creditTransactions.walletId, walletIds),
            eq(creditTransactions.transactionType, 'redeem'),
          ),
        )
        .limit(500);
      for (const r of redeemRows) {
        if (r.creditType === 'egift') egiftRedeemedCents += Math.abs(r.amountCents ?? 0);
        if (r.creditType === 'wash_package') washPackageUnitsRedeemed += Math.abs(r.amountUnits ?? 0);
      }
    }
    creditUsed = {
      egiftRedeemedCents: walletIds.length ? egiftRedeemedCents : null,
      washPackageUnitsRedeemed: walletIds.length ? washPackageUnitsRedeemed : null,
      walletWashCreditsRemaining: wallets.length ? walletWashCreditsRemaining : null,
    };
  } catch (error) {
    logger.error('[PetCareTimeline] credit summary failed', { uid, petId, error });
  }

  return res.json({
    pet,
    timeline: {
      lastWashDate,
      daysSinceLastWash,
      suggestedNextWashDate,
      // Make the heuristic explicit so the UI can label it honestly.
      suggestedNextWashIsHeuristic: true,
      nextWashIntervalDays: NEXT_WASH_INTERVAL_DAYS,
      washHistory: washes,
      birthday: pet.birthday,
      daysUntilBirthday: daysUntilBday,
      creditUsed,
    },
    notes: {
      washScope: 'owner',
      washScopeReason:
        'Wash/kiosk records are keyed by account, not by individual pet, so wash data reflects the owner across all pets.',
    },
    readOnly: true,
    generatedAt: now.toISOString(),
  });
});

// ============================================================================
// §6 — GET /api/admin/reminder-preview   (admin-only, PREVIEW, sends NOTHING)
// ============================================================================
router.get('/admin/reminder-preview', requireAdmin, async (req, res) => {
  const now = new Date();
  const dueCutoff = addDays(now, -REMINDER_DUE_DAYS);

  const result: any = {
    preview: true,
    sends: false,
    note: 'PREVIEW ONLY — this is what WOULD be sent. No SMS, email, or push is dispatched by this endpoint.',
    heuristics: {
      reminderDueDays: REMINDER_DUE_DAYS,
      packageAlmostEmptyUnits: PACKAGE_ALMOST_EMPTY_UNITS,
      birthdayLookaheadDays: BIRTHDAY_LOOKAHEAD_DAYS,
      sampleCap: SAMPLE_CAP,
    },
    counts: {},
    samples: {},
    errors: {},
    generatedAt: now.toISOString(),
  };

  // 1) Customers due for next wash — last wash older than REMINDER_DUE_DAYS.
  //    We take the latest wash per user from wash_history, then filter.
  try {
    const rows = await db
      .select({
        userId: washHistory.userId,
        lastWash: sql<string>`max(${washHistory.createdAt})`,
      })
      .from(washHistory)
      .groupBy(washHistory.userId)
      .having(sql`max(${washHistory.createdAt}) < ${dueCutoff.toISOString()}`)
      .limit(SAMPLE_CAP * 4);
    const due = rows
      .map((r) => {
        const last = r.lastWash ? new Date(r.lastWash) : null;
        return {
          userId: r.userId,
          lastWashDate: iso(last),
          daysSinceLastWash: last ? daysBetween(now, last) : null,
        };
      })
      .filter((r) => r.daysSinceLastWash != null);
    result.counts.dueForWash = due.length;
    result.samples.dueForWash = due.slice(0, SAMPLE_CAP);
  } catch (error) {
    logger.error('[ReminderPreview] dueForWash failed', error);
    result.errors.dueForWash = 'query failed';
    result.counts.dueForWash = null;
  }

  // 2) Unused eGift — vouchers issued/active but never redeemed (remaining > 0).
  try {
    const rows = await db
      .select({
        id: eVouchers.id,
        codeLast4: eVouchers.codeLast4,
        status: eVouchers.status,
        remainingAmount: eVouchers.remainingAmount,
        recipientEmail: eVouchers.recipientEmail,
        expiresAt: eVouchers.expiresAt,
      })
      .from(eVouchers)
      .where(
        and(
          inArray(eVouchers.status, ['ISSUED', 'CLAIMED', 'ACTIVE']),
          gte(eVouchers.remainingAmount, '0.01'),
        ),
      )
      .orderBy(desc(eVouchers.createdAt))
      .limit(SAMPLE_CAP * 4);
    result.counts.unusedEgift = rows.length;
    result.samples.unusedEgift = rows.slice(0, SAMPLE_CAP).map((r) => ({
      voucherId: r.id,
      codeLast4: r.codeLast4,
      status: r.status,
      remainingAmount: r.remainingAmount,
      recipientEmail: r.recipientEmail ?? null,
      expiresAt: iso(r.expiresAt as any),
    }));
  } catch (error) {
    logger.error('[ReminderPreview] unusedEgift failed', error);
    result.errors.unusedEgift = 'query failed';
    result.counts.unusedEgift = null;
  }

  // 3) Package almost empty — wallets with wash credits at/under threshold (but > 0).
  try {
    const rows = await db
      .select({
        userId: walletAccounts.userId,
        washCredits: walletAccounts.washPackageCredits,
      })
      .from(walletAccounts)
      .where(
        and(
          gte(walletAccounts.washPackageCredits, 1),
          lte(walletAccounts.washPackageCredits, PACKAGE_ALMOST_EMPTY_UNITS),
        ),
      )
      .limit(SAMPLE_CAP * 4);
    result.counts.packageAlmostEmpty = rows.length;
    result.samples.packageAlmostEmpty = rows.slice(0, SAMPLE_CAP).map((r) => ({
      userId: r.userId,
      washCreditsRemaining: r.washCredits,
    }));
  } catch (error) {
    logger.error('[ReminderPreview] packageAlmostEmpty failed', error);
    result.errors.packageAlmostEmpty = 'query failed';
    result.counts.packageAlmostEmpty = null;
  }

  // 4) Upcoming pet birthday — scanned from Firestore pet profiles.
  //    Read-only, capped. We scan recent pet docs via collectionGroup('pets').
  try {
    const upcoming: Array<{ uid: string | null; petId: string; name: string | null; birthday: string; daysUntil: number }> = [];
    const snap = await firestore.collectionGroup('pets').limit(2000).get();
    for (const doc of snap.docs) {
      const d = doc.data();
      if (d?.deletedAt || !d?.birthday) continue;
      const daysUntil = daysUntilBirthday(d.birthday);
      if (daysUntil == null || daysUntil > BIRTHDAY_LOOKAHEAD_DAYS) continue;
      // path: users/{uid}/pets/{petId}
      const parentUid = doc.ref.parent.parent?.id ?? null;
      upcoming.push({
        uid: parentUid,
        petId: doc.id,
        name: d.name ?? null,
        birthday: d.birthday,
        daysUntil,
      });
    }
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    result.counts.upcomingBirthday = upcoming.length;
    result.samples.upcomingBirthday = upcoming.slice(0, SAMPLE_CAP);
  } catch (error) {
    logger.error('[ReminderPreview] upcomingBirthday failed', error);
    result.errors.upcomingBirthday = 'query failed';
    result.counts.upcomingBirthday = null;
  }

  return res.json(result);
});

export default router;
