import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileText,
  Clock,
  CreditCard,
  Phone,
  Mail,
  Building,
  Wallet,
  Heart,
  Home,
  Car,
  Stethoscope,
  Scale,
  UserCheck,
  BadgeCheck,
  Info
} from "lucide-react";

interface InsuranceAndProtectionProps {
  variant?: "provider" | "customer" | "full";
  className?: string;
  /**
   * flowType controls whether provider-specific sections (taxes, escrow, provider obligations)
   * are shown. Only pass "marketplace_booking" when a provider is actually involved.
   *
   * "marketplace_booking" → show provider tax explanation (Flow A)
   * "direct_platform_sale" | "egift_sale" | "wallet_topup" → hide all provider sections (Flow B)
   *
   * Defaults to "marketplace_booking" for backwards compatibility.
   */
  flowType?: "marketplace_booking" | "direct_platform_sale" | "egift_sale" | "wallet_topup";
}

export function InsuranceAndProtection({ variant = "full", className = "", flowType = "marketplace_booking" }: InsuranceAndProtectionProps) {
  const isMarketplaceFlow = flowType === "marketplace_booking";
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';
  const isRTL = isHebrew;

  const insuranceContent = {
    overview: {
      title: isHebrew ? "כיסוי ביטוחי ⁦Pet Wash™⁩" : "⁦Pet Wash™⁩ Accident Cover",
      subtitle: isHebrew 
        ? "ביטוח אחריות צד שלישי לכל ההזמנות דרך הפלטפורמה"
        : "Third-Party Liability Insurance for All Bookings Through the Platform",
      underwriter: isHebrew ? "מבטח: הראל חברה לביטוח בע\"מ" : "Underwriter: Harel Insurance Company Ltd.",
      policyNumber: "PW-2026-IL-001",
      effectiveDate: isHebrew ? "בתוקף מ: ינואר 2026" : "Effective: January 2026"
    },
    coverageLimits: [
      {
        type: isHebrew ? "אחריות כללית" : "General Liability",
        amount: "₪20,000,000",
        amountEn: "₪20 million",
        description: isHebrew 
          ? "לכל מקרה - נזקי גוף או רכוש לצד שלישי"
          : "Per occurrence - bodily injury or property damage to third parties"
      },
      {
        type: isHebrew ? "רכוש בטיפול" : "Property in Care, Custody & Control",
        amount: "₪250,000",
        amountEn: "₪250,000",
        description: isHebrew 
          ? "לכל מקרה - נזק לחיית המחמד או לרכוש הבעלים"
          : "Per occurrence - damage to pet or owner's property"
      },
      {
        type: isHebrew ? "הוצאות וטרינריות חירום" : "Emergency Veterinary Expenses",
        amount: "₪50,000",
        amountEn: "₪50,000",
        description: isHebrew 
          ? "לכל מקרה - טיפול וטרינרי דחוף במהלך ההזמנה"
          : "Per occurrence - urgent veterinary care during booking"
      }
    ],
    excess: {
      amount: "₪1,000",
      description: isHebrew 
        ? "השתתפות עצמית - משולמת על ידי הספק בכל תביעה"
        : "Excess/Deductible - payable by Provider for all claims"
    },
    whatsCovered: [
      {
        icon: Heart,
        title: isHebrew ? "פציעה או מוות של חיית מחמד" : "Pet Injury or Death",
        description: isHebrew 
          ? "אחריות משפטית לפציעה או מוות של חיית מחמד כתוצאה מרשלנות הספק"
          : "Legal liability for injury or death of pet due to Provider negligence"
      },
      {
        icon: UserCheck,
        title: isHebrew ? "פציעה לצד שלישי" : "Third-Party Injury",
        description: isHebrew 
          ? "פציעה לבני אדם (ציבור הרחב) על ידי חיית מחמד בטיפול הספק"
          : "Injury to members of the public caused by pet under Provider's care"
      },
      {
        icon: Home,
        title: isHebrew ? "נזק לרכוש צד שלישי" : "Third-Party Property Damage",
        description: isHebrew 
          ? "נזק לרכוש של צד שלישי על ידי חיית מחמד במהלך ההזמנה"
          : "Damage to third-party property caused by pet during booking"
      },
      {
        icon: Stethoscope,
        title: isHebrew ? "הוצאות וטרינריות" : "Veterinary Expenses",
        description: isHebrew 
          ? "טיפול רפואי חירום הנובע מאירוע במהלך השירות"
          : "Emergency medical treatment arising from incident during service"
      },
      {
        icon: Scale,
        title: isHebrew ? "הוצאות משפטיות" : "Legal Defense Costs",
        description: isHebrew 
          ? "עלויות הגנה משפטית בתביעות צד שלישי"
          : "Legal defense costs for third-party claims"
      }
    ],
    whatsNotCovered: [
      {
        category: isHebrew ? "רכוש אישי" : "Personal Property",
        items: [
          isHebrew ? "נזק לרכוש הספק עצמו" : "Damage to Provider's own property",
          isHebrew ? "נזק לרכוש הבעלים (אותו משק בית)" : "Damage to Owner's property (same household)",
          isHebrew ? "פציעה אישית של הספק (לא מחליף ביטוח עובדים)" : "Provider personal injury (not workers comp replacement)"
        ]
      },
      {
        category: isHebrew ? "מצבים רפואיים קיימים" : "Pre-existing Conditions",
        items: [
          isHebrew ? "מצבים וטרינריים קיימים, מחלות, זקנה" : "Pre-existing veterinary conditions, illness, old age",
          isHebrew ? "פרעושים/קרציות (אחריות הבעלים/ספק לחיסונים)" : "Flea/tick situations (owner/sitter responsible for prevention)",
          isHebrew ? "תסמיני לחץ/חרדה (נחשבים למצב קיים)" : "Stress/anxiety-related symptoms (considered pre-existing)",
          isHebrew ? "פציעות עצמיות (גירוד, נשיכה עצמית)" : "Self-inflicted wounds (scratching, biting, gnawing)"
        ]
      },
      {
        category: isHebrew ? "שירות והתנהגות" : "Service & Behavioral",
        items: [
          isHebrew ? "פגישות \"היכרות\" (לפני תחילת ההזמנה)" : "Meet & Greet appointments (before booking starts)",
          isHebrew ? "שירותים שהוזמנו מחוץ לפלטפורמת ⁦Pet Wash™⁩" : "Services booked outside ⁦Pet Wash™⁩ platform",
          isHebrew ? "פנסיונים מסחריים" : "Commercial boarding kennels",
          isHebrew ? "הפחתה ב\"ערך תצוגה\" של החיה" : "Reduction in pet's 'show value'",
          isHebrew ? "הפרת חובה מקצועית (למשל, הליכה ללא רצועה באזור לא בטוח)" : "Breach of professional duty (e.g., off-leash in unsafe areas)",
          isHebrew ? "קנסות עירייה/כלבייה אם החיה נמלטה" : "Municipal fines/pound charges if pet escapes"
        ]
      },
      {
        category: isHebrew ? "חיות לא מכוסות" : "Non-Covered Animals",
        items: [
          isHebrew ? "חיות אקזוטיות (רק כלבים, חתולים, ארנבות, ציפורים קטנות, שפני ניסיון)" : "Exotic animals (only dogs, cats, rabbits, small birds, guinea pigs covered)"
        ]
      },
      {
        category: isHebrew ? "דרישות ספק" : "Provider Requirements",
        items: [
          isHebrew ? "ספקים עם הרשעות פליליות ב-5 שנים האחרונות (למעט תעבורה)" : "Providers with criminal convictions in past 5 years (excluding traffic)"
        ]
      }
    ],
    claimsProcess: [
      {
        step: 1,
        title: isHebrew ? "דיווח מיידי" : "Immediate Report",
        description: isHebrew 
          ? "דווח על האירוע דרך האפליקציה או התקשר לקו החירום תוך 24 שעות"
          : "Report incident via app or call emergency line within 24 hours",
        timeframe: isHebrew ? "תוך 24 שעות" : "Within 24 hours"
      },
      {
        step: 2,
        title: isHebrew ? "הודעה בכתב" : "Written Notice",
        description: isHebrew 
          ? "הגש הודעה בכתב עם כל התיעוד תוך 7 ימים מסיום ההזמנה"
          : "Submit written notice with all documentation within 7 days of booking end",
        timeframe: isHebrew ? "תוך 7 ימים" : "Within 7 days"
      },
      {
        step: 3,
        title: isHebrew ? "תיעוד נדרש" : "Required Documentation",
        description: isHebrew 
          ? "חשבוניות וטרינר, פתקים, קבלות, פרטי צד שלישי, פרטי ביטוח הבעלים"
          : "Vet invoices, notes, receipts, third-party details, owner's insurance info",
        timeframe: ""
      },
      {
        step: 4,
        title: isHebrew ? "אישור וטרינרי" : "Veterinary Confirmation",
        description: isHebrew 
          ? "אבחנה חייבת להיות מקושרת באופן ודאי לשירות הספק על ידי וטרינר מוסמך"
          : "Diagnosis must be definitively linked to Provider's service by qualified vet",
        timeframe: ""
      },
      {
        step: 5,
        title: isHebrew ? "החלטת המבטח" : "Insurer Decision",
        description: isHebrew 
          ? "הראל ביטוח מטפלת בתביעות ומחליטה. ⁦Pet Wash™⁩ אינה המבטח"
          : "Harel Insurance handles and decides claims. ⁦Pet Wash™⁩ is not the insurer",
        timeframe: isHebrew ? "עד 30 יום" : "Up to 30 days"
      }
    ],
    eligibilityRequirements: [
      isHebrew ? "השירות חייב להיות מוזמן ומשולם במלואו דרך פלטפורמת ⁦Pet Wash™⁩ לפני תאריך תחילת השירות" : "Service MUST be booked AND paid in full via ⁦Pet Wash™⁩ platform before service start date",
      isHebrew ? "האירוע חייב להתרחש במהלך תקופת הזמנה פעילה" : "Incident must occur DURING an active booking period",
      isHebrew ? "הספק חייב להיות אחראי ישירות (פעולה או מחדל)" : "Provider must be deemed directly responsible (action or inaction)",
      isHebrew ? "נדרשות ראיות להוכחת אחריות הספק" : "Evidence required to prove Provider responsibility"
    ],
    importantDisclaimers: [
      {
        icon: AlertTriangle,
        text: isHebrew 
          ? "הכיסוי הוא משני לכל ביטוח חיות מחמד קיים של הבעלים או הספק"
          : "Coverage is SECONDARY to any existing pet insurance held by owner or provider"
      },
      {
        icon: Building,
        text: isHebrew 
          ? "⁦Pet Wash™⁩ אינה המבטח - הראל ביטוח מטפלת ומסדירה תביעות"
          : "⁦Pet Wash™⁩ is NOT the insurer - Harel Insurance handles and settles claims"
      },
      {
        icon: Info,
        text: isHebrew 
          ? "אין ערובה שתביעות יאושרו - ההחלטה נתונה למבטח"
          : "No guarantee claims will be successful - decision made by insurer"
      },
      {
        icon: Shield,
        text: isHebrew 
          ? "ספקים אחראים לשמור על ביטוח נוסף מתאים לשירותיהם"
          : "Providers remain responsible for maintaining adequate additional insurance"
      },
      {
        icon: FileText,
        text: isHebrew 
          ? "החוזה הוא בין הספק לבעלים - ⁦Pet Wash™⁩ היא רק ספקית הפלטפורמה"
          : "Contract is between Provider and Owner - ⁦Pet Wash™⁩ is only the platform provider"
      }
    ],
    emergencyContacts: {
      title: isHebrew ? "קווים חמים לחירום" : "Emergency Hotlines",
      contacts: [
        {
          type: isHebrew ? "קו חירום ⁦Pet Wash™⁩" : "⁦Pet Wash™⁩ Emergency Line",
          number: "*2738",
          available: isHebrew ? "24/7" : "24/7"
        },
        {
          type: isHebrew ? "מוקד תביעות ביטוח" : "Insurance Claims Center",
          email: "claims@petwash.co.il",
          available: isHebrew ? "א'-ה' 9:00-18:00" : "Sun-Thu 9:00-18:00"
        },
        {
          type: isHebrew ? "וטרינר חירום ארצי" : "National Vet Emergency",
          number: "1-700-50-40-30",
          available: isHebrew ? "24/7" : "24/7"
        }
      ]
    }
  };

  const providerTaxContent = {
    title: isHebrew ? "חובות מס לספקים עצמאיים" : "Tax Obligations for Independent Providers",
    sections: [
      {
        title: isHebrew ? "רישום עסק" : "Business Registration",
        items: [
          {
            label: isHebrew ? "עוסק פטור" : "Osek Patur (Exempt Dealer)",
            description: isHebrew 
              ? "הכנסה שנתית עד ₪120,000 - פטור ממע\"מ"
              : "Annual income up to ₪120,000 - VAT exempt"
          },
          {
            label: isHebrew ? "עוסק מורשה" : "Osek Murshe (Authorized Dealer)",
            description: isHebrew 
              ? "הכנסה שנתית מעל ₪120,000 - חייב במע\"מ 18%"
              : "Annual income over ₪120,000 - Must charge 18% VAT"
          }
        ]
      },
      {
        title: isHebrew ? "רישום חובה" : "Required Registrations",
        items: [
          {
            label: isHebrew ? "רשות המסים" : "Israel Tax Authority",
            description: isHebrew 
              ? "קבלת תיק מס הכנסה, תשלומי מקדמות חודשיים"
              : "Obtain tax ID, make monthly prepayments"
          },
          {
            label: isHebrew ? "מע\"מ" : "VAT Authority",
            description: isHebrew 
              ? "רישום כעוסק פטור או מורשה, דיווח תקופתי"
              : "Register as exempt or authorized, periodic reporting"
          },
          {
            label: isHebrew ? "ביטוח לאומי" : "National Insurance",
            description: isHebrew 
              ? "רישום כעצמאי, תשלומים חודשיים (כ-9%-17% מההכנסה — ביטוח לאומי + ביטוח בריאות)"
              : "Register as self-employed, monthly payments (~9%-17% of income — national insurance + health insurance)"
          }
        ]
      },
      {
        title: isHebrew ? "שיעורי מס הכנסה 2026 (לפי מדרגות)" : "Income Tax Rates 2026 (Progressive Brackets)",
        items: [
          { label: "₪0 - ₪84,120", description: "10%" },
          { label: "₪84,121 - ₪120,720", description: "14%" },
          { label: "₪120,721 - ₪193,800", description: "20%" },
          { label: "₪193,801 - ₪269,280", description: "31%" },
          { label: "₪269,281 - ₪560,280", description: "35%" },
          { label: "₪560,281+", description: "47%-50%" }
        ]
      }
    ],
    disclaimer: isHebrew 
      ? "⁦Pet Wash™⁩ אינה מספקת ייעוץ מס או משפטי. מומלץ להתייעץ עם רואה חשבון."
      : "⁦Pet Wash™⁩ does not provide tax or legal advice. Consult with an accountant."
  };

  const customerProtectionContent = {
    title: isHebrew ? "הגנות לבעלי חיות מחמד" : "Pet Owner Protections",
    protections: [
      {
        icon: Wallet,
        title: isHebrew ? "נאמנות 72 שעות" : "72-Hour Escrow",
        description: isHebrew 
          ? "התשלום מוחזק בנאמנות עד 72 שעות לאחר סיום השירות. אם יש בעיה - הכסף לא משתחרר לספק עד לפתרון."
          : "Payment held in escrow until 72 hours after service completion. If issues arise - funds not released to Provider until resolved."
      },
      {
        icon: Shield,
        title: isHebrew ? "אימות ספקים" : "Provider Verification",
        description: isHebrew 
          ? "כל הספקים עוברים בדיקת רקע, אימות זהות, והכשרה בסיסית לפני קבלה לפלטפורמה."
          : "All Providers undergo background checks, identity verification, and basic training before platform acceptance."
      },
      {
        icon: CreditCard,
        title: isHebrew ? "החזר כספי מובטח" : "Guaranteed Refund",
        description: isHebrew 
          ? "ביטול יותר מ-7 ימים לפני השירות - החזר 100%. 3-7 ימים - 50%. פחות מ-3 ימים - לפי שיקול דעת."
          : "Cancel 7+ days before service - 100% refund. 3-7 days - 50%. Less than 3 days - at discretion."
      },
      {
        icon: Phone,
        title: isHebrew ? "תמיכה 24/7" : "24/7 Support",
        description: isHebrew 
          ? "קו חירום זמין מסביב לשעון לכל בעיה במהלך השירות."
          : "Emergency line available around the clock for any issues during service."
      },
      {
        icon: Heart,
        title: isHebrew ? "ביטוח תאונות" : "Accident Insurance",
        description: isHebrew 
          ? "כיסוי ביטוחי עד ₪20 מיליון לאירועים במהלך הזמנות דרך הפלטפורמה."
          : "Insurance coverage up to ₪20 million for incidents during platform bookings."
      },
      {
        icon: CheckCircle2,
        title: isHebrew ? "ביקורות מאומתות" : "Verified Reviews",
        description: isHebrew 
          ? "רק לקוחות שהשלימו הזמנה יכולים להשאיר ביקורת - ללא ביקורות מזויפות."
          : "Only customers who completed bookings can leave reviews - no fake reviews."
      }
    ]
  };

  const renderCoverageLimits = () => (
    <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          {isHebrew ? "גבולות כיסוי" : "Coverage Limits"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insuranceContent.coverageLimits.map((limit, idx) => (
          <div key={idx} className="flex items-start justify-between p-4 rounded-lg bg-white/5">
            <div>
              <h4 className="font-semibold text-white">{limit.type}</h4>
              <p className="text-sm text-white/60">{limit.description}</p>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 text-lg font-bold">
              {limit.amount}
            </Badge>
          </div>
        ))}
        <Separator className="bg-white/10" />
        <div className="flex items-start justify-between p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div>
            <h4 className="font-semibold text-amber-400">{isHebrew ? "השתתפות עצמית" : "Excess/Deductible"}</h4>
            <p className="text-sm text-white/60">{insuranceContent.excess.description}</p>
          </div>
          <Badge className="bg-amber-500/20 text-amber-400 text-lg font-bold">
            {insuranceContent.excess.amount}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  const renderWhatsCovered = () => (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          {isHebrew ? "מה מכוסה" : "What's Covered"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {insuranceContent.whatsCovered.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
            <item.icon className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-white">{item.title}</h4>
              <p className="text-sm text-white/60">{item.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderWhatsNotCovered = () => (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-400" />
          {isHebrew ? "מה לא מכוסה" : "What's NOT Covered"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insuranceContent.whatsNotCovered.map((category, idx) => (
          <div key={idx} className="space-y-2">
            <h4 className="font-medium text-red-400">{category.category}</h4>
            <ul className="space-y-1">
              {category.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-sm text-white/70">
                  <XCircle className="w-4 h-4 text-red-400/50 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderClaimsProcess = () => (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          {isHebrew ? "תהליך הגשת תביעה" : "Claims Process"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insuranceContent.claimsProcess.map((step, idx) => (
            <div key={idx} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                {step.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-white">{step.title}</h4>
                  {step.timeframe && (
                    <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                      <Clock className="w-3 h-3 mr-1" />
                      {step.timeframe}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-white/60">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderDisclaimers = () => (
    <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          {isHebrew ? "הודעות חשובות" : "Important Disclaimers"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insuranceContent.importantDisclaimers.map((disclaimer, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
            <disclaimer.icon className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-white/80">{disclaimer.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderCustomerProtections = () => (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          {customerProtectionContent.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {customerProtectionContent.protections.map((protection, idx) => (
          <div key={idx} className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/10">
            <div className="flex items-center gap-2 mb-2">
              <protection.icon className="w-5 h-5 text-purple-400" />
              <h4 className="font-medium text-white">{protection.title}</h4>
            </div>
            <p className="text-sm text-white/60">{protection.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  const renderProviderTax = () => (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Building className="w-5 h-5 text-cyan-400" />
          {providerTaxContent.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {providerTaxContent.sections.map((section, idx) => (
          <div key={idx}>
            <h4 className="font-medium text-cyan-400 mb-3">{section.title}</h4>
            <div className="space-y-2">
              {section.items.map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-start justify-between p-3 rounded-lg bg-white/5">
                  <span className="font-medium text-white">{item.label}</span>
                  <span className="text-white/60">{item.description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-400">{providerTaxContent.disclaimer}</p>
        </div>
      </CardContent>
    </Card>
  );

  const renderEmergencyContacts = () => (
    <Card className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border-red-500/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Phone className="w-5 h-5 text-red-400" />
          {insuranceContent.emergencyContacts.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insuranceContent.emergencyContacts.contacts.map((contact, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div>
              <h4 className="font-medium text-white">{contact.type}</h4>
              <p className="text-sm text-white/60">{contact.available}</p>
            </div>
            {contact.number ? (
              <Badge className="bg-red-500/20 text-red-400 text-lg font-bold">
                <Phone className="w-4 h-4 mr-1" />
                {contact.number}
              </Badge>
            ) : (
              <Badge className="bg-blue-500/20 text-blue-400">
                <Mail className="w-4 h-4 mr-1" />
                {contact.email}
              </Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className="text-center mb-8">
        <Badge className="bg-emerald-500/20 text-emerald-400 mb-4">
          <BadgeCheck className="w-4 h-4 mr-1" />
          {insuranceContent.overview.underwriter}
        </Badge>
        <h2 className="text-3xl font-bold text-white mb-2">{insuranceContent.overview.title}</h2>
        <p className="text-lg text-white/60">{insuranceContent.overview.subtitle}</p>
        <p className="text-sm text-white/40 mt-2">{insuranceContent.overview.effectiveDate}</p>
      </div>

      {(variant === "full" || variant === "provider") && (
        <>
          {renderCoverageLimits()}
          <div className="grid gap-6 md:grid-cols-2">
            {renderWhatsCovered()}
            {renderWhatsNotCovered()}
          </div>
          {renderClaimsProcess()}
          {renderDisclaimers()}
          {variant === "provider" && isMarketplaceFlow && renderProviderTax()}
        </>
      )}

      {(variant === "full" || variant === "customer") && (
        <>
          {renderCustomerProtections()}
        </>
      )}

      {renderEmergencyContacts()}
    </div>
  );
}

export default InsuranceAndProtection;
