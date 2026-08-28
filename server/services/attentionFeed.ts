/**
 * attentionFeed composer — the "what needs my attention" projection
 * each workspace home renders (CEO 2026-08-26 §27-29).
 *
 * READ-ONLY. Never captures, reserves, or mutates.
 *
 * MVP scope (this PR): a stable shape + a working projection over the
 * booking_requests table for both actors, plus a Pet Passport reminder
 * probe for vaccinations due in the next 30 days. Every OTHER domain
 * (walk, sitting, academy, shop, wallet, egift, prestige benefits,
 * paw_finder, kyc) returns zero items today — the composer is designed
 * so a follow-up per-domain probe can be added without a client change.
 *
 * The point is to give the client home ONE endpoint that already
 * exists, so the next domain probe just extends the array. No client
 * refactor needed later.
 */

import { and, eq, gt, inArray, desc, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { bookingRequests, eVouchers, pets, privilegeMembers, providerApplications, walletAccounts } from '@shared/schema';
import { logger } from '../lib/logger';
import type {
  AttentionActor,
  AttentionFeed,
  AttentionItem,
} from '@shared/lib/attentionFeed';

const PRIORITY_ORDER: Record<AttentionItem['priority'], number> = {
  urgent: 0,
  due_soon: 1,
  informational: 2,
};

/**
 * Pure mapper — booking row → AttentionItem for the requested actor.
 * Exported so behavioral tests can pin the CEO §14-15 matrix (each
 * status × each actor → exact nextAction / destination / priority)
 * without needing a DB fixture.
 */
export function bookingItem(
  actor: AttentionActor,
  row: typeof bookingRequests.$inferSelect,
  he: boolean,
): AttentionItem | null {
  const id = `booking:${row.requestId}`;
  const status = String(row.status ?? '');

  // Actor-scoped derivation — CEO §14 next-action engine.
  //
  // §23 destination discipline: every URL emitted here MUST resolve to
  // a mounted client route. Pet-parent bookings live at:
  //   • /bookings                    — CustomerBookings list (highlights
  //                                    the row via ?requestId=…)
  //   • /booking/confirmation/:id    — confirmation / track / pay landing
  //   • /marketplace/review/:id      — leave-a-review page
  // The old `/bookings/:id` and `/bookings/:id/review` paths never had
  // routes mounted; a tap dead-ended in the SPA 404. Fixed here to
  // route through the pages that actually exist.
  if (actor === 'pet_parent') {
    switch (status) {
      case 'pending':
        return {
          id, actor, domain: 'booking', entityId: row.requestId,
          priority: 'due_soon',
          title: he ? 'ממתין לתגובת ספק' : 'Waiting for provider',
          reason: he ? 'הבקשה שלחת — נעדכן ברגע שהספק יגיב' : 'Your request is in — you\'ll get pinged the moment the provider responds',
          nextAction: 'view',
          destination: `/bookings?requestId=${row.requestId}`,
        };
      case 'payment_pending':
        return {
          id, actor, domain: 'booking', entityId: row.requestId,
          priority: 'urgent',
          title: he ? 'שלמו כדי לאשר את ההזמנה' : 'Pay to confirm your booking',
          reason: he ? 'הספק אישר — הזמנתכם ממתינה לתשלום' : 'The provider accepted — your booking is waiting on payment',
          nextAction: 'pay',
          destination: `/booking/confirmation/${row.requestId}`,
          moneySummary: row.totalCents ? {
            amountCents: Number(row.totalCents),
            currency: 'ILS',
            label: he ? 'סכום לתשלום' : 'Amount due',
          } : undefined,
        };
      case 'confirmed':
      case 'in_progress':
        return {
          id, actor, domain: 'booking', entityId: row.requestId,
          priority: 'informational',
          title: he ? 'ההזמנה מאושרת' : 'Booking confirmed',
          reason: he ? 'עקבו אחרי השירות בזמן אמת' : 'Track the service in real time',
          nextAction: 'track',
          destination: `/booking/confirmation/${row.requestId}`,
        };
      case 'provider_marked_complete':
        return {
          id, actor, domain: 'booking', entityId: row.requestId,
          priority: 'urgent',
          title: he ? 'הספק סימן שסיים — אשרו וכתבו ביקורת' : 'Provider marked done — confirm & review',
          reason: he ? 'סיום השירות ממתין לאישורכם' : 'The service is done pending your confirmation',
          nextAction: 'confirm',
          destination: `/booking/confirmation/${row.requestId}`,
        };
      case 'completed':
        return {
          id, actor, domain: 'booking', entityId: row.requestId,
          priority: 'informational',
          title: he ? 'השאירו ביקורת' : 'Leave a review',
          reason: he ? 'עזרו להורים אחרים לבחור' : 'Help other pet parents choose',
          nextAction: 'review',
          destination: `/marketplace/review/${row.requestId}`,
        };
      default:
        return null;
    }
  }

  // provider
  switch (status) {
    case 'pending':
      return {
        id, actor, domain: 'booking', entityId: row.requestId,
        priority: 'urgent',
        title: he ? 'בקשה חדשה' : 'New request',
        reason: he ? 'לקוח ממתין לתגובה — קבלו או דחו' : 'A customer is waiting — accept or decline',
        nextAction: 'accept_or_decline',
        destination: `/provider/jobs/${row.requestId}`,
      };
    case 'payment_pending':
      return {
        id, actor, domain: 'booking', entityId: row.requestId,
        priority: 'informational',
        title: he ? 'ממתין לתשלום הלקוח' : 'Waiting for customer payment',
        reason: he ? 'אתם קיבלתם — הלקוח משלם עכשיו' : 'You accepted — customer is completing payment',
        nextAction: 'view',
        destination: `/provider/jobs/${row.requestId}`,
      };
    case 'confirmed':
      return {
        id, actor, domain: 'booking', entityId: row.requestId,
        priority: 'due_soon',
        title: he ? 'עבודה מאושרת' : 'Job confirmed',
        reason: he ? 'הכינו את השירות והתחילו בזמן' : 'Prepare the service and start on time',
        nextAction: 'start',
        destination: `/provider/jobs/${row.requestId}`,
      };
    case 'in_progress':
      return {
        id, actor, domain: 'booking', entityId: row.requestId,
        priority: 'urgent',
        title: he ? 'עבודה בביצוע — סיימו כשמוכן' : 'Job in progress — mark complete when done',
        reason: he ? 'הלקוח עוקב בזמן אמת' : 'Customer is tracking in real time',
        nextAction: 'complete',
        destination: `/provider/jobs/${row.requestId}`,
      };
    case 'provider_marked_complete':
      return {
        id, actor, domain: 'booking', entityId: row.requestId,
        priority: 'informational',
        title: he ? 'ממתין לאישור הלקוח' : 'Waiting for customer confirm',
        reason: he ? 'סיימתם — הלקוח מאשר וההכנסה משתחררת' : 'You finished — customer confirms and earnings release',
        nextAction: 'view',
        destination: `/provider/jobs/${row.requestId}`,
      };
    default:
      return null;
  }
}

async function petParentBookingItems(userId: string, he: boolean): Promise<AttentionItem[]> {
  try {
    const rows = await db
      .select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.ownerId, userId),
        inArray(bookingRequests.status, [
          'pending', 'payment_pending', 'confirmed', 'in_progress',
          'provider_marked_complete', 'completed',
        ] as any),
      ))
      .orderBy(desc(bookingRequests.createdAt))
      .limit(20);
    return rows.map((r) => bookingItem('pet_parent', r, he)).filter((x): x is AttentionItem => x !== null);
  } catch (e: any) {
    logger.warn('[AttentionFeed] pet-parent booking probe failed', { userId, err: e?.message });
    return [];
  }
}

async function providerBookingItems(userId: string, he: boolean): Promise<AttentionItem[]> {
  try {
    const rows = await db
      .select()
      .from(bookingRequests)
      .where(and(
        eq(bookingRequests.providerId, userId),
        inArray(bookingRequests.status, [
          'pending', 'payment_pending', 'confirmed', 'in_progress',
          'provider_marked_complete',
        ] as any),
      ))
      .orderBy(desc(bookingRequests.createdAt))
      .limit(20);
    return rows.map((r) => bookingItem('provider', r, he)).filter((x): x is AttentionItem => x !== null);
  } catch (e: any) {
    logger.warn('[AttentionFeed] provider booking probe failed', { userId, err: e?.message });
    return [];
  }
}

function sortItems(items: AttentionItem[]): AttentionItem[] {
  return items.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    // Same priority → prefer the one with a nearer dueAt (undefined
    // sorts last), then leave original order.
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return 0;
  });
}

/**
 * CEO §80 Phase 1 Journey Brain probe — eGift value the pet parent owns
 * and can still redeem. Reads canonical e_vouchers (owner_uid = userId,
 * status CLAIMED/ACTIVE, remaining_amount > 0). NEVER mutates. NEVER
 * invents balance — a bad row → dropped from the projection, so the
 * client can't render "you have money" for money that isn't there.
 */
async function petParentEgiftItems(userId: string, he: boolean): Promise<AttentionItem[]> {
  try {
    const rows = await db
      .select({
        id: eVouchers.id,
        remainingAmount: eVouchers.remainingAmount,
        currency: eVouchers.currency,
        expiresAt: eVouchers.expiresAt,
        status: eVouchers.status,
        codeLast4: eVouchers.codeLast4,
      })
      .from(eVouchers)
      .where(and(
        eq(eVouchers.ownerUid, userId),
        inArray(eVouchers.status, ['CLAIMED', 'ACTIVE'] as any),
        gt(eVouchers.remainingAmount, '0' as any),
      ))
      .orderBy(desc(eVouchers.createdAt))
      .limit(10);
    const nowMs = Date.now();
    return rows
      .map((r): AttentionItem | null => {
        const remainingIls = Number(r.remainingAmount);
        if (!Number.isFinite(remainingIls) || remainingIls <= 0) return null;
        const amountCents = Math.round(remainingIls * 100);
        const expiresAt = r.expiresAt ? new Date(r.expiresAt).toISOString() : undefined;
        const expiringSoon = r.expiresAt
          ? (new Date(r.expiresAt).getTime() - nowMs) < 30 * 24 * 60 * 60 * 1000
          : false;
        const priority: AttentionItem['priority'] = expiringSoon ? 'due_soon' : 'informational';
        return {
          id: `egift:${r.id}`,
          actor: 'pet_parent',
          domain: 'egift',
          entityId: r.id,
          priority,
          title: he
            ? (expiringSoon ? 'eGift שתוקפו פג בקרוב' : 'יש לך יתרת eGift')
            : (expiringSoon ? 'eGift expires soon' : 'You have eGift balance'),
          reason: he
            ? `יתרה זמינה: ₪${remainingIls.toFixed(2)}${expiresAt ? ' — יש לנצל לפני התפוגה' : ''}`
            : `Available: ₪${remainingIls.toFixed(2)}${expiresAt ? ' — use it before it expires' : ''}`,
          nextAction: 'view',
          destination: `/egift/balance/${r.id}`,
          dueAt: expiresAt,
          moneySummary: {
            amountCents,
            currency: 'ILS',
            label: he ? 'יתרת eGift' : 'eGift balance',
          },
        };
      })
      .filter((x): x is AttentionItem => x !== null);
  } catch (e: any) {
    logger.warn('[AttentionFeed] pet-parent egift probe failed', { userId, err: e?.message });
    return [];
  }
}

/**
 * CEO §46 + §80 Journey Brain — cash-wallet + wash-package value
 * probe. Reads canonical wallet_accounts (user_id = userId, one row
 * per user via UNIQUE constraint). Emits ONE consolidated
 * informational item when the caller holds usable value the app can
 * safely nudge them to spend.
 *
 * "Usable value" is cash-wallet balance (in cents) OR wash-package
 * credits. The mapper reads these DIRECTLY off the row — never
 * arithmetic, never invented balance (CEO §46: AI never edits the
 * ledger, only projects canonical truth).
 *
 * eGift is intentionally a SEPARATE probe (eVouchers) so a customer
 * with both wallet + eGift sees two distinct value cards, not one
 * merged number.
 */
async function petParentWalletItems(userId: string, he: boolean): Promise<AttentionItem[]> {
  try {
    const rows = await db
      .select({
        walletId: walletAccounts.walletId,
        cashWalletBalanceCents: walletAccounts.cashWalletBalanceCents,
        washPackageCredits: walletAccounts.washPackageCredits,
      })
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId))
      .limit(1);
    if (!rows.length) return [];
    const r = rows[0];
    const cashCents = Number(r.cashWalletBalanceCents ?? 0);
    const washCredits = Number(r.washPackageCredits ?? 0);
    // Signal threshold: any positive balance OR any wash package
    // credit. Zero + zero → no home nudge.
    const hasCash = Number.isFinite(cashCents) && cashCents > 0;
    const hasPackages = Number.isFinite(washCredits) && washCredits > 0;
    if (!hasCash && !hasPackages) return [];
    const cashIls = cashCents / 100;
    const reasonParts: string[] = [];
    if (hasCash) {
      reasonParts.push(he
        ? `₪${cashIls.toFixed(2)} בארנק`
        : `₪${cashIls.toFixed(2)} in wallet`);
    }
    if (hasPackages) {
      reasonParts.push(he
        ? `${washCredits} חבילות שטיפה`
        : `${washCredits} wash package${washCredits === 1 ? '' : 's'}`);
    }
    return [{
      id: `wallet:${r.walletId}`,
      actor: 'pet_parent',
      domain: 'wallet',
      entityId: r.walletId,
      priority: 'informational',
      title: he ? 'יש לך יתרה פעילה' : 'You have available balance',
      reason: reasonParts.join(he ? ' · ' : ' · '),
      nextAction: 'view',
      destination: '/my-wallet',
      moneySummary: hasCash
        ? { amountCents: cashCents, currency: 'ILS', label: he ? 'יתרת ארנק' : 'Wallet balance' }
        : undefined,
    }];
  } catch (e: any) {
    logger.warn('[AttentionFeed] pet-parent wallet probe failed', { userId, err: e?.message });
    return [];
  }
}

/**
 * CEO §48 Journey Brain — Pet Passport / KYA-stale probe. Reads the
 * pets the caller owns and surfaces the OLDEST care-profile-stale
 * signal as ONE informational item ("Bruno's care profile hasn't been
 * reviewed since May").
 *
 * A pet is stale if medical_consent_updated_at is NULL OR older than
 * 90 days. Consolidating into ONE item (not one per pet) matches CEO
 * §59 frequency control — the customer's home shows a single "review
 * pet profiles" nudge, not a stack. The reason copy names the oldest
 * pet so it feels personal.
 */
async function petParentKyaStaleItems(userId: string, he: boolean): Promise<AttentionItem[]> {
  try {
    const STALE_MS = 90 * 24 * 60 * 60 * 1000;
    const rows = await db
      .select({
        id: pets.id,
        name: pets.name,
        medicalConsentUpdatedAt: pets.medicalConsentUpdatedAt,
      })
      .from(pets)
      .where(eq(pets.userId, userId))
      .limit(20);
    if (!rows.length) return [];
    const nowMs = Date.now();
    // The oldest stale row wins the reason copy. NULL sorts as
    // maximally stale (never-reviewed treated older than any date).
    let oldest: { id: number; name: string; ts: number } | null = null;
    for (const r of rows) {
      const ts = r.medicalConsentUpdatedAt ? new Date(r.medicalConsentUpdatedAt).getTime() : 0;
      const stale = !r.medicalConsentUpdatedAt || (nowMs - ts) > STALE_MS;
      if (!stale) continue;
      if (!oldest || ts < oldest.ts) {
        oldest = { id: r.id, name: String(r.name ?? ''), ts };
      }
    }
    if (!oldest) return [];
    const name = oldest.name || (he ? 'החיות שלך' : 'your pets');
    return [{
      id: `pet_passport:kya_stale:${userId}`,
      actor: 'pet_parent',
      domain: 'pet_passport',
      entityId: String(oldest.id),
      priority: 'informational',
      title: he
        ? `סקירת פרופיל טיפול — ${name}`
        : `Review care profile — ${name}`,
      reason: he
        ? 'פרופיל הטיפול לא עודכן ב-90 הימים האחרונים. אשרו שהוא עדיין נכון.'
        : 'The care profile hasn\'t been reviewed in the last 90 days. Confirm it\'s still accurate.',
      nextAction: 'view',
      destination: '/pets',
    }];
  } catch (e: any) {
    logger.warn('[AttentionFeed] pet-parent kya-stale probe failed', { userId, err: e?.message });
    return [];
  }
}

/**
 * CEO §21 + §47 Journey Brain — Prestige benefit-ready probe. Reads
 * canonical privilege_members (firebase_uid = userId, status = active).
 * Emits ONE informational item when the member has positive points OR
 * a non-bronze tier — the loyalty dashboard is the safe next-best
 * action.
 *
 * IMPORTANT CEO §47 rule: NEVER invent a benefit / discount / voucher.
 * The item is a nudge to open the dashboard where canonical redemption
 * authority computes the real available benefits. The mapper reads
 * tier + points DIRECTLY off the row — no arithmetic.
 */
async function petParentPrestigeItems(userId: string, he: boolean): Promise<AttentionItem[]> {
  try {
    const rows = await db
      .select({
        memberId: privilegeMembers.memberId,
        tier: privilegeMembers.tier,
        points: privilegeMembers.points,
        status: privilegeMembers.status,
      })
      .from(privilegeMembers)
      .where(and(
        eq(privilegeMembers.firebaseUid, userId),
        eq(privilegeMembers.status, 'active'),
      ))
      .limit(1);
    if (!rows.length) return [];
    const r = rows[0];
    const tierRaw = String(r.tier ?? 'bronze').toLowerCase();
    const points = Number(r.points ?? 0);
    // Signal threshold: any member above bronze OR any member with
    // usable points. A member with a bronze tier and zero points has
    // nothing to act on yet — do not spam their home.
    const hasSignal = (tierRaw !== 'bronze') || (Number.isFinite(points) && points > 0);
    if (!hasSignal) return [];
    // Localized tier label — kept minimal; the real perks copy lives
    // on the loyalty dashboard where the redemption engine speaks.
    const tierLabelHe: Record<string, string> = {
      bronze: 'ברונזה', silver: 'כסף', gold: 'זהב', platinum: 'פלטינה',
    };
    const tierLabelEn: Record<string, string> = {
      bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum',
    };
    const tierLabel = (he ? tierLabelHe[tierRaw] : tierLabelEn[tierRaw]) ?? tierRaw;
    return [{
      id: `prestige:${r.memberId}`,
      actor: 'pet_parent',
      domain: 'prestige',
      entityId: r.memberId,
      priority: 'informational',
      title: he
        ? `Prestige ${tierLabel} — יש לך הטבות`
        : `Prestige ${tierLabel} — you have rewards`,
      reason: he
        ? `${points.toLocaleString('he-IL')} נקודות פעילות — צפו בהטבות הזמינות`
        : `${points.toLocaleString('en-US')} points active — see available rewards`,
      nextAction: 'view',
      destination: '/loyalty/dashboard',
    }];
  } catch (e: any) {
    logger.warn('[AttentionFeed] pet-parent prestige probe failed', { userId, err: e?.message });
    return [];
  }
}

/**
 * CEO §51 provider document expiry probe. Insurance + KYC doc expiry
 * within 30 days becomes a due_soon item; already expired becomes
 * urgent. Reads provider_applications by user_id and picks the most
 * recent row so a resubmission doesn't double-alert.
 */
async function providerDocExpiryItems(userId: string, he: boolean): Promise<AttentionItem[]> {
  try {
    const rows = await db
      .select({
        id: providerApplications.id,
        applicationId: providerApplications.applicationId,
        insuranceExpiresAt: providerApplications.insuranceExpiresAt,
        kycDocumentExpiry: providerApplications.kycDocumentExpiry,
      })
      .from(providerApplications)
      .where(eq(providerApplications.userId, userId))
      .orderBy(desc(providerApplications.createdAt))
      .limit(1);
    if (!rows.length) return [];
    const r = rows[0];
    const nowMs = Date.now();
    const items: AttentionItem[] = [];
    const emitExpiry = (
      label: 'insurance' | 'kyc_document',
      when: Date | string | null,
    ): void => {
      if (!when) return;
      const t = new Date(when).getTime();
      if (!Number.isFinite(t)) return;
      const diffMs = t - nowMs;
      const withinDays = diffMs / (24 * 60 * 60 * 1000);
      // Only surface once inside 30 days OR already expired.
      if (withinDays > 30) return;
      const isExpired = diffMs <= 0;
      const dueAtIso = new Date(t).toISOString();
      const daysCopy = Math.max(0, Math.round(withinDays));
      const isInsurance = label === 'insurance';
      items.push({
        id: `kyc:${r.id}:${label}`,
        actor: 'provider',
        domain: 'kyc',
        entityId: String(r.applicationId ?? r.id),
        priority: isExpired ? 'urgent' : 'due_soon',
        title: he
          ? (isInsurance
              ? (isExpired ? 'ביטוח שלכם פג תוקף' : 'ביטוח שלכם עומד לפוג')
              : (isExpired ? 'מסמך זיהוי פג תוקף' : 'מסמך זיהוי עומד לפוג'))
          : (isInsurance
              ? (isExpired ? 'Your insurance has expired' : 'Your insurance expires soon')
              : (isExpired ? 'Your ID document has expired' : 'Your ID document expires soon')),
        reason: he
          ? (isExpired ? 'יש לחדש כדי להמשיך לקבל הזמנות' : `נשארו ${daysCopy} ימים — חדשו כדי להמשיך לקבל הזמנות`)
          : (isExpired ? 'Renew to keep receiving bookings' : `${daysCopy} days left — renew to keep receiving bookings`),
        nextAction: 'upload',
        destination: '/provider-application/status',
        dueAt: dueAtIso,
      });
    };
    emitExpiry('insurance', r.insuranceExpiresAt as any);
    emitExpiry('kyc_document', r.kycDocumentExpiry as any);
    return items;
  } catch (e: any) {
    logger.warn('[AttentionFeed] provider doc-expiry probe failed', { userId, err: e?.message });
    return [];
  }
}

export async function composeAttentionFeed(actor: AttentionActor, userId: string, he: boolean): Promise<AttentionFeed> {
  if (!userId) {
    return { actor, items: [], composedAt: new Date().toISOString() };
  }
  // CEO §2 + §80 Phase 1 — one composer, many probes. Each probe is
  // independently fail-CLOSED (returns [] on error) so a partial DB
  // outage never nukes the whole feed. Client contract is stable: the
  // items array is always well-formed.
  const items = actor === 'pet_parent'
    ? [
        ...await petParentBookingItems(userId, he),
        ...await petParentEgiftItems(userId, he),
        ...await petParentWalletItems(userId, he),
        ...await petParentPrestigeItems(userId, he),
        ...await petParentKyaStaleItems(userId, he),
      ]
    : [
        ...await providerBookingItems(userId, he),
        ...await providerDocExpiryItems(userId, he),
      ];
  return { actor, items: sortItems(items), composedAt: new Date().toISOString() };
}
