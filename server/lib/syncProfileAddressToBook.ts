import { db } from "../db";
import { userAddresses } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// Keep the saved-address book (`user_addresses`) in sync with the profile's
// permanent address (`users.address/street/...`). Until now these were two
// disconnected stores: editing your profile address never touched the book, so
// the two could silently disagree (address-store fragmentation, board item #4).
//
// This closes the primary gap — a profile-address edit now reflects into the
// book — while being deliberately SAFE:
//   · fail-soft: any error is swallowed and logged; it can NEVER break the
//     profile save that triggered it.
//   · non-destructive: dedups by ~500m proximity / exact text (same rule as the
//     book's own POST), so it never creates a duplicate; on a match it only
//     ENRICHES missing fields and never stomps the user's chosen label / default
//     / access details (floor, entrance, notes).
//   · humble default: it marks the synced address as default ONLY when the book
//     was empty — it never overrides a default the user picked themselves.
// (2026-08-11)

const PROXIMITY_THRESHOLD = 0.0045; // ~500m in degrees

function isNearby(lat1: number, lng1: number, lat2: number, lng2: number): boolean {
  return (
    Math.abs(lat1 - lat2) < PROXIMITY_THRESHOLD &&
    Math.abs(lng1 - lng2) < PROXIMITY_THRESHOLD
  );
}

export interface ProfileAddressForSync {
  address: string;
  street?: string;
  streetNumber?: string;
  apartment?: string;
  city?: string;
  postalCode?: string;
  lat?: number | null;
  lng?: number | null;
}

export async function syncProfileAddressToBook(
  userId: string,
  a: ProfileAddressForSync,
): Promise<void> {
  try {
    if (!a.address || a.address.trim().length < 3) return; // nothing meaningful to sync

    const lat = typeof a.lat === "number" ? a.lat : undefined;
    const lng = typeof a.lng === "number" ? a.lng : undefined;

    const rows = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.userId, userId));

    const match = rows.find((r) => {
      if (lat !== undefined && lng !== undefined && r.lat && r.lng) {
        return isNearby(lat, lng, Number(r.lat), Number(r.lng));
      }
      return r.address === a.address;
    });

    if (match) {
      // Enrich only — never overwrite the user's label / isDefault / access details.
      await db
        .update(userAddresses)
        .set({
          street: a.street ?? match.street,
          streetNumber: a.streetNumber ?? match.streetNumber,
          apartment: a.apartment ?? match.apartment,
          city: a.city ?? match.city,
          postalCode: a.postalCode ?? match.postalCode,
          lat: match.lat ?? (lat?.toString() ?? null),
          lng: match.lng ?? (lng?.toString() ?? null),
          updatedAt: new Date(),
        })
        .where(eq(userAddresses.id, match.id));
      return;
    }

    await db.insert(userAddresses).values({
      userId,
      address: a.address,
      label: "home",
      street: a.street,
      streetNumber: a.streetNumber,
      apartment: a.apartment,
      city: a.city,
      postalCode: a.postalCode,
      lat: lat?.toString(),
      lng: lng?.toString(),
      isDefault: rows.length === 0, // only default when the book was empty
    });
  } catch (e: any) {
    logger.warn("[profile→address-book sync] non-fatal:", e?.message || e);
  }
}
