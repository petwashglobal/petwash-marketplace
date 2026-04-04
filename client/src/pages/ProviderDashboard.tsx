import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign,
  CheckCircle2,
  TrendingUp,
  Clock,
  Star,
  Calendar,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Wallet,
  BarChart3,
  User,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Play,
  Check,
  Zap,
  Shield,
  CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';

interface ProviderStats {
  totalBookings: number;
  completedBookings: number;
  activeBookings: number;
  cancelledBookings: number;
  totalEarnings: number;
  pendingPayouts: number;
  averageRating: number;
  totalReviews: number;
  completionRate: number;
  platforms: Array<{
    id: number;
    platformId: string;
    businessName: string | null;
    isAvailable: boolean | null;
    isActive: boolean | null;
    verificationStatus: string | null;
  }>;
  isActive: boolean;
}

interface Booking {
  id: string;
  bookingNumber: string;
  platformId: string;
  userId: string;
  startTime: string;
  endTime: string;
  duration: number | null;
  status: string;
  serviceType: string | null;
  serviceDescription: string | null;
  specialRequests: string | null;
  subtotal: string;
  platformFee: string;
  providerPayout: string;
  total: string;
  currency: string;
  paymentStatus: string | null;
  payoutStatus: string | null;
  payoutDate: string | null;
  confirmedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

interface EarningsData {
  totalEarnings: number;
  pendingPayouts: number;
  paidPayouts: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  recentPayouts: Array<{
    bookingNumber: string;
    amount: number;
    date: string;
    payoutStatus: string | null;
    serviceType: string | null;
    platformId: string;
  }>;
}

const PLATFORM_LABELS: Record<string, { name: string; nameHe: string; color: string; gradient: string }> = {
  sitter_suite: { name: 'The Sitter Suite\u2122', nameHe: '\u05D7\u05D1\u05D9\u05DC\u05EA \u05D4\u05E9\u05DE\u05E8\u05D8\u05E3\u2122', color: '#7C3AED', gradient: 'from-violet-500 to-purple-600' },
  walk_my_pet: { name: 'Walk My Pet\u2122', nameHe: '\u05D8\u05D9\u05D9\u05DC \u05E2\u05DD \u05D4\u05D7\u05D9\u05D4\u2122', color: '#10B981', gradient: 'from-emerald-400 to-teal-600' },
  pettrek: { name: 'PetTrek\u2122', nameHe: '\u05D4\u05E1\u05E2\u05D5\u05EA \u05D7\u05D9\u05D5\u05EA\u2122', color: '#3B82F6', gradient: 'from-blue-400 to-cyan-600' },
  plush_lab: { name: 'The Plush Lab\u2122', nameHe: '\u05DE\u05E2\u05D1\u05D3\u05EA \u05D4\u05E4\u05DC\u05D0\u05E9\u2122', color: '#EC4899', gradient: 'from-pink-400 to-rose-600' },
  k9000: { name: 'K9000\u2122', nameHe: 'K9000\u2122', color: '#F59E0B', gradient: 'from-amber-400 to-orange-500' },
  groomers: { name: 'Pet Wash\u2122 Groomers', nameHe: '\u05DE\u05D8\u05E4\u05D7\u05D9 Pet Wash\u2122', color: '#8B5CF6', gradient: 'from-purple-400 to-indigo-600' },
  trainers: { name: 'Pet Trainers', nameHe: '\u05DE\u05D0\u05DC\u05E4\u05D9\u05DD', color: '#EF4444', gradient: 'from-red-400 to-rose-600' },
};

const STATUS_CONFIG: Record<string, { label: string; labelHe: string; color: string; bg: string; border: string }> = {
  draft: { label: 'Draft', labelHe: '\u05D8\u05D9\u05D5\u05D8\u05D0', color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  pending: { label: 'Pending', labelHe: '\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8', color: '#D97706', bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', border: '#FDE68A' },
  confirmed: { label: 'Confirmed', labelHe: '\u05DE\u05D0\u05D5\u05E9\u05E8', color: '#2563EB', bg: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', border: '#93C5FD' },
  owner_confirmed: { label: 'Owner Confirmed', labelHe: '\u05D0\u05D5\u05E9\u05E8 \u05E2\u05F4\u05D9 \u05D4\u05DC\u05E7\u05D5\u05D7', color: '#2563EB', bg: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', border: '#93C5FD' },
  provider_confirmed: { label: 'You Confirmed', labelHe: '\u05D0\u05D9\u05E9\u05E8\u05EA', color: '#0D9488', bg: 'linear-gradient(135deg, #F0FDFA, #CCFBF1)', border: '#5EEAD4' },
  in_progress: { label: 'In Progress', labelHe: '\u05D1\u05EA\u05D4\u05DC\u05D9\u05DA', color: '#7C3AED', bg: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', border: '#C4B5FD' },
  started: { label: 'Started', labelHe: '\u05D4\u05EA\u05D7\u05D9\u05DC', color: '#7C3AED', bg: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', border: '#C4B5FD' },
  completed: { label: 'Completed', labelHe: '\u05D4\u05D5\u05E9\u05DC\u05DD', color: '#059669', bg: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', border: '#6EE7B7' },
  cancelled: { label: 'Cancelled', labelHe: '\u05D1\u05D5\u05D8\u05DC', color: '#DC2626', bg: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', border: '#FCA5A5' },
  disputed: { label: 'Disputed', labelHe: '\u05D1\u05DE\u05D7\u05DC\u05D5\u05E7\u05EA', color: '#EA580C', bg: 'linear-gradient(135deg, #FFF7ED, #FED7AA)', border: '#FDBA74' },
};

function formatCurrency(amount: number | string, currency = 'ILS') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency }).format(num);
}

function formatDate(date: string | null) {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(date: string | null) {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('he-IL', {
    month: 'short',
    day: 'numeric',
  });
}

function getBookingAction(status: string): { action: 'accept' | 'start' | 'complete' | null; labelHe: string; icon: any; gradient: string } | null {
  switch (status) {
    case 'pending':
    case 'confirmed':
    case 'owner_confirmed':
      return { action: 'accept', labelHe: '\u05D0\u05E9\u05E8 \u05D4\u05D6\u05DE\u05E0\u05D4', icon: Check, gradient: 'from-teal-500 to-emerald-600' };
    case 'provider_confirmed':
      return { action: 'start', labelHe: '\u05D4\u05EA\u05D7\u05DC \u05E9\u05D9\u05E8\u05D5\u05EA', icon: Play, gradient: 'from-blue-500 to-indigo-600' };
    case 'in_progress':
    case 'started':
      return { action: 'complete', labelHe: '\u05E1\u05D9\u05D9\u05DD \u05E9\u05D9\u05E8\u05D5\u05EA', icon: CheckCircle2, gradient: 'from-emerald-500 to-green-600' };
    default:
      return null;
  }
}

export default function ProviderDashboard() {
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [processingBooking, setProcessingBooking] = useState<string | null>(null);

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  };

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; stats: ProviderStats }>({
    queryKey: ['/api/provider-dashboard/v2/stats'],
    enabled: !!user,
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/stats'),
  });

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery<{
    success: boolean;
    bookings: Booking[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ['/api/provider-dashboard/v2/bookings', statusFilter, currentPage],
    enabled: !!user,
    queryFn: () => fetchWithAuth(`/api/provider-dashboard/v2/bookings?status=${statusFilter}&page=${currentPage}&limit=15`),
  });

  const { data: earningsData, isLoading: earningsLoading } = useQuery<{ success: boolean; earnings: EarningsData }>({
    queryKey: ['/api/provider-dashboard/v2/earnings'],
    enabled: !!user,
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/earnings'),
  });

  const [payoutStatusFilter, setPayoutStatusFilter] = useState('');
  const { data: payoutLedgerData, isLoading: payoutLedgerLoading } = useQuery<any>({
    queryKey: ['/api/prestige-pass/provider/wallet/payout-ledger', payoutStatusFilter],
    enabled: !!user,
    queryFn: () => fetchWithAuth(`/api/prestige-pass/provider/wallet/payout-ledger${payoutStatusFilter ? `?status=${payoutStatusFilter}` : ''}`),
  });

  // ── 3.0B: Payout Statement ────────────────────────────────────────────────
  const [statementBatchId, setStatementBatchId] = useState('');
  const { data: statementData, isLoading: statementLoading } = useQuery<any>({
    queryKey: ['/api/prestige-pass/provider/wallet/payout-statement', statementBatchId],
    enabled: !!user,
    queryFn: () => fetchWithAuth(`/api/prestige-pass/provider/wallet/payout-statement${statementBatchId ? `?batchId=${statementBatchId}` : ''}`),
  });

  // ── 3.1B: Clawback History ────────────────────────────────────────────────
  const { data: clawbackData, isLoading: clawbackLoading } = useQuery<any>({
    queryKey: ['/api/prestige-pass/provider/wallet/clawback-history'],
    enabled: !!user,
    queryFn: () => fetchWithAuth('/api/prestige-pass/provider/wallet/clawback-history'),
  });

  // ── 3.3D: Provider Settlement Self-Service ────────────────────────────────
  const { data: settlementData, isLoading: settlementLoading } = useQuery<any>({
    queryKey: ['/api/prestige-pass/provider/wallet/settlement-status'],
    enabled: !!user,
    queryFn: () => fetchWithAuth('/api/prestige-pass/provider/wallet/settlement-status'),
  });

  const { data: appStatusData } = useQuery<{
    success: boolean;
    isProvider: boolean;
    applications: any[];
    providerProfiles: any[];
  }>({
    queryKey: ['/api/provider-dashboard/application-status'],
    enabled: !!user,
    queryFn: () => fetchWithAuth('/api/provider-dashboard/application-status'),
  });

  // Phase 6: daily summary data
  const { data: upcomingTodayData } = useQuery<{ success: boolean; upcoming: Booking[] }>({
    queryKey: ['/api/provider-dashboard/v2/upcoming'],
    enabled: !!user,
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/upcoming'),
  });

  const { data: bookingCountsData } = useQuery<{ success: boolean; counts: Record<string, number> }>({
    queryKey: ['/api/provider-dashboard/v2/booking-counts'],
    enabled: !!user,
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/booking-counts'),
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ providerId, isAvailable }: { providerId: number; isAvailable: boolean }) => {
      return fetchWithAuth('/api/provider-dashboard/availability', {
        method: 'PATCH',
        body: JSON.stringify({ providerId, isAvailable }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/stats'] });
      toast({ title: '\u05D4\u05E1\u05D8\u05D8\u05D5\u05E1 \u05E2\u05D5\u05D3\u05DB\u05DF \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4' });
    },
    onError: () => {
      toast({ title: '\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05E2\u05D3\u05DB\u05D5\u05DF \u05E1\u05D8\u05D8\u05D5\u05E1', variant: 'destructive' });
    },
  });

  const bookingAction = useMutation({
    mutationFn: async ({ bookingId, action }: { bookingId: string; action: 'accept' | 'start' | 'complete' }) => {
      setProcessingBooking(bookingId);
      return fetchWithAuth(`/api/provider-dashboard/v2/bookings/${bookingId}/${action}`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      setProcessingBooking(null);
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/earnings'] });

      const actionLabels: Record<string, string> = {
        confirmed: '\u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D0\u05D5\u05E9\u05E8\u05D4 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4',
        started: '\u05D4\u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05EA\u05D7\u05D9\u05DC',
        completed: '\u05D4\u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05D5\u05E9\u05DC\u05DD \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4',
      };
      toast({
        title: actionLabels[data.action] || '\u05E4\u05E2\u05D5\u05DC\u05D4 \u05D1\u05D5\u05E6\u05E2\u05D4',
        description: data.stamp ? `\u05D7\u05D5\u05EA\u05DE\u05EA: ${new Date(data.confirmedAt || data.startedAt || data.completedAt).toLocaleString('he-IL')}` : undefined,
      });
    },
    onError: (error: any) => {
      setProcessingBooking(null);
      toast({
        title: '\u05E9\u05D2\u05D9\u05D0\u05D4',
        description: error.message || '\u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D1\u05E6\u05E2 \u05D0\u05EA \u05D4\u05E4\u05E2\u05D5\u05DC\u05D4',
        variant: 'destructive',
      });
    },
  });

  const stats = statsData?.stats;
  const earnings = earningsData?.earnings;
  const jobsList = bookingsData?.bookings || [];

  const monthlyTrend = earnings
    ? earnings.thisMonthEarnings > earnings.lastMonthEarnings
      ? 'up'
      : earnings.thisMonthEarnings < earnings.lastMonthEarnings
        ? 'down'
        : 'flat'
    : 'flat';

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 flex items-center justify-center" dir="rtl">
        <Card className="border border-gray-200/60 shadow-lg" style={{ borderRadius: '2px' }}>
          <CardContent className="p-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-teal-100 to-emerald-50 flex items-center justify-center" style={{ borderRadius: '2px' }}>
              <User className="w-10 h-10 text-teal-600" />
            </div>
            <h2 className="text-xl font-serif text-gray-900 mb-2">{'\u05E0\u05D3\u05E8\u05E9\u05EA \u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA'}</h2>
            <p className="text-gray-500 text-sm">{'\u05D4\u05EA\u05D7\u05D1\u05E8 \u05DB\u05D3\u05D9 \u05DC\u05D2\u05E9\u05EA \u05DC\u05DC\u05D5\u05D7 \u05D4\u05D1\u05E7\u05E8\u05D4 \u05E9\u05DC\u05DA'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-8 bg-gradient-to-b from-teal-400 to-emerald-600" style={{ borderRadius: '1px' }} />
              <h1 className="text-3xl font-serif text-gray-900 tracking-tight">{'\u05DC\u05D5\u05D7 \u05D1\u05E7\u05E8\u05D4'}</h1>
              <span className="px-2.5 py-1 text-[9px] tracking-[0.15em] uppercase font-semibold bg-gradient-to-r from-teal-50 to-emerald-50 text-teal-700 border border-teal-200/60" style={{ borderRadius: '2px' }}>
                Provider
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1 font-serif mr-5">{'\u05E0\u05D9\u05D4\u05D5\u05DC \u05D4\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05D5\u05D4\u05E8\u05D5\u05D5\u05D7\u05D9\u05DD \u05E9\u05DC\u05DA'}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/provider/timeline">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                ציר זמן רווחים
              </Button>
            </Link>
          </div>
          {stats && stats.platforms.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              {stats.platforms.map(p => {
                const platform = PLATFORM_LABELS[p.platformId];
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-gray-200/60 px-3 py-2 shadow-sm" style={{ borderRadius: '2px' }}>
                    <div className={cn("w-2 h-2", p.isAvailable ? "bg-emerald-500 animate-pulse" : "bg-gray-300")} style={{ borderRadius: '50%' }} />
                    <span className="text-xs font-medium text-gray-700">
                      {platform?.nameHe || p.platformId}
                    </span>
                    <Switch
                      checked={p.isAvailable || false}
                      onCheckedChange={(checked) => toggleAvailability.mutate({ providerId: p.id, isAvailable: checked })}
                      disabled={toggleAvailability.isPending}
                      className="scale-75"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Phase 6: Daily Summary Card */}
        {(() => {
          const todayUpcoming = upcomingTodayData?.upcoming ?? [];
          const today = new Date().toDateString();
          const todayJobs = todayUpcoming.filter(j => j.startTime && new Date(j.startTime).toDateString() === today);
          const pendingCount = bookingCountsData?.counts?.new_request ?? 0;
          const todayEarnings = todayJobs.reduce((sum, j) => sum + parseFloat(j.providerPayout || '0'), 0);
          const hasSummaryData = todayJobs.length > 0 || pendingCount > 0;
          if (!hasSummaryData) return null;
          return (
            <div className="mb-6 bg-gradient-to-r from-teal-600 to-emerald-700 text-white p-4 shadow-md flex items-center justify-between gap-4 flex-wrap" style={{ borderRadius: '2px' }}>
              <div>
                <p className="text-xs font-semibold opacity-75 uppercase tracking-widest mb-1">סיכום יומי</p>
                <div className="flex items-center gap-6 flex-wrap">
                  {todayJobs.length > 0 && (
                    <div>
                      <p className="text-2xl font-bold">{todayJobs.length}</p>
                      <p className="text-xs opacity-80">עבודות היום</p>
                    </div>
                  )}
                  {pendingCount > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-yellow-200">{pendingCount}</p>
                      <p className="text-xs opacity-80">ממתינות לאישור</p>
                    </div>
                  )}
                  {todayEarnings > 0 && (
                    <div>
                      <p className="text-2xl font-bold">{formatCurrency(todayEarnings)}</p>
                      <p className="text-xs opacity-80">רווח משוער היום</p>
                    </div>
                  )}
                </div>
              </div>
              {pendingCount > 0 && (
                <Link href="/provider/tasks">
                  <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs">
                    <Zap className="w-3.5 h-3.5 ml-1" />
                    טפל עכשיו
                  </Button>
                </Link>
              )}
            </div>
          );
        })()}

        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white/60 backdrop-blur-sm border border-gray-100 animate-pulse p-6" style={{ borderRadius: '2px' }}>
                <div className="h-20 bg-white/30" style={{ borderRadius: '2px' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="relative overflow-hidden bg-white border border-gray-200/60 shadow-sm" style={{ borderRadius: '2px' }}>
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-400 to-emerald-500" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-50 to-emerald-100 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <DollarSign className="w-5 h-5 text-teal-600" />
                  </div>
                  {monthlyTrend === 'up' && <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
                  {monthlyTrend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-400" />}
                </div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[1.5px] font-medium">{'\u05E1\u05D4\u05F4\u05DB \u05D4\u05DB\u05E0\u05E1\u05D5\u05EA'}</p>
                <p className="text-2xl font-serif text-gray-900 mt-1">{formatCurrency(stats?.totalEarnings || 0)}</p>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white border border-gray-200/60 shadow-sm" style={{ borderRadius: '2px' }}>
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 to-cyan-500" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <Briefcase className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[1.5px] font-medium">{'\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E9\u05D4\u05D5\u05E9\u05DC\u05DE\u05D5'}</p>
                <p className="text-2xl font-serif text-gray-900 mt-1">{stats?.completedBookings || 0}</p>
                <p className="text-xs text-gray-400 mt-1">{stats?.totalBookings || 0} {'\u05E1\u05D4\u05F4\u05DB'}</p>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white border border-gray-200/60 shadow-sm" style={{ borderRadius: '2px' }}>
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 to-yellow-500" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-50 to-yellow-100 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <Star className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[1.5px] font-medium">{'\u05D3\u05D9\u05E8\u05D5\u05D2 \u05DE\u05DE\u05D5\u05E6\u05E2'}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <p className="text-2xl font-serif text-gray-900">{stats?.averageRating || 0}</p>
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                </div>
                <p className="text-xs text-gray-400 mt-1">{stats?.totalReviews || 0} {'\u05D1\u05D9\u05E7\u05D5\u05E8\u05D5\u05EA'}</p>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white border border-gray-200/60 shadow-sm" style={{ borderRadius: '2px' }}>
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-400 to-purple-500" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <TrendingUp className="w-5 h-5 text-violet-600" />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 uppercase tracking-[1.5px] font-medium">{'\u05E9\u05D9\u05E2\u05D5\u05E8 \u05D4\u05E9\u05DC\u05DE\u05D4'}</p>
                <p className="text-2xl font-serif text-gray-900 mt-1">{stats?.completionRate || 0}%</p>
                <p className="text-xs text-gray-400 mt-1">{stats?.activeBookings || 0} {'\u05E4\u05E2\u05D9\u05DC \u05E2\u05DB\u05E9\u05D9\u05D5'}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm border border-gray-200/60 h-12 p-1 shadow-sm" style={{ borderRadius: '2px' }}>
            <TabsTrigger value="jobs" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-900 data-[state=active]:to-gray-800 data-[state=active]:text-white text-sm font-medium px-4" style={{ borderRadius: '2px' }}>
              <Briefcase className="w-4 h-4" />
              {'\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA'}
              {stats && stats.activeBookings > 0 && (
                <span className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-[10px] px-1.5 py-0.5 font-bold" style={{ borderRadius: '2px' }}>{stats.activeBookings}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-900 data-[state=active]:to-gray-800 data-[state=active]:text-white text-sm font-medium px-4" style={{ borderRadius: '2px' }}>
              <Wallet className="w-4 h-4" />
              {'\u05D4\u05DB\u05E0\u05E1\u05D5\u05EA'}
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-900 data-[state=active]:to-gray-800 data-[state=active]:text-white text-sm font-medium px-4" style={{ borderRadius: '2px' }}>
              <BarChart3 className="w-4 h-4" />
              {'\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-serif text-gray-900">{'\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D9\u05EA \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA'}</h2>
                  {bookingsData && (
                    <span className="text-xs text-gray-400 bg-white/80 px-2 py-1" style={{ borderRadius: '2px' }}>
                      {bookingsData.total} {'\u05E1\u05D4\u05F4\u05DB'}
                    </span>
                  )}
                </div>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-44 border-gray-200/60 text-sm bg-white/80" style={{ borderRadius: '2px' }}>
                    <SelectValue placeholder={'\u05E1\u05E0\u05DF \u05DC\u05E4\u05D9 \u05E1\u05D8\u05D8\u05D5\u05E1'} />
                  </SelectTrigger>
                  <SelectContent style={{ borderRadius: '2px' }}>
                    <SelectItem value="all">{'\u05D4\u05DB\u05DC'}</SelectItem>
                    <SelectItem value="pending">{'\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8'}</SelectItem>
                    <SelectItem value="provider_confirmed">{'\u05D0\u05D5\u05E9\u05E8'}</SelectItem>
                    <SelectItem value="in_progress">{'\u05D1\u05EA\u05D4\u05DC\u05D9\u05DA'}</SelectItem>
                    <SelectItem value="completed">{'\u05D4\u05D5\u05E9\u05DC\u05DD'}</SelectItem>
                    <SelectItem value="cancelled">{'\u05D1\u05D5\u05D8\u05DC'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bookingsLoading ? (
                <div className="bg-white/60 backdrop-blur-sm border border-gray-100 p-12 text-center" style={{ borderRadius: '2px' }}>
                  <div className="w-8 h-8 border-2 border-gray-200 border-t-teal-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-400">{'\u05D8\u05D5\u05E2\u05DF \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA...'}</p>
                </div>
              ) : jobsList.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {jobsList.map((job) => {
                      const statusCfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                      const platform = PLATFORM_LABELS[job.platformId];
                      const actionInfo = getBookingAction(job.status);
                      const isProcessing = processingBooking === job.id;

                      return (
                        <div
                          key={job.id}
                          className="bg-white border border-gray-200/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                          style={{ borderRadius: '2px' }}
                        >
                          <div className={`h-[2px] bg-gradient-to-r ${platform?.gradient || 'from-gray-300 to-gray-400'}`} />
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div
                                  className={`w-11 h-11 flex items-center justify-center bg-gradient-to-br ${platform?.gradient || 'from-gray-200 to-gray-300'} text-white text-lg flex-shrink-0`}
                                  style={{ borderRadius: '2px' }}
                                >
                                  {platform?.nameHe?.charAt(0) || '\u25CF'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-mono font-semibold text-gray-900">{job.bookingNumber}</span>
                                    <span
                                      className="text-[11px] font-medium px-2 py-0.5 inline-block border"
                                      style={{
                                        borderRadius: '2px',
                                        background: statusCfg.bg,
                                        color: statusCfg.color,
                                        borderColor: statusCfg.border,
                                      }}
                                    >
                                      {statusCfg.labelHe}
                                    </span>
                                    {job.confirmedAt && (
                                      <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 border border-teal-200" style={{ borderRadius: '2px' }}>
                                        {'\u05D0\u05D5\u05E9\u05E8'} {new Date(job.confirmedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                                    <span className="font-medium text-gray-600">{platform?.nameHe || job.platformId}</span>
                                    <span>{'\u00B7'}</span>
                                    <span>{job.serviceType || '\u05E9\u05D9\u05E8\u05D5\u05EA \u05DB\u05DC\u05DC\u05D9'}</span>
                                    <span>{'\u00B7'}</span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {formatShortDate(job.startTime)} {new Date(job.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span>{'\u00B7'}</span>
                                    <span className="font-mono text-gray-400 bg-white px-1.5 py-0.5" style={{ borderRadius: '2px' }}>
                                      {job.userId.slice(0, 8)}
                                    </span>
                                  </div>
                                  {job.startedAt && (
                                    <div className="text-[10px] text-violet-600 mt-1 flex items-center gap-1">
                                      <Play className="w-2.5 h-2.5" />
                                      {'\u05D4\u05EA\u05D7\u05D9\u05DC:'} {formatDate(job.startedAt)}
                                    </div>
                                  )}
                                  {job.completedAt && (
                                    <div className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      {'\u05D4\u05D5\u05E9\u05DC\u05DD:'} {formatDate(job.completedAt)}
                                    </div>
                                  )}
                                  {/* Phase 6: Payout status badge */}
                                  {job.payoutStatus && (
                                    <div className="mt-1.5">
                                      {job.payoutStatus === 'paid_out' && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-sm inline-flex items-center gap-1">
                                          <CircleDot className="w-2.5 h-2.5" /> שולם
                                        </span>
                                      )}
                                      {job.payoutStatus === 'pending' && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-sm inline-flex items-center gap-1">
                                          <Clock className="w-2.5 h-2.5" /> ממתין לתשלום
                                        </span>
                                      )}
                                      {job.payoutStatus === 'released' && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-sm inline-flex items-center gap-1">
                                          <Shield className="w-2.5 h-2.5" /> שוחרר
                                        </span>
                                      )}
                                      {job.payoutStatus === 'failed' && (
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-sm inline-flex items-center gap-1">
                                          <Zap className="w-2.5 h-2.5" /> תשלום נכשל
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-left">
                                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(job.providerPayout, job.currency)}</p>
                                  <p className="text-[10px] text-gray-400">{'\u05DE\u05EA\u05D5\u05DA'} {formatCurrency(job.total, job.currency)}</p>
                                </div>
                                {actionInfo && (
                                  <Button
                                    size="sm"
                                    disabled={isProcessing || bookingAction.isPending}
                                    onClick={() => bookingAction.mutate({ bookingId: job.id, action: actionInfo.action! })}
                                    className={cn(
                                      "text-white text-xs font-semibold px-4 shadow-sm hover:shadow-md transition-all",
                                      `bg-gradient-to-r ${actionInfo.gradient}`,
                                      isProcessing && "opacity-70"
                                    )}
                                    style={{ borderRadius: '2px' }}
                                  >
                                    {isProcessing ? (
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        <actionInfo.icon className="w-3.5 h-3.5 ml-1.5" />
                                        {actionInfo.labelHe}
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {bookingsData && bookingsData.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <p className="text-xs text-gray-500">
                        {'\u05E2\u05DE\u05D5\u05D3'} {bookingsData.page} {'\u05DE\u05EA\u05D5\u05DA'} {bookingsData.totalPages} ({bookingsData.total} {'\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA'})
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                          className="border-gray-200/60 hover:bg-white"
                          style={{ borderRadius: '2px' }}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(bookingsData.totalPages, p + 1))}
                          disabled={currentPage >= bookingsData.totalPages}
                          className="border-gray-200/60 hover:bg-white"
                          style={{ borderRadius: '2px' }}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white border border-gray-200/60 shadow-sm text-center p-16" style={{ borderRadius: '2px' }}>
                  <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-teal-50 to-emerald-100 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <Briefcase className="w-8 h-8 text-teal-400" />
                  </div>
                  <h3 className="text-lg font-serif text-gray-800 mb-1">{'\u05D0\u05D9\u05DF \u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05E2\u05D3\u05D9\u05D9\u05DF'}</h3>
                  <p className="text-sm text-gray-400">{'\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA \u05D7\u05D3\u05E9\u05D5\u05EA \u05D9\u05D5\u05E4\u05D9\u05E2\u05D5 \u05DB\u05D0\u05DF \u05D1\u05E8\u05D2\u05E2 \u05E9\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05D9\u05D6\u05DE\u05D9\u05E0\u05D5 \u05E9\u05D9\u05E8\u05D5\u05EA'}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="earnings">
            <div className="space-y-6">
              {earningsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white/60 border border-gray-100 animate-pulse p-6" style={{ borderRadius: '2px' }}>
                      <div className="h-20 bg-white/30" style={{ borderRadius: '2px' }} />
                    </div>
                  ))}
                </div>
              ) : earnings && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative overflow-hidden bg-white border border-gray-200/60 shadow-sm" style={{ borderRadius: '2px' }}>
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 to-orange-500" />
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                            <Clock className="w-5 h-5 text-amber-600" />
                          </div>
                          <p className="text-[11px] text-gray-400 uppercase tracking-[1.5px] font-medium">{'\u05DE\u05DE\u05EA\u05D9\u05DF \u05DC\u05EA\u05E9\u05DC\u05D5\u05DD'}</p>
                        </div>
                        <p className="text-2xl font-serif text-gray-900">{formatCurrency(earnings.pendingPayouts)}</p>
                      </div>
                    </div>

                    <div className="relative overflow-hidden bg-white border border-gray-200/60 shadow-sm" style={{ borderRadius: '2px' }}>
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 to-cyan-500" />
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                            <Calendar className="w-5 h-5 text-blue-600" />
                          </div>
                          <p className="text-[11px] text-gray-400 uppercase tracking-[1.5px] font-medium">{'\u05D4\u05D7\u05D5\u05D3\u05E9'}</p>
                        </div>
                        <p className="text-2xl font-serif text-gray-900">{formatCurrency(earnings.thisMonthEarnings)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {earnings.thisMonthEarnings > earnings.lastMonthEarnings ? (
                            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 text-red-400" />
                          )}
                          <span className="text-xs text-gray-400">{'\u05DC\u05E2\u05D5\u05DE\u05EA'} {formatCurrency(earnings.lastMonthEarnings)} {'\u05D1\u05D7\u05D5\u05D3\u05E9 \u05E9\u05E2\u05D1\u05E8'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="relative overflow-hidden bg-white border border-gray-200/60 shadow-sm" style={{ borderRadius: '2px' }}>
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 to-green-500" />
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          </div>
                          <p className="text-[11px] text-gray-400 uppercase tracking-[1.5px] font-medium">{'\u05E9\u05D5\u05DC\u05DD'}</p>
                        </div>
                        <p className="text-2xl font-serif text-gray-900">{formatCurrency(earnings.paidPayouts)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200/60 shadow-sm overflow-hidden" style={{ borderRadius: '2px' }}>
                    <div className="h-[2px] bg-gradient-to-r from-teal-400 via-cyan-500 to-blue-500" />
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="text-base font-serif text-gray-900">{'\u05EA\u05E9\u05DC\u05D5\u05DE\u05D9\u05DD \u05D0\u05D7\u05E8\u05D5\u05E0\u05D9\u05DD'}</h3>
                    </div>
                    <div className="p-5">
                      {earnings.recentPayouts.length > 0 ? (
                        <div className="space-y-3">
                          {earnings.recentPayouts.map((payout, idx) => {
                            const platform = PLATFORM_LABELS[payout.platformId];
                            return (
                              <div key={idx} className="flex items-center justify-between py-2.5 border-b border-gray-50/80 last:border-0">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-9 h-9 flex items-center justify-center bg-gradient-to-br ${platform?.gradient || 'from-gray-200 to-gray-300'} text-white text-xs font-bold`}
                                    style={{ borderRadius: '2px' }}
                                  >
                                    {platform?.nameHe?.charAt(0) || '\u25CF'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-800 font-mono">{payout.bookingNumber}</p>
                                    <p className="text-xs text-gray-400">{formatDate(payout.date)}</p>
                                  </div>
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(payout.amount)}</p>
                                  <p className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
                                    {payout.payoutStatus === 'paid' ? (
                                      <><CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> {'\u05E9\u05D5\u05DC\u05DD'}</>
                                    ) : (
                                      <><Clock className="w-2.5 h-2.5 text-amber-500" /> {'\u05DE\u05DE\u05EA\u05D9\u05DF'}</>
                                    )}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                            <DollarSign className="w-7 h-7 text-gray-300" />
                          </div>
                          <p className="text-sm text-gray-400">{'\u05D0\u05D9\u05DF \u05EA\u05E9\u05DC\u05D5\u05DE\u05D9\u05DD \u05E2\u05D3\u05D9\u05D9\u05DF'}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-teal-50/50 to-emerald-50/50 border border-teal-200/60 p-5" style={{ borderRadius: '2px' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-teal-600" />
                      <strong className="text-sm text-teal-800">{'\u05DE\u05D1\u05E0\u05D4 \u05E2\u05DE\u05DC\u05D5\u05EA'}</strong>
                    </div>
                    <p className="text-sm text-teal-700">
                      Pet Wash\u2122 {'\u05D2\u05D5\u05D1\u05D4 \u05E2\u05DE\u05DC\u05D4 \u05E7\u05D1\u05D5\u05E2\u05D4 \u05E9\u05DC'} 15% {'\u05E2\u05DC \u05DB\u05DC \u05D4\u05D6\u05DE\u05E0\u05D4.'} 85% {'\u05DE\u05D4\u05EA\u05E9\u05DC\u05D5\u05DD \u05DE\u05D5\u05E2\u05D1\u05E8 \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05D0\u05DC\u05D9\u05DA \u05DC\u05D0\u05D7\u05E8 \u05EA\u05E7\u05D5\u05E4\u05EA \u05E0\u05D0\u05DE\u05E0\u05D5\u05EA \u05E9\u05DC'} 72 {'\u05E9\u05E2\u05D5\u05EA.'}
                    </p>
                  </div>
                </>
              )}

              {/* ── 3.0B: Payout Statement ─────────────────────────────────── */}
              <div className="bg-white border border-gray-200/60 shadow-sm overflow-hidden" style={{ borderRadius: '2px' }}>
                <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500" />
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-base font-serif text-gray-900">הצהרת תשלום</h3>
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs border rounded px-2 py-1.5 text-gray-700 max-w-[200px]"
                      value={statementBatchId}
                      onChange={e => setStatementBatchId(e.target.value)}
                      style={{ borderRadius: '2px' }}
                    >
                      <option value="">כל האצוות</option>
                      {(statementData?.batches ?? []).map((b: any) => (
                        <option key={b.batchId} value={b.batchId}>
                          {b.batchId} — {b.paidAt ? new Date(b.paidAt).toLocaleDateString('he-IL') : ''}
                        </option>
                      ))}
                    </select>
                    {statementBatchId && (
                      <a
                        href={`/api/prestige-pass/provider/wallet/payout-statement?batchId=${statementBatchId}&format=csv`}
                        className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-500 flex items-center gap-1"
                        style={{ borderRadius: '2px' }}
                        onClick={async (e) => {
                          e.preventDefault();
                          const res = await fetch(`/api/prestige-pass/provider/wallet/payout-statement${statementBatchId ? `?batchId=${statementBatchId}` : ''}`, { credentials: 'include' });
                          const data = await res.json();
                          const BOM = '\uFEFF';
                          const header = 'division_code,booking_id,gross_ils,commission_ils,net_ils,paid_at';
                          const rows = (data.entries ?? []).map((e: any) => {
                            const gross = e.grossCents / 100;
                            const net = e.netCents / 100;
                            const comm = ((e.grossCents - e.netCents) / 100).toFixed(2);
                            const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                            return [esc(e.divisionCode ?? ''), esc(e.bookingId ?? ''), gross.toFixed(2), comm, net.toFixed(2), esc(e.paidAt ? new Date(e.paidAt).toISOString() : '')].join(',');
                          });
                          const csv = BOM + [header, ...rows].join('\r\n');
                          const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
                          const a = document.createElement('a'); a.href = url; a.download = `statement-${statementBatchId}.csv`; a.click(); URL.revokeObjectURL(url);
                        }}
                      >
                        ⬇ הורד CSV
                      </a>
                    )}
                  </div>
                </div>
                {statementLoading ? (
                  <div className="p-6 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-white animate-pulse rounded" />)}</div>
                ) : !statementData?.entries?.length ? (
                  <div className="p-8 text-center text-sm text-gray-400">אין תשלומים שהתקבלו עדיין</div>
                ) : (
                  <div className="p-4 space-y-4">
                    {/* Totals */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'ברוטו', cents: statementData.totals?.grossCents ?? 0 },
                        { label: 'עמלה', cents: statementData.totals?.commissionCents ?? 0, dim: true },
                        { label: 'נטו לקבלה', cents: statementData.totals?.netCents ?? 0, bold: true },
                      ].map(c => (
                        <div key={c.label} className={`rounded p-3 ${c.bold ? 'bg-emerald-50 border border-emerald-200' : 'bg-white'}`}>
                          <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                          <div className={`font-bold ${c.dim ? 'text-red-600' : c.bold ? 'text-emerald-700' : ''}`}>
                            {c.dim ? '-' : ''}₪{(c.cents / 100).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Per-batch breakdown */}
                    {(statementData.byBatch ?? []).map((batch: any) => (
                      <div key={batch.batchId} className="border rounded overflow-hidden" style={{ borderRadius: '2px' }}>
                        <div className="px-4 py-2 bg-white border-b flex justify-between items-center">
                          <span className="text-xs font-mono text-gray-700">{batch.batchId}</span>
                          <span className="text-xs text-gray-500">{batch.paidAt ? new Date(batch.paidAt).toLocaleDateString('he-IL') : ''}</span>
                          <span className="text-xs font-semibold">נטו: ₪{(batch.netCents / 100).toFixed(2)}</span>
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-gray-400 border-b bg-white">
                              <th className="px-3 py-1.5">חלוקה</th>
                              <th className="px-3 py-1.5">הזמנה</th>
                              <th className="px-3 py-1.5">ברוטו</th>
                              <th className="px-3 py-1.5">עמלה</th>
                              <th className="px-3 py-1.5">נטו</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batch.entries.map((e: any) => (
                              <tr key={e.id} className="border-b last:border-0 hover:bg-white">
                                <td className="px-3 py-2">{e.divisionCode}</td>
                                <td className="px-3 py-2 font-mono">{e.bookingId ?? '—'}</td>
                                <td className="px-3 py-2">₪{(e.grossCents / 100).toFixed(2)}</td>
                                <td className="px-3 py-2 text-red-500">-₪{(e.commissionCents / 100).toFixed(2)}</td>
                                <td className="px-3 py-2 font-semibold text-emerald-700">₪{(e.netCents / 100).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Payout Ledger ─────────────────────────────────────────── */}
              <div className="bg-white border border-gray-200/60 shadow-sm overflow-hidden" style={{ borderRadius: '2px' }}>
                <div className="h-[2px] bg-gradient-to-r from-violet-400 via-purple-500 to-indigo-500" />
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-base font-serif text-gray-900">פירוט תשלומים מלא</h3>
                  <div className="flex gap-2">
                    {(['', 'earned', 'held', 'paid', 'clawed_back'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setPayoutStatusFilter(s)}
                        className={`text-xs px-2 py-1 rounded border ${payoutStatusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:bg-white'}`}
                        style={{ borderRadius: '2px' }}
                      >
                        {s === '' ? 'הכל' : s === 'earned' ? 'הרוויח' : s === 'held' ? 'בהמתנה' : s === 'paid' ? 'שולם' : 'הוחזר'}
                      </button>
                    ))}
                  </div>
                </div>
                {payoutLedgerLoading ? (
                  <div className="p-6 space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-10 bg-white animate-pulse rounded" />
                    ))}
                  </div>
                ) : !payoutLedgerData?.entries?.length ? (
                  <div className="p-10 text-center">
                    <DollarSign className="w-8 h-8 mx-auto mb-3 text-gray-200" />
                    <p className="text-sm text-gray-400">אין רשומות תשלום עדיין</p>
                  </div>
                ) : (
                  <>
                    {/* Totals row */}
                    {payoutLedgerData?.totals && (
                      <div className="grid grid-cols-3 gap-px bg-white border-b border-gray-100">
                        {[
                          { label: 'ברוטו', val: payoutLedgerData.totals.grossCents },
                          { label: 'נטו', val: payoutLedgerData.totals.netCents },
                          { label: 'שולם', val: payoutLedgerData.totals.paidCents },
                        ].map(({ label, val }) => (
                          <div key={label} className="bg-white px-4 py-2.5 text-center">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
                            <p className="text-sm font-semibold text-gray-800">₪{(val / 100).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="divide-y divide-gray-50">
                      {(payoutLedgerData.entries as any[]).map((entry: any) => {
                        const statusChip: Record<string, string> = {
                          earned:      'bg-amber-50 text-amber-700 border-amber-200',
                          held:        'bg-blue-50 text-blue-700 border-blue-200',
                          paid:        'bg-emerald-50 text-emerald-700 border-emerald-200',
                          clawed_back: 'bg-red-50 text-red-600 border-red-200',
                        };
                        const statusLabel: Record<string, string> = {
                          earned: 'הרוויח', held: 'בהמתנה', paid: 'שולם', clawed_back: 'הוחזר',
                        };
                        const commissionAmt = entry.grossCents - entry.netCents;
                        return (
                          <div key={entry.id} className="px-5 py-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusChip[entry.status] ?? 'bg-white text-gray-600 border-gray-200'}`}>
                                  {statusLabel[entry.status] ?? entry.status}
                                </span>
                                <span className="text-xs text-gray-400">{entry.divisionCode}</span>
                                {entry.bookingId && (
                                  <span className="text-xs font-mono text-gray-400 truncate max-w-[80px]" title={entry.bookingId}>
                                    {entry.bookingId.slice(0, 8)}…
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {new Date(entry.createdAt).toLocaleDateString('he-IL')}
                                {entry.paidAt && ` · שולם ${new Date(entry.paidAt).toLocaleDateString('he-IL')}`}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-gray-900">₪{(entry.netCents / 100).toFixed(2)}</p>
                              <p className="text-[10px] text-gray-400">
                                ברוטו ₪{(entry.grossCents / 100).toFixed(2)} · עמלה ₪{(commissionAmt / 100).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── 3.1B: Clawback History ──────────────────────────────────── */}
            <div className="bg-white border border-gray-200/60 shadow-sm overflow-hidden" style={{ borderRadius: '2px' }}>
              <div className="h-[2px] bg-gradient-to-r from-red-400 to-rose-500" />
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-serif text-gray-900">היסטוריית קיזוז</h3>
                  <p className="text-xs text-gray-400 mt-0.5">תשלומים שקוזזו מהחשבון שלך</p>
                </div>
                {clawbackData?.total > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">₪{((clawbackData.totalClawbackCents ?? 0) / 100).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400">סה״כ קיזוז</p>
                  </div>
                )}
              </div>
              <div className="p-5">
                {clawbackLoading ? (
                  <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-white animate-pulse rounded" />)}</div>
                ) : !clawbackData?.total || clawbackData.total === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">אין קיזוזים — מצוין!</p>
                ) : (
                  <div className="space-y-4">
                    {clawbackData.byMonth.map((month: any) => (
                      <div key={month.month} className="border border-gray-100 rounded overflow-hidden">
                        <div className="px-4 py-2 bg-red-50 flex items-center justify-between">
                          <span className="text-xs font-semibold text-red-700">{month.month}</span>
                          <span className="text-xs text-red-600">{month.count} קיזוזים · ₪{(month.totalClawbackCents / 100).toFixed(2)}</span>
                        </div>
                        <div className="divide-y divide-gray-50">
                          {month.entries.map((e: any) => (
                            <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs text-gray-700 font-medium truncate">
                                  {e.clawbackReason ?? 'קיזוז'}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {e.divisionCode} {e.bookingId ? `· הזמנה ${e.bookingId}` : ''} {e.batchId ? `· אצווה ${e.batchId}` : ''}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold text-red-600">−₪{(e.clawbackCents / 100).toFixed(2)}</p>
                                <p className="text-[10px] text-gray-400">{new Date(e.createdAt).toLocaleDateString('he-IL')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── 3.3D: Provider Settlement Self-Service ── */}
            <div className="bg-white border border-gray-200/60 shadow-sm overflow-hidden" style={{ borderRadius: '2px' }}>
              <div className="h-[2px] bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-base font-serif text-gray-900">פירוט תשלומים</h3>
                <p className="text-xs text-gray-500 mt-0.5">Settlement status per payout entry</p>
              </div>
              <div className="p-5 space-y-4">
                {/* Summary tiles */}
                {settlementLoading ? (
                  <div className="grid grid-cols-3 gap-3">
                    {[...Array(3)].map((_,i) => <div key={i} className="h-14 bg-white animate-pulse rounded" />)}
                  </div>
                ) : settlementData?.summary && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Total Entries", value: settlementData.summary.totalEntries },
                      { label: "Settled", value: settlementData.summary.settledCount, color: "text-green-600" },
                      { label: "Net Settled", value: `₪${((settlementData.summary.settledNetCents ?? 0)/100).toFixed(2)}`, color: "text-emerald-700" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="border rounded-lg p-3 text-center">
                        <div className={`text-base font-bold ${color ?? 'text-gray-800'}`}>{value}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Entries table */}
                {settlementLoading ? (
                  <div className="space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-8 bg-white animate-pulse rounded" />)}</div>
                ) : !(settlementData?.entries?.length) ? (
                  <div className="text-xs text-gray-400 text-center py-6 border-2 border-dashed rounded-lg">
                    No payout entries yet.
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payout Entries</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-white text-gray-500 text-[10px] uppercase">
                            <th className="px-2 py-2 text-left">Batch</th>
                            <th className="px-2 py-2 text-right">Net (₪)</th>
                            <th className="px-2 py-2 text-center">Status</th>
                            <th className="px-2 py-2 text-center">Remittance</th>
                            <th className="px-2 py-2 text-center">Bank Settled</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlementData.entries.map((e: any) => {
                            const remit = settlementData.remittances.find((r: any) => r.batch_id === e.payout_batch_id);
                            return (
                              <tr key={e.id} className="border-t hover:bg-white">
                                <td className="px-2 py-1.5 font-mono text-blue-700 text-[10px]">{e.payout_batch_id}</td>
                                <td className="px-2 py-1.5 text-right font-semibold">₪{((e.net_cents ?? 0)/100).toFixed(2)}</td>
                                <td className="px-2 py-1.5 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                    e.status === 'settled'   ? 'bg-green-100 text-green-700' :
                                    e.status === 'exported' ? 'bg-blue-100 text-blue-700' :
                                    e.status === 'clawback' ? 'bg-red-100 text-red-700' :
                                    'bg-white text-gray-600'
                                  }`}>{e.status}</span>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {remit ? (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                      remit.status === 'sent' ? 'bg-green-100 text-green-700' :
                                      remit.status === 'failed' ? 'bg-red-100 text-red-700' :
                                      'bg-white text-gray-600'
                                    }`}>{remit.status}</span>
                                  ) : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {e.settled_at ? (
                                    <span className="text-green-600 font-semibold">✓ {new Date(e.settled_at).toLocaleDateString('he-IL')}</span>
                                  ) : <span className="text-gray-300">Pending</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {/* Remittance history */}
                {settlementData?.remittances?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Remittance History</div>
                    <div className="space-y-1.5">
                      {settlementData.remittances.map((r: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs border rounded px-3 py-2 bg-white">
                          <span className="font-mono text-gray-600">{r.batch_id}</span>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                              r.status === 'sent' ? 'bg-green-100 text-green-700' :
                              r.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-white text-gray-600'
                            }`}>{r.status}</span>
                            {r.sent_at && <span className="text-gray-400">{new Date(r.sent_at).toLocaleDateString('he-IL')}</span>}
                            {r.retry_count > 0 && <span className="text-amber-600">↺ {r.retry_count}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profile">
            <div className="space-y-6">
              {appStatusData?.applications && appStatusData.applications.length > 0 && (
                <div className="bg-white border border-gray-200/60 shadow-sm overflow-hidden" style={{ borderRadius: '2px' }}>
                  <div className="h-[2px] bg-gradient-to-r from-violet-400 to-purple-500" />
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-base font-serif text-gray-900">{'\u05D1\u05E7\u05E9\u05D5\u05EA \u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA'}</h3>
                  </div>
                  <div className="p-5">
                    <div className="space-y-3">
                      {appStatusData.applications.map((app: any) => {
                        const platform = PLATFORM_LABELS[app.providerType];
                        return (
                          <div key={app.applicationId} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 flex items-center justify-center bg-gradient-to-br ${platform?.gradient || 'from-gray-200 to-gray-300'} text-white text-sm font-bold`}
                                style={{ borderRadius: '2px' }}
                              >
                                {platform?.nameHe?.charAt(0) || '\u25CF'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-800">{platform?.nameHe || app.providerType}</p>
                                <p className="text-xs text-gray-400">{'\u05D1\u05E7\u05E9\u05D4'} #{app.applicationId} {'\u00B7'} {formatDate(app.createdAt)}</p>
                              </div>
                            </div>
                            <Badge
                              className="font-medium border"
                              style={{
                                borderRadius: '2px',
                                background: app.status === 'approved'
                                  ? 'linear-gradient(135deg, #ECFDF5, #D1FAE5)'
                                  : app.status === 'rejected'
                                    ? 'linear-gradient(135deg, #FEF2F2, #FEE2E2)'
                                    : 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                                color: app.status === 'approved' ? '#059669' : app.status === 'rejected' ? '#DC2626' : '#D97706',
                                borderColor: app.status === 'approved' ? '#6EE7B7' : app.status === 'rejected' ? '#FCA5A5' : '#FDE68A',
                              }}
                            >
                              {app.status === 'approved' ? '\u05DE\u05D0\u05D5\u05E9\u05E8' : app.status === 'rejected' ? '\u05E0\u05D3\u05D7\u05D4' : '\u05D1\u05D1\u05D3\u05D9\u05E7\u05D4'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {appStatusData?.providerProfiles && appStatusData.providerProfiles.length > 0 && (
                <div className="bg-white border border-gray-200/60 shadow-sm overflow-hidden" style={{ borderRadius: '2px' }}>
                  <div className="h-[2px] bg-gradient-to-r from-teal-400 to-emerald-500" />
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-base font-serif text-gray-900">{'\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC\u05D9\u05DD \u05DE\u05E7\u05E6\u05D5\u05E2\u05D9\u05D9\u05DD'}</h3>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {appStatusData.providerProfiles.map((profile: any) => {
                        const platform = PLATFORM_LABELS[profile.platformId];
                        return (
                          <div key={profile.id} className="border border-gray-100 overflow-hidden" style={{ borderRadius: '2px' }}>
                            <div className={`h-[2px] bg-gradient-to-r ${platform?.gradient || 'from-gray-200 to-gray-300'}`} />
                            <div className="p-4">
                              <div className="flex items-center gap-3 mb-4">
                                <div
                                  className={`w-12 h-12 flex items-center justify-center bg-gradient-to-br ${platform?.gradient || 'from-gray-200 to-gray-300'} text-white text-lg font-bold`}
                                  style={{ borderRadius: '2px' }}
                                >
                                  {platform?.nameHe?.charAt(0) || '\u25CF'}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{platform?.nameHe || profile.platformId}</p>
                                  <p className="text-xs text-gray-400">{profile.businessName || '\u05DC\u05DC\u05D0 \u05E9\u05DD \u05E2\u05E1\u05E7'}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-3" style={{ borderRadius: '2px' }}>
                                  <p className="text-lg font-serif text-gray-900">{profile.averageRating}</p>
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">{'\u05D3\u05D9\u05E8\u05D5\u05D2'}</p>
                                </div>
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-3" style={{ borderRadius: '2px' }}>
                                  <p className="text-lg font-serif text-gray-900">{profile.totalBookings}</p>
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">{'\u05D4\u05D6\u05DE\u05E0\u05D5\u05EA'}</p>
                                </div>
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-3" style={{ borderRadius: '2px' }}>
                                  <p className="text-lg font-serif text-gray-900">{profile.totalReviews}</p>
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">{'\u05D1\u05D9\u05E7\u05D5\u05E8\u05D5\u05EA'}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                                <span className={cn(
                                  "text-[11px] px-2 py-0.5 font-medium border",
                                  profile.verificationStatus === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-white text-amber-700 border-amber-200'
                                )} style={{ borderRadius: '2px' }}>
                                  {profile.verificationStatus === 'approved' ? '\u05DE\u05D0\u05D5\u05DE\u05EA' : '\u05D1\u05D1\u05D3\u05D9\u05E7\u05D4'}
                                </span>
                                <span className={cn(
                                  "text-[11px] px-2 py-0.5 font-medium border",
                                  profile.isActive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-white text-gray-500 border-gray-200'
                                )} style={{ borderRadius: '2px' }}>
                                  {profile.isActive ? '\u05E4\u05E2\u05D9\u05DC' : '\u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {(!appStatusData?.providerProfiles || appStatusData.providerProfiles.length === 0) &&
               (!appStatusData?.applications || appStatusData.applications.length === 0) && (
                <div className="bg-white border border-gray-200/60 shadow-sm text-center p-16" style={{ borderRadius: '2px' }}>
                  <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <FileText className="w-8 h-8 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-serif text-gray-800 mb-2">{'\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D5 \u05E4\u05E8\u05D5\u05E4\u05D9\u05DC\u05D9\u05DD'}</h3>
                  <p className="text-sm text-gray-400 mb-6">{'\u05D4\u05D2\u05E9 \u05D1\u05E7\u05E9\u05D4 \u05DC\u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA \u05DB\u05E0\u05D5\u05EA\u05DF \u05E9\u05D9\u05E8\u05D5\u05EA \u05DB\u05D3\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05DC\u05E2\u05D1\u05D5\u05D3'}</p>
                  <Button asChild className="bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700 shadow-sm" style={{ borderRadius: '2px' }}>
                    <a href="/become-provider">{'\u05D4\u05E6\u05D8\u05E8\u05E3 \u05DB\u05E0\u05D5\u05EA\u05DF \u05E9\u05D9\u05E8\u05D5\u05EA'}</a>
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}