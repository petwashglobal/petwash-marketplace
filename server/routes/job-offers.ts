/**
 * JOB OFFERS API - Uber/Airbnb-Style Job Dispatch
 * 
 * Endpoints for operators to receive, accept, and reject job offers
 * Real-time job marketplace for Sitter Suite, Walk My Pet, PetTrek
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
 * Create a new job offer and notify operators
 * PROTECTED: Requires authentication
 */
router.post("/create", requireAuth, async (req, res) => {
  try {
    const validatedData = createJobOfferSchema.parse(req.body);
    
    const result = await JobDispatchService.createJobOffer(validatedData);
    
    if (result.success) {
      res.json({
        success: true,
        jobOfferId: result.jobOfferId,
        message: "Job offer created and operators notified",
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
 * Operator accepts a job offer
 * PROTECTED: Requires authentication
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
        message: "Job offer accepted successfully",
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
 * Operator rejects a job offer
 * PROTECTED: Requires authentication
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
 * GET /api/job-offers/operator/:operatorId
 * Get pending job offers for an operator
 * PROTECTED: Requires authentication
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
 * PROTECTED: Requires authentication
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
