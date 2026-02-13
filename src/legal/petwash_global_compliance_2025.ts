/**
 * ============================================================
 * PET WASH™ GLOBAL COMPLIANCE ENGINE 2025
 * ============================================================
 * Scope:
 * - Parent company: Pet Wash Ltd (פט וואש בע"מ)
 * - All Pet Wash platforms: web, mobile, control panel, academy,
 *   marketplace, loyalty, subcontractors, etc.
 *
 * Focus:
 * - Israel law 2025 (incl. expected תיקון 13 לחוק הגנת הפרטיות)
 * - תיקון 40 לחוק הספאם (שיווק במייל, SMS, וואטסאפ)
 * - Cookie consent and tracking transparency
 * - Data subject rights (עיון, תיקון, מחיקה, יצוא, התנגדות לשיווק)
 * - Basic DPO (ממונה הגנת פרטיות) metadata, if needed
 * - Digital signatures for subcontractors (קבלני משנה)
 * - Logging of consents and privacy requests for evidential purposes
 *
 * IMPORTANT:
 * - This is a technical structure designed to help compliance.
 * - The legal Hebrew text must be reviewed and approved by a lawyer
 *   specialising in privacy and commercial law in Israel.
 * - This file is written in TypeScript style and assumes:
 *     - Node 18+
 *     - Express backend
 *     - Will be wired to a real DB (Postgres / Firestore / etc)
 */

import crypto from "crypto";
import type { Request, Response } from "express";

/* -----------------------------------------------------------
   0. CORE COMPANY PROFILE – PET WASH LTD
----------------------------------------------------------- */

export const PETWASH_COMPANY_PROFILE_2025 = {
  legalNameHe: "פט וואש בע\"מ",
  legalNameEn: "PET WASH LTD",
  companyNumber: "517145033",
  registeredAddressHe: "רחוב עוזי חיטמן 8, ראש העין, ישראל",
  registeredAddressEn: "8 Uzi Hitman St, Rosh HaAyin, Israel",
  supportEmail: "support@petwash.co.il",
  adminEmail: "nir.h@petwash.co.il",
  // DPO is optional – if later you appoint one, fill here.
  dpoRequiredEstimate: false,
  dpoContactEmail: null as string | null,
};

/* -----------------------------------------------------------
   1. BASE TYPES FOR LEGAL DOCUMENTS
----------------------------------------------------------- */

export interface LegalSection {
  id: string;
  title: string;
  body: string[];
}

export interface LegalDocument {
  version: string;
  language: "he" | "en";
  title: string;
  updatedAt: string; // ISO date
  sections: LegalSection[];
}

/* -----------------------------------------------------------
   2. TERMS OF USE – תנאי שימוש
----------------------------------------------------------- */

export const TERMS_OF_USE_2025: LegalDocument = {
  version: "2025.01",
  language: "he",
  title: "תנאי שימוש באתר, באפליקציה ובפלטפורמות ⁦Pet Wash™⁩",
  updatedAt: "2025-01-01",
  sections: [
    {
      id: "1",
      title: "כללי",
      body: [
        "ברוכים הבאים לפט וואש בע\"מ (⁦Pet Wash™⁩ Ltd), ח.פ. 517145033.",
        "השימוש באתר, באפליקציות, בפלטפורמות ובמערכות הניהול הפנימיות של ⁦Pet Wash™⁩ (להלן יחד: \"הפלטפורמות\") כפוף להסכמתכם לתנאי שימוש אלו.",
        "אם אינכם מסכימים לתנאים, אינכם רשאים לעשות שימוש בפלטפורמות.",
      ],
    },
    {
      id: "2",
      title: "השירותים",
      body: [
        "החברה מפעילה מערך שירותים הכולל בין היתר: עמדות רחיצת כלבים וחתולים, הזמנות ותשלומים, לוגיסטיקה, שירותי תחזוקה והתקנה, מועדון לקוחות, פלטפורמות להזמנת שירותים דרך ספקי משנה (קבלני משנה) ופלטפורמות הדרכה.",
        "החברה רשאית לעדכן, לשנות, להרחיב או לצמצם את השירותים ללא הודעה מוקדמת, בכפוף לדין.",
      ],
    },
    {
      id: "3",
      title: "שימוש מותר ואיסור שימוש לרעה",
      body: [
        "השימוש בפלטפורמות מותר לצורך קבלת שירותים בהתאם למדיניות החברה.",
        "אסור לעשות כל שימוש בפלטפורמות לצרכים בלתי חוקיים, פוגעניים, משבשים, לרבות ניסיון חדירה למערכות, שימוש בבוטים זדוניים או איסוף מידע ללא הרשאה.",
      ],
    },
    {
      id: "4",
      title: "הגבלת אחריות",
      body: [
        "השירותים ניתנים כפי שהם (AS IS) וכפי שהם זמינים (AS AVAILABLE).",
        "החברה אינה אחראית לנזק עקיף, תוצאתי או נזק שנגרם כתוצאה משימוש לא תקין בעמדות הרחצה או בשירותים הניתנים על ידי קבלני משנה, בכפוף לדין הישראלי.",
      ],
    },
    {
      id: "5",
      title: "שינויים בתנאים",
      body: [
        "החברה רשאית לעדכן מעת לעת את תנאי השימוש.",
        "הודעה על שינוי מהותי תפורסם באתר או תישלח באמצעי תקשורת מתאימים.",
      ],
    },
  ],
};

/* -----------------------------------------------------------
   3. PRIVACY POLICY – מדיניות פרטיות (תיקון 13)
----------------------------------------------------------- */

export const PRIVACY_POLICY_2025: LegalDocument = {
  version: "2025.01",
  language: "he",
  title: "מדיניות פרטיות – פט וואש בע\"מ (מותאמת לתיקון 13)",
  updatedAt: "2025-01-01",
  sections: [
    {
      id: "1",
      title: "מי אנחנו ואיך ליצור קשר",
      body: [
        `בעל המאגר: ${PETWASH_COMPANY_PROFILE_2025.legalNameHe}, ח.פ. ${PETWASH_COMPANY_PROFILE_2025.companyNumber}.`,
        `כתובת: ${PETWASH_COMPANY_PROFILE_2025.registeredAddressHe}.`,
        `אימייל ליצירת קשר בנושא פרטיות: ${PETWASH_COMPANY_PROFILE_2025.supportEmail}.`,
      ],
    },
    {
      id: "2",
      title: "סוגי המידע שאנו אוספים",
      body: [
        "פרטי זיהוי: שם מלא, טלפון, אימייל, עיר מגורים, ולעתים כתובת מלאה לצורכי חיוב וחשבונית.",
        "פרטי שימוש בשירות: היסטוריית רחיצות, חבילות שנרכשו, שימוש באפליקציה, נקודות צבירה, פעולות מועדון לקוחות.",
        "פרטי תשלום: עסקאות דרך ספקי סליקה חיצוניים (למשל Nayax ישראל). מספרי כרטיס אשראי לא נשמרים במערכות ⁦Pet Wash™⁩.",
        "מזהים דיגיטליים: כתובת IP, מזהי עוגיות (cookies), מזהה מכשיר, מזהי אנליטיקה ושיווק, בכפוף לחוק ולעוגיות שאישרתם.",
        "מידע וולונטרי: תמונות של חיות מחמד, העדפות, הערות שירות, פניות תמיכה.",
      ],
    },
    {
      id: "3",
      title: "מטרות עיבוד המידע והבסיס החוקי",
      body: [
        "מתן השירות שביקשתם, ניהול הזמנות ותשלומים.",
        "ניהול מועדון לקוחות, הטבות ונאמנות, בכפוף להסכמה שלכם לחומר שיווקי.",
        "שיפור השירות, ביצוע מדידות אנליטיות ושיפור חוויית המשתמש.",
        "עמידה בחובות חוקיות כמו ניהול ספרי חשבונות, מניעת הונאות ודיווח לרשויות כמתחייב מהדין.",
      ],
    },
    {
      id: "4",
      title: "חלוקת מידע לצדדים שלישיים",
      body: [
        "ספקי סליקה ותשלומים (למשל Nayax ישראל) - לצורך גביית תשלום בלבד.",
        "ספקי אחסון ענן ושירותים טכניים (Google Cloud, Replit, GitHub וכדומה) לצורך אחסון מאובטח וגיבויים.",
        "קבלני משנה שהוסמכו על ידי החברה, כאשר הדבר נדרש לצורך ביצוע השירות עבורכם.",
        "העברת מידע לרשויות מוסמכות כאשר יש חובה חוקית או צו שיפוטי.",
      ],
    },
    {
      id: "5",
      title: "זכויותיכם לפי חוק הגנת הפרטיות (כולל תיקון 13)",
      body: [
        "זכות עיון – לבקש לדעת אילו נתונים אישיים שמורים עליכם במאגר.",
        "זכות תיקון – לבקש תיקון מידע שאינו מדויק, חלקי, שגוי או לא מעודכן.",
        "זכות מחיקה (\"הזכות להישכח\") – לבקש מחיקת מידע, בכפוף לחובות חוקיות לשמירת מידע.",
        "זכות להתנגד לשימוש במידע לצרכי שיווק ישיר.",
        `לביצוע זכויות אלו ניתן לפנות לכתובת: ${PETWASH_COMPANY_PROFILE_2025.supportEmail}.`,
      ],
    },
    {
      id: "6",
      title: "משך שמירת מידע",
      body: [
        "נתוני חיוב וחשבוניות - נשמרים לפי דרישות מס הכנסה ודיני ניהול ספרים.",
        "נתוני מועדון לקוחות ושימוש בשירות - נשמרים כל עוד החשבון פעיל ועד תקופה סבירה לאחר מכן או עד בקשת מחיקה, בכפוף לדין.",
        "לוגים טכניים ונתוני אבטחה - נשמרים לפי הצורך לצורכי אבטחת מידע ותיעוד.",
      ],
    },
    {
      id: "7",
      title: "אבטחת מידע",
      body: [
        "שימוש בהצפנת SSL בכל האזורים הרלוונטיים.",
        "הגבלת גישה למידע אישי לעובדים, ספקים וקבלני משנה לפי עיקרון הצורך לדעת בלבד.",
        "גיבויים מאובטחים והקשחת גישה למערכות ניהול.",
      ],
    },
    {
      id: "8",
      title: "עדכונים למדיניות",
      body: [
        "מדיניות זו עשויה להתעדכן מעת לעת.",
        "עדכון מהותי יפורסם באתר או בשליחת הודעה מתאימה.",
      ],
    },
  ],
};

/* -----------------------------------------------------------
   4. COOKIE POLICY AND CATEGORIES
----------------------------------------------------------- */

export interface CookieCategory {
  id: "necessary" | "analytics" | "marketing" | "functional";
  title: string;
  description: string;
  required: boolean;
}

export const COOKIE_POLICY_2025 = {
  version: "2025.01",
  language: "he",
  title: "מדיניות עוגיות (Cookies)",
  updatedAt: "2025-01-01",
  categories: [
    {
      id: "necessary",
      title: "עוגיות הכרחיות",
      description:
        "עוגיות אלה נדרשות להפעלה תקינה של האתר והאפליקציה, ואינן ניתנות לכיבוי במערכות שלנו.",
      required: true,
    },
    {
      id: "analytics",
      title: "עוגיות אנליטיקה",
      description:
        "משמשות למדידת שימוש באתר ובאפליקציה כדי לשפר ביצועים וחוויית משתמש.",
      required: false,
    },
    {
      id: "marketing",
      title: "עוגיות שיווק",
      description:
        "משמשות להתאמת פרסומות ותוכן שיווקי, כולל שימוש בפיקסלים של רשתות חברתיות ומערכות פרסום חיצוניות.",
      required: false,
    },
    {
      id: "functional",
      title: "עוגיות פונקציונליות",
      description:
        "מאפשרות שמירת העדפות שלכם ולשיפור פונקציונליות מותאמת אישית.",
      required: false,
    },
  ] as CookieCategory[],
};

/* -----------------------------------------------------------
   5. CANCELLATION / REFUND POLICY (BASIC)
   Note: user said Pet Wash generally does not offer refunds.
----------------------------------------------------------- */

export const CANCELLATION_POLICY_2025: LegalDocument = {
  version: "2025.01",
  language: "he",
  title: "מדיניות ביטולים והחזרים – פט וואש בע\"מ",
  updatedAt: "2025-01-01",
  sections: [
    {
      id: "1",
      title: "עקרון כללי",
      body: [
        "ככלל, רכישת חבילות רחצה, כרטיסיות, מנויים, או e-gift מתבצעת סופית וללא החזר כספי, אלא אם נקבע אחרת או נדרש לפי דין.",
        "החברה רשאית, לפי שיקול דעתה, להעניק זיכוי או הארכת תוקף בנסיבות מיוחדות.",
      ],
    },
    {
      id: "2",
      title: "מקרים בהם תישקל מתן זיכוי",
      body: [
        "תקלה טכנית בעמדה שנמצאה באחריות החברה ולא ניתנה אפשרות לקבל שירות חלופי