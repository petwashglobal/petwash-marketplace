import { useState } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Heart, 
  Activity,
  Footprints,
  Eye,
  Loader2,
  Dog,
  AlertCircle
} from 'lucide-react';
import { Link } from 'wouter';

interface BathroomMarker {
  type: 'pee' | 'poo';
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy: number;
  notes?: string;
}

interface ActiveWalk {
  id: number;
  bookingId: string;
  walkerId: string;
  petId: string;
  actualStartTime: string;
  durationMinutes: number;
  lastKnownLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: string;
  } | null;
  lastGPSUpdate: string;
  totalDistanceMeters: number;
  vitalDataSummary: {
    heartRateAvg?: number;
    heartRateMax?: number;
    steps?: number;
    hydrationStops?: number;
  } | null;
  bathroomMarkers?: BathroomMarker[];
  isLiveTrackingActive: boolean;
}

export default function TrackMyPet() {
  const { user } = useFirebaseAuth();
  const { language, t } = useLanguage();
  const isHebrew = language === 'he';

  // Fetch active walks for owner
  const { data, isLoading, error } = useQuery<{ success: boolean; walks: ActiveWalk[] }>({
    queryKey: ['/api/walk-session/owner/active-walks'],
    enabled: !!user,
    refetchInterval: 3000, // Refresh every 3 seconds for live tracking
  });

  const activeWalks = data?.walks || [];

  const formatElapsedTime = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  // Show preview for non-logged-in users
  if (!user) {
    return (
      <Card className="bg-gradient-to-br from-purple-50/90 via-blue-50/90 to-pink-50/90 dark:from-purple-950/50 dark:via-blue-950/50 dark:to-pink-950/50 border-2 border-purple-300 dark:border-purple-700 shadow-2xl backdrop-blur-lg hover:shadow-purple-500/50 transition-all duration-300">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-purple-600 dark:text-purple-400 animate-pulse" />
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {isHebrew ? '🐾 עקוב אחרי חיית המחמד שלך LIVE' : '🐾 Track My Pet LIVE'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-900/60 rounded-lg p-3 backdrop-blur-sm">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {isHebrew ? 'מעקב בזמן אמת' : 'Real-time Tracking'}
                </p>
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                  {isHebrew ? 'כל 3 שניות' : 'Every 3 sec'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-900/60 rounded-lg p-3 backdrop-blur-sm">
              <Navigation className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {isHebrew ? 'מיקום GPS' : 'GPS Location'}
                </p>
                <p className="text-sm font-bold text-green-700 dark:text-green-300">
                  {isHebrew ? 'דיוק גבוה' : 'High Accuracy'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-900/60 rounded-lg p-3 backdrop-blur-sm">
              <Heart className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {isHebrew ? 'ניטור דופק' : 'Heart Monitor'}
                </p>
                <p className="text-sm font-bold text-red-700 dark:text-red-300">
                  {isHebrew ? 'חי' : 'Live'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-900/60 rounded-lg p-3 backdrop-blur-sm">
              <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {isHebrew ? 'מד צעדים' : 'Step Counter'}
                </p>
                <p className="text-sm font-bold text-purple-700 dark:text-purple-300">
                  {isHebrew ? 'אוטומטי' : 'Auto'}
                </p>
              </div>
            </div>
          </div>

          {/* Feature List */}
          <div className="bg-blue-50/80 dark:bg-blue-950/40 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
                <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>{isHebrew ? 'צפייה חיה במפה' : 'Live map view'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
                <Footprints className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>{isHebrew ? 'מעקב אחר מרחק וזמן' : 'Distance & time tracking'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
                <Heart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>{isHebrew ? 'נתוני בריאות בזמן אמת' : 'Real-time health data'}</span>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="space-y-2">
            <Link href="/auth/login">
              <Button className="w-full bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 hover:from-purple-700 hover:via-blue-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 text-lg py-6">
                <MapPin className="h-5 w-5 mr-2" />
                {isHebrew ? '🔐 התחבר לצפייה במעקב חי' : '🔐 Login to View Live Tracking'}
              </Button>
            </Link>
            <Link href="/walk-my-pet">
              <Button variant="outline" className="w-full border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30">
                {isHebrew ? 'למידע נוסף על Walk My Pet™' : 'Learn more about Walk My Pet™'}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-50/80 via-blue-50/80 to-pink-50/80 dark:from-purple-950/40 dark:via-blue-950/40 dark:to-pink-950/40 border-purple-200 dark:border-purple-800 shadow-xl backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            {isHebrew ? 'עקוב אחרי חיית המחמד שלך' : 'Track My Pet'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gradient-to-br from-red-50/80 via-orange-50/80 to-yellow-50/80 dark:from-red-950/40 dark:via-orange-950/40 dark:to-yellow-950/40 border-red-200 dark:border-red-800 shadow-xl backdrop-blur-lg">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-700 dark:text-red-300">
            <AlertCircle className="h-6 w-6" />
            <p>{isHebrew ? 'שגיאה בטעינת המעקב' : 'Error loading tracking'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeWalks.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-gray-50/80 via-slate-50/80 to-zinc-50/80 dark:from-gray-950/40 dark:via-slate-950/40 dark:to-zinc-950/40 border-gray-200 dark:border-gray-800 shadow-xl backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Dog className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            {isHebrew ? 'עקוב אחרי חיית המחמד שלך' : 'Track My Pet'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 dark:text-gray-400 text-center py-4">
            {isHebrew ? 'אין טיולים פעילים כרגע' : 'No active walks right now'}
          </p>
          <Link href="/walk-my-pet">
            <Button className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg">
              {isHebrew ? 'הזמן הליכה' : 'Book a Walk'}
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="track-my-pet-widget">
      <h2 className="text-2xl font-bold flex items-center gap-2 mb-4">
        <MapPin className="h-6 w-6 text-purple-600 dark:text-purple-400 animate-pulse" />
        <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          {isHebrew ? '🐾 עקוב אחרי חיית המחמד שלך LIVE' : '🐾 Track My Pet LIVE'}
        </span>
      </h2>

      {activeWalks.map((walk) => (
        <Card 
          key={walk.id} 
          className="bg-gradient-to-br from-purple-50/90 via-blue-50/90 to-pink-50/90 dark:from-purple-950/50 dark:via-blue-950/50 dark:to-pink-950/50 border-2 border-purple-300 dark:border-purple-700 shadow-2xl backdrop-blur-lg hover:shadow-purple-500/50 transition-all duration-300"
          data-testid={`active-walk-${walk.id}`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse shadow-lg">
                  <Eye className="h-3 w-3 mr-1" />
                  {isHebrew ? 'בשידור חי' : 'LIVE'}
                </Badge>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isHebrew ? 'מזהה הזמנה' : 'Booking'}: {walk.bookingId.slice(0, 8)}...
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Live Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Elapsed Time */}
              <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-900/60 rounded-lg p-3 backdrop-blur-sm">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {isHebrew ? 'זמן שעבר' : 'Time'}
                  </p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    {formatElapsedTime(walk.actualStartTime)}
                  </p>
                </div>
              </div>

              {/* Distance */}
              <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-900/60 rounded-lg p-3 backdrop-blur-sm">
                <Footprints className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {isHebrew ? 'מרחק' : 'Distance'}
                  </p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">
                    {formatDistance(walk.totalDistanceMeters)}
                  </p>
                </div>
              </div>

              {/* Heart Rate */}
              {walk.vitalDataSummary?.heartRateAvg && (
                <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-900/60 rounded-lg p-3 backdrop-blur-sm">
                  <Heart className="h-5 w-5 text-red-600 dark:text-red-400 animate-pulse" />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {isHebrew ? 'דופק' : 'Heart Rate'}
                    </p>
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">
                      {walk.vitalDataSummary.heartRateAvg} BPM
                    </p>
                  </div>
                </div>
              )}

              {/* Steps */}
              {walk.vitalDataSummary?.steps && (
                <div className="flex items-center gap-2 bg-white/60 dark:bg-gray-900/60 rounded-lg p-3 backdrop-blur-sm">
                  <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {isHebrew ? 'צעדים' : 'Steps'}
                    </p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                      {walk.vitalDataSummary.steps.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Last Known Location */}
            {walk.lastKnownLocation && (
              <div className="bg-blue-50/80 dark:bg-blue-950/40 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    {isHebrew ? 'מיקום אחרון' : 'Last Location'}
                  </span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 font-mono">
                  {walk.lastKnownLocation.latitude.toFixed(6)}, {walk.lastKnownLocation.longitude.toFixed(6)}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {isHebrew ? 'דיוק' : 'Accuracy'}: {walk.lastKnownLocation.accuracy.toFixed(1)}m
                </p>
              </div>
            )}

            {/* Bathroom Markers (Wag-style) */}
            {walk.bathroomMarkers && walk.bathroomMarkers.length > 0 && (
              <div className="bg-amber-50/80 dark:bg-amber-950/40 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{isHebrew ? '🐾 סמני שירותים' : '🐾 Bathroom Breaks'}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {walk.bathroomMarkers.map((marker, index) => (
                    <Badge 
                      key={index}
                      variant="secondary" 
                      className={marker.type === 'pee' 
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700" 
                        : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700"}
                      data-testid={`bathroom-marker-${index}`}
                    >
                      {marker.type === 'pee' ? '💧 Pee' : '💩 Poo'}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                  {isHebrew 
                    ? `${walk.bathroomMarkers.length} הפסקות שירותים נרשמו` 
                    : `${walk.bathroomMarkers.length} bathroom break${walk.bathroomMarkers.length > 1 ? 's' : ''} recorded`}
                </p>
              </div>
            )}

            {/* Track on Map Button */}
            <Link href={`/walk-tracking/${walk.id}`}>
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 hover:from-purple-700 hover:via-blue-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 text-lg py-6"
                data-testid={`button-track-on-map-${walk.id}`}
              >
                <MapPin className="h-5 w-5 mr-2" />
                {isHebrew ? '🗺️ צפה במפה בזמן אמת' : '🗺️ View on Live Map'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
