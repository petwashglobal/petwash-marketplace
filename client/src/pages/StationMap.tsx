import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/languageStore";
import { useLocation } from "wouter";
import { MapPin } from "lucide-react";
import { useSEO, pageSEO } from '@/lib/seo';

export default function StationMap() {
  useSEO(pageSEO.map);
  const { language } = useLanguage();
  const isHe = language === 'he';
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-container py-12">
        {/* Header */}
        <div className="text-center mb-12 luxury-animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-6">
            <MapPin className="w-10 h-10 text-[#B8932F]" />
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

        {/* Search / location / filter controls were REMOVED (2026-07-09): they
            rendered as fully-enabled inputs+buttons but had zero handlers — a
            dead-click on a page a customer visits to find a wash station. Live
            search needs the interactive map (still "coming soon" below), so —
            consistent with the fake-stats removal in this file — we don't show
            controls that don't work. The honest next-step (View Station List)
            lives in the map card below. */}

        {/* Map Placeholder */}
        <div className="luxury-glass-card luxury-shadow-xl h-[600px] flex items-center justify-center mb-12 overflow-hidden luxury-animate-scale-in luxury-delay-2">
          <div className="text-center p-8">
            <MapPin className="w-24 h-24 text-[#B8932F] mx-auto mb-6 luxury-pulse" />
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
