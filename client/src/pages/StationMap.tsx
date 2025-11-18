import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

export default function StationMap() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Find a K9000™ Station</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Locate self-service pet wash stations near you
          </p>
        </div>

        {/* Search Bar */}
        <Card className="p-6 mb-8">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                className="pl-10"
                placeholder="Search by city, address, or postal code..."
                data-testid="input-search-location"
              />
            </div>
            <Button data-testid="button-current-location">
              <Navigation className="w-5 h-5 mr-2" />
              Use My Location
            </Button>
            <Button variant="outline" data-testid="button-filters">
              <Filter className="w-5 h-5 mr-2" />
              Filters
            </Button>
          </div>
        </Card>

        {/* Map Placeholder */}
        <Card className="h-[600px] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-24 h-24 text-purple-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Interactive Map Coming Soon</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              We're building a beautiful map experience with Google Maps integration
            </p>
            <Button size="lg" data-testid="button-view-list" onClick={() => setLocation("/locations")}>
              View Station List
            </Button>
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">50+</div>
            <div className="text-gray-600 dark:text-gray-400">Active Stations</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">24/7</div>
            <div className="text-gray-600 dark:text-gray-400">Availability</div>
          </Card>
          <Card className="p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">15min</div>
            <div className="text-gray-600 dark:text-gray-400">Average Distance</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
