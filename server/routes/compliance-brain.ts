import { Router } from "express";
import { db } from "../db";
import {
  contractorProfiles,
  identityVerifications,
  livenessChecks,
  criminalBackgroundChecks,
  driverSafetyProfiles,
  contractorRatings,
  contractorIncidents,
  complianceDecisions,
  complianceAuditLogs,
  assignments,
  providerAvailability,
  walkBookings,
  sitterBookings,
  providerTaxCompliance,
} from "@shared/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import {
  evaluateAssignmentEligibility,
  type ContractorBaseInfo,
  type IdentityVerificationInfo,
  type DriverProfileInfo,
  type ContractorRatingInfo,
  type ContractorIncidentInfo,
  type PlatformRole,
} from "../../shared/globalCompliance";
import { evaluateIsraeliContractorForService } from "../../shared/petwashIsraeliContractors";
import type { IsraeliContractorProfile, PetWashServiceType } from "../../shared/petwashIsraeliContractors";
import { requireAuth } from "../customAuth";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    // Do NOT throw — a module-level throw here causes the entire routes.ts import
    // to reject, setting serverReady=false permanently and blocking ALL routes
    // (including /api/auth/session and /api/users/create-profile) not just this module.
    // Install a poison-pill so only compliance-brain routes degrade; everything else serves normally.
    // Set JWT_SECRET in Cloud Run env vars immediately.
    console.error('[compliance-brain] CRITICAL: JWT_SECRET must be configured in production. ' +
      '/api/compliance-brain/* routes are disabled until this env var is set.');
    router.use((_req: any, res: any) => res.status(503).json({
      error: 'SERVICE_MISCONFIGURED',
      message: 'JWT_SECRET not configured. Contact system administrator.',
    }));
  } else {
    throw new Error("CRITICAL: JWT_SECRET must be configured - refusing to start with predictable tokens");
  }
}

// Middleware: Verify JWT token
async function authMiddleware(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing authorization header" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    req.authUserId = decoded.sub;
    req.authRoles = decoded.roles || [];
    next();
  } catch (err) {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "Invalid or expired token" });
  }
}

// Helper: Convert database records to Global Compliance Brain format
async function loadContractorComplianceData(contractorId: string) {
  // Get contractor profile
  const contractor = await db.query.contractorProfiles.findFirst({
    where: eq(contractorProfiles.id, contractorId),
  });

  if (!contractor) {
    return null;
  }

  // Get latest identity verification
  const [latestIdentity] = await db.query.identityVerifications.findMany({
    where: eq(identityVerifications.contractorId, contractorId),
    orderBy: [desc(identityVerifications.createdAt)],
    limit: 1,
  });

  // Get latest liveness check
  const [latestLiveness] = await db.query.livenessChecks.findMany({
    where: eq(livenessChecks.contractorId, contractorId),
    orderBy: [desc(livenessChecks.createdAt)],
    limit: 1,
  });

  // Get latest criminal background check
  const [latestCriminalCheck] = await db.query.criminalBackgroundChecks.findMany({
    where: eq(criminalBackgroundChecks.contractorId, contractorId),
    orderBy: [desc(criminalBackgroundChecks.createdAt)],
    limit: 1,
  });

  // Get driver safety profile
  const driverProfile = await db.query.driverSafetyProfiles.findFirst({
    where: eq(driverSafetyProfiles.contractorId, contractorId),
  });

  // Get last 30 days of ratings
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentRatings = await db.query.contractorRatings.findMany({
    where: and(
      eq(contractorRatings.contractorId, contractorId),
      gte(contractorRatings.createdAt, thirtyDaysAgo)
    ),
  });

  // Get all unresolved incidents
  const unresolvedIncidents = await db.query.contractorIncidents.findMany({
    where: and(
      eq(contractorIncidents.contractorId, contractorId),
      eq(contractorIncidents.resolvedAt, null)
    ),
  });

  // Build contractor base info
  const contractorInfo: ContractorBaseInfo = {
    id: contractor.id,
    countryOfOperation: contractor.countryOfOperation || "IL",
    userId: contractor.id, // Using contractor profile ID as user ID
    israeliTaxId: null, // Load from Israeli contractor tables if needed
  };

  // Build identity verification info
  const identityInfo: IdentityVerificationInfo | null = latestIdentity
    ? {
        documentType: latestIdentity.documentType,
        status: latestIdentity.status as "pending" | "approved" | "rejected" | "expired",
        provider: latestIdentity.provider || "mobile_app",
        biometricVerified: (latestIdentity.details as any)?.biometricVerified === true,
        country: (latestIdentity.details as any)?.country || contractor.countryOfOperation || "IL",
        expiresAt: latestIdentity.expiresAt ? latestIdentity.expiresAt.toISOString() : undefined,
        livenessCheck: latestLiveness
          ? {
              status: latestLiveness.status as "passed" | "failed",
              riskScore: latestLiveness.riskScore,
              faceMatchScore: latestLiveness.faceMatchScore || 0,
            }
          : undefined,
      }
    : null;

  // Build driver profile info
  const driverInfo: DriverProfileInfo | null = driverProfile
    ? {
        hasValidLicense: driverProfile.licenseExpiryDate
          ? new Date(driverProfile.licenseExpiryDate) > new Date()
          : false,
        licenseExpiryDate: driverProfile.licenseExpiryDate
          ? driverProfile.licenseExpiryDate.toISOString()
          : undefined,
        hasActiveBan: driverProfile.hasActiveBan,
        banExpiryDate: driverProfile.banExpiryDate ? driverProfile.banExpiryDate.toISOString() : undefined,
        declaresCleanRecord: driverProfile.declaresCleanRecord,
        pointsOnLicense: driverProfile.pointsOnLicense,
      }
    : null;

  // Build ratings info
  const ratingsInfo: ContractorRatingInfo[] = recentRatings.map((rating) => ({
    score: rating.score,
    createdAt: rating.createdAt?.toISOString() || new Date().toISOString(),
    raterType: rating.raterType as "customer" | "dispatcher" | "internal",
  }));

  // Build incidents info
  const incidentsInfo: ContractorIncidentInfo[] = unresolvedIncidents.map((incident) => ({
    type: incident.type,
    severity: incident.severity as "low" | "medium" | "high" | "critical",
    occurredAt: incident.occurredAt.toISOString(),
    isResolved: !!incident.resolvedAt,
  }));

  // Criminal background check info
  const criminalCheck = latestCriminalCheck
    ? {
        status: latestCriminalCheck.status as "clear" | "record_found" | "pending",
        blockingOffenses: (latestCriminalCheck.blockingOffenses as string[]) || [],
        expiresAt: latestCriminalCheck.expiresAt?.toISOString(),
      }
    : undefined;

  return {
    contractor: contractorInfo,
    identity: identityInfo,
    driver: driverInfo,
    ratings: ratingsInfo,
    incidents: incidentsInfo,
    criminalCheck,
  };
}

// GET /api/compliance/contractors/list
// Get all contractors with their compliance status (uses Firebase session cookies)
router.get("/contractors/list", requireAuth, async (req: any, res) => {
  try {
    // Get all contractors
    const allContractors = await db.query.contractorProfiles.findMany({
      limit: 100, // Limit to 100 for performance
    });

    // Load compliance data for each contractor
    const contractorsWithCompliance = await Promise.all(
      allContractors.map(async (contractor) => {
        try {
          const data = await loadContractorComplianceData(contractor.id);
          if (!data) {
            return null;
          }

          // Get latest compliance decision
          const [latestDecision] = await db.query.complianceDecisions.findMany({
            where: eq(complianceDecisions.contractorId, contractor.id),
            orderBy: [desc(complianceDecisions.createdAt)],
            limit: 1,
          });

          // Calculate average rating
          const avgRating =
            data.ratings.length > 0
              ? data.ratings.reduce((sum, r) => sum + r.score, 0) / data.ratings.length
              : 0;

          // Check for critical incidents
          const hasCriticalIncident = data.incidents.some((i) => i.severity === "critical");

          return {
            contractorId: contractor.id,
            contractorName: `${contractor.firstName || ""} ${contractor.lastName || ""}`.trim() || "Unknown",
            email: (contractor as any).email || "N/A",
            serviceType: contractor.serviceTypes?.[0] || "general",
            complianceStatus: {
              identity: {
                status: data.identity?.status || "pending",
                biometricVerified: data.identity?.biometricVerified || false,
                livenessCheck: data.identity?.livenessCheck || null,
              },
              criminal: data.criminalCheck || { status: "pending" },
              driver: data.driver || null,
              ratings: {
                count: data.ratings.length,
                average: avgRating,
              },
              incidents: {
                total: data.incidents.length,
                hasCritical: hasCriticalIncident,
              },
              latestDecision: latestDecision || null,
            },
          };
        } catch (err) {
          console.error(`[Compliance Brain] Error loading contractor ${contractor.id}:`, err);
          return null;
        }
      })
    );

    // Filter out nulls
    const validContractors = contractorsWithCompliance.filter((c) => c !== null);

    res.json({
      contractors: validContractors,
      total: validContractors.length,
    });
  } catch (error: any) {
    console.error("[Compliance Brain] List contractors error:", error);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to list contractors",
    });
  }
});

// POST /api/compliance/contractors/:id/evaluate-eligibility
// Evaluate contractor eligibility using Global Compliance Brain
router.post("/contractors/:id/evaluate-eligibility", authMiddleware, async (req: any, res) => {
  try {
    const contractorId = req.params.id;
    const { assignmentId, role, serviceType, requestedTime } = req.body;

    // Load all contractor compliance data
    const data = await loadContractorComplianceData(contractorId);

    if (!data) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Contractor not found" });
    }

    // ── Load real availability for requested date ────────────────────────────
    const targetDate = requestedTime
      ? new Date(requestedTime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const [availRow] = await db
      .select()
      .from(providerAvailability)
      .where(
        and(
          eq(providerAvailability.providerId, contractorId),
          eq(providerAvailability.date, targetDate)
        )
      )
      .limit(1);

    const availability = availRow
      ? {
          date: availRow.date,
          isAvailable: availRow.isAvailable ?? true,
          maxBookings: availRow.maxBookings ?? 1,
          currentBookings: availRow.currentBookings ?? 0,
          timeSlot: availRow.timeSlot ?? null,
        }
      : null;

    // ── Load real same-day bookings across platforms ─────────────────────────
    const sameDayWalks = await db
      .select({ bookingId: walkBookings.bookingId, status: walkBookings.status })
      .from(walkBookings)
      .where(
        and(
          eq(walkBookings.walkerId, contractorId),
          sql`DATE(${walkBookings.walkDate}) = ${targetDate}`,
          sql`${walkBookings.status} NOT IN ('cancelled', 'completed')`
        )
      );

    const sameDaySitters = await db
      .select({ bookingId: sitterBookings.bookingId, status: sitterBookings.status })
      .from(sitterBookings)
      .where(
        and(
          eq(sitterBookings.sitterId, contractorId),
          sql`DATE(${sitterBookings.startDate}) = ${targetDate}`,
          sql`${sitterBookings.status} NOT IN ('cancelled', 'completed')`
        )
      );

    const existingJobsSameDay = [
      ...sameDayWalks.map(j => ({ id: j.bookingId, type: 'walk', status: j.status })),
      ...sameDaySitters.map(j => ({ id: j.bookingId, type: 'sitting', status: j.status })),
    ];

    // Evaluate using Global Compliance Brain
    const result = evaluateAssignmentEligibility({
      contractor: data.contractor,
      identity: data.identity,
      driverProfile: data.driver,
      availability,
      existingJobsSameDay,
      ratings: data.ratings,
      incidents: data.incidents,
      requestedTime: requestedTime || new Date().toISOString(),
      role: (role as PlatformRole) || "contractor",
      serviceType: serviceType || "other",
    });

    // Save decision to database
    const [decision] = await db
      .insert(complianceDecisions)
      .values({
        contractorId,
        assignmentId: assignmentId || null,
        decision: result.ok ? "approved" : "rejected",
        score: result.ok ? 1.0 : 0.0,
        reasons: result.failures || [],
        triggeredRules: result.ok ? [] : result.failures,
        decidedBy: "system",
      })
      .returning();

    // Create audit log
    await db.insert(complianceAuditLogs).values({
      contractorId,
      assignmentId: assignmentId || null,
      decisionId: decision.id,
      action: "evaluate",
      actorType: "system",
      actorId: null,
      notes: `Global Compliance Brain evaluation: ${result.ok ? "APPROVED" : "REJECTED"}`,
    });

    res.json({
      success: true,
      decision: {
        id: decision.id,
        ok: result.ok,
        decision: decision.decision,
        score: decision.score,
        failures: result.failures || [],
        contractorId,
        assignmentId,
        createdAt: decision.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[Compliance Brain] Evaluate eligibility error:", error);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to evaluate contractor eligibility",
    });
  }
});

// GET /api/compliance/contractors/:id/compliance-status
// Get current compliance status for contractor
router.get("/contractors/:id/compliance-status", authMiddleware, async (req: any, res) => {
  try {
    const contractorId = req.params.id;

    // Load all contractor compliance data
    const data = await loadContractorComplianceData(contractorId);

    if (!data) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Contractor not found" });
    }

    // Get latest compliance decision
    const [latestDecision] = await db.query.complianceDecisions.findMany({
      where: eq(complianceDecisions.contractorId, contractorId),
      orderBy: [desc(complianceDecisions.createdAt)],
      limit: 1,
    });

    // Calculate average rating
    const avgRating =
      data.ratings.length > 0
        ? data.ratings.reduce((sum, r) => sum + r.score, 0) / data.ratings.length
        : 0;

    // Check for critical incidents
    const hasCriticalIncident = data.incidents.some((i) => i.severity === "critical");

    res.json({
      contractorId,
      complianceStatus: {
        identity: {
          status: data.identity?.status || "pending",
          biometricVerified: data.identity?.biometricVerified || false,
          livenessCheck: data.identity?.livenessCheck || null,
        },
        criminal: data.criminalCheck || { status: "pending" },
        driver: data.driver || null,
        ratings: {
          count: data.ratings.length,
          average: avgRating,
          last30Days: data.ratings,
        },
        incidents: {
          total: data.incidents.length,
          hasCritical: hasCriticalIncident,
          unresolved: data.incidents,
        },
        latestDecision: latestDecision || null,
      },
    });
  } catch (error: any) {
    console.error("[Compliance Brain] Get compliance status error:", error);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to fetch compliance status",
    });
  }
});

// GET /api/compliance/contractors/:id/compliance-history
// Get compliance decision history for contractor
router.get("/contractors/:id/compliance-history", authMiddleware, async (req: any, res) => {
  try {
    const contractorId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 50;

    // Get compliance decisions
    const decisions = await db.query.complianceDecisions.findMany({
      where: eq(complianceDecisions.contractorId, contractorId),
      orderBy: [desc(complianceDecisions.createdAt)],
      limit,
    });

    // Get audit logs
    const auditLogs = await db.query.complianceAuditLogs.findMany({
      where: eq(complianceAuditLogs.contractorId, contractorId),
      orderBy: [desc(complianceAuditLogs.createdAt)],
      limit: limit * 2, // More logs than decisions
    });

    res.json({
      contractorId,
      decisions,
      auditLogs,
    });
  } catch (error: any) {
    console.error("[Compliance Brain] Get compliance history error:", error);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to fetch compliance history",
    });
  }
});

// POST /api/compliance/contractors/:id/israeli-contractor-check
// Evaluate Israeli contractor compliance using Israeli Contractor Compliance System
router.post("/contractors/:id/israeli-contractor-check", authMiddleware, async (req: any, res) => {
  try {
    const contractorId = req.params.id;
    const { serviceType } = req.body as { serviceType: PetWashServiceType };

    // Load contractor profile
    const contractor = await db.query.contractorProfiles.findFirst({
      where: eq(contractorProfiles.id, contractorId),
    });

    if (!contractor) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Contractor not found" });
    }

    // Load real tax compliance record from provider_tax_compliance table
    const taxRecord = await db.query.providerTaxCompliance.findFirst({
      where: eq(providerTaxCompliance.providerId, contractorId),
    });

    const israeliProfile: IsraeliContractorProfile = {
      id: contractor.id,
      displayName: contractor.displayName,
      legalName: contractor.legalName,
      contact: {
        email: contractor.email,
        phoneE164: contractor.phoneE164,
        whatsappOptIn: contractor.whatsappOptIn,
      },
      countryOfOperation: "IL",
      primaryCity: contractor.primaryCity || undefined,
      languageCodes: (contractor.languageCodes as string[]) || ["he", "en"],
      acceptedPlatformTermsAt: contractor.acceptedPlatformTermsAt?.toISOString(),
      acceptedIndependentStatusAt: contractor.acceptedIndependentStatusAt?.toISOString(),
      acceptedPrivacyPolicyAt: contractor.acceptedPrivacyPolicyAt?.toISOString(),
      complianceStatus: contractor.complianceStatus as any,
      riskLevel: (contractor.riskLevel as "LOW" | "MEDIUM" | "HIGH") || "LOW",
      lastComplianceCheckAt: contractor.lastComplianceCheckAt?.toISOString(),
      lastComplianceSummary: contractor.lastComplianceSummary || undefined,
      createdAt: contractor.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: contractor.updatedAt?.toISOString() || new Date().toISOString(),
      taxProfile: {
        entityType: (taxRecord?.taxIdType?.toUpperCase() as any) || "OSEK_PATUR",
        taxId: taxRecord?.taxId || null,
        hasValidTaxCertificate: taxRecord?.verificationStatus === "verified",
        taxCertificateExpiryDate: taxRecord?.expiresAt?.toISOString(),
        nationalInsuranceId: taxRecord?.nationalInsuranceNumber || null,
        hasValidNationalInsurance: taxRecord?.isBituachLeumiActive ?? false,
        vatRegistered: taxRecord?.isVatRegistered ?? false,
        vatNumber: taxRecord?.vatNumber || null,
      },
      insuranceInfo: null,
      backgroundCheckInfo: null,
      bankDetails: null,
      serviceAreas: [],
      enabledServices: [],
    };

    // Evaluate using Israeli Contractor Compliance System
    const result = evaluateIsraeliContractorForService(
      israeliProfile,
      serviceType || "SELF_SERVICE_STATION_CLEANING"
    );

    // Save decision
    const [decision] = await db
      .insert(complianceDecisions)
      .values({
        contractorId,
        assignmentId: null,
        decision: result.ok ? "approved" : "rejected",
        score: result.ok ? 1.0 : 0.0,
        reasons: result.failures || [],
        triggeredRules: result.ok ? [] : result.failures,
        decidedBy: "system",
      })
      .returning();

    // Create audit log
    await db.insert(complianceAuditLogs).values({
      contractorId,
      assignmentId: null,
      decisionId: decision.id,
      action: "evaluate",
      actorType: "system",
      actorId: null,
      notes: `Israeli Contractor Compliance check: ${result.ok ? "APPROVED" : "REJECTED"}`,
    });

    res.json({
      success: true,
      decision: {
        id: decision.id,
        ok: result.ok,
        decision: decision.decision,
        failures: result.failures || [],
        serviceType,
      },
    });
  } catch (error: any) {
    console.error("[Compliance Brain] Israeli contractor check error:", error);
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Failed to evaluate Israeli contractor compliance",
    });
  }
});

export default router;
