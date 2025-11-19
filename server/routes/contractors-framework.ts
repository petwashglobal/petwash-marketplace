/**
 * PET WASH LTD – GLOBAL BACKEND FRAMEWORK 2025
 * Unified Contractors + Drivers + Ratings + Identity + Compliance Layer
 * Complete API Routes
 */

import { Router } from "express";
import { db } from "../db";
import { contractors, identityDocuments, drivers, ratings } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

/* ---------------------- CONTRACTORS ---------------------- */

// POST /api/contractors - Create new contractor
router.post("/contractors", async (req, res) => {
  try {
    const { fullName, email, phone, country, roleType } = req.body;
    
    const result = await db.insert(contractors).values({
      fullName,
      email,
      phone,
      country,
      roleType,
    }).returning();
    
    res.json(result[0]);
  } catch (error: any) {
    console.error("[Contractors API] Create error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to create contractor" 
    });
  }
});

// GET /api/contractors - Get all contractors
router.get("/contractors", async (req, res) => {
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

// GET /api/contractors/:id - Get single contractor
router.get("/contractors/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query.contractors.findFirst({
      where: eq(contractors.id, id),
    });
    
    if (!result) {
      return res.status(404).json({ 
        error: "NOT_FOUND", 
        message: "Contractor not found" 
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error("[Contractors API] Get error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to get contractor" 
    });
  }
});

/* ---------------------- IDENTITY DOCUMENTS ---------------------- */

// POST /api/identity/document - Create identity document
router.post("/identity/document", async (req, res) => {
  try {
    const { contractorId, documentType, documentNumber, issuedCountry, expiryDate } = req.body;

    const result = await db.insert(identityDocuments).values({
      contractorId,
      documentType,
      documentNumber,
      issuedCountry,
      expiryDate,
    }).returning();

    res.json(result[0]);
  } catch (error: any) {
    console.error("[Identity API] Create document error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to create identity document" 
    });
  }
});

/* ---------------------- DRIVERS ---------------------- */

// POST /api/drivers - Create driver profile
router.post("/drivers", async (req, res) => {
  try {
    const { contractorId, vehicleType, licenseNumber, licenseExpiry, areasOfService } = req.body;

    const result = await db.insert(drivers).values({
      contractorId,
      vehicleType,
      licenseNumber,
      licenseExpiry,
      areasOfService,
    }).returning();

    res.json(result[0]);
  } catch (error: any) {
    console.error("[Drivers API] Create error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to create driver profile" 
    });
  }
});

// GET /api/drivers - Get all drivers
router.get("/drivers", async (req, res) => {
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

// POST /api/ratings - Create rating
router.post("/ratings", async (req, res) => {
  try {
    const { contractorId, givenByUserId, score, category, comment } = req.body;

    const result = await db.insert(ratings).values({
      contractorId,
      givenByUserId,
      score,
      category,
      comment,
    }).returning();

    res.json(result[0]);
  } catch (error: any) {
    console.error("[Ratings API] Create error:", error);
    res.status(500).json({ 
      error: "INTERNAL_ERROR", 
      message: "Failed to create rating" 
    });
  }
});

// GET /api/ratings - Get all ratings
router.get("/ratings", async (req, res) => {
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

// POST /api/compliance/evaluate - Evaluate contractor eligibility
router.post("/compliance/evaluate", async (req, res) => {
  try {
    const { contractorId } = req.body;

    // Get contractor
    const contractor = await db.query.contractors.findFirst({
      where: eq(contractors.id, contractorId),
    });

    if (!contractor) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Contractor not found",
      });
    }

    // Get documents
    const docs = await db.query.identityDocuments.findMany({
      where: eq(identityDocuments.contractorId, contractorId),
    });

    // Get driver profile
    const driver = await db.query.drivers.findFirst({
      where: eq(drivers.contractorId, contractorId),
    });

    // Get ratings
    const contractorRatings = await db.query.ratings.findMany({
      where: eq(ratings.contractorId, contractorId),
    });

    // SIMPLE RISK ENGINE
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
    console.error("[Compliance API] Evaluate error:", error);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to evaluate compliance",
    });
  }
});

export default router;
