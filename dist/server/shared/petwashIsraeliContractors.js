// FILE: shared/petwashIsraeliContractors.ts
// 2025 Contractor Marketplace Core for Pet Wash Global
// Focus: Israel legal profile + rules engine
// Tech: Plain TypeScript, no external deps, easy to plug into any Node/TS stack.
//////////////////////////////
// Concrete Israeli rule set
//////////////////////////////
// This object is the heart of the config.
// You and your lawyers can adjust it without touching code.
export const IL_CONTRACTOR_RULES_2025 = {
    country: "IL",
    minimumAgeYears: 18,
    allowPrivateIndividuals: true,
    allowCompanies: true,
    // Global conditions, applied to every service
    globalConditions: [
        {
            type: "REQUIRES_ACCEPTED_TERMS",
            code: "TERMS_ACCEPTED",
            message: "Contractor must accept platform terms and conditions.",
        },
        {
            type: "REQUIRES_ACCEPTED_INDEPENDENT_STATUS",
            code: "INDEPENDENT_CONSENT",
            message: "Contractor must confirm they are an independent contractor and not an employee.",
        },
        {
            type: "REQUIRES_BANK_VERIFIED",
            code: "BANK_VERIFIED",
            message: "Bank account must be verified before payouts.",
        },
    ],
    // Per service rules
    perServiceRules: [
        {
            serviceType: "SELF_SERVICE_STATION_CLEANING",
            enabled: true,
            conditions: [
                {
                    type: "REQUIRES_INSURANCE",
                    code: "INSURANCE_GENERAL",
                    message: "Contractor must hold valid third party and professional liability insurance.",
                },
                {
                    type: "REQUIRES_TAX_PROFILE_FIELDS",
                    code: "TAX_ISRAEL_BASIC",
                    message: "Tax profile must be complete for Israel.",
                    fields: [
                        "entityType",
                        "idNumber",
                        "hasValidHeshbonitMasSystem",
                        "confirmsReportsToMasHachnasa",
                        "confirmsReportsToBituachLeumi",
                    ],
                },
            ],
        },
        {
            serviceType: "PET_SITTING",
            enabled: true,
            conditions: [
                {
                    type: "REQUIRES_INSURANCE",
                    code: "INSURANCE_ANIMAL_CARE",
                    message: "Insurance must explicitly cover animals under the contractor care.",
                },
                {
                    type: "REQUIRES_BACKGROUND_CHECK",
                    code: "BACKGROUND_PETSITTING",
                    message: "Background check must be completed according to platform standard.",
                },
                {
                    type: "REQUIRES_DOCUMENT_TYPE",
                    code: "DOC_ID_CARD",
                    message: "Valid ID card must be uploaded and verified.",
                    documentType: "ID_CARD",
                    mustBeVerified: true,
                },
            ],
        },
        {
            serviceType: "DOG_WALKING",
            enabled: true,
            conditions: [
                {
                    type: "REQUIRES_INSURANCE",
                    code: "INSURANCE_DOG_WALKING",
                    message: "Insurance must cover third party damage during dog walking.",
                },
                {
                    type: "REQUIRES_BACKGROUND_CHECK",
                    code: "BACKGROUND_DOG_WALKING",
                    message: "Basic background check must be completed for dog walking services.",
                },
            ],
        },
        {
            serviceType: "PET_TAXI",
            enabled: true,
            conditions: [
                {
                    type: "REQUIRES_DOCUMENT_TYPE",
                    code: "DOC_DRIVERS_LICENSE",
                    message: "Drivers license must be valid and verified.",
                    documentType: "DRIVERS_LICENSE",
                    mustBeVerified: true,
                },
                {
                    type: "REQUIRES_DOCUMENT_TYPE",
                    code: "DOC_CAR_REGISTRATION",
                    message: "Vehicle registration must be uploaded and valid for pet taxi services.",
                    documentType: "CAR_REGISTRATION",
                    mustBeVerified: true,
                },
                {
                    type: "REQUIRES_INSURANCE",
                    code: "INSURANCE_CAR_AND_ANIMAL",
                    message: "Insurance must cover vehicle, passengers and animals during transport.",
                },
            ],
        },
        {
            serviceType: "MOBILE_GROOMING",
            enabled: true,
            conditions: [
                {
                    type: "REQUIRES_INSURANCE",
                    code: "INSURANCE_GROOMING",
                    message: "Grooming services require professional liability insurance.",
                },
                {
                    type: "REQUIRES_DOCUMENT_TYPE",
                    code: "DOC_TRAINING_CERT",
                    message: "Grooming training certificate or proof of experience must be uploaded.",
                    documentType: "TRAINING_CERTIFICATE",
                    mustBeVerified: false,
                },
            ],
        },
        {
            serviceType: "TRAINING",
            enabled: true,
            conditions: [
                {
                    type: "REQUIRES_INSURANCE",
                    code: "INSURANCE_TRAINING",
                    message: "Training activities must be covered by professional liability insurance.",
                },
                {
                    type: "REQUIRES_DOCUMENT_TYPE",
                    code: "DOC_TRAINING_CERT_OR_EQUIVALENT",
                    message: "Training certification, diploma or proof of experience must be provided.",
                    documentType: "TRAINING_CERTIFICATE",
                    mustBeVerified: false,
                },
            ],
        },
    ],
};
// Utility to check if contractor has a document type (verified or not)
function hasDocument(contractor, type, mustBeVerified) {
    return contractor.documents.some((doc) => {
        if (doc.type !== type)
            return false;
        if (mustBeVerified && !doc.verifiedAt)
            return false;
        return true;
    });
}
// Evaluate a single condition
export function evaluateCondition(contractor, condition) {
    switch (condition.type) {
        case "REQUIRES_ACCEPTED_TERMS": {
            if (!contractor.acceptedPlatformTermsAt) {
                return { code: condition.code, message: condition.message };
            }
            return null;
        }
        case "REQUIRES_ACCEPTED_INDEPENDENT_STATUS": {
            if (!contractor.acceptedIndependentStatusAt) {
                return { code: condition.code, message: condition.message };
            }
            return null;
        }
        case "REQUIRES_BANK_VERIFIED": {
            if (!contractor.bankDetails || !contractor.bankDetails.isVerified) {
                return { code: condition.code, message: condition.message };
            }
            return null;
        }
        case "REQUIRES_INSURANCE": {
            const ins = contractor.insurance;
            const hasAnyPolicy = !!ins.policyNumber && !!ins.validUntil && !!ins.validFrom;
            if (!hasAnyPolicy) {
                return { code: condition.code, message: condition.message };
            }
            // Optional: you can add extra date logic here
            return null;
        }
        case "REQUIRES_BACKGROUND_CHECK": {
            if (!contractor.backgroundCheck ||
                contractor.backgroundCheck.result !== "PASS") {
                return { code: condition.code, message: condition.message };
            }
            return null;
        }
        case "REQUIRES_DOCUMENT_TYPE": {
            const ok = hasDocument(contractor, condition.documentType, condition.mustBeVerified);
            if (!ok) {
                return { code: condition.code, message: condition.message };
            }
            return null;
        }
        case "REQUIRES_ENTITY_TYPE_IN": {
            if (!contractor.taxProfile || !condition.allowed.includes(contractor.taxProfile.entityType)) {
                return { code: condition.code, message: condition.message };
            }
            return null;
        }
        case "REQUIRES_TAX_PROFILE_FIELDS": {
            if (!contractor.taxProfile) {
                return { code: condition.code, message: condition.message };
            }
            const missing = [];
            for (const field of condition.fields) {
                const value = contractor.taxProfile[field];
                if (value === undefined || value === null || value === "") {
                    missing.push(field);
                }
            }
            if (missing.length > 0) {
                return {
                    code: condition.code,
                    message: `${condition.message} Missing: ${missing.join(", ")}`,
                };
            }
            return null;
        }
        default:
            // Exhaustive check. If TS compiles, this should never run.
            return {
                code: "UNKNOWN_CONDITION",
                message: "Unknown rule condition type.",
            };
    }
}
// Evaluate all rules for a given service type
export function evaluateIsraeliContractorForService(contractor, serviceType, rules = IL_CONTRACTOR_RULES_2025) {
    const failures = [];
    if (contractor.countryOfOperation !== "IL") {
        return {
            ok: false,
            failures: [
                {
                    code: "WRONG_COUNTRY",
                    message: "Contractor is not registered as operating in Israel.",
                },
            ],
        };
    }
    // Global conditions
    for (const c of rules.globalConditions) {
        const failure = evaluateCondition(contractor, c);
        if (failure)
            failures.push(failure);
    }
    // Service specific conditions
    const serviceRule = rules.perServiceRules.find((r) => r.serviceType === serviceType);
    if (!serviceRule || !serviceRule.enabled) {
        failures.push({
            code: "SERVICE_DISABLED",
            message: "Service is disabled for contractors in this country.",
        });
    }
    else {
        for (const c of serviceRule.conditions) {
            const failure = evaluateCondition(contractor, c);
            if (failure)
                failures.push(failure);
        }
    }
    return { ok: failures.length === 0, failures };
}
// Helper to update contractor status based on evaluation result
export function deriveComplianceStatusFromResult(result) {
    if (result.ok)
        return "APPROVED";
    // You can implement more advanced logic here
    return "PENDING";
}
// Example of how your backend might use this in a service layer
export function recomputeIsraeliContractorCompliance(contractor) {
    const result = evaluateIsraeliContractorForService(contractor, "SELF_SERVICE_STATION_CLEANING");
    const status = deriveComplianceStatusFromResult(result);
    return {
        ...contractor,
        complianceStatus: status,
        lastComplianceCheckAt: new Date().toISOString(),
        lastComplianceSummary: result.ok
            ? "OK"
            : result.failures.map((f) => `${f.code}: ${f.message}`).join(" | "),
    };
}
