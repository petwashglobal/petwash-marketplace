import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Home,
  Droplets,
  Dog,
  Route as RouteIcon,
  GraduationCap,
  ShoppingBag,
  Award,
  Gift,
} from "lucide-react";

export default function Hub() {
  const { t } = useTranslation();

  const platforms = [
    {
      icon: Droplets,
      name: "Pet Wash Stations",
      desc: "Self-service K9000 organic wash locations",
      href: "/stations",
      active: true,
    },
    {
      icon: Home,
      name: "Pet Sitter",
      desc: "Trusted pet and home sitting",
      href: "/sitter",
      active: true,
    },
    {
      icon: Dog,
      name: "Pet Walker",
      desc: "Walks, play time and outdoor activities",
      href: "/walker",
      active: true,
    },
    {
      icon: RouteIcon,
      name: "Pet Transport",
      desc: "Pet taxi between locations",
      href: "/transport",
      active: true,
    },
    {
      icon: GraduationCap,
      name: "Pet Wash Academy",
      desc: "Training and certification",
      href: "/academy",
      active: true,
    },
    {
      icon: ShoppingBag,
      name: "Pet Wash Shop",
      desc: "Coming soon",
      href: "#",
      active: false,
    },
    {
      icon: Award,
      name: "Loyalty & VIP Club",
      desc: "Rewards and exclusive benefits",
      href: "/loyalty",
      active: true,
    },
    {
      icon: Gift,
      name: "eGift Cards",
      desc: "Digital gifts for friends and family",
      href: "/egift",
      active: true,
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Pet Wash Hub™
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            One 7-star account for all your pets and services. Seamless access to our complete ecosystem.
          </p>
        </div>

        {/* Platforms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            return (
              <Card
                key={platform.name}
                className={`p-6 hover:shadow-xl transition-all duration-300 ${
                  platform.active
                    ? "cursor-pointer hover:scale-105"
                    : "opacity-50 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (platform.active && platform.href !== "#") {
                    window.location.href = platform.href;
                  }
                }}
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{platform.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {platform.desc}
                    </p>
                  </div>
                  {platform.active && platform.href !== "#" && (
                    <Button size="sm" className="mt-2">
                      Open
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <Card className="p-8 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <h2 className="text-2xl font-bold mb-4">
              Experience the Pet Wash™ Ecosystem
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
              One account. Eight premium platforms. Unlimited care for your pets.
            </p>
            <Button size="lg" data-testid="button-signup">
              Join Pet Wash Hub
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
