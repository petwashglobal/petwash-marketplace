import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import {
  Car,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Power,
  Bell,
  Star,
  Package,
  Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';

interface PendingJob {
  dispatchRecord: {
    id: number;
    tripId: number;
    distanceFromPickup: number;
    estimatedArrivalTime: number;
    expiresAt: string;
    dispatchedAt: string;
  };
  trip: {
    tripId: string;
    petName: string;
    petType: string;
    petSize: string;
    pickupAddress: string;
    dropoffAddress: string;
    scheduledPickupTime: string;
    estimatedFare: number;
    driverPayout: number;
    estimatedDuration: number;
    estimatedDistance: number;
    specialInstructions: string | null;
  };
}

interface ProviderStats {
  totalTrips: number;
  completedTrips: number;
  averageRating: number;
  totalEarnings: number;
  isOnline: boolean;
  isAvailable: boolean;
}

export default function PetTrekProviderDashboard() {
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  const [isOnline, setIsOnline] = useState(false);

  // Fetch provider stats
  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; stats: ProviderStats }>({
    queryKey: ['/api/pettrek/provider/stats'],
    enabled: !!user,
    onSuccess: (data) => {
      if (data && data.stats) {
        setIsOnline(data.stats.isOnline);
      }
    },
  });

  // Fetch pending jobs
  const { data: jobsData, isLoading: jobsLoading } = useQuery<{ success: boolean; jobs: PendingJob[] }>({
    queryKey: ['/api/pettrek/provider/jobs'],
    refetchInterval: 3000, // Poll every 3 seconds for new jobs
    enabled: !!user,
  });

  // Fetch active trips
  const { data: activeTripsData, isLoading: activeTripsLoading } = useQuery({
    queryKey: ['/api/pettrek/provider/active-trips'],
    refetchInterval: 5000,
    enabled: !!user,
  });

  // Fetch trip history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/pettrek/provider/trip-history'],
    enabled: !!user,
  });

  const providerStats: ProviderStats = statsData?.stats || {
    totalTrips: 0,
    completedTrips: 0,
    averageRating: 0,
    totalEarnings: 0,
    isOnline: false,
    isAvailable: false,
  };

  // Toggle online status
  const toggleOnline = useMutation({
    mutationFn: async (online: boolean) => {
      // Get real geolocation
      return new Promise((resolve, reject) => {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const result = await apiRequest('/api/pettrek/provider/toggle-online', 'POST', {
                  isOnline: online,
                  location: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                  },
                });
                resolve(result);
              } catch (error) {
                reject(error);
              }
            },
            async (error) => {
              // Fallback if geolocation fails
              try {
                const result = await apiRequest('/api/pettrek/provider/toggle-online', 'POST', {
                  isOnline: online,
                });
                resolve(result);
              } catch (err) {
                reject(err);
              }
            }
          );
        } else {
          // No geolocation support
          apiRequest('/api/pettrek/provider/toggle-online', 'POST', {
            isOnline: online,
          }).then(resolve).catch(reject);
        }
      });
    },
    onSuccess: (_, online) => {
      setIsOnline(online);
      toast({
        title: online ? "You're Online!" : "You're Offline",
        description: online ? 'You will start receiving trip requests' : "You won't receive new trip requests",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pettrek/provider/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pettrek/provider/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Status Update Failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  // Accept trip mutation
  const acceptTrip = useMutation({
    mutationFn: async (dispatchRecordId: number) => {
      return await apiRequest('/api/pettrek/provider/accept-trip', 'POST', {
        dispatchRecordId,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Trip Accepted!',
        description: 'Navigate to the pickup location',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pettrek/provider/jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Accept Failed',
        description: error.message || 'This trip may no longer be available',
        variant: 'destructive',
      });
    },
  });

  // Decline trip mutation
  const declineTrip = useMutation({
    mutationFn: async ({ dispatchRecordId, reason }: { dispatchRecordId: number; reason: string }) => {
      return await apiRequest('/api/pettrek/provider/decline-trip', 'POST', {
        dispatchRecordId,
        reason,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Trip Declined',
        description: 'Looking for more opportunities...',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pettrek/provider/jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Decline Failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleAccept = (job: PendingJob) => {
    acceptTrip.mutate(job.dispatchRecord.id);
  };

  const handleDecline = (job: PendingJob) => {
    declineTrip.mutate({
      dispatchRecordId: job.dispatchRecord.id,
      reason: 'too_far', // Could add a dialog for user to select reason
    });
  };

  const calculateTimeLeft = (expiresAt: string) => {
    const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    return seconds;
  };

  return (
    <div className="min-h-screen luxury-bg-mesh py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 luxury-animate-fade-in">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="luxury-heading-lg luxury-text-gradient">
                Driver Dashboard
              </h1>
              <span className="px-2 py-0.5 text-[8px] tracking-[0.15em] uppercase font-semibold bg-blue-100 text-blue-700 border border-blue-200/60 rounded-sm">
                PetTrek™ Driver
              </span>
            </div>
            <p className="luxury-text-body mt-1">Manage your trips and earnings</p>
          </div>

          {/* Online/Offline Toggle */}
          <Card className="luxury-glass-card luxury-shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-3 h-3 rounded-full animate-pulse",
                  isOnline ? "bg-green-500" : "bg-gray-400"
                )} />
                <Label htmlFor="online-toggle" className="font-semibold cursor-pointer">
                  {isOnline ? 'Online' : 'Offline'}
                </Label>
                <Switch
                  id="online-toggle"
                  data-testid="switch-online-status"
                  checked={isOnline}
                  onCheckedChange={(checked) => toggleOnline.mutate(checked)}
                  disabled={toggleOnline.isPending}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Grid */}
        <div className="luxury-grid-4 mb-8">
          <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-1">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small mb-1">Total Earnings</p>
                  <p className="luxury-heading-lg luxury-text-gradient">
                    ₪{providerStats.totalEarnings.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small mb-1">Completed Trips</p>
                  <p className="text-3xl font-bold luxury-text-gradient">
                    {providerStats.completedTrips}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-3">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small mb-1">Average Rating</p>
                  <div className="flex items-center gap-1">
                    <p className="text-3xl font-bold luxury-text-gradient">
                      {providerStats.averageRating.toFixed(1)}
                    </p>
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <Star className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in luxury-delay-4">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luxury-text-small mb-1">Total Trips</p>
                  <p className="text-3xl font-bold luxury-text-gradient">
                    {providerStats.totalTrips}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                  <Car className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Tabs */}
        <Tabs defaultValue="jobs" className="space-y-6 luxury-animate-fade-in luxury-delay-5">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto h-12 luxury-glass-card">
            <TabsTrigger value="jobs" className="flex items-center gap-2" data-testid="tab-jobs">
              <Bell className="w-4 h-4" />
              Pending Jobs
              {jobsData && jobsData.jobs.length > 0 && (
                <Badge className="ml-1 px-1.5 py-0 text-xs h-5 min-w-5 bg-gradient-to-r from-red-500 to-pink-600 border-0 text-white">
                  {jobsData.jobs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2" data-testid="tab-active">
              <Car className="w-4 h-4" />
              Active Trips
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2" data-testid="tab-history">
              <Package className="w-4 h-4" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Pending Jobs Tab */}
          <TabsContent value="jobs">
            <div className="space-y-4">
              {!isOnline && (
                <Card className="luxury-glass-card luxury-shadow-md bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                        <Power className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-yellow-900 dark:text-yellow-100">{"You're Offline"}</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">Turn on availability to receive trip requests</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {jobsLoading ? (
                <Card className="luxury-glass-card luxury-shadow-lg">
                  <CardContent className="p-12 text-center">
                    <div className="luxury-spinner mx-auto mb-4"></div>
                    <p className="luxury-text-body">Loading jobs...</p>
                  </CardContent>
                </Card>
              ) : jobsData && jobsData.jobs.length > 0 ? (
                jobsData.jobs.map((job, index) => (
                  <Card 
                    key={job.dispatchRecord.id} 
                    className={cn(
                      "luxury-glass-minimal luxury-hover-lift luxury-shadow-lg luxury-animate-slide-up",
                      `luxury-delay-${Math.min(index + 1, 10)}`
                    )}
                    data-testid={`job-card-${job.dispatchRecord.id}`}
                  >
                    <CardHeader className="bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-900/30 dark:to-blue-900/30">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="luxury-heading-sm">Transport {job.trip.petName}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <span className="luxury-badge capitalize">
                              {job.trip.petType}
                            </span>
                            <span className="luxury-badge luxury-badge-success capitalize">
                              {job.trip.petSize}
                            </span>
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold luxury-text-gradient">
                            ₪{parseFloat(job.trip.driverPayout.toString()).toFixed(2)}
                          </p>
                          <p className="luxury-text-small">Driver Payout (80%)</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-6 space-y-4">
                      
                      {/* Route */}
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">PICKUP</p>
                            <p className="font-medium text-sm">{job.trip.pickupAddress}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              {job.dispatchRecord.distanceFromPickup.toFixed(1)} km away • {job.dispatchRecord.estimatedArrivalTime} mins
                            </p>
                          </div>
                        </div>

                        <div className="ml-4 border-l-2 border-dashed border-gray-300 dark:border-gray-600 h-6"></div>

                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">DROPOFF</p>
                            <p className="font-medium text-sm">{job.trip.dropoffAddress}</p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Trip Details */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <Clock className="w-5 h-5 mx-auto text-gray-500 mb-1" />
                          <p className="font-semibold">{job.trip.estimatedDuration} min</p>
                          <p className="text-xs text-gray-500">Duration</p>
                        </div>
                        <div className="text-center">
                          <MapPin className="w-5 h-5 mx-auto text-gray-500 mb-1" />
                          <p className="font-semibold">{parseFloat(job.trip.estimatedDistance.toString()).toFixed(1)} km</p>
                          <p className="text-xs text-gray-500">Distance</p>
                        </div>
                        <div className="text-center">
                          <Timer className="w-5 h-5 mx-auto text-gray-500 mb-1" />
                          <p className="font-semibold">{calculateTimeLeft(job.dispatchRecord.expiresAt)}s</p>
                          <p className="text-xs text-gray-500">Expires</p>
                        </div>
                      </div>

                      {job.trip.specialInstructions && (
                        <>
                          <Separator />
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">Special Instructions</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">{job.trip.specialInstructions}</p>
                          </div>
                        </>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => handleAccept(job)}
                          disabled={acceptTrip.isPending}
                          data-testid={`button-accept-${job.dispatchRecord.id}`}
                          className="luxury-btn-primary flex-1 h-12"
                        >
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          {acceptTrip.isPending ? 'Accepting...' : 'Accept Trip'}
                        </button>
                        <button
                          onClick={() => handleDecline(job)}
                          disabled={declineTrip.isPending}
                          data-testid={`button-decline-${job.dispatchRecord.id}`}
                          className="flex-1 h-12 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-semibold hover:from-red-700 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                        >
                          <XCircle className="w-5 h-5 mr-2 inline" />
                          {declineTrip.isPending ? 'Declining...' : 'Decline'}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="luxury-glass-card luxury-shadow-lg">
                  <CardContent className="p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center mx-auto mb-4">
                      <Bell className="w-10 h-10 text-purple-400 dark:text-purple-500" />
                    </div>
                    <h3 className="luxury-heading-sm mb-2">No Pending Jobs</h3>
                    <p className="luxury-text-body">
                      {isOnline ? 'New trip requests will appear here' : 'Go online to receive trip requests'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Active Trips Tab */}
          <TabsContent value="active">
            {activeTripsLoading ? (
              <Card className="luxury-glass-card luxury-shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="luxury-spinner mx-auto mb-4"></div>
                  <p className="luxury-text-body">Loading active trips...</p>
                </CardContent>
              </Card>
            ) : activeTripsData && activeTripsData.trips?.length > 0 ? (
              <div className="space-y-4">
                {activeTripsData.trips.map((trip: any, index: number) => (
                  <Card key={trip.id} className={cn(
                    "luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-fade-in",
                    `luxury-delay-${Math.min(index + 1, 10)}`
                  )}>
                    <CardHeader>
                      <CardTitle className="luxury-heading-sm">Trip {trip.tripId}</CardTitle>
                      <CardDescription className="capitalize">
                        <span className="luxury-badge luxury-badge-success">{trip.status}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="luxury-text-body">Pet: {trip.petName} ({trip.petType})</p>
                      <p className="luxury-text-small">From: {trip.pickupAddress}</p>
                      <p className="luxury-text-small">To: {trip.dropoffAddress}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="luxury-glass-card luxury-shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                    <Car className="w-10 h-10 text-blue-400 dark:text-blue-500" />
                  </div>
                  <h3 className="luxury-heading-sm mb-2">No Active Trips</h3>
                  <p className="luxury-text-body">
                    Your active trips will appear here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            {historyLoading ? (
              <Card className="luxury-glass-card luxury-shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="luxury-spinner mx-auto mb-4"></div>
                  <p className="luxury-text-body">Loading history...</p>
                </CardContent>
              </Card>
            ) : historyData && historyData.trips?.length > 0 ? (
              <div className="space-y-4">
                {historyData.trips.map((trip: any, index: number) => (
                  <Card key={trip.id} className={cn(
                    "luxury-glass-card luxury-shadow-lg luxury-hover-lift luxury-animate-fade-in",
                    `luxury-delay-${Math.min(index + 1, 10)}`
                  )}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="luxury-heading-sm">Trip {trip.tripId}</CardTitle>
                          <CardDescription className="luxury-text-small">
                            {new Date(trip.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <span className={cn(
                          "luxury-badge",
                          trip.status === 'completed' ? "luxury-badge-success" : "luxury-badge"
                        )}>
                          {trip.status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="luxury-text-body">Pet: {trip.petName} ({trip.petType})</p>
                      <p className="text-lg font-bold luxury-text-gradient mt-2">
                        Earnings: ₪{parseFloat(trip.driverPayout || 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="luxury-glass-card luxury-shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center mx-auto mb-4">
                    <Package className="w-10 h-10 text-purple-400 dark:text-purple-500" />
                  </div>
                  <h3 className="luxury-heading-sm mb-2">Trip History</h3>
                  <p className="luxury-text-body">
                    Your completed trips will appear here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
