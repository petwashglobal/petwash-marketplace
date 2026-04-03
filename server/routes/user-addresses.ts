import { Router } from "express";
import { db } from "../db";
import { userAddresses } from "../../shared/schema";
import { requireAuth } from "../customAuth";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
const router = Router();

// GET /api/user/addresses — list all saved addresses for the authenticated user
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const rows = await db
      .select()
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
// If an address with the same text already exists, increment usageCount + update lastUsedAt
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
      city: z.string().optional(),
      postalCode: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      isDefault: z.boolean().default(false),
    });

    const data = schema.parse(req.body);

    // Check if this address already exists for the user
    const existing = await db
      .select()
      .from(userAddresses)
      .where(and(eq(userAddresses.userId, userId), eq(userAddresses.address, data.address)))
      .limit(1);

    if (existing.length > 0) {
      // Upsert: increment usage, update lastUsed
      const [updated] = await db
        .update(userAddresses)
        .set({
          usageCount: existing[0].usageCount + 1,
          lastUsedAt: new Date(),
          label: data.label,
          customLabel: data.customLabel ?? existing[0].customLabel,
          isDefault: data.isDefault ? true : existing[0].isDefault,
        })
        .where(eq(userAddresses.id, existing[0].id))
        .returning();

      if (data.isDefault) {
        // Clear default flag from all other addresses
        await db
          .update(userAddresses)
          .set({ isDefault: false })
          .where(and(eq(userAddresses.userId, userId)));
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

// PATCH /api/user/addresses/:id — update label or set as default
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.uid;
    const id = parseInt(req.params.id);

    const schema = z.object({
      label: z.enum(["home", "work", "other", "custom"]).optional(),
      customLabel: z.string().max(80).optional(),
      isDefault: z.boolean().optional(),
    });

    const data = schema.parse(req.body);

    if (data.isDefault) {
      await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, userId));
    }

    const [updated] = await db
      .update(userAddresses)
      .set({ ...data })
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
