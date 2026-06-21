/**
 * MembershipCardService — issues + verifies PetWash membership credentials.
 *
 * One card per user. The QR/barcode carry only an opaque token (never personal
 * data). On scan we look up the token, enforce card_status, handle expiry, return
 * the allowed benefits, and log every scan. Admins can freeze, regenerate the
 * QR/barcode, and link a Nayax customer/card id.
 */
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  membershipCards,
  cardScanEvents,
  TIER_CODE,
  CARD_TIERS,
  type MembershipCard,
} from "@shared/schema-membership-cards";
import { logger } from "../lib/logger";

type Tier = (typeof CARD_TIERS)[number];
type ScanType = "qr" | "barcode" | "nfc";

/** Tier → member discount percentage shown on a successful scan. */
const TIER_DISCOUNT: Record<Tier, number> = {
  standard: 0,
  gold: 5,
  platinum: 10,
  founder: 15,
  vip: 20,
};

function randomDigits(n: number): string {
  let out = "";
  while (out.length < n) out += crypto.randomInt(0, 10).toString();
  return out.slice(0, n);
}

/** Mod-36 check char so a mistyped barcode is caught. */
function checkChars(seed: string): string {
  const sum = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const A = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return A[sum % 36] + A[(sum * 7) % 36];
}

export class MembershipCardService {
  /** Get the user's card, creating it on first access. */
  static async getOrCreateCard(userId: string, tier: Tier = "standard"): Promise<MembershipCard> {
    const [existing] = await db
      .select()
      .from(membershipCards)
      .where(eq(membershipCards.userId, userId))
      .limit(1);
    if (existing) return existing;

    const code = TIER_CODE[tier] ?? "STD";
    // Retry on the (rare) unique collision of a generated id/token.
    for (let attempt = 0; attempt < 6; attempt++) {
      const memberDigits = randomDigits(6);
      const memberId = `PW-${code}-${memberDigits}`;
      const cardNumberDisplay = randomDigits(16).replace(/(\d{4})(?=\d)/g, "$1 ");
      const qrToken = crypto.randomBytes(24).toString("base64url");
      const barcodeValue = `PW${code}${memberDigits}${checkChars(`${code}${memberDigits}`)}`;
      try {
        const [card] = await db
          .insert(membershipCards)
          .values({ userId, memberId, cardNumberDisplay, qrToken, barcodeValue, tier, cardStatus: "active" })
          .returning();
        logger.info("[MembershipCard] issued", { userId, memberId, tier });
        return card;
      } catch (e: any) {
        if (attempt === 5) throw e;
        // unique violation → regenerate and retry
      }
    }
    throw new Error("Could not allocate a unique membership card");
  }

  private static newScanId(): string {
    return `SCAN-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  }

  private static async logScan(input: {
    card?: MembershipCard | null;
    scanType: ScanType;
    result: "approved" | "rejected" | "expired" | "suspicious";
    stationId?: string | null;
    providerId?: string | null;
    detail?: string;
  }): Promise<void> {
    try {
      await db.insert(cardScanEvents).values({
        scanId: this.newScanId(),
        userId: input.card?.userId ?? null,
        memberId: input.card?.memberId ?? null,
        stationId: input.stationId ?? null,
        providerId: input.providerId ?? null,
        scanType: input.scanType,
        result: input.result,
        detail: input.detail ?? null,
      });
    } catch (e: any) {
      logger.warn("[MembershipCard] scan log failed (non-fatal)", { error: e?.message });
    }
  }

  /**
   * Verify a scanned token/code. Returns the result + (on approval) the allowed
   * benefits. Always logs the scan. Never throws on a normal rejection.
   */
  static async verifyScan(input: {
    token: string;
    scanType?: ScanType;
    stationId?: string | null;
    providerId?: string | null;
  }): Promise<
    | { ok: true; status: "active"; memberId: string; tier: string; benefits: { discountPercent: number; washCredits: number; loyaltyPoints: number } }
    | { ok: false; status: "rejected" | "expired" | "suspicious"; message: string }
  > {
    const scanType = input.scanType ?? "qr";
    const lookupCol = scanType === "barcode" ? membershipCards.barcodeValue : membershipCards.qrToken;
    const [card] = await db.select().from(membershipCards).where(eq(lookupCol, input.token)).limit(1);

    if (!card) {
      await this.logScan({ scanType, result: "suspicious", stationId: input.stationId, providerId: input.providerId, detail: "token not found" });
      return { ok: false, status: "suspicious", message: "Card not recognised." };
    }

    // Expiry
    if (card.validUntil && new Date(card.validUntil).getTime() < Date.now()) {
      await this.logScan({ card, scanType, result: "expired", stationId: input.stationId, providerId: input.providerId });
      return { ok: false, status: "expired", message: "Membership expired — please renew." };
    }

    // Status gate
    if (card.cardStatus !== "active") {
      await this.logScan({ card, scanType, result: "rejected", stationId: input.stationId, providerId: input.providerId, detail: `status=${card.cardStatus}` });
      return { ok: false, status: "rejected", message: `Card is ${card.cardStatus}.` };
    }

    await db
      .update(membershipCards)
      .set({ lastScanAt: new Date(), lastUsedStationId: input.stationId ?? card.lastUsedStationId, updatedAt: new Date() })
      .where(eq(membershipCards.id, card.id));
    await this.logScan({ card, scanType, result: "approved", stationId: input.stationId, providerId: input.providerId });

    const tier = (card.tier as Tier) in TIER_DISCOUNT ? (card.tier as Tier) : "standard";
    return {
      ok: true,
      status: "active",
      memberId: card.memberId,
      tier: card.tier,
      benefits: {
        discountPercent: TIER_DISCOUNT[tier],
        washCredits: card.washCreditBalance,
        loyaltyPoints: card.loyaltyPoints,
      },
    };
  }

  // ── Admin controls ─────────────────────────────────────────────────────────

  static async setStatus(userId: string, status: string, reason?: string): Promise<void> {
    await db
      .update(membershipCards)
      .set({ cardStatus: status, frozenReason: reason ?? null, updatedAt: new Date() })
      .where(eq(membershipCards.userId, userId));
    logger.info("[MembershipCard] status changed", { userId, status, reason });
  }

  static async regenerateQr(userId: string): Promise<string> {
    const qrToken = crypto.randomBytes(24).toString("base64url");
    await db.update(membershipCards).set({ qrToken, updatedAt: new Date() }).where(eq(membershipCards.userId, userId));
    return qrToken;
  }

  static async regenerateBarcode(userId: string): Promise<string> {
    const [card] = await db.select().from(membershipCards).where(eq(membershipCards.userId, userId)).limit(1);
    if (!card) throw new Error("Card not found");
    const digits = randomDigits(6);
    const code = card.memberId.split("-")[1] ?? "STD";
    const barcodeValue = `PW${code}${digits}${checkChars(`${code}${digits}`)}`;
    await db.update(membershipCards).set({ barcodeValue, updatedAt: new Date() }).where(eq(membershipCards.userId, userId));
    return barcodeValue;
  }

  static async linkNayax(userId: string, nayaxCustomerId?: string | null, nayaxCardId?: string | null): Promise<void> {
    await db
      .update(membershipCards)
      .set({ linkedNayaxCustomerId: nayaxCustomerId ?? null, linkedNayaxCardId: nayaxCardId ?? null, updatedAt: new Date() })
      .where(eq(membershipCards.userId, userId));
  }
}
