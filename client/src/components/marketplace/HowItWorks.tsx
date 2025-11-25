import { useTranslation } from "react-i18next";
import { 
  Search, 
  Calendar, 
  Heart,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HowItWorksProps {
  variant?: "horizontal" | "vertical" | "compact";
  showCTA?: boolean;
  className?: string;
}

const steps = [
  {
    number: 1,
    icon: Search,
    title: "Search & Compare",
    titleHe: "חפש והשווה",
    description: "Browse verified caregivers in your area. Read reviews, check photos, and compare prices.",
    descriptionHe: "עיין במטפלים מאומתים באזורך. קרא ביקורות, בדוק תמונות והשווה מחירים.",
    image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop",
  },
  {
    number: 2,
    icon: Calendar,
    title: "Book & Pay Securely",
    titleHe: "הזמן ושלם בבטחה",
    description: "Choose your dates, send a booking request, and pay securely through our platform.",
    descriptionHe: "בחר תאריכים, שלח בקשת הזמנה ושלם בבטחה דרך הפלטפורמה שלנו.",
    image: "https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=400&h=300&fit=crop",
  },
  {
    number: 3,
    icon: Heart,
    title: "Relax & Enjoy Updates",
    titleHe: "הירגע וקבל עדכונים",
    description: "Receive photo updates, GPS tracking, and activity reports while your pet is cared for.",
    descriptionHe: "קבל עדכוני תמונות, מעקב GPS ודוחות פעילות בזמן שמטפלים בחיית המחמד שלך.",
    image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=300&fit=crop",
  },
];

export function HowItWorks({ variant = "horizontal", showCTA = true, className }: HowItWorksProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "he";

  if (variant === "compact") {
    return (
      <div className={cn("py-8", className)}>
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-semibold">
                {step.number}
              </div>
              <span className="text-gray-700 font-medium">
                {isRTL ? step.titleHe : step.title}
              </span>
              {idx < steps.length - 1 && (
                <ArrowRight className={cn("h-4 w-4 text-gray-300 mx-2", isRTL && "rotate-180")} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "vertical") {
    return (
      <div className={cn("py-12", className)}>
        <div className="space-y-12">
          {steps.map((step, idx) => (
            <div 
              key={idx}
              className="flex items-start gap-6"
              data-testid={`how-it-works-step-${step.number}`}
            >
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-2xl font-light shadow-lg">
                  {step.number}
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-0.5 h-12 bg-emerald-200 mx-auto mt-4" />
                )}
              </div>
              <div className="flex-1 pt-2">
                <h3 
                  className="text-xl font-medium text-gray-900 mb-2"
                  style={{ fontFamily: "'Didot', 'Bodoni MT', 'Playfair Display', serif" }}
                >
                  {isRTL ? step.titleHe : step.title}
                </h3>
                <p className="text-gray-500">
                  {isRTL ? step.descriptionHe : step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("py-20 bg-gray-50", className)}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 
            className="text-3xl md:text-4xl lg:text-5xl font-light tracking-wide text-gray-900 mb-4"
            style={{ fontFamily: "'Didot', 'Bodoni MT', 'Playfair Display', serif" }}
          >
            {isRTL ? "איך זה עובד" : "How It Works"}
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">
            {isRTL 
              ? "הזמנת טיפול לחיית המחמד שלך ב-3 צעדים פשוטים"
              : "Book care for your pet in 3 simple steps"
            }
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {steps.map((step, idx) => (
            <div 
              key={idx}
              className="relative group"
              data-testid={`how-it-works-card-${step.number}`}
            >
              <div className="bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500">
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={step.image}
                    alt={isRTL ? step.titleHe : step.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <div className="w-12 h-12 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center">
                      <step.icon className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                  <div className="absolute top-4 right-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-semibold shadow-lg">
                      {step.number}
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 
                    className="text-xl font-medium text-gray-900 mb-3"
                    style={{ fontFamily: "'Didot', 'Bodoni MT', 'Playfair Display', serif" }}
                  >
                    {isRTL ? step.titleHe : step.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {isRTL ? step.descriptionHe : step.description}
                  </p>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                  <div className={cn(
                    "w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center",
                    isRTL && "rotate-180"
                  )}>
                    <ArrowRight className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 
                className="text-2xl md:text-3xl font-light text-gray-900 mb-4"
                style={{ fontFamily: "'Didot', 'Bodoni MT', 'Playfair Display', serif" }}
              >
                {isRTL ? "מוכנים להתחיל?" : "Ready to Get Started?"}
              </h3>
              <p className="text-gray-500 mb-6">
                {isRTL 
                  ? "הצטרפו לאלפי בעלי חיות מחמד מרוצים שמצאו טיפול מושלם"
                  : "Join thousands of happy pet owners who found perfect care"
                }
              </p>
              <div className="space-y-3">
                {[
                  isRTL ? "אלפי מטפלים מאומתים" : "Thousands of verified caregivers",
                  isRTL ? "ערבות ₪25,000" : "₪25,000 guarantee",
                  isRTL ? "הזמנה קלה ומהירה" : "Easy and fast booking",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            {showCTA && (
              <div className="text-center md:text-right">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-12 py-6 text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all"
                  data-testid="button-get-started"
                >
                  {isRTL ? "מצא מטפל עכשיו" : "Find a Caregiver Now"}
                  <ArrowRight className={cn("h-5 w-5 ml-2", isRTL && "rotate-180 mr-2 ml-0")} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HowItWorks;
