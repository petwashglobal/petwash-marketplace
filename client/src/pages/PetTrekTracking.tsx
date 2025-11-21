import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Car, 
  MapPin, 
  Clock, 
  Navigation, 
  Phone, 
  Star, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  TrendingUp,
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TripDetails {
  id: number;
  tripId: string;
  status: string;
  petName: string;
  petType: string;
  petSize: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  estimatedDuration: number;
  scheduledPickupTime: string;
  actualPickupTime: string | null;
  provider: {
    id: number;
    firstName: string;
    lastName: string;
    vehicleType: string;
    vehicleCapacity: string;
    averageRating: number;
    phoneNumber: string;
  } | null;
  tracking: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    distanceToDestination: number;
    estimatedArrival: number;
    recordedAt: string;
  } | null;
}

export default function PetTrekTracking() {
  const [match, params] = useRoute('/pettrek/track/:tripId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tripId = params?.tripId;

  const [elapsedTime, setElapsedTime] = useState(0);

  // Fetch trip details with live tracking
  const { data: trip, isLoading, error } = useQuery<TripDetails>({
    queryKey: ['/api/pettrek/trips', tripId, 'tracking'],
    enabled: !!tripId,
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
  });

  // Calculate elapsed time since pickup
  useEffect(() => {
    if (trip?.actualPickupTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(trip.actualPickupTime!).getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [trip?.actualPickupTime]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      requested: { className: 'luxury-badge', text: 'Searching for Driver', icon: Loader2 },
      dispatched: { className: 'luxury-badge-gold', text: 'Driver Notified', icon: AlertCircle },
      accepted: { className: 'luxury-badge-success', text: 'Driver Accepted', icon: CheckCircle2 },
      in_progress: { className: 'luxury-badge', text: 'En Route', icon: Car },
      completed: { className: 'luxury-badge-success', text: 'Completed', icon: CheckCircle2 },
      canceled: { className: 'luxury-badge', text: 'Canceled', icon: AlertCircle },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.requested;
    const Icon = config.icon;
    
    return (
      <div className={cn(config.className, 'text-lg px-6 py-3')}>
        <Icon className="w-5 h-5 mr-2 animate-pulse" />
        {config.text}
      </div>
    );
  };

  const calculateProgress = (status: string) => {
    const progress = {
      requested: 10,
      dispatched: 25,
      accepted: 50,
      in_progress: 75,
      completed: 100,
      canceled: 0,
    };
    return progress[status as keyof typeof progress] || 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center luxury-bg-mesh">
        <div className="text-center luxury-animate-scale-in">
          <div className="luxury-spinner mx-auto mb-6"></div>
          <p className="luxury-text-body font-semibold">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center luxury-bg-mesh">
        <Card className="max-w-md luxury-glass-card luxury-shadow-xl luxury-animate-scale-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 luxury-heading-sm">
              <AlertCircle className="w-5 h-5" />
              Trip Not Found
            </CardTitle>
            <CardDescription className="luxury-text-small">Unable to load trip details</CardDescription>
          </CardHeader>
          <CardContent>
            <button 
              onClick={() => setLocation('/dashboard')} 
              data-testid="button-back-to-dashboard"
              className="luxury-btn-primary w-full"
            >
              Back to Dashboard
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8 luxury-animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="luxury-delay-1 luxury-animate-slide-up">
              <h1 className="luxury-heading-lg luxury-text-gradient">
                Track {trip.petName}'s Journey
              </h1>
              <p className="luxury-text-small mt-2">Trip ID: {trip.tripId}</p>
            </div>
            <div className="luxury-delay-2 luxury-animate-scale-in">
              {getStatusBadge(trip.status)}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-3 luxury-delay-3 luxury-animate-fade-in">
            <div className="relative">
              <Progress 
                value={calculateProgress(trip.status)} 
                className="h-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30" 
                data-testid="progress-trip-status" 
              />
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-full" 
                   style={{ width: `${calculateProgress(trip.status)}%`, transition: 'width 0.5s ease' }}></div>
            </div>
            <div className="flex justify-between luxury-text-small font-medium">
              <span className={calculateProgress(trip.status) >= 10 ? 'luxury-text-gradient' : ''}>Requested</span>
              <span className={calculateProgress(trip.status) >= 25 ? 'luxury-text-gradient' : ''}>Dispatched</span>
              <span className={calculateProgress(trip.status) >= 50 ? 'luxury-text-gradient' : ''}>Accepted</span>
              <span className={calculateProgress(trip.status) >= 75 ? 'luxury-text-gradient' : ''}>En Route</span>
              <span className={calculateProgress(trip.status) >= 100 ? 'luxury-text-gradient' : ''}>Completed</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* Main Content - Live Activity Card */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Live Activity Card - Apple-inspired */}
            {trip.status === 'in_progress' && trip.tracking && (
              <Card className="luxury-glass-card luxury-shadow-xl overflow-hidden luxury-animate-slide-up luxury-delay-4 border-2 border-purple-200/50 dark:border-purple-500/30">
                <div className="bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center animate-pulse">
                        <Car className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">On The Way</h3>
                        <p className="text-sm opacity-90">Your pet is being transported safely</p>
                      </div>
                    </div>
                    <Heart className="w-6 h-6 animate-pulse" />
                  </div>
                  
                  {/* ETA and Speed */}
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
                      <Clock className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{trip.tracking.estimatedArrival}</p>
                      <p className="text-xs opacity-80">mins ETA</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
                      <TrendingUp className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{trip.tracking.speed.toFixed(0)}</p>
                      <p className="text-xs opacity-80">km/h</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center">
                      <MapPin className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{trip.tracking.distanceToDestination.toFixed(1)}</p>
                      <p className="text-xs opacity-80">km away</p>
                    </div>
                  </div>

                  {/* Trip Timer */}
                  {trip.actualPickupTime && (
                    <div className="mt-4 bg-white/10 backdrop-blur-lg rounded-xl p-3 text-center">
                      <p className="text-sm opacity-80 mb-1">Trip Duration</p>
                      <p className="text-3xl font-bold font-mono tracking-wider">{formatTime(elapsedTime)}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Map Placeholder */}
            <Card className="luxury-glass-card luxury-shadow-xl luxury-animate-slide-up luxury-delay-5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 luxury-heading-sm">
                  <Navigation className="w-5 h-5 luxury-text-gradient" />
                  Live Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-cyan-900/20 rounded-2xl flex items-center justify-center border-2 border-dashed border-purple-300/50 dark:border-purple-500/30 luxury-hover-glow transition-all">
                  <div className="text-center">
                    <MapPin className="w-16 h-16 luxury-text-gradient mx-auto mb-4 animate-pulse" />
                    <p className="luxury-text-body font-semibold mb-2">Real-time GPS Map</p>
                    <p className="luxury-text-small">
                      {trip.tracking ? 
                        `Driver at ${trip.tracking.latitude.toFixed(4)}, ${trip.tracking.longitude.toFixed(4)}` :
                        'Waiting for driver location...'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Route Details */}
            <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-slide-up luxury-delay-6">
              <CardHeader>
                <CardTitle className="luxury-heading-sm">Route Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-xs luxury-text-gradient uppercase tracking-wider mb-1">PICKUP</p>
                    <p className="luxury-text-body font-semibold">{trip.pickupAddress}</p>
                    {trip.actualPickupTime && (
                      <p className="luxury-text-small text-green-600 dark:text-green-400 mt-2 font-medium">
                        ✓ Picked up at {new Date(trip.actualPickupTime).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="ml-6 border-l-2 border-dashed border-gradient-to-b from-green-300 via-purple-300 to-red-300 h-10 relative">
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gradient-to-r from-purple-400 to-blue-400 animate-pulse"></div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-xs luxury-text-gradient uppercase tracking-wider mb-1">DROPOFF</p>
                    <p className="luxury-text-body font-semibold">{trip.dropoffAddress}</p>
                    {trip.tracking && (
                      <p className="luxury-text-small luxury-text-gradient mt-2 font-semibold">
                        {trip.tracking.distanceToDestination.toFixed(1)} km away • {trip.tracking.estimatedArrival} mins
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            
            {/* Driver Info */}
            {trip.provider && (
              <Card className="luxury-glass-card luxury-shadow-lg luxury-hover-glow sticky top-4 luxury-animate-scale-in luxury-delay-7">
                <CardHeader className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/50 dark:to-pink-900/50">
                  <CardTitle className="luxury-heading-sm">Your Driver</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-20 h-20 ring-4 ring-purple-200 dark:ring-purple-700 ring-offset-2 shadow-xl">
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 text-white text-2xl font-bold">
                        {trip.provider.firstName.charAt(0)}{trip.provider.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="luxury-heading-sm">
                        {trip.provider.firstName} {trip.provider.lastName}
                      </h3>
                      <div className="flex items-center gap-1 mt-2">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold text-lg luxury-text-gradient">{trip.provider.averageRating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="luxury-divider"></div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 luxury-glass-panel p-3 rounded-xl">
                      <Car className="w-5 h-5 luxury-text-gradient" />
                      <span className="luxury-text-body font-semibold">{trip.provider.vehicleType}</span>
                    </div>
                    <div className="flex items-center gap-3 luxury-glass-panel p-3 rounded-xl">
                      <MapPin className="w-5 h-5 luxury-text-gradient" />
                      <span className="luxury-text-body font-semibold capitalize">{trip.provider.vehicleCapacity} capacity</span>
                    </div>
                  </div>

                  <button 
                    className="luxury-btn-primary w-full flex items-center justify-center gap-2"
                    data-testid="button-call-driver"
                  >
                    <Phone className="w-5 h-5" />
                    Call Driver
                  </button>
                </CardContent>
              </Card>
            )}

            {/* Pet Info */}
            <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-scale-in luxury-delay-8">
              <CardHeader>
                <CardTitle className="luxury-heading-sm">Pet Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="luxury-text-small">Name</span>
                  <span className="luxury-text-body font-bold">{trip.petName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="luxury-text-small">Type</span>
                  <span className="luxury-text-body font-bold capitalize">{trip.petType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="luxury-text-small">Size</span>
                  <span className="luxury-text-body font-bold capitalize">{trip.petSize}</span>
                </div>
                <div className="luxury-divider"></div>
                <div className="flex justify-between items-center luxury-glass-panel p-3 rounded-xl">
                  <span className="luxury-text-body font-semibold">Estimated Fare</span>
                  <span className="luxury-heading-sm luxury-text-gradient">
                    ₪{trip.estimatedFare.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center luxury-glass-panel p-3 rounded-xl">
                  <span className="luxury-text-body font-semibold">Est. Duration</span>
                  <span className="luxury-text-body font-bold luxury-text-gradient">{trip.estimatedDuration} mins</span>
                </div>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card className="luxury-glass-card luxury-shadow-md luxury-animate-scale-in luxury-delay-9">
              <CardHeader>
                <CardTitle className="luxury-heading-sm">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <button 
                  className="luxury-btn-secondary w-full flex items-center justify-center gap-2"
                  data-testid="button-contact-support"
                >
                  <Phone className="w-5 h-5" />
                  Contact Support
                </button>
                {trip.status !== 'completed' && trip.status !== 'canceled' && (
                  <button 
                    className="luxury-btn-ghost w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    data-testid="button-cancel-trip"
                  >
                    <AlertCircle className="w-5 h-5" />
                    Cancel Trip
                  </button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
