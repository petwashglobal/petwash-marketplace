import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
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
      name: "Wash Station",
      href: "/k9000/booking",
      desc: "Book a K9000 self-service wash",
    },
    {
      icon: Home,
      name: "Pet Sitter",
      href: "/sitter-suite/booking",
      desc: "Find trusted sitters",
    },
    {
      icon: Dog,
      name: "Dog Walker",
      href: "/walk-my-pet/booking",
      desc: "Book professional walks",
    },
    {
      icon: RouteIcon,
      name: "Pet Transport",
      href: "/pettrek/booking",
      desc: "Safe pet transportation",
    },
    {
      icon: GraduationCap,
      name: "Training",
      href: "/academy/booking",
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
          <Calendar className="w-16 h-16 text-purple-600 mx-auto mb-6 opacity-0 luxury-animate-scale-in luxury-delay-2" />
          <h1 className="luxury-heading-xl mb-6 opacity-0 luxury-animate-slide-up luxury-delay-3">
            Smart Booking
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto opacity-0 luxury-animate-fade-in luxury-delay-4">
            Pet Wash™ unified booking engine for all platforms. One account, seamless scheduling across all services.
          </p>
        </div>

        {/* Service Cards */}
        <div className="luxury-grid-3 mb-16">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={service.name}
                className={`luxury-glass-card luxury-shadow-xl luxury-hover-glow p-8 cursor-pointer opacity-0 luxury-animate-slide-up luxury-delay-${index + 5}`}
                onClick={() => setLocation(service.href)}
              >
                <div className="flex flex-col gap-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center luxury-shadow-lg">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="luxury-heading-sm mb-2">{service.name}</h3>
                    <p className="luxury-text-small">{service.desc}</p>
                  </div>
                  <button 
                    className="luxury-btn-primary luxury-shadow-xl w-full"
                    data-testid={`button-book-${service.name.toLowerCase().replace(' ', '-')}`}
                  >
                    Book Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Features */}
        <div className="luxury-grid-3 gap-8">
          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center opacity-0 luxury-animate-fade-in luxury-delay-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="luxury-heading-sm mb-3">Instant Confirmation</h3>
            <p className="luxury-text-small">
              Real-time availability and instant booking confirmation
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center opacity-0 luxury-animate-fade-in luxury-delay-9">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 flex items-center justify-center mx-auto mb-6">
              <CreditCard className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="luxury-heading-sm mb-3">Secure Payments</h3>
            <p className="luxury-text-small">
              Safe 72-hour escrow with Nayax Israel
            </p>
          </div>

          <div className="luxury-glass-card luxury-shadow-xl p-8 text-center opacity-0 luxury-animate-fade-in luxury-delay-10">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-8 h-8 text-purple-600" />
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
