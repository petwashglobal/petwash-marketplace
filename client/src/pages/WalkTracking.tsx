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
  // Full booking snapshot — always present from GET /walks/:id
  booking?: {
    pickupAddress?: string;
    pickupLatitude?: string | number | null;
    pickupLongitude?: string | number | null;
    bookingId?: string;
  };
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
    
    // Load Leaflet CSS on-demand (removed from <head> to avoid render-blocking)
    if (typeof window !== 'undefined' && (window as any).__loadLeafletCSS) {
      (window as any).__loadLeafletCSS();
    }

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
      <div className="min-h-screen flex items-center justify-center luxury-bg-mesh">
        <div className="text-center luxury-animate-fade-in">
          <div className="luxury-spinner mx-auto mb-6" />
          <p className="luxury-text-body">
            {isHebrew ? 'טוען נתוני הליכה...' : 'Loading walk data...'}
          </p>
        </div>
      </div>
    );
  }

  if (!walk) {
    return (
      <div className="min-h-screen flex items-center justify-center luxury-bg-mesh">
        <div className="luxury-glass-card max-w-md p-8 luxury-animate-scale-in">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
            <h2 className="luxury-heading-md mb-3">
              {isHebrew ? 'הליכה לא נמצאה' : 'Walk Not Found'}
            </h2>
            <p className="luxury-text-body mb-6">
              {isHebrew ? 'לא ניתן למצוא את פרטי הליכה' : 'Unable to find walk details'}
            </p>
            <Link href="/walk-my-pet">
              <Button className="luxury-btn-primary">
                <ArrowLeft className="w-4 h-4 mr-2 inline" />
                {isHebrew ? 'חזרה' : 'Go Back'}
              </Button>
            </Link>
          </div>
        </div>
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
    <div className={`min-h-screen luxury-bg-mesh ${(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 luxury-animate-fade-in">
          <Link href="/walk-my-pet">
            <Button className="luxury-btn-ghost">
              <ArrowLeft className="w-4 h-4 mr-2 inline" />
              {isHebrew ? 'חזרה' : 'Back'}
            </Button>
          </Link>
          
          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className={`luxury-badge ${wsConnected ? 'luxury-badge-success' : ''} luxury-animate-fade-in luxury-delay-1`}>
              <div className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {wsConnected ? (isHebrew ? 'מחובר בזמן אמת' : 'Live') : (isHebrew ? 'מנותק' : 'Offline')}
            </div>
            
            {/* Walk Status */}
            <div className={`luxury-badge text-lg px-5 py-2.5 ${walk.status === 'active' ? 'luxury-badge-gold' : ''} luxury-animate-fade-in luxury-delay-2`}>
              {walk.status === 'active' && '🚶 '}
              {isHebrew ? (
                walk.status === 'active' ? 'בטיול' :
                walk.status === 'completed' ? 'הושלם' :
                walk.status === 'pending' ? 'ממתין' : 'בוטל'
              ) : (
                walk.status.toUpperCase()
              )}
            </div>
          </div>
        </div>

        {/* Emergency Alerts */}
        {activeAlerts.length > 0 && (
          <div className="mb-8 luxury-glass-card border-2 border-red-500 bg-red-50/80 dark:bg-white p-6 luxury-animate-slide-up luxury-hover-glow">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
              <div className="flex-1">
                <h3 className="luxury-heading-sm text-red-900 dark:text-red-200 mb-3">
                  {isHebrew ? '🚨 התראת חירום פעילה!' : '🚨 Active Emergency Alert!'}
                </h3>
                <div className="space-y-2">
                  {activeAlerts.map((alert, i) => (
                    <div key={i} className="luxury-glass-minimal p-3 luxury-text-small text-red-900 dark:text-red-100">
                      {alert.message} - {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Map & Route */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Map */}
            <div className="luxury-glass-card luxury-shadow-xl luxury-animate-slide-up luxury-delay-3">
              <div className="p-6">
                <h2 className="luxury-heading-sm flex items-center gap-2 mb-4">
                  <MapPin className="w-6 h-6 text-purple-600" />
                  {isHebrew ? 'מפה בזמן אמת' : 'Live Map'}
                </h2>
                
                {mapError ? (
                  <div className="luxury-glass-minimal p-4 mb-4 border-l-4 border-yellow-500">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      <p className="luxury-text-small text-yellow-900 dark:text-yellow-100">{mapError}</p>
                    </div>
                  </div>
                ) : null}
                
                <div className="relative">
                  <div 
                    ref={mapContainerRef}
                    className="w-full h-96 rounded-2xl border-2 border-purple-200 dark:border-purple-700 overflow-hidden z-0 luxury-shadow-md"
                  />
                  
                  {!walk.currentLocation && (
                    <div className="absolute inset-0 flex items-center justify-center luxury-glass-panel">
                      <div className="text-center">
                        <MapPin className="w-16 h-16 mx-auto mb-3 text-purple-400 animate-pulse" />
                        <p className="luxury-text-body">{isHebrew ? 'ממתין למיקום GPS...' : 'Waiting for GPS location...'}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Route Stats Overlay */}
                  {walk.status === 'active' && walk.currentLocation && (
                    <div className="absolute top-4 left-4 luxury-glass-panel p-4 luxury-shadow-lg z-10 luxury-animate-fade-in">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-white" />
                          </div>
                          <span className="luxury-text-body font-bold">{formatDuration(walk.duration)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                            <Navigation className="w-5 h-5 text-white" />
                          </div>
                          <span className="luxury-text-body font-bold">{(walk.distance / 1000).toFixed(2)} km</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <MapPin className="w-4 h-4 text-purple-500" />
                          <span className="font-mono luxury-text-small">{walk.currentLocation.lat.toFixed(4)}, {walk.currentLocation.lon.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Photos from Walk */}
            {walk.photos && walk.photos.length > 0 && (
              <div className="luxury-glass-card luxury-animate-slide-up luxury-delay-4">
                <div className="p-6">
                  <h2 className="luxury-heading-sm flex items-center gap-2 mb-4">
                    <Camera className="w-6 h-6 text-purple-600" />
                    {isHebrew ? 'תמונות מהטיול' : 'Walk Photos'}
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {walk.photos.map((photoUrl, index) => (
                      <div 
                        key={index} 
                        className="aspect-square rounded-2xl overflow-hidden luxury-glass-minimal luxury-hover-lift cursor-pointer"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <img 
                          src={photoUrl} 
                          alt={`Walk photo ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Walker & Pet Info */}
            <div className="luxury-glass-card luxury-hover-glow luxury-animate-slide-up luxury-delay-5">
              <div className="p-6">
                <h2 className="luxury-heading-sm mb-4">{isHebrew ? 'פרטי הטיול' : 'Walk Details'}</h2>
                
                <div className="space-y-4">
                  {/* Walker */}
                  <div className="luxury-glass-panel p-4">
                    <div className="flex items-center gap-4">
                      {walk.walker.photoUrl ? (
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 animate-pulse" style={{ padding: '3px' }}></div>
                          <img 
                            src={walk.walker.photoUrl} 
                            alt={walk.walker.firstName} 
                            className="relative w-16 h-16 rounded-full object-cover border-4 border-white dark:border-gray-800" 
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                          <User className="w-8 h-8 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="luxury-heading-sm text-base mb-1">{walk.walker.firstName} {walk.walker.lastName}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl">⭐</span>
                          <span className="luxury-text-gradient font-bold text-lg">{walk.walker.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pet */}
                  <div className="luxury-glass-panel p-4">
                    <div className="flex items-center gap-4">
                      {walk.pet.photoUrl ? (
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 animate-pulse" style={{ padding: '3px' }}></div>
                          <img 
                            src={walk.pet.photoUrl} 
                            alt={walk.pet.name} 
                            className="relative w-16 h-16 rounded-full object-cover border-4 border-white dark:border-gray-800" 
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Dog className="w-8 h-8 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="luxury-heading-sm text-base mb-1">{walk.pet.name}</p>
                        <p className="luxury-text-small">{walk.pet.breed}</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <a href={`tel:${walk.walker.phoneNumber}`}>
                      <Button className="luxury-btn-primary w-full flex items-center justify-center gap-2">
                        <Phone className="w-4 h-4" />
                        {isHebrew ? 'התקשר' : 'Call'}
                      </Button>
                    </a>
                    <Button className="luxury-btn-secondary w-full flex items-center justify-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      {isHebrew ? 'הודעה' : 'Message'}
                    </Button>
                  </div>

                  {/* Navigation to pickup address */}
                  {(() => {
                    const lat = walk.booking?.pickupLatitude != null ? Number(walk.booking.pickupLatitude) : null;
                    const lng = walk.booking?.pickupLongitude != null ? Number(walk.booking.pickupLongitude) : null;
                    if (!lat || !lng) return null;
                    return (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          {isHebrew ? 'ניווט לנקודת האיסוף' : 'Navigate to pickup'}
                        </p>
                        {walk.booking?.pickupAddress && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {walk.booking.pickupAddress}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <a
                            href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#09B4FF]/10 border border-[#09B4FF]/30 text-[#09B4FF] text-xs font-semibold hover:bg-[#09B4FF]/20 transition-colors"
                          >
                            🚗 Waze
                          </a>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                          >
                            🗺️ {isHebrew ? 'מפות Google' : 'Google Maps'}
                          </a>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Health Metrics */}
            {walk.healthMetrics && (
              <div className="luxury-glass-card luxury-animate-slide-up luxury-delay-6">
                <div className="p-6">
                  <h2 className="luxury-heading-sm flex items-center gap-2 mb-4">
                    <Activity className="w-6 h-6 text-purple-600" />
                    {isHebrew ? 'מדדי בריאות' : 'Health Metrics'}
                  </h2>
                  
                  <div className="space-y-4">
                    {walk.healthMetrics.heartRate && (
                      <div className="luxury-glass-panel p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                              <Heart className="w-6 h-6 text-white animate-pulse" />
                            </div>
                            <span className="luxury-text-body font-semibold">{isHebrew ? 'דופק' : 'Heart Rate'}</span>
                          </div>
                          <span className="luxury-text-gradient text-2xl font-bold">{walk.healthMetrics.heartRate} BPM</span>
                        </div>
                      </div>
                    )}

                    <div className="luxury-glass-panel p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                            <Activity className="w-6 h-6 text-white" />
                          </div>
                          <span className="luxury-text-body font-semibold">{isHebrew ? 'רמת פעילות' : 'Activity'}</span>
                        </div>
                        <div className={`luxury-badge ${
                          walk.healthMetrics.activityLevel === 'high' ? 'luxury-badge-success' :
                          walk.healthMetrics.activityLevel === 'medium' ? 'luxury-badge-gold' : ''
                        }`}>
                          {walk.healthMetrics.activityLevel.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="luxury-glass-minimal p-4 text-center">
                        <p className="luxury-text-small mb-2">
                          {isHebrew ? 'צעדים' : 'Steps'}
                        </p>
                        <p className="luxury-text-gradient text-2xl font-bold">{walk.healthMetrics.stepsCount.toLocaleString()}</p>
                      </div>
                      <div className="luxury-glass-minimal p-4 text-center">
                        <p className="luxury-text-small mb-2">
                          {isHebrew ? 'קלוריות' : 'Calories'}
                        </p>
                        <p className="luxury-text-gradient text-2xl font-bold">{walk.healthMetrics.caloriesBurned}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Walk Summary */}
            {walk.status === 'completed' && (
              <div className="luxury-glass-card border-2 border-green-400 bg-green-50/50 dark:bg-white luxury-animate-scale-in luxury-delay-7">
                <div className="p-6">
                  <h2 className="luxury-heading-sm flex items-center gap-2 text-green-700 dark:text-green-400 mb-4">
                    <CheckCircle className="w-6 h-6" />
                    {isHebrew ? 'הטיול הושלם!' : 'Walk Completed!'}
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="luxury-glass-minimal p-4">
                      <div className="flex justify-between items-center">
                        <span className="luxury-text-body">{isHebrew ? 'זמן כולל' : 'Total Time'}</span>
                        <span className="luxury-text-gradient text-xl font-bold">{formatDuration(walk.duration)}</span>
                      </div>
                    </div>
                    <div className="luxury-glass-minimal p-4">
                      <div className="flex justify-between items-center">
                        <span className="luxury-text-body">{isHebrew ? 'מרחק' : 'Distance'}</span>
                        <span className="luxury-text-gradient text-xl font-bold">{(walk.distance / 1000).toFixed(2)} km</span>
                      </div>
                    </div>
                    {walk.endTime && (
                      <div className="luxury-glass-minimal p-4">
                        <div className="flex justify-between items-center">
                          <span className="luxury-text-body">{isHebrew ? 'הסתיים ב' : 'Ended At'}</span>
                          <span className="luxury-text-gradient text-xl font-bold">{new Date(walk.endTime).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
