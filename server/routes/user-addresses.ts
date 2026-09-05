import { Router } from "express";
import { db } from "../db";
import { userAddresses } from "../../shared/schema";
import { requireAuth } from "../customAuth";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
import { geocodeAddress } from "../lib/geocode";

const router = Router();

// ~500m threshold in degrees (≈ 0.0045°)
const PROXIMITY_THRESHOLD = 0.0045;

function isNearby(lat1: number, lng1: number, lat2: number, lng2: number): boolean {
  return (
    Math.abs(lat1 - lat2) < PROXIMITY_THRESHOLD &&
    Math.abs(lng1 - lng2) < PROXIMITY_THRESHOLD
  );
}

// GET /api/user/addresses — list all saved addresses for the authenticated user
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    // DTO round 2 (2026-08-22): explicit column projection instead of
    // `.select()`. Self-scoped so cross-user leaks are impossible, but
    // any column added later (geocoder debug, moderation flags, an
    // internalScore) would silently ship on the response — the
    // narrow list keeps the wire contract stable.
    const rows = await db
      .select({
        id: userAddresses.id,
        label: userAddresses.label,
        customLabel: userAddresses.customLabel,
        address: userAddresses.address,
        street: userAddresses.street,
        streetNumber: userAddresses.streetNumber,
        apartment: userAddresses.apartment,
        floor: userAddresses.floor,
        entrance: userAddresses.entrance,
        notes: userAddresses.notes,
        city: userAddresses.city,
        postalCode: userAddresses.postalCode,
        lat: userAddresses.lat,
        lng: userAddresses.lng,
        isDefault: userAddresses.isDefault,
        usageCount: userAddresses.usageCount,
        lastUsedAt: userAddresses.lastUsedAt,
        createdAt: userAddresses.createdAt,
      })
      .from(userAddresses)
      .where(eq(userAddresses.userId, userId))
      .orderBy(desc(userAddresses.isDefault), desc(userAddresses.usageCount), desc(userAddresses.lastUsedAt));
    res.json(rows);
  } catch (err: any) {
    logger.error("GET /addresses error:", err);
    res.status(500).json({ error: "Failed to fetch addresses" });
  }
});

// POST /api/user/addresses — add or upsert a saved address
// Deduplication: if an address with the same lat/lng (within 500m) exists → increment usageCount
// If lat/lng missing: fall back to text match
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const schema = z.object({
      address: z.string().min(3),
      label: z.enum(["home", "work", "other", "custom"]).default("other"),
      customLabel: z.string().max(80).optional(),
      street: z.string().optional(),
      streetNumber: z.string().optional(),
      apartment: z.string().optional(),
      floor: z.string().max(30).optional(),
      entrance: z.string().max(30).optional(),
      notes: z.string().max(500).optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      isDefault: z.boolean().default(false),
    });

    const data = schema.parse(req.body);

    // A2 (2026-06-18): geocode on save so addresses get GPS coordinates, which
    // proximity matching at booking depends on. Free OpenStreetMap (no Google bill).
    // Best-effort: if it fails, we still save the address (just without coords).
    if (data.lat === undefined || data.lng === undefined) {
      const composed = [data.street && `${data.street} ${data.streetNumber ?? ''}`.trim(), data.city, data.postalCode, 'Israel']
        .filter(Boolean).join(', ') || data.address;
      const point = await geocodeAddress(composed);
      if (point) {
        data.lat = point.lat;
        data.lng = point.lng;
        logger.info('[addresses] geocoded on save', { userId, hasCoords: true });
      }
    }

    // Load all existing addresses for this user (count is small, JS proximity check is fine)
    const allAddresses = await db
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.userId, userId));

    // Find a match: prefer lat/lng proximity, fall back to exact text match
    const match = allAddresses.find((a) => {
      if (data.lat !== undefined && data.lng !== undefined && a.lat && a.lng) {
        return isNearby(data.lat, data.lng, Number(a.lat), Number(a.lng));
      }
      return a.address === data.address;
    });

    if (match) {
      const [updated] = await db
        .update(userAddresses)
        .set({
          usageCount: match.usageCount + 1,
          lastUsedAt: new Date(),
          label: data.label,
          customLabel: data.customLabel ?? match.customLabel,
          // Enrich lat/lng if incoming has them but stored doesn't
          lat: match.lat ?? (data.lat?.toString() ?? null),
          lng: match.lng ?? (data.lng?.toString() ?? null),
          postalCode: data.postalCode ?? match.postalCode,
          // Access details — incoming wins (user just re-entered them)
          apartment: data.apartment ?? match.apartment,
          floor: data.floor ?? match.floor,
          entrance: data.entrance ?? match.entrance,
          notes: data.notes ?? match.notes,
          isDefault: data.isDefault ? true : match.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(userAddresses.id, match.id))
        .returning();

      if (data.isDefault) {
        await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, userId));
        await db.update(userAddresses).set({ isDefault: true }).where(eq(userAddresses.id, updated.id));
      }

      return res.json(updated);
    }

    // If isDefault, clear existing default first
    if (data.isDefault) {
      await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, userId));
    }

    // Insert new
    const [inserted] = await db
      .insert(userAddresses)
      .values({
        userId,
        address: data.address,
        label: data.label,
        customLabel: data.customLabel,
        street: data.street,
        streetNumber: data.streetNumber,
        apartment: data.apartment,
        floor: data.floor,
        entrance: data.entrance,
        notes: data.notes,
        city: data.city,
        postalCode: data.postalCode,
        lat: data.lat?.toString(),
        lng: data.lng?.toString(),
        isDefault: data.isDefault,
      })
      .returning();

    res.status(201).json(inserted);
  } catch (err: any) {
    logger.error("POST /addresses error:", err);
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/user/addresses/:id — edit any field, set default, or relabel
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const id = parseInt(req.params.id);

    const schema = z.object({
      label: z.enum(["home", "work", "other", "custom"]).optional(),
      customLabel: z.string().max(80).optional(),
      address: z.string().min(3).optional(),
      street: z.string().optional(),
      streetNumber: z.string().optional(),
      apartment: z.string().optional(),
      floor: z.string().max(30).optional(),
      entrance: z.string().max(30).optional(),
      notes: z.string().max(500).optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      isDefault: z.boolean().optional(),
    });

    const raw = schema.parse(req.body);
    // decimal columns take strings; convert lat/lng
    const data: any = { ...raw, updatedAt: new Date() };
    if (raw.lat !== undefined) data.lat = raw.lat.toString();
    if (raw.lng !== undefined) data.lng = raw.lng.toString();

    // SPRINT/CUSTOMER-HUB-PETS (2026-09-05): this used to clear
    // isDefault on ALL of the caller's addresses BEFORE checking whether
    // `id` actually belongs to them (or exists at all). A bogus/foreign
    // id (stale after a delete, a double-tap race, or a client bug)
    // still 404'd — but only AFTER the caller's own real default had
    // already been wiped, leaving the address book with no default and
    // no way to know it happened. Verify ownership first so a 404 never
    // has this side effect.
    if (data.isDefault) {
      const [owned] = await db
        .select({ id: userAddresses.id })
        .from(userAddresses)
        .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)));
      if (!owned) return res.status(404).json({ error: "Address not found" });
      await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, userId));
    }

    const [updated] = await db
      .update(userAddresses)
      .set(data)
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Address not found" });
    res.json(updated);
  } catch (err: any) {
    logger.error("PATCH /addresses/:id error:", err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/user/addresses/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const id = parseInt(req.params.id);

    const [deleted] = await db
      .delete(userAddresses)
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Address not found" });
    res.json({ success: true });
  } catch (err: any) {
    logger.error("DELETE /addresses/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
