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
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container py-12">
        {/* Header */}
        <div className="text-center mb-12 luxury-animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-6">
            <MapPin className="w-10 h-10 text-purple-600" />
            <h1 className="luxury-heading-xl">Find a ⁦K9000™⁩ Station</h1>
          </div>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Locate self-service pet wash stations near you
          </p>
        </div>

        {/* Search Bar */}
        <div className="luxury-glass-card luxury-shadow-xl p-6 mb-12 luxury-animate-slide-up luxury-delay-1">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                className="pl-12 py-6 text-lg border-0 bg-transparent focus-visible:ring-0"
                placeholder="Search by city, address, or postal code..."
                data-testid="input-search-location"
              />
            </div>
            <button className="luxury-btn-primary" data-testid="button-current-location">
              <Navigation className="w-5 h-5 mr-2" />
              Use My Location
            </button>
            <button className="luxury-btn-secondary" data-testid="button-filters">
              <Filter className="w-5 h-5 mr-2" />
              Filters
            </button>
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="luxury-glass-card luxury-shadow-xl h-[600px] flex items-center justify-center mb-12 overflow-hidden luxury-animate-scale-in luxury-delay-2">
          <div className="text-center p-8">
            <MapPin className="w-24 h-24 text-purple-600 mx-auto mb-6 luxury-pulse" />
            <h3 className="luxury-heading-lg mb-4">Interactive Map Coming Soon</h3>
            <p className="luxury-text-body mb-8 max-w-md mx-auto">
              We're building a beautiful map experience with Google Maps integration
            </p>
            <button
              className="luxury-btn-primary luxury-shadow-xl"
              data-testid="button-view-list"
              onClick={() => setLocation("/locations")}
            >
              <MapPin className="w-5 h-5 mr-2" />
              View Station List
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="luxury-grid-3 luxury-animate-slide-up luxury-delay-3">
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
              <MapPin className="w-8 h-8 text-purple-600" />
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mb-2">50+</div>
            <div className="luxury-text-small">Active Stations</div>
          </div>
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
              <Navigation className="w-8 h-8 text-purple-600" />
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mb-2">24/7</div>
            <div className="luxury-text-small">Availability</div>
          </div>
          <div className="luxury-glass-card luxury-hover-lift luxury-shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center">
              <MapPin className="w-8 h-8 text-purple-600" />
            </div>
            <div className="luxury-heading-lg luxury-text-gradient mb-2">15min</div>
            <div className="luxury-text-small">Average Distance</div>
          </div>
        </div>
      </div>
    </div>
  );
}
