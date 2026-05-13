import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { 
  Home, 
  Sofa, 
  Users, 
  Footprints, 
  Car, 
  GraduationCap,
  Droplets,
  ArrowRight,
  Star,
  Shield,
  Clock
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ServiceShowcaseProps {
  variant?: "grid" | "carousel" | "list";
  showPricing?: boolean;
  className?: string;
}

const serviceData = [
  {
    id: "pet-boarding",
    icon: Home,
    name: "Pet Boarding",
    nameHe: "פנסיון לחיות מחמד",
    description: "Overnight care in a loving sitter's home",
    descriptionHe: "טיפול לילי בבית מארח אוהב",
    features: ["24/7 supervision", "Photo updates", "₪25K guarantee"],
    featuresHe: ["השגחה 24/7", "עדכוני תמונות", "ערבות ₪25,000"],
    priceFrom: 165,
    route: "/sitter-suite",
    image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=400&fit=crop",
    popular: true,
  },
  {
    id: "house-sitting",
    icon: Sofa,
    name: "House Sitting",
    nameHe: "שמרטפות בבית",
    description: "Your sitter stays in your home with your pet",
    descriptionHe: "המטפל נשאר בביתך עם חיית המחמד",
    features: ["Familiar environment", "Mail & plants care", "Home security"],
    featuresHe: ["סביבה מוכרת", "טיפול בדואר וצמחים", "אבטחת הבית"],
    priceFrom: 275,
    route: "/sitter-suite",
    image: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&h=400&fit=crop",
    popular: false,
  },
  {
    id: "doggy-daycare",
    icon: Users,
    name: "Doggy Daycare",
    nameHe: "מעון יום לכלבים",
    description: "Daytime care while you work",
    descriptionHe: "טיפול יומי בזמן שאתה בעבודה",
    features: ["Playtime", "Socialization", "Potty breaks"],
    featuresHe: ["זמן משחק", "סוציאליזציה", "הפסקות צרכים"],
    priceFrom: 165,
    route: "/sitter-suite",
    image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&h=400&fit=crop",
    popular: true,
  },
  {
    id: "walk-my-pet",
    icon: Footprints,
    name: "Walk My Pet",
    nameHe: "טיול כלבים",
    description: "30 or 60 minute walks with GPS tracking",
    descriptionHe: "טיולים של 30 או 60 דקות עם מעקב GPS",
    features: ["GPS tracking", "Photo updates", "Potty reports"],
    featuresHe: ["מעקב GPS", "עדכוני תמונות", "דוחות צרכים"],
    priceFrom: 55,
    route: "/walk-my-pet",
    image: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&h=400&fit=crop",
    popular: true,
  },
  {
    id: "pettrek",
    icon: Car,
    name: "PetTrek Transport",
    nameHe: "הסעות חיות מחמד",
    description: "Safe transportation with climate control",
    descriptionHe: "הסעה בטוחה עם מיזוג אוויר",
    features: ["Climate controlled", "GPS tracking", "Vet trips"],
    featuresHe: ["רכב ממוזג", "מעקב GPS", "נסיעות לווטרינר"],
    priceFrom: 165,
    route: "/pettrek",
    image: "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600&h=400&fit=crop",
    popular: false,
    comingSoon: true,
  },
  {
    id: "academy",
    icon: GraduationCap,
    name: "Pet Wash Academy",
    nameHe: "אילוף כלבים",
    description: "Private and group training sessions",
    descriptionHe: "אימון פרטי וקבוצתי",
    features: ["Certified trainers", "Positive methods", "All ages"],
    featuresHe: ["מאלפים מוסמכים", "גישה חיובית", "כל הגילאים"],
    priceFrom: 275,
    route: "/academy",
    image: "https://images.unsplash.com/photo-1587559070757-f72a388edbba?w=600&h=400&fit=crop",
    popular: false,
  },
  {
    id: "k9000",
    icon: Droplets,
    name: "K9000 Smart Hub",
    nameHe: "עמדת שטיפה חכמה",
    description: "Premium DIY wash with organic products",
    descriptionHe: "שטיפה עצמית פרימיום עם מוצרים אורגניים",
    features: ["24/7 access", "Organic shampoo", "Tea tree oil"],
    featuresHe: ["גישה 24/7", "שמפו אורגני", "שמן עץ התה"],
    priceFrom: 55,
    route: "/k9000",
    image: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=600&h=400&fit=crop",
    popular: false,
  },
];

export function ServiceShowcase({ variant = "grid", showPricing = true, className }: ServiceShowcaseProps) {
  const { i18n } = useTranslation();
  const [, navigate] = useLocation();
  const isRTL = i18n.language === "he";

  if (variant === "list") {
    return (
      <div className={cn("space-y-4", className)}>
        {serviceData.map((service) => (
          <Card 
            key={service.id}
            className={`p-4 transition-all duration-300 border-0 bg-white ${service.comingSoon ? 'opacity-60 cursor-default' : 'hover:shadow-lg cursor-pointer'}`}
            onClick={() => { if (!service.comingSoon) navigate(service.route); }}
            data-testid={`service-list-${service.id}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                <img 
                  src={service.image} 
                  alt={isRTL ? service.nameHe : service.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">
                  {isRTL ? service.nameHe : service.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {isRTL ? service.descriptionHe : service.description}
                </p>
              </div>
              {showPricing && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">{isRTL ? "החל מ-" : "From"}</p>
                  <p className="text-lg font-semibold text-emerald-600">₪{service.priceFrom}</p>
                </div>
              )}
              <ArrowRight className={cn("h-5 w-5 text-gray-400", isRTL && "rotate-180")} />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("py-16", className)}>
      <div className="text-center mb-12">
        <h2 
          className="text-3xl md:text-4xl font-light tracking-wide text-gray-900 mb-4"
          style={{ fontFamily: "'Didot', 'Bodoni MT', 'Playfair Display', serif" }}
        >
          {isRTL ? "7 שירותים. פלטפורמה אחת." : "7 Services. One Platform."}
        </h2>
        {/* PR-LEGAL-B: previously claimed "PetWash Protect™ guarantee".
            Replaced with a neutral one-roof description per §8 of the
            Provider & Host Services Agreement. */}
        <p className="text-gray-500 max-w-2xl mx-auto">
          {isRTL
            ? "כל מה שחיית המחמד שלך צריכה, תחת קורת גג אחת"
            : "Everything your pet needs, under one roof"
          }
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {serviceData.map((service) => (
          <Card 
            key={service.id}
            className={`group overflow-hidden border-0 bg-white transition-all duration-500 rounded-2xl ${service.comingSoon ? 'opacity-70 cursor-default' : 'hover:shadow-2xl cursor-pointer'}`}
            onClick={() => { if (!service.comingSoon) navigate(service.route); }}
            data-testid={`service-card-${service.id}`}
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src={service.image} 
                alt={isRTL ? service.nameHe : service.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              
              {service.popular && (
                <div className="absolute top-4 right-4 bg-emerald-500 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {isRTL ? "פופולרי" : "Popular"}
                </div>
              )}
              {service.comingSoon && (
                <div className="absolute top-4 right-4 bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  {isRTL ? "בקרוב" : "Coming Soon"}
                </div>
              )}

              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 text-white">
                  <service.icon className="h-5 w-5" />
                  <h3 
                    className="text-xl font-medium"
                    style={{ fontFamily: "'Didot', 'Bodoni MT', 'Playfair Display', serif" }}
                  >
                    {isRTL ? service.nameHe : service.name}
                  </h3>
                </div>
              </div>
            </div>

            <div className="p-5">
              <p className="text-gray-600 text-sm mb-4">
                {isRTL ? service.descriptionHe : service.description}
              </p>

              <div className="space-y-2 mb-4">
                {(isRTL ? service.featuresHe : service.features).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    {feature}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                {showPricing && (
                  <div>
                    <p className="text-xs text-gray-400">{isRTL ? "החל מ-" : "From"}</p>
                    <p className="text-xl font-semibold text-gray-900">
                      ₪{service.priceFrom}
                      <span className="text-xs text-gray-400 font-normal">
                        {service.id === "walk-my-pet" ? (isRTL ? "/טיול" : "/walk") : 
                         service.id === "k9000" ? (isRTL ? "/שטיפה" : "/wash") :
                         (isRTL ? "/לילה" : "/night")}
                      </span>
                    </p>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 group-hover:translate-x-1 transition-transform"
                >
                  {isRTL ? "גלה עוד" : "Explore"}
                  <ArrowRight className={cn("h-4 w-4 ml-1", isRTL && "rotate-180 mr-1 ml-0")} />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <div className="flex items-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            <span>{isRTL ? "ערבות ₪25,000" : "₪25,000 Guarantee"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-emerald-600" />
            <span>{isRTL ? "מטפלים מאומתים" : "Verified Caregivers"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-600" />
            <span>{isRTL ? "תמיכה 24/7" : "24/7 Support"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServiceShowcase;
