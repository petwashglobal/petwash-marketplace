import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import {
  ChevronLeft, ChevronRight, X, Clock,
  MapPin, Zap, Coffee, Moon, Sun, Repeat, Loader2, Save,
} from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DEFAULT_SCHEDULE: Record<string, { active: boolean; start: string; end: string }> = {
  Sun: { active: false, start: '09:00', end: '18:00' },
  Mon: { active: true, start: '09:00', end: '18:00' },
  Tue: { active: true, start: '09:00', end: '18:00' },
  Wed: { active: true, start: '09:00', end: '18:00' },
  Thu: { active: true, start: '09:00', end: '18:00' },
  Fri: { active: true, start: '09:00', end: '14:00' },
  Sat: { active: false, start: '09:00', end: '18:00' },
};

export default function POSCalendar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [vacationMode, setVacationMode] = useState(false);
  const [pauseNewBookings, setPauseNewBookings] = useState(false);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [bufferMinutes, setBufferMinutes] = useState(30);
  const [maxJobsPerDay, setMaxJobsPerDay] = useState(4);
  const [minNoticeHours, setMinNoticeHours] = useState(2);
  const [maxRadiusKm, setMaxRadiusKm] = useState(15);
  const [instantBooking, setInstantBooking] = useState(true);
  const [lastMinuteBooking, setLastMinuteBooking] = useState(true);
  const [activeTab, setActiveTab] = useState<'calendar' | 'schedule' | 'advanced'>('calendar');

  // Load provider profile for blocked_dates + working_hours
  const { data: profileData, isLoading: profileLoading } = useQuery<any>({
    queryKey: ['/api/provider-profile/me'],
    queryFn: () => fetch('/api/provider-profile/me', { credentials: 'include' }).then(r => r.json()),
    staleTime: 60_000,
  });

  // Load console settings for buffer/max-jobs/radius
  const { data: consoleSettings } = useQuery<any>({
    queryKey: ['/api/provider-console/settings'],
    queryFn: () => fetch('/api/provider-console/settings', { credentials: 'include' }).then(r => r.json()),
    staleTime: 60_000,
  });

  useEffect(() => {
    const p = profileData?.profile || profileData;
    if (!p) return;
    if (Array.isArray(p.blockedDates)) setBlockedDates(p.blockedDates);
    else if (Array.isArray(p.blocked_dates)) setBlockedDates(p.blocked_dates);
    if (p.workingHours || p.working_hours) {
      const wh = p.workingHours || p.working_hours;
      if (typeof wh === 'object' && wh !== null) setSchedule(prev => ({ ...prev, ...wh }));
    }
    if (p.availabilityState === 'vacation' || p.availability_state === 'vacation') setVacationMode(true);
    if (p.availabilityState === 'paused' || p.availability_state === 'paused') setPauseNewBookings(true);
  }, [profileData]);

  useEffect(() => {
    if (!consoleSettings) return;
    if (consoleSettings.bufferMinutes != null) setBufferMinutes(consoleSettings.bufferMinutes);
    if (consoleSettings.maxJobsPerDay != null) setMaxJobsPerDay(consoleSettings.maxJobsPerDay);
    if (consoleSettings.travelRadiusKm != null) setMaxRadiusKm(consoleSettings.travelRadiusKm);
    if (consoleSettings.instantBooking != null) setInstantBooking(consoleSettings.instantBooking);
  }, [consoleSettings]);

  const profileMutation = useMutation({
    mutationFn: (body: any) =>
      fetch('/api/provider-profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/provider-profile/me'] }),
  });

  const consoleMutation = useMutation({
    mutationFn: (body: any) =>
      fetch('/api/provider-console/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/provider-console/settings'] }),
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const dateStr = (day: number) => `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const toggleBlock = (day: number) => {
    const ds = dateStr(day);
    setBlockedDates(prev => prev.includes(ds) ? prev.filter(d => d !== ds) : [...prev, ds]);
  };

  const isSaving = profileMutation.isPending || consoleMutation.isPending;

  const handleSave = async () => {
    const availabilityState = vacationMode ? 'vacation' : pauseNewBookings ? 'paused' : 'active';
    await Promise.all([
      profileMutation.mutateAsync({
        blockedDates,
        workingHours: schedule,
        availabilityState,
      }),
      consoleMutation.mutateAsync({
        bufferMinutes,
        maxJobsPerDay,
        travelRadiusKm: maxRadiusKm,
        instantBooking,
      }),
    ]);
    toast({ title: 'Availability saved', description: 'Your schedule has been updated.' });
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex bg-white rounded-xl p-1">
        {[
          { id: 'calendar', label: 'Calendar' },
          { id: 'schedule', label: 'Weekly Schedule' },
          { id: 'advanced', label: 'Advanced' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status toggles */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Vacation Mode', sub: 'Block all dates', value: vacationMode, onChange: setVacationMode, color: 'text-blue-600', icon: Zap },
          { label: 'Pause Bookings', sub: 'No new requests', value: pauseNewBookings, onChange: setPauseNewBookings, color: 'text-amber-600', icon: Coffee },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`bg-white border rounded-xl p-3 ${item.value ? 'border-amber-300' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-1">
                <Icon className={`w-4 h-4 ${item.color}`} />
                <Switch checked={item.value} onCheckedChange={item.onChange} />
              </div>
              <p className="text-xs font-semibold text-gray-900">{item.label}</p>
              <p className="text-[10px] text-gray-500">{item.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Calendar view */}
      {activeTab === 'calendar' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button onClick={prevMonth} className="p-1.5 hover:bg-white rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <h3 className="text-sm font-semibold text-gray-900">{MONTHS[viewMonth]} {viewYear}</h3>
            <button onClick={nextMonth} className="p-1.5 hover:bg-white rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <div className="grid grid-cols-7 px-2">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
            ))}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = dateStr(day);
              const isToday = ds === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const isBlocked = blockedDates.includes(ds);
              return (
                <button key={day} onClick={() => toggleBlock(day)}
                  className={`m-0.5 aspect-square rounded-lg text-xs font-medium transition-all flex items-center justify-center ${
                    isBlocked ? 'bg-red-100 text-red-700 border border-red-200' :
                    isToday ? 'bg-amber-500 text-white' :
                    'hover:bg-white text-gray-700'
                  }`}>
                  {day}
                </button>
              );
            })}
          </div>
          {blockedDates.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">{blockedDates.length} date{blockedDates.length !== 1 ? 's' : ''} blocked</p>
              <div className="flex flex-wrap gap-1">
                {blockedDates.map(d => (
                  <span key={d} className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px]">
                    {d}
                    <button onClick={() => setBlockedDates(prev => prev.filter(x => x !== d))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weekly schedule */}
      {activeTab === 'schedule' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Repeat className="w-4 h-4 text-amber-500" /> Recurring Weekly Schedule
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Set your default working hours</p>
          </div>
          <div className="divide-y divide-gray-100">
            {DAYS.map(day => {
              const daySchedule = schedule[day];
              return (
                <div key={day} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 text-xs font-semibold text-gray-600">{day}</div>
                  <Switch
                    checked={daySchedule.active}
                    onCheckedChange={(v) => setSchedule(prev => ({ ...prev, [day]: { ...prev[day], active: v } }))}
                  />
                  {daySchedule.active ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={daySchedule.start}
                        onChange={e => setSchedule(prev => ({ ...prev, [day]: { ...prev[day], start: e.target.value } }))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:border-amber-400" />
                      <span className="text-gray-400 text-xs">to</span>
                      <input type="time" value={daySchedule.end}
                        onChange={e => setSchedule(prev => ({ ...prev, [day]: { ...prev[day], end: e.target.value } }))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:outline-none focus:border-amber-400" />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 flex-1">Day off</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Advanced settings */}
      {activeTab === 'advanced' && (
        <div className="space-y-3">
          {[
            {
              label: 'Buffer between jobs', icon: Coffee,
              content: (
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={120} step={15} value={bufferMinutes}
                    onChange={e => setBufferMinutes(Number(e.target.value))}
                    className="flex-1 accent-amber-500" />
                  <span className="text-sm font-semibold text-gray-900 w-16 text-end">{bufferMinutes} min</span>
                </div>
              )
            },
            {
              label: 'Max jobs per day', icon: Clock,
              content: (
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={12} value={maxJobsPerDay}
                    onChange={e => setMaxJobsPerDay(Number(e.target.value))}
                    className="flex-1 accent-amber-500" />
                  <span className="text-sm font-semibold text-gray-900 w-16 text-end">{maxJobsPerDay} jobs</span>
                </div>
              )
            },
            {
              label: 'Minimum advance notice', icon: Clock,
              content: (
                <select value={minNoticeHours} onChange={e => setMinNoticeHours(Number(e.target.value))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400">
                  {[1, 2, 4, 8, 24, 48].map(h => <option key={h} value={h}>{h}h advance notice</option>)}
                </select>
              )
            },
            {
              label: 'Maximum travel radius', icon: MapPin,
              content: (
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={50} value={maxRadiusKm}
                    onChange={e => setMaxRadiusKm(Number(e.target.value))}
                    className="flex-1 accent-amber-500" />
                  <span className="text-sm font-semibold text-gray-900 w-16 text-end">{maxRadiusKm} km</span>
                </div>
              )
            },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Icon className="w-4 h-4 text-amber-500" /> {item.label}
                </p>
                {item.content}
              </div>
            );
          })}

          {/* Booking toggles */}
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {[
              { label: 'Instant booking', sub: 'Clients can book without approval', value: instantBooking, onChange: setInstantBooking },
              { label: 'Last-minute bookings', sub: 'Allow bookings within 2 hours', value: lastMinuteBooking, onChange: setLastMinuteBooking },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
                </div>
                <Switch checked={item.value} onCheckedChange={item.onChange} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      <button onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {isSaving ? 'Saving...' : 'Save Availability Settings'}
      </button>
    </div>
  );
}

