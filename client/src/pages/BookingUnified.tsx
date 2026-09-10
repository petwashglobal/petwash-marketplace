import { useLanguage } from "@/lib/languageStore";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Droplets,
  Home,
  Dog,
  Route as RouteIcon,
  GraduationCap,
  Clock,
  CreditCard,
  Sparkles,
} from "lucide-react";

export default function BookingUnified() {
  const { language } = useLanguage();
  const he = language === "he";
  const [, setLocation] = useLocation();

  const services = [
    {
      icon: Droplets,
      name: "K9000™‎",
      href: "/k9000",
      desc: he ? "עמדת שטיפה בשירות עצמי" : "Self-service wash station",
    },
    {
      icon: Home,
      name: "Sitter Suite™‎",
      href: "/sitter-suite/browse",
      desc: he ? "מצאו שמרטפים מהימנים" : "Find trusted pet sitters",
    },
    {
      icon: Dog,
      name: "Walk My Pet™‎",
      href: "/walk-my-pet/explore",
      desc: he ? "הזמינו טיולי כלבים מקצועיים" : "Book professional dog walks",
    },
    {
      icon: RouteIcon,
      name: "PetTrek™‎",
      href: "/pettrek",
      desc: he ? "בקרוב" : "Coming Soon",
      comingSoon: true,
    },
    {
      icon: GraduationCap,
      name: "Pet Wash Academy™‎",
      href: "/academy",
      desc: he ? "אילוף מקצועי לחיות מחמד" : "Professional pet training",
    },
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container max-w-6xl mx-auto py-12">
        {/* Hero */}
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="luxury-badge luxury-delay-1 inline-flex items-center gap-2 mb-6 opacity-0 luxury-animate-fade-in">
            <Sparkles className="w-4 h-4" />
            {he ? "מערכת הזמנות אחת" : "Unified Booking System"}
          </div>
          <Calendar className="w-16 h-16 text-[#0a2540] mx-auto mb-6 opacity-0 luxury-animate-scale-in luxury-delay-2" />
          <h1 className="luxury-heading-xl mb-6 opacity-0 luxury-animate-slide-up luxury-delay-3">
            {he ? "הזמנה חכמה" : "Smart Booking"}
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto opacity-0 luxury-animate-fade-in luxury-delay-4">
            {he ? "מנוע הזמנות אחד לכל הפלטפורמות של ⁦PetWash™⁩. חשבון אחד, תיאום פשוט בכל השירותים." : "⁦PetWash™⁩ unified booking engine for all platforms. One account, seamless scheduling across all services."}
          </p>
        </div>

        {/* Service Cards */}
        <div className="luxury-grid-3 mb-16">
          {services.map((service, index) => {
            const Icon = service.icon;
            const isComingSoon = (service as any).comingSoon;
            return (
              <div
                key={service.name}
                className={`luxury-glass-card luxury-shadow-xl ${isComingSoon ? 'opacity-60' : 'luxury-hover-glow cursor-pointer'} p-8 opacity-0 luxury-animate-slide-up luxury-delay-${index + 5} relative`}
                onClick={() => !isComingSoon && setLocation(service.href)}
              >
                {isComingSoon && (
                  <div className="absolute top-4 right-4 bg-[#D4AF37] text-white text-xs font-bold px-3 py-1 rounded-full">
                    {he ? "בקרוב" : "Coming Soon"}
                  </div>
                )}
                <div className="flex flex-col gap-6">
                  <div className={`w-16 h-16 rounded-full ${isComingSoon ? 'bg-gradient-to-br from-gray-400 to-gray-500' : 'bg-gradient-to-br from-[#0a2540] to-[#1a365d]'} flex items-center justify-center luxury-shadow-lg`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="luxury-heading-sm mb-2">{service.name}</h3>
                    <p className="luxury-text-small">{service.desc}</p>
                  </div>
                  <Button 
                    className={`${isComingSoon ? 'bg-gray-300 text-gray-500 cursor-not-allowed rounded-lg py-2 px-4' : 'luxury-btn-primary luxury-shadow-xl'} w-full`}
                    data-testid={`button-book-${service.name.toLowerCase().replace(' ', '-')}`}
                    disabled={isComingSoon}
                  >
                    {isComingSoon ? (he ? 'בקרוב' : 'Coming Soon') : (he ? 'הזמינו עכשיו' : 'Book Now')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Features */}
        <div className="luxury-grid-3 gap-8">
          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center opacity-0 luxury-animate-fade-in luxury-delay-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#e8f0fe] to-[#d1e3ff] dark:from-[#0a2540] dark:to-[#1a365d] flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-[#0a2540] dark:text-black" />
            </div>
            <h3 className="luxury-heading-sm mb-3">{he ? "סטטוס ברור בכל שלב" : "Clear status at every step"}</h3>
            <p className="luxury-text-small">
              {he ? "בקשה, אישור הספק, אישור סופי — תמיד רואים איפה ההזמנה עומדת." : "Request, provider acceptance, confirmation — you always see where a booking stands."}
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center opacity-0 luxury-animate-fade-in luxury-delay-9">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#e8f0fe] to-[#d1e3ff] dark:from-[#0a2540] dark:to-[#1a365d] flex items-center justify-center mx-auto mb-6">
              <CreditCard className="w-8 h-8 text-[#0a2540] dark:text-black" />
            </div>
            <h3 className="luxury-heading-sm mb-3">{he ? "תשלום מאובטח" : "Secure payments"}</h3>
            <p className="luxury-text-small">
              {he ? "תשלום בכרטיס דרך ספק סליקה ישראלי מורשה; הכסף מוחזק עד להשלמת השירות." : "Card payments through a licensed Israeli payment provider; funds are held until the service is completed."}
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center opacity-0 luxury-animate-fade-in luxury-delay-10">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#e8f0fe] to-[#d1e3ff] dark:from-[#0a2540] dark:to-[#1a365d] flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-8 h-8 text-[#0a2540] dark:text-black" />
            </div>
            <h3 className="luxury-heading-sm mb-3">{he ? "תיאום גמיש" : "Flexible scheduling"}</h3>
            <p className="luxury-text-small">
              {he ? "שינוי מועד או ביטול לפי מדיניות הביטולים המפורסמת." : "Reschedule or cancel under the published cancellation policy."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
