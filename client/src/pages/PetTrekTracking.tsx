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
      requested: { color: 'bg-blue-500', text: 'Searching for Driver', icon: Loader2 },
      dispatched: { color: 'bg-yellow-500', text: 'Driver Notified', icon: AlertCircle },
      accepted: { color: 'bg-green-500', text: 'Driver Accepted', icon: CheckCircle2 },
      in_progress: { color: 'bg-purple-500', text: 'En Route', icon: Car },
      completed: { color: 'bg-emerald-500', text: 'Completed', icon: CheckCircle2 },
      canceled: { color: 'bg-red-500', text: 'Canceled', icon: AlertCircle },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.requested;
    const Icon = config.icon;
    
    return (
      <Badge className={cn('text-white', config.color)}>
        <Icon className="w-3 h-3 mr-1 animate-pulse" />
        {config.text}
      </Badge>
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Trip Not Found
            </CardTitle>
            <CardDescription>Unable to load trip details</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/dashboard')} data-testid="button-back-to-dashboard">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                Track {trip.petName}'s Journey
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Trip ID: {trip.tripId}</p>
            </div>
            {getStatusBadge(trip.status)}
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={calculateProgress(trip.status)} className="h-3" data-testid="progress-trip-status" />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Requested</span>
              <span>Dispatched</span>
              <span>Accepted</span>
              <span>En Route</span>
              <span>Completed</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Main Content - Live Activity Card */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Live Activity Card - Apple-inspired */}
            {trip.status === 'in_progress' && trip.tracking && (
              <Card className="border-2 border-purple-200 dark:border-purple-800 shadow-2xl overflow-hidden animate-in slide-in-from-top duration-500">
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
            <Card className="border-2 border-blue-100 dark:border-blue-900 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-blue-600" />
                  Live Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl flex items-center justify-center border-2 border-dashed border-blue-300 dark:border-blue-700">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Real-time GPS Map</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
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
            <Card className="border-2 border-green-100 dark:border-green-900 shadow-xl">
              <CardHeader>
                <CardTitle>Route Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-1">PICKUP</p>
                    <p className="font-medium">{trip.pickupAddress}</p>
                    {trip.actualPickupTime && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        ✓ Picked up at {new Date(trip.actualPickupTime).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="ml-5 border-l-2 border-dashed border-gray-300 dark:border-gray-600 h-8"></div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-500 dark:text-gray-400 mb-1">DROPOFF</p>
                    <p className="font-medium">{trip.dropoffAddress}</p>
                    {trip.tracking && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
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
              <Card className="border-2 border-purple-100 dark:border-purple-900 shadow-xl sticky top-4">
                <CardHeader className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/50 dark:to-pink-900/50">
                  <CardTitle>Your Driver</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 ring-2 ring-purple-200 dark:ring-purple-700">
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xl">
                        {trip.provider.firstName.charAt(0)}{trip.provider.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">
                        {trip.provider.firstName} {trip.provider.lastName}
                      </h3>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{trip.provider.averageRating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{trip.provider.vehicleType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="capitalize">{trip.provider.vehicleCapacity} capacity</span>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full h-12 rounded-xl border-2"
                    data-testid="button-call-driver"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call Driver
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Pet Info */}
            <Card className="border-2 border-blue-100 dark:border-blue-900 shadow-xl">
              <CardHeader>
                <CardTitle>Pet Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Name</span>
                  <span className="font-semibold">{trip.petName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Type</span>
                  <span className="font-semibold capitalize">{trip.petType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Size</span>
                  <span className="font-semibold capitalize">{trip.petSize}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Estimated Fare</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    ₪{trip.estimatedFare.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Est. Duration</span>
                  <span className="font-semibold">{trip.estimatedDuration} mins</span>
                </div>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card className="border-2 border-gray-100 dark:border-gray-800 shadow-lg">
              <CardHeader>
                <CardTitle className="text-base">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-contact-support"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Contact Support
                </Button>
                {trip.status !== 'completed' && trip.status !== 'canceled' && (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                    data-testid="button-cancel-trip"
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Cancel Trip
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
