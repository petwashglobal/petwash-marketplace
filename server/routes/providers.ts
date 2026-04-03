import express from "express";
import { db } from "../lib/firebase-admin";
import { requireAuth } from "../customAuth";

const router = express.Router();

// ─── Safe public field allowlists ─────────────────────────────────────────────
// SECURITY: Never expose ...doc.data() on public endpoints.
// These allowlists define exactly which fields are safe for unauthenticated callers.

const SITTER_PUBLIC_FIELDS = new Set([
  'displayName', 'bio', 'location', 'city', 'areas', 'profilePhoto',
  'averageRating', 'reviewCount', 'dailyRate', 'nightlyRate', 'active',
  'specializations', 'services', 'yearsExperience', 'languages',
  'hasOwnPets', 'petTypes', 'maxPets', 'homeType', 'gardenAccess',
  'acceptsUnsocialized', 'isVerified', 'badgeLevel', 'onlineNow', 'responseTime',
]);

const WALKER_PUBLIC_FIELDS = new Set([
  'displayName', 'bio', 'location', 'city', 'areas', 'profilePhoto',
  'averageRating', 'reviewCount', 'hourlyRate', 'active',
  'specializations', 'services', 'yearsExperience', 'languages',
  'maxDogs', 'dogSizes', 'offLeashCapable', 'isVerified', 'badgeLevel',
  'onlineNow', 'responseTime', 'petTypes',
]);

const DRIVER_PUBLIC_FIELDS = new Set([
  'displayName', 'bio', 'location', 'city', 'areas', 'profilePhoto',
  'averageRating', 'reviewCount', 'active', 'vehicleType', 'vehicleMake',
  'vehicleModel', 'petFriendlyVehicle', 'services', 'yearsExperience',
  'languages', 'isVerified', 'badgeLevel', 'onlineNow', 'responseTime',
  'currentlyAvailable', 'maxAnimals', 'animalTypes',
]);

function pickPublic(data: Record<string, unknown>, allowedFields: Set<string>, id: string): Record<string, unknown> {
  const safe: Record<string, unknown> = { id };
  for (const field of allowedFields) {
    if (field in data) safe[field] = data[field];
  }
  return safe;
}

// Get all sitters (Sitter Suite)
router.get("/sitters", async (req, res) => {
  try {
    const { location, minRating, maxPrice, startDate, endDate } = req.query;

    let query = db.collection("sitter_profiles").where("active", "==", true);

    if (minRating) {
      query = query.where("averageRating", ">=", parseFloat(minRating as string));
    }

    if (maxPrice) {
      query = query.where("dailyRate", "<=", parseFloat(maxPrice as string));
    }

    const snapshot = await query.get();
    const sitters = snapshot.docs.map((doc) => pickPublic(doc.data() as Record<string, unknown>, SITTER_PUBLIC_FIELDS, doc.id));

    res.json({ sitters });
  } catch (error: any) {
    console.error("[Providers] Error fetching sitters:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get single sitter profile
router.get("/sitters/:sitterId", async (req, res) => {
  try {
    const { sitterId } = req.params;
    const doc = await db.collection("sitter_profiles").doc(sitterId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Sitter not found" });
    }

    res.json({ sitter: pickPublic(doc.data() as Record<string, unknown>, SITTER_PUBLIC_FIELDS, doc.id) });
  } catch (error: any) {
    console.error("[Providers] Error fetching sitter:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create/update sitter profile
router.post("/sitters/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const profileData = {
      ...req.body,
      userId,
      active: true,
      updatedAt: new Date(),
    };

    await db.collection("sitter_profiles").doc(userId).set(profileData, { merge: true });
    res.json({ success: true, profileId: userId });
  } catch (error: any) {
    console.error("[Providers] Error saving sitter profile:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get all walkers (Walk My Pet)
router.get("/walkers", async (req, res) => {
  try {
    const { location, serviceArea, minRating, maxPrice } = req.query;

    let query = db.collection("walker_profiles").where("active", "==", true);

    if (minRating) {
      query = query.where("averageRating", ">=", parseFloat(minRating as string));
    }

    if (maxPrice) {
      query = query.where("hourlyRate", "<=", parseFloat(maxPrice as string));
    }

    const snapshot = await query.get();
    const walkers = snapshot.docs.map((doc) => pickPublic(doc.data() as Record<string, unknown>, WALKER_PUBLIC_FIELDS, doc.id));

    res.json({ walkers });
  } catch (error: any) {
    console.error("[Providers] Error fetching walkers:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get single walker profile
router.get("/walkers/:walkerId", async (req, res) => {
  try {
    const { walkerId } = req.params;
    const doc = await db.collection("walker_profiles").doc(walkerId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Walker not found" });
    }

    res.json({ walker: pickPublic(doc.data() as Record<string, unknown>, WALKER_PUBLIC_FIELDS, doc.id) });
  } catch (error: any) {
    console.error("[Providers] Error fetching walker:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create/update walker profile
router.post("/walkers/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const profileData = {
      ...req.body,
      userId,
      active: true,
      updatedAt: new Date(),
    };

    await db.collection("walker_profiles").doc(userId).set(profileData, { merge: true });
    res.json({ success: true, profileId: userId });
  } catch (error: any) {
    console.error("[Providers] Error saving walker profile:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get all drivers (PetTrek)
router.get("/drivers", async (req, res) => {
  try {
    const { location, vehicleType, minRating, available } = req.query;

    let query = db.collection("driver_profiles").where("active", "==", true);

    if (minRating) {
      query = query.where("averageRating", ">=", parseFloat(minRating as string));
    }

    if (vehicleType) {
      query = query.where("vehicleType", "==", vehicleType);
    }

    if (available === "true") {
      query = query.where("currentlyAvailable", "==", true);
    }

    const snapshot = await query.get();
    const drivers = snapshot.docs.map((doc) => pickPublic(doc.data() as Record<string, unknown>, DRIVER_PUBLIC_FIELDS, doc.id));

    res.json({ drivers });
  } catch (error: any) {
    console.error("[Providers] Error fetching drivers:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get single driver profile
router.get("/drivers/:driverId", async (req, res) => {
  try {
    const { driverId } = req.params;
    const doc = await db.collection("driver_profiles").doc(driverId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.json({ driver: pickPublic(doc.data() as Record<string, unknown>, DRIVER_PUBLIC_FIELDS, doc.id) });
  } catch (error: any) {
    console.error("[Providers] Error fetching driver:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create/update driver profile
router.post("/drivers/profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const profileData = {
      ...req.body,
      userId,
      active: true,
      updatedAt: new Date(),
    };

    await db.collection("driver_profiles").doc(userId).set(profileData, { merge: true });
    res.json({ success: true, profileId: userId });
  } catch (error: any) {
    console.error("[Providers] Error saving driver profile:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
