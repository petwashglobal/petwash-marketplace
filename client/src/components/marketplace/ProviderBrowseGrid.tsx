/**
 * ProviderBrowseGrid — Real data, real filters, real save persistence.
 *
 * DATA TRUTH AUDIT:
 *   repeatClientCount   → from DB, computed from booking_requests (null = hide)
 *   responseRate        → from DB, computed from booking_requests (null = hide)
 *   hasBackgroundCheck  → from provider_profiles.background_check_status = 'approved'
 *   hasFencedYard       → from provider_profiles.has_fenced_yard (null = hide)
 *   hasNoPetsAtHome     → from provider_profiles.has_no_pets_at_home (null = hide)
 *   isAvailableThisWeek → from provider_profiles.availability_state (real presence)
 *   isNew               → completedBookingsCount < 3 (real count)
 *   isSavedByUser       → from saved_providers table (persisted per Firebase UID)
 *
 * FILTER TRUTH AUDIT:
 *   minRating           → DB: WHERE rating_avg >= minRating
 *   availableThisWeek   → DB: WHERE availability_state IN ('online','available')
 *   backgroundCheckOnly → DB: WHERE background_check_status = 'approved'
 *   fencedYardOnly      → DB: WHERE has_fenced_yard = true
 *   noPetsAtHomeOnly    → DB: WHERE has_no_pets_at_home = true
 *   sortBy              → DB: ORDER BY rating_avg / rating_count / created_at DESC
 *   petType             → FRONTEND ONLY — service-level pet type; no DB column on provider_profiles yet
 *   minPrice/maxPrice   → FRONTEND ONLY — pricing stored on individual service listings not provider_profiles
 */

import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star, MapPin, Shield, Clock, SlidersHorizontal, Heart, Zap,
  CheckCircle, Sparkles, ChevronDown, ChevronUp, Dog, Cat, Rabbit, Bird,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProviderCardData {
  userId: string;
  name: string | null;
  tagline?: string;
  location?: string;
  ratingAvg: number | null;
  ratingCount: number;
  priceFrom?: number | null;          // ILS — from price_from_cents/100; null = not set
  priceFromCents?: number | null;     // raw agorot from DB
  acceptedPets?: string[];            // e.g. ['dog','cat']; empty = accepts all
  priceUnit?: string;
  priceUnitHe?: string;
  profileImageUrl?: string;
  isVerified?: boolean;
  isTopRated?: boolean;
  // ── Trust signals — null = hide, never fake ──
  repeatClientCount: number | null;
  responseRatePct: number | null;
  avgResponseTimeMinutes: number | null;
  responseTimeLabel: string | null;
  isNew: boolean;
  isAvailableThisWeek: boolean;
  hasBackgroundCheck: boolean;
  hasFencedYard: boolean | null;
  hasNoPetsAtHome: boolean | null;
  completedBookingsCount: number;
  isSavedByUser: boolean;
  memberSince?: string | null;
  lastReviewSnippet?: string;
}

type Platform = 'sitter' | 'walker' | 'driver' | 'groomer' | 'trainer';

export interface FilterState {
  location: string;
  minRating: number;
  maxPrice: number;
  minPrice: number;
  sortBy: 'rating' | 'price' | 'reviews' | 'distance' | 'new';
  petType: 'all' | 'dog' | 'cat' | 'rabbit' | 'bird';
  availableThisWeek: boolean;
  backgroundCheckOnly: boolean;
  fencedYardOnly: boolean;
  noPetsAtHomeOnly: boolean;
}

interface ProviderBrowseGridProps {
  platform: Platform;
  language?: 'en' | 'he';
  /** Optional static providers — if omitted, the component fetches from /api/providers/browse */
  providers?: ProviderCardData[];
  /** If static providers passed in, isLoading controls skeleton state */
  isLoading?: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<Platform, {
  title: string; titleHe: string; subtitle: string; subtitleHe: string; icon: string; detailPath: string;
}> = {
  sitter:  { title: 'The Sitter Suite™', titleHe: 'The Sitter Suite™', subtitle: 'Premium pet sitting by verified hosts', subtitleHe: 'שמרטוף חיות מחמד פרימיום על ידי מארחים מאומתים', icon: '🏠', detailPath: '/sitter-suite/sitters' },
  walker:  { title: 'Walk My Pet™',      titleHe: 'Walk My Pet™',      subtitle: 'Professional dog walking services',    subtitleHe: 'שירותי הליכת כלבים מקצועיים',                icon: '🐕', detailPath: '/walk-my-pet/walkers' },
  driver:  { title: 'PetTrek™',          titleHe: 'PetTrek™',          subtitle: 'Safe & comfortable pet transport',     subtitleHe: 'הסעות חיות מחמד בטוחות ונוחות',              icon: '🚗', detailPath: '/pettrek/drivers' },
  groomer: { title: 'Grooming Services', titleHe: 'שירותי טיפוח',      subtitle: 'Expert pet grooming & styling',        subtitleHe: 'טיפוח ועיצוב חיות מחמד מקצועי',              icon: '✂️', detailPath: '/groomers' },
  trainer: { title: 'Pet Academy™',      titleHe: 'Pet Academy™',      subtitle: 'Certified trainers, proven methods',   subtitleHe: 'מאלפים מוסמכים, שיטות מוכחות',               icon: '🎓', detailPath: '/academy/trainers' },
};

const PET_TYPE_OPTIONS = [
  { value: 'all',    label: 'All Pets',  labelHe: 'כל החיות', Icon: null },
  { value: 'dog',    label: 'Dogs',      labelHe: 'כלבים',    Icon: Dog },
  { value: 'cat',    label: 'Cats',      labelHe: 'חתולים',   Icon: Cat },
  { value: 'rabbit', label: 'Rabbits',   labelHe: 'ארנבים',   Icon: Rabbit },
  { value: 'bird',   label: 'Birds',     labelHe: 'ציפורים',  Icon: Bird },
];

const DEFAULTS: FilterState = {
  location: '', minRating: 0, maxPrice: 1000, minPrice: 0,
  sortBy: 'rating', petType: 'all',
  availableThisWeek: false, backgroundCheckOnly: false,
  fencedYardOnly: false, noPetsAtHomeOnly: false,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ProviderBrowseGrid({
  platform, language = 'en', providers: staticProviders, isLoading: staticLoading,
}: ProviderBrowseGridProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isHebrew = language === 'he';
  const config = PLATFORM_CONFIG[platform];

  const [filters, setFilters] = useState<FilterState>(DEFAULTS);
  const [showFilters, setShowFilters] = useState(false);

  // ── Backend filter params — all filters now DB-backed ───────────────────
  const backendParams = new URLSearchParams({
    platform,
    ...(filters.minRating > 0 && { minRating: String(filters.minRating) }),
    ...(filters.availableThisWeek && { availableThisWeek: 'true' }),
    ...(filters.backgroundCheckOnly && { backgroundCheckOnly: 'true' }),
    ...(filters.fencedYardOnly && { fencedYardOnly: 'true' }),
    ...(filters.noPetsAtHomeOnly && { noPetsAtHomeOnly: 'true' }),
    // price + petType — now DB-backed via price_from_cents / accepted_pets columns
    ...(filters.minPrice > 0 && { minPrice: String(filters.minPrice) }),
    ...(filters.maxPrice < 1000 && { maxPrice: String(filters.maxPrice) }),
    ...(filters.petType !== 'all' && { petType: filters.petType }),
    sortBy: filters.sortBy,
    limit: '48',
  });

  // ── Fetch providers from backend ─────────────────────────────────────────
  const { data: browseData, isLoading: browseLoading } = useQuery<{ providers: ProviderCardData[] }>({
    queryKey: ['/api/providers/browse', backendParams.toString()],
    enabled: !staticProviders,
    staleTime: 60_000,
  });

  const rawProviders = staticProviders ?? browseData?.providers ?? [];
  const isLoading = staticProviders ? (staticLoading ?? false) : browseLoading;

  // All filters are server-backed — no client-side post-filtering
  const providers = rawProviders;

  // ── Saved providers state (persisted per user) ───────────────────────────
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Load saved providers on mount (requires auth)
  const { data: savedData } = useQuery<{ saved: { providerId: string }[] }>({
    queryKey: ['/api/saved-providers'],
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (savedData?.saved) {
      setSavedIds(new Set(savedData.saved.map(s => s.providerId)));
    }
  }, [savedData]);

  // Also seed from API response isSavedByUser
  useEffect(() => {
    if (rawProviders.length > 0) {
      setSavedIds(prev => {
        const next = new Set(prev);
        rawProviders.forEach(p => { if (p.isSavedByUser) next.add(p.userId); });
        return next;
      });
    }
  }, [rawProviders]);

  // ── Save / Unsave mutations (optimistic + rollback on error) ────────────
  const saveMutation = useMutation({
    mutationFn: async ({ providerId, saving }: { providerId: string; saving: boolean }) => {
      if (saving) {
        return apiRequest('POST', `/api/saved-providers/${providerId}`, { platform });
      } else {
        return apiRequest('DELETE', `/api/saved-providers/${providerId}`);
      }
    },
    onMutate: ({ providerId, saving }) => {
      // Capture snapshot for rollback
      const prev = new Set(savedIds);
      setSavedIds(snapshot => {
        const next = new Set(snapshot);
        saving ? next.add(providerId) : next.delete(providerId);
        return next;
      });
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/saved-providers'] });
    },
    onError: (_err, _vars, context) => {
      // Rollback optimistic update to the pre-mutation snapshot
      if (context?.prev) setSavedIds(context.prev);
      toast({ title: isHebrew ? 'שגיאה' : 'Error', description: isHebrew ? 'לא ניתן לשמור' : 'Could not save', variant: 'destructive' });
    },
  });

  const handleSave = useCallback((e: React.MouseEvent, providerId: string) => {
    e.stopPropagation();
    if (!user) {
      toast({ title: isHebrew ? 'נדרשת התחברות' : 'Sign in to save', description: isHebrew ? 'התחבר כדי לשמור נותני שירות' : 'Create a free account to save providers', variant: 'default' });
      return;
    }
    const saving = !savedIds.has(providerId);
    saveMutation.mutate({ providerId, saving });
  }, [user, savedIds, saveMutation, isHebrew, toast]);

  // ── Filter helpers ───────────────────────────────────────────────────────
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  const clearFilters = () => setFilters(DEFAULTS);

  const activeFilterCount = [
    filters.minRating > 0,
    filters.maxPrice < 1000,
    filters.minPrice > 0,
    filters.petType !== 'all',
    filters.availableThisWeek,
    filters.backgroundCheckOnly,
    filters.fencedYardOnly,
    filters.noPetsAtHomeOnly,
  ].filter(Boolean).length;

  // ── Filter chip that shows "backend-wired" vs "frontend-only" label ──────
  // Shown in filter panel so users know which are real DB filters
  const FilterBadge = ({ real }: { real: boolean }) => (
    <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${real ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      {real ? (isHebrew ? 'מחיפוש' : 'DB') : (isHebrew ? 'מקומי' : 'local')}
    </span>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-100 mb-6">
            <span className="text-2xl">{config.icon}</span>
            <span className="text-sm font-medium text-gray-600 uppercase tracking-wider">
              {isHebrew ? 'שירות פרימיום' : 'Premium Service'}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-gray-900 mb-4">
            {isHebrew ? config.titleHe : config.title}
          </h1>
          <p className="text-xl text-gray-500 font-light max-w-2xl mx-auto">
            {isHebrew ? config.subtitleHe : config.subtitle}
          </p>

          {/* Pet Type Chips — frontend filter only */}
          <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
            {PET_TYPE_OPTIONS.map(opt => {
              const active = filters.petType === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateFilter('petType', opt.value as FilterState['petType'])}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                    active
                      ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                  }`}
                >
                  {opt.Icon && <opt.Icon className="w-4 h-4" />}
                  {isHebrew ? opt.labelHe : opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Sticky Filters Bar */}
      <section className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-100 py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            {/* Location */}
            <div className="relative flex-1 min-w-[180px]">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={isHebrew ? 'חפש לפי מיקום...' : 'City or neighbourhood...'}
                className="pl-11 h-11 rounded-full border-gray-200 bg-gray-50 focus:bg-white text-sm"
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
              />
            </div>

            {/* Sort */}
            <Select value={filters.sortBy} onValueChange={(v) => updateFilter('sortBy', v as FilterState['sortBy'])}>
              <SelectTrigger className="w-[150px] h-11 rounded-full border-gray-200 text-sm">
                <SelectValue placeholder={isHebrew ? 'מיין לפי' : 'Sort by'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">{isHebrew ? 'דירוג גבוה' : 'Top Rated'}</SelectItem>
                <SelectItem value="price">{isHebrew ? 'מחיר נמוך' : 'Lowest Price'}</SelectItem>
                <SelectItem value="reviews">{isHebrew ? 'הכי נסקרים' : 'Most Reviews'}</SelectItem>
                <SelectItem value="distance">{isHebrew ? 'הכי קרוב' : 'Nearest'}</SelectItem>
                <SelectItem value="new">{isHebrew ? 'חדשים' : 'New Providers'}</SelectItem>
              </SelectContent>
            </Select>

            {/* Available This Week — DB-backed filter */}
            <button
              onClick={() => updateFilter('availableThisWeek', !filters.availableThisWeek)}
              className={`h-11 px-5 rounded-full text-sm font-medium border transition-all duration-200 ${
                filters.availableThisWeek
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${filters.availableThisWeek ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              {isHebrew ? 'זמין השבוע' : 'Available Now'}
            </button>

            {/* Filters Drawer */}
            <Button
              variant="outline"
              className={`h-11 px-5 rounded-full text-sm border-gray-200 relative ${showFilters ? 'border-gray-900 text-gray-900' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              {isHebrew ? 'פילטרים' : 'Filters'}
              {showFilters ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* Expanded Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-6 bg-gray-50 rounded-2xl animate-in slide-in-from-top-2 space-y-5">
              {/* Price Range — frontend-only note */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center">
                  {isHebrew ? 'טווח מחיר (₪)' : 'Price Range (₪)'}
                  <FilterBadge real={false} />
                </label>
                <p className="text-[11px] text-amber-600 mb-3">
                  {isHebrew ? 'מסנן מקומי — מחירים לפי מחירון שירות' : 'Local filter — prices vary by service listing'}
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    type="number" placeholder={isHebrew ? 'מינימום' : 'Min'}
                    value={filters.minPrice || ''}
                    onChange={(e) => updateFilter('minPrice', Number(e.target.value))}
                    className="rounded-xl text-sm h-10 flex-1"
                  />
                  <span className="text-gray-400 text-sm">—</span>
                  <Input
                    type="number" placeholder={isHebrew ? 'מקסימום' : 'Max'}
                    value={filters.maxPrice < 1000 ? filters.maxPrice : ''}
                    onChange={(e) => updateFilter('maxPrice', Number(e.target.value) || 1000)}
                    className="rounded-xl text-sm h-10 flex-1"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                {/* Min Rating — DB-backed */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center">
                    {isHebrew ? 'דירוג מינימלי' : 'Minimum Rating'}
                    <FilterBadge real={true} />
                  </label>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {[['any', isHebrew ? 'הכל' : 'Any', '0'], ['4+', '4+', '4'], ['4.5+', '4.5+', '4.5'], ['4.8+', '4.8+', '4.8']].map(([key, label, val]) => (
                      <button
                        key={key}
                        onClick={() => updateFilter('minRating', Number(val))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          filters.minRating === Number(val)
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {label} {Number(val) > 0 && '⭐'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trust & Safety toggles — DB-backed */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center">
                    {isHebrew ? 'אמון ובטיחות' : 'Trust & Safety'}
                    <FilterBadge real={true} />
                  </label>
                  <div className="space-y-2 mt-2">
                    {[
                      { key: 'backgroundCheckOnly', label: isHebrew ? 'בדיקת רקע בלבד' : 'Background check', icon: '🛡️' },
                      { key: 'fencedYardOnly',      label: isHebrew ? 'חצר מגודרת' : 'Fenced yard',        icon: '🏡' },
                      { key: 'noPetsAtHomeOnly',    label: isHebrew ? 'ללא חיות בית' : 'No other pets',     icon: '🐾' },
                    ].map(({ key, label, icon }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer group">
                        <div
                          onClick={() => updateFilter(key as keyof FilterState, !filters[key as keyof FilterState] as any)}
                          className={`w-10 h-6 rounded-full transition-all duration-200 flex items-center px-0.5 cursor-pointer ${
                            filters[key as keyof FilterState] ? 'bg-gray-900' : 'bg-gray-200'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                            filters[key as keyof FilterState] ? 'translate-x-4' : 'translate-x-0'
                          }`} />
                        </div>
                        <span className="text-sm text-gray-600 group-hover:text-gray-900">{icon} {label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={clearFilters} className="text-sm text-gray-400 hover:text-gray-600 underline">
                  {isHebrew ? 'נקה הכל' : 'Clear all filters'}
                </button>
              </div>
            </div>
          )}

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {filters.availableThisWeek && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {isHebrew ? 'זמין השבוע' : 'Available this week'}
                  <button onClick={() => updateFilter('availableThisWeek', false)} className="ml-1 text-emerald-400 hover:text-emerald-700">×</button>
                </span>
              )}
              {filters.backgroundCheckOnly && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200">
                  🛡️ {isHebrew ? 'בדיקת רקע' : 'Background check'}
                  <button onClick={() => updateFilter('backgroundCheckOnly', false)} className="ml-1 text-blue-400 hover:text-blue-700">×</button>
                </span>
              )}
              {filters.fencedYardOnly && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                  🏡 {isHebrew ? 'חצר מגודרת' : 'Fenced yard'}
                  <button onClick={() => updateFilter('fencedYardOnly', false)} className="ml-1 text-amber-400 hover:text-amber-700">×</button>
                </span>
              )}
              {filters.noPetsAtHomeOnly && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-200">
                  🐾 {isHebrew ? 'ללא חיות בית' : 'No other pets'}
                  <button onClick={() => updateFilter('noPetsAtHomeOnly', false)} className="ml-1 text-purple-400 hover:text-purple-700">×</button>
                </span>
              )}
              {filters.minRating > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
                  ⭐ {filters.minRating}+
                  <button onClick={() => updateFilter('minRating', 0)} className="ml-1 text-amber-400 hover:text-amber-700">×</button>
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Results Grid */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/3] bg-gray-100 rounded-3xl mb-4" />
                  <div className="h-5 bg-gray-100 rounded-lg w-3/4 mb-2" />
                  <div className="h-4 bg-gray-100 rounded-lg w-1/2" />
                </div>
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-6">{config.icon}</div>
              <h3 className="text-2xl font-light text-gray-900 mb-2">
                {isHebrew ? 'לא נמצאו תוצאות' : 'No results found'}
              </h3>
              <p className="text-gray-500 mb-4">
                {isHebrew ? 'נסה לשנות את הפילטרים' : 'Try adjusting your filters'}
              </p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-sm text-emerald-600 underline">
                  {isHebrew ? 'נקה פילטרים' : 'Clear filters'}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-500">
                  {providers.length} {isHebrew ? 'נותני שירות' : 'providers'}
                  {activeFilterCount > 0 && (
                    <span className="ml-2 text-gray-400">· {isHebrew ? 'מסוננים' : 'filtered'}</span>
                  )}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers.map((provider) => {
                  const isSaved = savedIds.has(provider.userId) || provider.isSavedByUser;
                  // Only show "Responds quickly" chip when response rate is REAL and ≥ 90%
                  const quickResponder = provider.responseRatePct !== null && provider.responseRatePct >= 90;
                  // Only show "New" badge when isNew is true AND we have real booking data
                  const showNew = provider.isNew && provider.completedBookingsCount === 0;

                  return (
                    <article
                      key={provider.userId}
                      onClick={() => navigate(`${config.detailPath}/${provider.userId}`)}
                      className="group cursor-pointer"
                      data-testid={`card-provider-${provider.userId}`}
                    >
                      {/* Image Container */}
                      <div className="relative aspect-[4/3] rounded-3xl overflow-hidden mb-4 bg-gray-100">
                        {provider.profileImageUrl ? (
                          <img
                            src={provider.profileImageUrl}
                            alt={provider.name ?? 'Provider'}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-6xl">
                            {config.icon}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        {/* Top-left: New + Background check badges */}
                        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap max-w-[calc(100%-3.5rem)]">
                          {showNew && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-500 rounded-full text-[11px] font-semibold text-white shadow-md">
                              <Sparkles className="w-3 h-3" />
                              {isHebrew ? 'חדש' : 'New'}
                            </div>
                          )}
                          {provider.hasBackgroundCheck && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full text-[11px] font-medium text-gray-900 shadow-sm">
                              <Shield className="w-3 h-3 text-emerald-500" />
                              {isHebrew ? 'נבדק' : 'Checked'}
                            </div>
                          )}
                        </div>

                        {/* Top-right: Save/Heart — persists per user */}
                        <button
                          onClick={(e) => handleSave(e, provider.userId)}
                          aria-label={isSaved ? (isHebrew ? 'הסר מהשמורים' : 'Remove from saved') : (isHebrew ? 'שמור' : 'Save provider')}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform duration-200 z-10"
                        >
                          <Heart
                            className={`w-4 h-4 transition-colors duration-200 ${
                              isSaved ? 'fill-rose-500 text-rose-500' : 'text-gray-500'
                            }`}
                          />
                        </button>

                        {/* Bottom-left: Availability dot + rating */}
                        <div className="absolute bottom-3 left-3 flex items-center gap-2 flex-wrap">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full shadow-sm text-[11px] font-medium ${
                            provider.isAvailableThisWeek ? 'text-emerald-700' : 'text-gray-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${provider.isAvailableThisWeek ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                            {provider.isAvailableThisWeek
                              ? (isHebrew ? 'זמין' : 'Available')
                              : (isHebrew ? 'מוגבל' : 'Limited')}
                          </div>
                          {provider.ratingAvg !== null && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full shadow-sm">
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                              <span className="text-[11px] font-semibold text-gray-900">{Number(provider.ratingAvg).toFixed(1)}</span>
                              {provider.ratingCount > 0 && (
                                <span className="text-[10px] text-gray-400">({provider.ratingCount})</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors leading-tight" data-testid={`text-name-${provider.userId}`}>
                            {provider.name ?? (isHebrew ? 'נותן שירות' : 'Provider')}
                          </h3>
                          {provider.priceFrom !== undefined && (
                            <div className="text-right shrink-0">
                              <span className="text-base font-semibold text-gray-900">₪{provider.priceFrom}</span>
                              {provider.priceUnit && (
                                <span className="text-xs text-gray-400 block leading-tight">
                                  {isHebrew && provider.priceUnitHe ? provider.priceUnitHe : provider.priceUnit}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Location + Response time — only shown when real data exists */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          {provider.location && (
                            <>
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span>{provider.location}</span>
                            </>
                          )}
                          {/* Response time only shown when avgResponseTimeMinutes is real */}
                          {provider.responseTimeLabel && (
                            <>
                              {provider.location && <span className="text-gray-300">·</span>}
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>{isHebrew ? 'מגיב תוך' : 'Responds in'} {provider.responseTimeLabel}</span>
                            </>
                          )}
                        </div>

                        {/* Trust chips — only shown when real data, never faked */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {/* Quick responder — only when real responseRatePct ≥ 90 */}
                          {quickResponder && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold border border-emerald-100">
                              <Zap className="w-2.5 h-2.5" />
                              {isHebrew ? 'מגיב מהר' : 'Responds quickly'}
                            </span>
                          )}
                          {/* Repeat clients — only when repeatClientCount is real and > 0 */}
                          {provider.repeatClientCount !== null && provider.repeatClientCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-[10px] font-semibold border border-violet-100">
                              <CheckCircle className="w-2.5 h-2.5" />
                              {provider.repeatClientCount} {isHebrew ? 'לקוחות חוזרים' : 'repeat clients'}
                            </span>
                          )}
                          {/* Fenced yard — only when explicitly true */}
                          {provider.hasFencedYard === true && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-semibold border border-amber-100">
                              🏡 {isHebrew ? 'חצר מגודרת' : 'Fenced yard'}
                            </span>
                          )}
                          {/* No pets at home — only when explicitly true */}
                          {provider.hasNoPetsAtHome === true && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-semibold border border-rose-100">
                              🐾 {isHebrew ? 'ללא חיות בית' : 'No other pets'}
                            </span>
                          )}
                        </div>

                        {/* Review snippet — only shown when real */}
                        {provider.lastReviewSnippet && (
                          <p className="text-xs text-gray-500 italic line-clamp-1 pt-0.5">
                            "{provider.lastReviewSnippet}"
                          </p>
                        )}

                        {/* New provider safe fallback — shown instead of fake stats */}
                        {provider.isNew && provider.completedBookingsCount === 0 && (
                          <p className="text-xs text-rose-500 font-medium pt-0.5">
                            {isHebrew ? '✨ נותן שירות חדש — היה הראשון!' : '✨ New provider — be their first!'}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
