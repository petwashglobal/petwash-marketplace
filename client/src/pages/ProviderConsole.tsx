import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  LayoutDashboard, CalendarDays, BookOpen, DollarSign, Settings,
  BarChart2, ShieldAlert, Bot, ChevronRight, AlertTriangle,
  CheckCircle, XCircle, Clock, Zap, Users, Star, TrendingUp,
  TrendingDown, Shield, Trash2, Plus, Send, Loader2, RefreshCw,
  CalendarOff, CalendarCheck, Bell, BellOff, Wifi, WifiOff,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OperationalSettings {
  providerUid: string;
  autoAccept: boolean;
  instantBooking: boolean;
  requireApproval: boolean;
  sameDayBookings: boolean;
  weekendJobs: boolean;
  nightJobs: boolean;
  nightStartHour: number;
  nightEndHour: number;
  repeatCustomersOnly: boolean;
  newCustomerRequests: boolean;
  notifInApp: boolean;
  notifPush: boolean;
  notifEmail: boolean;
  notifSmsEmergency: boolean;
  aiSuggestions: boolean;
  maxSimultaneous: number;
  maxJobsPerDay: number;
  bufferMinutes: number;
  travelRadiusKm: number;
  homeVisitsOnly: boolean;
  holidayMode: boolean;
  holidayStart: string | null;
  holidayEnd: string | null;
  emergencyUnavailable: boolean;
}

interface BlockedEntry {
  id: number;
  blockedType: string;
  blockedRef: string;
  blockedName: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

interface SafetyNote {
  id: number;
  subjectType: string;
  subjectId: string;
  subjectName: string | null;
  notes: string;
  riskLevel: string;
  updatedAt: string;
}

interface PerformanceData {
  bookings: { today: number; last7d: number; last30d: number; total: number; completed: number; cancelled: number; active: number; noShow: number };
  rates: { completionRate: number; cancellationRate: number; acceptanceRate: number };
  flaggedMessages: number;
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab() {
  const { data: perf } = useQuery<PerformanceData>({ queryKey: ['/api/provider-console/performance'] });
  const { data: settings } = useQuery<OperationalSettings>({ queryKey: ['/api/provider-console/settings'] });
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const { toast } = useToast();

  const aiMutation = useMutation({
    mutationFn: (query: string) => apiRequest('POST', '/api/provider-console/ai/query', { query }),
    onSuccess: async (res) => {
      const data = await res.json();
      setAiResponse(data.response);
    },
    onError: () => toast({ title: 'AI query failed', variant: 'destructive' }),
  });

  const quickQueries = [
    "Summarize today's bookings and earnings",
    "Which pending jobs should I accept first?",
    "Am I pricing competitively?",
    "Summarize my cancellation trends",
  ];

  return (
    <div className="space-y-6">
      {/* Status alerts */}
      {settings?.emergencyUnavailable && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">Emergency Unavailable is active — you are not accepting new bookings</span>
        </div>
      )}
      {settings?.holidayMode && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
          <CalendarOff className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">Holiday Mode is active
            {settings.holidayStart && settings.holidayEnd
              ? ` (${format(new Date(settings.holidayStart), 'MMM d')} – ${format(new Date(settings.holidayEnd), 'MMM d')})`
              : ''
            }
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Today', value: perf?.bookings.today ?? '—', icon: CalendarCheck, color: 'text-blue-600' },
          { label: 'This Week', value: perf?.bookings.last7d ?? '—', icon: TrendingUp, color: 'text-green-600' },
          { label: 'Completion Rate', value: perf ? `${perf.rates.completionRate}%` : '—', icon: CheckCircle, color: 'text-emerald-600' },
          { label: 'Acceptance Rate', value: perf ? `${perf.rates.acceptanceRate}%` : '—', icon: Zap, color: 'text-purple-600' },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gemini assistant */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-base">Kenzo — Your Business Assistant</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {quickQueries.map((q) => (
              <Button
                key={q}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => { setAiQuery(q); aiMutation.mutate(q); }}
              >
                {q}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ask Kenzo anything about your bookings, pricing, or schedule..."
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && aiQuery.trim()) aiMutation.mutate(aiQuery); }}
            />
            <Button
              onClick={() => aiMutation.mutate(aiQuery)}
              disabled={!aiQuery.trim() || aiMutation.isPending}
            >
              {aiMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {aiResponse && (
            <div className="p-3 bg-purple-50 rounded-lg text-sm text-gray-700 leading-relaxed">
              {aiResponse}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase 6: Station & System Alerts */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base">Station & System Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Overall health indicator */}
          {perf && perf.flaggedMessages > 0 ? (
            <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800">
                  {perf.flaggedMessages} flagged message{perf.flaggedMessages !== 1 ? 's' : ''} detected
                </p>
                <p className="text-xs text-orange-600 mt-0.5">
                  Review your recent communications for potential issues.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-sm font-medium text-green-800">All systems operational — no active alerts</p>
            </div>
          )}

          {/* K9000 station context (if applicable) */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Active Bookings', value: perf?.bookings.active ?? 0, icon: Zap, color: 'text-purple-600' },
              { label: 'No-shows Today', value: perf?.bookings.noShow ?? 0, icon: AlertTriangle, color: 'text-orange-500' },
              { label: 'Cancelled', value: perf?.bookings.cancelled ?? 0, icon: XCircle, color: 'text-red-500' },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <item.icon className={`w-4 h-4 ${item.color} mx-auto mb-1`} />
                <p className="text-lg font-bold text-gray-900">{item.value}</p>
                <p className="text-[10px] text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Quick link to task inbox */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-gray-500">
              For booking decisions, visit your Task Inbox
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1"
              onClick={() => window.location.href = '/provider/tasks'}
            >
              <Bell className="w-3 h-3" />
              Task Inbox
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Calendar Tab ──────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOTS = ['Morning', 'Afternoon', 'Evening'];

function CalendarTab() {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [recurring, setRecurring] = useState<Record<string, boolean>>({});
  const [holidayStart, setHolidayStart] = useState('');
  const [holidayEnd, setHolidayEnd] = useState('');

  const { data: settings, refetch } = useQuery<OperationalSettings>({
    queryKey: ['/api/provider-console/settings'],
  });

  const settingsMutation = useMutation({
    mutationFn: (patch: Partial<OperationalSettings>) =>
      apiRequest('PUT', '/api/provider-console/settings', patch),
    onSuccess: () => { refetch(); toast({ title: 'Calendar updated' }); },
    onError: () => toast({ title: 'Failed to save', variant: 'destructive' }),
  });

  const toggleDay = (date: Date) => {
    if (isBefore(date, new Date()) && !isToday(date)) return;
    setBlockedDates((prev) =>
      prev.some((d) => isSameDay(d, date))
        ? prev.filter((d) => !isSameDay(d, date))
        : [...prev, date]
    );
  };

  const toggleRecurring = (key: string) =>
    setRecurring((prev) => ({ ...prev, [key]: !prev[key] }));

  const applyHolidayMode = () => {
    if (!holidayStart || !holidayEnd) return;
    settingsMutation.mutate({
      holidayMode: true,
      holidayStart: new Date(holidayStart).toISOString() as any,
      holidayEnd: new Date(holidayEnd).toISOString() as any,
    });
  };

  const clearHolidayMode = () => {
    settingsMutation.mutate({ holidayMode: false, holidayStart: null as any, holidayEnd: null as any });
  };

  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Monthly calendar */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))}>‹</Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))}>›</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
              {DAYS.map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {monthDays.map((day) => {
                const isBlocked = blockedDates.some((d) => isSameDay(d, day));
                const isPast = isBefore(day, new Date()) && !isToday(day);
                const isHoliday = settings?.holidayMode &&
                  settings.holidayStart && settings.holidayEnd &&
                  day >= new Date(settings.holidayStart) && day <= new Date(settings.holidayEnd);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => !isPast && toggleDay(day)}
                    className={[
                      'rounded p-1 text-sm aspect-square flex items-center justify-center transition-colors',
                      isPast ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer',
                      isToday(day) ? 'ring-2 ring-blue-500 font-bold' : '',
                      isHoliday ? 'bg-amber-100 text-amber-700' :
                      isBlocked ? 'bg-red-100 text-red-700 font-medium' :
                      'bg-green-50 text-green-800 hover:bg-green-100',
                    ].join(' ')}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 inline-block" />Available</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block" />Blocked</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 inline-block" />Holiday</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Controls */}
      <div className="space-y-4">
        {/* Emergency toggle */}
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Emergency Unavailable</p>
                <p className="text-xs text-gray-500">Instantly blocks all new bookings</p>
              </div>
              <Switch
                checked={settings?.emergencyUnavailable ?? false}
                onCheckedChange={(v) => settingsMutation.mutate({ emergencyUnavailable: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Holiday mode */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarOff className="w-4 h-4" /> Holiday Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings?.holidayMode ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                  Active: {settings.holidayStart ? format(new Date(settings.holidayStart), 'MMM d') : '?'}
                  {' → '}{settings.holidayEnd ? format(new Date(settings.holidayEnd), 'MMM d') : '?'}
                </p>
                <Button variant="outline" size="sm" className="w-full" onClick={clearHolidayMode}>
                  Clear Holiday Mode
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={holidayStart} onChange={(e) => setHolidayStart(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={holidayEnd} onChange={(e) => setHolidayEnd(e.target.value)} className="mt-1" />
                </div>
                <Button size="sm" className="w-full" onClick={applyHolidayMode} disabled={!holidayStart || !holidayEnd || settingsMutation.isPending}>
                  {settingsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Activate Holiday Mode
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recurring schedule */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Weekly Schedule</CardTitle>
            <CardDescription className="text-xs">Tap to toggle recurring availability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-1 text-xs text-center">
              <div />
              {SLOTS.map(s => <div key={s} className="text-gray-500 font-medium">{s.slice(0,3)}</div>)}
              {DAYS.map(day => (
                <>
                  <div key={`lbl-${day}`} className="text-gray-700 font-medium flex items-center">{day}</div>
                  {SLOTS.map(slot => {
                    const key = `${day}-${slot}`;
                    return (
                      <button
                        key={key}
                        onClick={() => toggleRecurring(key)}
                        className={`rounded p-1 border transition-colors ${recurring[key] ? 'bg-green-500 border-green-500 text-white' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                      >
                        {recurring[key] ? '✓' : '·'}
                      </button>
                    );
                  })}
                </>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Capacity */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Capacity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Max jobs per day', field: 'maxJobsPerDay' as const, min: 1, max: 20 },
              { label: 'Buffer between jobs (min)', field: 'bufferMinutes' as const, min: 0, max: 120 },
              { label: 'Max simultaneous bookings', field: 'maxSimultaneous' as const, min: 1, max: 5 },
            ].map(({ label, field, min, max }) => (
              <div key={field}>
                <Label className="text-xs text-gray-600">{label}</Label>
                <Input
                  type="number"
                  min={min}
                  max={max}
                  defaultValue={settings?.[field] ?? 1}
                  className="mt-1"
                  onBlur={(e) => settingsMutation.mutate({ [field]: parseInt(e.target.value) })}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Bookings Tab ──────────────────────────────────────────────────────────────

const BOOKING_ACTIONS = [
  { action: 'accepted', label: 'Accept', icon: CheckCircle, color: 'text-green-600', variant: 'default' as const },
  { action: 'rejected', label: 'Reject', icon: XCircle, color: 'text-red-600', variant: 'destructive' as const },
  { action: 'arrived', label: 'Mark Arrived', icon: CheckCircle, color: 'text-blue-600', variant: 'outline' as const },
  { action: 'in_progress', label: 'Start Service', icon: Zap, color: 'text-purple-600', variant: 'outline' as const },
  { action: 'completed', label: 'Complete', icon: CheckCircle, color: 'text-green-600', variant: 'outline' as const },
  { action: 'cancelled', label: 'Cancel', icon: XCircle, color: 'text-red-600', variant: 'ghost' as const },
  { action: 'unsafe_report', label: 'Report Unsafe', icon: ShieldAlert, color: 'text-orange-600', variant: 'ghost' as const },
];

const REJECT_REASONS = ['schedule_conflict', 'too_far', 'pet_type', 'capacity_full', 'health_issue', 'customer_concern', 'other'];
const CANCEL_REASONS = ['illness', 'emergency', 'schedule_conflict', 'customer_request', 'safety_concern', 'other'];

function BookingCard({ booking, platform }: { booking: any; platform: string }) {
  const { toast } = useToast();
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [notes, setNotes] = useState('');

  const actionMutation = useMutation({
    mutationFn: ({ action, reasonCode, notes }: { action: string; reasonCode?: string; notes?: string }) =>
      apiRequest('POST', `/api/provider-console/booking-actions/${booking.bookingId || booking.id}`, {
        action, platform, actorRole: 'provider', reasonCode, notes,
      }),
    onSuccess: () => {
      toast({ title: `Action recorded: ${pendingAction}` });
      setShowReasonInput(false);
      setPendingAction('');
      queryClient.invalidateQueries({ queryKey: ['/api/provider-console/performance'] });
    },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  });

  const handleAction = (action: string) => {
    if (action === 'rejected' || action === 'cancelled' || action === 'unsafe_report') {
      setPendingAction(action);
      setShowReasonInput(true);
      return;
    }
    actionMutation.mutate({ action });
  };

  const submitWithReason = () => {
    actionMutation.mutate({ action: pendingAction, reasonCode, notes });
  };

  const status = booking.status || 'pending';
  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-600',
    disputed: 'bg-red-100 text-red-700',
    no_show: 'bg-red-50 text-red-600',
  };

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-sm">{booking.bookingId || booking.id}</p>
            <p className="text-xs text-gray-500">
              {booking.scheduledDate ? format(new Date(booking.scheduledDate), 'EEE, MMM d · HH:mm') : <span className="text-gray-400 italic text-xs">Not scheduled</span>}
              {booking.ownerId ? ` · Owner: ${booking.ownerId.slice(0, 8)}…` : ''}
            </p>
          </div>
          <Badge className={`text-xs ${statusColors[status] || 'bg-gray-100'}`}>{status}</Badge>
        </div>

        {showReasonInput ? (
          <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {(pendingAction === 'rejected' ? REJECT_REASONS : CANCEL_REASONS).map(r => (
                  <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Additional notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs h-16"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={submitWithReason} disabled={!reasonCode || actionMutation.isPending}>
                {actionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Confirm {pendingAction}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowReasonInput(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {BOOKING_ACTIONS.filter((a) => {
              if (status === 'pending') return ['accepted', 'rejected'].includes(a.action);
              if (status === 'confirmed') return ['arrived', 'cancelled', 'unsafe_report'].includes(a.action);
              if (status === 'in_progress') return ['completed', 'cancelled', 'unsafe_report'].includes(a.action);
              return a.action === 'unsafe_report';
            }).map(({ action, label, icon: Icon, variant }) => (
              <Button
                key={action}
                size="sm"
                variant={variant}
                className="h-7 text-xs"
                onClick={() => handleAction(action)}
                disabled={actionMutation.isPending}
              >
                <Icon className="w-3 h-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BookingsTab() {
  const [activePlatform, setActivePlatform] = useState('walk_my_pet');
  const [subTab, setSubTab] = useState<'pending' | 'active' | 'completed' | 'cancelled' | 'disputed'>('pending');

  const { data: walkBookings = [], isLoading } = useQuery<any>({
    queryKey: ['/api/provider-dashboard/v2/bookings'],
    select: (data: any) => data?.bookings ?? [],
  });

  const filtered = walkBookings.filter((b: any) => {
    if (subTab === 'pending') return b.status === 'pending';
    if (subTab === 'active') return ['confirmed', 'in_progress'].includes(b.status);
    if (subTab === 'completed') return b.status === 'completed';
    if (subTab === 'cancelled') return b.status === 'cancelled';
    if (subTab === 'disputed') return b.status === 'disputed';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['pending', 'active', 'completed', 'cancelled', 'disputed'] as const).map((tab) => (
          <Button
            key={tab}
            variant={subTab === tab ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSubTab(tab)}
            className="capitalize"
          >
            {tab}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <BookOpen className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No {subTab} bookings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking: any) => (
            <BookingCard key={booking.bookingId || booking.id} booking={booking} platform={activePlatform} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pricing Tab ───────────────────────────────────────────────────────────────

function PricingTab() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState('walk_my_pet');

  const { data: rateCard, refetch } = useQuery<any>({
    queryKey: ['/api/provider-console/pricing', platform],
    queryFn: () => fetch(`/api/provider-console/pricing/${platform}`, {
      headers: { 'Content-Type': 'application/json' },
    }).then(r => r.json()),
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const patch = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: () => apiRequest('PUT', `/api/provider-console/pricing/${platform}`, { ...rateCard, ...form }),
    onSuccess: () => { refetch(); toast({ title: 'Pricing saved' }); setForm({}); },
    onError: () => toast({ title: 'Failed to save pricing', variant: 'destructive' }),
  });

  const curr = { ...rateCard, ...form };

  const field = (label: string, key: string, suffix = '', description = '') => (
    <div key={key}>
      <Label className="text-xs text-gray-600">{label}</Label>
      {description && <p className="text-xs text-gray-400 mb-1">{description}</p>}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={curr[key] ?? ''}
          onChange={(e) => patch(key, parseFloat(e.target.value) || 0)}
          className="mt-1"
        />
        {suffix && <span className="text-xs text-gray-500 mt-1">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Label className="text-sm">Platform</Label>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="walk_my_pet">Walk My Pet™</SelectItem>
            <SelectItem value="sitter_suite">Sitter Suite™</SelectItem>
            <SelectItem value="groomers">Groomers™</SelectItem>
            <SelectItem value="academy">Academy™</SelectItem>
            <SelectItem value="pettrek">PetTrek™</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Base Rates</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {field('Per hour (₪ cents)', 'baseRatePerHourCents', 'agorot', 'e.g. 5000 = ₪50/hr')}
            {field('Per visit (₪ cents)', 'baseRatePerVisitCents', 'agorot')}
            {field('Per night (₪ cents)', 'baseRatePerNightCents', 'agorot')}
            {field('Extra pet surcharge (₪ cents)', 'additionalPetSurchargeCents', 'agorot')}
            {field('Minimum booking (₪ cents)', 'minBookingAmountCents', 'agorot')}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Surcharges</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {field('Weekend surcharge', 'weekendSurchargePercent', '%')}
            {field('Holiday surcharge', 'holidaySurchargePercent', '%')}
            {field('Night surcharge', 'nightSurchargePct', '%')}
            {field('Urgent booking surcharge', 'urgentSurchargePct', '%')}
            {field('Urgent booking threshold', 'urgentHoursThreshold', 'hours notice')}
            {field('Travel surcharge', 'travelSurchargePerKm', '₪ per km beyond radius')}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Discounts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {field('Repeat customer discount', 'repeatDiscountPct', '%')}
            {field('Weekly stay discount', 'weeklyDiscountPercent', '%')}
            {field('Monthly stay discount', 'monthlyDiscountPercent', '%')}
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-xs font-medium">Promo participation</p>
                <p className="text-xs text-gray-400">Appear in platform promotions</p>
              </div>
              <Switch
                checked={curr.promoParticipation ?? true}
                onCheckedChange={(v) => patch('promoParticipation', v)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cancellation Policy</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">% of booking charged if cancelled within:</p>
            {field('Within 24 hours', 'cancelPolicy24hPct', '%')}
            {field('Within 48 hours', 'cancelPolicy48hPct', '%')}
            {field('Within 72 hours', 'cancelPolicy72hPct', '%')}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || Object.keys(form).length === 0}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Pricing
        </Button>
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab() {
  const { toast } = useToast();
  const { data: settings, refetch, isLoading } = useQuery<OperationalSettings>({
    queryKey: ['/api/provider-console/settings'],
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<OperationalSettings>) =>
      apiRequest('PUT', '/api/provider-console/settings', patch),
    onSuccess: () => { refetch(); toast({ title: 'Settings saved' }); },
    onError: () => toast({ title: 'Failed to save', variant: 'destructive' }),
  });

  const toggle = (field: keyof OperationalSettings) => (val: boolean) =>
    saveMutation.mutate({ [field]: val });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const ToggleRow = ({ label, desc, field }: { label: string; desc: string; field: keyof OperationalSettings }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <Switch
        checked={!!settings?.[field]}
        onCheckedChange={toggle(field)}
        disabled={saveMutation.isPending}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4" />Booking Behaviour</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleRow field="autoAccept" label="Auto-accept bookings" desc="Automatically accept all incoming requests" />
          <ToggleRow field="instantBooking" label="Instant booking" desc="Customers book without waiting for approval" />
          <ToggleRow field="requireApproval" label="Require manual approval" desc="Review every booking before confirming" />
          <ToggleRow field="sameDayBookings" label="Same-day bookings" desc="Accept bookings for today" />
          <ToggleRow field="weekendJobs" label="Weekend jobs" desc="Accept bookings on Sat & Sun" />
          <ToggleRow field="nightJobs" label="Night jobs" desc={`Accept bookings ${settings?.nightStartHour ?? 22}:00–${settings?.nightEndHour ?? 6}:00`} />
          <ToggleRow field="repeatCustomersOnly" label="Repeat customers only" desc="Only accept customers you've served before" />
          <ToggleRow field="newCustomerRequests" label="New customer requests" desc="Accept first-time customers" />
          <ToggleRow field="homeVisitsOnly" label="Home visits only" desc="Only accept bookings at customer's location" />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Bell className="w-4 h-4" />Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <ToggleRow field="notifInApp" label="In-app notifications" desc="Alerts inside the app" />
            <ToggleRow field="notifPush" label="Push notifications" desc="Device push notifications" />
            <ToggleRow field="notifEmail" label="Email notifications" desc="Booking updates via email" />
            <ToggleRow field="notifSmsEmergency" label="Emergency SMS" desc="Critical alerts via SMS only" />
            <ToggleRow field="aiSuggestions" label="Kenzo AI suggestions" desc="Receive AI-powered business tips" />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Settings className="w-4 h-4" />Capacity & Radius</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {([
              { label: 'Max jobs per day', field: 'maxJobsPerDay', min: 1, max: 20 },
              { label: 'Max simultaneous bookings', field: 'maxSimultaneous', min: 1, max: 10 },
              { label: 'Buffer between jobs (min)', field: 'bufferMinutes', min: 0, max: 180 },
              { label: 'Travel radius (km)', field: 'travelRadiusKm', min: 1, max: 100 },
            ] as const).map(({ label, field, min, max }) => (
              <div key={field}>
                <Label className="text-xs text-gray-600">{label}</Label>
                <Input
                  type="number"
                  min={min}
                  max={max}
                  defaultValue={(settings as any)?.[field] ?? 1}
                  className="mt-1"
                  onBlur={(e) => saveMutation.mutate({ [field]: parseInt(e.target.value) } as any)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

function PerformanceTab() {
  const { data: perf, isLoading } = useQuery<PerformanceData>({
    queryKey: ['/api/provider-console/performance'],
  });
  const [aiInsight, setAiInsight] = useState('');
  const { toast } = useToast();

  const insightMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/provider-console/ai/query', {
      query: `Based on my performance data (completion rate: ${perf?.rates.completionRate}%, acceptance rate: ${perf?.rates.acceptanceRate}%, cancellation rate: ${perf?.rates.cancellationRate}%, last 30 days bookings: ${perf?.bookings.last30d}), give me 3 specific actionable suggestions to improve my business as a pet care provider.`,
    }),
    onSuccess: async (res) => { const d = await res.json(); setAiInsight(d.response); },
    onError: () => toast({ title: 'AI query failed', variant: 'destructive' }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const rateData = perf ? [
    { name: 'Completion', value: perf.rates.completionRate },
    { name: 'Acceptance', value: perf.rates.acceptanceRate },
    { name: 'Cancellation', value: perf.rates.cancellationRate },
  ] : [];

  const periodData = perf ? [
    { period: 'Today', bookings: perf.bookings.today },
    { period: '7 days', bookings: perf.bookings.last7d },
    { period: '30 days', bookings: perf.bookings.last30d },
    { period: 'All time', bookings: perf.bookings.total },
  ] : [];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings', value: perf?.bookings.total ?? 0, icon: BookOpen, color: 'text-blue-600' },
          { label: 'Completed', value: perf?.bookings.completed ?? 0, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Cancelled', value: perf?.bookings.cancelled ?? 0, icon: XCircle, color: 'text-red-500' },
          { label: 'Flagged Messages', value: perf?.flaggedMessages ?? 0, icon: AlertTriangle, color: 'text-amber-500' },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bookings by period */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Bookings Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={periodData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="bookings" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rate breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Performance Rates</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rateData.map(({ name, value }, i) => (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{name} Rate</span>
                    <span className="font-medium" style={{ color: CHART_COLORS[i] }}>{value}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${value}%`, backgroundColor: CHART_COLORS[i] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI insights */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Bot className="w-4 h-4 text-purple-600" />Kenzo Insights</CardTitle>
            <Button size="sm" variant="outline" onClick={() => insightMutation.mutate()} disabled={insightMutation.isPending}>
              {insightMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Analyse
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiInsight ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{aiInsight}</p>
          ) : (
            <p className="text-sm text-gray-400">Click Analyse to get personalised business suggestions from Kenzo</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Safety Tab ────────────────────────────────────────────────────────────────

function SafetyTab() {
  const { toast } = useToast();
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [blockForm, setBlockForm] = useState({ blockedType: 'customer', blockedRef: '', blockedName: '', reason: '' });
  const [noteForm, setNoteForm] = useState({ subjectType: 'customer', subjectId: '', subjectName: '', notes: '', riskLevel: 'low' });

  const { data: blocked = [], refetch: refetchBlocked } = useQuery<BlockedEntry[]>({
    queryKey: ['/api/provider-console/blocked-list'],
  });
  const { data: safetyNotes = [], refetch: refetchNotes } = useQuery<SafetyNote[]>({
    queryKey: ['/api/provider-console/safety-notes'],
  });

  const addBlockMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/provider-console/blocked-list', blockForm),
    onSuccess: () => { refetchBlocked(); setShowBlockForm(false); setBlockForm({ blockedType: 'customer', blockedRef: '', blockedName: '', reason: '' }); toast({ title: 'Added to blocked list' }); },
    onError: () => toast({ title: 'Failed to block', variant: 'destructive' }),
  });

  const removeBlockMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/provider-console/blocked-list/${id}`, {}),
    onSuccess: () => { refetchBlocked(); toast({ title: 'Removed from blocked list' }); },
  });

  const addNoteMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/provider-console/safety-notes', noteForm),
    onSuccess: () => { refetchNotes(); setShowNoteForm(false); toast({ title: 'Note saved' }); },
    onError: () => toast({ title: 'Failed to save note', variant: 'destructive' }),
  });

  const riskColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Blocked list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4" />Blocked List</h3>
          <Button size="sm" variant="outline" onClick={() => setShowBlockForm(!showBlockForm)}>
            <Plus className="w-3 h-3 mr-1" />Add
          </Button>
        </div>

        {showBlockForm && (
          <Card className="border border-gray-200">
            <CardContent className="pt-4 space-y-2">
              <Select value={blockForm.blockedType} onValueChange={(v) => setBlockForm(f => ({ ...f, blockedType: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="address">Address</SelectItem>
                  <SelectItem value="pet">Pet</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="ID / address / pet ID" className="h-8 text-xs" value={blockForm.blockedRef} onChange={(e) => setBlockForm(f => ({ ...f, blockedRef: e.target.value }))} />
              <Input placeholder="Name (optional)" className="h-8 text-xs" value={blockForm.blockedName} onChange={(e) => setBlockForm(f => ({ ...f, blockedName: e.target.value }))} />
              <Input placeholder="Reason" className="h-8 text-xs" value={blockForm.reason} onChange={(e) => setBlockForm(f => ({ ...f, reason: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => addBlockMutation.mutate()} disabled={!blockForm.blockedRef}>
                  {addBlockMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}Block
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowBlockForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {blocked.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No blocked entries</p>
          ) : blocked.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs font-medium">{entry.blockedName || entry.blockedRef}</p>
                <p className="text-xs text-gray-500">{entry.blockedType} · {entry.reason || 'No reason given'}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeBlockMutation.mutate(entry.id)}>
                <Trash2 className="w-3 h-3 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Safety notes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Safety Notes</h3>
          <Button size="sm" variant="outline" onClick={() => setShowNoteForm(!showNoteForm)}>
            <Plus className="w-3 h-3 mr-1" />Add
          </Button>
        </div>

        {showNoteForm && (
          <Card className="border border-gray-200">
            <CardContent className="pt-4 space-y-2">
              <Select value={noteForm.subjectType} onValueChange={(v) => setNoteForm(f => ({ ...f, subjectType: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="pet">Pet</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Customer/Pet ID" className="h-8 text-xs" value={noteForm.subjectId} onChange={(e) => setNoteForm(f => ({ ...f, subjectId: e.target.value }))} />
              <Input placeholder="Name" className="h-8 text-xs" value={noteForm.subjectName} onChange={(e) => setNoteForm(f => ({ ...f, subjectName: e.target.value }))} />
              <Select value={noteForm.riskLevel} onValueChange={(v) => setNoteForm(f => ({ ...f, riskLevel: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low risk</SelectItem>
                  <SelectItem value="medium">Medium risk</SelectItem>
                  <SelectItem value="high">High risk</SelectItem>
                </SelectContent>
              </Select>
              <Textarea placeholder="Safety notes..." className="text-xs h-20" value={noteForm.notes} onChange={(e) => setNoteForm(f => ({ ...f, notes: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => addNoteMutation.mutate()} disabled={!noteForm.subjectId || !noteForm.notes}>
                  {addNoteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNoteForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {safetyNotes.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No safety notes</p>
          ) : safetyNotes.map((note) => (
            <div key={note.id} className="p-3 bg-gray-50 rounded-lg space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">{note.subjectName || note.subjectId}</p>
                <Badge className={`text-xs ${riskColors[note.riskLevel]}`}>{note.riskLevel}</Badge>
              </div>
              <p className="text-xs text-gray-600">{note.notes}</p>
              <p className="text-xs text-gray-400">{note.subjectType} · {format(new Date(note.updatedAt), 'MMM d, yyyy')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AI Assistant Tab ──────────────────────────────────────────────────────────

function AIAssistantTab() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const { toast } = useToast();

  const QUICK_ACTIONS = [
    { label: "Summarize today's bookings", query: "Summarize today's bookings and what I should prioritise" },
    { label: "Which jobs to accept first?", query: "Which pending jobs should I accept first and why?" },
    { label: "Show risky bookings", query: "Are there any high-risk bookings I should be aware of this week?" },
    { label: "Suggest availability", query: "Suggest the best availability slots to open next week based on likely demand" },
    { label: "Draft customer message", query: "Draft a polite but firm message to a customer who has rescheduled 3 times" },
    { label: "Explain payout delay", query: "Explain common reasons why a payout might be pending or delayed" },
    { label: "Cancellation trends", query: "Summarise my cancellation trends and what I can do to reduce them" },
    { label: "Pricing recommendations", query: "Should I adjust my pricing? Compare my rates to typical market rates and recommend changes" },
  ];

  const queryMutation = useMutation({
    mutationFn: (query: string) => apiRequest('POST', '/api/provider-console/ai/query', { query }),
    onSuccess: async (res) => {
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', text: data.response }]);
    },
    onError: () => toast({ title: 'Kenzo is unavailable', variant: 'destructive' }),
  });

  const send = (query: string) => {
    if (!query.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    setInput('');
    queryMutation.mutate(query);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-260px)] min-h-[400px]">
      {/* Quick actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Quick Actions</h3>
        <p className="text-xs text-gray-400 mb-3">One-click prompts tuned for your data</p>
        <div className="space-y-2">
          {QUICK_ACTIONS.map(({ label, query }) => (
            <button
              key={label}
              onClick={() => send(query)}
              className="w-full text-left p-2.5 rounded-lg border border-gray-100 bg-gray-50 hover:bg-purple-50 hover:border-purple-200 text-xs text-gray-700 transition-colors flex items-center justify-between group"
            >
              {label}
              <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-purple-400" />
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="lg:col-span-2 flex flex-col border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b bg-purple-50">
          <Bot className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-medium text-purple-900">Kenzo — Provider Business Assistant</span>
        </div>

        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Bot className="w-12 h-12 text-purple-200 mb-3" />
              <p className="text-sm text-gray-500">Ask Kenzo anything about your bookings,</p>
              <p className="text-sm text-gray-400">pricing, schedule, or business performance</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {queryMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-3 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t flex gap-2">
          <Input
            placeholder="Ask Kenzo..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
          />
          <Button onClick={() => send(input)} disabled={!input.trim() || queryMutation.isPending}>
            {queryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Console ──────────────────────────────────────────────────────────────

const TABS = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'bookings', label: 'Bookings', icon: BookOpen },
  { value: 'pricing', label: 'Pricing', icon: DollarSign },
  { value: 'settings', label: 'Settings', icon: Settings },
  { value: 'performance', label: 'Performance', icon: BarChart2 },
  { value: 'safety', label: 'Safety', icon: ShieldAlert },
  { value: 'ai', label: 'Kenzo AI', icon: Bot },
];

export default function ProviderConsole() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Provider Console</h1>
          <p className="text-sm text-gray-500 mt-1">Your complete operations dashboard</p>
        </div>

        <Tabs defaultValue="dashboard">
          {/* Tab bar */}
          <TabsList className="flex flex-wrap h-auto gap-1 bg-white border border-gray-200 p-1 rounded-xl shadow-sm mb-6 w-full">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium data-[state=active]:bg-gray-900 data-[state=active]:text-white rounded-lg flex-1 min-w-[80px] justify-center"
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="calendar"><CalendarTab /></TabsContent>
          <TabsContent value="bookings"><BookingsTab /></TabsContent>
          <TabsContent value="pricing"><PricingTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
          <TabsContent value="performance"><PerformanceTab /></TabsContent>
          <TabsContent value="safety"><SafetyTab /></TabsContent>
          <TabsContent value="ai"><AIAssistantTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
