import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Clock, Droplet, Sparkles } from "lucide-react";

export default function Stations() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4">
            <Droplet className="w-8 h-8 text-purple-600" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Pet Wash Stations
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Self-service K9000™ organic wash locations. Professional-grade equipment, organic products, convenient locations.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6">
            <MapPin className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Convenient Locations</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Find K9000 stations near you at shopping centers, fuel stations, and city centers.
            </p>
          </Card>

          <Card className="p-6">
            <Sparkles className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Organic Products</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Premium organic shampoos and conditioners safe for all breeds and skin types.
            </p>
          </Card>

          <Card className="p-6">
            <Clock className="w-12 h-12 text-purple-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">24/7 Availability</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Wash your pet anytime, day or night. No appointments needed.
            </p>
          </Card>
        </div>

        {/* Map CTA */}
        <Card className="p-12 text-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <Navigation className="w-16 h-16 text-purple-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Find Your Nearest Station</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-xl mx-auto">
            Use our interactive map to locate K9000 stations, check availability, and get directions.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" data-testid="button-map" onClick={() => window.location.href = "/map"}>
              <MapPin className="w-5 h-5 mr-2" />
              View Map
            </Button>
            <Button size="lg" variant="outline" data-testid="button-pricing" onClick={() => window.location.href = "/pricing"}>
              View Pricing
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
