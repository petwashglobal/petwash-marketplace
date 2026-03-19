import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Camera, Star, Shield, Award, MapPin, Globe, Dog, Cat, Bird,
  Rabbit, CheckCircle2, Edit3, Home, AlertCircle, Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProviderProfile {
  bio: string;
  languages: string[];
  availabilityState: string;
  priceFromCents: number | null;
  priceFrom: number | null;
  acceptedPets: string[];
  hasFencedYard: boolean | null;
  hasNoPetsAtHome: boolean | null;
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
  const [activeTab, setActiveTab] = useState<'basic' | 'services' | 'home' | 'badges'>('basic');

  // Form state (initialized from API)
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState<string[]>(['Hebrew']);
  const [serviceAreas, setServiceAreas] = useState<string[]>(['Tel Aviv']);
  const [availabilityState, setAvailabilityState] = useState('offline');
  const [priceFrom, setPriceFrom] = useState<string>('');         // display ILS
  const [acceptedPets, setAcceptedPets] = useState<string[]>([]);
  const [hasFencedYard, setHasFencedYard] = useState<boolean | null>(null);
  const [hasNoPetsAtHome, setHasNoPetsAtHome] = useState<boolean | null>(null);
  const [initialized, setInitialized] = useState(false);

  // ── Fetch own profile ──────────────────────────────────────────────────────
  const { data: profileData, isLoading } = useQuery<ProfileResponse>({
    queryKey: ['/api/provider-profile/me'],
    staleTime: 30_000,
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
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {[
          { id: 'basic',    label: 'Basic' },
          { id: 'services', label: 'Services' },
          { id: 'home',     label: 'My Home' },
          { id: 'badges',   label: 'Badges' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
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

      {/* ── Badges Tab ───────────────────────────────────────────────── */}
      {activeTab === 'badges' && (
        <div className="space-y-3">
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
