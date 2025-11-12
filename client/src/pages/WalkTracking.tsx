import { useEffect, useState, useRef } from 'react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  Activity, 
  Heart, 
  Clock, 
  Camera, 
  AlertTriangle, 
  Navigation,
  Phone,
  MessageSquare,
  CheckCircle,
  Loader2,
  User,
  Dog,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'wouter';
import L from 'leaflet';

interface GPSCoordinate {
  lat: number;
  lon: number;
  timestamp: number;
  accuracy: number;
}

interface HealthMetrics {
  heartRate: number | null;
  activityLevel: 'low' | 'medium' | 'high';
  stepsCount: number;
  caloriesBurned: number;
}

interface WalkStatus {
  id: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  walker: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    photoUrl?: string;
    rating: number;
  };
  pet: {
    id: string;
    name: string;
    breed: string;
    photoUrl?: string;
  };
  startTime: string | null;
  endTime: string | null;
  currentLocation: GPSCoordinate | null;
  routeHistory: GPSCoordinate[];
  healthMetrics: HealthMetrics;
  duration: number;
  distance: number;
  photos: string[];
  emergencyAlerts: Array<{
    timestamp: string;
    message: string;
    resolved: boolean;
  }>;
}

export default function WalkTracking() {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const { walkId } = useParams();
  const [, setLocation] = useLocation();
  const isHebrew = language === 'he';
  
  const [wsConnected, setWsConnected] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Fetch walk details
  const { data: walk, isLoading, refetch } = useQuery<WalkStatus>({
    queryKey: [`/api/walk-my-pet/walks/${walkId}`],
    enabled: !!user && !!walkId,
    refetchInterval: 5000, // Fallback polling every 5s
  });

  // WebSocket connection for real-time GPS updates
  useEffect(() => {
    if (!walkId || !user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/realtime`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[GPS] WebSocket connected');
      setWsConnected(true);
      
      // Subscribe to walk updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: `walk:${walkId}`,
        userId: user.uid,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'gps_update' && data.walkId === walkId) {
          // Update map marker position
          if (markerRef.current && data.location) {
            markerRef.current.setLatLng([data.location.lat, data.location.lon]);
          }
          
          // Add to polyline
          if (polylineRef.current && data.location) {
            const latlngs = polylineRef.current.getLatLngs();
            latlngs.push([data.location.lat, data.location.lon]);
            polylineRef.current.setLatLngs(latlngs);
          }
          
          // Refetch walk data to update UI
          refetch();
        }
        
        if (data.type === 'health_update' && data.walkId === walkId) {
          refetch();
        }
        
        if (data.type === 'photo_uploaded' && data.walkId === walkId) {
          refetch();
        }
        
        if (data.type === 'emergency_alert' && data.walkId === walkId) {
          refetch();
          // Show browser notification if permitted
          if (Notification.permission === 'granted') {
            new Notification('🚨 Emergency Alert', {
              body: data.message || 'Emergency alert from walker',
              icon: '/brand/petwash-logo-official.png',
            });
          }
        }
      } catch (err) {
        console.error('[GPS] WebSocket message error:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('[GPS] WebSocket error:', error);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log('[GPS] WebSocket disconnected');
      setWsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'unsubscribe',
          channel: `walk:${walkId}`,
        }));
      }
      ws.close();
    };
  }, [walkId, user, refetch]);

  // Initialize Leaflet map when walk data loads
  useEffect(() => {
    if (!walk || !walk.currentLocation || !mapContainerRef.current) return;
    
    // Destroy existing map if reinitializing
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    try {
      // Initialize Leaflet map
      const map = L.map(mapContainerRef.current, {
        center: [walk.currentLocation.lat, walk.currentLocation.lon],
        zoom: 15,
        zoomControl: true,
      });
      mapRef.current = map;

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom marker icon
      const dogIcon = L.divIcon({
        className: 'custom-dog-marker',
        html: '<div style="font-size: 32px; text-align: center;">🐕</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      // Add marker for current location
      const marker = L.marker([walk.currentLocation.lat, walk.currentLocation.lon], {
        icon: dogIcon,
      }).addTo(map);
      marker.bindPopup(`${walk.pet.name} is here!`);
      markerRef.current = marker;

      // Add polyline for route history
      if (walk.routeHistory && walk.routeHistory.length > 1) {
        const latLngs: [number, number][] = walk.routeHistory.map(coord => [coord.lat, coord.lon]);
        const polyline = L.polyline(latLngs, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.7,
        }).addTo(map);
        polylineRef.current = polyline;
        
        // Fit map to show entire route
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      }

      setMapError(null);
    } catch (error) {
      console.error('[Map] Failed to initialize Leaflet map:', error);
      setMapError('Failed to load map');
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [walk]);

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {isHebrew ? 'טוען נתוני הליכה...' : 'Loading walk data...'}
          </p>
        </div>
      </div>
    );
  }

  if (!walk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {isHebrew ? 'הליכה לא נמצאה' : 'Walk Not Found'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {isHebrew ? 'לא ניתן למצוא את פרטי הליכה' : 'Unable to find walk details'}
            </p>
            <Link href="/walk-my-pet">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isHebrew ? 'חזרה' : 'Go Back'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeAlerts = walk.emergencyAlerts?.filter(a => !a.resolved) || [];
  const formatDuration = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 ${isHebrew ? 'rtl' : 'ltr'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/walk-my-pet">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isHebrew ? 'חזרה' : 'Back'}
            </Button>
          </Link>
          
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <Badge variant={wsConnected ? 'default' : 'secondary'} className="gap-1">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {wsConnected ? (isHebrew ? 'מחובר בזמן אמת' : 'Live') : (isHebrew ? 'מנותק' : 'Offline')}
            </Badge>
            
            {/* Walk Status */}
            <Badge variant={walk.status === 'active' ? 'default' : 'secondary'}>
              {walk.status === 'active' && '🚶 '}
              {isHebrew ? (
                walk.status === 'active' ? 'בטיול' :
                walk.status === 'completed' ? 'הושלם' :
                walk.status === 'pending' ? 'ממתין' : 'בוטל'
              ) : (
                walk.status.toUpperCase()
              )}
            </Badge>
          </div>
        </div>

        {/* Emergency Alerts */}
        {activeAlerts.length > 0 && (
          <Alert className="mb-6 border-red-600 bg-red-50 dark:bg-red-900/20">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <AlertDescription className="font-semibold text-red-900 dark:text-red-200">
              {isHebrew ? '🚨 התראת חירום פעילה!' : '🚨 Active Emergency Alert!'}
              <div className="mt-2 space-y-1">
                {activeAlerts.map((alert, i) => (
                  <div key={i} className="text-sm">
                    {alert.message} - {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Map & Route */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Map */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {isHebrew ? 'מפה בזמן אמת' : 'Live Map'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mapError ? (
                  <Alert className="mb-4">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>{mapError}</AlertDescription>
                  </Alert>
                ) : null}
                
                <div className="relative">
                  <div 
                    ref={mapContainerRef}
                    className="w-full h-96 rounded-lg border-2 border-blue-200 dark:border-blue-700 overflow-hidden z-0"
                  />
                  
                  {!walk.currentLocation && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm">
                      <div className="text-center text-gray-500">
                        <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50 animate-pulse" />
                        <p>{isHebrew ? 'ממתין למיקום GPS...' : 'Waiting for GPS location...'}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Route Stats Overlay */}
                  {walk.status === 'active' && walk.currentLocation && (
                    <div className="absolute top-4 left-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-lg p-3 shadow-lg z-10">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold">{formatDuration(walk.duration)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Navigation className="w-4 h-4 text-green-600" />
                          <span className="font-semibold">{(walk.distance / 1000).toFixed(2)} km</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <MapPin className="w-3 h-3" />
                          <span className="font-mono">{walk.currentLocation.lat.toFixed(4)}, {walk.currentLocation.lon.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Photos from Walk */}
            {walk.photos && walk.photos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    {isHebrew ? 'תמונות מהטיול' : 'Walk Photos'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {walk.photos.map((photoUrl, index) => (
                      <div key={index} className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                        <img 
                          src={photoUrl} 
                          alt={`Walk photo ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Walker & Pet Info */}
            <Card>
              <CardHeader>
                <CardTitle>{isHebrew ? 'פרטי הטיול' : 'Walk Details'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Walker */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  {walk.walker.photoUrl ? (
                    <img src={walk.walker.photoUrl} alt={walk.walker.firstName} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-700 dark:text-blue-300" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{walk.walker.firstName} {walk.walker.lastName}</p>
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <span>⭐</span>
                      <span>{walk.walker.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                {/* Pet */}
                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  {walk.pet.photoUrl ? (
                    <img src={walk.pet.photoUrl} alt={walk.pet.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-purple-200 dark:bg-purple-700 flex items-center justify-center">
                      <Dog className="w-6 h-6 text-purple-700 dark:text-purple-300" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{walk.pet.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{walk.pet.breed}</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <a href={`tel:${walk.walker.phoneNumber}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <Phone className="w-4 h-4 mr-2" />
                      {isHebrew ? 'התקשר' : 'Call'}
                    </Button>
                  </a>
                  <Button variant="outline" size="sm" className="w-full">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {isHebrew ? 'הודעה' : 'Message'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Health Metrics */}
            {walk.healthMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    {isHebrew ? 'מדדי בריאות' : 'Health Metrics'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {walk.healthMetrics.heartRate && (
                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Heart className="w-5 h-5 text-red-600" />
                        <span className="font-semibold">{isHebrew ? 'דופק' : 'Heart Rate'}</span>
                      </div>
                      <span className="text-xl font-bold text-red-600">{walk.healthMetrics.heartRate} BPM</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-green-600" />
                      <span className="font-semibold">{isHebrew ? 'רמת פעילות' : 'Activity'}</span>
                    </div>
                    <Badge variant={
                      walk.healthMetrics.activityLevel === 'high' ? 'default' :
                      walk.healthMetrics.activityLevel === 'medium' ? 'secondary' : 'outline'
                    }>
                      {walk.healthMetrics.activityLevel.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {isHebrew ? 'צעדים' : 'Steps'}
                      </p>
                      <p className="text-lg font-bold">{walk.healthMetrics.stepsCount.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {isHebrew ? 'קלוריות' : 'Calories'}
                      </p>
                      <p className="text-lg font-bold">{walk.healthMetrics.caloriesBurned} kcal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Walk Summary */}
            {walk.status === 'completed' && (
              <Card className="border-2 border-green-200 dark:border-green-700">
                <CardHeader className="bg-green-50 dark:bg-green-900/20">
                  <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    {isHebrew ? 'הטיול הושלם!' : 'Walk Completed!'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{isHebrew ? 'זמן כולל' : 'Total Time'}</span>
                    <span className="font-semibold">{formatDuration(walk.duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{isHebrew ? 'מרחק' : 'Distance'}</span>
                    <span className="font-semibold">{(walk.distance / 1000).toFixed(2)} km</span>
                  </div>
                  {walk.endTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{isHebrew ? 'הסתיים ב' : 'Ended At'}</span>
                      <span className="font-semibold">{new Date(walk.endTime).toLocaleTimeString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
