import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Scissors, Calendar, Clock, Star, CheckCircle2, XCircle, MessageCircle,
  Camera, PawPrint, RefreshCcw, DollarSign, Heart, MapPin, TrendingUp,
  Navigation2, Shield,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { format, parseISO } from 'date-fns';
import { IntelligencePanel } from '@/components/IntelligenceBadge';
import { useBookingEvents } from '@/hooks/useBookingEvents';
import { useJourneyState } from '@/hooks/useJourneyState';

interface BookingRequest {
  id: number;
  requestId: string;
  ownerId: string;
  providerId: string;
  serviceType: string;
  startDate: string;
  endDate: string;
  petCount: number;
  petDetails: any;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  status: string;
  ownerMessage: string | null;
  serviceStartedAt: string | null;
  serviceCompletedAt: string | null;
  ownerConfirmedAt: string | null;
  ownerRating: string | null;
  ownerReview: string | null;
  photoUpdates: { url: string; caption: string; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
}

const SERVICE_LABELS: Record<string, { en: string; he: string; emoji: string }> = {
  bath_blow: { en: 'Bath & Blow Dry', he: 'אמבטיה וייבוש', emoji: '🛁' },
  full_groom: { en: 'Full Groom', he: 'טיפוח מלא', emoji: '✂️' },
  nail_trim: { en: 'Nail Trim', he: 'קיצוץ ציפורניים', emoji: '💅' },
  spa_treatment: { en: 'Spa Treatment', he: 'טיפול ספא', emoji: '🧴' },
  puppy_groom: { en: 'Puppy Groom', he: 'טיפוח לגורים', emoji: '🐾' },
  teeth_cleaning: { en: 'Teeth Cleaning', he: 'ניקוי שיניים', emoji: '🦷' },
  ear_cleaning: { en: 'Ear Cleaning', he: 'ניקוי אוזניים', emoji: '👂' },
  de_shed: { en: 'De-Shedding', he: 'הסרת שערות', emoji: '🪮' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Awaiting Groomer', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  accepted: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 dark:bg-white dark:text-blue-300' },
  confirmed: { label: 'Ready', color: 'bg-green-100 text-green-800 dark:bg-white dark:text-green-300' },
  in_progress: { label: '✂️ Grooming Now', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  completed: { label: 'Done', color: 'bg-white text-gray-700 dark:bg-white/40 dark:text-black' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-white dark:text-red-300' },
};

function fmt(cents: number) { return `₪${(cents / 100).toFixed(0)}`; }

interface GroomersCustomerDashboardProps { language?: string; }

export default function GroomersCustomerDashboard({ language: langProp }: GroomersCustomerDashboardProps) {
  const { language: langCtx } = useLanguage();
  const language = langProp || langCtx;
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  const { data: bookings = [], isLoading, refetch } = useQuery<BookingRequest[]>({
    queryKey: ['/api/booking-requests', 'owner', 'groomers'],
    queryFn: () => fetch('/api/booking-requests?role=owner', { credentials: 'include' }).then(r => r.json()),
  });

  const confirmMutation = useMutation({
    mutationFn: (requestId: string) => apiRequest('POST', `/api/booking-requests/${requestId}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', 'owner', 'groomers'] });
      toast({ title: 'Service confirmed! Payment released to groomer.' });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ requestId, rating, review }: { requestId: string; rating: number; review: string }) =>
      apiRequest('PATCH', `/api/booking-requests/${requestId}`, { ownerRating: String(rating), ownerReview: review }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', 'owner', 'groomers'] });
      setRatingBookingId(null);
      setReviewText('');
      setRating(5);
      toast({ title: 'Review submitted! Thank you.' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => apiRequest('POST', `/api/booking-requests/${requestId}/cancel`, { cancelledBy: 'owner' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', 'owner', 'groomers'] });
      toast({ title: 'Booking cancelled.' });
    },
  });

  // ── Intelligence profile (own scores) ────────────────────────────────────
  const { data: intel } = useQuery<{
    trustScore: number; behaviorScore: number; riskLevel: number;
    bookingHistoryCount: number; cancellationRate: number; journeyState: string;
  }>({
    queryKey: ['/api/user/intelligence'],
    retry: false,
    staleTime: 60_000,
  });

  // ── Journey state ─────────────────────────────────────────────────────────
  const { advance } = useJourneyState();

  // Advance journey once user visits this page
  useEffect(() => { advance('browsing'); }, []);

  const now = new Date();
  const upcoming = bookings.filter(b => ['pending', 'accepted', 'confirmed', 'in_progress', 'meet_greet_scheduled'].includes(b.status));
  const completed = bookings.filter(b => b.status === 'completed');
  const cancelled = bookings.filter(b => ['cancelled', 'declined'].includes(b.status));
  const totalSpent = completed.reduce((s, b) => s + b.totalCents, 0);

  // ── Real-time booking events (most active booking) ─────────────────────
  const activeBookingId = upcoming[0]?.requestId;
  const { arriving, accepted } = useBookingEvents(activeBookingId);

  // Toast on provider.arriving
  useEffect(() => {
    if (!arriving) return;
    toast({
      title: isHebrew ? '🚗 הספק בדרך אליך!' : '🚗 Provider is on the way!',
      description: arriving.eta
        ? (isHebrew ? `ETA: ${arriving.eta}` : `ETA: ${arriving.eta}`)
        : (isHebrew ? 'הם יגיעו בקרוב' : 'They\'ll arrive soon'),
      duration: 8000,
    });
  }, [arriving]);

  // Toast on provider.accepted
  useEffect(() => {
    if (!accepted) return;
    toast({
      title: isHebrew ? '✅ הספק אישר את ההזמנה!' : '✅ Provider accepted your booking!',
      description: isHebrew ? 'ניתן לצפות בפרטים בכרטיסיית "קרוב"' : 'Check the Upcoming tab for details',
      duration: 6000,
    });
  }, [accepted]);

  const favoriteService = Object.entries(
    completed.reduce((acc: Record<string, number>, b) => ({ ...acc, [b.serviceType]: (acc[b.serviceType] || 0) + 1 }), {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0];

  function BookingCard({ booking }: { booking: BookingRequest }) {
    const svc = SERVICE_LABELS[booking.serviceType] || { en: booking.serviceType, he: booking.serviceType, emoji: '✂️' };
    const petName = booking.petDetails?.[0]?.name || 'Your pet';
    const groomerName = `Groomer #${booking.providerId.slice(-4)}`;
    const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

    return (
      <div className="luxury-glass-card luxury-shadow-md p-5 luxury-animate-fade-in">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 flex items-center justify-center text-xl">{svc.emoji}</div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-black">{isHebrew ? svc.he : svc.en}</h3>
              <p className="text-sm text-gray-500 flex items-center gap-1"><PawPrint className="w-3.5 h-3.5" />{petName}</p>
            </div>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4 text-blue-500" />
            {format(parseISO(booking.startDate), 'MMM d, h:mm a')}
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Scissors className="w-4 h-4 text-pink-500" />{groomerName}
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="font-semibold text-gray-800 dark:text-black">{fmt(booking.totalCents)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            Ref: #{booking.requestId?.slice(-6)}
          </div>
        </div>

        {booking.photoUpdates && booking.photoUpdates.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Camera className="w-3.5 h-3.5" />Grooming updates</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {booking.photoUpdates.map((photo, i) => (
                <div key={i} className="flex-shrink-0 bg-white dark:bg-white rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 min-w-[120px]">
                  <Camera className="w-4 h-4 mb-1 text-pink-400" />
                  <p>{photo.caption || 'Photo update'}</p>
                  <p className="text-gray-400 mt-1">{format(new Date(photo.timestamp), 'h:mm a')}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {booking.status === 'completed' && !booking.ownerConfirmedAt && (
            <Button size="sm" className="luxury-btn-primary flex-1" onClick={() => confirmMutation.mutate(booking.requestId)} disabled={confirmMutation.isPending}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Confirm & Release Payment
            </Button>
          )}
          {booking.status === 'completed' && !booking.ownerRating && (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setRatingBookingId(booking.requestId)}>
              <Star className="w-3.5 h-3.5 mr-1.5" />Leave Review
            </Button>
          )}
          {booking.status === 'completed' && booking.ownerRating && (
            <div className="flex items-center gap-1 text-amber-500 w-full">
              {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(parseFloat(booking.ownerRating!)) ? 'fill-current' : ''}`} />)}
              {booking.ownerReview && <span className="text-xs text-gray-400 ml-1">"{booking.ownerReview}"</span>}
            </div>
          )}
          {['pending', 'accepted'].includes(booking.status) && (
            <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400" onClick={() => cancelMutation.mutate(booking.requestId)} disabled={cancelMutation.isPending}>
              <XCircle className="w-3.5 h-3.5 mr-1.5" />Cancel
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setLocation('/groomers/book')}>
            <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />Rebook
          </Button>
        </div>

        {ratingBookingId === booking.requestId && (
          <div className="mt-4 border-t pt-4 border-gray-100 dark:border-gray-700 space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-black">Rate your groomer</p>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(s => (
                <Star
                  key={s}
                  className={`w-8 h-8 cursor-pointer transition-colors ${s <= (hoverRating || rating) ? 'text-amber-400 fill-current' : 'text-gray-300'}`}
                  onMouseEnter={() => setHoverRating(s)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(s)}
                />
              ))}
            </div>
            <Textarea placeholder="Share your experience (optional)..." value={reviewText} onChange={e => setReviewText(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button size="sm" className="luxury-btn-primary flex-1" onClick={() => reviewMutation.mutate({ requestId: booking.requestId, rating, review: reviewText })} disabled={reviewMutation.isPending}>
                Submit Review
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRatingBookingId(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-bg-primary text-white py-10">
        <div className="luxury-container">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1"><Scissors className="w-6 h-6 text-pink-300" /><span className="text-pink-200 text-sm font-medium uppercase tracking-wide">My Grooming</span></div>
              <h1 className="text-3xl font-bold text-white">{isHebrew ? 'היסטוריית הטיפוח שלי' : 'My Grooming History'}</h1>
              <p className="text-purple-100 mt-1">Track appointments, photos & spending</p>
            </div>
            <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10" onClick={() => setLocation('/groomers/book')}>
              <Scissors className="w-4 h-4 mr-2" />Book Session
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            {[
              { icon: Scissors, label: 'Sessions', value: completed.length, color: 'from-pink-400 to-rose-600' },
              { icon: DollarSign, label: 'Total Spent', value: fmt(totalSpent), color: 'from-green-400 to-emerald-600' },
              { icon: TrendingUp, label: 'Fav Service', value: favoriteService ? (SERVICE_LABELS[favoriteService]?.emoji || '✂️') : '—', color: 'from-amber-400 to-orange-500' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-2 mx-auto`}><Icon className="w-4 h-4 text-white" /></div>
                <p className="text-xs text-purple-200">{label}</p>
                <p className="text-lg font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          {/* Provider arriving live banner */}
          {arriving && (
            <div className="mt-4 flex items-center gap-3 bg-amber-500/20 border border-amber-400/40 rounded-xl px-4 py-3">
              <Navigation2 className="w-5 h-5 text-amber-300 animate-bounce" />
              <div>
                <p className="text-white font-medium text-sm">
                  {isHebrew ? '🚗 הספק בדרך אליך!' : '🚗 Provider is on the way!'}
                </p>
                {arriving.eta && (
                  <p className="text-amber-200 text-xs">
                    {isHebrew ? `ETA: ${arriving.eta}` : `ETA: ${arriving.eta}`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="luxury-container py-8">
        {/* Intelligence panel — customer's own trust & engagement scores */}
        {intel && (
          <div className="luxury-glass-card luxury-shadow-md p-5 mb-6 luxury-animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[#C6A664]" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-black">
                {isHebrew ? 'הפרופיל שלי' : 'My Trust Profile'}
              </h3>
            </div>
            <IntelligencePanel
              trustScore={intel.trustScore}
              behaviorScore={intel.behaviorScore}
              riskLevel={intel.riskLevel}
              bookingHistoryCount={intel.bookingHistoryCount}
              cancellationRate={intel.cancellationRate}
              journeyState={intel.journeyState}
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="luxury-tabs-list mb-6">
            <TabsTrigger value="upcoming" className="luxury-tab">
              <Clock className="w-4 h-4 mr-1.5" />Upcoming
              {upcoming.length > 0 && <Badge className="ml-1.5 h-4 w-4 p-0 text-[10px] justify-center">{upcoming.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="completed" className="luxury-tab"><CheckCircle2 className="w-4 h-4 mr-1.5" />History</TabsTrigger>
            <TabsTrigger value="cancelled" className="luxury-tab"><XCircle className="w-4 h-4 mr-1.5" />Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            <div className="space-y-4">
              {isLoading ? <div className="flex justify-center py-16"><div className="luxury-spinner" /></div>
                : upcoming.length === 0 ? (
                  <div className="luxury-glass-card p-12 text-center">
                    <Scissors className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="luxury-heading-sm text-gray-500">No upcoming appointments</p>
                    <p className="luxury-text-small text-gray-400 mt-1 mb-6">Book a grooming session for your pet</p>
                    <Button className="luxury-btn-primary" onClick={() => setLocation('/groomers/book')}>
                      <Scissors className="w-4 h-4 mr-2" />Book Now
                    </Button>
                  </div>
                ) : upcoming.map(b => <BookingCard key={b.requestId} booking={b} />)}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="space-y-4">
              {isLoading ? <div className="flex justify-center py-16"><div className="luxury-spinner" /></div>
                : completed.length === 0 ? (
                  <div className="luxury-glass-card p-12 text-center">
                    <Heart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="luxury-heading-sm text-gray-500">No past sessions yet</p>
                  </div>
                ) : completed.map(b => <BookingCard key={b.requestId} booking={b} />)}
            </div>
          </TabsContent>

          <TabsContent value="cancelled">
            <div className="space-y-4">
              {cancelled.length === 0 ? (
                <div className="luxury-glass-card p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-300" />
                  <p className="luxury-heading-sm text-gray-500">No cancelled bookings</p>
                </div>
              ) : cancelled.map(b => <BookingCard key={b.requestId} booking={b} />)}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
