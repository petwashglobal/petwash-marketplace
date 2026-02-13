import { useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  FileText, 
  Scale, 
  Clock, 
  CreditCard, 
  AlertTriangle,
  CheckCircle2,
  Info,
  Building,
  UserCheck,
  Wallet,
  Calendar,
  Globe
} from "lucide-react";

type LegalSection = 
  | "platform-terms"
  | "provider-agreement"
  | "customer-terms"
  | "pricing-disclosure"
  | "escrow-policy"
  | "cancellation-policy"
  | "privacy-policy"
  | "liability-disclaimer"
  | "israeli-compliance";

interface MarketplaceLegalContentProps {
  section?: LegalSection;
  compact?: boolean;
  className?: string;
}

export function MarketplaceLegalContent({ section, compact = false, className = "" }: MarketplaceLegalContentProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he' || i18n.language === 'ar';
  const isHebrew = i18n.language === 'he';

  const legalContent = {
    platformTerms: {
      title: isHebrew ? "תנאי שימוש בפלטפורמה" : "Platform Terms of Service",
      icon: FileText,
      lastUpdated: "January 2026",
      sections: [
        {
          title: isHebrew ? "הגדרות ותנאים כלליים" : "Definitions and General Terms",
          content: isHebrew 
            ? `⁦Pet Wash™⁩ היא פלטפורמת שוק מקוונת ("השוק") המחברת בין בעלי חיות מחמד ("לקוחות") לבין נותני שירות עצמאיים ("ספקים"). ⁦Pet Wash™⁩ אינה מספקת שירותי טיפול בחיות מחמד באופן ישיר, אלא משמשת כמתווכת טכנולוגית המאפשרת חיבור בין הצדדים. כל ספק הוא קבלן עצמאי ואינו עובד של ⁦Pet Wash™⁩.`
            : `⁦Pet Wash™⁩ is an online marketplace platform ("Marketplace") connecting pet owners ("Customers") with independent service providers ("Providers"). ⁦Pet Wash™⁩ does not directly provide pet care services but acts as a technology intermediary enabling connections between parties. Each Provider is an independent contractor and not an employee of ⁦Pet Wash™⁩.`
        },
        {
          title: isHebrew ? "תפקיד הפלטפורמה" : "Platform Role",
          content: isHebrew
            ? `⁦Pet Wash™⁩ מספקת: (1) טכנולוגיית שוק לחיבור לקוחות וספקים, (2) עיבוד תשלומים מאובטח, (3) מערכת נאמנות 72 שעות להגנה פיננסית, (4) כלי תקשורת ולוח זמנים, (5) מערכת דירוג וביקורות, (6) ערוצי יישוב סכסוכים. ⁦Pet Wash™⁩ לא מתחייבת לזמינות ספקים, איכות השירותים, או התאמה לכל חיית מחמד.`
            : `⁦Pet Wash™⁩ provides: (1) Marketplace technology connecting Customers and Providers, (2) Secure payment processing, (3) 72-hour escrow system for financial protection, (4) Communication and scheduling tools, (5) Rating and review system, (6) Dispute resolution channels. ⁦Pet Wash™⁩ does not guarantee Provider availability, service quality, or suitability for any pet.`
        },
        {
          title: isHebrew ? "כשירות שימוש" : "Eligibility",
          content: isHebrew
            ? `שימוש בפלטפורמה מותר למשתמשים מעל גיל 18 בלבד. לקוחות חייבים להיות בעלי חוקיים של חיות המחמד או מורשים לפעול בשמם. ספקים חייבים לעמוד בכל דרישות הרישוי המקומיות, לספק מסמכי זיהוי תקפים, ולעבור תהליך אימות של הפלטפורמה.`
            : `Platform use is restricted to users 18 years or older. Customers must be legal owners of pets or authorized to act on their behalf. Providers must meet all local licensing requirements, provide valid identification documents, and complete platform verification processes.`
        }
      ]
    },
    providerAgreement: {
      title: isHebrew ? "הסכם ספק שירות" : "Provider Service Agreement",
      icon: UserCheck,
      lastUpdated: "January 2026",
      sections: [
        {
          title: isHebrew ? "מעמד קבלן עצמאי" : "Independent Contractor Status",
          content: isHebrew
            ? `כספק ב-⁦Pet Wash™⁩, הנך מאשר כי אתה קבלן עצמאי ולא עובד. אתה אחראי ל: (1) דיווח והעברת מיסים, (2) ביטוח אחריות מקצועית, (3) ציוד ואספקה, (4) קביעת לוח זמנים ותמחור, (5) עמידה בתקנות מקומיות. ⁦Pet Wash™⁩ גובה עמלת פלטפורמה של 15% מסך ההזמנה. יתרת 85% מועברת לספק בתום תקופת הנאמנות.`
            : `As a ⁦Pet Wash™⁩ Provider, you acknowledge being an independent contractor, not an employee. You are responsible for: (1) Tax reporting and remittance, (2) Professional liability insurance, (3) Equipment and supplies, (4) Schedule and pricing determination, (5) Local regulatory compliance. ⁦Pet Wash™⁩ charges a 15% platform commission on total bookings. The remaining 85% is transferred to Providers after the escrow period.`
        },
        {
          title: isHebrew ? "תמחור ותשלומים" : "Pricing and Payments",
          content: isHebrew
            ? `ספקים קובעים תעריפים עצמאיים כולל: מחיר בסיס ללילה/לביקור, תוספת לחיית מחמד נוספת, שירותים נלווים ותוספות. הפלטפורמה עשויה לחשב אוטומטית: תוספות סופ"ש (20%), תוספות חג (30%), הנחות משך (10% שבועי, 20% חודשי). התשלומים מועברים תוך 3-5 ימי עסקים מסיום תקופת הנאמנות.`
            : `Providers set independent rates including: Base rate per night/visit, Additional pet surcharge, Add-on services and extras. The platform may automatically calculate: Weekend surcharges (20%), Holiday surcharges (30%), Duration discounts (10% weekly, 20% monthly). Payments are transferred within 3-5 business days after escrow completion.`
        },
        {
          title: isHebrew ? "ציות לחוקי ישראל" : "Israeli Legal Compliance",
          content: isHebrew
            ? `ספקים הפועלים בישראל חייבים לעמוד ב: חוק חובת המכרזים לקבלנים עצמאיים, פקודת מס הכנסה וחוק מע"מ, תקנות ביטוח לאומי, חוק הגנת הפרטיות התשמ"א-1981 (כולל תיקון 2025), תקנות רווחת בעלי חיים. ⁦Pet Wash™⁩ עשויה לספק טפסים וכלים לעזרה בציות אך אינה מספקת ייעוץ משפטי או מיסויי.`
            : `Providers operating in Israel must comply with: Independent contractor regulations, Income Tax Ordinance and VAT Law, National Insurance regulations, Privacy Protection Law 5741-1981 (including 2025 amendment), Animal welfare regulations. ⁦Pet Wash™⁩ may provide forms and tools to assist compliance but does not provide legal or tax advice.`
        }
      ]
    },
    customerTerms: {
      title: isHebrew ? "תנאי לקוח" : "Customer Terms",
      icon: Shield,
      lastUpdated: "January 2026",
      sections: [
        {
          title: isHebrew ? "הזמנות ותשלומים" : "Bookings and Payments",
          content: isHebrew
            ? `התשלום נגבה בעת אישור ההזמנה ומוחזק בנאמנות עד 72 שעות לאחר סיום השירות. הלקוח מקבל אישור הזמנה עם פירוט מחירים מלא כולל: מחיר בסיס, תוספות חיות מחמד, תוספות סופ"ש/חג, שירותים נלווים, עמלת פלטפורמה ומע"מ.`
            : `Payment is collected upon booking confirmation and held in escrow until 72 hours after service completion. Customers receive booking confirmation with full price breakdown including: Base rate, Additional pet charges, Weekend/holiday surcharges, Add-on services, Platform fee and VAT.`
        },
        {
          title: isHebrew ? "אחריות הלקוח" : "Customer Responsibilities",
          content: isHebrew
            ? `הלקוח מתחייב ל: (1) מסירת מידע מדויק על חיית המחמד כולל היסטוריה רפואית, התנהגות וצרכים מיוחדים, (2) חיסונים עדכניים לפי דרישות הספק, (3) הספקת ציוד נחוץ (מזון, תרופות, צעצועים), (4) זמינות לתקשורת במקרי חירום, (5) תשלום בזמן לפי תנאי ההזמנה.`
            : `Customers commit to: (1) Providing accurate pet information including medical history, behavior and special needs, (2) Up-to-date vaccinations per Provider requirements, (3) Supplying necessary equipment (food, medications, toys), (4) Availability for emergency communication, (5) Timely payment per booking terms.`
        },
        {
          title: isHebrew ? "יישוב סכסוכים" : "Dispute Resolution",
          content: isHebrew
            ? `במקרה של בעיות עם שירות, יש לפנות לתמיכת ⁦Pet Wash™⁩ תוך 72 שעות. הפלטפורמה תחקור ועשויה: להציע החזר מלא או חלקי, לתווך בין הצדדים, לנקוט פעולה נגד ספק. החזרים כספיים מוגבלים לסכום שהוחזק בנאמנות ולא יחרגו מהתשלום המקורי.`
            : `If issues arise with service, contact ⁦Pet Wash™⁩ support within 72 hours. The platform will investigate and may: Offer full or partial refund, Mediate between parties, Take action against Provider. Monetary refunds are limited to escrowed amounts and shall not exceed original payment.`
        }
      ]
    },
    pricingDisclosure: {
      title: isHebrew ? "גילוי מחירים" : "Pricing Disclosure",
      icon: CreditCard,
      lastUpdated: "January 2026",
      sections: [
        {
          title: isHebrew ? "מבנה עמלות הפלטפורמה" : "Platform Fee Structure",
          content: isHebrew
            ? `⁦Pet Wash™⁩ גובה עמלה אחידה של 15% מסך ההזמנה. עמלה זו כוללת: עיבוד תשלומים מאובטח, מערכת נאמנות 72 שעות, תמיכת לקוחות, פיתוח ותחזוקת פלטפורמה, אימות ספקים, מנגנון יישוב סכסוכים. לספקים מועבר 85% מסך ההזמנה לאחר תקופת הנאמנות.`
            : `⁦Pet Wash™⁩ charges a uniform 15% commission on total bookings. This fee includes: Secure payment processing, 72-hour escrow system, Customer support, Platform development and maintenance, Provider verification, Dispute resolution mechanisms. Providers receive 85% of total booking after escrow period.`
        },
        {
          title: isHebrew ? "תמחור דינמי" : "Dynamic Pricing",
          content: isHebrew
            ? `המחירים עשויים להשתנות בהתאם ל: תוספת סופ"ש - עד 20% מעל מחיר בסיס בימי שישי-שבת, תוספת חג - עד 30% מעל מחיר בסיס בחגים ישראליים, הנחת משך - עד 10% להזמנות שבועיות, 20% להזמנות חודשיות, תוספת חיית מחמד נוספת - נקבעת על ידי כל ספק. כל ההנחות והתוספות מוצגות בבירור לפני אישור ההזמנה.`
            : `Prices may vary based on: Weekend surcharge - up to 20% above base on Friday-Saturday, Holiday surcharge - up to 30% above base on Israeli holidays, Duration discount - up to 10% for weekly, 20% for monthly bookings, Additional pet surcharge - set by each Provider. All discounts and surcharges are clearly displayed before booking confirmation.`
        },
        {
          title: isHebrew ? "אומדני מחיר" : "Price Estimates",
          content: isHebrew
            ? `אומדני מחיר המוצגים בחיפוש הם להמחשה בלבד ועשויים להשתנות בהתאם ל: זמינות ספק ספציפי, תאריכים וזמנים מבוקשים, סוג וגודל חיית המחמד, שירותים נלווים נבחרים, דרישות מיוחדות. המחיר הסופי מאושר רק לאחר בחירת ספק ספציפי ואישור ההזמנה.`
            : `Price estimates shown in search are illustrative only and may vary based on: Specific Provider availability, Requested dates and times, Pet type and size, Selected add-on services, Special requirements. Final price is confirmed only after selecting a specific Provider and confirming booking.`
        }
      ]
    },
    escrowPolicy: {
      title: isHebrew ? "מדיניות נאמנות" : "Escrow Policy",
      icon: Wallet,
      lastUpdated: "January 2026",
      sections: [
        {
          title: isHebrew ? "מערכת הנאמנות 72 שעות" : "72-Hour Escrow System",
          content: isHebrew
            ? `⁦Pet Wash™⁩ מחזיקה את כספי ההזמנה בנאמנות עד 72 שעות לאחר סיום השירות המתוכנן. מערכת זו מגנה על שני הצדדים: לקוחות יכולים לדווח על בעיות לפני שחרור הכספים, ספקים מובטחים שהתשלום יתבצע לאחר מתן שירות תקין. הכספים מוחזקים בחשבון נאמנות מאובטח.`
            : `⁦Pet Wash™⁩ holds booking funds in escrow until 72 hours after scheduled service completion. This system protects both parties: Customers can report issues before funds release, Providers are guaranteed payment after proper service delivery. Funds are held in a secure escrow account.`
        },
        {
          title: isHebrew ? "שחרור כספים" : "Fund Release",
          content: isHebrew
            ? `הכספים משוחררים אוטומטית לספק 72 שעות לאחר סיום השירות, אלא אם: הלקוח פתח סכסוך, נמצאה בעיה עם השירות, הספק לא סיים את השירות כמתוכנן. במקרה של סכסוך, הכספים נשארים בנאמנות עד לפתרון.`
            : `Funds are automatically released to Provider 72 hours after service completion, unless: Customer opened a dispute, Issue was found with service, Provider did not complete service as scheduled. In case of dispute, funds remain in escrow until resolution.`
        }
      ]
    },
    cancellationPolicy: {
      title: isHebrew ? "מדיניות ביטול" : "Cancellation Policy",
      icon: Calendar,
      lastUpdated: "January 2026",
      sections: [
        {
          title: isHebrew ? "ביטול על ידי לקוח" : "Customer Cancellation",
          content: isHebrew
            ? `מדיניות הביטול הסטנדרטית: יותר מ-7 ימים לפני השירות - החזר מלא, 3-7 ימים לפני השירות - החזר 50%, פחות מ-3 ימים לפני השירות - ללא החזר. ספקים רשאים להציע מדיניות גמישה יותר. במקרה של ביטול מצד הספק, הלקוח מקבל החזר מלא.`
            : `Standard cancellation policy: More than 7 days before service - Full refund, 3-7 days before service - 50% refund, Less than 3 days before service - No refund. Providers may offer more flexible policies. If Provider cancels, Customer receives full refund.`
        },
        {
          title: isHebrew ? "מקרים חריגים" : "Exceptional Circumstances",
          content: isHebrew
            ? `⁦Pet Wash™⁩ עשויה לשקול החזרים חריגים במקרי: מצב חירום רפואי (עם תיעוד), אסון טבע, נסיבות כוח עליון. פניות לבחינה חריגה יש להפנות לתמיכת הפלטפורמה עם תיעוד מתאים.`
            : `⁦Pet Wash™⁩ may consider exceptional refunds in cases of: Medical emergency (with documentation), Natural disaster, Force majeure circumstances. Requests for exceptional review should be directed to platform support with appropriate documentation.`
        }
      ]
    },
    liabilityDisclaimer: {
      title: isHebrew ? "הגבלת אחריות" : "Liability Disclaimer",
      icon: AlertTriangle,
      lastUpdated: "January 2026",
      sections: [
        {
          title: isHebrew ? "הגבלת אחריות הפלטפורמה" : "Platform Liability Limitation",
          content: isHebrew
            ? `⁦Pet Wash™⁩ היא פלטפורמת שוק בלבד ואינה אחראית ל: איכות או בטיחות השירותים שניתנים על ידי ספקים, נזק לחיית מחמד או רכוש, מחלוקות בין לקוחות לספקים שאינן נפתרות דרך הפלטפורמה, אי-עמידה של ספקים בהתחייבויותיהם. האחריות המקסימלית של ⁦Pet Wash™⁩ מוגבלת לסכום העמלה ששולמה עבור ההזמנה הרלוונטית.`
            : `⁦Pet Wash™⁩ is a marketplace platform only and is not liable for: Quality or safety of services provided by Providers, Damage to pets or property, Disputes between Customers and Providers not resolved through platform, Provider failure to meet commitments. ⁦Pet Wash™⁩ maximum liability is limited to the commission paid for the relevant booking.`
        },
        {
          title: isHebrew ? "ביטוח ספקים" : "Provider Insurance",
          content: isHebrew
            ? `ספקים אחראים לדאוג לביטוח מתאים כולל: ביטוח אחריות מקצועית, ביטוח רכוש אם רלוונטי, ביטוח תאונות אישיות. ⁦Pet Wash™⁩ ממליצה ללקוחות לוודא שהספק שלהם מבוטח כראוי לפני ההזמנה.`
            : `Providers are responsible for securing appropriate insurance including: Professional liability insurance, Property insurance if relevant, Personal accident insurance. ⁦Pet Wash™⁩ recommends Customers verify their Provider is properly insured before booking.`
        }
      ]
    },
    israeliCompliance: {
      title: isHebrew ? "ציות לחוקי ישראל" : "Israeli Legal Compliance",
      icon: Globe,
      lastUpdated: "January 2026",
      sections: [
        {
          title: isHebrew ? "חוק הגנת הפרטיות" : "Privacy Protection Law",
          content: isHebrew
            ? `⁦Pet Wash™⁩ פועלת בהתאם לחוק הגנת הפרטיות התשמ"א-1981 כולל תיקון 2025. אנו אוספים מידע אישי הנדרש לפעילות הפלטפורמה בלבד, מאחסנים מידע בצורה מאובטחת, מספקים ללקוחות גישה למידע שלהם, ומאפשרים מחיקת מידע לפי בקשה (בכפוף לחובות רגולטוריות).`
            : `⁦Pet Wash™⁩ operates in compliance with Privacy Protection Law 5741-1981 including 2025 amendment. We collect personal information required for platform operation only, store information securely, provide customers access to their information, and allow information deletion on request (subject to regulatory obligations).`
        },
        {
          title: isHebrew ? "ציות למס" : "Tax Compliance",
          content: isHebrew
            ? `ספקים בישראל אחראים לניהול מס עצמאי. ⁦Pet Wash™⁩ מספקת דוחות הכנסה חודשיים וכלים לניהול חשבוניות. הפלטפורמה אינה מנכה מס במקור והספקים אחראים לדיווח ותשלום מיסים לרשויות המתאימות.`
            : `Providers in Israel are responsible for independent tax management. ⁦Pet Wash™⁩ provides monthly income reports and invoicing tools. The platform does not withhold taxes and Providers are responsible for reporting and paying taxes to appropriate authorities.`
        },
        {
          title: isHebrew ? "רווחת בעלי חיים" : "Animal Welfare",
          content: isHebrew
            ? `כל הספקים מתחייבים לעמוד בתקנות רווחת בעלי חיים הישראליות. ⁦Pet Wash™⁩ שומרת את הזכות להשעות או להסיר ספקים שמפרים כללי רווחת בעלי חיים או מקבלים תלונות רבות בנושא.`
            : `All Providers commit to complying with Israeli animal welfare regulations. ⁦Pet Wash™⁩ reserves the right to suspend or remove Providers who violate animal welfare rules or receive multiple complaints on this matter.`
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
            <div>
              <CardTitle className="text-lg text-white">{data.title}</CardTitle>
              <p className="text-xs text-white/50 mt-1">
                {isHebrew ? "עודכן לאחרונה:" : "Last updated:"} {data.lastUpdated}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-green-500/30 text-green-400">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {isHebrew ? "בתוקף" : "Active"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {data.sections.map((section: any, idx: number) => (
            <AccordionItem key={idx} value={`item-${idx}`} className="border-white/10">
              <AccordionTrigger className="text-white/90 hover:text-white text-sm py-3">
                {section.title}
              </AccordionTrigger>
              <AccordionContent className="text-white/70 text-sm leading-relaxed pb-4">
                {section.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );

  if (section) {
    const sectionMap: Record<LegalSection, keyof typeof legalContent> = {
      "platform-terms": "platformTerms",
      "provider-agreement": "providerAgreement",
      "customer-terms": "customerTerms",
      "pricing-disclosure": "pricingDisclosure",
      "escrow-policy": "escrowPolicy",
      "cancellation-policy": "cancellationPolicy",
      "privacy-policy": "israeliCompliance",
      "liability-disclaimer": "liabilityDisclaimer",
      "israeli-compliance": "israeliCompliance"
    };
    const sectionKey = sectionMap[section];
    const data = legalContent[sectionKey];
    return (
      <div className={className} dir={isRTL ? "rtl" : "ltr"}>
        {renderSection(sectionKey, data)}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          {isHebrew ? "מסמכים משפטיים ותנאי שימוש" : "Legal Documents & Terms of Service"}
        </h2>
        <p className="text-white/60 max-w-2xl mx-auto">
          {isHebrew 
            ? "כל המסמכים המשפטיים, תנאי השימוש ומדיניות הפלטפורמה שלנו"
            : "All legal documents, terms of service and platform policies"}
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(legalContent).map(([key, data]) => renderSection(key, data))}
      </div>
    </div>
  );
}

export function PricingDisclosureCard({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';
  const isRTL = isHebrew;

  return (
    <Card className={`bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">
              {isHebrew ? "גילוי מחירים" : "Price Disclosure"}
            </h3>
            <p className="text-sm text-white/70 leading-relaxed">
              {isHebrew 
                ? "המחירים המוצגים כוללים תעריף בסיס, תוספות חיות מחמד נוספות, תוספות סופ\"ש/חג (אם רלוונטי), ועמלת פלטפורמה של 15%. מע\"מ נכלל בסכום הסופי. המחיר הסופי מאושר לפני ביצוע התשלום."
                : "Displayed prices include base rate, additional pet surcharges, weekend/holiday surcharges (if applicable), and 15% platform fee. VAT is included in final amount. Final price is confirmed before payment."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EscrowNotice({ className = "" }: { className?: string }) {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';
  const isRTL = isHebrew;

  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
      <p className="text-sm text-white/80">
        {isHebrew 
          ? "התשלום מוגן במערכת נאמנות 72 שעות. הכספים משוחררים לספק רק לאחר השלמה מוצלחת של השירות."
          : "Payment protected by 72-hour escrow. Funds released to provider only after successful service completion."}
      </p>
    </div>
  );
}

export function ProviderLegalAcknowledgement({ 
  onAccept, 
  accepted = false,
  className = "" 
}: { 
  onAccept: (accepted: boolean) => void; 
  accepted?: boolean;
  className?: string;
}) {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';
  const isRTL = isHebrew;

  const acknowledgements = [
    {
      key: "contractor",
      text: isHebrew 
        ? "אני מאשר כי אני קבלן עצמאי ולא עובד של ⁦Pet Wash™⁩"
        : "I acknowledge that I am an independent contractor and not an employee of ⁦Pet Wash™⁩"
    },
    {
      key: "taxes",
      text: isHebrew 
        ? "אני מבין כי אני אחראי לדיווח והעברת מיסים בהתאם לחוק"
        : "I understand that I am responsible for tax reporting and remittance as required by law"
    },
    {
      key: "commission",
      text: isHebrew 
        ? "אני מסכים לעמלת פלטפורמה של 15% מסך ההזמנות"
        : "I agree to a 15% platform commission on total bookings"
    },
    {
      key: "escrow",
      text: isHebrew 
        ? "אני מבין כי התשלומים מוחזקים בנאמנות 72 שעות לאחר סיום השירות"
        : "I understand that payments are held in 72-hour escrow after service completion"
    },
    {
      key: "terms",
      text: isHebrew 
        ? "קראתי ואני מסכים לתנאי השימוש, מדיניות הפרטיות והסכם הספק"
        : "I have read and agree to the Terms of Service, Privacy Policy and Provider Agreement"
    }
  ];

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const allChecked = acknowledgements.every(a => checkedItems[a.key]);

  const handleCheck = (key: string, checked: boolean) => {
    const newChecked = { ...checkedItems, [key]: checked };
    setCheckedItems(newChecked);
    onAccept(Object.values(newChecked).every(Boolean));
  };

  return (
    <Card className={`bg-white/5 border-white/10 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Scale className="w-5 h-5" />
          {isHebrew ? "אישור משפטי" : "Legal Acknowledgement"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {acknowledgements.map((ack) => (
          <label key={ack.key} className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={checkedItems[ack.key] || false}
              onChange={(e) => handleCheck(ack.key, e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-white/30 bg-white/10 text-green-500 focus:ring-green-500/50"
            />
            <span className="text-sm text-white/80 group-hover:text-white transition-colors">
              {ack.text}
            </span>
          </label>
        ))}
        
        {allChecked && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 mt-4">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-sm text-green-400">
              {isHebrew ? "כל האישורים הושלמו" : "All acknowledgements completed"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MarketplaceLegalContent;
