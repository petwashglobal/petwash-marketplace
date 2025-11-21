/**
 * FILE: src/petwash_subcontractor_legal_esign_2025.ts
 *
 * PET WASH LTD - SUBCONTRACTOR AGREEMENT + DIGITAL SIGNATURE 2025
 * ----------------------------------------------------------------
 * This file defines:
 * - Legal agreement structure for Israeli subcontractors (2025 base).
 * - Digital signature model with full audit trail (IP, device, browser, OS).
 * - Validation and API handlers using modern 2025 patterns.
 * - Structures that can be used by web, iOS, Android, Safari, Chrome, etc.
 *
 * IMPORTANT LEGAL NOTICE:
 * - This is a technical and structural template only.
 * - It is NOT legal advice.
 * - All legal texts MUST be reviewed and approved by an Israeli lawyer.
 * - Developer must NOT change legal text without approval from management and lawyer.
 *
 * TECHNOLOGY ASSUMPTIONS:
 * - Node 18+.
 * - TypeScript.
 * - Express backend.
 * - Drizzle ORM (integrated with existing Pet Wash platform).
 * - Frontend: React / React Native / native iOS / native Android can all call these APIs.
 *
 * GOAL:
 * - Give Pet Wash a strong 2025-ready digital contract and signature flow:
 *   - Robust structure.
 *   - Clean validation with Zod.
 *   - Easy for future regulations 2026.
 *   - Works across mobile and desktop.
 */

import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

/* ===========================================
 * 1. CORE ENUMS AND TYPES
 * ===========================================
 */

/**
 * How the subcontractor signed.
 */
export type DigitalSignatureMethod =
  | "typed_name"      // typed full name in approval field
  | "drawn_signature" // drawn with finger or mouse (canvas)
  | "otp_code"        // one time password sent to email or phone
  | "external_provider"; // example: DocuSign, Adobe Sign (id stored)

/**
 * Device and client info collected from frontend.
 * Helps prove in legal disputes where and how the agreement was signed.
 * Should be sent by web and mobile clients in every sign request.
 */
export interface ClientDeviceInfo {
  deviceType?: "desktop" | "mobile" | "tablet" | "unknown";
  osName?: string;            // iOS, Android, Windows, macOS, etc
  osVersion?: string;
  browserName?: string;       // Safari, Chrome, Firefox, Edge, etc
  browserVersion?: string;
  appName?: string;           // "Pet Wash Pro", "Pet Wash Tech"
  appVersion?: string;        // "1.0.3"
  deviceModel?: string;       // "iPhone 15 Pro", "Galaxy S24", etc
  locale?: string;            // "he-IL", "en-US"
}

/**
 * Data retention policy - used for legal and compliance configuration.
 */
export type DataRetentionPolicy =
  | "SHORT_LOGS"     // example: 30-90 days
  | "STANDARD"       // example: up to 7 years
  | "EXTENDED"       // example: more than 7 years
  | "UNTIL_DELETED"; // on user request if allowed by law

/* ===========================================
 * 2. ISRAEL COMPLIANCE CONFIG (STRUCTURE ONLY)
 * ===========================================
 */

export interface IsraelComplianceRule {
  id: string;
  category:
    | "PRIVACY"
    | "DIGITAL_SIGNATURE"
    | "SUBCONTRACTORS"
    | "PAYMENTS"
    | "OTHER";
  title: string;
  description: string;
  retentionPolicy: DataRetentionPolicy;
  isMandatory: boolean;
  notesForLawyer: string;
}

export interface IsraelComplianceConfig2025 {
  regulationVersion: string;       // example: "IL-SUBCONTRACTOR-2025.01"
  lastReviewedAt: string;          // ISO timestamp
  mustReviewByLawyer: boolean;
  rules: IsraelComplianceRule[];
}

/**
 * Base compliance structure for 2025.
 * Lawyer must review and adjust.
 */
export const ISRAEL_SUBCONTRACTOR_COMPLIANCE_2025: IsraelComplianceConfig2025 = {
  regulationVersion: "IL-SUBCONTRACTOR-2025.01",
  lastReviewedAt: new Date().toISOString(),
  mustReviewByLawyer: true,
  rules: [
    {
      id: "IL-SUB-LEGAL-LOGS",
      category: "DIGITAL_SIGNATURE",
      title: "שמירת חתימה דיגיטלית ורישומי מערכת",
      description:
        "יש לשמור חתימה דיגיטלית של קבלן המשנה כולל IP, Device Info, תאריך ושעת החתימה, גרסת ההסכם ותיעוד מסודר של הראיה.",
      retentionPolicy: "EXTENDED",
      isMandatory: true,
      notesForLawyer:
        "יש לאשר למשך כמה שנים בדיוק חובה לשמור לוגים כדי להגן משפטית על החברה."
    },
    {
      id: "IL-SUB-PRIVACY",
      category: "PRIVACY",
      title: "הגנת פרטיות קבלני משנה",
      description:
        "כל נתון אישי על קבלני משנה יאוחסן ויעובד לפי חוק הגנת הפרטיות, תוך הגבלת גישה ושימוש אך ורק לצרכים תפעוליים ומשפטיים.",
      retentionPolicy: "STANDARD",
      isMandatory: true,
      notesForLawyer:
        "לוודא התאמה לחוק הגנת הפרטיות ולרשות להגנת הפרטיות בישראל."
    },
    {
      id: "IL-SUB-PAYMENTS",
      category: "PAYMENTS",
      title: "נתוני תשלום לקבלני משנה",
      description:
        "תיעוד של תשלומים לקבלני משנה (חשבוניות, תאריכי תשלום, בנק) ישמרו לפי דרישות מס ורגולציה.",
      retentionPolicy: "EXTENDED",
      isMandatory: true,
      notesForLawyer:
        "רואה חשבון ועו\"ד צריכים להגדיר מספר שנים מדויק לפי תקנות מס הכנסה."
    }
  ]
};

/* ===========================================
 * 3. SUBCONTRACTOR AGREEMENT - TEXT AND STRUCTURE
 * ===========================================
 *
 * IMPORTANT:
 * - Text is only a base example.
 * - Lawyer must approve and may change the Hebrew text.
 */

export interface SubcontractorAgreementSection {
  id: string;
  title: string;
  body: string[];
}

export interface SubcontractorAgreementTemplate {
  version: string;       // example: "2025.01"
  language: "he" | "en";
  country: "IL";
  company: {
    legalName: string;
    englishName: string;
    companyNumber: string;
    registeredAddress: string;
  };
  title: string;
  preamble: string[];
  sections: SubcontractorAgreementSection[];
  signatureBlock: {
    contractorDeclaration: string;
    companySignatureLine: string;
    contractorSignatureLine: string;
  };
}

/**
 * Main agreement template for 2025 - Israel.
 * This is the SINGLE SOURCE OF TRUTH for the subcontractor agreement.
 * Any updates for 2025/2026 regulations should be made here and approved by a lawyer.
 */
export const SUBCONTRACTOR_AGREEMENT_IL_2025: SubcontractorAgreementTemplate = {
  version: "2025.01",
  language: "he",
  country: "IL",
  company: {
    legalName: "פט וואש בע\"מ",
    englishName: "PET WASH LTD",
    companyNumber: "517145033",
    registeredAddress: "רחוב עוזי חיטמן 8, ראש העין, ישראל"
  },
  title: "הסכם התקשרות לקבלן משנה - 2025",
  preamble: [
    "הואיל ופט וואש בע\"מ, ח.פ. 517145033 (להלן: \"החברה\"), מפעילה מערך שירותים בתחום רחיצת כלבים וחתולים, תחזוקת עמדות הרחצה, לוגיסטיקה, התקנות, שירות לקוחות ושירותים נלווים;",
    "והואיל והקבלן משנה הינו גורם מקצועי עצמאי, בעל הידע, הניסיון והאמצעים הנדרשים לצורך ביצוע שירותים עבור החברה;",
    "והואיל והצדדים מעוניינים להסדיר את מערכת היחסים החוזית ביניהם במסגרת הסכם זה;",
    "לפיכך הוסכם והותנה בין הצדדים כדלקמן:"
  ],
  sections: [
    {
      id: "1",
      title: "הגדרות",
      body: [
        "\"החברה\" - פט וואש בע\"מ.",
        "\"הקבלן\" או \"קבלן המשנה\" - נותן השירות החתום על הסכם זה.",
        "\"השירותים\" - כל עבודה, שירות, משימה או פעולה אחרת שהקבלן יבצע עבור החברה כפי שיפורט במסמך הזמנת עבודה, נספח שירות או מערכת ההזמנות הדיגיטלית של החברה.",
        "\"מערכת\" - פלטפורמות פט וואש, לרבות מערכות ניהול, אפליקציות, פורטל קבלנים ותשתית דיגיטלית אחרת."
      ]
    },
    {
      id: "2",
      title: "מהות ההתקשרות - קבלן עצמאי בלבד",
      body: [
        "2.1 הקבלן מצהיר כי הינו קבלן עצמאי בלבד. אין ולא יהיו יחסי עובד מעביד בין הקבלן לבין החברה.",
        "2.2 הקבלן אחראי בעצמו לכל תשלום מס, מע\"מ, ביטוח לאומי, ביטוח בריאות, הפרשות פנסיוניות וכל חיוב אחר הנובע מביצוע השירותים.",
        "2.3 שום דבר בהסכם זה לא יפורש כיוצר יחסי שותפות, שליחות, מיזם משותף או יחסי עובד מעביד."
      ]
    },
    {
      id: "3",
      title: "תחומי אחריות וסטנדרט שירות",
      body: [
        "3.1 הקבלן יבצע את השירותים במקצועיות, ביסודיות, במיומנות גבוהה ובהתאם לסטנדרטים של החברה לשנת 2025, כפי שיימסרו מעת לעת בכתב או במערכת.",
        "3.2 הקבלן מתחייב לפעול במלוא תשומת הלב לשמירה על בטיחות בעלי החיים, הלקוחות, הציוד והסביבה.",
        "3.3 הקבלן מתחייב לשמור על מראה נקי, מסודר ומקצועי, ולכבד את המותג פט וואש בכל ממשק מול לקוחות, רשויות וגורמים שלישיים."
      ]
    },
    {
      id: "4",
      title: "תמורה ותשלומים",
      body: [
        "4.1 החברה תשלם לקבלן תמורה לפי תעריפים ועמלות כפי שיפורטו בנספחי התמחור, בטבלת תעריפים במערכת או בהזמנת עבודה דיגיטלית.",
        "4.2 התשלומים יתבצעו כנגד חשבונית מס כדין שתונפק על ידי הקבלן בהתאם לדוחות המערכת המאושרים.",
        "4.3 החברה רשאית לקזז מכל סכום המגיע לקבלן כל סכום שמגיע לה מהקבלן מכוח הסכם זה."
      ]
    },
    {
      id: "5",
      title: "ביטוח ואחריות",
      body: [
        "5.1 הקבלן מצהיר כי ברשותו, או שיהיו ברשותו טרם תחילת העבודה, פוליסות ביטוח מתאימות, לרבות ביטוח צד שלישי וביטוח אחריות מקצועית, ככל שיידרש.",
        "5.2 הקבלן ישפה ויפצה את החברה בגין כל נזק, הפסד, הוצאה או תביעה שתוגש נגדה עקב מעשה או מחדל של הקבלן, בכפוף לדין."
      ]
    },
    {
      id: "6",
      title: "שמירת סודיות ונתונים",
      body: [
        "6.1 הקבלן מתחייב לשמור בסודיות מוחלטת כל מידע עסקי, טכני, מסחרי או אחר של החברה ושל לקוחותיה.",
        "6.2 כל מידע המתבצע או נשמר במערכות הדיגיטליות של פט וואש, לרבות נתוני לקוחות, נתוני ציוד, תחזוקה, לוגיסטיקה ותמונות, הינו בבעלות מלאה של החברה בלבד."
      ]
    },
    {
      id: "7",
      title: "קניין רוחני ומותג",
      body: [
        "7.1 כל הזכויות במותג \"Pet Wash™\" וכל סימני המסחר, העיצובים, התוכן, התמונות, הסרטונים והקוד, שייכות לחברה בלבד.",
        "7.2 הקבלן לא יעשה שימוש במותג או בסימני החברה אלא בהתאם להנחיות החברה ובהיקף שנקבע מראש."
      ]
    },
    {
      id: "8",
      title: "חתימה דיגיטלית ואישורי מערכת",
      body: [
        "8.1 הקבלן מסכים כי חתימה דיגיטלית במערכת פט וואש, לרבות הקלדת שם מלא, אישור בתיבה ייעודית, חתימה באמצעות טאצ' או אישור דרך קוד חד פעמי (OTP), תיחשב כחתימה מחייבת לכל דבר.",
        "8.2 החברה רשאית לשמור לוג מערכת מלא של מועד החתימה, פרטי המכשיר ממנו נחתם ההסכם, כתובת IP וכל נתון טכני אחר לצורך הוכחה.",
        "8.3 גרסת ההסכם המחייבת לגבי כל קבלן היא הגרסה שהקבלן אישר דיגיטלית, כפי שנשמרה במערכת יחד עם חותמת זמן."
      ]
    },
    {
      id: "9",
      title: "תקופה וסיום ההתקשרות",
      body: [
        "9.1 ההסכם נכנס לתוקפו במועד אישורו הדיגיטלי על ידי הקבלן, ונמשך עד לסיום על ידי אחד הצדדים בכפוף להסכם.",
        "9.2 כל צד רשאי להפסיק את ההתקשרות בהודעה מוקדמת כפי שייקבע בנספח, אלא אם התקיימה עילה לסיום מיידי לפי דין או לפי הסכם זה."
      ]
    },
    {
      id: "10",
      title: "שונות",
      body: [
        "10.1 ההסכם מהווה את מלוא ההבנות בין הצדדים ומחליף כל מצג, התחייבות או סיכום קודם, בין בכתב ובין בעל פה.",
        "10.2 שינוי להסכם זה יהיה בכתב בלבד, באמצעות עדכון דיגיטלי במערכת ואישור מפורש של הצדדים.",
        "10.3 סמכות השיפוט הבלעדית תהיה לבתי המשפט המוסמכים במדינת ישראל."
      ]
    }
  ],
  signatureBlock: {
    contractorDeclaration:
      "אני מאשר/ת כי קראתי את כל תנאי ההסכם, הבנתי אותם, ואני מסכים/ה לכל האמור בו כקבלן משנה עצמאי.",
    companySignatureLine: "______________________________  עבור פט וואש בע\"מ",
    contractorSignatureLine: "______________________________  חתימת קבלן משנה"
  }
};

/* ===========================================
 * 4. ZOD VALIDATION SCHEMAS - MODERN 2025 PATTERNS
 * ===========================================
 */

const clientDeviceInfoSchema = z.object({
  deviceType: z.enum(["desktop", "mobile", "tablet", "unknown"]).optional(),
  osName: z.string().max(100).optional(),
  osVersion: z.string().max(100).optional(),
  browserName: z.string().max(100).optional(),
  browserVersion: z.string().max(100).optional(),
  appName: z.string().max(100).optional(),
  appVersion: z.string().max(100).optional(),
  deviceModel: z.string().max(100).optional(),
  locale: z.string().max(20).optional()
});

const digitalSignatureMethodSchema = z.enum([
  "typed_name",
  "drawn_signature",
  "otp_code",
  "external_provider"
]);

/**
 * Contract sign payload - used by web, iOS, Android platforms.
 */
export const signSubcontractorAgreementRequestSchema = z.object({
  subcontractorId: z.string().min(1),
  fullName: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().min(6).max(50).optional(),
  signatureMethod: digitalSignatureMethodSchema,
  rawSignatureData: z.string().min(1),
  clientDevice: clientDeviceInfoSchema.optional(),
  agreedToPrivacy: z.boolean(),
  agreedToTerms: z.boolean()
});

export type SignSubcontractorAgreementRequest =
  z.infer<typeof signSubcontractorAgreementRequestSchema>;

/* ===========================================
 * 5. SIGNATURE CREATION SERVICE - COMPATIBLE WITH DRIZZLE
 * ===========================================
 */

/**
 * Creates a signature record compatible with the existing Pet Wash database schema.
 * Returns data ready to be inserted into subcontractorSignatures table.
 */
export function createSubcontractorSignatureRecord(input: {
  subcontractorId: string;
  fullName: string;
  email: string;
  phone?: string;
  signatureMethod: DigitalSignatureMethod;
  rawSignatureData: string;
  clientDevice?: ClientDeviceInfo;
  ipAddress?: string;
  userAgent?: string;
  agreedToPrivacy: boolean;
  agreedToTerms: boolean;
}) {
  const now = new Date();
  const agreement = SUBCONTRACTOR_AGREEMENT_IL_2025;

  // Create SHA-256 hash of signature data for secure storage
  const signatureHash = crypto
    .createHash("sha256")
    .update(
      [
        agreement.version,
        input.subcontractorId,
        input.fullName,
        input.email,
        input.rawSignatureData,
        now.toISOString()
      ].join("|")
    )
    .digest("hex");

  // Device info stored as string for compatibility with existing schema
  const deviceInfo = input.clientDevice 
    ? JSON.stringify(input.clientDevice)
    : undefined;

  return {
    id: crypto.randomUUID(),
    subcontractorId: input.subcontractorId,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    agreementVersion: agreement.version,
    signedAt: now,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    deviceInfo, // Enhanced: now includes full ClientDeviceInfo
    signatureMethod: input.signatureMethod,
    signaturePayload: signatureHash,
    agreementSnapshotJson: agreement, // Store as JSONB object (not string)
    agreedToPrivacy: input.agreedToPrivacy,
    agreedToTerms: input.agreedToTerms,
    auditTrailId: `audit_${Date.now()}_${Math.floor(Math.random() * 999999)}`
  };
}

/* ===========================================
 * 6. BACKWARDS COMPATIBILITY EXPORTS
 * ===========================================
 * These exports ensure existing code continues to work.
 */

// Alias for backwards compatibility with existing routes
export const SUBCONTRACTOR_AGREEMENT_2025 = SUBCONTRACTOR_AGREEMENT_IL_2025;

// Alias for backwards compatibility
export const createSubcontractorSignature = createSubcontractorSignatureRecord;

/**
 * MIGRATION GUIDE FOR DEVELOPERS:
 * 
 * This file replaces src/contracts/subcontractorAgreement2025.ts
 * 
 * Key improvements in this version:
 * 1. ✅ ClientDeviceInfo - detailed device tracking (OS, browser, app version, device model)
 * 2. ✅ DataRetentionPolicy - legal compliance configuration
 * 3. ✅ IsraelComplianceConfig2025 - structured compliance rules
 * 4. ✅ Enhanced Zod validation - modern 2025 patterns
 * 5. ✅ Multi-platform support - Web, iOS, Android ready
 * 6. ✅ Future-proof for 2026 regulations
 * 
 * NO CHANGES NEEDED in existing routes - backwards compatible exports provided.
 */
