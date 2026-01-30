// FILE: shared/globalCompliance.ts
// Pet Wash™ Global Control Brain 2025
// Rules for drivers, sitters, hosts and any contractor platform wide.
import { evaluateIsraeliContractorForService, } from "./petwashIsraeliContractors";
import { canTakeJob, } from "./petwashAvailability";
import { computeRatingSummary, } from "./petwashRatings";
import { isCritical as isCriticalIncident, } from "./petwashIncidents";
////////////////////////////////
// Helper functions
////////////////////////////////
function hasPassedLiveness(identity) {
    const latest = identity.livenessChecks
        .filter((l) => l.status === "PASSED")
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0];
    if (!latest)
        return false;
    if (!latest.isLive)
        return false;
    if (latest.faceMatchScore < 80)
        return false;
    return true;
}
function hasValidDriversLicense(identity, driverProfile) {
    if (!driverProfile.licenseVerified)
        return false;
    const dlDoc = identity.documentVerifications.find((d) => d.type === "DRIVERS_LICENSE" &&
        d.status === "PASSED");
    if (!dlDoc)
        return false;
    if (dlDoc.expiresAt && new Date(dlDoc.expiresAt) < new Date()) {
        return false;
    }
    if (driverProfile.licenseExpiry &&
        new Date(driverProfile.licenseExpiry) < new Date()) {
        return false;
    }
    if (driverProfile.activeDrivingBans.length > 0) {
        return false;
    }
    return true;
}
function hasBlockingCriminalHits(criminal) {
    if (!criminal)
        return false;
    if (criminal.status !== "PASSED" && criminal.status !== "FAILED") {
        // pending means not safe yet
        return true;
    }
    const hits = criminal.hits || [];
    // You can tune this list with your lawyers
    const blockedCategories = [
        "ANIMAL_CRUELTY",
        "SEX_OFFENCE",
        "VIOLENCE",
    ];
    for (const h of hits) {
        if (blockedCategories.includes(h.category) && !h.isSpentOrCleared) {
            return true;
        }
    }
    return false;
}
export function computeGlobalRisk(contractorId, ratings, incidents) {
    const ratingSummary = computeRatingSummary(contractorId, ratings);
    const openCritical = incidents.filter((i) => (i.contractorId === contractorId || i.jobId) &&
        isCriticalIncident(i));
    let level = "LOW";
    if (ratingSummary.autoFlag === "WATCH" || openCritical.length > 0) {
        level = "MEDIUM";
    }
    if (ratingSummary.autoFlag === "AUTO_REVIEW") {
        level = "HIGH";
    }
    if (openCritical.some((i) => i.severity === "CRITICAL")) {
        level = "BLOCK";
    }
    return {
        contractorId,
        ratingSummary,
        openCriticalIncidents: openCritical,
        riskLevel: level,
    };
}
export function evaluateAssignmentEligibility(ctx) {
    const failures = [];
    // 1. Country specific legal compliance (Israel in this case)
    const ilCheck = evaluateIsraeliContractorForService(ctx.contractor, ctx.serviceType);
    if (!ilCheck.ok) {
        ilCheck.failures.forEach((f) => failures.push({
            code: `IL_${f.code}`,
            message: f.message,
        }));
    }
    // 2. Availability
    const availabilityResult = canTakeJob(ctx.availability, ctx.requestedTime, ctx.existingJobsSameDay);
    if (!availabilityResult.ok) {
        failures.push({
            code: `AVAIL_${availabilityResult.reason || "UNKNOWN"}`,
            message: "Contractor is not available for the requested time slot.",
        });
    }
    // 3. Identity and live selfie
    if (!hasPassedLiveness(ctx.identity)) {
        failures.push({
            code: "LIVENESS_FAILED",
            message: "Contractor must pass live selfie check with face match to ID.",
        });
    }
    // 4. Criminal background rules per role
    const criminal = ctx.identity.criminalCheck;
    const hasBlock = hasBlockingCriminalHits(criminal);
    if (hasBlock) {
        failures.push({
            code: "CRIMINAL_BLOCK",
            message: "Criminal record does not allow providing this type of pet service.",
        });
    }
    // 5. Driver specific rules
    if (ctx.role === "DRIVER" || ctx.serviceType === "PET_TAXI") {
        if (!ctx.driverProfile) {
            failures.push({
                code: "DRIVER_PROFILE_MISSING",
                message: "Driver profile is missing.",
            });
        }
        else {
            if (!hasValidDriversLicense(ctx.identity, ctx.driverProfile)) {
                failures.push({
                    code: "DRIVER_LICENSE_INVALID",
                    message: "Valid drivers license and verification are required for driving services.",
                });
            }
            if (!ctx.driverProfile.selfDeclaredCleanRecord) {
                failures.push({
                    code: "DRIVER_SELF_DECLARATION_MISSING",
                    message: "Driver must confirm no active bans or drunk driving offences.",
                });
            }
            if (ctx.driverProfile.activeDrivingBans.length > 0) {
                failures.push({
                    code: "DRIVER_ACTIVE_BAN",
                    message: "Driver has an active driving ban.",
                });
            }
        }
    }
    // 6. Role specific background strictness
    if (ctx.role === "PET_HOST_HOME" ||
        ctx.role === "PET_SITTER_VISIT_HOME") {
        if (!criminal || criminal.status !== "PASSED") {
            failures.push({
                code: "CRIMINAL_CHECK_REQUIRED",
                message: "Clean criminal background check is required for entering client homes or hosting pets.",
            });
        }
    }
    // 7. Global risk level
    const globalRisk = computeGlobalRisk(ctx.contractor.id, ctx.ratings, ctx.incidents);
    if (globalRisk.riskLevel === "BLOCK") {
        failures.push({
            code: "GLOBAL_RISK_BLOCK",
            message: "Contractor is blocked by risk engine because of critical incidents or very low ratings.",
        });
    }
    else if (globalRisk.riskLevel === "HIGH") {
        failures.push({
            code: "GLOBAL_RISK_HIGH",
            message: "Contractor is in high risk level and requires manual review before taking new jobs.",
        });
    }
    return {
        ok: failures.length === 0,
        failures,
        country: ctx.contractor.countryOfOperation,
        role: ctx.role,
        serviceType: ctx.serviceType,
    };
}
