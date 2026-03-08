import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Scissors, Calendar, DollarSign, Star, TrendingUp, Clock, CheckCircle2,
  XCircle, MessageCircle, Camera, Users, Package, Phone, AlertCircle,
  Banknote, PawPrint, Edit2, RefreshCcw, BarChart3,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isTomorrow, parseISO, startOfMonth, endOfMonth } from 'date-fns';

interface BookingRequest {
  id: number;
  requestId: string;
  ownerId: string;
  providerId: string;
  providerType: string;
  serviceType: string;
  startDate: string;
  endDate: string;
  petCount: number;
  petDetails: any;
  subtotalCents: number;
  serviceFeeCents: number;
  totalCents: number;
  currency: string;
  status: string;
  ownerMessage: string | null;
  serviceStartedAt: string | null;
  serviceCompletedAt: string | null;
  ownerRating: string | null;
  ownerReview: string | null;
  photoUpdates: { url: string; caption: string; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
}

const SERVICE_LABELS: Record<string, { en: string; he: string; emoji: string; basePrice: number }> = {
  bath_blow: { en: 'Bath & Blow Dry', he: 'אמבטיה וייבוש', emoji: '🛁', basePrice: 120 },
  full_groom: { en: 'Full Groom', he: 'טיפוח מלא', emoji: '✂️', basePrice: 180 },
  nail_trim: { en: 'Nail Trim', he: 'קיצוץ ציפורניים', emoji: '💅', basePrice: 60 },
  spa_treatment: { en: 'Spa Treatment', he: 'טיפול ספא', emoji: '🧴', basePrice: 220 },
  puppy_groom: { en: 'Puppy Groom', he: 'טיפוח לגורים', emoji: '🐾', basePrice: 140 },
  teeth_cleaning: { en: 'Teeth Cleaning', he: 'ניקוי שיניים', emoji: '🦷', basePrice: 80 },
  ear_cleaning: { en: 'Ear Cleaning', he: 'ניקוי אוזניים', emoji: '👂', basePrice: 60 },
  de_shed: { en: 'De-Shedding', he: 'הסרת שערות', emoji: '🪮', basePrice: 150 },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Awaiting Response', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  accepted: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: CheckCircle2 },
  meet_greet_scheduled: { label: 'Meet & Greet Set', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', icon: Calendar },
  confirmed: { label: 'Ready', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', icon: Scissors },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
};

function fmt(cents: number) { return `₪${(cents / 100).toFixed(0)}`; }

function fmtDate(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}

interface GroomersProviderDashboardProps { language?: string; }

export default function GroomersProviderDashboard({ language: langProp }: GroomersProviderDashboardProps) {
  const { language: langCtx } = useLanguage();
  const language = langProp || langCtx;
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('today');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [declineMsg, setDeclineMsg] = useState('');
  const [clientNotes, setClientNotes] = useState<Record<string, string>>({});
  const [editingService, setEditingService] = useState<string | null>(null);
  const [servicePrices, setServicePrices] = useState<Record<string, number>>(
    Object.fromEntries(Object.entries(SERVICE_LABELS).map(([k, v]) => [k, v.basePrice]))
  );

  const { data: bookings = [], isLoading, refetch } = useQuery<BookingRequest[]>({
    queryKey: ['/api/booking-requests', 'provider', 'groomer'],
    queryFn: () => fetch('/api/booking-requests?role=provider', { credentials: 'include' }).then(r => r.json()),
  });

  const respondMutation = useMutation({
    mutationFn: ({ requestId, action, message }: { requestId: string; action: 'accept' | 'decline'; message?: string }) =>
      apiRequest('POST', `/api/booking-requests/${requestId}/respond`, { action, message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', 'provider', 'groomer'] });
      setRespondingId(null);
      toast({ title: 'Response sent' });
    },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const startMutation = useMutation({
    mutationFn: (requestId: string) => apiRequest('POST', `/api/booking-requests/${requestId}/start`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', 'provider', 'groomer'] });
      toast({ title: 'Grooming session started! Client notified.' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (requestId: string) => apiRequest('POST', `/api/booking-requests/${requestId}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', 'provider', 'groomer'] });
      toast({ title: 'Session complete! Awaiting owner confirmation & payment release.' });
    },
  });

  const photoMutation = useMutation({
    mutationFn: ({ requestId, caption }: { requestId: string; caption: string }) =>
      apiRequest('POST', `/api/booking-requests/${requestId}/photo-update`, { caption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/booking-requests', 'provider', 'groomer'] });
      toast({ title: 'Photo update sent to client!' });
    },
  });

  const now = new Date();
  const todayBookings = bookings.filter(b => isToday(parseISO(b.startDate)));
  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const activeBookings = bookings.filter(b => ['accepted', 'confirmed', 'in_progress', 'meet_greet_scheduled'].includes(b.status));
  const completedBookings = bookings.filter(b => b.status === 'completed');

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthEarnings = completedBookings
    .filter(b => { const d = parseISO(b.serviceCompletedAt || b.updatedAt); return d >= monthStart && d <= monthEnd; })
    .reduce((s, b) => s + Math.round(b.subtotalCents * 0.85), 0);
  const pendingEarnings = activeBookings.reduce((s, b) => s + Math.round(b.subtotalCents * 0.85), 0);
  const totalEarnings = completedBookings.reduce((s, b) => s + Math.round(b.subtotalCents * 0.85), 0);
  const avgRating = completedBookings.filter(b => b.ownerRating).reduce((a, b, _, arr) => a + parseFloat(b.ownerRating!) / arr.length, 0);
  const uniqueClients = [...new Set(bookings.map(b => b.ownerId))];

  function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}><Icon className="w-3 h-3" />{cfg.label}</span>;
  }

  function BookingCard({ booking }: { booking: BookingRequest }) {
    const svc = SERVICE_LABELS[booking.serviceType] || { en: booking.serviceType, he: booking.serviceType, emoji: '✂️' };
    const petName = booking.petDetails?.[0]?.name || 'Pet';
    const ownerName = booking.petDetails?.[0]?.ownerName || `Client #${booking.ownerId.slice(-4)}`;
    const myEarnings = Math.round(booking.subtotalCents * 0.85);

    return (
      <div className="luxury-glass-card luxury-shadow-md p-5 luxury-animate-fade-in">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-rose-600 flex items-center justify-center text-xl shadow-md">{svc.emoji}</div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{isHebrew ? svc.he : svc.en}</h3>
              <p className="text-sm text-gray-500 flex items-center gap-1"><PawPrint className="w-3.5 h-3.5" />{petName} · {ownerName}</p>
            </div>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400"><Clock className="w-4 h-4 text-blue-500" />{fmtDate(booking.startDate)}</div>
          <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-500" /><span className="font-semibold text-green-700 dark:text-green-400">{fmt(myEarnings)} yours</span></div>
        </div>

        {booking.ownerMessage && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4 text-sm text-blue-700 dark:text-blue-300">
            <MessageCircle className="w-3.5 h-3.5 inline mr-1.5" />"{booking.ownerMessage}"
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {booking.status === 'pending' && (
            <>
              <Button size="sm" className="luxury-btn-primary flex-1" onClick={() => respondMutation.mutate({ requestId: booking.requestId, action: 'accept', message: 'Looking forward to seeing your pet!' })} disabled={respondMutation.isPending}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Accept
              </Button>
              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 flex-1" onClick={() => setRespondingId(booking.requestId)}>
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Decline
              </Button>
            </>
          )}
          {['confirmed', 'accepted'].includes(booking.status) && (
            <Button size="sm" className="luxury-btn-primary flex-1" onClick={() => startMutation.mutate(booking.requestId)} disabled={startMutation.isPending}>
              <Scissors className="w-3.5 h-3.5 mr-1.5" /> Start Grooming
            </Button>
          )}
          {booking.status === 'in_progress' && (
            <>
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => completeMutation.mutate(booking.requestId)} disabled={completeMutation.isPending}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Complete
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => photoMutation.mutate({ requestId: booking.requestId, caption: 'Looking great! 🐾' })}>
                <Camera className="w-3.5 h-3.5 mr-1.5" /> Send Photo
              </Button>
            </>
          )}
          {booking.status === 'completed' && booking.ownerRating && (
            <div className="flex items-center gap-1 text-amber-500 text-sm w-full">
              {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(parseFloat(booking.ownerRating!)) ? 'fill-current' : ''}`} />)}
              {booking.ownerReview && <span className="text-xs text-gray-400 ml-1 italic">"{booking.ownerReview}"</span>}
            </div>
          )}
        </div>

        {respondingId === booking.requestId && (
          <div className="mt-4 space-y-2 border-t pt-4 border-gray-100 dark:border-gray-700">
            <Textarea placeholder="Reason (optional)..." value={declineMsg} onChange={e => setDeclineMsg(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-red-200 text-red-600 flex-1" onClick={() => respondMutation.mutate({ requestId: booking.requestId, action: 'decline', message: declineMsg })} disabled={respondMutation.isPending}>
                Confirm Decline
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRespondingId(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const EmptyState = ({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) => (
    <div className="luxury-glass-card p-12 text-center">
      <Icon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
      <p className="luxury-heading-sm text-gray-500">{title}</p>
      <p className="luxury-text-small mt-1 text-gray-400">{sub}</p>
    </div>
  );

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="luxury-bg-primary text-white py-10 luxury-animate-fade-in">
        <div className="luxury-container">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1"><Scissors className="w-6 h-6 text-pink-300" /><span className="text-pink-200 text-sm font-medium tracking-wide uppercase">Groomer Hub</span></div>
              <h1 className="text-3xl font-bold text-white">{isHebrew ? 'לוח בקרה למטפח' : 'My Grooming Business'}</h1>
              <p className="text-purple-100 mt-1">Manage appointments, earnings & clients</p>
            </div>
            <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10" onClick={() => refetch()}>
              <RefreshCcw className="w-4 h-4 mr-2" />Refresh
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { icon: Calendar, label: "Today's Jobs", value: todayBookings.length, sub: `${pendingBookings.length} pending`, color: 'from-blue-400 to-blue-600' },
              { icon: DollarSign, label: 'This Month', value: fmt(monthEarnings), sub: `${fmt(pendingEarnings)} pending`, color: 'from-green-400 to-emerald-600' },
              { icon: Star, label: 'Avg Rating', value: avgRating ? avgRating.toFixed(1) : '—', sub: `${completedBookings.filter(b => b.ownerRating).length} reviews`, color: 'from-amber-400 to-orange-500' },
              { icon: Users, label: 'Total Clients', value: uniqueClients.length, sub: `${completedBookings.length} sessions done`, color: 'from-purple-400 to-pink-500' },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-2`}><Icon className="w-4 h-4 text-white" /></div>
                <p className="text-xs text-purple-200">{label}</p>
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-xs text-purple-300">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="luxury-container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="luxury-tabs-list mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="today" className="luxury-tab">
              <Clock className="w-4 h-4 mr-1.5" />Today
              {todayBookings.length > 0 && <Badge className="ml-1.5 h-4 w-4 p-0 text-[10px] justify-center">{todayBookings.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="requests" className="luxury-tab">
              <AlertCircle className="w-4 h-4 mr-1.5" />Requests
              {pendingBookings.length > 0 && <Badge className="ml-1.5 h-4 w-4 p-0 text-[10px] justify-center bg-amber-500">{pendingBookings.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="luxury-tab"><Calendar className="w-4 h-4 mr-1.5" />Upcoming</TabsTrigger>
            <TabsTrigger value="completed" className="luxury-tab"><CheckCircle2 className="w-4 h-4 mr-1.5" />History</TabsTrigger>
            <TabsTrigger value="earnings" className="luxury-tab"><Banknote className="w-4 h-4 mr-1.5" />Earnings</TabsTrigger>
            <TabsTrigger value="clients" className="luxury-tab"><Users className="w-4 h-4 mr-1.5" />Clients</TabsTrigger>
            <TabsTrigger value="services" className="luxury-tab"><Package className="w-4 h-4 mr-1.5" />Services</TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            <div className="space-y-4">
              {isLoading ? <div className="flex justify-center py-16"><div className="luxury-spinner" /></div>
                : todayBookings.length === 0 ? <EmptyState icon={Scissors} title="No appointments today" sub="Check Requests tab for pending bookings." />
                : todayBookings.map(b => <BookingCard key={b.requestId} booking={b} />)}
            </div>
          </TabsContent>

          <TabsContent value="requests">
            <div className="space-y-4">
              {isLoading ? <div className="flex justify-center py-16"><div className="luxury-spinner" /></div>
                : pendingBookings.length === 0 ? <EmptyState icon={CheckCircle2} title="All caught up!" sub="No pending requests right now." />
                : pendingBookings.map(b => <BookingCard key={b.requestId} booking={b} />)}
            </div>
          </TabsContent>

          <TabsContent value="upcoming">
            <div className="space-y-4">
              {isLoading ? <div className="flex justify-center py-16"><div className="luxury-spinner" /></div>
                : activeBookings.length === 0 ? <EmptyState icon={Calendar} title="No upcoming bookings" sub="Accept requests to fill your schedule." />
                : activeBookings.map(b => <BookingCard key={b.requestId} booking={b} />)}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="space-y-4">
              {isLoading ? <div className="flex justify-center py-16"><div className="luxury-spinner" /></div>
                : completedBookings.length === 0 ? <EmptyState icon={BarChart3} title="No completed sessions yet" sub="Completed grooming sessions appear here." />
                : completedBookings.map(b => <BookingCard key={b.requestId} booking={b} />)}
            </div>
          </TabsContent>

          <TabsContent value="earnings">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'This Month', value: fmt(monthEarnings), icon: TrendingUp, color: 'from-green-400 to-emerald-600', sub: 'After 15% platform fee' },
                  { label: 'Pending Payout', value: fmt(pendingEarnings), icon: Clock, color: 'from-amber-400 to-orange-500', sub: 'Released on completion' },
                  { label: 'Total Lifetime', value: fmt(totalEarnings), icon: DollarSign, color: 'from-purple-400 to-pink-500', sub: `${completedBookings.length} sessions` },
                ].map(({ label, value, icon: Icon, color, sub }) => (
                  <Card key={label} className="luxury-glass-card luxury-shadow-md">
                    <CardContent className="p-6">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}><Icon className="w-5 h-5 text-white" /></div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
                      <p className="text-xs text-gray-400 mt-1">{sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="luxury-glass-card luxury-shadow-md">
                <CardHeader><CardTitle className="luxury-heading-sm">Recent Transactions</CardTitle></CardHeader>
                <CardContent>
                  {completedBookings.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">No transactions yet</p> : (
                    <div className="space-y-3">
                      {completedBookings.slice(0, 15).map(b => {
                        const svc = SERVICE_LABELS[b.serviceType] || { emoji: '✂️', en: b.serviceType };
                        const myEarn = Math.round(b.subtotalCents * 0.85);
                        return (
                          <div key={b.requestId} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{svc.emoji}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{isHebrew ? (SERVICE_LABELS[b.serviceType]?.he || b.serviceType) : svc.en}</p>
                                <p className="text-xs text-gray-400">{fmtDate(b.serviceCompletedAt || b.updatedAt)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600 dark:text-green-400">+{fmt(myEarn)}</p>
                              <p className="text-xs text-gray-400">{fmt(b.serviceFeeCents)} fee</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button className="luxury-btn-primary"><Banknote className="w-4 h-4 mr-2" />Request Payout</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="clients">
            <div className="space-y-4">
              {uniqueClients.length === 0 ? <EmptyState icon={Users} title="No clients yet" sub="Clients appear here after your first booking." /> : (
                uniqueClients.map(ownerId => {
                  const ownerBookings = bookings.filter(b => b.ownerId === ownerId);
                  const latest = ownerBookings[0];
                  const petInfo = latest?.petDetails?.[0];
                  const ownerName = petInfo?.ownerName || `Client #${ownerId.slice(-6)}`;
                  const petName = petInfo?.name || 'Unknown pet';
                  const totalSpent = ownerBookings.filter(b => b.status === 'completed').reduce((s, b) => s + Math.round(b.subtotalCents * 0.85), 0);
                  return (
                    <div key={ownerId} className="luxury-glass-card luxury-shadow-md p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11">
                            <AvatarFallback className="bg-gradient-to-br from-pink-400 to-rose-600 text-white font-bold">{ownerName.slice(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{ownerName}</p>
                            <p className="text-sm text-gray-500 flex items-center gap-1"><PawPrint className="w-3.5 h-3.5" />{petName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">{fmt(totalSpent)}</p>
                          <p className="text-xs text-gray-400">{ownerBookings.filter(b => b.status === 'completed').length} visits</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {[...new Set(ownerBookings.map(b => b.serviceType))].slice(0,4).map(sType => (
                          <span key={sType} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                            {SERVICE_LABELS[sType]?.emoji} {isHebrew ? SERVICE_LABELS[sType]?.he : SERVICE_LABELS[sType]?.en || sType}
                          </span>
                        ))}
                      </div>
                      <Textarea
                        placeholder="Private notes about this client's pet (not visible to client)..."
                        className="text-xs resize-none"
                        rows={2}
                        value={clientNotes[ownerId] || ''}
                        onChange={e => setClientNotes(prev => ({ ...prev, [ownerId]: e.target.value }))}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="services">
            <div className="space-y-4">
              <p className="luxury-text-small text-gray-500">Set your prices per service. Changes update your public profile immediately.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(SERVICE_LABELS).map(([key, svc]) => (
                  <Card key={key} className="luxury-glass-card luxury-shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{svc.emoji}</span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{isHebrew ? svc.he : svc.en}</p>
                          <p className="text-xs text-gray-400">{isHebrew ? svc.en : svc.he}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingService === key ? (
                          <>
                            <span className="text-sm text-gray-500">₪</span>
                            <Input type="number" className="w-20 h-8 text-sm text-right" value={servicePrices[key] || ''} onChange={e => setServicePrices(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))} autoFocus />
                            <Button size="sm" className="h-8 luxury-btn-primary" onClick={() => { setEditingService(null); toast({ title: `${svc.en} → ₪${servicePrices[key]}` }); }}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-gray-800 dark:text-gray-200">₪{servicePrices[key]}</span>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingService(key)}><Edit2 className="w-3.5 h-3.5" /></Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
