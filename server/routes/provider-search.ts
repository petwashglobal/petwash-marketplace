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
import { logger } from "../lib/logger";

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const filters = normalizeProviderSearchFilters(req.query);
    // Route is mounted behind optionalFirebaseToken — when the caller is
    // signed in, pass their uid so runProviderSearch's self-exclusion
    // actually fires (a provider must never be matched to themselves).
    const callerUserId =
      (req as any).user?.uid || (req as any).firebaseUser?.uid || undefined;
    const result = await runProviderSearch(filters, callerUserId);

    res.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    // This route is PUBLIC (optionalFirebaseToken) — `reason: error.message`
    // echoed raw DB / driver text to anonymous callers. Log it, don't ship it.
    logger.error("[ProviderSearch] search failed", { error: error?.message });
    res.status(500).json({
      ok: false,
      error: "Provider search failed",
    });
  }
});

export default router;
