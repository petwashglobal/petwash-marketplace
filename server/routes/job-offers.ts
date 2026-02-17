/**
 * JOB OFFERS API 2026 - Enterprise Dispatch with Batched Waves
 * 
 * Endpoints for operators to receive, accept, and reject job offers
 * Real-time job marketplace for Sitter Suite, Walk My Pet (PetTrek coming soon)
 * 
 * Features:
 * - Batched dispatch with adaptive radius expansion
 * - Smart ranking score for operator selection
 * - First-accept-wins atomic assignment
 * - Offer cooldown anti-spam protection
 * - Dispatch status tracking per wave
 */

import { Router } from "express";
import { JobDispatchService } from "../services/JobDispatchService";
import { logger } from "../lib/logger";
import { z } from "zod";
import { requireAuth } from "../customAuth";

const router = Router();

// ==================== VALIDATION SCHEMAS ====================

const createJobOfferSchema = z.object({
  bookingId: z.string(),
  platform: z.enum(["sitter-suite", "walk-my-pet", "pettrek"]),
  customerId: z.string(),
  customerName: z.string(),
  customerPaymentToken: z.string().optional().default(""),
  serviceType: z.string(),
  serviceDate: z.string().transform(val => new Date(val)),
  duration: z.number().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
  }),
  baseAmount: z.number(),
  platformFee: z.number(),
  vat: z.number(),
  totalCharge: z.number(),
  operatorPayout: z.number(),
  currency: z.string().default("ILS"),
  petIds: z.array(z.string()).optional(),
  specialInstructions: z.string().optional(),
  metadata: z.any().optional(),
});

const acceptJobOfferSchema = z.object({
  operatorId: z.string(),
});

const rejectJobOfferSchema = z.object({
  operatorId: z.string(),
  reason: z.string().optional(),
});

const updateOperatorPresenceSchema = z.object({
  operatorId: z.string(),
  platform: z.enum(["sitter-suite", "walk-my-pet", "pettrek"]),
  status: z.enum(["online", "offline", "busy", "on_job"]),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number(),
  }).optional(),
});

// ==================== ENDPOINTS ====================

/**
 * POST /api/job-offers/create
 * Create a new job offer and start batched wave dispatch
 */
router.post("/create", requireAuth, async (req, res) => {
  try {
    const validatedData = createJobOfferSchema.parse(req.body);
    
    if (validatedData.platform === "pettrek") {
      return res.status(400).json({
        success: false,
        error: "PetTrek dispatch is coming soon. Currently available: Sitter Suite, Walk My Pet.",
      });
    }

    const result = await JobDispatchService.createJobOffer(validatedData);
    
    if (result.success) {
      res.json({
        success: true,
        jobOfferId: result.jobOfferId,
        paymentIntentId: result.paymentIntentId,
        message: "Job offer created - dispatching to nearby providers",
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error("[JobOffers API] Error creating job offer", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/job-offers/:id/accept
 * Operator accepts a job offer (first-accept-wins)
 */
router.post("/:id/accept", requireAuth, async (req, res) => {
  try {
    const { id: jobOfferId } = req.params;
    const { operatorId } = acceptJobOfferSchema.parse(req.body);
    
    const result = await JobDispatchService.acceptJobOffer(jobOfferId, operatorId);
    
    if (result.success) {
      res.json({
        success: true,
        jobOffer: result.jobOffer,
        message: "Job accepted - you got it!",
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error("[JobOffers API] Error accepting job offer", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/job-offers/:id/reject
 * Operator rejects a job offer (triggers cooldown tracking)
 */
router.post("/:id/reject", requireAuth, async (req, res) => {
  try {
    const { id: jobOfferId } = req.params;
    const { operatorId, reason } = rejectJobOfferSchema.parse(req.body);
    
    const result = await JobDispatchService.rejectJobOffer(jobOfferId, operatorId, reason);
    
    if (result.success) {
      res.json({
        success: true,
        message: "Job offer rejected",
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error("[JobOffers API] Error rejecting job offer", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/job-offers/:id/dispatch-status
 * Get real-time dispatch status including wave progress
 */
router.get("/:id/dispatch-status", requireAuth, async (req, res) => {
  try {
    const { id: jobOfferId } = req.params;
    
    const status = await JobDispatchService.getDispatchStatus(jobOfferId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: "Job offer not found",
      });
    }
    
    res.json({
      success: true,
      dispatch: status,
    });
  } catch (error) {
    logger.error("[JobOffers API] Error getting dispatch status", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/job-offers/operator/:operatorId
 * Get pending job offers for an operator
 */
router.get("/operator/:operatorId", requireAuth, async (req, res) => {
  try {
    const { operatorId } = req.params;
    const { platform } = req.query as { platform: string };
    
    if (!platform) {
      return res.status(400).json({
        success: false,
        error: "Platform query parameter required",
      });
    }
    
    const offers = await JobDispatchService.getOperatorJobOffers(operatorId, platform);
    
    res.json({
      success: true,
      offers,
      count: offers.length,
    });
  } catch (error) {
    logger.error("[JobOffers API] Error getting operator job offers", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/job-offers/operator/presence
 * Update operator availability and location
 */
router.post("/operator/presence", requireAuth, async (req, res) => {
  try {
    const { operatorId, platform, status, location } = updateOperatorPresenceSchema.parse(req.body);
    
    await JobDispatchService.updateOperatorPresence(operatorId, platform, status, location);
    
    res.json({
      success: true,
      message: "Operator presence updated",
    });
  } catch (error) {
    logger.error("[JobOffers API] Error updating operator presence", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
