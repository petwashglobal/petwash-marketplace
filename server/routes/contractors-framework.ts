/**
 * PET WASH LTD – GLOBAL BACKEND FRAMEWORK 2025
 * Unified Contractors + Drivers + Ratings + Identity + Compliance Layer
 * 
 * PRODUCTION-GRADE ROUTES with:
 * - Zod validation on all POST endpoints
 * - Authentication middleware for sensitive operations
 * - Proper error handling and type safety
 * - FK constraint validation
 */

import { Router } from "express";
import { db } from "../db";
import { 
  contractors, 
  identityDocuments, 
  drivers, 
  ratings,
  insertContractorSchema,
  insertIdentityDocumentSchema,
  insertDriverSchema,
  insertRatingSchema,
  evaluateComplianceSchema,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, requireRoles } from "../middleware/auth";
import { ZodError } from "zod";

const router = Router();

/* ---------------------- CONTRACTORS ---------------------- */

// POST /api/contractors - Create new contractor (ADMIN/HR ONLY)
router.post("/contractors", authMiddleware, requireRoles("admin", "hr", "compliance"), async (req, res) => {
  try {
    const validated = insertContractorSchema.parse(req.body);
    
    const result = await db.insert(contractors).values(validated).returning();
    
    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ 
        error: "VALIDATION_ERROR", 
        message: "Invalid contractor data",
        details: error.errors,
      });
    }
    
    console.error("[Contractors API] Create error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to create contractor" 
    });
  }
});

// GET /api/contractors - Get all contractors (PROTECTED)
router.get("/contractors", authMiddleware, async (req, res) => {
  try {
    const result = await db.select().from(contractors);
    res.json(result);
  } catch (error: any) {
    console.error("[Contractors API] List error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to list contractors" 
    });
  }
});

// GET /api/contractors/:id - Get single contractor with full profile (PROTECTED)
router.get("/contractors/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const contractor = await db.query.contractors.findFirst({
      where: eq(contractors.id, id),
    });
    
    if (!contractor) {
      return res.status(404).json({ 
        error: "NOT_FOUND", 
        message: "Contractor not found" 
      });
    }
    
    const docs = await db.query.identityDocuments.findMany({
      where: eq(identityDocuments.contractorId, id),
    });
    
    const driver = await db.query.drivers.findFirst({
      where: eq(drivers.contractorId, id),
    });
    
    const contractorRatings = await db.query.ratings.findMany({
      where: eq(ratings.contractorId, id),
    });
    
    res.json({
      ...contractor,
      documents: docs,
      driverProfile: driver || null,
      ratings: contractorRatings,
    });
  } catch (error: any) {
    console.error("[Contractors API] Get error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to get contractor" 
    });
  }
});

/* ---------------------- IDENTITY DOCUMENTS ---------------------- */

// POST /api/identity/document - Create identity document (ADMIN/COMPLIANCE ONLY)
router.post("/identity/document", authMiddleware, requireRoles("admin", "compliance", "hr"), async (req, res) => {
  try {
    const validated = insertIdentityDocumentSchema.parse(req.body);

    const contractorExists = await db.query.contractors.findFirst({
      where: eq(contractors.id, validated.contractorId),
    });

    if (!contractorExists) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Contractor not found",
      });
    }

    const result = await db.insert(identityDocuments).values(validated).returning();

    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid document data",
        details: error.errors,
      });
    }

    console.error("[Identity API] Create document error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to create identity document" 
    });
  }
});

/* ---------------------- DRIVERS ---------------------- */

// POST /api/drivers - Create driver profile (ADMIN/COMPLIANCE ONLY)
router.post("/drivers", authMiddleware, requireRoles("admin", "compliance", "hr"), async (req, res) => {
  try {
    const validated = insertDriverSchema.parse(req.body);

    const contractorExists = await db.query.contractors.findFirst({
      where: eq(contractors.id, validated.contractorId),
    });

    if (!contractorExists) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Contractor not found",
      });
    }

    const result = await db.insert(drivers).values(validated).returning();

    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid driver data",
        details: error.errors,
      });
    }

    console.error("[Drivers API] Create error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to create driver profile" 
    });
  }
});

// GET /api/drivers - Get all drivers (PROTECTED)
router.get("/drivers", authMiddleware, async (req, res) => {
  try {
    const result = await db.select().from(drivers);
    res.json(result);
  } catch (error: any) {
    console.error("[Drivers API] List error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to list drivers" 
    });
  }
});

/* ---------------------- RATINGS ---------------------- */

// POST /api/ratings - Create rating (PROTECTED)
router.post("/ratings", authMiddleware, async (req, res) => {
  try {
    const validated = insertRatingSchema.parse(req.body);

    const contractorExists = await db.query.contractors.findFirst({
      where: eq(contractors.id, validated.contractorId),
    });

    if (!contractorExists) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Contractor not found",
      });
    }

    const result = await db.insert(ratings).values(validated).returning();

    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid rating data",
        details: error.errors,
      });
    }

    console.error("[Ratings API] Create error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to create rating" 
    });
  }
});

// GET /api/ratings - Get all ratings (PROTECTED)
router.get("/ratings", authMiddleware, async (req, res) => {
  try {
    const result = await db.select().from(ratings);
    res.json(result);
  } catch (error: any) {
    console.error("[Ratings API] List error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to list ratings" 
    });
  }
});

/* ---------------------- COMPLIANCE BRAIN COMPATIBILITY LAYER ---------------------- */

// POST /api/compliance/evaluate - Evaluate contractor eligibility (ADMIN/COMPLIANCE ONLY)
router.post("/compliance/evaluate", authMiddleware, requireRoles("admin", "compliance"), async (req, res) => {
  try {
    const validated = evaluateComplianceSchema.parse(req.body);
    const { contractorId } = validated;

    const contractor = await db.query.contractors.findFirst({
      where: eq(contractors.id, contractorId),
    });

    if (!contractor) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Contractor not found",
      });
    }

    const docs = await db.query.identityDocuments.findMany({
      where: eq(identityDocuments.contractorId, contractorId),
    });

    const driver = await db.query.drivers.findFirst({
      where: eq(drivers.contractorId, contractorId),
    });

    const contractorRatings = await db.query.ratings.findMany({
      where: eq(ratings.contractorId, contractorId),
    });

    let riskScore = 0.1;
    if (contractorRatings.length > 0) {
      const avg = contractorRatings.reduce((a, r) => a + (r.score || 0), 0) / contractorRatings.length;
      riskScore = Math.max(0.05, 1.2 - avg * 0.2);
    }

    const eligible = riskScore < 0.7;

    res.json({
      contractorId,
      eligible,
      riskScore,
      reasons: eligible ? ["clean profile", "acceptable rating pattern"] : ["high risk score"],
      recommendedLimits: {
        maxBookingsPerDay: eligible ? 10 : 2,
        verificationTier: eligible ? "tier_2" : "tier_1",
      },
      metadata: {
        documentsCount: docs.length,
        hasDriverProfile: !!driver,
        ratingsCount: contractorRatings.length,
      },
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid compliance evaluate data",
        details: error.errors,
      });
    }

    console.error("[Compliance API] Evaluate error:", error);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to evaluate compliance",
    });
  }
});

export default router;
