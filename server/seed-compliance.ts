/**
 * COMPLIANCE CONTROL TOWER - SEED DATA
 * ====================================
 * Default policies, rules, and corporate governance data
 * 
 * Created: November 10, 2025
 */

import { db } from "./db";
import {
  bookingPolicies,
  reviewModerationRules,
  corporateSeals,
  boardResolutions,
  authorityDocuments,
  type InsertBookingPolicy,
  type InsertReviewModerationRule,
  type InsertCorporateSeal,
  type InsertBoardResolution,
  type InsertAuthorityDocument,
} from "@shared/schema-compliance";

export async function seedComplianceData() {
  console.log("🔰 Seeding Compliance Control Tower data...");

  // =================== BOOKING POLICIES ===================

  const defaultBookingPolicies: InsertBookingPolicy[] = [
    {
      policyId: "CANCEL-FLEX-001",
      policyName: "Flexible Cancellation",
      policyNameHe: "ביטול גמיש",
      serviceType: "all",
      policyTier: "flexible",
      cancellationRules: {
        "24_hours_before": { refund_percent: 100, fee: 0 },
        "12_hours_before": { refund_percent: 75, fee: 5 },
        "less_than_12": { refund_percent: 50, fee: 10 }
      },
      autoRefundEnabled: true,
      refundProcessingDays: 3,
      refundMethod: "original_payment",
      disputeEscalationHours: 48,
      requiresManualReview: false,
      displayInBookingFlow: true,
      requiresAcknowledgment: true,
      applicableCountries: ["IL", "US", "GB", "AU", "CA"],
      isActive: true,
      effectiveDate: new Date("2025-01-01"),
      version: "1.0",
    },
    {
      policyId: "CANCEL-MOD-001",
      policyName: "Moderate Cancellation",
      policyNameHe: "ביטול מתון",
      serviceType: "wash",
      policyTier: "moderate",
      cancellationRules: {
        "24_hours_before": { refund_percent: 100, fee: 0 },
        "12_hours_before": { refund_percent: 50, fee: 10 },
        "less_than_12": { refund_percent: 0, fee: 15 }
      },
      autoRefundEnabled: true,
      refundProcessingDays: 5,
      refundMethod: "original_payment",
      disputeEscalationHours: 48,
      requiresManualReview: false,
      displayInBookingFlow: true,
      requiresAcknowledgment: true,
      applicableCountries: ["IL", "US", "GB", "AU", "CA"],
      isActive: true,
      effectiveDate: new Date("2025-01-01"),
      version: "1.0",
    },
    {
      policyId: "CANCEL-STRICT-001",
      policyName: "Strict Cancellation",
      policyNameHe: "ביטול מחמיר",
      serviceType: "sitting",
      policyTier: "strict",
      cancellationRules: {
        "48_hours_before": { refund_percent: 100, fee: 0 },
        "24_hours_before": { refund_percent: 50, fee: 20 },
        "less_than_24": { refund_percent: 0, fee: 30 }
      },
      autoRefundEnabled: true,
      refundProcessingDays: 7,
      refundMethod: "original_payment",
      disputeEscalationHours: 72,
      requiresManualReview: true,
      displayInBookingFlow: true,
      requiresAcknowledgment: true,
      applicableCountries: ["IL", "US", "GB", "AU", "CA"],
      isActive: true,
      effectiveDate: new Date("2025-01-01"),
      version: "1.0",
    },
  ];

  for (const policy of defaultBookingPolicies) {
    try {
      await db.insert(bookingPolicies).values(policy).onConflictDoNothing();
      console.log(`✅ Booking policy created: ${policy.policyName}`);
    } catch (error: any) {
      console.log(`⚠️ Booking policy already exists: ${policy.policyName}`);
    }
  }

  // =================== REVIEW MODERATION RULES ===================

  const defaultModerationRules: InsertReviewModerationRule[] = [
    {
      ruleId: "MOD-DEFAM-001",
      ruleName: "Defamation Detection",
      ruleNameHe: "זיהוי הוצאת דיבה",
      ruleType: "defamation",
      detectionMethod: "ai_gemini",
      keywords: [
        "liar", "fraud", "scam", "criminal", "illegal", "stolen", "abuse", "assault"
      ],
      keywordsHe: [
        "רמאי", "הונאה", "פושע", "גנב", "התעללות", "הוצאת דיבה"
      ],
      moderationAction: "flag_for_review",
      requiresLegalReview: true,
      severityLevel: "critical",
      autoEscalate: true,
      legalBasis: "Israeli Defamation Law 1965, Section 7",
      safeHarborApplies: true,
      isActive: true,
    },
    {
      ruleId: "MOD-PROF-001",
      ruleName: "Profanity Filter",
      ruleNameHe: "סינון גסויות",
      ruleType: "profanity",
      detectionMethod: "keyword_match",
      keywords: [
        "fuck", "shit", "bastard", "asshole", "bitch", "damn"
      ],
      keywordsHe: [
        "זיין", "חרא", "ממזר", "כוס", "קוקסינל"
      ],
      moderationAction: "flag_for_review",
      requiresLegalReview: false,
      severityLevel: "medium",
      autoEscalate: false,
      safeHarborApplies: true,
      isActive: true,
    },
    {
      ruleId: "MOD-FAKE-001",
      ruleName: "Fake Review Detection",
      ruleNameHe: "זיהוי ביקורות מזויפות",
      ruleType: "fake_review",
      detectionMethod: "ai_gemini",
      keywords: [],
      moderationAction: "flag_for_review",
      requiresLegalReview: false,
      severityLevel: "high",
      autoEscalate: false,
      safeHarborApplies: true,
      isActive: true,
    },
    {
      ruleId: "MOD-PII-001",
      ruleName: "Personal Information Protection",
      ruleNameHe: "הגנה על מידע אישי",
      ruleType: "personal_info",
      detectionMethod: "pattern_analysis",
      patterns: [
        "\\d{3}-\\d{3}-\\d{4}",  // Phone numbers
        "\\d{9}",  // Israeli ID
        "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b"  // Email
      ],
      moderationAction: "auto_block",
      requiresLegalReview: true,
      severityLevel: "critical",
      autoEscalate: true,
      legalBasis: "Israeli Privacy Protection Law, Section 7",
      safeHarborApplies: false,
      isActive: true,
    },
    {
      ruleId: "MOD-SPAM-001",
      ruleName: "Spam and Commercial Links",
      ruleNameHe: "ספאם וקישורים מסחריים",
      ruleType: "spam",
      detectionMethod: "pattern_analysis",
      keywords: [
        "buy now", "click here", "visit", "discount code", "promo"
      ],
      keywordsHe: [
        "קנה עכשיו", "הנחה", "קופון", "לחץ כאן"
      ],
      patterns: [
        "https?://[^\\s]+",  // URLs
      ],
      moderationAction: "auto_block",
      requiresLegalReview: false,
      severityLevel: "medium",
      autoEscalate: false,
      safeHarborApplies: true,
      isActive: true,
    },
  ];

  for (const rule of defaultModerationRules) {
    try {
      await db.insert(reviewModerationRules).values(rule).onConflictDoNothing();
      console.log(`✅ Moderation rule created: ${rule.ruleName}`);
    } catch (error: any) {
      console.log(`⚠️ Moderation rule already exists: ${rule.ruleName}`);
    }
  }

  // =================== CORPORATE SEALS ===================

  const defaultSeals: InsertCorporateSeal[] = [
    {
      sealId: "SEAL-LICENSE-2025",
      sealType: "licensed_platform",
      title: "Licensed Pet Services Platform",
      titleHe: "פלטפורמת שירותי חיות מחמד מורשית",
      description: "Pet Wash™ is a licensed and regulated platform operating under Israeli law",
      descriptionHe: "Pet Wash™ היא פלטפורמה מורשית ומוסדרת הפועלת על פי החוק הישראלי",
      badgeImageUrl: "/assets/seals/licensed-platform.svg",
      badgeColor: "#10B981",
      iconName: "ShieldCheck",
      isVerified: true,
      displayLocations: ["website_footer", "booking_page", "mobile_app"],
      displayPriority: 1,
      isActive: true,
    },
    {
      sealId: "SEAL-VERIFIED-2025",
      sealType: "verified_business",
      title: "Verified Business",
      titleHe: "עסק מאומת",
      description: "Verified by Israeli Companies Registrar",
      descriptionHe: "מאומת על ידי רשם החברות הישראלי",
      badgeImageUrl: "/assets/seals/verified-business.svg",
      badgeColor: "#3B82F6",
      iconName: "CheckCircle",
      isVerified: true,
      displayLocations: ["website_footer", "about_page"],
      displayPriority: 2,
      isActive: true,
    },
    {
      sealId: "SEAL-INSURANCE-2025",
      sealType: "insurance_verified",
      title: "Insured Platform",
      titleHe: "פלטפורמה מבוטחת",
      description: "Comprehensive liability insurance coverage",
      descriptionHe: "כיסוי ביטוח אחריות מקיף",
      badgeImageUrl: "/assets/seals/insured.svg",
      badgeColor: "#8B5CF6",
      iconName: "Shield",
      isVerified: true,
      displayLocations: ["booking_page"],
      displayPriority: 3,
      isActive: true,
    },
  ];

  for (const seal of defaultSeals) {
    try {
      await db.insert(corporateSeals).values(seal).onConflictDoNothing();
      console.log(`✅ Corporate seal created: ${seal.title}`);
    } catch (error: any) {
      console.log(`⚠️ Corporate seal already exists: ${seal.title}`);
    }
  }

  // =================== BOARD RESOLUTIONS ===================

  const defaultResolutions: InsertBoardResolution[] = [
    {
      resolutionId: "RES-2025-001",
      title: "Compliance Framework Adoption",
      titleHe: "אימוץ מסגרת ציות",
      resolutionType: "policy_approval",
      category: "legal",
      description: "Adoption of comprehensive compliance control tower system for legal protection",
      descriptionHe: "אימוץ מערכת מקיפה לבקרת ציות להגנה משפטית",
      legalBasis: "Companies Law 5759-1999, Section 92",
      decision: "RESOLVED: The Board approves the implementation of the Compliance Control Tower system including authority documents management, provider licensing, booking policies, and review moderation.",
      decisionHe: "הוחלט: הדירקטוריון מאשר את יישום מערכת מגדל הבקרה לציות הכולל ניהול מסמכי רשות, רישוי ספקים, מדיניות הזמנות ופיקוח על ביקורות.",
      votingResults: { for: 5, against: 0, abstain: 0 },
      approvalStatus: "approved",
      approvedBy: [1, 2, 3, 4, 5],
      approvedAt: new Date("2025-11-10"),
      effectiveDate: new Date("2025-11-10"),
      isPublic: true,
      displayOnWebsite: true,
    },
  ];

  for (const resolution of defaultResolutions) {
    try {
      await db.insert(boardResolutions).values(resolution).onConflictDoNothing();
      console.log(`✅ Board resolution created: ${resolution.title}`);
    } catch (error: any) {
      console.log(`⚠️ Board resolution already exists: ${resolution.title}`);
    }
  }

  console.log("✅ Compliance Control Tower seed data completed!");
}

// Run if executed directly (ES module compatible)
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  seedComplianceData()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed error:", error);
      process.exit(1);
    });
}
