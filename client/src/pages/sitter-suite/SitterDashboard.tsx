import { useState, useEffect } from 'react';
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

function useProviderLocationBeacon() {
  useEffect(() => {
    if (!navigator.geolocation) return;

    const sendLocation = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      fetch('/api/sitter-suite/sitters/location', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
      }).catch(() => {});
    };

    navigator.geolocation.getCurrentPosition(sendLocation, () => {}, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });

    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(sendLocation, () => {}, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);
}

export default function SitterDashboard() {
  const { language } = useLanguage();
  const t = (key: string) => ti18n(key, language);
  useProviderLocationBeacon();
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
    const variants: Record<string, { className: string; icon: any }> = {
      pending: { className: 'luxury-badge', icon: Clock },
      accepted: { className: 'luxury-badge-success', icon: CheckCircle2 },
      completed: { className: 'luxury-badge', icon: CheckCircle2 },
      rejected: { className: 'luxury-badge', icon: XCircle },
    };
    const { className, icon: Icon } = variants[status] || variants.pending;
    return (
      <span className={`${className} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen luxury-bg-mesh">
      {/* Hero Header */}
      <div className="luxury-bg-primary text-white py-12 luxury-animate-fade-in">
        <div className="luxury-container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 luxury-animate-slide-up luxury-delay-1">
            <div>
              <h1 className="luxury-heading-xl mb-2" style={{ 
                background: 'linear-gradient(135deg, #FFFFFF, #E0E0E0, #FFFFFF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(255,255,255,0.5)'
              }}>
                💰 Sitter Hub
              </h1>
              <p className="text-lg text-purple-100">Manage requests, bookings & earnings</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-purple-100">Your Rating</p>
                <div className="flex items-center gap-2">
                  <Star className="w-6 h-6 fill-white text-white" />
                  <span className="text-3xl font-bold">{stats?.rating.toFixed(1) || '5.0'}</span>
                  <span className="text-sm text-purple-100">({stats?.totalReviews || 0} reviews)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8 luxury-animate-slide-up luxury-delay-2">
            <div className="luxury-glass-panel p-4 luxury-hover-lift luxury-delay-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))' }}>
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-purple-100">Today</p>
              </div>
              <p className="luxury-heading-lg luxury-text-gradient">₪{earnings?.today.toFixed(0) || '0'}</p>
            </div>

            <div className="luxury-glass-panel p-4 luxury-hover-lift luxury-delay-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))' }}>
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-purple-100">This Week</p>
              </div>
              <p className="luxury-heading-lg luxury-text-gradient">₪{earnings?.thisWeek.toFixed(0) || '0'}</p>
            </div>

            <div className="luxury-glass-panel p-4 luxury-hover-lift luxury-delay-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))' }}>
                  <CalendarIcon className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-purple-100">This Month</p>
              </div>
              <p className="luxury-heading-lg luxury-text-gradient">₪{earnings?.thisMonth.toFixed(0) || '0'}</p>
            </div>

            <div className="luxury-glass-panel p-4 luxury-hover-lift luxury-delay-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(200, 200, 200, 0.2))' }}>
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-purple-100">Pending</p>
              </div>
              <p className="text-2xl font-bold text-white">₪{earnings?.pending.toFixed(0) || '0'}</p>
            </div>

            <div className="luxury-glass-panel p-4 luxury-hover-lift luxury-delay-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.2), rgba(50, 50, 50, 0.2))' }}>
                  <Award className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm text-purple-100">Total Earned</p>
              </div>
              <p className="luxury-heading-lg luxury-text-gradient">₪{earnings?.total.toFixed(0) || '0'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="luxury-container luxury-section-compact">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid luxury-glass-card luxury-shadow-lg luxury-animate-scale-in luxury-delay-3">
            <TabsTrigger value="requests" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white transition-all">
              <Clock className="w-4 h-4 mr-2" />
              Requests ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white transition-all">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Active ({activeBookings.length})
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white transition-all">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:luxury-bg-primary data-[state=active]:text-white transition-all">
              <BarChart3 className="w-4 h-4 mr-2" />
              Stats
            </TabsTrigger>
          </TabsList>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-slide-up luxury-delay-4">
              <CardHeader>
                <CardTitle className="luxury-heading-md flex items-center gap-2">
                  <div className="p-2 rounded-full luxury-badge-gold">
                    <Clock className="w-5 h-5" />
                  </div>
                  Pending Requests ({pendingRequests.length})
                </CardTitle>
                <CardDescription className="luxury-text-body">Review and respond to booking requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-12 luxury-animate-fade-in">
                    <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="luxury-text-body">No pending requests</p>
                    <p className="luxury-text-small mt-2">New requests will appear here</p>
                  </div>
                ) : (
                  pendingRequests.map((request, index) => (
                    <div key={request.id} className={`luxury-glass-minimal luxury-hover-lift p-6 luxury-animate-slide-up luxury-delay-${Math.min(index + 1, 10)}`}>
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="relative">
                          <Avatar className="w-20 h-20 ring-4 ring-purple-200 dark:ring-purple-800">
                            <AvatarImage src={request.ownerPhoto || undefined} />
                            <AvatarFallback className="luxury-bg-primary text-white text-2xl">
                              {request.ownerName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 p-1 rounded-full luxury-badge-gold">
                            <PawPrint className="w-4 h-4" />
                          </div>
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="luxury-heading-sm">{request.ownerName}</h3>
                              <p className="luxury-text-small mt-1">
                                {request.petName} ({request.petType}) • {request.serviceType}
                              </p>
                            </div>
                            {getStatusBadge(request.status)}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 luxury-text-small">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-full luxury-bg-soft">
                                <CalendarIcon className="w-4 h-4 text-purple-600" />
                              </div>
                              <span>
                                {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-full luxury-badge-success">
                                <DollarSign className="w-4 h-4" />
                              </div>
                              <span className="font-bold luxury-text-gradient">You earn: ₪{request.myEarnings.toFixed(2)}</span>
                            </div>
                            <div className="luxury-text-small">
                              Total: ₪{request.totalPrice.toFixed(2)}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button 
                              className="luxury-btn-primary flex-1"
                              data-testid={`button-accept-${request.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Accept
                            </Button>
                            <Button 
                              className="luxury-btn-secondary flex-1"
                              data-testid={`button-decline-${request.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Decline
                            </Button>
                            <Button 
                              className="luxury-btn-ghost"
                              data-testid={`button-message-owner-${request.id}`}
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Bookings Tab */}
          <TabsContent value="active" className="space-y-4">
            <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-slide-up luxury-delay-4">
              <CardHeader>
                <CardTitle className="luxury-heading-md flex items-center gap-2">
                  <div className="p-2 rounded-full luxury-badge-success">
                    <PawPrint className="w-5 h-5" />
                  </div>
                  Active Bookings ({activeBookings.length})
                </CardTitle>
                <CardDescription className="luxury-text-body">Currently confirmed pet sitting assignments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeBookings.length === 0 ? (
                  <div className="text-center py-12 luxury-animate-fade-in">
                    <PawPrint className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="luxury-text-body">No active bookings</p>
                  </div>
                ) : (
                  activeBookings.map((booking, index) => (
                    <div key={booking.id} className={`luxury-glass-minimal luxury-hover-lift p-6 luxury-animate-slide-up luxury-delay-${Math.min(index + 1, 10)}`}>
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="relative">
                          <Avatar className="w-16 h-16 ring-4 ring-green-200 dark:ring-green-800">
                            <AvatarImage src={booking.ownerPhoto || undefined} />
                            <AvatarFallback className="luxury-bg-primary text-white text-xl">
                              {booking.ownerName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 p-1 rounded-full luxury-badge-success">
                            <CheckCircle2 className="w-3 h-3" />
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="luxury-heading-sm">{booking.ownerName}</h3>
                              <p className="luxury-text-small">
                                {booking.petName} ({booking.petType})
                              </p>
                            </div>
                            {getStatusBadge(booking.status)}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 luxury-text-small mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-full luxury-bg-soft">
                                <CalendarIcon className="w-4 h-4 text-purple-600" />
                              </div>
                              <span>{format(new Date(booking.startDate), 'MMM d')} - {format(new Date(booking.endDate), 'MMM d')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-full luxury-badge-success">
                                <DollarSign className="w-4 h-4" />
                              </div>
                              <span className="font-bold luxury-text-gradient">₪{booking.myEarnings.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button className="luxury-btn-secondary flex-1 text-sm py-2" data-testid={`button-contact-${booking.id}`}>
                              <MessageCircle className="w-4 h-4 mr-2" />
                              Contact Owner
                            </Button>
                            <Button className="luxury-btn-ghost flex-1 text-sm py-2" data-testid={`button-details-${booking.id}`}>
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <div className="luxury-grid-2 gap-6">
              <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-scale-in luxury-delay-4">
                <CardHeader>
                  <CardTitle className="luxury-heading-md flex items-center gap-2">
                    <div className="p-2 rounded-full luxury-bg-soft">
                      <CalendarIcon className="w-5 h-5 text-purple-600" />
                    </div>
                    Booking Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border luxury-glass-minimal"
                  />
                </CardContent>
              </Card>

              <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-scale-in luxury-delay-5">
                <CardHeader>
                  <CardTitle className="luxury-heading-md">
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
                      .map((booking, index) => (
                        <div key={booking.id} className={`luxury-glass-minimal p-4 luxury-hover-lift luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 10)}`}>
                          <p className="luxury-heading-sm">{booking.ownerName}</p>
                          <p className="luxury-text-small">{booking.petName} • {booking.serviceType}</p>
                          <p className="luxury-text-gradient font-bold mt-2">₪{booking.myEarnings}</p>
                        </div>
                      ))}
                    {(!selectedDate || activeBookings.filter(b => {
                      const start = new Date(b.startDate);
                      const end = new Date(b.endDate);
                      return selectedDate >= start && selectedDate <= end;
                    }).length === 0) && (
                      <p className="luxury-text-body text-center py-8">No bookings on this date</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <div className="luxury-grid-4 gap-6">
              <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-scale-in luxury-delay-4">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full luxury-badge-success">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="luxury-text-small">Total Bookings</p>
                      <p className="luxury-heading-lg luxury-text-gradient">{stats?.totalBookings || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-scale-in luxury-delay-5">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full luxury-badge">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="luxury-text-small">Active Now</p>
                      <p className="luxury-heading-lg luxury-text-gradient">{stats?.activeBookings || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-scale-in luxury-delay-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full luxury-badge-gold">
                      <Star className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="luxury-text-small">Rating</p>
                      <p className="luxury-heading-lg luxury-text-gradient">{stats?.rating.toFixed(1) || '5.0'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="luxury-glass-card luxury-shadow-lg luxury-animate-scale-in luxury-delay-7">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full luxury-badge">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="luxury-text-small">Completion Rate</p>
                      <p className="luxury-heading-lg luxury-text-gradient">{stats?.completionRate || 100}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6 luxury-glass-card luxury-shadow-lg luxury-animate-slide-up luxury-delay-8">
              <CardHeader>
                <CardTitle className="luxury-heading-md flex items-center gap-2">
                  <div className="p-2 rounded-full luxury-bg-soft">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                  </div>
                  Performance Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="luxury-text-small font-medium">Completion Rate</span>
                      <span className="luxury-text-gradient font-bold">{stats?.completionRate || 100}%</span>
                    </div>
                    <div className="w-full luxury-glass-minimal rounded-full h-3 overflow-hidden">
                      <div 
                        className="luxury-bg-primary h-3 rounded-full transition-all luxury-animate-scale-in" 
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
