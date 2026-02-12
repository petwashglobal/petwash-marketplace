import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Users,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Wallet,
  BarChart3,
  User,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Power,
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

const PLATFORM_LABELS: Record<string, { name: string; nameHe: string; color: string; icon: string }> = {
  sitter_suite: { name: 'The Sitter Suite™', nameHe: 'חבילת השמרטף™', color: '#7C3AED', icon: '🏠' },
  walk_my_pet: { name: 'Walk My Pet™', nameHe: 'טייל עם החיה™', color: '#10B981', icon: '🐕' },
  pettrek: { name: 'PetTrek™', nameHe: 'הסעות חיות™', color: '#3B82F6', icon: '🚗' },
  plush_lab: { name: 'The Plush Lab™', nameHe: 'מעבדת הפלאש™', color: '#EC4899', icon: '✨' },
  k9000: { name: 'K9000™', nameHe: 'K9000™', color: '#F59E0B', icon: '🚿' },
  groomers: { name: 'Pet Wash™ Groomers', nameHe: 'מטפחי Pet Wash™', color: '#8B5CF6', icon: '💈' },
  trainers: { name: 'Pet Trainers', nameHe: 'מאלפים', color: '#EF4444', icon: '🎓' },
};

const STATUS_CONFIG: Record<string, { label: string; labelHe: string; color: string; bg: string }> = {
  draft: { label: 'Draft', labelHe: 'טיוטא', color: '#6B7280', bg: '#F3F4F6' },
  pending: { label: 'Pending', labelHe: 'ממתין', color: '#D97706', bg: '#FEF3C7' },
  confirmed: { label: 'Confirmed', labelHe: 'מאושר', color: '#2563EB', bg: '#DBEAFE' },
  provider_confirmed: { label: 'Provider Confirmed', labelHe: 'אושר', color: '#2563EB', bg: '#DBEAFE' },
  in_progress: { label: 'In Progress', labelHe: 'בתהליך', color: '#7C3AED', bg: '#EDE9FE' },
  started: { label: 'Started', labelHe: 'התחיל', color: '#7C3AED', bg: '#EDE9FE' },
  completed: { label: 'Completed', labelHe: 'הושלם', color: '#059669', bg: '#D1FAE5' },
  cancelled: { label: 'Cancelled', labelHe: 'בוטל', color: '#DC2626', bg: '#FEE2E2' },
  disputed: { label: 'Disputed', labelHe: 'במחלוקת', color: '#EA580C', bg: '#FED7AA' },
};

function formatCurrency(amount: number | string, currency = 'ILS') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency }).format(num);
}

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('he-IL', {
    month: 'short',
    day: 'numeric',
  });
}

export default function ProviderDashboard() {
  const { toast } = useToast();
  const { user } = useFirebaseAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchWithAuth = async (url: string) => {
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Request failed');
    return res.json();
  };

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; stats: ProviderStats }>({
    queryKey: ['/api/provider-dashboard/stats'],
    enabled: !!user,
    queryFn: () => fetchWithAuth('/api/provider-dashboard/stats'),
  });

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery<{
    success: boolean;
    bookings: Booking[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: ['/api/provider-dashboard/bookings', statusFilter, currentPage],
    enabled: !!user,
    queryFn: () => fetchWithAuth(`/api/provider-dashboard/bookings?status=${statusFilter}&page=${currentPage}&limit=15`),
  });

  const { data: earningsData, isLoading: earningsLoading } = useQuery<{ success: boolean; earnings: EarningsData }>({
    queryKey: ['/api/provider-dashboard/earnings'],
    enabled: !!user,
    queryFn: () => fetchWithAuth('/api/provider-dashboard/earnings'),
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

  const toggleAvailability = useMutation({
    mutationFn: async ({ providerId, isAvailable }: { providerId: number; isAvailable: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch('/api/provider-dashboard/availability', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providerId, isAvailable }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/stats'] });
      toast({ title: 'הסטטוס עודכן בהצלחה' });
    },
    onError: () => {
      toast({ title: 'שגיאה בעדכון סטטוס', variant: 'destructive' });
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
      <div className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
        <Card className="border border-gray-200" style={{ borderRadius: '2px' }}>
          <CardContent className="p-12 text-center">
            <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-serif text-gray-900 mb-2">נדרשת התחברות</h2>
            <p className="text-gray-500 text-sm">התחבר כדי לגשת ללוח הבקרה שלך</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfc]" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif text-[#1a1a2e] tracking-tight">לוח בקרה</h1>
            <p className="text-sm text-gray-500 mt-1 font-serif">ניהול ההזמנות והרווחים שלך</p>
          </div>
          {stats && stats.platforms.length > 0 && (
            <div className="flex items-center gap-3">
              {stats.platforms.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2" style={{ borderRadius: '2px' }}>
                  <div className={cn("w-2.5 h-2.5 rounded-full", p.isAvailable ? "bg-green-500 animate-pulse" : "bg-gray-300")} />
                  <span className="text-xs font-medium text-gray-700">
                    {PLATFORM_LABELS[p.platformId]?.icon} {PLATFORM_LABELS[p.platformId]?.nameHe || p.platformId}
                  </span>
                  <Switch
                    checked={p.isAvailable || false}
                    onCheckedChange={(checked) => toggleAvailability.mutate({ providerId: p.id, isAvailable: checked })}
                    disabled={toggleAvailability.isPending}
                    className="scale-75"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border border-gray-100 animate-pulse" style={{ borderRadius: '2px' }}>
                <CardContent className="p-6"><div className="h-16 bg-gray-100" style={{ borderRadius: '2px' }} /></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-emerald-50 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  {monthlyTrend === 'up' && <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
                  {monthlyTrend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-400" />}
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">סה״כ הכנסות</p>
                <p className="text-2xl font-serif text-[#1a1a2e] mt-1">{formatCurrency(stats?.totalEarnings || 0)}</p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-50 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <Briefcase className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">הזמנות שהושלמו</p>
                <p className="text-2xl font-serif text-[#1a1a2e] mt-1">{stats?.completedBookings || 0}</p>
                <p className="text-xs text-gray-400 mt-1">{stats?.totalBookings || 0} סה״כ</p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-yellow-50 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <Star className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">דירוג ממוצע</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <p className="text-2xl font-serif text-[#1a1a2e]">{stats?.averageRating || 0}</p>
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                </div>
                <p className="text-xs text-gray-400 mt-1">{stats?.totalReviews || 0} ביקורות</p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-50 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">שיעור השלמה</p>
                <p className="text-2xl font-serif text-[#1a1a2e] mt-1">{stats?.completionRate || 0}%</p>
                <p className="text-xs text-gray-400 mt-1">{stats?.activeBookings || 0} פעיל עכשיו</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="bg-white border border-gray-200 h-11 p-1" style={{ borderRadius: '2px' }}>
            <TabsTrigger value="jobs" className="flex items-center gap-2 data-[state=active]:bg-[#1a1a2e] data-[state=active]:text-white text-sm font-medium" style={{ borderRadius: '2px' }}>
              <Briefcase className="w-4 h-4" />
              הזמנות
              {stats && stats.activeBookings > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 font-bold" style={{ borderRadius: '2px' }}>{stats.activeBookings}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex items-center gap-2 data-[state=active]:bg-[#1a1a2e] data-[state=active]:text-white text-sm font-medium" style={{ borderRadius: '2px' }}>
              <Wallet className="w-4 h-4" />
              הכנסות
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2 data-[state=active]:bg-[#1a1a2e] data-[state=active]:text-white text-sm font-medium" style={{ borderRadius: '2px' }}>
              <BarChart3 className="w-4 h-4" />
              פרופיל
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-serif text-[#1a1a2e]">היסטוריית הזמנות</h2>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-40 border-gray-200 text-sm" style={{ borderRadius: '2px' }}>
                    <SelectValue placeholder="סנן לפי סטטוס" />
                  </SelectTrigger>
                  <SelectContent style={{ borderRadius: '2px' }}>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="pending">ממתין</SelectItem>
                    <SelectItem value="confirmed">מאושר</SelectItem>
                    <SelectItem value="in_progress">בתהליך</SelectItem>
                    <SelectItem value="completed">הושלם</SelectItem>
                    <SelectItem value="cancelled">בוטל</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bookingsLoading ? (
                <Card className="border border-gray-100" style={{ borderRadius: '2px' }}>
                  <CardContent className="p-12 text-center">
                    <div className="w-8 h-8 border-2 border-gray-300 border-t-[#1a1a2e] rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-400">טוען הזמנות...</p>
                  </CardContent>
                </Card>
              ) : jobsList.length > 0 ? (
                <>
                  <div className="bg-white border border-gray-200 overflow-hidden" style={{ borderRadius: '2px' }}>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">מס׳ הזמנה</th>
                            <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">פלטפורמה</th>
                            <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">שירות</th>
                            <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">מזהה לקוח</th>
                            <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">תאריך</th>
                            <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">סטטוס</th>
                            <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">תשלום</th>
                            <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">הרווח שלי</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobsList.map((job, idx) => {
                            const statusCfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                            const platform = PLATFORM_LABELS[job.platformId];
                            return (
                              <tr key={job.id} className={cn("border-b border-gray-50 hover:bg-gray-50/50 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')}>
                                <td className="px-4 py-3">
                                  <span className="text-sm font-mono font-medium text-[#1a1a2e]">{job.bookingNumber}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-base">{platform?.icon || '📋'}</span>
                                    <span className="text-xs text-gray-600">{platform?.nameHe || job.platformId}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm text-gray-700">{job.serviceType || '—'}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5" style={{ borderRadius: '2px' }}>
                                    {job.userId.slice(0, 8)}...
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-sm text-gray-700">{formatShortDate(job.startTime)}</div>
                                  <div className="text-[11px] text-gray-400">{new Date(job.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className="text-[11px] font-medium px-2 py-1 inline-block"
                                    style={{ borderRadius: '2px', background: statusCfg.bg, color: statusCfg.color }}
                                  >
                                    {statusCfg.labelHe}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm text-gray-700">{formatCurrency(job.total, job.currency)}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm font-semibold text-emerald-700">{formatCurrency(job.providerPayout, job.currency)}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {bookingsData && bookingsData.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-xs text-gray-500">
                        עמוד {bookingsData.page} מתוך {bookingsData.totalPages} ({bookingsData.total} הזמנות)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                          style={{ borderRadius: '2px' }}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(bookingsData.totalPages, p + 1))}
                          disabled={currentPage >= bookingsData.totalPages}
                          style={{ borderRadius: '2px' }}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
                  <CardContent className="p-12 text-center">
                    <Briefcase className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                    <h3 className="text-lg font-serif text-gray-700 mb-1">אין הזמנות עדיין</h3>
                    <p className="text-sm text-gray-400">הזמנות חדשות יופיעו כאן ברגע שלקוחות יזמינו שירות</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="earnings">
            <div className="space-y-6">
              {earningsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="border border-gray-100 animate-pulse" style={{ borderRadius: '2px' }}>
                      <CardContent className="p-6"><div className="h-20 bg-gray-100" style={{ borderRadius: '2px' }} /></CardContent>
                    </Card>
                  ))}
                </div>
              ) : earnings && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-emerald-50 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                            <Wallet className="w-5 h-5 text-emerald-600" />
                          </div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">ממתין לתשלום</p>
                        </div>
                        <p className="text-2xl font-serif text-[#1a1a2e]">{formatCurrency(earnings.pendingPayouts)}</p>
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-blue-50 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                            <Calendar className="w-5 h-5 text-blue-600" />
                          </div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">החודש</p>
                        </div>
                        <p className="text-2xl font-serif text-[#1a1a2e]">{formatCurrency(earnings.thisMonthEarnings)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {earnings.thisMonthEarnings > earnings.lastMonthEarnings ? (
                            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 text-red-400" />
                          )}
                          <span className="text-xs text-gray-400">לעומת {formatCurrency(earnings.lastMonthEarnings)} בחודש שעבר</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-green-50 flex items-center justify-center" style={{ borderRadius: '2px' }}>
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          </div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">שולם</p>
                        </div>
                        <p className="text-2xl font-serif text-[#1a1a2e]">{formatCurrency(earnings.paidPayouts)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-serif text-[#1a1a2e]">תשלומים אחרונים</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {earnings.recentPayouts.length > 0 ? (
                        <div className="space-y-3">
                          {earnings.recentPayouts.map((payout, idx) => {
                            const platform = PLATFORM_LABELS[payout.platformId];
                            return (
                              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">{platform?.icon || '📋'}</span>
                                  <div>
                                    <p className="text-sm font-medium text-gray-800 font-mono">{payout.bookingNumber}</p>
                                    <p className="text-xs text-gray-400">{formatDate(payout.date)}</p>
                                  </div>
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-semibold text-emerald-700">{formatCurrency(payout.amount)}</p>
                                  <p className="text-[10px] text-gray-400 uppercase">
                                    {payout.payoutStatus === 'paid' ? '✅ שולם' : '⏳ ממתין'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <DollarSign className="w-10 h-10 mx-auto text-gray-200 mb-3" />
                          <p className="text-sm text-gray-400">אין תשלומים עדיין</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800" style={{ borderRadius: '2px' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4" />
                      <strong>מבנה עמלות</strong>
                    </div>
                    <p>Pet Wash™ גובה עמלה קבועה של 15% על כל הזמנה. 85% מהתשלום מועבר ישירות אליך לאחר תקופת נאמנות של 72 שעות.</p>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="profile">
            <div className="space-y-6">
              {appStatusData?.applications && appStatusData.applications.length > 0 && (
                <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-serif text-[#1a1a2e]">בקשות הצטרפות</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {appStatusData.applications.map((app: any) => (
                        <div key={app.applicationId} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{PLATFORM_LABELS[app.providerType]?.icon || '📋'}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{PLATFORM_LABELS[app.providerType]?.nameHe || app.providerType}</p>
                              <p className="text-xs text-gray-400">בקשה #{app.applicationId} • {formatDate(app.createdAt)}</p>
                            </div>
                          </div>
                          <Badge
                            style={{
                              borderRadius: '2px',
                              background: app.status === 'approved' ? '#D1FAE5' : app.status === 'rejected' ? '#FEE2E2' : '#FEF3C7',
                              color: app.status === 'approved' ? '#059669' : app.status === 'rejected' ? '#DC2626' : '#D97706',
                            }}
                          >
                            {app.status === 'approved' ? 'מאושר' : app.status === 'rejected' ? 'נדחה' : 'בבדיקה'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {appStatusData?.providerProfiles && appStatusData.providerProfiles.length > 0 && (
                <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-serif text-[#1a1a2e]">פרופילים מקצועיים</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {appStatusData.providerProfiles.map((profile: any) => {
                        const platform = PLATFORM_LABELS[profile.platformId];
                        return (
                          <div key={profile.id} className="border border-gray-100 p-4" style={{ borderRadius: '2px' }}>
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-2xl">{platform?.icon || '📋'}</span>
                              <div>
                                <p className="text-sm font-semibold text-[#1a1a2e]">{platform?.nameHe || profile.platformId}</p>
                                <p className="text-xs text-gray-400">{profile.businessName || 'ללא שם עסק'}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-gray-50 p-2" style={{ borderRadius: '2px' }}>
                                <p className="text-lg font-serif text-[#1a1a2e]">{profile.averageRating}</p>
                                <p className="text-[10px] text-gray-400 uppercase">דירוג</p>
                              </div>
                              <div className="bg-gray-50 p-2" style={{ borderRadius: '2px' }}>
                                <p className="text-lg font-serif text-[#1a1a2e]">{profile.totalBookings}</p>
                                <p className="text-[10px] text-gray-400 uppercase">הזמנות</p>
                              </div>
                              <div className="bg-gray-50 p-2" style={{ borderRadius: '2px' }}>
                                <p className="text-lg font-serif text-[#1a1a2e]">{profile.totalReviews}</p>
                                <p className="text-[10px] text-gray-400 uppercase">ביקורות</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                              <span className={cn(
                                "text-[11px] px-2 py-0.5 font-medium",
                                profile.verificationStatus === 'approved' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                              )} style={{ borderRadius: '2px' }}>
                                {profile.verificationStatus === 'approved' ? '✅ מאומת' : '⏳ בבדיקה'}
                              </span>
                              <span className={cn(
                                "text-[11px] px-2 py-0.5 font-medium",
                                profile.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                              )} style={{ borderRadius: '2px' }}>
                                {profile.isActive ? 'פעיל' : 'לא פעיל'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {(!appStatusData?.providerProfiles || appStatusData.providerProfiles.length === 0) &&
               (!appStatusData?.applications || appStatusData.applications.length === 0) && (
                <Card className="border border-gray-200 bg-white" style={{ borderRadius: '2px' }}>
                  <CardContent className="p-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                    <h3 className="text-lg font-serif text-gray-700 mb-2">לא נמצאו פרופילים</h3>
                    <p className="text-sm text-gray-400 mb-6">הגש בקשה להצטרפות כנותן שירות כדי להתחיל לעבוד</p>
                    <Button asChild className="bg-[#1a1a2e] text-white hover:bg-[#2a2a3e]" style={{ borderRadius: '2px' }}>
                      <a href="/become-provider">הצטרף כנותן שירות</a>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}