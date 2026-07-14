import { Link } from "wouter";
import { useLanguage } from "@/lib/languageStore";
import { LegalPage } from "./LegalPage";
import { useSEO, pageSEO } from '@/lib/seo';

type DocLink = { href: string; he: string; en: string };
type Group = { titleHe: string; titleEn: string; items: DocLink[] };

const GROUPS: Group[] = [
  {
    titleHe: "לקוחות",
    titleEn: "Customer",
    items: [
      { href: "/legal/customer-terms", he: "תנאי שימוש ללקוח", en: "Customer Terms" },
      { href: "/legal/pet-owner-responsibility", he: "אחריות בעל חיית המחמד", en: "Pet Owner Responsibility" },
      { href: "/legal/pet-profile-health-data-notice", he: "הודעה על פרופיל ומידע בריאותי", en: "Pet Profile & Health Data Notice" },
      { href: "/legal/booking-rules", he: "כללי הזמנה", en: "Booking Rules" },
      { href: "/legal/cancellation-refund-policy", he: "מדיניות ביטול והחזר", en: "Cancellation & Refund Policy" },
      { href: "/legal/wallet-egift-terms", he: "תנאי ארנק ו-eGift", en: "Wallet & eGift Terms" },
      { href: "/legal/station-use-terms", he: "תנאי שימוש בעמדה", en: "Station Use Terms" },
      { href: "/legal/home-access-property-authority", he: "הרשאת גישה לבית ולרכוש", en: "Home Access & Property Authority" },
      { href: "/legal/emergency-vet-authorisation", he: "הרשאה לטיפול וטרינרי בחירום", en: "Emergency Vet Authorisation" },
      { href: "/legal/reviews-content-policy", he: "מדיניות ביקורות ותוכן", en: "Reviews & Content Policy" },
      { href: "/legal/community-guidelines", he: "הנחיות הקהילה", en: "Community Guidelines" },
      { href: "/legal/support-incident-reporting", he: "תמיכה ודיווח אירועים", en: "Support & Incident Reporting" },
    ],
  },
  {
    titleHe: "נותני שירות",
    titleEn: "Provider",
    items: [
      { href: "/legal/provider-agreement", he: "הסכם נותן שירות", en: "Provider Agreement" },
      { href: "/legal/provider-independent-status", he: "מעמד קבלן עצמאי", en: "Independent Contractor Status" },
      { href: "/legal/provider-truth-declaration", he: "הצהרת אמת", en: "Truth Declaration" },
      { href: "/legal/provider-tax-business-declaration", he: "הצהרת מס ומעמד עסקי", en: "Tax & Business Status Declaration" },
      { href: "/legal/provider-payout-rules", he: "כללי תשלום", en: "Payout Rules" },
      { href: "/legal/no-circumvention", he: "איסור עקיפת הפלטפורמה", en: "No Circumvention" },
      { href: "/legal/provider-confidentiality", he: "סודיות", en: "Confidentiality" },
      { href: "/legal/provider-incident-reporting", he: "דיווח אירועים", en: "Incident Reporting" },
      { href: "/legal/provider-cancellation", he: "ביטולים", en: "Cancellation" },
      { href: "/legal/provider-document-upload", he: "העלאת מסמכים", en: "Document Upload" },
      { href: "/legal/provider-reconfirmation", he: "אישור מחדש כל 6 חודשים", en: "Re-confirmation (Every 6 Months)" },
      { href: "/legal/provider-insurance-licence", he: "ביטוח ורישיון", en: "Insurance & Licence" },
      { href: "/legal/provider-brand-use", he: "שימוש במותג", en: "Brand-Use Rules" },
    ],
  },
  {
    titleHe: "מדריכים",
    titleEn: "Manuals",
    items: [
      { href: "/manuals/dog-walking", he: "טיולי כלבים", en: "Dog Walking" },
      { href: "/manuals/pet-sitting", he: "פנסיון / שמרטפות", en: "Pet Sitting" },
      { href: "/manuals/home-visit", he: "ביקור בית", en: "Home Visit" },
      { href: "/manuals/overnight-sitting", he: "לינה / שמירת לילה", en: "Overnight Sitting" },
      { href: "/manuals/grooming", he: "טיפוח (גרומינג)", en: "Grooming" },
      { href: "/manuals/training", he: "אילוף", en: "Training" },
      { href: "/manuals/incident-reporting", he: "דיווח אירועים", en: "Incident Reporting" },
      { href: "/manuals/provider-support", he: "תמיכה לנותן שירות", en: "Provider Support" },
    ],
  },
  {
    titleHe: "הגנה",
    titleEn: "Protection",
    items: [
      { href: "/legal/protection-no-insurance-notice", he: "הודעה: אין ביטוח אוטומטי", en: "No-Insurance Notice" },
      { href: "/legal/support-protection-policy", he: "מדיניות הגנה ותמיכה", en: "Support & Protection Policy" },
      { href: "/legal/claim-procedure", he: "נוהל תביעה (מותנה)", en: "Claim Procedure (Conditional)" },
    ],
  },
];

export default function LegalIndex() {
  useSEO(pageSEO.legalIndex);
  const { language } = useLanguage();
  const isHebrew = language === "he";
  return (
    <LegalPage
      titleHe="מרכז משפטי ומדריכים"
      titleEn="Legal & Manuals Centre"
      subtitleHe="כל המסמכים המשפטיים והמדריכים של PetWash, מקובצים לפי נושא."
      subtitleEn="All PetWash legal documents and manuals, grouped by topic."
    >
      {GROUPS.map((group) => (
        <section key={group.titleEn}>
          <h2 className="text-xl md:text-2xl font-semibold text-black mb-3">
            {isHebrew ? group.titleHe : group.titleEn}
          </h2>
          <ul className="space-y-2">
            {group.items.map((item) => (
              <li key={item.href} className="flex gap-3 leading-relaxed">
                <span className="text-amber-600 font-bold mt-1 flex-shrink-0">•</span>
                <Link
                  href={item.href}
                  className="text-black underline decoration-amber-400 underline-offset-4 hover:text-amber-700 cursor-pointer"
                >
                  {isHebrew ? item.he : item.en}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </LegalPage>
  );
}
