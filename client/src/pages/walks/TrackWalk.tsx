import { Button } from "@/components/ui/button";
import { useParams } from "wouter";
import { MapPin, Clock, Footprints, Camera, CheckCircle, Navigation } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";
import { useQuery } from "@tanstack/react-query";

export default function TrackWalk() {
  const { walkId } = useParams();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const { data: walk, isLoading, refetch } = useQuery({
    queryKey: ['/api/walk', walkId],
    enabled: !!walkId,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="luxury-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-services-hero">
        <div className="luxury-services-hero-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="luxury-services-badge luxury-animate-fade-in">
            <Navigation className="h-4 w-4" />
            Live Tracking
          </div>
          <h1 className="luxury-heading-xl luxury-animate-fade-in luxury-delay-1">
            {isHebrew ? 'מעקב אחר הליכה' : 'Track Walk'}
          </h1>
          <p className="luxury-services-subtitle luxury-animate-fade-in luxury-delay-2">
            {isHebrew ? 'עקוב אחר הליכת הכלב שלך בזמן אמת' : 'Follow your dog walk in real-time'}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-fade-in">
          <div className="space-y-8">
            {/* Live GPS Map Placeholder */}
            <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl h-96 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-purple-600/20"></div>
              <div className="relative z-10 text-center">
                <MapPin className="h-16 w-16 mx-auto mb-4" style={{ color: '#667eea' }} />
                <p className="luxury-heading-md" style={{ color: '#667eea' }}>
                  {isHebrew ? 'מפת GPS בזמן אמת' : 'Live GPS Map'}
                </p>
              </div>
            </div>

            {/* Walk Stats */}
            <div className="luxury-grid-3">
              <div className="luxury-glass-panel luxury-shadow-md p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <p className="luxury-text-small mb-1">
                  {isHebrew ? 'זמן' : 'Duration'}
                </p>
                <p className="luxury-heading-md">--:--</p>
              </div>
              <div className="luxury-glass-panel luxury-shadow-md p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <Footprints className="h-6 w-6 text-white" />
                </div>
                <p className="luxury-text-small mb-1">
                  {isHebrew ? 'מרחק' : 'Distance'}
                </p>
                <p className="luxury-heading-md">-- km</p>
              </div>
              <div className="luxury-glass-panel luxury-shadow-md p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white" />
                </div>
                <p className="luxury-text-small mb-1">
                  {isHebrew ? 'תמונות' : 'Photos'}
                </p>
                <p className="luxury-heading-md">--</p>
              </div>
            </div>

            <Button
              className="luxury-btn-primary w-full flex items-center justify-center gap-2"
              data-testid="button-refresh"
              onClick={() => refetch()}
            >
              <CheckCircle className="h-4 w-4" />
              {isHebrew ? 'רענן מיקום' : 'Refresh Location'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
