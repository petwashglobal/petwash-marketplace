import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, DollarSign, CheckCircle2, XCircle, TrendingUp, Star } from "lucide-react";
import { useLocation } from "wouter";
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import { useToast } from "@/hooks/use-toast";

function useProviderLocationBeacon() {
  useEffect(() => {
    if (!navigator.geolocation) return;

    const sendLocation = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      fetch('/api/walk-my-pet/walkers/location', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
      }).catch(() => {});
    };

    const onError = () => {};
    navigator.geolocation.getCurrentPosition(sendLocation, onError, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });

    const intervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(sendLocation, onError, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);
}

interface WalkBooking {
  bookingId: string;
  bookingNumber?: string;
  status: string;
  scheduledDate?: string;
  startTime?: string;
  duration?: number;
  totalCost?: string;
  walkerPayout?: string;
  ownerAddress?: string;
  currency?: string;
  petName?: string;
  petBreed?: string;
  ownerId?: string;
}

interface Earnings {
  total: number;
  weekly: number;
  monthly: number;
  pending: number;
  currency: string;
  totalWalks: number;
}

export default function WalkerDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  useProviderLocationBeacon();

  // Pending bookings awaiting walker decision — returns { bookings: [], total: N }
  const { data: pendingData, isLoading: pendingLoading } = useQuery<{ bookings: WalkBooking[]; total: number }>({
    queryKey: ['/api/walk-my-pet/bookings/provider-pending'],
  });
  const pendingBookings: WalkBooking[] = pendingData?.bookings || [];

  // Earnings summary
  const { data: earnings } = useQuery<Earnings>({
    queryKey: ['/api/walk-my-pet/walker/earnings'],
  });

  // Accept booking
  const acceptMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiRequest('PATCH', `/api/walk-my-pet/bookings/${bookingId}/provider-respond`, { action: 'accept' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/walk-my-pet/bookings/provider-pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/walk-my-pet/walker/earnings'] });
      toast({ title: 'הטיול אושר! / Walk accepted!', description: 'בעל החיה קיבל הודעה / The owner has been notified' });
    },
    onError: () => {
      toast({ title: 'שגיאה / Error', description: 'לא הצלחנו לאשר את הטיול / Failed to accept the walk', variant: 'destructive' });
    },
  });

  // Decline booking
  const declineMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiRequest('PATCH', `/api/walk-my-pet/bookings/${bookingId}/provider-respond`, { action: 'decline' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/walk-my-pet/bookings/provider-pending'] });
      toast({ title: 'הטיול נדחה / Walk declined' });
    },
    onError: () => {
      toast({ title: 'שגיאה / Error', description: 'לא הצלחנו לדחות את הטיול / Failed to decline the walk', variant: 'destructive' });
    },
  });

  const isBusy = acceptMutation.isPending || declineMutation.isPending;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_provider': return 'ממתין לאישור / Pending';
      case 'confirmed': return 'מאושר / Confirmed';
      case 'in_progress': return 'בביצוע / In Progress';
      case 'completed': return 'הושלם / Completed';
      default: return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'confirmed': return 'luxury-badge-success';
      case 'in_progress': return 'luxury-badge-gold';
      case 'pending_provider': return 'luxury-badge';
      default: return 'luxury-badge';
    }
  };

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="Walker Dashboard / לוח מחוונים"
      subtitle="Manage your dog walking bookings and earnings"
    >
      <div className="luxury-bg-mesh min-h-screen py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

          {/* Earnings Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="luxury-glass-panel p-4 luxury-hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-amber-500" />
                <p className="text-sm text-gray-500">This Week</p>
              </div>
              <p className="luxury-heading-lg luxury-text-gradient">₪{earnings?.weekly?.toFixed(0) ?? '0'}</p>
            </div>
            <div className="luxury-glass-panel p-4 luxury-hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-purple-500" />
                <p className="text-sm text-gray-500">This Month</p>
              </div>
              <p className="luxury-heading-lg luxury-text-gradient">₪{earnings?.monthly?.toFixed(0) ?? '0'}</p>
            </div>
            <div className="luxury-glass-panel p-4 luxury-hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-500" />
                <p className="text-sm text-gray-500">Pending</p>
              </div>
              <p className="luxury-heading-lg luxury-text-gradient">₪{earnings?.pending?.toFixed(0) ?? '0'}</p>
            </div>
            <div className="luxury-glass-panel p-4 luxury-hover-lift">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-green-500" />
                <p className="text-sm text-gray-500">Total Walks</p>
              </div>
              <p className="luxury-heading-lg luxury-text-gradient">{earnings?.totalWalks ?? 0}</p>
            </div>
          </div>

          {/* Pending Requests */}
          <div>
            <h2 className="luxury-heading-md mb-4 flex items-center gap-2">
              <span className="luxury-badge-gold px-2 py-1">{pendingBookings.length}</span>
              Pending Walk Requests / בקשות ממתינות
            </h2>

            {pendingLoading ? (
              <div className="text-center py-12 luxury-animate-fade-in">
                <div className="luxury-spinner mx-auto mb-4"></div>
                <p className="luxury-text-small">Loading pending requests...</p>
              </div>
            ) : pendingBookings.length === 0 ? (
              <div className="luxury-glass-card luxury-shadow-lg p-10 text-center luxury-animate-scale-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 mb-4">
                  <Calendar className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="luxury-heading-sm mb-2">No Pending Requests / אין בקשות ממתינות</h3>
                <p className="luxury-text-small">New walk requests will appear here when owners book you.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {pendingBookings.map((booking, index) => (
                  <Card
                    key={booking.bookingId}
                    className={`luxury-glass-minimal luxury-hover-lift luxury-animate-fade-in luxury-delay-${Math.min(index + 1, 5)}`}
                    data-testid={`card-booking-${booking.bookingId}`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                        <span className="luxury-heading-sm">
                          {booking.petName || 'Pet'} {booking.petBreed ? `(${booking.petBreed})` : ''}
                          {booking.bookingNumber ? ` — #${booking.bookingNumber}` : ''}
                        </span>
                        <Badge className={getStatusClass(booking.status)}>
                          {getStatusLabel(booking.status)}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(booking.scheduledDate || booking.startTime) && (
                        <div className="flex items-center gap-3">
                          <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30">
                            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="luxury-text-body">
                            {new Date(booking.scheduledDate || booking.startTime!).toLocaleString('he-IL')}
                          </span>
                        </div>
                      )}

                      {booking.ownerAddress && (
                        <div className="flex items-center gap-3">
                          <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30">
                            <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <span className="luxury-text-body">{booking.ownerAddress}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
                          <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="luxury-heading-sm luxury-text-gradient">
                          ₪{parseFloat(booking.walkerPayout || booking.totalCost || '0').toFixed(2)}
                          <span className="text-sm font-normal text-gray-500 ml-1">your payout</span>
                        </span>
                      </div>

                      {/* Action buttons — only for pending_provider */}
                      {booking.status === 'pending_provider' && (
                        <div className="flex gap-3 pt-2">
                          <Button
                            className="luxury-btn-primary flex-1"
                            disabled={isBusy}
                            onClick={() => acceptMutation.mutate(booking.bookingId)}
                            data-testid={`button-accept-${booking.bookingId}`}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {acceptMutation.isPending ? 'מאשר...' : 'אשר / Accept'}
                          </Button>
                          <Button
                            className="luxury-btn-secondary flex-1"
                            disabled={isBusy}
                            onClick={() => declineMutation.mutate(booking.bookingId)}
                            data-testid={`button-decline-${booking.bookingId}`}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {declineMutation.isPending ? 'דוחה...' : 'דחה / Decline'}
                          </Button>
                        </div>
                      )}

                      {/* Track button for confirmed / in_progress */}
                      {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
                        <Button
                          className="luxury-btn-primary w-full"
                          onClick={() => setLocation(`/walks/track/${booking.bookingId}`)}
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          {booking.status === 'in_progress' ? 'Track Live / עקוב' : 'Start Walk / התחל טיול'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </LuxuryPageWrapper>
  );
}
