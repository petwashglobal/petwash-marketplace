import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const services = [
    {
      icon: Droplets,
      name: "K9000™",
      href: "/k9000/booking",
      desc: "Book a self-service wash station",
    },
    {
      icon: Home,
      name: "Sitter Suite™",
      href: "/sitter-suite/browse",
      desc: "Find trusted pet sitters",
    },
    {
      icon: Dog,
      name: "Walk My Pet™",
      href: "/walk-my-pet/explore",
      desc: "Book professional dog walks",
    },
    {
      icon: RouteIcon,
      name: "PetTrek™",
      href: "/pettrek",
      desc: "Coming Soon",
      comingSoon: true,
    },
    {
      icon: GraduationCap,
      name: "Pet Wash Academy™",
      href: "/academy",
      desc: "Professional pet training",
    },
  ];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container max-w-6xl mx-auto py-12">
        {/* Hero */}
        <div className="text-center mb-16 luxury-animate-fade-in">
          <div className="luxury-badge luxury-delay-1 inline-flex items-center gap-2 mb-6 opacity-0 luxury-animate-fade-in">
            <Sparkles className="w-4 h-4" />
            Unified Booking System
          </div>
          <Calendar className="w-16 h-16 text-[#0a2540] mx-auto mb-6 opacity-0 luxury-animate-scale-in luxury-delay-2" />
          <h1 className="luxury-heading-xl mb-6 opacity-0 luxury-animate-slide-up luxury-delay-3">
            Smart Booking
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto opacity-0 luxury-animate-fade-in luxury-delay-4">
            ⁦Pet Wash™⁩ unified booking engine for all platforms. One account, seamless scheduling across all services.
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
                  <div className="absolute top-4 right-4 bg-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Coming Soon
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
                    {isComingSoon ? 'Coming Soon' : 'Book Now'}
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
              <Clock className="w-8 h-8 text-[#0a2540] dark:text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-3">Instant Confirmation</h3>
            <p className="luxury-text-small">
              Real-time availability and instant booking confirmation
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center opacity-0 luxury-animate-fade-in luxury-delay-9">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#e8f0fe] to-[#d1e3ff] dark:from-[#0a2540] dark:to-[#1a365d] flex items-center justify-center mx-auto mb-6">
              <CreditCard className="w-8 h-8 text-[#0a2540] dark:text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-3">Secure Payments</h3>
            <p className="luxury-text-small">
              Safe 72-hour escrow with Nayax Israel
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center opacity-0 luxury-animate-fade-in luxury-delay-10">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#e8f0fe] to-[#d1e3ff] dark:from-[#0a2540] dark:to-[#1a365d] flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-8 h-8 text-[#0a2540] dark:text-white" />
            </div>
            <h3 className="luxury-heading-sm mb-3">Flexible Scheduling</h3>
            <p className="luxury-text-small">
              Easy rebooking and cancellation policies
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
