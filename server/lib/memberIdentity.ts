/**
 * ONE member id (2026-09-12).
 *
 * Six different "member numbers" were shown to the same human depending on
 * the surface: membership_cards.member_id (PW-2026-000123), the pass id
 * (PW-4587-2043) on the Apple/Google pass and the pass HTML page, a
 * `PW-<uid tail>` in the loyalty and Prestige welcome emails, the
 * privilege_members.member_id (PWP-…), a Firestore prestige_passes.cardNumber
 * (<uid4><ts8>), and a `PW-<serial tail>` derived on /api/prestige-pass/wallet.
 *
 * The canonical, for-life number is the MEMBERSHIP CARD id — the one printed
 * on the physical card (MembershipCardService). Every other surface now
 * DISPLAYS that id. Internal keys (pass id, privilege member id, serials)
 * remain what they are; they are just no longer shown as "Member ID".
 *
 * Format note: the CEO card mock shows `PW-PLT-000128` (tier in the id). The
 * issued id is `PW-<year>-<6 digits>` on purpose — a tier-based id would
 * change on every upgrade, and a member number must never change. The TIER
 * is printed next to it and follows the member (cardTierFromMemberTier).
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { membershipCards } from '@shared/schema-membership-cards';
import { logger } from './logger';
import { resolveMemberTier } from './memberTier';
import { MembershipCardService, cardTierFromMemberTier } from '../services/MembershipCardService';

export interface MemberIdentity {
  memberId: string;
  cardNumberDisplay: string;
  barcodeValue: string;
  /** Scan-to-verify URL embedded in the card QR (identity only, no value). */
  qrUrl: string;
  tier: string;
  status: string;
}

const QR_BASE = 'https://petwash.co.il/m/';

function fromCard(card: {
  memberId: string; cardNumberDisplay: string; barcodeValue: string; qrToken: string; tier: string; cardStatus: string;
}): MemberIdentity {
  return {
    memberId: card.memberId,
    cardNumberDisplay: card.cardNumberDisplay,
    barcodeValue: card.barcodeValue,
    qrUrl: `${QR_BASE}${card.qrToken}`,
    tier: card.tier,
    status: card.cardStatus,
  };
}

/** Read-only: the member's canonical identity, or null when no card was issued yet. Never throws. */
export async function findMemberIdentity(userId: string): Promise<MemberIdentity | null> {
  try {
    const [card] = await db
      .select({
        memberId: membershipCards.memberId,
        cardNumberDisplay: membershipCards.cardNumberDisplay,
        barcodeValue: membershipCards.barcodeValue,
        qrToken: membershipCards.qrToken,
        tier: membershipCards.tier,
        cardStatus: membershipCards.cardStatus,
      })
      .from(membershipCards)
      .where(eq(membershipCards.userId, userId))
      .limit(1);
    return card ? fromCard(card) : null;
  } catch (err) {
    logger.warn('[MemberIdentity] lookup failed (treating as no card)', { userId, err: String((err as Error)?.message ?? err) });
    return null;
  }
}

/**
 * The member's canonical identity, issuing the card on first use. Tier is
 * resolved the same way GET /api/membership/card does (user row + Prestige
 * enrolment) unless a member tier is passed in. Returns null only when the
 * database refused — callers keep their old fallback for that case.
 */
export async function ensureMemberIdentity(userId: string, memberTierHint?: string | null): Promise<MemberIdentity | null> {
  try {
    let memberTier = memberTierHint ?? null;
    if (!memberTier) {
      const [u] = await db.select({ loyaltyTier: users.loyaltyTier, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
      memberTier = await resolveMemberTier((u as any)?.loyaltyTier, (u as any)?.email);
    }
    const card = await MembershipCardService.getOrCreateCard(userId, cardTierFromMemberTier(memberTier));
    return fromCard(card);
  } catch (err) {
    logger.error('[MemberIdentity] ensure failed', { userId, err: String((err as Error)?.message ?? err) });
    return null;
  }
}

/** The number to SHOW as "Member ID": the card id when it exists, else the caller's internal key. */
export async function displayMemberId(userId: string, fallback: string): Promise<string> {
  const identity = await findMemberIdentity(userId);
  return identity?.memberId ?? fallback;
}
