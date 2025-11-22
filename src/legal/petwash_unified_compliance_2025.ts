/**
 * FILE: src/legal/petwash_unified_compliance_2025.ts
 *
 * מערכת תאימות משפטית מאוחדת לפט וואש בע"מ לשנת 2025
 * כולל:
 * - תיקון 13 לחוק הגנת הפרטיות (ישראל) - דגש דיגיטלי
 * - תיעוד מעבדי נתונים חיצוניים (Replit, Google Cloud, Firebase, Nayax)
 * - קטלוג עיבודי מידע עיקריים בכל הפלטפורמות
 * - מדיניות שמירת מידע
 * - זכויות נושאי המידע והטיפול בבקשות
 *
 * חשוב:
 * - זה קוד עזר וארכיטקטורה, לא ייעוץ משפטי.
 * - עורך דין צריך לאשר את הנוסח הסופי של המדיניות באתר.
 * - המטרה היא לתת למפתח בסיס חזק ומסודר, עם מקום להרחבות בקלות.
 */

/* --------------------------------------------------------
 * 1. טיפוסים כלליים לתאימות פרטיות
 * ------------------------------------------------------*/

export type DataCategory =
  | "identifiers"              // שם, טלפון, אימייל, ת.ז (אם נשמר), מזהה משתמש
  | "contact_details"          // טלפון, אימייל, כתובת
  | "pet_profile"              // שם הכלב, גזע, גיל, מידע לא רפואי
  | "payment_metadata"         // מזהי עסקה, טוקנים, 4 ספרות אחרונות של כרטיס בלבד
  | "technical_logs"           // IP, דפדפן, מערכת הפעלה, לוגים
  | "location_data"            // עיר, אזור, מיקום תחנת רחצה
  | "behavioral_usage"         // היסטוריית שימוש, ביקורים, נקודות מועדון
  | "subcontractor_profile"    // פרטי קבלני משנה, מסמכים, רישוי
  | "support_tickets"          // פניות שירות ותכתובות
  | "media_files"              // תמונות, קבצים שהעלו המשתמשים
  | "sensitive_data_limited";  // רק אם יהיה בעתיד - מידע רגיש מוגבל (להימנע אם אפשר)

/** בסיס משפטי לעיבוד מידע לפי תיקון 13 (פישוט) */
export type LegalBasis =
  | "contract"          // ביצוע חוזה עם הלקוח
  | "legal_obligation"  // חובה חוקית מפורשת
  | "legitimate_interest" // אינטרס לגיטימי של החברה, תוך שמירה על זכויות הנושא
  | "consent"           // הסכמה מפורשת, במיוחד לשיווק ישיר וטראקינג
  | "vital_interest";   // מקרים חריגים - הגנה על חייו או שלמות גופו של אדם

/** זכויות נושאי המידע בתיקון 13 (תמצית) */
export type DataSubjectRight =
  | "access"
  | "rectification"
  | "erasure"
  | "restriction"
  | "objection"
  | "portability";

/** מדיניות שמירת מידע */
export type DataRetentionPolicy =
  | "SHORT_LOGS"    // לוגים קצרים - לדוגמה 30 - 90 יום
  | "STANDARD"      // תקן - לדוגמה 7 שנים לחשבונאות, לפי דין
  | "EXTENDED"      // יותר ארוך - חוזים, תביעות פוטנציאליות
  | "UNTIL_DELETED" // עד בקשת מחיקה מאושרת
  | "SESSION_ONLY"; // נשמר בזמן סשן בלבד, לא בדטאבייס קבוע

/* --------------------------------------------------------
 * 2. מידע על השליטה במידע - Pet Wash Ltd כ"בעל מאגר"
 * ------------------------------------------------------*/

export const PETWASH_ISRAEL_CONTROLLER_2025 = {
  company: {
    legalNameHe: "פט וואש בע\"מ",
    legalNameEn: "Pet Wash Ltd",
    companyNumber: "517145033",
    registeredAddress: "רחוב עוזי חיטמן 8, ראש העין, ישראל",
  },
  contact: {
    email: "support@petwash.co.il",
    phone: "+972-54-983-3355", // לעדכן לפי הצורך
    website: "https://petwash.co.il",
  },
  // האם נדרש ממונה הגנת פרטיות - לשיקול עו"ד. כאן הגדרה גמישה.
  dpoConfig: {
    isDpoMandatory: false, // אפשר לשנות ל true אם בסוף יוחלט שכן
    hasDesignatedPerson: true,
    dpoOrPrivacyContact: {
      roleTitle: "אחראי הגנת פרטיות בחברה",
      email: "privacy@petwash.co.il", // להגדיר תיבה ייעודית בעתיד
    },
  },
};

/* --------------------------------------------------------
 * 3. תיאור מעבדי נתונים חיצוניים (Processors)
 * ------------------------------------------------------*/

export interface ThirdPartyProcessor {
  id: string;
  provider: string;
  role: string; // לדוגמה: "Hosting provider", "Payment processor"
  legalEntityCountry: string;
  purpose: string[];
  dataCategories: DataCategory[];
  controllerRelationship: "processor" | "joint_controller" | "independent_controller";
  legalBasis: LegalBasis[];
  dataLocationAndTransfers: {
    description: string;
    safeguards: string[];
  };
  retention: {
    technicalLogs?: string;
    applicationData?: string;
    dataSubjectRequestsHandling?: string;
  };
  securityMeasures: string[];
  contract: {
    dpaInPlace: boolean;
    description: string;
    urlHint?: string;
  };
  israelPrivacyCompliance: {
    isProcessorUnderAmendment13: boolean;
    registeredAsForeignServiceProvider?: boolean;
    notes: string;
  };
  lastReviewed: string; // ISO date
}

/**
 * Replit - מעבד נתונים חיצוני עבור סביבת הפיתוח וההרצה
 * זה אותו אוביקט שכתבנו קודם, מעט מעודכן כדי להתאים למבנה הכללי.
 */
export const REPLIT_PROCESSOR_2025: ThirdPartyProcessor = {
  id: "replit_cloud_2025",
  provider: "Replit, Inc.",
  role: "Third party hosting and runtime provider",
  legalEntityCountry: "United States of America",
  purpose: [
    "Hosting of the Pet Wash application code in Replit cloud environment",
    "Providing build, deployment and runtime infrastructure for the Pet Wash platforms",
    "Collecting technical logs for security, stability and debugging",
    "Monitoring resource usage in order to protect the system from abuse and attacks",
  ],
  dataCategories: [
    "technical_logs",
    "identifiers", // ברמת צוות בלבד - משתמשי המערכת
  ],
  controllerRelationship: "processor",
  legalBasis: ["contract", "legitimate_interest"],
  dataLocationAndTransfers: {
    description:
      "Replit may store and process technical logs and application data in data centres located outside Israel, " +
      "including the European Union and the United States, according to Replit infrastructure design.",
    safeguards: [
      "Use of encryption in transit (HTTPS TLS)",
      "Logical separation between Pet Wash project and other tenants",
      "Contractual data protection commitments in Replit terms and data protection addendum",
    ],
  },
  retention: {
    technicalLogs:
      "Technical logs held by Replit according to its own retention policy for security and operational purposes.",
    applicationData:
      "Application data retention is controlled by Pet Wash databases and backup configuration, not directly by Replit.",
    dataSubjectRequestsHandling:
      "When Pet Wash approves a deletion request, application data is removed at the Pet Wash level and will no longer be accessible via Replit runtime.",
  },
  securityMeasures: [
    "TLS encryption for traffic between users and the hosted application",
    "Access control to the Replit workspace only for authorised Pet Wash staff and developers",
    "Use of environment secrets for credentials - no hardcoded secrets in the codebase",
    "Regular review of permissions and access tokens for Replit accounts",
  ],
  contract: {
    dpaInPlace: true,
    description:
      "Data processing is governed by Replit Terms of Service and Data Protection Addendum as accepted by Pet Wash Ltd. " +
      "These documents define Replit as a processor and Pet Wash Ltd as the controller.",
    urlHint: "See Replit official website for up to date legal documents.",
  },
  israelPrivacyCompliance: {
    isProcessorUnderAmendment13: true,
    registeredAsForeignServiceProvider: true,
    notes:
      "Replit is treated as an external data processor. Pet Wash Ltd remains responsible as data controller for fulfilling data subject rights under Israeli privacy law.",
  },
  lastReviewed: "2025-11-22",
};

/**
 * Google Cloud / Firebase - אחסון נתונים, אימות, לוגים
 * זה תיאור כללי - המפתח צריך להתאים בדיוק לשירותים שבשימוש.
 */
export const GOOGLE_FIREBASE_PROCESSOR_2025: ThirdPartyProcessor = {
  id: "google_firebase_2025",
  provider: "Google Cloud / Firebase",
  role: "Cloud infrastructure, authentication and application database provider",
  legalEntityCountry: "United States of America",
  purpose: [
    "Storing application data and backups for Pet Wash platforms",
    "Providing authentication and identity management services",
    "Collecting security logs, audit trails and performance metrics",
  ],
  dataCategories: [
    "identifiers",
    "contact_details",
    "pet_profile",
    "behavioral_usage",
    "technical_logs",
    "support_tickets",
    "subcontractor_profile",
  ],
  controllerRelationship: "processor",
  legalBasis: ["contract", "legitimate_interest", "legal_obligation"],
  dataLocationAndTransfers: {
    description:
      "Data may be stored in Google Cloud data centres in the EU, Israel region if available and other locations configured by Pet Wash. " +
      "Cross border transfers are governed by Google's data protection framework.",
    safeguards: [
      "Encryption at rest and in transit according to Google Cloud security standards",
      "Region selection and configuration by Pet Wash where possible",
      "Data Processing Addendum with Google including standard contractual clauses where required",
    ],
  },
  retention: {
    technicalLogs:
      "Security and access logs retained according to Google default policies and Pet Wash configuration.",
    applicationData:
      "Main retention periods defined by Pet Wash inside its own databases and backup rotation schedules.",
    dataSubjectRequestsHandling:
      "When Pet Wash deletes user data inside Firebase or Cloud databases, the deletion request passes through the cloud infrastructure according to Google retention mechanisms.",
  },
  securityMeasures: [
    "Strong authentication and access control for Pet Wash admin accounts",
    "Use of separate projects for production and development where possible",
    "Use of encrypted connections and service accounts with least privilege access",
    "Regular review of IAM roles and access keys",
  ],
  contract: {
    dpaInPlace: true,
    description:
      "Processing is governed by Google Cloud and Firebase terms and Data Processing Addendum accepted by Pet Wash Ltd.",
    urlHint: "See Google Cloud / Firebase legal centre for full details.",
  },
  israelPrivacyCompliance: {
    isProcessorUnderAmendment13: true,
    registeredAsForeignServiceProvider: true,
    notes:
      "Google Cloud and Firebase are treated as processors. Pet Wash Ltd is the controller and responsible toward Israeli data subjects.",
  },
  lastReviewed: "2025-11-22",
};

/**
 * Nayax Israel - ספק סליקה וטרמינלי תשלום בתחנות פיזיות
 * שים לב - מידע כרטיס אשראי המלא נשאר אצל נאייקס בלבד.
 */
export const NAYAX_ISRAEL_PROCESSOR_2025: ThirdPartyProcessor = {
  id: "nayax_israel_2025",
  provider: "Nayax Ltd. (Israel)",
  role: "Payment terminal and clearing provider for Pet Wash self service stations",
  legalEntityCountry: "Israel",
  purpose: [
    "Processing card payments and digital wallet payments at Pet Wash stations",
    "Providing transaction reports and settlement information to Pet Wash finance department",
    "Performing fraud prevention and transaction monitoring according to card schemes and law",
  ],
  dataCategories: [
    "payment_metadata",  // רק מזהי עסקה וטוקנים שנשמרים אצל Pet Wash
    "technical_logs",    // לוגי תקשורת בין הטרמינל לפלטפורמת ניהול
    "identifiers",       // במקרים של מועדון לקוחות וקישור עסקה לחשבון
  ],
  controllerRelationship: "processor",
  legalBasis: ["contract", "legal_obligation", "legitimate_interest"],
  dataLocationAndTransfers: {
    description:
      "Card data is processed by Nayax according to PCI DSS standards. Pet Wash receives only transaction tokens, " +
      "partial details and settlement reports. Data is stored mainly in Israel and additional locations used by Nayax.",
    safeguards: [
      "PCI DSS compliant infrastructure controlled by Nayax",
      "Tokenisation of card details - Pet Wash does not store full card numbers",
      "Encrypted communication between stations, terminals and Nayax servers",
    ],
  },
  retention: {
    technicalLogs:
      "Technical communication and terminal logs retained by Nayax according to its security policy.",
    applicationData:
      "Pet Wash stores transaction tokens and reports as accounting records for periods required by law and tax rules.",
    dataSubjectRequestsHandling:
      "Requests related to card data are handled in coordination between Pet Wash and Nayax within legal limits.",
  },
  securityMeasures: [
    "Use of certified payment terminals supplied and approved by Nayax",
    "Physical security and installation procedures at Pet Wash stations",
    "Segregation between payment data and other telemetry data of the stations",
  ],
  contract: {
    dpaInPlace: true,
    description:
      "Relationship is governed by merchant and processing agreements between Pet Wash Ltd and Nayax including data protection clauses.",
  },
  israelPrivacyCompliance: {
    isProcessorUnderAmendment13: true,
    notes:
      "Nayax is a local processor under Israeli law. Pet Wash remains the controller for its customer database and loyalty data.",
  },
  lastReviewed: "2025-11-22",
};

/**
 * אוסף כל המעבדים החיצוניים במקום אחד - קל לשימוש למפתחים ולמסכים משפטיים.
 */
export const THIRD_PARTY_PROCESSORS_2025: ThirdPartyProcessor[] = [
  REPLIT_PROCESSOR_2025,
  GOOGLE_FIREBASE_PROCESSOR_2025,
  NAYAX_ISRAEL_PROCESSOR_2025,
];

/* --------------------------------------------------------
 * 4. קטלוג עיבודי מידע עיקריים (Records of Processing)
 * ------------------------------------------------------*/

export interface RecordOfProcessing {
  id: string;
  systemName: string;       // לדוגמה: "petwash_public_site", "petwash_loyalty_app"
  description: string;
  dataSubjects: string[];   // לקוחות, בעלי חיים, קבלני משנה, עובדי רשויות וכו
  dataCategories: DataCategory[];
  purposes: string[];
  legalBasis: LegalBasis[];
  processorsUsed: string[]; // מזהי processor מתוך THIRD_PARTY_PROCESSORS_2025
  retentionPolicy: DataRetentionPolicy;
  rightsSupported: DataSubjectRight[];
  usesCookiesOrTracking: boolean;
  requiresCookieConsentBanner: boolean;
  allowsDataDeletionRequests: boolean;
}

export const PETWASH_RECORDS_OF_PROCESSING_2025: RecordOfProcessing[] = [
  {
    id: "public_website_contact_forms",
    systemName: "petwash_public_site",
    description: "טפסי יצירת קשר, הצטרפות לעדכונים ובקשות מידע באתר הראשי petwash.co.il",
    dataSubjects: ["לקוחות קיימים", "לקוחות פוטנציאליים", "נציגי רשויות"],
    dataCategories: [
      "identifiers",
      "contact_details",
      "technical_logs",
      "behavioral_usage",
    ],
    purposes: [
      "מענה לפניות לקוחות ורשויות",
      "שליחת מידע שנרשמו אליו במפורש",
      "שיפור השירות והאתר על בסיס נתונים מצרפיים",
    ],
    legalBasis: ["contract", "consent", "legitimate_interest"],
    processorsUsed: ["replit_cloud_2025", "google_firebase_2025"],
    retentionPolicy: "STANDARD",
    rightsSupported: ["access", "rectification", "erasure", "objection"],
    usesCookiesOrTracking: true,
    requiresCookieConsentBanner: true,
    allowsDataDeletionRequests: true,
  },
  {
    id: "loyalty_and_vip_club",
    systemName: "petwash_loyalty_platform",
    description:
      "מערכת מועדון לקוחות ונקודות רחצה של Pet Wash כולל אפליקציה ואתר אישי ללקוחות.",
    dataSubjects: ["לקוחות רשומים", "בעלי חיים של הלקוחות"],
    dataCategories: [
      "identifiers",
      "contact_details",
      "pet_profile",
      "behavioral_usage",
      "location_data",
      "payment_metadata",
    ],
    purposes: [
      "ניהול חשבון הלקוח והיסטוריית השימוש בתחנות הרחצה",
      "מתן תגמולים, מבצעים ונקודות מועדון",
      "מניעת הונאות ושימוש לא תקין במתקנים",
    ],
    legalBasis: ["contract", "legitimate_interest", "consent"],
    processorsUsed: ["google_firebase_2025", "nayax_israel_2025"],
    retentionPolicy: "STANDARD",
    rightsSupported: [
      "access",
      "rectification",
      "erasure",
      "restriction",
      "objection",
      "portability",
    ],
    usesCookiesOrTracking: true,
    requiresCookieConsentBanner: true,
    allowsDataDeletionRequests: true,
  },
  {
    id: "subcontractor_management",
    systemName: "petwash_subcontractor_panel",
    description:
      "ניהול קבלני משנה, הסכמי 2025, חתימות דיגיטליות, מסמכי רישוי ותיעוד עבודות בשטח.",
    dataSubjects: ["קבלני משנה", "ספקים עצמאיים", "טכנאים ומתקינים"],
    dataCategories: [
      "subcontractor_profile",
      "identifiers",
      "contact_details",
      "technical_logs",
      "support_tickets",
      "media_files",
    ],
    purposes: [
      "חתימה וניהול הסכמי קבלני משנה",
      "תיעוד ביצוע עבודות, ביקורות, תקלות ופתרונן",
      "עמידה בדרישות חוקיות וביטוחיות",
    ],
    legalBasis: ["contract", "legal_obligation", "legitimate_interest"],
    processorsUsed: ["google_firebase_2025", "replit_cloud_2025"],
    retentionPolicy: "EXTENDED",
    rightsSupported: ["access", "rectification", "erasure", "restriction"],
    usesCookiesOrTracking: false,
    requiresCookieConsentBanner: false,
    allowsDataDeletionRequests: true,
  },
  {
    id: "iot_station_telemetry",
    systemName: "petwash_station_iot",
    description:
      "טלאמטריה טכנית מהעמדות בשטח - צריכת מים, סבון, זמני עבודה, התרעות תקלות.",
    dataSubjects: ["לקוחות בעקיפין", "קבלני תחזוקה"],
    dataCategories: ["technical_logs", "location_data"],
    purposes: [
      "בקרת תפקוד העמדות",
      "שיפור השירות והזמינות",
      "אבטחה וזיהוי תקלות או שימוש חריג",
    ],
    legalBasis: ["legitimate_interest", "contract"],
    processorsUsed: ["nayax_israel_2025", "google_firebase_2025"],
    retentionPolicy: "SHORT_LOGS",
    rightsSupported: ["access", "erasure"],
    usesCookiesOrTracking: false,
    requiresCookieConsentBanner: false,
    allowsDataDeletionRequests: false, // נתונים טכניים בלבד, לעתים אנונימיים
  },
];

/* --------------------------------------------------------
 * 5. פונקציות עזר למפתחים ומסכי ניהול
 * ------------------------------------------------------*/

/**
 * מחזיר Processor לפי מזהה - לשימוש במסכי אדמין ובבדיקות.
 */
export function getProcessorById(id: string): ThirdPartyProcessor | undefined {
  return THIRD_PARTY_PROCESSORS_2025.find((p) => p.id === id);
}

/**
 * מחזיר את רשומת העיבוד עבור מערכת מסוימת.
 * לדוגמה: getRecordOfProcessing("petwash_loyalty_platform");
 */
export function getRecordOfProcessing(
  systemName: string
): RecordOfProcessing | undefined {
  return PETWASH_RECORDS_OF_PROCESSING_2025.find(
    (r) => r.systemName === systemName
  );
}

/**
 * בודק אם למערכת מסוימת יש צורך בבאנר עוגיות לפי תיקון 13.
 * אפשר להשתמש בזה ישירות בפרונט.
 */
export function requiresCookieBanner(systemName: string): boolean {
  const record = getRecordOfProcessing(systemName);
  return !!record && record.requiresCookieConsentBanner;
}

/**
 * מחזיר רשימה מרוכזת של כל הזכויות שנתמכות בפלטפורמות -
 * אפשר להשתמש בטקסט במדיניות פרטיות או במסך "זכויות משתמש".
 */
export function getAllSupportedRights(): DataSubjectRight[] {
  const set = new Set<DataSubjectRight>();
  PETWASH_RECORDS_OF_PROCESSING_2025.forEach((r) =>
    r.rightsSupported.forEach((right) => set.add(right))
  );
  return Array.from(set);
}

/**
 * דוגמת ולידציה גבוהה לרמת קלט בבקשות "זכות להישכח" (מחיקה).
 * המפתח יכול להרחיב - לוודא אימות משתמש, תיעוד ועוד.
 */
export interface ErasureRequestInput {
  userId: string;
  email: string;
  reason?: string;
  systemName: string;
}

export interface ErasureRequestValidationResult {
  ok: boolean;
  errors: string[];
  record?: RecordOfProcessing;
}

export function validateErasureRequest(
  input: ErasureRequestInput
): ErasureRequestValidationResult {
  const errors: string[] = [];
  if (!input.userId) errors.push("Missing userId");
  if (!input.email) errors.push("Missing email");
  const record = getRecordOfProcessing(input.systemName);
  if (!record) errors.push("Unknown systemName");
  if (record && !record.allowsDataDeletionRequests) {
    errors.push("This system does not support individual erasure requests");
  }
  return {
    ok: errors.length === 0,
    errors,
    record,
  };
}

/* --------------------------------------------------------
 * 6. הערות למפתח
 * ------------------------------------------------------*/
/**
 * - יש לחבר את האוביקטים האלה למדיניות הפרטיות באתר:
 *   - בפרונט: ליצור מסך "מידע על פרטיות" שמושך נתונים מ PETWASH_ISRAEL_CONTROLLER_2025
 *     ומשתמש ברשומות מ PETWASH_RECORDS_OF_PROCESSING_2025 כדי להסביר:
 *       - אילו נתונים נאספים
 *       - לאילו מטרות
 *       - לכמה זמן
 *       - עם מי משתפים (processorsUsed + getProcessorById)
 *
 * - כדאי ליצור API:
 *   - GET /api/legal/privacy-config - מחזיר את כל האוביקטים הללו לקריאה בלבד.
 *   - POST /api/legal/erasure-request - משתמש ב validateErasureRequest
 *     ומעביר את הבקשה ל workflow פנימי של תמיכה.
 *
 * - כאשר מוסיפים פלטפורמה חדשה (למשל מדינה חדשה או שירות חדש):
 *   1. להוסיף RecordOfProcessing חדש.
 *   2. אם יש ספק חדש - להוסיף ThirdPartyProcessor חדש ולצרף ל THIRD_PARTY_PROCESSORS_2025.
 *   3. לעדכן את המדיניות באתר ואת מסכי הניהול.
 *
 * - חשוב להתאים בפועל את הטקסטים בהתאם לעו"ד:
 *   - especially legalBasis
 *   - תקופות שמירת מידע
 *   - האם נדרש DPO רשמי
 *
 * - הקובץ הזה נותן "תמונה גדולה" אחת, מסודרת, במקום פיזור קונפיגים
 *   בקבצים שונים. כך המפתח, עו"ד והנהלה יכולים לעבוד באותה שפה.
 */