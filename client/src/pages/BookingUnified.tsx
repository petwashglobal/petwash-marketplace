import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
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
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <Calendar className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Smart Booking
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Pet Wash™ unified booking engine for all platforms. One account, seamless scheduling across all services.
          </p>
        </div>

        {/* Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Card
                key={service.name}
                className="p-6 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-105"
                onClick={() => setLocation(service.href)}
              >
                <div className="flex flex-col gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{service.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{service.desc}</p>
                  </div>
                  <Button data-testid={`button-book-${service.name.toLowerCase().replace(' ', '-')}`}>
                    Book Now
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <Clock className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Instant Confirmation</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Real-time availability and instant booking confirmation
            </p>
          </Card>

          <Card className="p-6 text-center">
            <CreditCard className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Secure Payments</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Safe 72-hour escrow with Nayax Israel
            </p>
          </Card>

          <Card className="p-6 text-center">
            <Calendar className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Flexible Scheduling</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Easy rebooking and cancellation policies
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
