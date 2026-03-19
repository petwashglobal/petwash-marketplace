import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Camera, Star, Shield, Award, MapPin, Globe, Dog, Cat, Bird,
  Rabbit, CheckCircle2, Edit3, Home, AlertCircle, Loader2,
  CalendarDays, Clock, ChevronLeft, ChevronRight as ChevronRightIcon, X,
  TrendingUp, UserCheck, CheckSquare, AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayHours { active: boolean; from?: string; to?: string; }
interface WorkingHours { mon?: DayHours; tue?: DayHours; wed?: DayHours; thu?: DayHours; fri?: DayHours; sat?: DayHours; sun?: DayHours; }

interface ProviderProfile {
  bio: string;
  languages: string[];
  availabilityState: string;
  priceFromCents: number | null;
  priceFrom: number | null;
  acceptedPets: string[];
  hasFencedYard: boolean | null;
  hasNoPetsAtHome: boolean | null;
  blockedDates: string[];
  workingHours: WorkingHours | null;
  backgroundCheckStatus: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  completedBookingsCount: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  memberSince: string | null;
}

interface CompletenessCheck {
  done: boolean;
  weight: number;
  label: string;
}

interface ProfileResponse {
  exists: boolean;
  profile: ProviderProfile | null;
  completeness: {
    score: number;
    breakdown: Record<string, CompletenessCheck>;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: { key: keyof WorkingHours; label: string; short: string }[] = [
  { key: 'sun', label: 'Sunday',    short: 'Sun' },
  { key: 'mon', label: 'Monday',    short: 'Mon' },
  { key: 'tue', label: 'Tuesday',   short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday',  short: 'Thu' },
  { key: 'fri', label: 'Friday',    short: 'Fri' },
  { key: 'sat', label: 'Saturday',  short: 'Sat' },
];
const DEFAULT_HOURS: WorkingHours = {
  sun: { active: false }, mon: { active: true, from: '09:00', to: '18:00' },
  tue: { active: true, from: '09:00', to: '18:00' }, wed: { active: true, from: '09:00', to: '18:00' },
  thu: { active: true, from: '09:00', to: '18:00' }, fri: { active: true, from: '09:00', to: '14:00' },
  sat: { active: false },
};

const LANGUAGES = ['Hebrew', 'English', 'Arabic', 'Russian', 'French', 'Spanish'];
const SERVICE_AREAS = ['Tel Aviv', 'Jerusalem', 'Haifa', 'Ra\'anana', 'Petah Tikva', 'Rishon LeZion', 'Netanya', 'Beer Sheva'];

const PET_OPTIONS = [
  { value: 'dog',    label: 'Dogs',    icon: Dog },
  { value: 'cat',    label: 'Cats',    icon: Cat },
  { value: 'rabbit', label: 'Rabbits', icon: Rabbit },
  { value: 'bird',   label: 'Birds',   icon: Bird },
];

const AVAILABILITY_OPTIONS = [
  { value: 'online',    label: 'Online — accepting new bookings',    color: 'text-green-600',  dot: 'bg-green-500' },
  { value: 'available', label: 'Available — limited availability',   color: 'text-blue-600',   dot: 'bg-blue-500' },
  { value: 'busy',      label: 'Busy — no new bookings right now',   color: 'text-amber-600',  dot: 'bg-amber-500' },
  { value: 'offline',   label: 'Offline — not taking bookings',      color: 'text-gray-500',   dot: 'bg-gray-400' },
];

const BG_CHECK_LABELS: Record<string, { label: string; color: string }> = {
  approved: { label: 'Approved ✓', color: 'text-green-600' },
  pending:  { label: 'Under Review', color: 'text-amber-600' },
  rejected: { label: 'Not Approved', color: 'text-red-600' },
};

// ─── Completeness Bar ─────────────────────────────────────────────────────────

function CompletenessBar({ score, breakdown }: { score: number; breakdown: Record<string, CompletenessCheck> }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-400';
  const incomplete = Object.values(breakdown).filter(c => !c.done);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-900">Profile Completeness</p>
        <span className={`text-sm font-bold ${score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{score}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
        <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
      </div>
      {incomplete.length > 0 && (
        <div className="space-y-1">
          {incomplete.slice(0, 3).map(c => (
            <div key={c.label} className="flex items-center gap-2 text-xs text-gray-500">
              <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{c.label}</span>
              <span className="text-gray-300 ml-auto">+{c.weight}%</span>
            </div>
          ))}
          {incomplete.length > 3 && (
            <p className="text-xs text-gray-400">+{incomplete.length - 3} more items</p>
          )}
        </div>
      )}
      {incomplete.length === 0 && (
        <p className="text-xs text-green-600 font-medium">Profile complete — you\'re visible to all clients!</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function POSProfile() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useFirebaseAuth();
  const [activeTab, setActiveTab] = useState<'basic' | 'services' | 'home' | 'availability' | 'badges'>('basic');

  // Form state (initialized from API)
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState<string[]>(['Hebrew']);
  const [serviceAreas, setServiceAreas] = useState<string[]>(['Tel Aviv']);
  const [availabilityState, setAvailabilityState] = useState('offline');
  const [priceFrom, setPriceFrom] = useState<string>('');         // display ILS
  const [acceptedPets, setAcceptedPets] = useState<string[]>([]);
  const [hasFencedYard, setHasFencedYard] = useState<boolean | null>(null);
  const [hasNoPetsAtHome, setHasNoPetsAtHome] = useState<boolean | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_HOURS);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [initialized, setInitialized] = useState(false);

  // ── Fetch own profile ──────────────────────────────────────────────────────
  const { data: profileData, isLoading } = useQuery<ProfileResponse>({
    queryKey: ['/api/provider-profile/me'],
    staleTime: 30_000,
  });

  const { data: reviewsApiData } = useQuery({
    queryKey: ['/api/provider-dashboard/reviews'],
    queryFn: () => fetch('/api/provider-dashboard/reviews', { credentials: 'include' }).then(r => r.json()),
    staleTime: 60_000,
    enabled: activeTab === 'badges',
  });

  const { data: trustStats } = useQuery<any>({
    queryKey: ['/api/providers/stats', user?.uid],
    queryFn: () => fetch(`/api/providers/stats/${user!.uid}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 300_000,
    enabled: activeTab === 'badges' && !!user?.uid,
  });

  // Initialize form state from API response (only once)
  useEffect(() => {
    if (profileData?.profile && !initialized) {
      const p = profileData.profile;
      setBio(p.bio ?? '');
      setLanguages(Array.isArray(p.languages) ? p.languages : []);
      setAvailabilityState(p.availabilityState ?? 'offline');
      setPriceFrom(p.priceFrom != null ? String(p.priceFrom) : '');
      setAcceptedPets(p.acceptedPets ?? []);
      setHasFencedYard(p.hasFencedYard ?? null);
      setHasNoPetsAtHome(p.hasNoPetsAtHome ?? null);
      setBlockedDates(p.blockedDates ?? []);
      setWorkingHours(p.workingHours ?? DEFAULT_HOURS);
      setInitialized(true);
    }
  }, [profileData, initialized]);

  // ── Save mutation ──────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => {
      const priceInt = priceFrom.trim() !== '' ? Math.round(Number(priceFrom) * 100) : null;
      if (priceFrom.trim() !== '' && (isNaN(Number(priceFrom)) || Number(priceFrom) < 0)) {
        throw new Error('Price must be a positive number in ILS');
      }
      return apiRequest('PATCH', '/api/provider-profile/me', {
        bio,
        languages,
        availabilityState,
        priceFromCents: priceInt,
        acceptedPets,
        hasFencedYard,
        hasNoPetsAtHome,
        blockedDates,
        workingHours,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/provider-profile/me'] });
      qc.invalidateQueries({ queryKey: ['/api/providers/browse'] });
      qc.invalidateQueries({ queryKey: ['/api/providers/stats'] });
      toast({ title: 'Profile saved', description: 'Your changes are live and reflected in browse results.' });
    },
    onError: (err: any) => {
      toast({ title: 'Save failed', description: err.message || 'Could not save profile', variant: 'destructive' });
    },
  });

  const toggleLanguage = (lang: string) =>
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  const toggleArea = (area: string) =>
    setServiceAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]);
  const togglePet = (pet: string) =>
    setAcceptedPets(prev => prev.includes(pet) ? prev.filter(p => p !== pet) : [...prev, pet]);

  const profile = profileData?.profile;
  const completeness = profileData?.completeness;
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.email?.split('@')[0] || 'Provider';
  const bgCheckInfo = BG_CHECK_LABELS[profile?.backgroundCheckStatus ?? ''] ?? null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile header — real stats from API */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center">
            <span className="text-xl font-bold text-amber-600">{displayName.charAt(0).toUpperCase()}</span>
          </div>
          <button className="absolute -bottom-1 -end-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-sm">
            <Camera className="w-2.5 h-2.5 text-white" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
          <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
          <div className="flex items-center gap-3 mt-1">
            {profile?.ratingAvg != null && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {profile.ratingAvg.toFixed(1)}
              </span>
            )}
            <span className="text-xs text-gray-400">{profile?.ratingCount ?? 0} reviews</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{profile?.completedBookingsCount ?? 0} jobs</span>
          </div>
        </div>
        <button onClick={() => setActiveTab('basic')} className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors">
          <Edit3 className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Completeness score — live from API */}
      {completeness && (
        <CompletenessBar score={completeness.score} breakdown={completeness.breakdown} />
      )}

      {/* Tabs */}
      <div className="grid grid-cols-5 bg-gray-100 rounded-xl p-1 gap-0.5">
        {[
          { id: 'basic',        label: 'Basic' },
          { id: 'services',     label: 'Services' },
          { id: 'home',         label: 'Home' },
          { id: 'availability', label: 'Avail.' },
          { id: 'badges',       label: 'Badges' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`py-2 rounded-lg text-[11px] font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Basic Info ────────────────────────────────────────────────── */}
      {activeTab === 'basic' && (
        <div className="space-y-4">
          {/* Availability state */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-3">Availability Status</p>
            <div className="space-y-2">
              {AVAILABILITY_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setAvailabilityState(opt.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-start ${
                    availabilityState === opt.value ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                  <span className={`text-xs font-medium ${availabilityState === opt.value ? opt.color : 'text-gray-600'}`}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Bio <span className="text-gray-400 font-normal">({bio.length}/2000)</span></label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} maxLength={2000}
              placeholder="Tell clients about yourself, your experience, and your love for pets..."
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-400 resize-none" />
          </div>

          {/* Languages */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> Languages
            </p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map(lang => (
                <button key={lang} onClick={() => toggleLanguage(lang)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    languages.includes(lang) ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Service Areas */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" /> Service Areas
            </p>
            <div className="flex flex-wrap gap-2">
              {SERVICE_AREAS.map(area => (
                <button key={area} onClick={() => toggleArea(area)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    serviceAreas.includes(area) ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {area}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Services Tab ─────────────────────────────────────────────── */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          {/* Starting price */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-1">Starting Price</p>
            <p className="text-xs text-gray-500 mb-3">This is the minimum price shown in browse results and on your public profile.</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">₪</span>
              <input
                type="number"
                min={0}
                max={100000}
                step={5}
                value={priceFrom}
                onChange={e => setPriceFrom(e.target.value)}
                placeholder="e.g. 80"
                className="w-full text-sm border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:border-amber-400"
              />
            </div>
            {priceFrom && Number(priceFrom) > 0 && (
              <p className="text-xs text-green-600 mt-1.5">₪{priceFrom}/visit will be shown in browse results</p>
            )}
          </div>

          {/* Accepted pet types */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-1">Accepted Pet Types</p>
            <p className="text-xs text-gray-500 mb-3">
              Clients filter by pet type. If none selected, you appear for all pet searches.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PET_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button key={value} onClick={() => togglePet(value)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                    acceptedPets.includes(value)
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{label}</span>
                  {acceptedPets.includes(value) && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 ml-auto" />
                  )}
                </button>
              ))}
            </div>
            {acceptedPets.length === 0 && (
              <p className="text-xs text-gray-400 mt-2">No selection = all pet types welcome</p>
            )}
          </div>
        </div>
      )}

      {/* ── My Home Tab ──────────────────────────────────────────────── */}
      {activeTab === 'home' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800">
              These questions help owners find the right home for their pet. Answering them boosts your profile completeness and helps you appear in filtered searches.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {/* Fenced yard */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <Home className="w-4 h-4 text-green-600" /> Do you have a fenced yard?
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Required for some dog sitting bookings</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setHasFencedYard(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${hasFencedYard === true ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    Yes
                  </button>
                  <button onClick={() => setHasFencedYard(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${hasFencedYard === false ? 'bg-gray-500 text-white border-gray-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    No
                  </button>
                </div>
              </div>
            </div>

            {/* No pets at home */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                    <Dog className="w-4 h-4 text-blue-600" /> No other pets at home?
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Important for owners with pet allergies or nervous animals</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setHasNoPetsAtHome(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${hasNoPetsAtHome === true ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    Yes
                  </button>
                  <button onClick={() => setHasNoPetsAtHome(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${hasNoPetsAtHome === false ? 'bg-gray-500 text-white border-gray-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>

          {hasFencedYard !== null && hasNoPetsAtHome !== null && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-800 font-medium">Home setup complete — you appear in "fenced yard" and "no other pets" filters</p>
            </div>
          )}
        </div>
      )}

      {/* ── Availability Tab ─────────────────────────────────────────── */}
      {activeTab === 'availability' && (() => {
        // Calendar helpers
        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
        const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
        const monthLabel = new Date(calendarYear, calendarMonth, 1).toLocaleString('en-IL', { month: 'long', year: 'numeric' });
        const today = new Date().toISOString().slice(0, 10);

        const toggleDate = (iso: string) => {
          if (iso < today) return; // can't block past dates
          setBlockedDates(prev =>
            prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso]
          );
        };

        const updateDayHours = (day: keyof WorkingHours, field: keyof DayHours, value: any) =>
          setWorkingHours(prev => ({
            ...prev,
            [day]: { ...(prev[day] ?? { active: false }), [field]: value },
          }));

        return (
          <div className="space-y-4">
            {/* Status selector */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" /> Current Status
              </p>
              <div className="space-y-2">
                {[
                  { value: 'online',    label: 'Online — fully open to new bookings',   dot: 'bg-green-500'  },
                  { value: 'available', label: 'Available — limited availability',       dot: 'bg-blue-500'   },
                  { value: 'busy',      label: 'Busy — not accepting new bookings',      dot: 'bg-amber-500'  },
                  { value: 'offline',   label: 'Offline — completely off',               dot: 'bg-gray-400'   },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setAvailabilityState(opt.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-start transition-all ${
                      availabilityState === opt.value ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
                    <span className="text-xs font-medium text-gray-700">{opt.label}</span>
                    {availabilityState === opt.value && <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Working hours grid */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Working Hours
              </p>
              <div className="space-y-2">
                {DAYS.map(({ key, short }) => {
                  const d = workingHours[key] ?? { active: false };
                  return (
                    <div key={key} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${d.active ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                      <span className="text-xs font-semibold text-gray-600 w-8 shrink-0">{short}</span>
                      <button onClick={() => updateDayHours(key, 'active', !d.active)}
                        className={`w-8 h-5 rounded-full transition-colors shrink-0 ${d.active ? 'bg-blue-500' : 'bg-gray-300'}`}>
                        <span className={`block w-3 h-3 bg-white rounded-full mx-auto transition-transform ${d.active ? 'translate-x-1.5' : '-translate-x-1'}`} />
                      </button>
                      {d.active ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input type="time" value={d.from || '09:00'} onChange={e => updateDayHours(key, 'from', e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 w-24" />
                          <span className="text-xs text-gray-400">to</span>
                          <input type="time" value={d.to || '18:00'} onChange={e => updateDayHours(key, 'to', e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 w-24" />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 flex-1">Off</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Blocked dates calendar */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-red-500" /> Blocked Dates
              </p>
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => { const d = new Date(calendarYear, calendarMonth - 1, 1); setCalendarMonth(d.getMonth()); setCalendarYear(d.getFullYear()); }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <p className="text-xs font-semibold text-gray-700">{monthLabel}</p>
                <button onClick={() => { const d = new Date(calendarYear, calendarMonth + 1, 1); setCalendarMonth(d.getMonth()); setCalendarYear(d.getFullYear()); }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                  <div key={d} className="text-center text-[10px] text-gray-400 font-medium py-1">{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {[...Array(firstDay)].map((_, i) => <div key={`e${i}`} />)}
                {[...Array(daysInMonth)].map((_, i) => {
                  const day = i + 1;
                  const iso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isBlocked = blockedDates.includes(iso);
                  const isPast = iso < today;
                  return (
                    <button key={day} onClick={() => toggleDate(iso)} disabled={isPast}
                      className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                        isPast ? 'text-gray-300 cursor-default' :
                        isBlocked ? 'bg-red-500 text-white' :
                        'hover:bg-red-50 text-gray-700'
                      }`}>
                      {day}
                    </button>
                  );
                })}
              </div>
              {blockedDates.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-600">{blockedDates.length} date{blockedDates.length !== 1 ? 's' : ''} blocked</p>
                    <button onClick={() => setBlockedDates([])} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {blockedDates.sort().slice(0, 6).map(d => (
                      <span key={d} className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-[10px] font-medium">
                        {new Date(d + 'T12:00:00').toLocaleDateString('en-IL', { day: '2-digit', month: 'short' })}
                        <button onClick={() => toggleDate(d)}><X className="w-2.5 h-2.5" /></button>
                      </span>
                    ))}
                    {blockedDates.length > 6 && <span className="text-[10px] text-gray-400 py-0.5">+{blockedDates.length - 6} more</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Badges Tab ───────────────────────────────────────────────── */}
      {activeTab === 'badges' && (
        <div className="space-y-3">

          {/* ── Trust Score Widget ──────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Trust Score</p>
                <p className="text-xs text-gray-500">Computed from your real booking history</p>
              </div>
              {trustStats?.trustScore != null ? (
                <div className="ms-auto flex flex-col items-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center border-4 font-bold text-lg"
                    style={{
                      borderColor: trustStats.trustScore >= 75 ? '#C5A55A' : trustStats.trustScore >= 50 ? '#3b82f6' : '#d1d5db',
                      color: trustStats.trustScore >= 75 ? '#C5A55A' : trustStats.trustScore >= 50 ? '#3b82f6' : '#6b7280',
                    }}
                  >
                    {trustStats.trustScore}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">out of 100</p>
                </div>
              ) : (
                <div className="ms-auto px-2.5 py-1 bg-gray-100 rounded-full text-[10px] text-gray-500 font-medium">
                  Not enough data yet
                </div>
              )}
            </div>

            {/* Metric chips */}
            <div className="grid grid-cols-2 gap-2">
              {/* Acceptance rate */}
              <div className={`flex items-center gap-2 p-2.5 rounded-lg ${trustStats?.acceptanceRatePct != null ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
                <UserCheck className={`w-4 h-4 shrink-0 ${trustStats?.acceptanceRatePct != null ? 'text-blue-500' : 'text-gray-300'}`} />
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500">Acceptance rate</p>
                  <p className={`text-sm font-semibold ${trustStats?.acceptanceRatePct != null ? 'text-blue-700' : 'text-gray-300'}`}>
                    {trustStats?.acceptanceRatePct != null ? `${trustStats.acceptanceRatePct}%` : '—'}
                  </p>
                </div>
              </div>

              {/* Completion rate */}
              <div className={`flex items-center gap-2 p-2.5 rounded-lg ${trustStats?.completionRatePct != null ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
                <CheckSquare className={`w-4 h-4 shrink-0 ${trustStats?.completionRatePct != null ? 'text-green-500' : 'text-gray-300'}`} />
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500">Completion rate</p>
                  <p className={`text-sm font-semibold ${trustStats?.completionRatePct != null ? 'text-green-700' : 'text-gray-300'}`}>
                    {trustStats?.completionRatePct != null ? `${trustStats.completionRatePct}%` : '—'}
                  </p>
                </div>
              </div>

              {/* Response rate */}
              <div className={`flex items-center gap-2 p-2.5 rounded-lg ${trustStats?.responseRatePct != null ? 'bg-purple-50 border border-purple-100' : 'bg-gray-50 border border-gray-100'}`}>
                <Clock className={`w-4 h-4 shrink-0 ${trustStats?.responseRatePct != null ? 'text-purple-500' : 'text-gray-300'}`} />
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500">Response rate</p>
                  <p className={`text-sm font-semibold ${trustStats?.responseRatePct != null ? 'text-purple-700' : 'text-gray-300'}`}>
                    {trustStats?.responseRatePct != null ? `${trustStats.responseRatePct}%` : '—'}
                  </p>
                </div>
              </div>

              {/* Cancellation rate — show as risk signal */}
              <div className={`flex items-center gap-2 p-2.5 rounded-lg ${
                trustStats?.cancellationRatePct != null
                  ? trustStats.cancellationRatePct > 10 ? 'bg-red-50 border border-red-100'
                  : trustStats.cancellationRatePct > 5 ? 'bg-amber-50 border border-amber-100'
                  : 'bg-green-50 border border-green-100'
                  : 'bg-gray-50 border border-gray-100'
              }`}>
                <AlertTriangle className={`w-4 h-4 shrink-0 ${
                  trustStats?.cancellationRatePct != null
                    ? trustStats.cancellationRatePct > 10 ? 'text-red-400'
                    : trustStats.cancellationRatePct > 5 ? 'text-amber-400'
                    : 'text-green-400'
                    : 'text-gray-300'
                }`} />
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500">Cancel risk</p>
                  <p className={`text-sm font-semibold ${
                    trustStats?.cancellationRatePct != null
                      ? trustStats.cancellationRatePct > 10 ? 'text-red-600'
                      : trustStats.cancellationRatePct > 5 ? 'text-amber-600'
                      : 'text-green-700'
                      : 'text-gray-300'
                  }`}>
                    {trustStats?.cancellationRatePct != null
                      ? trustStats.cancellationRatePct > 10 ? 'High'
                      : trustStats.cancellationRatePct > 5 ? 'Medium'
                      : 'Low'
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Verified badges earned */}
            {Array.isArray(trustStats?.badges) && trustStats.badges.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-2 font-medium uppercase tracking-wide">Verified Badges</p>
                <div className="flex flex-wrap gap-1.5">
                  {(trustStats.badges as string[]).map((b: string) => {
                    const BADGE_LABELS: Record<string, string> = {
                      id_verified: 'ID Verified',
                      insured: 'Insured',
                      licensed: 'Licensed',
                      background_check: 'Background Check',
                    };
                    return (
                      <span key={b} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-700">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {BADGE_LABELS[b] ?? b}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Background check — real status from API */}
          <div className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${profile?.backgroundCheckStatus === 'approved' ? 'border-green-200' : 'border-gray-200'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${profile?.backgroundCheckStatus === 'approved' ? 'bg-green-50' : 'bg-gray-50'}`}>
              <Shield className={`w-5 h-5 ${profile?.backgroundCheckStatus === 'approved' ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Background Check</p>
              <p className="text-xs text-gray-500">Police clearance verification</p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              profile?.backgroundCheckStatus === 'approved' ? 'bg-green-100 text-green-700' :
              profile?.backgroundCheckStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {bgCheckInfo?.label ?? 'Not Started'}
            </span>
          </div>

          {/* Premium provider badge — based on real job count */}
          <div className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${(profile?.completedBookingsCount ?? 0) >= 100 ? 'border-amber-200' : 'border-gray-200'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${(profile?.completedBookingsCount ?? 0) >= 100 ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <Award className={`w-5 h-5 ${(profile?.completedBookingsCount ?? 0) >= 100 ? 'text-amber-600' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Premium Provider</p>
              <p className="text-xs text-gray-500">
                {(profile?.completedBookingsCount ?? 0) >= 100
                  ? '100+ completed jobs'
                  : `${profile?.completedBookingsCount ?? 0} / 100 jobs completed`}
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              (profile?.completedBookingsCount ?? 0) >= 100 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {(profile?.completedBookingsCount ?? 0) >= 100 ? 'Earned' : 'Locked'}
            </span>
          </div>

          {/* Top Rated — based on real rating */}
          <div className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${(profile?.ratingAvg ?? 0) >= 4.8 && (profile?.ratingCount ?? 0) >= 10 ? 'border-yellow-200' : 'border-gray-200'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${(profile?.ratingAvg ?? 0) >= 4.8 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
              <Star className={`w-5 h-5 ${(profile?.ratingAvg ?? 0) >= 4.8 && (profile?.ratingCount ?? 0) >= 10 ? 'text-yellow-500 fill-yellow-400' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Top Rated</p>
              <p className="text-xs text-gray-500">Requires 4.8+ rating with 10+ reviews</p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              (profile?.ratingAvg ?? 0) >= 4.8 && (profile?.ratingCount ?? 0) >= 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {(profile?.ratingAvg ?? 0) >= 4.8 && (profile?.ratingCount ?? 0) >= 10 ? 'Earned' : 'Locked'}
            </span>
          </div>

          {/* Reviews section */}
          {(() => {
            const rev = (reviewsApiData as any)?.reviews;
            const avgRating: number | null = rev?.avgRating ?? null;
            const totalCount: number = rev?.totalCount ?? 0;
            const dist: Record<number, number> = rev?.distribution ?? {};
            const recent: any[] = rev?.recent ?? [];

            return (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" /> Your Reviews
                  </p>
                  {totalCount > 0 && (
                    <span className="text-xs text-gray-500">{totalCount} review{totalCount !== 1 ? 's' : ''}</span>
                  )}
                </div>

                {totalCount === 0 ? (
                  <div className="p-6 text-center">
                    <Star className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No reviews yet</p>
                    <p className="text-[10px] text-gray-300 mt-0.5">Reviews appear here after clients rate your service</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-4">
                    {/* Rating summary */}
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-gray-900">{avgRating?.toFixed(1) ?? '—'}</p>
                        <div className="flex gap-0.5 mt-1 justify-center">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-3 h-3 ${s <= Math.round(avgRating ?? 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{totalCount} reviews</p>
                      </div>
                      <div className="flex-1 space-y-1">
                        {[5,4,3,2,1].map(star => {
                          const ct = dist[star] ?? 0;
                          const pct = totalCount > 0 ? (ct / totalCount) * 100 : 0;
                          return (
                            <div key={star} className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-500 w-4 text-right">{star}</span>
                              <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400 shrink-0" />
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-400 w-4">{ct}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recent reviews */}
                    {recent.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-gray-100">
                        {recent.map((r: any) => (
                          <div key={r.id} className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(s => (
                                  <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                                ))}
                              </div>
                              {r.createdAt && (
                                <span className="text-[10px] text-gray-400 ms-auto">
                                  {new Date(r.createdAt).toLocaleDateString('en-IL', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                              )}
                            </div>
                            {r.comment && (
                              <p className="text-xs text-gray-600 leading-relaxed">{r.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Save button */}
      {activeTab !== 'badges' && (
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full py-3 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {saveMutation.isPending ? 'Saving...' : 'Save Profile'}
        </button>
      )}
    </div>
  );
}
