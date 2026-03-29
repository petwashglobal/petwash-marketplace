/**
 * MARKETPLACE PROVIDER SEARCH ROUTE
 * GET /api/providers/search
 *
 * Online service domains only: pet_sitting, dog_walking, grooming, transport, daycare.
 * NOT for K9000.
 */

import { Router } from "express";
import { normalizeProviderSearchFilters } from "../utils/providerSearch";
import { runProviderSearch } from "../services/providerSearchService";

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const filters = normalizeProviderSearchFilters(req.query);
    const result = await runProviderSearch(filters);

    res.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: "Provider search failed",
      reason: error?.message || "Unknown error",
    });
  }
});

export default router;
