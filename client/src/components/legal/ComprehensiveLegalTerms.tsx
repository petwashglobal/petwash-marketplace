import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Scale, 
  Shield, 
  FileText, 
  AlertTriangle,
  Globe,
  Lock,
  Gavel,
  Building,
  Clock,
  CreditCard,
  Users,
  CheckCircle2,
  Info,
  Wallet,
  BookOpen
} from "lucide-react";

interface ComprehensiveLegalTermsProps {
  section?: 
    | "indemnification" 
    | "force-majeure" 
    | "governing-law" 
    | "dispute-resolution" 
    | "data-protection" 
    | "escrow-structure"
    | "consumer-rights"
    | "platform-liability"
    | "all";
  className?: string;
}

export function ComprehensiveLegalTerms({ section = "all", className = "" }: ComprehensiveLegalTermsProps) {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';
  const isRTL = isHebrew;

  const legalSections = {
    indemnification: {
      title: isHebrew ? "שיפוי והגנה" : "Indemnification & Hold Harmless",
      icon: Shield,
      content: [
        {
          title: isHebrew ? "שיפוי על ידי הספק" : "Provider Indemnification",
          text: isHebrew 
            ? `הספק מתחייב לשפות, להגן ולפטור את ⁦Pet Wash™⁩, מנהליה, עובדיה, סוכניה ושותפיה מכל תביעה, נזק, הפסד, אחריות, עלות והוצאה (כולל שכר טרחת עורכי דין) הנובעים מ: (א) הפרת תנאי הסכם זה, (ב) רשלנות או התנהגות פסולה במתן שירותים, (ג) הפרת זכויות צד שלישי, (ד) אי-ציות לחוקי ישראל או תקנות רלוונטיות, (ה) נזק לחיות מחמד, לקוחות או רכוש צד שלישי.`
            : `Provider agrees to indemnify, defend and hold harmless ⁦Pet Wash™⁩, its officers, employees, agents and partners from any claim, damage, loss, liability, cost and expense (including attorneys' fees) arising from: (a) Breach of this Agreement, (b) Negligence or misconduct in service delivery, (c) Infringement of third-party rights, (d) Non-compliance with Israeli law or applicable regulations, (e) Harm to pets, customers or third-party property.`
        },
        {
          title: isHebrew ? "שיפוי על ידי הלקוח" : "Customer Indemnification",
          text: isHebrew
            ? `הלקוח מתחייב לשפות את ⁦Pet Wash™⁩ והספקים מכל תביעה הנובעת מ: (א) מסירת מידע שגוי או חלקי על חיית המחמד, (ב) הסתרת מצב רפואי או התנהגותי, (ג) הפרת התחייבויות הלקוח בהסכם זה, (ד) נזק שנגרם על ידי חיית המחמד לספק, רכושו או צד שלישי.`
            : `Customer agrees to indemnify ⁦Pet Wash™⁩ and Providers from any claim arising from: (a) Providing false or incomplete pet information, (b) Concealing medical or behavioral conditions, (c) Breach of Customer obligations in this Agreement, (d) Damage caused by pet to Provider, their property or third parties.`
        },
        {
          title: isHebrew ? "הליכי שיפוי" : "Indemnification Procedures",
          text: isHebrew
            ? `צד המבקש שיפוי יודיע לצד המשפה תוך 14 ימים מקבלת תביעה. הצד המשפה יהיה רשאי להשתתף בהגנה ולשלוט בה, בכפוף להסכמת הצד המשופה. אין להגיע לפשרה ללא הסכמה בכתב של שני הצדדים.`
            : `Party seeking indemnification shall notify indemnifying party within 14 days of receiving a claim. Indemnifying party may participate in and control the defense, subject to indemnified party's consent. No settlement without written consent of both parties.`
        }
      ]
    },
    forceMajeure: {
      title: isHebrew ? "כוח עליון" : "Force Majeure",
      icon: AlertTriangle,
      content: [
        {
          title: isHebrew ? "אירועי כוח עליון" : "Force Majeure Events",
          text: isHebrew
            ? `אף צד לא יישא באחריות לעיכוב או אי-ביצוע התחייבויותיו כתוצאה מאירועים שאינם בשליטתו הסבירה, כולל אך לא מוגבלים ל: מלחמה, פעולות איבה, מתקפות טרור, מצב חירום לאומי, מגפות או מחלות מידבקות, אסונות טבע (רעידות אדמה, שיטפונות, שריפות), שביתות כלליות או סגרים ממשלתיים, הפסקות חשמל או תקשורת נרחבות, פעולות ממשלתיות או רגולטוריות.`
            : `Neither party shall be liable for delay or failure to perform obligations due to events beyond reasonable control, including but not limited to: War, hostilities, terrorist attacks, national emergency, Pandemics or infectious diseases, Natural disasters (earthquakes, floods, fires), General strikes or government lockdowns, Widespread power or communication outages, Government or regulatory actions.`
        },
        {
          title: isHebrew ? "הודעה וצמצום נזקים" : "Notice and Mitigation",
          text: isHebrew
            ? `הצד המושפע יודיע לצד השני תוך 48 שעות מהתרחשות אירוע כוח עליון, יפרט את האירוע והשפעתו הצפויה, וינקוט בכל האמצעים הסבירים לצמצום ההשפעה. אם האירוע נמשך יותר מ-30 יום, כל צד רשאי לסיים הזמנות מושפעות ללא קנס.`
            : `Affected party shall notify the other within 48 hours of Force Majeure occurrence, detail the event and its expected impact, and take all reasonable measures to mitigate impact. If event continues for more than 30 days, either party may terminate affected bookings without penalty.`
        },
        {
          title: isHebrew ? "השלכות פיננסיות" : "Financial Consequences",
          text: isHebrew
            ? `בקרות אירוע כוח עליון: תשלומים שטרם שולמו יעוכבו עד להסרת האירוע. תשלומים בנאמנות יוחזרו ללקוחות אם השירות לא ניתן. ⁦Pet Wash™⁩ לא תהיה אחראית להוצאות נסיעה, אבדן הכנסות או נזקים תוצאתיים.`
            : `Upon Force Majeure event: Unpaid payments shall be suspended until event removal. Escrowed payments shall be refunded to Customers if service not provided. ⁦Pet Wash™⁩ shall not be liable for travel expenses, lost income or consequential damages.`
        }
      ]
    },
    governingLaw: {
      title: isHebrew ? "דין חל וסמכות שיפוט" : "Governing Law & Jurisdiction",
      icon: Gavel,
      content: [
        {
          title: isHebrew ? "דין חל" : "Governing Law",
          text: isHebrew
            ? `הסכם זה יפורש ויוסדר לפי חוקי מדינת ישראל, ללא התחשבות בכללי ברירת הדין שלה. בהתאם לפסיקת בית המשפט העליון בעניין אגודה נ' צביה (ע"א 6992/22), חוק הגנת הצרכן הישראלי יחול על כל עסקה עם צרכן ישראלי, ללא קשר לתניות ברירת דין זר בהסכמים.`
            : `This Agreement shall be construed and governed by the laws of the State of Israel, without regard to its conflict of law rules. Pursuant to the Supreme Court ruling in Agoda v. Tzvia (CA 6992/22), Israeli Consumer Protection Law applies to all transactions with Israeli consumers, regardless of foreign choice-of-law clauses in agreements.`
        },
        {
          title: isHebrew ? "סמכות שיפוט בלעדית" : "Exclusive Jurisdiction",
          text: isHebrew
            ? `הצדדים מסכימים לסמכות שיפוט בלעדית של בתי המשפט בתל אביב-יפו, ישראל לכל סכסוך הנובע מהסכם זה או הקשור אליו. ויתור על זכות לתבוע בפורום אחר או לבקש העברת תיק לבית משפט מחוץ לישראל.`
            : `Parties agree to exclusive jurisdiction of courts in Tel Aviv-Jaffa, Israel for any dispute arising from or related to this Agreement. Waiver of right to sue in another forum or request case transfer to court outside Israel.`
        },
        {
          title: isHebrew ? "פסיקת אגודה (2024)" : "Agoda Ruling (2024)",
          text: isHebrew
            ? `בהתאם לפסיקת בית המשפט העליון מ-2024: פלטפורמות המכוונות לצרכנים ישראליים (באמצעות ממשק עברי, קבלת שקלים) חייבות לציית לחוק הגנת הצרכן הישראלי. תניות ברירת דין זר בחוזים אחידים מהוות "תנאי מקפח" ובטלות. ⁦Pet Wash™⁩ מתחייבת לציות מלא לחוק הגנת הצרכן, התשמ"א-1981.`
            : `Pursuant to 2024 Supreme Court ruling: Platforms targeting Israeli consumers (via Hebrew interface, accepting Shekels) must comply with Israeli Consumer Protection Law. Foreign choice-of-law clauses in standard contracts constitute "unfair advantage" and are void. ⁦Pet Wash™⁩ commits to full compliance with Consumer Protection Law, 5741-1981.`
        }
      ]
    },
    disputeResolution: {
      title: isHebrew ? "יישוב סכסוכים ובוררות" : "Dispute Resolution & Arbitration",
      icon: Scale,
      content: [
        {
          title: isHebrew ? "שלב ראשון: משא ומתן ישיר" : "Stage 1: Direct Negotiation",
          text: isHebrew
            ? `כל סכסוך יטופל תחילה במשא ומתן ישיר בין הצדדים. יש לפנות לתמיכת ⁦Pet Wash™⁩ תוך 72 שעות מהאירוע. הפלטפורמה תשתדל לתווך בין הצדדים תוך 7 ימי עסקים.`
            : `Any dispute shall first be addressed through direct negotiation between parties. Contact ⁦Pet Wash™⁩ support within 72 hours of incident. Platform will endeavor to mediate between parties within 7 business days.`
        },
        {
          title: isHebrew ? "שלב שני: גישור" : "Stage 2: Mediation",
          text: isHebrew
            ? `אם המשא ומתן נכשל, הצדדים יפנו לגישור מוסכם דרך מרכז הגישור הישראלי או מוסד דומה מוכר. עלויות הגישור יתחלקו שווה בשווה בין הצדדים. הליך הגישור לא יעלה על 60 יום.`
            : `If negotiation fails, parties shall submit to agreed mediation through the Israeli Mediation Center or similar recognized institution. Mediation costs shall be split equally between parties. Mediation process shall not exceed 60 days.`
        },
        {
          title: isHebrew ? "שלב שלישי: בוררות" : "Stage 3: Arbitration",
          text: isHebrew
            ? `אם הגישור נכשל, הסכסוך יועבר לבוררות מחייבת בפני בורר יחיד שימונה על ידי לשכת עורכי הדין בישראל. פסק הבוררות יהיה סופי ומחייב. הוצאות הבוררות יוטלו בהתאם להחלטת הבורר. ויתור: הצדדים מוותרים על זכותם לתביעה ייצוגית.`
            : `If mediation fails, dispute shall be submitted to binding arbitration before a single arbitrator appointed by the Israel Bar Association. Arbitration award shall be final and binding. Arbitration costs shall be allocated per arbitrator's decision. Waiver: Parties waive their right to class action lawsuit.`
        },
        {
          title: isHebrew ? "חריגים" : "Exceptions",
          text: isHebrew
            ? `הליכי הבוררות אינם חלים על: צווי מניעה זמניים לעצירת נזק מיידי, תביעות בית דין לתביעות קטנות עד ₪35,000, הליכים פליליים או רגולטוריים, אכיפת פסקי בוררות.`
            : `Arbitration procedures do not apply to: Temporary injunctions to stop immediate harm, Small claims court actions up to ₪35,000, Criminal or regulatory proceedings, Enforcement of arbitration awards.`
        }
      ]
    },
    dataProtection: {
      title: isHebrew ? "הגנת מידע ופרטיות" : "Data Protection & Privacy",
      icon: Lock,
      content: [
        {
          title: isHebrew ? "חוק הגנת הפרטיות" : "Privacy Protection Law",
          text: isHebrew
            ? `⁦Pet Wash™⁩ פועלת בהתאם לחוק הגנת הפרטיות, התשמ"א-1981, כולל תיקון 2025. הפלטפורמה רשומה כמאגר מידע אצל רשם מאגרי המידע. מידע אישי נאסף למטרות הבאות בלבד: אספקת שירותי הפלטפורמה, עיבוד תשלומים, תקשורת בין משתמשים, מניעת הונאה ואבטחה, שיפור השירות וחוויית המשתמש.`
            : `⁦Pet Wash™⁩ operates in compliance with Privacy Protection Law, 5741-1981, including 2025 amendment. Platform is registered as a database with the Registrar of Databases. Personal information collected solely for: Providing platform services, Payment processing, User communication, Fraud prevention and security, Service improvement and user experience.`
        },
        {
          title: isHebrew ? "זכויות נושא המידע" : "Data Subject Rights",
          text: isHebrew
            ? `בהתאם לחוק, למשתמשים הזכות ל: לעיין במידע האישי שלהם, לתקן מידע לא מדויק, למחוק מידע (בכפוף לחובות רגולטוריות), להתנגד לעיבוד מידע לשיווק ישיר, להעביר את המידע לשירות אחר (ניידות מידע). פניות יטופלו תוך 30 יום.`
            : `Per law, users have the right to: Review their personal information, Correct inaccurate information, Delete information (subject to regulatory obligations), Object to direct marketing processing, Transfer data to another service (data portability). Requests processed within 30 days.`
        },
        {
          title: isHebrew ? "אבטחת מידע" : "Information Security",
          text: isHebrew
            ? `⁦Pet Wash™⁩ מיישמת אמצעי אבטחה מתקדמים כולל: הצפנת נתונים בהעברה ובאחסון (TLS 1.3, AES-256), אימות רב-גורמי, גיבויים מוצפנים יומיים, ניטור אבטחה 24/7, בדיקות חדירה תקופתיות. בקרות גישה מבוססות תפקיד מגבילות גישה למידע לעובדים הזקוקים לו.`
            : `⁦Pet Wash™⁩ implements advanced security measures including: Data encryption in transit and at rest (TLS 1.3, AES-256), Multi-factor authentication, Daily encrypted backups, 24/7 security monitoring, Periodic penetration testing. Role-based access controls limit information access to employees requiring it.`
        },
        {
          title: isHebrew ? "העברת מידע" : "Data Transfers",
          text: isHebrew
            ? `מידע אישי עשוי להיות מועבר לצדדים שלישיים רק ל: עיבוד תשלומים (ספקי סליקה מורשים), שירותי ענן מאובטחים (Google Cloud), ספקי ביטוח (לטיפול בתביעות), רשויות לפי דרישת חוק. כל העברה כפופה להסכמי עיבוד נתונים המחייבים הגנה שווה לזו הקיימת בישראל.`
            : `Personal information may be transferred to third parties only for: Payment processing (authorized processors), Secure cloud services (Google Cloud), Insurance providers (for claims handling), Authorities per legal requirements. All transfers subject to data processing agreements requiring protection equivalent to Israeli standards.`
        },
        {
          title: isHebrew ? "נתונים ביומטריים" : "Biometric Data",
          text: isHebrew
            ? `לספקים המשתמשים בהזדהות ביומטרית (WebAuthn/Passkey): נתוני ביומטריה מעובדים מקומית במכשיר ואינם נשלחים לשרתי ⁦Pet Wash™⁩. רק מפתחות הצפנה ציבוריים מאוחסנים לצורך אימות. הסכמה מפורשת נדרשת לפני הפעלת הזדהות ביומטרית.`
            : `For Providers using biometric authentication (WebAuthn/Passkey): Biometric data processed locally on device and not sent to ⁦Pet Wash™⁩ servers. Only public encryption keys stored for verification. Explicit consent required before activating biometric authentication.`
        }
      ]
    },
    escrowStructure: {
      title: isHebrew ? "מבנה הנאמנות המשפטי" : "Legal Escrow Structure",
      icon: Wallet,
      content: [
        {
          title: isHebrew ? "גוף הנאמנות" : "Escrow Entity",
          text: isHebrew
            ? `כספי הנאמנות מוחזקים על ידי Pet Wash Payments Ltd. (ח.פ. 516XXXXXX), חברת בת בבעלות מלאה של ⁦Pet Wash™⁩ Ltd. החברה מפוקחת על ידי רשות שוק ההון, הביטוח והחיסכון כנותנת שירותי תשלום. הכספים מופרדים לחלוטין מחשבונות התפעול של ⁦Pet Wash™⁩.`
            : `Escrow funds held by Pet Wash Payments Ltd. (Company No. 516XXXXXX), a wholly-owned subsidiary of ⁦Pet Wash™⁩ Ltd. Company supervised by the Capital Market, Insurance and Savings Authority as a payment service provider. Funds completely segregated from ⁦Pet Wash™⁩ operational accounts.`
        },
        {
          title: isHebrew ? "הפרדת כספים" : "Fund Segregation",
          text: isHebrew
            ? `כספי הנאמנות מוחזקים בחשבון נאמנות ייעודי בבנק הפועלים. הכספים אינם חלק מנכסי ⁦Pet Wash™⁩ ומוגנים מפני נושים במקרה של חדלות פירעון. דוחות כספיים מבוקרים מתפרסמים מדי שנה.`
            : `Escrow funds held in dedicated trust account at Bank Hapoalim. Funds are not part of ⁦Pet Wash™⁩ assets and protected from creditors in case of insolvency. Audited financial statements published annually.`
        },
        {
          title: isHebrew ? "תנאי שחרור כספים" : "Fund Release Conditions",
          text: isHebrew
            ? `כספים ישוחררו לספק בהתקיים כל התנאים הבאים: (1) השירות הושלם לפי תנאי ההזמנה, (2) עברו 72 שעות מסיום השירות, (3) הלקוח לא פתח סכסוך, (4) אין חקירה פעילה בנוגע להזמנה. אם נפתח סכסוך, הכספים יוחזקו עד להחלטה סופית.`
            : `Funds released to Provider when ALL conditions met: (1) Service completed per booking terms, (2) 72 hours passed since service end, (3) Customer did not open dispute, (4) No active investigation regarding booking. If dispute opened, funds held until final decision.`
        },
        {
          title: isHebrew ? "החזרים ותשלומים חלקיים" : "Refunds & Partial Payments",
          text: isHebrew
            ? `בקרות סכסוך, ⁦Pet Wash™⁩ רשאית: להחזיר סכום מלא ללקוח, לשחרר סכום מלא לספק, לחלק את הסכום בין הצדדים, להעביר את ההחלטה לבוררות. Chargebacks מספק הסליקה יקוזזו מיתרת הספק. מחלוקות על סכומים מעל ₪10,000 יועברו לבוררות.`
            : `Upon dispute, ⁦Pet Wash™⁩ may: Refund full amount to Customer, Release full amount to Provider, Split amount between parties, Refer decision to arbitration. Chargebacks from payment processor deducted from Provider balance. Disputes over ₪10,000 referred to arbitration.`
        }
      ]
    },
    consumerRights: {
      title: isHebrew ? "זכויות צרכן ישראליות" : "Israeli Consumer Rights",
      icon: BookOpen,
      content: [
        {
          title: isHebrew ? "זכות ביטול 14 יום" : "14-Day Cancellation Right",
          text: isHebrew
            ? `בהתאם לחוק הגנת הצרכן, לצרכנים זכות לבטל עסקה מרחוק תוך 14 יום מיום ההתקשרות, ללא צורך בנימוק. חריגים: הזמנות שמועד ביצוען תוך 7 ימים מההזמנה, שירותים שהחלו להינתן בהסכמת הצרכן. דמי ביטול: עד 5% מהעסקה או ₪100, הנמוך מביניהם.`
            : `Per Consumer Protection Law, consumers have right to cancel remote transaction within 14 days of engagement, without reason. Exceptions: Bookings scheduled within 7 days of order, Services that began with consumer consent. Cancellation fee: Up to 5% of transaction or ₪100, whichever is lower.`
        },
        {
          title: isHebrew ? "גילויי חובה" : "Mandatory Disclosures",
          text: isHebrew
            ? `לפני כל עסקה, ⁦Pet Wash™⁩ חייבת לגלות: שם העסק, מספר ח.פ., כתובת בישראל ובחו"ל, המאפיינים העיקריים של השירות, המחיר הכולל כולל מע"מ, תנאי תשלום ומשלוח, מדיניות ביטול והחזרה, תקופת אחריות (אם רלוונטי).`
            : `Before any transaction, ⁦Pet Wash™⁩ must disclose: Business name, Company registration number, Address in Israel and abroad, Main service characteristics, Total price including VAT, Payment and delivery terms, Cancellation and return policy, Warranty period (if applicable).`
        },
        {
          title: isHebrew ? "קבלה ואישור עסקה" : "Receipt & Transaction Confirmation",
          text: isHebrew
            ? `לאחר כל עסקה, הלקוח יקבל אישור בכתב (דוא"ל) הכולל: פרטי העסקה המלאים, פירוט מחירים, מועדי ביצוע השירות, מדיניות ביטול, פרטי התקשרות לשירות לקוחות. האישור יישמר ויהיה זמין לגישה בחשבון המשתמש.`
            : `After every transaction, Customer receives written confirmation (email) including: Full transaction details, Price breakdown, Service execution dates, Cancellation policy, Customer service contact details. Confirmation saved and accessible in user account.`
        },
        {
          title: isHebrew ? "תיקון ופיצוי" : "Remedy & Compensation",
          text: isHebrew
            ? `אם השירות לא סופק כמתואר: הלקוח זכאי לתיקון או החזר מלא. הלקוח רשאי לבחור בין תיקון, מתן שירות חלופי, או החזר כספי. פיצוי נוסף: עד ₪10,000 בנסיבות חריגות (למשל, נזק לחיית המחמד כתוצאה מרשלנות). תביעות מעל ₪35,000 יועברו לבית משפט רגיל.`
            : `If service not provided as described: Customer entitled to remedy or full refund. Customer may choose between repair, alternative service provision, or monetary refund. Additional compensation: Up to ₪10,000 in exceptional circumstances (e.g., pet harm due to negligence). Claims over ₪35,000 referred to regular court.`
        }
      ]
    },
    platformLiability: {
      title: isHebrew ? "אחריות הפלטפורמה ומגבלות" : "Platform Liability & Limitations",
      icon: Building,
      content: [
        {
          title: isHebrew ? "תפקיד כמתווך" : "Intermediary Role",
          text: isHebrew
            ? `⁦Pet Wash™⁩ פועלת כפלטפורמת שוק טכנולוגית המחברת לקוחות וספקים. ⁦Pet Wash™⁩ אינה: מעסיקה את הספקים (קבלנים עצמאיים), צד לחוזה השירות בין הלקוח לספק, אחראית ישירות לאיכות השירותים, ערבה לביצועי הספקים. בהתאם לפסיקת אגודה (2024), ⁦Pet Wash™⁩ נושאת באחריות משנית כלפי צרכנים ישראליים.`
            : `⁦Pet Wash™⁩ operates as a technology marketplace platform connecting Customers and Providers. ⁦Pet Wash™⁩ is NOT: Employer of Providers (independent contractors), Party to service contract between Customer and Provider, Directly responsible for service quality, Guarantor of Provider performance. Per Agoda ruling (2024), ⁦Pet Wash™⁩ bears secondary liability to Israeli consumers.`
        },
        {
          title: isHebrew ? "אחריות משנית" : "Secondary Liability",
          text: isHebrew
            ? `בהתאם לפסיקת בית המשפט העליון בעניין אגודה, ⁦Pet Wash™⁩ נושאת באחריות משנית הכוללת: וידוא ציות לחוק הגנת הצרכן, טיפול בתלונות צרכנים בתום לב, יישוב סכסוכים במנגנון הוגן, שקיפות מחירים ותנאים. אחריות זו אינה הופכת את ⁦Pet Wash™⁩ לספקית שירותים ישירה.`
            : `Per Supreme Court ruling in Agoda case, ⁦Pet Wash™⁩ bears secondary liability including: Ensuring Consumer Protection Law compliance, Handling consumer complaints in good faith, Fair dispute resolution mechanisms, Price and terms transparency. This liability does not make ⁦Pet Wash™⁩ a direct service provider.`
        },
        {
          title: isHebrew ? "הגבלת אחריות כספית" : "Financial Liability Cap",
          text: isHebrew
            ? `אחריותה הכספית של ⁦Pet Wash™⁩ מוגבלת ל: נזקים ישירים בלבד (לא נזקים תוצאתיים, אבדן רווחים, או נזקים עקיפים), הסכום ששולם עבור ההזמנה הרלוונטית, או ₪50,000, הנמוך מביניהם. הגבלה זו אינה חלה על: מוות או נזקי גוף כתוצאה מרשלנות, הונאה או הטעיה מכוונת, הפרה של חוק הגנת הפרטיות.`
            : `⁦Pet Wash™⁩ financial liability limited to: Direct damages only (not consequential damages, lost profits, or indirect damages), Amount paid for the relevant booking, Or ₪50,000, whichever is lower. This limitation does not apply to: Death or bodily injury due to negligence, Fraud or intentional misrepresentation, Privacy Protection Law violations.`
        },
        {
          title: isHebrew ? "הסתמכות על ביטוח" : "Insurance Reliance",
          text: isHebrew
            ? `ביטוח הפלטפורמה הוא משני לכל ביטוח קיים. הלקוחות מעודדים לוודא: ביטוח חיות מחמד פעיל, ביטוח דירה מכסה נזקי חיות. הספקים חייבים לדאוג ל: ביטוח אחריות מקצועית, ביטוח תאונות אישיות. ⁦Pet Wash™⁩ לא מפצה על פערי ביטוח של משתמשים.`
            : `Platform insurance is secondary to any existing insurance. Customers encouraged to ensure: Active pet insurance, Home insurance covering pet damage. Providers must secure: Professional liability insurance, Personal accident insurance. ⁦Pet Wash™⁩ does not compensate for user insurance gaps.`
        }
      ]
    }
  };

  const renderSection = (key: string, data: any) => (
    <Card key={key} className="bg-white/5 border-white/10 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <data.icon className="w-5 h-5 text-white" />
            </div>
            <CardTitle className="text-lg text-white">{data.title}</CardTitle>
          </div>
          <Badge variant="outline" className="border-blue-500/30 text-blue-400">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {isHebrew ? "חוקי" : "Legal"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {data.content.map((item: any, idx: number) => (
            <AccordionItem key={idx} value={`item-${idx}`} className="border-white/10">
              <AccordionTrigger className="text-white/90 hover:text-white text-sm py-3">
                {item.title}
              </AccordionTrigger>
              <AccordionContent className="text-white/70 text-sm leading-relaxed pb-4 whitespace-pre-line">
                {item.text}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );

  const sectionMap: Record<string, keyof typeof legalSections> = {
    "indemnification": "indemnification",
    "force-majeure": "forceMajeure",
    "governing-law": "governingLaw",
    "dispute-resolution": "disputeResolution",
    "data-protection": "dataProtection",
    "escrow-structure": "escrowStructure",
    "consumer-rights": "consumerRights",
    "platform-liability": "platformLiability"
  };

  if (section && section !== "all") {
    const sectionKey = sectionMap[section];
    if (sectionKey && legalSections[sectionKey]) {
      return (
        <div className={className} dir={isRTL ? "rtl" : "ltr"}>
          {renderSection(sectionKey, legalSections[sectionKey])}
        </div>
      );
    }
  }

  return (
    <div className={`space-y-6 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className="text-center mb-8">
        <Badge className="bg-blue-500/20 text-blue-400 mb-4">
          <Scale className="w-4 h-4 mr-1" />
          {isHebrew ? "מסמכים משפטיים מלאים" : "Comprehensive Legal Documents"}
        </Badge>
        <h2 className="text-2xl font-bold text-white mb-2">
          {isHebrew ? "תנאים משפטיים מפורטים" : "Detailed Legal Terms"}
        </h2>
        <p className="text-white/60 max-w-2xl mx-auto">
          {isHebrew 
            ? "כל התנאים המשפטיים, ההגנות והמחויבויות בהתאם לחוק הישראלי"
            : "All legal terms, protections and obligations in accordance with Israeli law"}
        </p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        {Object.entries(legalSections).map(([key, data]) => renderSection(key, data))}
      </div>

      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-amber-400 mb-1">
              {isHebrew ? "הודעה משפטית" : "Legal Notice"}
            </h4>
            <p className="text-sm text-white/70">
              {isHebrew 
                ? "מסמך זה נועד למטרות מידע בלבד ואינו מהווה ייעוץ משפטי. מומלץ להתייעץ עם עורך דין מוסמך בישראל לשאלות משפטיות ספציפיות. תנאים אלה עשויים להשתנות בהתאם לשינויי חקיקה ופסיקה."
                : "This document is for informational purposes only and does not constitute legal advice. It is recommended to consult with a qualified Israeli attorney for specific legal questions. These terms may change in accordance with legislation and case law updates."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComprehensiveLegalTerms;
