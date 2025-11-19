// FILE: shared/petwashIsraeliContractors.ts
// 2025 Contractor Marketplace Core for Pet Wash Global
// Focus: Israel legal profile + rules engine
// Tech: Plain TypeScript, no external deps, easy to plug into any Node/TS stack.

//////////////////////////////
// Basic enums and constants
//////////////////////////////

// Where the contractor is operating
export type CountryCode = "IL" | "AU" | "US" | "UK" | "EU" | "OTHER";

// Types of services offered on the platform
export type PetWashServiceType =
  | "SELF_SERVICE_STATION_CLEANING"
  | "MOBILE_GROOMING"
  | "PET_SITTING"
  | "DOG_WALKING"
  | "PET_TAXI"
  | "TRAINING"
  | "VET_VISIT_ASSIST"
  | "OTHER";

// Legal form of the contractor in Israel
export type IsraeliContractorEntityType =
  | "PRIVATE_INDIVIDUAL" // יחיד
  | "OSEK_PATUR"         // עוסק פטור
  | "OSEK_MURSH"         // עוסק מורשה
  | "COMPANY_LTD"        // חברה בע"מ
  | "NON_PROFIT"
  | "OTHER";

// Overall compliance status
export type ContractorComplianceStatus =
  | "PENDING"
  | "PARTIALLY_APPROVED"
  | "APPROVED"
  | "SUSPENDED"
  | "BLOCKED";

export type ContractorRiskLevel = "LOW" | "MEDIUM" | "HIGH";

//////////////////////////////
// Core contractor entities
//////////////////////////////

// Base contact profile used across the group
export interface ContractorContact {
  email: string;
  phoneE164: string; // +97254...
  whatsappOptIn: boolean;
}

// Geographic coverage and radius rules
export interface ContractorServiceArea {
  country: CountryCode;
  city?: string;
  regionName?: string;
  // Radius in km for on site services. If null, city only.
  radiusKm?: number | null;
  // Example: { lat: 32.084, lng: 34.800 }
  centerLat?: number | null;
  centerLng?: number | null;
}

// Neutral platform identity used globally
export interface ContractorBaseProfile {
  id: string; // UUID from your auth system
  displayName: string; // Name shown to pet owners
  legalName: string;   // Exact legal name for invoices
  contact: ContractorContact;

  countryOfOperation: CountryCode;
  primaryCity?: string;
  languageCodes: string[]; // ["he", "en"]

  // True if the contractor accepted platform ToS and independent contractor role
  acceptedPlatformTermsAt?: string | null;      // ISO date
  acceptedIndependentStatusAt?: string | null;  // ISO date
  acceptedPrivacyPolicyAt?: string | null;

  createdAt: string; // ISO
  updatedAt: string; // ISO
  archivedAt?: string | null;
}

//////////////////////////////
// Israeli legal profile
//////////////////////////////

export interface IsraeliTaxProfile {
  entityType: IsraeliContractorEntityType;
  idNumber: string; // Teudat Zehut or company number
  vatRegistered: boolean;
  // Optional fields to help your finance flows
  vatNumber?: string | null;
  hasValidHeshbonitMasSystem: boolean; // can issue legal tax invoice
  // Self declaration flags you can show in the dashboard
  confirmsReportsToMasHachnasa: boolean;
  confirmsReportsToBituachLeumi: boolean;
}

export interface IsraeliBankDetails {
  bankName?: string | null;
  bankCode?: string | null;
  branchCode?: string | null;
  accountNumber?: string | null;
  accountHolderName?: string | null;
  // Used only after verification
  isVerified: boolean;
  verifiedAt?: string | null;
}

// Insurance coverage requirements for marketplace models
export interface InsurancePolicyInfo {
  providerName?: string | null;
  policyNumber?: string | null;
  validFrom?: string | null; // ISO date
  validUntil?: string | null;
  coversThirdParty: boolean;
  coversProfessionalLiability: boolean;
  coversAnimalsUnderCare: boolean;
  lastVerifiedAt?: string | null;
}

export interface BackgroundCheckInfo {
  providerName?: string | null;
  reportId?: string | null;
  completedAt?: string | null;
  // Platform can decide what "PASS" means in rule config
  result?: "PASS" | "FAIL" | "PENDING" | "NOT_REQUIRED";
}

// Skills and services the contractor wants to offer
export interface ContractorCapability {
  serviceType: PetWashServiceType;
  isEnabled: boolean; // contractor toggled on
  platformApproved: boolean; // after manual review
  notesInternal?: string | null;
}

export interface ContractorDocument {
  id: string;
  contractorId: string;
  type:
    | "ID_CARD"
    | "DRIVERS_LICENSE"
    | "CAR_REGISTRATION"
    | "BUSINESS_REGISTRATION"
    | "INSURANCE_POLICY"
    | "POLICE_CLEARANCE"
    | "TRAINING_CERTIFICATE"
    | "OTHER";
  country: CountryCode;
  url: string; // storage URL
  uploadedAt: string;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  verifiedByUserId?: string | null;
}

// Full Israeli contractor profile that you store in DB
export interface IsraeliContractorProfile extends ContractorBaseProfile {
  countryOfOperation: "IL";
  taxProfile: IsraeliTaxProfile;
  bankDetails: IsraeliBankDetails;
  insurance: InsurancePolicyInfo;
  backgroundCheck: BackgroundCheckInfo;
  serviceAreas: ContractorServiceArea[];
  capabilities: ContractorCapability[];
  documents: ContractorDocument[];

  complianceStatus: ContractorComplianceStatus;
  riskLevel: ContractorRiskLevel;

  // Read only flags stored after each rules evaluation
  lastComplianceCheckAt?: string | null;
  lastComplianceSummary?: string | null;
}

//////////////////////////////
// Rule engine config
//////////////////////////////

// Condition types the engine understands
export type RuleConditionType =
  | "REQUIRES_ACCEPTED_TERMS"
  | "REQUIRES_ACCEPTED_INDEPENDENT_STATUS"
  | "REQUIRES_INSURANCE"
  | "REQUIRES_BACKGROUND_CHECK"
  | "REQUIRES_DOCUMENT_TYPE"
  | "REQUIRES_ENTITY_TYPE_IN"
  | "REQUIRES_TAX_PROFILE_FIELDS"
  | "REQUIRES_BANK_VERIFIED";

export interface BaseRuleCondition {
  type: RuleConditionType;
  // Machine readable description, used for logs
  code: string;
  // Human readable message for admin dashboards
  message: string;
}

export interface RequiresDocumentCondition extends BaseRuleCondition {
  type: "REQUIRES_DOCUMENT_TYPE";
  documentType: ContractorDocument["type"];
  mustBeVerified: boolean;
}

export interface RequiresEntityTypeCondition extends BaseRuleCondition {
  type: "REQUIRES_ENTITY_TYPE_IN";
  allowed: IsraeliContractorEntityType[];
}

export interface RequiresTaxProfileFieldsCondition extends BaseRuleCondition {
  type: "REQUIRES_TAX_PROFILE_FIELDS";
  fields: (keyof IsraeliTaxProfile)[];
}

export interface SimpleBooleanCondition extends BaseRuleCondition {
  type:
    | "REQUIRES_ACCEPTED_TERMS"
    | "REQUIRES_ACCEPTED_INDEPENDENT_STATUS"
    | "REQUIRES_INSURANCE"
    | "REQUIRES_BACKGROUND_CHECK"
    | "REQUIRES_BANK_VERIFIED";
}

export type RuleCondition =
  | SimpleBooleanCondition
  | RequiresDocumentCondition
  | RequiresEntityTypeCondition
  | RequiresTaxProfileFieldsCondition;

// Rule for a given service type in Israel
export interface ServiceRuleDefinition {
  serviceType: PetWashServiceType;
  enabled: boolean;
  conditions: RuleCondition[];
}

// Overall rule set for Israel
export interface IsraeliContractorRuleSet {
  country: "IL";
  minimumAgeYears: number; // You can fill after you know legal requirement
  allowPrivateIndividuals: boolean;
  allowCompanies: boolean;
  globalConditions: RuleCondition[];
  perServiceRules: ServiceRuleDefinition[];
}

//////////////////////////////
// Concrete Israeli rule set
//////////////////////////////

// This object is the heart of the config.
// You and your lawyers can adjust it without touching code.
export const IL_CONTRACTOR_RULES_2025: IsraeliContractorRuleSet = {
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
      message:
        "Contractor must confirm they are an independent contractor and not an employee.",
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
          message:
            "Contractor must hold valid third party and professional liability insurance.",
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
          message:
            "Insurance must explicitly cover animals under the contractor care.",
        },
        {
          type: "REQUIRES_BACKGROUND_CHECK",
          code: "BACKGROUND_PETSITTING",
          message:
            "Background check must be completed according to platform standard.",
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
          message:
            "Insurance must cover third party damage during dog walking.",
        },
        {
          type: "REQUIRES_BACKGROUND_CHECK",
          code: "BACKGROUND_DOG_WALKING",
          message:
            "Basic background check must be completed for dog walking services.",
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
          message:
            "Vehicle registration must be uploaded and valid for pet taxi services.",
          documentType: "CAR_REGISTRATION",
          mustBeVerified: true,
        },
        {
          type: "REQUIRES_INSURANCE",
          code: "INSURANCE_CAR_AND_ANIMAL",
          message:
            "Insurance must cover vehicle, passengers and animals during transport.",
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
          message:
            "Grooming services require professional liability insurance.",
        },
        {
          type: "REQUIRES_DOCUMENT_TYPE",
          code: "DOC_TRAINING_CERT",
          message:
            "Grooming training certificate or proof of experience must be uploaded.",
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
          message:
            "Training activities must be covered by professional liability insurance.",
        },
        {
          type: "REQUIRES_DOCUMENT_TYPE",
          code: "DOC_TRAINING_CERT_OR_EQUIVALENT",
          message:
            "Training certification, diploma or proof of experience must be provided.",
          documentType: "TRAINING_CERTIFICATE",
          mustBeVerified: false,
        },
      ],
    },
  ],
};

//////////////////////////////
// Evaluation helpers
//////////////////////////////

export interface RuleFailure {
  code: string;
  message: string;
}

export interface ComplianceResult {
  ok: boolean;
  failures: RuleFailure[];
}

// Utility to check if contractor has a document type (verified or not)
function hasDocument(
  contractor: IsraeliContractorProfile,
  type: ContractorDocument["type"],
  mustBeVerified: boolean
): boolean {
  return contractor.documents.some((doc) => {
    if (doc.type !== type) return false;
    if (mustBeVerified && !doc.verifiedAt) return false;
    return true;
  });
}

// Evaluate a single condition
export function evaluateCondition(
  contractor: IsraeliContractorProfile,
  condition: RuleCondition
): RuleFailure | null {
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
      if (!contractor.bankDetails.isVerified) {
        return { code: condition.code, message: condition.message };
      }
      return null;
    }
    case "REQUIRES_INSURANCE": {
      const ins = contractor.insurance;
      const hasAnyPolicy =
        !!ins.policyNumber && !!ins.validUntil && !!ins.validFrom;
      if (!hasAnyPolicy) {
        return { code: condition.code, message: condition.message };
      }
      // Optional: you can add extra date logic here
      return null;
    }
    case "REQUIRES_BACKGROUND_CHECK": {
      if (
        !contractor.backgroundCheck ||
        contractor.backgroundCheck.result !== "PASS"
      ) {
        return { code: condition.code, message: condition.message };
      }
      return null;
    }
    case "REQUIRES_DOCUMENT_TYPE": {
      const ok = hasDocument(
        contractor,
        condition.documentType,
        condition.mustBeVerified
      );
      if (!ok) {
        return { code: condition.code, message: condition.message };
      }
      return null;
    }
    case "REQUIRES_ENTITY_TYPE_IN": {
      if (!condition.allowed.includes(contractor.taxProfile.entityType)) {
        return { code: condition.code, message: condition.message };
      }
      return null;
    }
    case "REQUIRES_TAX_PROFILE_FIELDS": {
      const missing: string[] = [];
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
export function evaluateIsraeliContractorForService(
  contractor: IsraeliContractorProfile,
  serviceType: PetWashServiceType,
  rules: IsraeliContractorRuleSet = IL_CONTRACTOR_RULES_2025
): ComplianceResult {
  const failures: RuleFailure[] = [];

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
    if (failure) failures.push(failure);
  }

  // Service specific conditions
  const serviceRule = rules.perServiceRules.find(
    (r) => r.serviceType === serviceType
  );

  if (!serviceRule || !serviceRule.enabled) {
    failures.push({
      code: "SERVICE_DISABLED",
      message: "Service is disabled for contractors in this country.",
    });
  } else {
    for (const c of serviceRule.conditions) {
      const failure = evaluateCondition(contractor, c);
      if (failure) failures.push(failure);
    }
  }

  return { ok: failures.length === 0, failures };
}

// Helper to update contractor status based on evaluation result
export function deriveComplianceStatusFromResult(
  result: ComplianceResult
): ContractorComplianceStatus {
  if (result.ok) return "APPROVED";
  // You can implement more advanced logic here
  return "PENDING";
}

// Example of how your backend might use this in a service layer
export function recomputeIsraeliContractorCompliance(
  contractor: IsraeliContractorProfile
): IsraeliContractorProfile {
  const result = evaluateIsraeliContractorForService(
    contractor,
    "SELF_SERVICE_STATION_CLEANING"
  );

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
