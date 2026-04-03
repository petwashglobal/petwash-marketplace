import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, DollarSign, Star, Bell, MessageCircle, TrendingUp, ChevronRight, Navigation } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface WalkBooking {
  id: number;
  bookingId: string;
  ownerId: string;
  walkerId: string;
  status: string;
  scheduledDate: string;
  scheduledStartTime: string;
  durationMinutes: number;
  totalCost: string;
  currency: string;
  petName: string | null;
  petBreed: string | null;
  pickupAddress: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  actualDurationMinutes: number | null;
  totalDistanceMeters: number | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    confirmed: { label: 'מאושר / Confirmed', className: 'bg-green-500 text-white' },
    pending_provider: { label: 'ממתין / Pending', className: 'bg-amber-500 text-white' },
    in_progress: { label: 'בטיול / In Progress', className: 'bg-blue-500 text-white animate-pulse' },
    completed: { label: 'הושלם / Completed', className: 'bg-gray-400 text-white' },
    cancelled: { label: 'בוטל / Cancelled', className: 'bg-red-500 text-white' },
  };
  const s = map[status] || { label: status, className: 'bg-slate-300 text-slate-800' };
  return <Badge className={s.className}>{s.label}</Badge>;
}

export default function WalkMyPetOwnerDashboard() {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: walksData, isLoading } = useQuery<{ success: boolean; bookings: WalkBooking[] }>({
    queryKey: ['/api/walk-my-pet/users', user?.id, 'walks'],
    queryFn: () =>
      fetch(`/api/walk-my-pet/users/${user?.id}/walks`, { credentials: 'include' })
        .then(r => r.json()),
    enabled: !!user?.id,
  });

  const allWalks: WalkBooking[] = walksData?.bookings || [];

  const activeWalk = allWalks.find(w => w.status === 'in_progress');
  const upcomingWalks = allWalks.filter(w =>
    (w.status === 'confirmed' || w.status === 'pending_provider') &&
    new Date(w.scheduledDate) >= new Date(new Date().toDateString())
  );
  const pastWalks = allWalks.filter(w => w.status === 'completed');

  // Derived stats from real data
  const totalWalks = allWalks.filter(w => w.status === 'completed').length;
  const totalSpent = allWalks
    .filter(w => w.status === 'completed' || w.status === 'in_progress')
    .reduce((sum, w) => sum + parseFloat(w.totalCost || '0'), 0);

  const cardStyle = "bg-white p-6 shadow-[8px_8px_16px_rgba(163,177,198,0.15),-8px_-8px_16px_rgba(255,255,255,0.7)] border-0 hover:shadow-[12px_12px_24px_rgba(163,177,198,0.2),-12px_-12px_24px_rgba(255,255,255,0.8)] transition-all";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="relative bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 bg-clip-text text-transparent" data-testid="page-title">
                🐾 Walk My Pet™
              </h1>
              <p className="text-slate-600 text-lg" data-testid="page-subtitle">לוח בעלי כלבים / Owner Dashboard</p>
            </div>
            <Button
              variant="outline"
              className="gap-2 bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] border-slate-200"
              data-testid="button-notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Card className={cardStyle} data-testid="stat-total-walks">
              <div className="text-slate-500 text-sm mb-2 font-medium">Total Walks / טיולים</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                {isLoading ? '—' : totalWalks}
              </div>
            </Card>
            <Card className={cardStyle} data-testid="stat-total-spent">
              <div className="text-slate-500 text-sm mb-2 font-medium">Total Spent / הוצאות</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                {isLoading ? '—' : `₪${totalSpent.toFixed(0)}`}
              </div>
            </Card>
            <Card className={cardStyle} data-testid="stat-upcoming">
              <div className="text-slate-500 text-sm mb-2 font-medium">Upcoming / קרוב</div>
              <div className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent">
                {isLoading ? '—' : upcomingWalks.length}
              </div>
            </Card>
            <Card className={cardStyle} data-testid="stat-active">
              <div className="text-slate-500 text-sm mb-2 font-medium">Status / סטטוס</div>
              <div className="text-lg font-semibold text-slate-800">
                {activeWalk ? (
                  <span className="flex items-center gap-2 text-blue-600">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                    בטיול / In Walk
                  </span>
                ) : '—'}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Active Walk Alert */}
        {activeWalk && (
          <Card className="mb-8 p-6 bg-white shadow-[8px_8px_24px_rgba(163,177,198,0.2),-4px_-4px_16px_rgba(255,255,255,0.9)] border-l-4 border-amber-500" data-testid="card-active-walk">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-white font-bold text-lg">
                    🐕
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900" data-testid="text-active-walk-title">
                    {activeWalk.petName || 'הכלב'} Walk is Live! / הטיול ברשת!
                  </div>
                  <div className="text-sm text-slate-600">
                    {activeWalk.pickupAddress}
                  </div>
                </div>
              </div>
              <Button
                className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg hover:shadow-xl"
                data-testid="button-track-live"
                onClick={() => setLocation(`/walks/track/${activeWalk.bookingId}`)}
              >
                <Navigation className="h-4 w-4" />
                Track Live / עקוב
              </Button>
            </div>
            {activeWalk.actualStartTime && (
              <div className="grid grid-cols-2 gap-4 text-center">
                <div data-testid="stat-start-time">
                  <div className="text-2xl font-bold text-slate-900">
                    {new Date(activeWalk.actualStartTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-sm text-slate-500">Start Time</div>
                </div>
                <div data-testid="stat-distance">
                  <div className="text-2xl font-bold text-slate-900">
                    {activeWalk.totalDistanceMeters ? `${(activeWalk.totalDistanceMeters / 1000).toFixed(1)} km` : '—'}
                  </div>
                  <div className="text-sm text-slate-500">Distance</div>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto bg-white shadow-[inset_2px_2px_5px_rgba(163,177,198,0.2),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] p-1" data-testid="tabs-walk-sections">
            <TabsTrigger value="upcoming" data-testid="tab-upcoming">
              עתידי / Upcoming {upcomingWalks.length > 0 && `(${upcomingWalks.length})`}
            </TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">
              היסטוריה / History
            </TabsTrigger>
            <TabsTrigger value="recurring" data-testid="tab-recurring">
              קבוע / Recurring
            </TabsTrigger>
          </TabsList>

          {/* Upcoming Walks */}
          <TabsContent value="upcoming" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="luxury-spinner mx-auto mb-4"></div>
                <p className="text-slate-500">טוען טיולים... / Loading walks...</p>
              </div>
            ) : upcomingWalks.length === 0 ? (
              <Card className={`${cardStyle} p-10 text-center`} data-testid="card-no-upcoming">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-amber-500" />
                <h3 className="text-xl font-semibold mb-2 text-slate-900">אין טיולים עתידיים / No Upcoming Walks</h3>
                <p className="text-slate-600 mb-6">Book a walk for your pet below.</p>
              </Card>
            ) : (
              upcomingWalks.map((walk) => (
                <Card
                  key={walk.bookingId}
                  className={`${cardStyle} p-6`}
                  data-testid={`card-walk-${walk.bookingId}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg text-slate-900" data-testid={`text-pet-name-${walk.bookingId}`}>
                          {walk.petName || 'כלב / Pet'}
                          {walk.petBreed ? ` (${walk.petBreed})` : ''}
                        </h3>
                        <StatusBadge status={walk.status} />
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div className="flex items-center gap-2" data-testid={`walk-datetime-${walk.bookingId}`}>
                          <Calendar className="h-4 w-4 text-amber-500" />
                          <span>{formatDate(walk.scheduledDate)} בשעה / at {walk.scheduledStartTime}</span>
                        </div>
                        <div className="flex items-center gap-2" data-testid={`walk-duration-${walk.bookingId}`}>
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span>{walk.durationMinutes} דקות / minutes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-amber-500" />
                          <span className="truncate">{walk.pickupAddress}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end gap-2">
                      <div className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-yellow-600 bg-clip-text text-transparent" data-testid={`price-${walk.bookingId}`}>
                        ₪{parseFloat(walk.totalCost).toFixed(2)}
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 shadow-sm"
                          data-testid={`button-chat-${walk.bookingId}`}
                          onClick={() => setLocation(`/chat/${walk.bookingId}`)}
                        >
                          <MessageCircle className="h-4 w-4" />
                          Chat
                        </Button>
                        <Button
                          size="sm"
                          className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white"
                          data-testid={`button-track-${walk.bookingId}`}
                          onClick={() => setLocation(`/walks/track/${walk.bookingId}`)}
                        >
                          <Navigation className="h-4 w-4" />
                          Track
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Past Walks */}
          <TabsContent value="past" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="luxury-spinner mx-auto mb-4"></div>
              </div>
            ) : pastWalks.length === 0 ? (
              <Card className={`${cardStyle} p-10 text-center`} data-testid="card-no-past">
                <Clock className="h-16 w-16 mx-auto mb-4 text-slate-400" />
                <h3 className="text-xl font-semibold mb-2 text-slate-900">אין טיולים קודמים / No Past Walks</h3>
              </Card>
            ) : (
              pastWalks.map((walk) => (
                <Card
                  key={walk.bookingId}
                  className={`${cardStyle} p-6`}
                  data-testid={`card-past-walk-${walk.bookingId}`}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg text-slate-900" data-testid={`text-past-pet-name-${walk.bookingId}`}>
                        {walk.petName || 'כלב / Pet'}
                        {walk.petBreed ? ` (${walk.petBreed})` : ''}
                      </h3>
                      <StatusBadge status={walk.status} />
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-amber-500" />
                        <span data-testid={`past-walk-datetime-${walk.bookingId}`}>
                          {formatDate(walk.scheduledDate)} בשעה / at {walk.scheduledStartTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span data-testid={`past-walk-duration-${walk.bookingId}`}>
                          {walk.actualDurationMinutes ?? walk.durationMinutes} דקות / minutes
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-amber-500" />
                        <span data-testid={`past-walk-price-${walk.bookingId}`}>₪{parseFloat(walk.totalCost).toFixed(2)}</span>
                      </div>
                      {walk.totalDistanceMeters && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-amber-500" />
                          <span>{(walk.totalDistanceMeters / 1000).toFixed(2)} ק"מ / km</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Recurring Walks */}
          <TabsContent value="recurring">
            <Card className={`${cardStyle} p-8 text-center`} data-testid="card-recurring-empty">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 text-amber-500" />
              <h3 className="text-xl font-semibold mb-2 text-slate-900">ניהול טיולים קבועים / Manage Recurring Walks</h3>
              <p className="text-slate-600 mb-6">Set up regular walking schedules for your pets</p>
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg"
                data-testid="button-create-recurring"
                onClick={() => setLocation('/walk-my-pet')}
              >
                <Calendar className="h-5 w-5" />
                Book Walks / הזמן טיולים
              </Button>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Book New Walk CTA */}
        <Card className="mt-8 p-8 bg-white text-center shadow-[8px_8px_24px_rgba(163,177,198,0.2),-8px_-8px_24px_rgba(255,255,255,0.9)] border-0" data-testid="card-book-cta">
          <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
            צריך טיול היום? / Need a Walk Today?
          </h2>
          <p className="text-slate-600 mb-6">Book a trusted walker in seconds</p>
          <Button
            size="lg"
            className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg hover:shadow-xl"
            data-testid="button-find-walkers"
            onClick={() => setLocation('/walk-my-pet')}
          >
            <MapPin className="h-5 w-5" />
            Find Walkers Near Me / מצא מולכי כלבים
          </Button>
        </Card>
      </div>
    </div>
  );
}
