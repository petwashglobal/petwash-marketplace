import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Car,
  DollarSign,
  MapPin,
  Clock,
  Navigation,
  Star,
  TrendingUp,
  Phone,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Route,
  Bell
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { t as ti18n } from '@/lib/i18n';
import { format } from 'date-fns';

interface TripRequest {
  id: string;
  customerName: string;
  customerPhoto: string | null;
  customerPhone: string;
  petName: string;
  petType: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  scheduledTime: string;
  estimatedDuration: number; // minutes
  distance: number; // km
  fare: number;
  driverEarnings: number;
  currency: string;
  status: 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  vehicleType: 'sedan' | 'suv' | 'van';
  specialRequirements: string | null;
}

interface DriverStats {
  todayEarnings: number;
  todayTrips: number;
  weeklyEarnings: number;
  weeklyTrips: number;
  totalEarnings: number;
  totalTrips: number;
  rating: number;
  totalReviews: number;
  acceptanceRate: number;
  completionRate: number;
  currency: string;
}

export default function DriverDashboard() {
  const { language } = useLanguage();
  const t = (key: string) => ti18n(key, language);
  const [activeTab, setActiveTab] = useState('requests');
  const [isOnline, setIsOnline] = useState(false);

  // Fetch trip requests
  const { data: requests = [] } = useQuery<TripRequest[]>({
    queryKey: ['/api/pettrek/driver/requests'],
    enabled: isOnline,
  });

  // Fetch driver stats
  const { data: stats } = useQuery<DriverStats>({
    queryKey: ['/api/pettrek/driver/stats'],
  });

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const activeTrips = requests.filter(r => 
    r.status === 'accepted' || r.status === 'arrived' || r.status === 'in_progress'
  );
  const completedTrips = requests.filter(r => r.status === 'completed');

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', label: 'New Request' },
      accepted: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', label: 'Accepted' },
      arrived: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400', label: 'Arrived' },
      in_progress: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', label: 'In Transit' },
      completed: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400', label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', label: 'Cancelled' },
    };
    const { color, label } = variants[status] || variants.pending;
    return <Badge className={color}>{label}</Badge>;
  };

  const getVehicleIcon = (type: string) => {
    return <Car className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/20">
      {/* Hero Header - Uber Style */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ 
                background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(255,215,0,0.5)'
              }}>
                🚗 PetTrek Driver
              </h1>
              <p className="text-lg text-blue-100">Premium pet transport service</p>
            </div>
            
            {/* Online Toggle */}
            <div className="flex items-center gap-4">
              <div className="text-right mr-4">
                <p className="text-sm text-blue-100">Status</p>
                <p className="text-xl font-bold">{isOnline ? '🟢 Online' : '🔴 Offline'}</p>
              </div>
              <Button 
                size="lg" 
                className={`${
                  isOnline 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                } text-lg px-8 py-6 shadow-2xl`}
                onClick={() => setIsOnline(!isOnline)}
                data-testid="button-toggle-online"
              >
                {isOnline ? 'Go Offline' : 'Go Online'}
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-8">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-blue-100 mb-1">Today</p>
                <p className="text-2xl font-bold text-white">
                  {stats?.todayTrips || 0} trips
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-blue-100 mb-1">Today's $</p>
                <p className="text-2xl font-bold text-white">₪{stats?.todayEarnings.toFixed(0) || '0'}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-blue-100 mb-1">This Week</p>
                <p className="text-2xl font-bold text-white">
                  {stats?.weeklyTrips || 0} trips
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-blue-100 mb-1">Weekly $</p>
                <p className="text-2xl font-bold text-white">₪{stats?.weeklyEarnings.toFixed(0) || '0'}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-blue-100 mb-1">Rating</p>
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <p className="text-2xl font-bold text-white">{stats?.rating.toFixed(1) || '5.0'}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-blue-100 mb-1">Completion</p>
                <p className="text-2xl font-bold text-white">{stats?.completionRate || 100}%</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* New Request Alert */}
      {pendingRequests.length > 0 && isOnline && (
        <div className="container mx-auto px-4 -mt-6 mb-6">
          <Card className="border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 shadow-2xl animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-yellow-600 p-4 rounded-full">
                  <Bell className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-400">
                    🔔 {pendingRequests.length} New Trip {pendingRequests.length === 1 ? 'Request' : 'Requests'}
                  </h3>
                  <p className="text-yellow-700 dark:text-yellow-500">
                    Review and accept trip requests below
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {!isOnline ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Car className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">You're Offline</h3>
              <p className="text-gray-500 mb-6">Go online to start receiving trip requests</p>
              <Button 
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setIsOnline(true)}
                data-testid="button-go-online"
              >
                Go Online
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid bg-white dark:bg-gray-800 shadow-lg">
              <TabsTrigger value="requests" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Bell className="w-4 h-4 mr-2" />
                Requests ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Navigation className="w-4 h-4 mr-2" />
                Active ({activeTrips.length})
              </TabsTrigger>
              <TabsTrigger value="earnings" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <DollarSign className="w-4 h-4 mr-2" />
                Earnings
              </TabsTrigger>
            </TabsList>

            {/* Requests Tab */}
            <TabsContent value="requests" className="space-y-4">
              {pendingRequests.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No new requests</h3>
                    <p className="text-gray-500">New trip requests will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                pendingRequests.map((request) => (
                  <Card key={request.id} className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 hover:shadow-2xl transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Customer Info */}
                        <div className="flex gap-4">
                          <Avatar className="w-20 h-20">
                            <AvatarImage src={request.customerPhoto || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white text-2xl">
                              {request.customerName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="text-xl font-bold">{request.customerName}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {request.petName} • {request.petType}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {getVehicleIcon(request.vehicleType)}
                              <span className="text-sm capitalize">{request.vehicleType}</span>
                            </div>
                          </div>
                        </div>

                        {/* Trip Details */}
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-blue-600" />
                              <span className="font-semibold">{format(new Date(request.scheduledTime), 'h:mm a')}</span>
                              <span className="text-gray-500">({request.estimatedDuration} min)</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Route className="w-4 h-4 text-blue-600" />
                              <span>{request.distance.toFixed(1)} km</span>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-gray-700 dark:text-gray-300">Pickup</p>
                                <p className="text-gray-600 dark:text-gray-400">{request.pickupAddress}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-gray-700 dark:text-gray-300">Dropoff</p>
                                <p className="text-gray-600 dark:text-gray-400">{request.dropoffAddress}</p>
                              </div>
                            </div>
                          </div>

                          {request.specialRequirements && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-1">
                                ℹ️ Special Requirements
                              </p>
                              <p className="text-sm text-amber-700 dark:text-amber-500">
                                {request.specialRequirements}
                              </p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <Button 
                              className="bg-green-600 hover:bg-green-700 flex-1"
                              data-testid={`button-accept-trip-${request.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Accept Trip
                            </Button>
                            <Button 
                              variant="outline"
                              className="flex-1"
                              data-testid={`button-decline-trip-${request.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Decline
                            </Button>
                          </div>

                          {/* Earnings */}
                          <div className="flex items-center justify-between pt-2 border-t">
                            <div>
                              <p className="text-sm text-gray-500">You'll earn</p>
                              <p className="text-xs text-gray-400">Total fare: ₪{request.fare.toFixed(2)}</p>
                            </div>
                            <span className="text-3xl font-bold text-blue-600">₪{request.driverEarnings.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Active Trips Tab */}
            <TabsContent value="active" className="space-y-4">
              {activeTrips.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Navigation className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No active trips</h3>
                    <p className="text-gray-500">Accept a trip request to get started</p>
                  </CardContent>
                </Card>
              ) : (
                activeTrips.map((trip) => (
                  <Card key={trip.id} className="border-green-200 bg-green-50 dark:bg-green-900/10">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        <Avatar className="w-16 h-16">
                          <AvatarImage src={trip.customerPhoto || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white text-xl">
                            {trip.customerName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-xl font-bold">{trip.customerName}</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {trip.petName} • {trip.petType}
                              </p>
                            </div>
                            {getStatusBadge(trip.status)}
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-green-600 mt-1" />
                              <div>
                                <p className="font-medium">Pickup</p>
                                <p className="text-gray-600 dark:text-gray-400">{trip.pickupAddress}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-red-600 mt-1" />
                              <div>
                                <p className="font-medium">Dropoff</p>
                                <p className="text-gray-600 dark:text-gray-400">{trip.dropoffAddress}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button 
                              className="bg-blue-600 hover:bg-blue-700 flex-1"
                              data-testid={`button-navigate-trip-${trip.id}`}
                            >
                              <Navigation className="w-4 h-4 mr-2" />
                              Navigate
                            </Button>
                            <Button 
                              variant="outline"
                              data-testid={`button-call-customer-${trip.id}`}
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline"
                              data-testid={`button-message-customer-${trip.id}`}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          </div>

                          {trip.status === 'in_progress' && (
                            <Button 
                              className="w-full bg-green-600 hover:bg-green-700"
                              size="lg"
                              data-testid={`button-complete-trip-${trip.id}`}
                            >
                              <CheckCircle2 className="w-5 h-5 mr-2" />
                              Complete Trip
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Earnings Tab */}
            <TabsContent value="earnings">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Earnings Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Today</p>
                        <p className="text-4xl font-bold text-blue-600">₪{stats?.todayEarnings.toFixed(2) || '0.00'}</p>
                        <p className="text-sm text-gray-500 mt-1">{stats?.todayTrips || 0} trips</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">This Week</p>
                        <p className="text-4xl font-bold text-blue-600">₪{stats?.weeklyEarnings.toFixed(2) || '0.00'}</p>
                        <p className="text-sm text-gray-500 mt-1">{stats?.weeklyTrips || 0} trips</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">All Time</p>
                        <p className="text-4xl font-bold text-blue-600">₪{stats?.totalEarnings.toFixed(2) || '0.00'}</p>
                        <p className="text-sm text-gray-500 mt-1">{stats?.totalTrips || 0} trips</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-3xl font-bold text-blue-600">{stats?.rating.toFixed(1) || '5.0'}</p>
                        <p className="text-sm text-gray-500 mt-1">Rating ({stats?.totalReviews || 0} reviews)</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-3xl font-bold text-green-600">{stats?.acceptanceRate || 100}%</p>
                        <p className="text-sm text-gray-500 mt-1">Acceptance Rate</p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <p className="text-3xl font-bold text-purple-600">{stats?.completionRate || 100}%</p>
                        <p className="text-sm text-gray-500 mt-1">Completion Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
