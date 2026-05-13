import { useTranslation } from "react-i18next";
import { 
  Shield, 
  BadgeCheck, 
  MapPin, 
  HeadphonesIcon,
  Camera,
  Lock,
  FileCheck,
  Heart
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TrustSafetySectionProps {
  variant?: "full" | "compact" | "minimal";
  className?: string;
}

// PR-LEGAL-B: the first trust feature previously claimed
// "Every booking protected by PetWash Protect™ insurance"
// and a "₪25,000 Guarantee" — both contradict §8 of the
// Provider & Host Services Agreement merged in PR-LEGAL-A
// (#246). Replaced with the CEO-approved canonical safety
// disclaimer (chat 2026-05-12). No insurance promises, no
// sums, no underwriter naming.
const trustFeatures = [
  {
    icon: Shield,
    title: "Safety information",
    titleHe: "מידע בטיחות",
    description:
      "Providers may be required to maintain their own insurance depending on the service type and applicable law. Pet Wash is not an insurance company, broker or adviser.",
    descriptionHe:
      "ספקים עשויים להידרש להחזיק בביטוח מתאים בהתאם לסוג השירות והדין החל. פט וואש בע״מ אינה חברת ביטוח, סוכנות ביטוח או יועצת ביטוח.",
    color: "slate",
  },
  {
    icon: BadgeCheck,
    title: "Verified Caregivers",
    titleHe: "מטפלים מאומתים",
    description: "Background checks, ID verification, and reviews",
    descriptionHe: "בדיקות רקע, אימות תעודה ודירוגים",
    color: "blue",
  },
  {
    icon: MapPin,
    title: "GPS Tracking",
    titleHe: "מעקב GPS",
    description: "Real-time location during walks and transport",
    descriptionHe: "מיקום בזמן אמת במהלך טיולים והסעות",
    color: "violet",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Support",
    titleHe: "תמיכה 24/7",
    description: "Expert help available anytime you need it",
    descriptionHe: "עזרה מקצועית זמינה בכל עת",
    color: "orange",
  },
];

const additionalFeatures = [
  {
    icon: Camera,
    title: "Photo Updates",
    titleHe: "עדכוני תמונות",
    description: "Receive photos of your pet during their stay",
    descriptionHe: "קבל תמונות של חיית המחמד שלך במהלך השהות",
  },
  {
    icon: Lock,
    title: "Secure Payments",
    titleHe: "תשלומים מאובטחים",
    description: "72-hour escrow protects both parties",
    descriptionHe: "נאמנות 72 שעות מגינה על שני הצדדים",
  },
  {
    icon: FileCheck,
    title: "Booking Records",
    titleHe: "רישום הזמנות",
    description: "Complete history of all services",
    descriptionHe: "היסטוריה מלאה של כל השירותים",
  },
  {
    icon: Heart,
    title: "Pet-First Care",
    titleHe: "טיפול ממוקד בחיה",
    description: "Every caregiver is a passionate pet lover",
    descriptionHe: "כל מטפל הוא חובב חיות נלהב",
  },
];

export function TrustSafetySection({ variant = "full", className }: TrustSafetySectionProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "he";

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center justify-center gap-6 py-4", className)}>
        {trustFeatures.slice(0, 4).map((feature, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
            <feature.icon className="h-4 w-4 text-emerald-600" />
            <span>{isRTL ? feature.titleHe : feature.title}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("bg-gradient-to-r from-emerald-50 to-white p-6 rounded-2xl", className)}>
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {trustFeatures.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center">
                <feature.icon className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {isRTL ? feature.titleHe : feature.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("py-20 bg-white", className)}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          {/* PR-LEGAL-B: previously a "PetWash Protect™" chip. Removed —
              the "Protect" branding implies an insurance/protection program
              that Pet Wash does not provide (§8). Replaced with a neutral
              "Trust & Safety" label. */}
          <div className="inline-flex items-center gap-2 bg-gray-50 text-gray-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Shield className="h-4 w-4" />
            {isRTL ? "בטיחות ואמון" : "Trust & Safety"}
          </div>
          <h2 
            className="text-3xl md:text-4xl lg:text-5xl font-light tracking-wide text-gray-900 mb-4"
            style={{ fontFamily: "'Didot', 'Bodoni MT', 'Playfair Display', serif" }}
          >
            {isRTL ? "בטיחות ואמון ללא פשרות" : "Uncompromising Safety & Trust"}
          </h2>
          {/* PR-LEGAL-B: previously claimed every booking is backed by a
              ₪25,000 PetWash Protect™ guarantee. Replaced with a neutral
              description per §8 of the Provider & Host Services Agreement. */}
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">
            {isRTL
              ? "ספקים מאומתים, אופציות תשלום מאובטחות, ותמיכה במחלוקות. ראו מידע על בטיחות."
              : "Verified providers, secure payment options and support for disputes. See safety information."
            }
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {trustFeatures.map((feature, idx) => (
            <Card 
              key={idx}
              className="p-8 text-center border-0 bg-white hover:shadow-xl transition-all duration-500 rounded-2xl group"
              data-testid={`trust-feature-${idx}`}
            >
              <div className={cn(
                "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
                feature.color === "emerald" && "bg-emerald-100",
                feature.color === "blue" && "bg-blue-100",
                feature.color === "violet" && "bg-violet-100",
                feature.color === "orange" && "bg-orange-100",
              )}>
                <feature.icon className={cn(
                  "h-8 w-8",
                  feature.color === "emerald" && "text-emerald-600",
                  feature.color === "blue" && "text-blue-600",
                  feature.color === "violet" && "text-violet-600",
                  feature.color === "orange" && "text-orange-600",
                )} />
              </div>
              <h3 
                className="text-xl font-medium text-gray-900 mb-3"
                style={{ fontFamily: "'Didot', 'Bodoni MT', 'Playfair Display', serif" }}
              >
                {isRTL ? feature.titleHe : feature.title}
              </h3>
              <p className="text-gray-500 text-sm">
                {isRTL ? feature.descriptionHe : feature.description}
              </p>
            </Card>
          ))}
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl p-8 md:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {additionalFeatures.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-4" data-testid={`additional-feature-${idx}`}>
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                  <feature.icon className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">
                    {isRTL ? feature.titleHe : feature.title}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {isRTL ? feature.descriptionHe : feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PR-LEGAL-B: previously rendered a "PetWash Protect™ ₪25,000 Guarantee"
            badge. Replaced with a neutral Trust & Safety badge per §8 of the
            Provider & Host Services Agreement. */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-4 bg-gray-700 text-white px-8 py-4 rounded-2xl">
            <Shield className="h-8 w-8" />
            <div className="text-left">
              <p className="text-sm opacity-90">{isRTL ? "מידע בטיחות" : "Safety information"}</p>
              <p
                className="text-2xl font-light"
                style={{ fontFamily: "'Didot', 'Bodoni MT', 'Playfair Display', serif" }}
              >
                {isRTL ? "ספקים מאומתים" : "Verified providers"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrustSafetySection;
