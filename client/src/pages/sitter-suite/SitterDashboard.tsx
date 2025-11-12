import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { 
  DollarSign,
  Calendar as CalendarIcon,
  Star,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  PawPrint,
  Award,
  BarChart3,
  Users
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { t as ti18n } from '@/lib/i18n';
import { format } from 'date-fns';

interface BookingRequest {
  id: string;
  ownerName: string;
  ownerPhoto: string | null;
  petName: string;
  petType: string;
  serviceType: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  totalPrice: number;
  myEarnings: number;
  currency: string;
}

interface Earnings {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  pending: number;
  currency: string;
}

interface Stats {
  totalBookings: number;
  activeBookings: number;
  completionRate: number;
  rating: number;
  totalReviews: number;
}

export default function SitterDashboard() {
  const { language } = useLanguage();
  const t = (key: string) => ti18n(key, language);
  const [activeTab, setActiveTab] = useState('requests');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Fetch booking requests
  const { data: requests = [] } = useQuery<BookingRequest[]>({
    queryKey: ['/api/sitter-suite/sitter/requests'],
  });

  // Fetch earnings
  const { data: earnings } = useQuery<Earnings>({
    queryKey: ['/api/sitter-suite/sitter/earnings'],
  });

  // Fetch stats
  const { data: stats } = useQuery<Stats>({
    queryKey: ['/api/sitter-suite/sitter/stats'],
  });

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const activeBookings = requests.filter(r => 
    r.status === 'accepted' && new Date(r.endDate) > new Date()
  );
  const completedBookings = requests.filter(r => r.status === 'completed');

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: any }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', icon: Clock },
      accepted: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle2 },
      completed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', icon: CheckCircle2 },
      rejected: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', icon: XCircle },
    };
    const { color, icon: Icon } = variants[status] || variants.pending;
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-green-900/20">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2" style={{ 
                background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(255,215,0,0.5)'
              }}>
                💰 Sitter Hub
              </h1>
              <p className="text-lg text-green-100">Manage requests, bookings & earnings</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-green-100">Your Rating</p>
                <div className="flex items-center gap-2">
                  <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                  <span className="text-3xl font-bold">{stats?.rating.toFixed(1) || '5.0'}</span>
                  <span className="text-sm text-green-100">({stats?.totalReviews || 0} reviews)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-green-100 mb-1">Today</p>
                <p className="text-2xl font-bold text-white">₪{earnings?.today.toFixed(0) || '0'}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-green-100 mb-1">This Week</p>
                <p className="text-2xl font-bold text-white">₪{earnings?.thisWeek.toFixed(0) || '0'}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-green-100 mb-1">This Month</p>
                <p className="text-2xl font-bold text-white">₪{earnings?.thisMonth.toFixed(0) || '0'}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-green-100 mb-1">Pending</p>
                <p className="text-2xl font-bold text-yellow-300">₪{earnings?.pending.toFixed(0) || '0'}</p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur border-white/20">
              <CardContent className="p-4">
                <p className="text-sm text-green-100 mb-1">Total Earned</p>
                <p className="text-2xl font-bold text-white">₪{earnings?.total.toFixed(0) || '0'}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid bg-white dark:bg-gray-800 shadow-lg">
            <TabsTrigger value="requests" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-2" />
              Requests ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Active ({activeBookings.length})
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-2" />
              Stats
            </TabsTrigger>
          </TabsList>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  Pending Requests ({pendingRequests.length})
                </CardTitle>
                <CardDescription>Review and respond to booking requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No pending requests</p>
                    <p className="text-sm text-gray-400 mt-2">New requests will appear here</p>
                  </div>
                ) : (
                  pendingRequests.map((request) => (
                    <Card key={request.id} className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-6">
                          <Avatar className="w-20 h-20">
                            <AvatarImage src={request.ownerPhoto || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-green-600 to-teal-600 text-white text-2xl">
                              {request.ownerName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="text-xl font-bold">{request.ownerName}</h3>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">
                                  {request.petName} ({request.petType}) • {request.serviceType}
                                </p>
                              </div>
                              {getStatusBadge(request.status)}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-green-600" />
                                <span>
                                  {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-green-600" />
                                <span className="font-bold">You earn: ₪{request.myEarnings.toFixed(2)}</span>
                              </div>
                              <div className="text-sm text-gray-500">
                                Total: ₪{request.totalPrice.toFixed(2)}
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Button 
                                className="bg-green-600 hover:bg-green-700 flex-1"
                                data-testid={`button-accept-${request.id}`}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Accept
                              </Button>
                              <Button 
                                variant="outline" 
                                className="flex-1"
                                data-testid={`button-decline-${request.id}`}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Decline
                              </Button>
                              <Button 
                                variant="outline"
                                data-testid={`button-message-owner-${request.id}`}
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Bookings Tab */}
          <TabsContent value="active" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PawPrint className="w-5 h-5 text-green-600" />
                  Active Bookings ({activeBookings.length})
                </CardTitle>
                <CardDescription>Currently confirmed pet sitting assignments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <PawPrint className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No active bookings</p>
                  </div>
                ) : (
                  activeBookings.map((booking) => (
                    <Card key={booking.id} className="border-green-200 hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-6">
                          <Avatar className="w-16 h-16">
                            <AvatarImage src={booking.ownerPhoto || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-green-600 to-teal-600 text-white text-xl">
                              {booking.ownerName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-lg font-bold">{booking.ownerName}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {booking.petName} ({booking.petType})
                                </p>
                              </div>
                              {getStatusBadge(booking.status)}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-green-600" />
                                <span>{format(new Date(booking.startDate), 'MMM d')} - {format(new Date(booking.endDate), 'MMM d')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-green-600" />
                                <span className="font-bold">₪{booking.myEarnings.toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1" data-testid={`button-contact-${booking.id}`}>
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Contact Owner
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1" data-testid={`button-details-${booking.id}`}>
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Booking Calendar</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeBookings
                      .filter(b => {
                        if (!selectedDate) return false;
                        const start = new Date(b.startDate);
                        const end = new Date(b.endDate);
                        return selectedDate >= start && selectedDate <= end;
                      })
                      .map(booking => (
                        <div key={booking.id} className="p-4 border rounded-lg">
                          <p className="font-semibold">{booking.ownerName}</p>
                          <p className="text-sm text-gray-600">{booking.petName} • {booking.serviceType}</p>
                          <p className="text-sm text-green-600 font-bold mt-2">₪{booking.myEarnings}</p>
                        </div>
                      ))}
                    {(!selectedDate || activeBookings.filter(b => {
                      const start = new Date(b.startDate);
                      const end = new Date(b.endDate);
                      return selectedDate >= start && selectedDate <= end;
                    }).length === 0) && (
                      <p className="text-gray-500 text-center py-8">No bookings on this date</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full">
                      <Users className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Bookings</p>
                      <p className="text-3xl font-bold">{stats?.totalBookings || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-full">
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Active Now</p>
                      <p className="text-3xl font-bold">{stats?.activeBookings || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-full">
                      <Star className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Rating</p>
                      <p className="text-3xl font-bold">{stats?.rating.toFixed(1) || '5.0'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-full">
                      <Award className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Completion Rate</p>
                      <p className="text-3xl font-bold">{stats?.completionRate || 100}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Completion Rate</span>
                      <span className="text-sm text-gray-500">{stats?.completionRate || 100}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all" 
                        style={{ width: `${stats?.completionRate || 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
