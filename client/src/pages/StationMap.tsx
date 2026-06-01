import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/languageStore";
import { useLocation } from "wouter";
import { MapPin, Navigation, Search, Filter } from "lucide-react";

export default function StationMap() {
  const { language } = useLanguage();
  const isHe = language === 'he';
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container py-12">
        {/* Header */}
        <div className="text-center mb-12 luxury-animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-6">
            <MapPin className="w-10 h-10 text-purple-600" />
            <h1 className="luxury-heading-xl">
              {isHe ? 'מצאו תחנת ⁦K9000™⁩' : 'Find a ⁦K9000™⁩ Station'}
            </h1>
          </div>
          <p className="luxury-text-body max-w-2xl mx-auto">
            {isHe
              ? 'אתרו תחנות שטיפה עצמית לחיות מחמד בקרבתכם.'
              : 'Locate self-service pet wash stations near you'}
          </p>
        </div>

        {/* Search Bar */}
        <div className="luxury-glass-card luxury-shadow-xl p-6 mb-12 luxury-animate-slide-up luxury-delay-1">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className={`absolute ${isHe ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400`} />
              <Input
                className={isHe ? 'pr-12 py-6 text-lg border-0 bg-transparent focus-visible:ring-0' : 'pl-12 py-6 text-lg border-0 bg-transparent focus-visible:ring-0'}
                placeholder={isHe ? 'חיפוש לפי עיר, כתובת או מיקוד...' : 'Search by city, address, or postal code...'}
                data-testid="input-search-location"
              />
            </div>
            <Button className="luxury-btn-primary" data-testid="button-current-location">
              <Navigation className="w-5 h-5 mr-2" />
              {isHe ? 'מיקום נוכחי' : 'Use My Location'}
            </Button>
            <Button className="luxury-btn-secondary" data-testid="button-filters">
              <Filter className="w-5 h-5 mr-2" />
              {isHe ? 'סינון' : 'Filters'}
            </Button>
          </div>
        </div>

        {/* Map Placeholder */}
        <div className="luxury-glass-card luxury-shadow-xl h-[600px] flex items-center justify-center mb-12 overflow-hidden luxury-animate-scale-in luxury-delay-2">
          <div className="text-center p-8">
            <MapPin className="w-24 h-24 text-purple-600 mx-auto mb-6 luxury-pulse" />
            <h3 className="luxury-heading-lg mb-4">
              {isHe ? 'המפה האינטראקטיבית — בקרוב' : 'Interactive Map Coming Soon'}
            </h3>
            <p className="luxury-text-body mb-8 max-w-md mx-auto">
              {isHe
                ? 'אנחנו בונים חוויית מפה עם אינטגרציית Google Maps. בינתיים, ניתן לצפות ברשימת התחנות הפעילות.'
                : 'We\'re building a beautiful map experience with Google Maps integration'}
            </p>
            <Button
              className="luxury-btn-primary luxury-shadow-xl"
              data-testid="button-view-list"
              onClick={() => setLocation("/locations")}
            >
              <MapPin className="w-5 h-5 mr-2" />
              {isHe ? 'רשימת תחנות' : 'View Station List'}
            </Button>
          </div>
        </div>

        {/*
          NOTE: the previous version of this file rendered three "quick stats"
          cards with hardcoded values (50+ Active Stations, 24/7 Availability,
          15min Average Distance). The 50+ stations claim does not match the
          live station count (the marketplace currently returns zero) and so
          violated the platform skill §2 "no fake data in production" rule.

          The stats section has been removed until it can be wired to the real
          /api/stations/* counts (and only re-rendered when those counts are
          actually meaningful). Leaving an empty section is honest; lying with
          inflated numbers is not.
        */}
      </div>
    </div>
  );
}
