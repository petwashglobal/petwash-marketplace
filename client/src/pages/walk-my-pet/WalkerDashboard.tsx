import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  Navigation,
  DollarSign,
  MapPin,
  Clock,
  PawPrint,
  Star,
  TrendingUp,
  Route,
  CheckCircle2,
  Play,
  Pause,
  Phone,
  MessageCircle
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { t as ti18n } from '@/lib/i18n';
import { format } from 'date-fns';

interface Walk {
  id: string;
  ownerName: string;
  ownerPhoto: string | null;
  ownerPhone: string;
  petName: string;
  petType: string;
  petBreed: string;
  scheduledTime: string;
  duration: number; // minutes
  pickupAddress: string;
  dropoffAddress: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  earnings: number;
  currency: string;
  specialInstructions: string | null;
  distance: number; // km
}

interface DailyStats {
  walksCompleted: number;
  walksScheduled: number;
  totalEarnings: number;
  totalDistance: number;
  averageRating: number;
  currency: string;
}

interface WeeklyStats {
  totalEarnings: number;
  totalWalks: number;
  totalDistance: number;
  averageEarningsPerWalk: number;
  currency: string;
}

export default function WalkerDashboard() {
  const { language } = useLanguage();
  const t = (key: string) => ti18n(key, language);
  const [activeTab, setActiveTab] = useState('today');
  const [activeWalkId, setActiveWalkId] = useState<string | null>(null);

  // Fetch today's walks
  const { data: todayWalks = [] } = useQuery<Walk[]>({
    queryKey: ['/api/walk-my-pet/walker/today'],
  });

  // Fetch daily stats
  const { data: dailyStats } = useQuery<DailyStats>({
    queryKey: ['/api/walk-my-pet/walker/stats/daily'],
  });

  // Fetch weekly stats
  const { data: weeklyStats } = useQuery<WeeklyStats>({
    queryKey: ['/api/walk-my-pet/walker/stats/weekly'],
  });

  const upcomingWalks = todayWalks.filter(w => w.status === 'scheduled');
  const activeWalk = todayWalks.find(w => w.status === 'in_progress');
  const completedWalks = todayWalks.filter(w => w.status === 'completed');

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      scheduled: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', label: 'Scheduled' },
      in_progress: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', label: 'In Progress' },
      completed: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400', label: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', label: 'Cancelled' },
    };
    const { color, label } = variants[status] || variants.scheduled;
    return <Badge className={color}>{label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-orange-900/20">
      {/* Hero Header - Like Uber Driver App */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ 
                background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(255,215,0,0.5)'
              }}>
                🦮 Walker Dashboard
              </h1>
              <p className="text-lg text-orange-100">Today's walks & live GPS tracking</p>
            </div>
            {activeWalk && (
              <Button 
                size="lg" 
                className="bg-white text-orange-600 hover:bg-gray-100 text-lg px-8 py-6 shadow-2xl animate-pulse"
                data-testid="button-view-active-walk"
              >
                <Navigation className="w-5 h-5 mr-2" />
                Active Walk in Progress
              </Button>
            )}
          </div>

          {/* Today's Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-orange-100 mb-1">Walks Today</p>
                <p className="text-2xl font-bold text-white">
                  {dailyStats?.walksCompleted || 0}/{dailyStats?.walksScheduled || 0}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-orange-100 mb-1">Today's Earnings</p>
                <p className="text-2xl font-bold text-white">₪{dailyStats?.totalEarnings.toFixed(0) || '0'}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-orange-100 mb-1">Distance</p>
                <p className="text-2xl font-bold text-white">{dailyStats?.totalDistance.toFixed(1) || '0'} km</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-orange-100 mb-1">This Week</p>
                <p className="text-2xl font-bold text-white">₪{weeklyStats?.totalEarnings.toFixed(0) || '0'}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-orange-100 mb-1">Rating</p>
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <p className="text-2xl font-bold text-white">{dailyStats?.averageRating.toFixed(1) || '5.0'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Active Walk Alert */}
      {activeWalk && (
        <div className="container mx-auto px-4 -mt-6 mb-6">
          <Card className="border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-green-600 p-4 rounded-full animate-pulse">
                  <Navigation className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-green-800 dark:text-green-400">
                    Walk in Progress: {activeWalk.petName}
                  </h3>
                  <p className="text-green-700 dark:text-green-500">
                    {activeWalk.ownerName} • {activeWalk.duration} min walk
                  </p>
                </div>
                <Button className="bg-green-600 hover:bg-green-700" size="lg" data-testid="button-end-walk">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  End Walk
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid bg-white dark:bg-gray-800 shadow-lg">
            <TabsTrigger value="today" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-2" />
              Today ({upcomingWalks.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="earnings" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              <DollarSign className="w-4 h-4 mr-2" />
              Earnings
            </TabsTrigger>
          </TabsList>

          {/* Today's Walks Tab */}
          <TabsContent value="today" className="space-y-4">
            {upcomingWalks.length === 0 && !activeWalk ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <PawPrint className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No walks scheduled today</h3>
                  <p className="text-gray-500">Check back later for new walk requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingWalks.map((walk) => (
                  <Card key={walk.id} className="hover:shadow-xl transition-shadow border-orange-200">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Pet/Owner Info */}
                        <div className="flex gap-4">
                          <Avatar className="w-20 h-20">
                            <AvatarImage src={walk.ownerPhoto || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-orange-600 to-yellow-600 text-white text-2xl">
                              {walk.petName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="text-xl font-bold">{walk.petName}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {walk.petBreed} • {walk.petType}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">Owner: {walk.ownerName}</p>
                          </div>
                        </div>

                        {/* Walk Details */}
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-orange-600" />
                              <span className="font-semibold">{format(new Date(walk.scheduledTime), 'h:mm a')}</span>
                              <span className="text-gray-500">({walk.duration} min)</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Route className="w-4 h-4 text-orange-600" />
                              <span>{walk.distance.toFixed(1)} km</span>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-gray-700 dark:text-gray-300">Pick up</p>
                                <p className="text-gray-600 dark:text-gray-400">{walk.pickupAddress}</p>
                              </div>
                            </div>
                            {walk.dropoffAddress !== walk.pickupAddress && (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                                <div>
                                  <p className="font-medium text-gray-700 dark:text-gray-300">Drop off</p>
                                  <p className="text-gray-600 dark:text-gray-400">{walk.dropoffAddress}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {walk.specialInstructions && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-1">
                                ⚠️ Special Instructions
                              </p>
                              <p className="text-sm text-yellow-700 dark:text-yellow-500">
                                {walk.specialInstructions}
                              </p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <Button 
                              className="bg-orange-600 hover:bg-orange-700 flex-1"
                              data-testid={`button-start-walk-${walk.id}`}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Start Walk
                            </Button>
                            <Button 
                              variant="outline"
                              data-testid={`button-call-${walk.id}`}
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline"
                              data-testid={`button-message-${walk.id}`}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline"
                              data-testid={`button-navigate-${walk.id}`}
                            >
                              <Navigation className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Earnings */}
                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-sm text-gray-500">You'll earn</span>
                            <span className="text-2xl font-bold text-orange-600">₪{walk.earnings.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Completed Walks</CardTitle>
                <CardDescription>Your walk history and ratings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {completedWalks.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">No completed walks yet</p>
                ) : (
                  completedWalks.map((walk) => (
                    <div key={walk.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarImage src={walk.ownerPhoto || undefined} />
                          <AvatarFallback className="bg-orange-600 text-white">
                            {walk.petName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{walk.petName}</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(walk.scheduledTime), 'MMM d, h:mm a')} • {walk.duration} min
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">₪{walk.earnings.toFixed(2)}</p>
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span>5.0</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Earnings Tab */}
          <TabsContent value="earnings">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    Weekly Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Total Earnings</p>
                      <p className="text-3xl font-bold text-orange-600">
                        ₪{weeklyStats?.totalEarnings.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Walks</p>
                      <p className="text-3xl font-bold">{weeklyStats?.totalWalks || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Distance</p>
                      <p className="text-3xl font-bold">{weeklyStats?.totalDistance.toFixed(1) || '0'} km</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Avg per Walk</p>
                      <p className="text-3xl font-bold">
                        ₪{weeklyStats?.averageEarningsPerWalk.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payout Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Available for payout</p>
                        <p className="text-2xl font-bold text-green-600">
                          ₪{weeklyStats?.totalEarnings.toFixed(2) || '0.00'}
                        </p>
                      </div>
                      <Button className="bg-green-600 hover:bg-green-700" data-testid="button-request-payout">
                        Request Payout
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500 text-center">
                      Payouts are processed weekly every Monday via bank transfer
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
