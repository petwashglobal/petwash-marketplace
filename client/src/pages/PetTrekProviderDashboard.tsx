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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
              Driver Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your trips and earnings</p>
          </div>

          {/* Online/Offline Toggle */}
          <Card className="border-2 shadow-lg">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-2 border-green-100 dark:border-green-900 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Earnings</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ₪{providerStats.totalEarnings.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-100 dark:border-blue-900 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Completed Trips</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {providerStats.completedTrips}
                  </p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-yellow-100 dark:border-yellow-900 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Rating</p>
                  <div className="flex items-center gap-1">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {providerStats.averageRating.toFixed(1)}
                    </p>
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  </div>
                </div>
                <Star className="w-10 h-10 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-100 dark:border-purple-900 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Trips</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {providerStats.totalTrips}
                  </p>
                </div>
                <Car className="w-10 h-10 text-purple-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Tabs */}
        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto h-12 bg-white dark:bg-gray-800 border-2">
            <TabsTrigger value="jobs" className="flex items-center gap-2" data-testid="tab-jobs">
              <Bell className="w-4 h-4" />
              Pending Jobs
              {jobsData && jobsData.jobs.length > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs h-5 min-w-5">
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
                <Card className="border-2 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <Power className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      <div>
                        <p className="font-semibold text-yellow-900 dark:text-yellow-100">{"You're Offline"}</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">Turn on availability to receive trip requests</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {jobsLoading ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading jobs...</p>
                  </CardContent>
                </Card>
              ) : jobsData && jobsData.jobs.length > 0 ? (
                jobsData.jobs.map((job) => (
                  <Card 
                    key={job.dispatchRecord.id} 
                    className="border-2 border-purple-200 dark:border-purple-800 shadow-xl hover:shadow-2xl transition-all duration-300 animate-in slide-in-from-right"
                    data-testid={`job-card-${job.dispatchRecord.id}`}
                  >
                    <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/50 dark:to-blue-900/50">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl">Transport {job.trip.petName}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="capitalize">
                              {job.trip.petType}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {job.trip.petSize}
                            </Badge>
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            ₪{parseFloat(job.trip.driverPayout.toString()).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">Driver Payout (80%)</p>
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
                        <Button
                          onClick={() => handleAccept(job)}
                          disabled={acceptTrip.isPending}
                          data-testid={`button-accept-${job.dispatchRecord.id}`}
                          className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
                        >
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          {acceptTrip.isPending ? 'Accepting...' : 'Accept Trip'}
                        </Button>
                        <Button
                          onClick={() => handleDecline(job)}
                          disabled={declineTrip.isPending}
                          data-testid={`button-decline-${job.dispatchRecord.id}`}
                          variant="outline"
                          className="flex-1 h-12 border-2 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <XCircle className="w-5 h-5 mr-2" />
                          {declineTrip.isPending ? 'Declining...' : 'Decline'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Bell className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Pending Jobs</h3>
                    <p className="text-gray-600 dark:text-gray-400">
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
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading active trips...</p>
                </CardContent>
              </Card>
            ) : activeTripsData && activeTripsData.trips?.length > 0 ? (
              <div className="space-y-4">
                {activeTripsData.trips.map((trip: any) => (
                  <Card key={trip.id} className="border-2 shadow-lg">
                    <CardHeader>
                      <CardTitle>Trip {trip.tripId}</CardTitle>
                      <CardDescription className="capitalize">{trip.status}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">Pet: {trip.petName} ({trip.petType})</p>
                      <p className="text-sm">From: {trip.pickupAddress}</p>
                      <p className="text-sm">To: {trip.dropoffAddress}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Car className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Active Trips</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your active trips will appear here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            {historyLoading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading history...</p>
                </CardContent>
              </Card>
            ) : historyData && historyData.trips?.length > 0 ? (
              <div className="space-y-4">
                {historyData.trips.map((trip: any) => (
                  <Card key={trip.id} className="border-2 shadow-lg">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>Trip {trip.tripId}</CardTitle>
                          <CardDescription>{new Date(trip.createdAt).toLocaleDateString()}</CardDescription>
                        </div>
                        <Badge className={trip.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}>
                          {trip.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">Pet: {trip.petName} ({trip.petType})</p>
                      <p className="text-sm">Earnings: ₪{parseFloat(trip.driverPayout || 0).toFixed(2)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Trip History</h3>
                  <p className="text-gray-600 dark:text-gray-400">
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
