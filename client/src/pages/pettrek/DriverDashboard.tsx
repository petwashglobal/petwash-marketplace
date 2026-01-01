import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
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
    <div className="min-h-screen luxury-bg-mesh">
      {/* Hero Header - Luxury Style */}
      <div className="luxury-bg-primary text-white py-10">
        <div className="luxury-container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 luxury-animate-fade-in">
            <div>
              <h1 className="luxury-heading-xl mb-2" style={{ 
                background: 'linear-gradient(135deg, #FFFFFF, #CCCCCC, #FFFFFF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(255,215,0,0.5)'
              }}>
                🚗 PetTrek Driver
              </h1>
              <p className="text-lg text-blue-100 luxury-text-body">Premium pet transport service</p>
            </div>
            
            {/* Online Toggle */}
            <div className="flex items-center gap-4 luxury-animate-fade-in luxury-delay-1">
              <div className="text-right mr-4">
                <p className="luxury-text-small text-blue-100">Status</p>
                <p className="text-xl font-bold">{isOnline ? '🟢 Online' : '🔴 Offline'}</p>
              </div>
              <button 
                className={`${
                  isOnline 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                } luxury-btn-primary text-lg px-8 py-3`}
                onClick={() => setIsOnline(!isOnline)}
                data-testid="button-toggle-online"
              >
                {isOnline ? 'Go Offline' : 'Go Online'}
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-8">
            <div className="luxury-glass-minimal p-4 luxury-animate-scale-in luxury-delay-1">
              <p className="luxury-text-small text-blue-100 mb-1">Today</p>
              <p className="text-2xl font-bold text-white">
                {stats?.todayTrips || 0} trips
              </p>
            </div>

            <div className="luxury-glass-minimal p-4 luxury-animate-scale-in luxury-delay-2">
              <p className="luxury-text-small text-blue-100 mb-1">Today's $</p>
              <p className="text-2xl font-bold text-white">₪{stats?.todayEarnings.toFixed(0) || '0'}</p>
            </div>

            <div className="luxury-glass-minimal p-4 luxury-animate-scale-in luxury-delay-3">
              <p className="luxury-text-small text-blue-100 mb-1">This Week</p>
              <p className="text-2xl font-bold text-white">
                {stats?.weeklyTrips || 0} trips
              </p>
            </div>

            <div className="luxury-glass-minimal p-4 luxury-animate-scale-in luxury-delay-4">
              <p className="luxury-text-small text-blue-100 mb-1">Weekly $</p>
              <p className="text-2xl font-bold text-white">₪{stats?.weeklyEarnings.toFixed(0) || '0'}</p>
            </div>

            <div className="luxury-glass-minimal p-4 luxury-animate-scale-in luxury-delay-5">
              <p className="luxury-text-small text-blue-100 mb-1">Rating</p>
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <p className="text-2xl font-bold text-white">{stats?.rating.toFixed(1) || '5.0'}</p>
              </div>
            </div>

            <div className="luxury-glass-minimal p-4 luxury-animate-scale-in luxury-delay-5">
              <p className="luxury-text-small text-blue-100 mb-1">Completion</p>
              <p className="text-2xl font-bold text-white">{stats?.completionRate || 100}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* New Request Alert */}
      {pendingRequests.length > 0 && isOnline && (
        <div className="luxury-container -mt-6 mb-6 luxury-animate-slide-up">
          <div className="luxury-glass-card luxury-shadow-xl border-2 border-yellow-400 animate-pulse">
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-yellow-500 to-amber-600 p-4 rounded-full luxury-shadow-lg">
                  <Bell className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="luxury-heading-sm text-yellow-800 dark:text-yellow-400">
                    🔔 {pendingRequests.length} New Trip {pendingRequests.length === 1 ? 'Request' : 'Requests'}
                  </h3>
                  <p className="luxury-text-small text-yellow-700 dark:text-yellow-500">
                    Review and accept trip requests below
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="luxury-container luxury-section-compact">
        {!isOnline ? (
          <div className="luxury-glass-card luxury-shadow-xl luxury-animate-scale-in">
            <div className="p-12 text-center">
              <Car className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h3 className="luxury-heading-md mb-2">You're Offline</h3>
              <p className="luxury-text-body text-gray-500 mb-6">Go online to start receiving trip requests</p>
              <button 
                className="luxury-btn-primary"
                onClick={() => setIsOnline(true)}
                data-testid="button-go-online"
              >
                Go Online
              </button>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid luxury-glass-card luxury-shadow-lg">
              <TabsTrigger value="requests" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white">
                <Bell className="w-4 h-4 mr-2" />
                Requests ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white">
                <Navigation className="w-4 h-4 mr-2" />
                Active ({activeTrips.length})
              </TabsTrigger>
              <TabsTrigger value="earnings" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white">
                <DollarSign className="w-4 h-4 mr-2" />
                Earnings
              </TabsTrigger>
            </TabsList>

            {/* Requests Tab */}
            <TabsContent value="requests" className="space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in">
                  <div className="p-12 text-center">
                    <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="luxury-heading-md mb-2">No new requests</h3>
                    <p className="luxury-text-body text-gray-500">New trip requests will appear here</p>
                  </div>
                </div>
              ) : (
                pendingRequests.map((request, idx) => (
                  <div key={request.id} className={`luxury-glass-minimal luxury-hover-lift border-2 border-yellow-200 p-6 luxury-animate-slide-up luxury-delay-${Math.min(idx + 1, 5)}`}>
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
                          <h3 className="luxury-heading-sm">{request.customerName}</h3>
                          <p className="luxury-text-small text-gray-600 dark:text-gray-400">
                            {request.petName} • {request.petType}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {getVehicleIcon(request.vehicleType)}
                            <span className="luxury-text-small capitalize">{request.vehicleType}</span>
                          </div>
                        </div>
                      </div>

                      {/* Trip Details */}
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2 luxury-text-small">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold">{format(new Date(request.scheduledTime), 'h:mm a')}</span>
                            <span className="text-gray-500">({request.estimatedDuration} min)</span>
                          </div>
                          <div className="flex items-center gap-2 luxury-text-small">
                            <Route className="w-4 h-4 text-blue-600" />
                            <span>{request.distance.toFixed(1)} km</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                            <div>
                              <p className="luxury-heading-sm text-xs">Pickup</p>
                              <p className="luxury-text-small">{request.pickupAddress}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                            <div>
                              <p className="luxury-heading-sm text-xs">Dropoff</p>
                              <p className="luxury-text-small">{request.dropoffAddress}</p>
                            </div>
                          </div>
                        </div>

                        {request.specialRequirements && (
                          <div className="luxury-glass-panel border-l-4 border-amber-500 p-3">
                            <p className="luxury-text-small font-semibold text-amber-800 dark:text-amber-400 mb-1">
                              ℹ️ Special Requirements
                            </p>
                            <p className="luxury-text-small text-amber-700 dark:text-amber-500">
                              {request.specialRequirements}
                            </p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          <button 
                            className="luxury-btn-primary flex-1"
                            data-testid={`button-accept-trip-${request.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2 inline" />
                            Accept Trip
                          </button>
                          <button 
                            className="luxury-btn-secondary flex-1"
                            data-testid={`button-decline-trip-${request.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-2 inline" />
                            Decline
                          </button>
                        </div>

                        {/* Earnings */}
                        <div className="flex items-center justify-between pt-2 luxury-divider">
                          <div>
                            <p className="luxury-text-small text-gray-500">You'll earn</p>
                            <p className="text-xs text-gray-400">Total fare: ₪{request.fare.toFixed(2)}</p>
                          </div>
                          <span className="luxury-heading-lg luxury-text-gradient">₪{request.driverEarnings.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Active Trips Tab */}
            <TabsContent value="active" className="space-y-4">
              {activeTrips.length === 0 ? (
                <div className="luxury-glass-card luxury-shadow-lg luxury-animate-fade-in">
                  <div className="p-12 text-center">
                    <Navigation className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="luxury-heading-md mb-2">No active trips</h3>
                    <p className="luxury-text-body text-gray-500">Accept a trip request to get started</p>
                  </div>
                </div>
              ) : (
                activeTrips.map((trip, idx) => (
                  <div key={trip.id} className={`luxury-glass-card luxury-shadow-lg luxury-hover-lift border-2 border-green-200 p-6 luxury-animate-slide-up luxury-delay-${Math.min(idx + 1, 5)}`}>
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
                            <h3 className="luxury-heading-sm">{trip.customerName}</h3>
                            <p className="luxury-text-small text-gray-600 dark:text-gray-400">
                              {trip.petName} • {trip.petType}
                            </p>
                          </div>
                          <span className="luxury-badge luxury-badge-success">
                            {trip.status === 'accepted' && 'Accepted'}
                            {trip.status === 'arrived' && 'Arrived'}
                            {trip.status === 'in_progress' && 'In Transit'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-green-600 mt-1" />
                            <div>
                              <p className="luxury-heading-sm text-xs">Pickup</p>
                              <p className="luxury-text-small">{trip.pickupAddress}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-red-600 mt-1" />
                            <div>
                              <p className="luxury-heading-sm text-xs">Dropoff</p>
                              <p className="luxury-text-small">{trip.dropoffAddress}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button 
                            className="luxury-btn-primary flex-1"
                            data-testid={`button-navigate-trip-${trip.id}`}
                          >
                            <Navigation className="w-4 h-4 mr-2 inline" />
                            Navigate
                          </button>
                          <button 
                            className="luxury-btn-ghost px-4"
                            data-testid={`button-call-customer-${trip.id}`}
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          <button 
                            className="luxury-btn-ghost px-4"
                            data-testid={`button-message-customer-${trip.id}`}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        </div>

                        {trip.status === 'in_progress' && (
                          <button 
                            className="w-full luxury-btn-secondary py-3"
                            data-testid={`button-complete-trip-${trip.id}`}
                          >
                            <CheckCircle2 className="w-5 h-5 mr-2 inline" />
                            Complete Trip
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Earnings Tab */}
            <TabsContent value="earnings">
              <div className="space-y-6">
                <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-fade-in">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-10 h-10 rounded-full luxury-bg-primary flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="luxury-heading-md">Earnings Overview</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="luxury-glass-minimal p-6 luxury-hover-lift">
                      <p className="luxury-text-small text-gray-500 mb-2">Today</p>
                      <p className="luxury-heading-lg luxury-text-gradient mb-1">₪{stats?.todayEarnings.toFixed(2) || '0.00'}</p>
                      <p className="luxury-text-small text-gray-500">{stats?.todayTrips || 0} trips</p>
                    </div>
                    <div className="luxury-glass-minimal p-6 luxury-hover-lift">
                      <p className="luxury-text-small text-gray-500 mb-2">This Week</p>
                      <p className="luxury-heading-lg luxury-text-gradient mb-1">₪{stats?.weeklyEarnings.toFixed(2) || '0.00'}</p>
                      <p className="luxury-text-small text-gray-500">{stats?.weeklyTrips || 0} trips</p>
                    </div>
                    <div className="luxury-glass-minimal p-6 luxury-hover-lift">
                      <p className="luxury-text-small text-gray-500 mb-2">All Time</p>
                      <p className="luxury-heading-lg luxury-text-gradient mb-1">₪{stats?.totalEarnings.toFixed(2) || '0.00'}</p>
                      <p className="luxury-text-small text-gray-500">{stats?.totalTrips || 0} trips</p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <button className="luxury-btn-primary w-full md:w-auto">
                      Request Payout
                    </button>
                  </div>
                </div>

                <div className="luxury-glass-card luxury-shadow-xl p-6 luxury-animate-fade-in luxury-delay-1">
                  <h3 className="luxury-heading-md mb-6">Performance Metrics</h3>
                  <div className="luxury-grid-4">
                    <div className="luxury-glass-card luxury-hover-lift text-center p-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                        <Star className="w-8 h-8 text-white fill-white" />
                      </div>
                      <p className="luxury-heading-lg luxury-text-gradient">{stats?.rating.toFixed(1) || '5.0'}</p>
                      <p className="luxury-text-small text-gray-500 mt-2">Rating</p>
                      <p className="text-xs text-gray-400">({stats?.totalReviews || 0} reviews)</p>
                    </div>
                    <div className="luxury-glass-card luxury-hover-lift text-center p-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4">
                        <Navigation className="w-8 h-8 text-white" />
                      </div>
                      <p className="luxury-heading-lg luxury-text-gradient">{stats?.totalTrips || 0}</p>
                      <p className="luxury-text-small text-gray-500 mt-2">Total Rides</p>
                    </div>
                    <div className="luxury-glass-card luxury-hover-lift text-center p-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
                        <Route className="w-8 h-8 text-white" />
                      </div>
                      <p className="luxury-heading-lg luxury-text-gradient">{stats?.acceptanceRate || 100}%</p>
                      <p className="luxury-text-small text-gray-500 mt-2">Acceptance</p>
                    </div>
                    <div className="luxury-glass-card luxury-hover-lift text-center p-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-white" />
                      </div>
                      <p className="luxury-heading-lg luxury-text-gradient">{stats?.completionRate || 100}%</p>
                      <p className="luxury-text-small text-gray-500 mt-2">On-Time %</p>
                    </div>
                  </div>
                </div>

                {/* Vehicle Status */}
                <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-2">
                  <h3 className="luxury-heading-md mb-6">Vehicle Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between luxury-glass-minimal p-4">
                      <div className="flex items-center gap-3">
                        <Car className="w-6 h-6 text-blue-600" />
                        <div>
                          <p className="luxury-heading-sm text-sm">Vehicle Inspection</p>
                          <p className="luxury-text-small text-gray-500">Last checked: Today</p>
                        </div>
                      </div>
                      <span className="luxury-badge luxury-badge-success">✓ Approved</span>
                    </div>
                    <div className="flex items-center justify-between luxury-glass-minimal p-4">
                      <div className="flex items-center gap-3">
                        <Car className="w-6 h-6 text-blue-600" />
                        <div>
                          <p className="luxury-heading-sm text-sm">Insurance</p>
                          <p className="luxury-text-small text-gray-500">Valid until: Dec 2025</p>
                        </div>
                      </div>
                      <span className="luxury-badge luxury-badge-success">✓ Valid</span>
                    </div>
                    <div className="luxury-glass-panel border-l-4 border-amber-500 p-4">
                      <p className="luxury-text-small font-semibold text-amber-800 dark:text-amber-400 mb-1">
                        ⚠️ Maintenance Reminder
                      </p>
                      <p className="luxury-text-small text-amber-700 dark:text-amber-500">
                        Your next service is due in 500 km
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rating & Reviews */}
                <div className="luxury-glass-card luxury-shadow-lg p-6 luxury-animate-fade-in luxury-delay-3">
                  <h3 className="luxury-heading-md mb-6">Recent Reviews</h3>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="text-center">
                      <p className="luxury-heading-lg luxury-text-gradient">{stats?.rating.toFixed(1) || '5.0'}</p>
                      <div className="flex gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="luxury-text-small text-gray-500 mt-2">{stats?.totalReviews || 0} reviews</p>
                    </div>
                    <div className="luxury-divider-vertical h-16" />
                    <div className="flex-1">
                      <p className="luxury-text-small text-gray-600 mb-2">Customers love your service! 🎉</p>
                      <p className="luxury-text-small text-gray-500">Keep up the excellent work to maintain your high rating.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="luxury-glass-minimal p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <span className="luxury-text-small text-gray-500">• 2 days ago</span>
                      </div>
                      <p className="luxury-text-small">"Excellent service! Very careful with my pet. Highly recommend!"</p>
                      <p className="text-xs text-gray-400 mt-1">- Sarah M.</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
