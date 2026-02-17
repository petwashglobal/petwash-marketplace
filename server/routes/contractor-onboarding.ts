import { Router } from "express";
import { db } from "../db";
import {
  contractorProfiles,
  contractorInsurance,
  contractorBackgroundChecks,
  contractorBankDetails,
  contractorServiceAreas,
  contractorCapabilities,
  providerTaxCompliance,
  type InsertContractorProfile,
  type InsertContractorInsurance,
  type InsertContractorBackgroundCheck,
  type InsertContractorBankDetails,
  type InsertContractorServiceArea,
  type InsertContractorCapability,
  type InsertProviderTaxCompliance,
} from "@shared/schema";
import {
  evaluateIsraeliContractorForService,
  type IsraeliContractorProfile,
  type PetWashServiceType,
} from "../../shared/petwashIsraeliContractors";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/contractor-onboarding/profile
 * Step 1: Create contractor base profile
 */
router.post("/profile", async (req, res) => {
  try {
    const {
      id,
      displayName,
      legalName,
      email,
      phoneE164,
      whatsappOptIn,
      primaryCity,
      languageCodes,
    } = req.body;

    if (!id || !displayName || !legalName || !email || !phoneE164) {
      return res.status(400).json({
        error: "Missing required fields: id, displayName, legalName, email, phoneE164",
      });
    }

    // Check if profile already exists
    const existing = await db
      .select()
      .from(contractorProfiles)
      .where(eq(contractorProfiles.id, id))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({
        error: "Contractor profile already exists",
        profile: existing[0],
      });
    }

    // Create contractor profile
    const [profile] = await db
      .insert(contractorProfiles)
      .values({
        id,
        displayName,
        legalName,
        email,
        phoneE164,
        whatsappOptIn: whatsappOptIn || false,
        countryOfOperation: "IL",
        primaryCity: primaryCity || null,
        languageCodes: languageCodes || ["he", "en"],
        complianceStatus: "PENDING",
        riskLevel: "LOW",
      })
      .returning();

    logger.info("[Contractor Onboarding] Profile created", {
      contractorId: profile.id,
      displayName: profile.displayName,
    });

    res.status(201).json({
      success: true,
      profile,
      message: "Contractor profile created successfully",
    });
  } catch (error) {
    logger.error("[Contractor Onboarding] Profile creation failed", error);
    res.status(500).json({
      error: "Failed to create contractor profile",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/contractor-onboarding/accept-terms
 * Step 2: Accept platform terms and independent contractor status
 */
router.post("/accept-terms", async (req, res) => {
  try {
    const { contractorId, acceptTerms, acceptIndependentStatus, acceptPrivacyPolicy } = req.body;

    if (!contractorId) {
      return res.status(400).json({ error: "Missing contractorId" });
    }

    const updates: any = {};
    if (acceptTerms) updates.acceptedPlatformTermsAt = new Date();
    if (acceptIndependentStatus) updates.acceptedIndependentStatusAt = new Date();
    if (acceptPrivacyPolicy) updates.acceptedPrivacyPolicyAt = new Date();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No terms to accept" });
    }

    const [profile] = await db
      .update(contractorProfiles)
      .set(updates)
      .where(eq(contractorProfiles.id, contractorId))
      .returning();

    if (!profile) {
      return res.status(404).json({ error: "Contractor not found" });
    }

    logger.info("[Contractor Onboarding] Terms accepted", {
      contractorId,
      acceptTerms,
      acceptIndependentStatus,
      acceptPrivacyPolicy,
    });

    res.json({
      success: true,
      profile,
      message: "Terms accepted successfully",
    });
  } catch (error) {
    logger.error("[Contractor Onboarding] Accept terms failed", error);
    res.status(500).json({
      error: "Failed to accept terms",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/contractor-onboarding/tax-profile
 * Step 3: Submit Israeli tax registration
 */
router.post("/tax-profile", async (req, res) => {
  try {
    const { contractorId, taxData } = req.body;

    if (!contractorId || !taxData) {
      return res.status(400).json({ error: "Missing contractorId or taxData" });
    }

    // Create or update tax compliance record
    const taxRecord: InsertProviderTaxCompliance = {
      providerId: contractorId,
      providerType: "contractor",
      taxIdType: taxData.taxIdType,
      taxId: taxData.taxId,
      taxRegistrationNumber: taxData.taxRegistrationNumber || null,
      isVatRegistered: taxData.isVatRegistered || false,
      vatNumber: taxData.vatNumber || null,
      nationalInsuranceNumber: taxData.nationalInsuranceNumber,
      isBituachLeumiActive: true,
      verificationStatus: "pending",
      isCompliant: false,
      riskLevel: "low",
    };

    const [tax] = await db
      .insert(providerTaxCompliance)
      .values(taxRecord)
      .returning();

    logger.info("[Contractor Onboarding] Tax profile submitted", {
      contractorId,
      taxIdType: taxData.taxIdType,
    });

    res.status(201).json({
      success: true,
      taxProfile: tax,
      message: "Tax profile submitted for verification",
    });
  } catch (error) {
    logger.error("[Contractor Onboarding] Tax profile submission failed", error, {  });
    res.status(500).json({
      error: "Failed to submit tax profile",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/contractor-onboarding/insurance
 * Step 4: Add insurance information
 */
router.post("/insurance", async (req, res) => {
  try {
    const { contractorId, insurance } = req.body;

    if (!contractorId || !insurance) {
      return res.status(400).json({ error: "Missing contractorId or insurance" });
    }

    const insuranceRecord: InsertContractorInsurance = {
      contractorId,
      providerName: insurance.providerName || null,
      policyNumber: insurance.policyNumber || null,
      validFrom: insurance.validFrom ? new Date(insurance.validFrom) : null,
      validUntil: insurance.validUntil ? new Date(insurance.validUntil) : null,
      coversThirdParty: insurance.coversThirdParty || false,
      coversProfessionalLiability: insurance.coversProfessionalLiability || false,
      coversAnimalsUnderCare: insurance.coversAnimalsUnderCare || false,
      documentId: insurance.documentId || null,
    };

    const [ins] = await db
      .insert(contractorInsurance)
      .values(insuranceRecord)
      .returning();

    logger.info("[Contractor Onboarding] Insurance added", {
      contractorId,
      policyNumber: insurance.policyNumber,
    });

    res.status(201).json({
      success: true,
      insurance: ins,
      message: "Insurance information saved successfully",
    });
  } catch (error) {
    logger.error("[Contractor Onboarding] Insurance submission failed", error, {  });
    res.status(500).json({
      error: "Failed to save insurance information",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/contractor-onboarding/background-check
 * Step 5: Submit background check information
 */
router.post("/background-check", async (req, res) => {
  try {
    const { contractorId, backgroundCheck } = req.body;

    if (!contractorId || !backgroundCheck) {
      return res.status(400).json({
        error: "Missing contractorId or backgroundCheck",
      });
    }

    const bgCheckRecord: InsertContractorBackgroundCheck = {
      contractorId,
      providerName: backgroundCheck.providerName || null,
      reportId: backgroundCheck.reportId || null,
      completedAt: backgroundCheck.completedAt
        ? new Date(backgroundCheck.completedAt)
        : null,
      result: backgroundCheck.result || "PENDING",
      findings: backgroundCheck.findings || null,
      documentId: backgroundCheck.documentId || null,
    };

    const [bgCheck] = await db
      .insert(contractorBackgroundChecks)
      .values(bgCheckRecord)
      .returning();

    logger.info("[Contractor Onboarding] Background check submitted", {
      contractorId,
      result: backgroundCheck.result,
    });

    res.status(201).json({
      success: true,
      backgroundCheck: bgCheck,
      message: "Background check information saved successfully",
    });
  } catch (error) {
    logger.error("[Contractor Onboarding] Background check submission failed", error, {  });
    res.status(500).json({
      error: "Failed to save background check information",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/contractor-onboarding/bank-details
 * Step 6: Add bank account details
 */
router.post("/bank-details", async (req, res) => {
  try {
    const { contractorId, bankDetails } = req.body;

    if (!contractorId || !bankDetails) {
      return res.status(400).json({ error: "Missing contractorId or bankDetails" });
    }

    const bankRecord: InsertContractorBankDetails = {
      contractorId,
      bankName: bankDetails.bankName || null,
      bankCode: bankDetails.bankCode || null,
      branchCode: bankDetails.branchCode || null,
      accountNumber: bankDetails.accountNumber || null, // TODO: Encrypt in production
      accountHolderName: bankDetails.accountHolderName || null,
      isVerified: false, // Admin must verify
    };

    const [bank] = await db
      .insert(contractorBankDetails)
      .values(bankRecord)
      .returning();

    logger.info("[Contractor Onboarding] Bank details added", {
      contractorId,
      bankName: bankDetails.bankName,
    });

    res.status(201).json({
      success: true,
      bankDetails: {
        ...bank,
        // Redact account number in response
        accountNumber: bank.accountNumber
          ? `****${bank.accountNumber.slice(-4)}`
          : null,
      },
      message: "Bank details saved successfully",
    });
  } catch (error) {
    logger.error("[Contractor Onboarding] Bank details submission failed", error, {  });
    res.status(500).json({
      error: "Failed to save bank details",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/contractor-onboarding/service-area
 * Step 7: Add service coverage area
 */
router.post("/service-area", async (req, res) => {
  try {
    const { contractorId, serviceArea } = req.body;

    if (!contractorId || !serviceArea) {
      return res.status(400).json({
        error: "Missing contractorId or serviceArea",
      });
    }

    const areaRecord: InsertContractorServiceArea = {
      contractorId,
      country: serviceArea.country || "IL",
      city: serviceArea.city || null,
      regionName: serviceArea.regionName || null,
      radiusKm: serviceArea.radiusKm || null,
      centerLat: serviceArea.centerLat || null,
      centerLng: serviceArea.centerLng || null,
      isActive: true,
    };

    const [area] = await db
      .insert(contractorServiceAreas)
      .values(areaRecord)
      .returning();

    logger.info("[Contractor Onboarding] Service area added", {
      contractorId,
      city: serviceArea.city,
      radiusKm: serviceArea.radiusKm,
    });

    res.status(201).json({
      success: true,
      serviceArea: area,
      message: "Service area saved successfully",
    });
  } catch (error) {
    logger.error("[Contractor Onboarding] Service area submission failed", error, {  });
    res.status(500).json({
      error: "Failed to save service area",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/contractor-onboarding/capability
 * Step 8: Enable a service capability
 */
router.post("/capability", async (req, res) => {
  try {
    const { contractorId, serviceType } = req.body;

    if (!contractorId || !serviceType) {
      return res.status(400).json({
        error: "Missing contractorId or serviceType",
      });
    }

    // Check if capability already exists
    const existing = await db
      .select()
      .from(contractorCapabilities)
      .where(
        and(
          eq(contractorCapabilities.contractorId, contractorId),
          eq(contractorCapabilities.serviceType, serviceType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({
        error: "Capability already exists for this service",
        capability: existing[0],
      });
    }

    const capabilityRecord: InsertContractorCapability = {
      contractorId,
      serviceType,
      isEnabled: true,
      platformApproved: false, // Admin must approve
    };

    const [capability] = await db
      .insert(contractorCapabilities)
      .values(capabilityRecord)
      .returning();

    logger.info("[Contractor Onboarding] Capability enabled", {
      contractorId,
      serviceType,
    });

    res.status(201).json({
      success: true,
      capability,
      message: "Service capability enabled. Pending admin approval.",
    });
  } catch (error) {
    logger.error("[Contractor Onboarding] Capability creation failed", error, {  });
    res.status(500).json({
      error: "Failed to enable capability",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/contractor-onboarding/status/:contractorId
 * Get onboarding status with rule validation
 */
router.get("/status/:contractorId", async (req, res) => {
  try {
    const { contractorId } = req.params;

    // Fetch all contractor data
    const [profile] = await db
      .select()
      .from(contractorProfiles)
      .where(eq(contractorProfiles.id, contractorId))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: "Contractor not found" });
    }

    // Fetch associated data
    const [taxData] = await db
      .select()
      .from(providerTaxCompliance)
      .where(eq(providerTaxCompliance.providerId, contractorId))
      .limit(1);

    const [insurance] = await db
      .select()
      .from(contractorInsurance)
      .where(eq(contractorInsurance.contractorId, contractorId))
      .limit(1);

    const [backgroundCheck] = await db
      .select()
      .from(contractorBackgroundChecks)
      .where(eq(contractorBackgroundChecks.contractorId, contractorId))
      .limit(1);

    const [bankDetails] = await db
      .select()
      .from(contractorBankDetails)
      .where(eq(contractorBankDetails.contractorId, contractorId))
      .limit(1);

    const serviceAreas = await db
      .select()
      .from(contractorServiceAreas)
      .where(eq(contractorServiceAreas.contractorId, contractorId));

    const capabilities = await db
      .select()
      .from(contractorCapabilities)
      .where(eq(contractorCapabilities.contractorId, contractorId));

    // Calculate onboarding progress
    const steps = {
      profile: true,
      terms: !!profile.acceptedPlatformTermsAt && !!profile.acceptedIndependentStatusAt,
      taxProfile: !!taxData,
      insurance: !!insurance,
      backgroundCheck: !!backgroundCheck,
      bankDetails: !!bankDetails,
      serviceArea: serviceAreas.length > 0,
      capabilities: capabilities.length > 0,
    };

    const completedSteps = Object.values(steps).filter(Boolean).length;
    const totalSteps = Object.keys(steps).length;
    const progress = Math.round((completedSteps / totalSteps) * 100);

    res.json({
      success: true,
      contractorId,
      profile,
      taxData,
      insurance,
      backgroundCheck,
      bankDetails: bankDetails ? {
        ...bankDetails,
        accountNumber: bankDetails.accountNumber
          ? `****${bankDetails.accountNumber.slice(-4)}`
          : null,
      } : null,
      serviceAreas,
      capabilities,
      onboardingProgress: {
        steps,
        completedSteps,
        totalSteps,
        progress,
        isComplete: progress === 100,
      },
    });
  } catch (error) {
    logger.error("[Contractor Onboarding] Status check failed", error);
    res.status(500).json({
      error: "Failed to check onboarding status",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
