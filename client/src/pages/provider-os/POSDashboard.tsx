import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import {
  Star, Clock, TrendingUp, CheckCircle2, XCircle, Zap,
  AlertTriangle, Play, MessageSquare,
  Power, Wallet, CalendarDays, ChevronRight, Loader2,
  Dog, Scissors, MapPin, GraduationCap, Package, UserCircle,
  Inbox, Bell,
} from 'lucide-react';

type Module = 'dashboard' | 'jobs' | 'calendar' | 'wallet' | 'profile' | 'settings' | 'services' | 'documents' | 'notifications' | 'safety' | 'assistant';
type Platform = 'all' | 'petsitter' | 'walkpet' | 'petwash' | 'academy';

interface Props {
  activePlatform: Platform;
  isAvailable: boolean;
  onToggleAvailable: (v: boolean) => void;
  onNavigate: (m: Module) => void;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  // V2 booking_requests statuses
  pending:              { label: 'Pending',     color: '#1e40af', bg: '#dbeafe' },
  accepted:             { label: 'Accepted',    color: '#065f46', bg: '#d1fae5' },
  meet_greet_scheduled: { label: 'Meet & Greet',color: '#92400e', bg: '#fef3c7' },
  payment_pending:      { label: 'Awaiting Pmt',color: '#b45309', bg: '#fef3c7' },
  confirmed:            { label: 'Confirmed',   color: '#065f46', bg: '#d1fae5' },
  in_progress:          { label: 'In Progress', color: '#7c3aed', bg: '#ede9fe' },
  completed:            { label: 'Completed',   color: '#374151', bg: '#f3f4f6' },
  reviewed:             { label: 'Reviewed',    color: '#374151', bg: '#f3f4f6' },
  cancelled:            { label: 'Cancelled',   color: '#991b1b', bg: '#fee2e2' },
  declined:             { label: 'Declined',    color: '#991b1b', bg: '#fee2e2' },
  disputed:             { label: 'Dispute',     color: '#92400e', bg: '#fef3c7' },
  // V1 compat aliases (kept for any stale cache hits during transition)
  new_request:          { label: 'New Request', color: '#92400e', bg: '#fef3c7' },
  provider_confirmed:   { label: 'Confirmed',   color: '#065f46', bg: '#d1fae5' },
  dispute:              { label: 'Dispute',     color: '#92400e', bg: '#fef3c7' },
};

function fetchWithAuth(url: string, opts?: RequestInit) {
  return fetch(url, { ...opts, credentials: 'include' }).then(r => r.json());
}

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

export default function POSDashboard({ activePlatform, isAvailable, onToggleAvailable, onNavigate }: Props) {
  const { user } = useFirebaseAuth();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/provider-dashboard/v2/stats'],
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/stats'),
  });

  const { data: profileData } = useQuery<{
    exists: boolean;
    completeness: { score: number; breakdown: Record<string, { done: boolean; weight: number; label: string }> };
  }>({
    queryKey: ['/api/provider-profile/me'],
    staleTime: 60_000,
  });

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['/api/provider-dashboard/v2/bookings', 'new_request,active'],
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/bookings?status=new_request,active&page=1&limit=20'),
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['/api/provider-dashboard/v2/upcoming'],
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/upcoming'),
    staleTime: 60_000,
  });

  const { data: countsData } = useQuery({
    queryKey: ['/api/provider-dashboard/v2/booking-counts'],
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/booking-counts'),
    staleTime: 30_000,
  });

  const { data: earningsData } = useQuery({
    queryKey: ['/api/provider-dashboard/v2/earnings'],
    queryFn: () => fetchWithAuth('/api/provider-dashboard/v2/earnings'),
  });

  const availabilityMutation = useMutation({
    mutationFn: async ({ providerId, isAvailable }: { providerId: number; isAvailable: boolean }) =>
      fetchWithAuth('/api/provider-dashboard/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, isAvailable }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/stats'] });
    },
    onError: () => {
      onToggleAvailable(!isAvailable);
      toast({ title: 'Could not update availability', variant: 'destructive' });
    },
  });

  const bookingActionMutation = useMutation({
    mutationFn: async ({ bookingId, action, reason }: { bookingId: string; action: string; reason?: string }) =>
      fetchWithAuth(`/api/provider-dashboard/v2/bookings/${bookingId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason ? { reason } : {}),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/booking-counts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/stats'] });
      toast({ title: vars.action === 'accept' ? 'Job accepted' : 'Job declined' });
    },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  });

  const handleToggleAvailability = () => {
    const providerId = stats?.platforms?.[0]?.id;
    const next = !isAvailable;
    onToggleAvailable(next);
    if (providerId) availabilityMutation.mutate({ providerId, isAvailable: next });
  };

  const allBookings: any[] = (bookingsData as any)?.bookings || [];
  const newRequests = allBookings.filter((b: any) =>
    ['pending', 'accepted', 'meet_greet_scheduled', 'meet_greet_completed', 'payment_pending'].includes(b.status)
  );
  const activeJobs  = allBookings.filter((b: any) => b.status === 'in_progress');
  const todayJobs   = allBookings.filter((b: any) =>
    b.status === 'confirmed' && isToday(b.startTime)
  );
  const upcomingJobs: any[] = (upcomingData as any)?.upcoming || [];
  const statusCounts: Record<string, number> = (countsData as any)?.counts ?? {};
  const newCount = statusCounts['new_request'] ?? 0;

  const available = stats?.isAvailable ?? isAvailable;
  const paidBalance    = earningsData?.earnings?.paidPayouts       ?? 0;
  const pendingBalance = earningsData?.earnings?.pendingPayouts     ?? 0;
  const monthTotal     = earningsData?.earnings?.thisMonthEarnings  ?? 0;

  const hasAnyActivity = newRequests.length > 0 || todayJobs.length > 0 || activeJobs.length > 0 || upcomingJobs.length > 0;

  return (
    <div className="space-y-5">

      {/* ── Summary strip ─────────────────────────────────────────── */}
      {(newCount > 0 || todayJobs.length > 0 || activeJobs.length > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => onNavigate('jobs')}
            className={`rounded-xl p-3 text-center border transition-colors ${newCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Inbox className={`w-3.5 h-3.5 ${newCount > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
              {newCount > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
            </div>
            <p className={`text-lg font-bold ${newCount > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{newCount}</p>
            <p className="text-[10px] text-gray-500">New requests</p>
          </button>
          <button onClick={() => onNavigate('jobs')}
            className="bg-white border border-gray-200 rounded-xl p-3 text-center hover:border-blue-200 transition-colors">
            <CalendarDays className="w-3.5 h-3.5 text-blue-500 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-gray-900">{todayJobs.length}</p>
            <p className="text-[10px] text-gray-500">Today</p>
          </button>
          <button onClick={() => onNavigate('jobs')}
            className={`rounded-xl p-3 text-center border transition-colors ${activeJobs.length > 0 ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'}`}>
            <Play className={`w-3.5 h-3.5 mx-auto mb-0.5 ${activeJobs.length > 0 ? 'text-purple-600' : 'text-gray-400'}`} />
            <p className={`text-lg font-bold ${activeJobs.length > 0 ? 'text-purple-700' : 'text-gray-900'}`}>{activeJobs.length}</p>
            <p className="text-[10px] text-gray-500">Active now</p>
          </button>
        </div>
      )}

      {/* ── Availability status ───────────────────────────────────── */}
      <div className={`rounded-xl p-4 flex items-center justify-between ${available ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200'}`}>
        <div>
          <p className={`text-sm font-semibold ${available ? 'text-green-800' : 'text-gray-700'}`}>
            {available ? 'You are available for new jobs' : 'You are currently offline'}
          </p>
          <p className={`text-xs mt-0.5 ${available ? 'text-green-600' : 'text-gray-500'}`}>
            {available ? 'New requests will come to you' : 'No new requests while offline'}
          </p>
        </div>
        <button
          onClick={handleToggleAvailability}
          disabled={availabilityMutation.isPending}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            available ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          {availabilityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
          {available ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      {/* ── Finance strip — ILS decimals, no /100 ────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Paid out',   value: `₪${paidBalance.toFixed(0)}`,    sub: 'Received to date', icon: Wallet,      color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pending',    value: `₪${pendingBalance.toFixed(0)}`,  sub: 'Awaiting payout',  icon: Clock,       color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'This month', value: `₪${monthTotal.toFixed(0)}`,      sub: 'Earnings MTD',     icon: TrendingUp,  color: 'text-blue-600',  bg: 'bg-blue-50' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <button key={card.label} onClick={() => onNavigate('wallet')}
              className="bg-white border border-gray-200 rounded-xl p-3 text-start hover:border-amber-300 transition-colors">
              <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-lg font-bold text-gray-900">{statsLoading ? '—' : card.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{card.label}</p>
            </button>
          );
        })}
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Rating',    value: statsLoading ? '—' : `${(stats?.averageRating ?? 0).toFixed(1)}★`,  color: 'text-amber-600' },
          { label: 'Completed', value: statsLoading ? '—' : `${stats?.completedBookings ?? 0}`,            color: 'text-green-600' },
          { label: 'Cancel %',  value: statsLoading ? '—' : `${stats?.completionRate ? (100 - stats.completionRate).toFixed(0) : 0}%`, color: 'text-red-500' },
          { label: 'Reviews',   value: statsLoading ? '—' : `${stats?.totalReviews ?? 0}`,                 color: 'text-blue-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className={`text-base font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── Profile completeness ──────────────────────────────────── */}
      {profileData?.exists !== false && profileData?.completeness && profileData.completeness.score < 100 && (
        <button onClick={() => onNavigate('profile')}
          className="w-full bg-white border border-gray-200 rounded-xl p-4 text-start hover:border-amber-300 transition-colors group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <UserCircle className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Complete your profile</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${
                profileData.completeness.score >= 80 ? 'text-green-600' :
                profileData.completeness.score >= 50 ? 'text-amber-600' : 'text-red-500'
              }`}>{profileData.completeness.score}%</span>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition-colors" />
            </div>
          </div>
          <div className="w-full bg-white rounded-full h-1.5 mb-2">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${
              profileData.completeness.score >= 80 ? 'bg-green-500' :
              profileData.completeness.score >= 50 ? 'bg-amber-500' : 'bg-red-400'
            }`} style={{ width: `${profileData.completeness.score}%` }} />
          </div>
          {(() => {
            const next = Object.values(profileData.completeness.breakdown).find(c => !c.done);
            return next ? (
              <p className="text-xs text-gray-500">Next: {next.label} <span className="text-amber-500 font-medium">+{next.weight}%</span></p>
            ) : null;
          })()}
        </button>
      )}

      {/* ── Verification alert ─────────────────────────────────────── */}
      {stats?.platforms?.some((p: any) => p.verificationStatus === 'pending') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Action required</p>
            <p className="text-xs text-amber-700 mt-0.5">Documents or verification steps are pending.</p>
          </div>
          <button onClick={() => onNavigate('documents')} className="text-amber-700 text-xs font-medium flex items-center gap-1">
            View <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── New requests ──────────────────────────────────────────── */}
      {newRequests.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              New Requests ({newRequests.length})
            </h2>
            <button onClick={() => onNavigate('jobs')} className="text-xs text-amber-600 font-medium flex items-center gap-1">
              All jobs <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {newRequests.slice(0, 3).map((b: any) => (
              <JobRequestCard key={b.id} booking={b}
                onAction={(id, action) => bookingActionMutation.mutate({ bookingId: id, action })}
                isPending={bookingActionMutation.isPending} />
            ))}
            {newRequests.length > 3 && (
              <button onClick={() => onNavigate('jobs')}
                className="w-full py-2.5 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-amber-300 hover:text-amber-600 transition-colors">
                +{newRequests.length - 3} more requests — view all
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── Active now ────────────────────────────────────────────── */}
      {activeJobs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            Active Now ({activeJobs.length})
          </h2>
          <div className="space-y-2">
            {activeJobs.map((b: any) => <JobMiniCard key={b.id} booking={b} isActive />)}
          </div>
        </section>
      )}

      {/* ── Today's jobs ──────────────────────────────────────────── */}
      {todayJobs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-500" /> Today ({todayJobs.length})
          </h2>
          <div className="space-y-2">
            {todayJobs.map((b: any) => <JobMiniCard key={b.id} booking={b} />)}
          </div>
        </section>
      )}

      {/* ── Upcoming (next 7 days) ─────────────────────────────────── */}
      {upcomingJobs.filter((b: any) => !isToday(b.startTime)).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-gray-400" /> Upcoming this week
          </h2>
          <div className="space-y-2">
            {upcomingJobs.filter((b: any) => !isToday(b.startTime)).slice(0, 5).map((b: any) => (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{b.serviceType?.replace(/_/g, ' ') || 'Service'}</p>
                  <p className="text-xs text-gray-500">
                    {b.startTime ? new Date(b.startTime).toLocaleDateString('he-IL', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                  </p>
                </div>
                <span className="text-sm font-semibold text-green-700 shrink-0">
                  ₪{parseFloat(b.providerPayout || '0').toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state — nothing happening ──────────────────────── */}
      {!bookingsLoading && !hasAnyActivity && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600">No active jobs right now</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[220px] mx-auto">
            {available
              ? 'You\'re online — requests will appear here when clients book you'
              : 'You\'re offline. Go online to start receiving requests'}
          </p>
          {!available && (
            <button onClick={handleToggleAvailability}
              className="mt-4 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors">
              Go Online
            </button>
          )}
        </div>
      )}

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Jobs',      icon: Package,      mod: 'jobs' as Module,       color: 'text-amber-600',  bg: 'bg-amber-50' },
            { label: 'Calendar',  icon: CalendarDays, mod: 'calendar' as Module,   color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: 'Wallet',    icon: Wallet,       mod: 'wallet' as Module,     color: 'text-green-600',  bg: 'bg-green-50' },
            { label: 'Services',  icon: Star,         mod: 'services' as Module,   color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Profile',   icon: UserCircle,   mod: 'profile' as Module,    color: 'text-teal-600',   bg: 'bg-teal-50' },
            { label: 'AI Help',   icon: Zap,          mod: 'assistant' as Module,  color: 'text-indigo-600', bg: 'bg-indigo-50' },
          ].map(action => {
            const Icon = action.icon;
            return (
              <button key={action.label} onClick={() => onNavigate(action.mod)}
                className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-2 hover:border-amber-300 transition-colors touch-manipulation">
                <div className={`w-9 h-9 ${action.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${action.color}`} />
                </div>
                <span className="text-xs font-medium text-gray-700">{action.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function JobRequestCard({ booking, onAction, isPending }: {
  booking: any;
  onAction: (id: string, action: string) => void;
  isPending: boolean;
}) {
  const status = STATUS_STYLES[booking.status] || STATUS_STYLES.pending;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{booking.serviceType?.replace(/_/g, ' ') || 'Service'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {booking.startTime
              ? new Date(booking.startTime).toLocaleDateString('he-IL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : 'Date TBD'}
          </p>
        </div>
        <div className="text-end">
          <span className="text-sm font-bold text-green-700">₪{parseFloat(booking.providerPayout || '0').toFixed(0)}</span>
          <div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: status.bg, color: status.color }}>
              {status.label}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onAction(booking.id, 'accept')} disabled={isPending}
          className="flex-1 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Accept
        </button>
        <button onClick={() => onAction(booking.id, 'decline')} disabled={isPending}
          className="flex-1 py-2 bg-white text-gray-700 text-xs font-medium rounded-lg hover:bg-white transition-colors flex items-center justify-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" /> Decline
        </button>
        <button className="py-2 px-3 bg-white text-gray-600 text-xs rounded-lg hover:bg-white transition-colors">
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function JobMiniCard({ booking, isActive }: { booking: any; isActive?: boolean }) {
  return (
    <div className={`bg-white border rounded-xl p-3 flex items-center gap-3 ${isActive ? 'border-purple-200 bg-purple-50' : 'border-gray-200'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? 'bg-purple-100' : 'bg-white'}`}>
        {isActive ? <Play className="w-4 h-4 text-purple-600" /> : <CalendarDays className="w-4 h-4 text-gray-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{booking.serviceType?.replace(/_/g, ' ') || 'Service'}</p>
        <p className="text-xs text-gray-500 truncate">
          {booking.startTime
            ? new Date(booking.startTime).toLocaleDateString('he-IL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : 'TBD'}
        </p>
      </div>
      <span className="text-sm font-semibold text-green-700 shrink-0">
        ₪{parseFloat(booking.providerPayout || '0').toFixed(0)}
      </span>
    </div>
  );
}
