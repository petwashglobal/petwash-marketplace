import { useState } from 'react';
import { useLocation } from 'wouter';
import { Star, MapPin, Shield, Clock, SlidersHorizontal, Heart, Zap, CheckCircle, Sparkles, ChevronDown, ChevronUp, Dog, Cat, Rabbit, Bird } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export interface ProviderCardData {
  id: string;
  name: string;
  tagline?: string;
  location: string;
  rating: number;
  reviewCount: number;
  completedBookings: number;
  yearsExperience: number;
  priceFrom: number;
  priceUnit: string;
  priceUnitHe?: string;
  profileImageUrl: string;
  isVerified: boolean;
  isTopRated: boolean;
  responseTime?: string;
  specialties?: string[];
  // — new competitive fields —
  repeatClientCount?: number;
  responseRate?: number;
  isNew?: boolean;
  isAvailableThisWeek?: boolean;
  lastReviewSnippet?: string;
  hasFencedYard?: boolean;
  hasNoPetsAtHome?: boolean;
  hasBackgroundCheck?: boolean;
  isSavedByUser?: boolean;
}

type Platform = 'sitter' | 'walker' | 'driver' | 'groomer' | 'trainer';

interface ProviderBrowseGridProps {
  platform: Platform;
  providers: ProviderCardData[];
  isLoading?: boolean;
  language?: 'en' | 'he';
  onFilterChange?: (filters: FilterState) => void;
  onSaveToggle?: (providerId: string, saved: boolean) => void;
}

interface FilterState {
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

const PLATFORM_CONFIG: Record<Platform, {
  title: string; titleHe: string; subtitle: string; subtitleHe: string; icon: string; detailPath: string;
}> = {
  sitter:  { title: '⁦The Sitter Suite™⁩', titleHe: '⁦The Sitter Suite™⁩', subtitle: 'Premium pet sitting by verified hosts', subtitleHe: 'שמרטוף חיות מחמד פרימיום על ידי מארחים מאומתים', icon: '🏠', detailPath: '/sitter-suite/sitters' },
  walker:  { title: '⁦Walk My Pet™⁩', titleHe: '⁦Walk My Pet™⁩', subtitle: 'Professional dog walking services', subtitleHe: 'שירותי הליכת כלבים מקצועיים', icon: '🐕', detailPath: '/walk-my-pet/walkers' },
  driver:  { title: '⁦PetTrek™⁩', titleHe: '⁦PetTrek™⁩', subtitle: 'Safe & comfortable pet transport', subtitleHe: 'הסעות חיות מחמד בטוחות ונוחות', icon: '🚗', detailPath: '/pettrek/drivers' },
  groomer: { title: 'Grooming Marketplace', titleHe: 'מרקטפלייס טיפוח', subtitle: 'Expert pet grooming & styling', subtitleHe: 'טיפוח ועיצוב חיות מחמד מקצועי', icon: '✂️', detailPath: '/groomers' },
  trainer: { title: 'Pet Academy™', titleHe: 'Pet Academy™', subtitle: 'Certified trainers, proven methods', subtitleHe: 'מאלפים מוסמכים, שיטות מוכחות', icon: '🎓', detailPath: '/academy/trainers' },
};

const PET_TYPE_OPTIONS = [
  { value: 'all', label: 'All Pets', labelHe: 'כל החיות', Icon: null },
  { value: 'dog', label: 'Dogs', labelHe: 'כלבים', Icon: Dog },
  { value: 'cat', label: 'Cats', labelHe: 'חתולים', Icon: Cat },
  { value: 'rabbit', label: 'Rabbits', labelHe: 'ארנבים', Icon: Rabbit },
  { value: 'bird', label: 'Birds', labelHe: 'ציפורים', Icon: Bird },
];

const DEFAULTS: FilterState = {
  location: '', minRating: 0, maxPrice: 1000, minPrice: 0,
  sortBy: 'rating', petType: 'all',
  availableThisWeek: false, backgroundCheckOnly: false,
  fencedYardOnly: false, noPetsAtHomeOnly: false,
};

export function ProviderBrowseGrid({
  platform, providers, isLoading = false, language = 'en',
  onFilterChange, onSaveToggle,
}: ProviderBrowseGridProps) {
  const [, navigate] = useLocation();
  const isHebrew = language === 'he';
  const config = PLATFORM_CONFIG[platform];

  const [filters, setFilters] = useState<FilterState>(DEFAULTS);
  const [showFilters, setShowFilters] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    onFilterChange?.(next);
  };

  const clearFilters = () => { setFilters(DEFAULTS); onFilterChange?.(DEFAULTS); };

  const handleSave = (e: React.MouseEvent, providerId: string) => {
    e.stopPropagation();
    setSavedIds(prev => {
      const next = new Set(prev);
      const saved = !next.has(providerId);
      saved ? next.add(providerId) : next.delete(providerId);
      onSaveToggle?.(providerId, saved);
      return next;
    });
  };

  const activeFilterCount = [
    filters.minRating > 0, filters.maxPrice < 1000, filters.minPrice > 0,
    filters.petType !== 'all', filters.availableThisWeek,
    filters.backgroundCheckOnly, filters.fencedYardOnly, filters.noPetsAtHomeOnly,
  ].filter(Boolean).length;

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

          {/* Pet Type Quick Chips — Airbnb category shortcuts */}
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

      {/* Filters Bar */}
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

            {/* Available This Week toggle */}
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

            {/* More Filters */}
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

          {/* Expanded Filter Panel — Rover-inspired */}
          {showFilters && (
            <div className="mt-4 p-6 bg-gray-50 rounded-2xl animate-in slide-in-from-top-2 space-y-5">
              {/* Price Range */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-3 block">
                  {isHebrew ? 'טווח מחיר (₪)' : 'Price Range (₪)'}
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder={isHebrew ? 'מינימום' : 'Min'}
                      value={filters.minPrice || ''}
                      onChange={(e) => updateFilter('minPrice', Number(e.target.value))}
                      className="rounded-xl text-sm h-10"
                    />
                  </div>
                  <span className="text-gray-400 text-sm">—</span>
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder={isHebrew ? 'מקסימום' : 'Max'}
                      value={filters.maxPrice < 1000 ? filters.maxPrice : ''}
                      onChange={(e) => updateFilter('maxPrice', Number(e.target.value) || 1000)}
                      className="rounded-xl text-sm h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Rating + Trust toggles in a grid */}
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-3 block">
                    {isHebrew ? 'דירוג מינימלי' : 'Minimum Rating'}
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[['any', isHebrew ? 'הכל' : 'Any', '0'], ['4+', '4+ ⭐', '4'], ['4.5+', '4.5+ ⭐', '4.5'], ['4.8+', '4.8+ ⭐', '4.8']].map(([key, label, val]) => (
                      <button
                        key={key}
                        onClick={() => updateFilter('minRating', Number(val))}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          filters.minRating === Number(val)
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-3 block">
                    {isHebrew ? 'אמון ובטיחות' : 'Trust & Safety'}
                  </label>
                  <div className="space-y-2">
                    {[
                      { key: 'backgroundCheckOnly', label: isHebrew ? 'בדיקת רקע בלבד' : 'Background check', icon: '🛡️' },
                      { key: 'fencedYardOnly', label: isHebrew ? 'חצר מגודרת' : 'Fenced yard', icon: '🏡' },
                      { key: 'noPetsAtHomeOnly', label: isHebrew ? 'ללא חיות בית' : 'No other pets', icon: '🐾' },
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
              <button onClick={clearFilters} className="text-sm text-emerald-600 underline">
                {isHebrew ? 'נקה פילטרים' : 'Clear filters'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-500">
                  {providers.length} {isHebrew ? 'נותני שירות' : 'providers'}
                  {activeFilterCount > 0 && (
                    <span className="ml-2 text-gray-400">
                      · {isHebrew ? 'מסוננים' : 'filtered'}
                    </span>
                  )}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers.map((provider) => {
                  const isSaved = savedIds.has(provider.id) || !!provider.isSavedByUser;
                  const quickResponder = (provider.responseRate ?? 0) >= 90;

                  return (
                    <article
                      key={provider.id}
                      onClick={() => navigate(`${config.detailPath}/${provider.id}`)}
                      className="group cursor-pointer"
                      data-testid={`card-provider-${provider.id}`}
                    >
                      {/* Image Container */}
                      <div className="relative aspect-[4/3] rounded-3xl overflow-hidden mb-4">
                        <img
                          src={provider.profileImageUrl}
                          alt={provider.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        {/* Top-left: Verified + New badges */}
                        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                          {provider.isNew && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-500 rounded-full text-[11px] font-semibold text-white shadow-md">
                              <Sparkles className="w-3 h-3" />
                              {isHebrew ? 'חדש' : 'New'}
                            </div>
                          )}
                          {provider.isVerified && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full text-[11px] font-medium text-gray-900 shadow-sm">
                              <Shield className="w-3 h-3 text-emerald-500" />
                              {isHebrew ? 'מאומת' : 'Verified'}
                            </div>
                          )}
                          {provider.isTopRated && (
                            <div className="px-2.5 py-1 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full text-[11px] font-semibold text-black shadow-sm">
                              ⭐ {isHebrew ? 'מומלץ' : 'Top'}
                            </div>
                          )}
                        </div>

                        {/* Top-right: Save/Heart button */}
                        <button
                          onClick={(e) => handleSave(e, provider.id)}
                          aria-label={isSaved ? 'Remove from saved' : 'Save provider'}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform duration-200"
                        >
                          <Heart
                            className={`w-4 h-4 transition-colors duration-200 ${
                              isSaved ? 'fill-rose-500 text-rose-500' : 'text-gray-500'
                            }`}
                          />
                        </button>

                        {/* Availability dot + rating bottom-left */}
                        <div className="absolute bottom-3 left-3 flex items-center gap-2">
                          {provider.isAvailableThisWeek !== undefined && (
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full shadow-sm text-[11px] font-medium ${
                              provider.isAvailableThisWeek ? 'text-emerald-700' : 'text-gray-500'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${provider.isAvailableThisWeek ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                              {provider.isAvailableThisWeek
                                ? (isHebrew ? 'זמין השבוע' : 'Available')
                                : (isHebrew ? 'תפוס' : 'Limited')}
                            </div>
                          )}
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full shadow-sm">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                            <span className="text-[11px] font-semibold text-gray-900">{provider.rating.toFixed(1)}</span>
                            <span className="text-[10px] text-gray-400">({provider.reviewCount})</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors leading-tight" data-testid={`text-name-${provider.id}`}>
                            {provider.name}
                          </h3>
                          <div className="text-right shrink-0">
                            <span className="text-base font-semibold text-gray-900">₪{provider.priceFrom}</span>
                            <span className="text-xs text-gray-400 block leading-tight">
                              {isHebrew && provider.priceUnitHe ? provider.priceUnitHe : provider.priceUnit}
                            </span>
                          </div>
                        </div>

                        {/* Location + Response time */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{provider.location}</span>
                          {provider.responseTime && (
                            <>
                              <span className="text-gray-300">·</span>
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>{provider.responseTime}</span>
                            </>
                          )}
                        </div>

                        {/* Chips: Quick responder, Repeat clients, Background check */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {quickResponder && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold border border-emerald-100">
                              <Zap className="w-2.5 h-2.5" />
                              {isHebrew ? 'מגיב מהר' : 'Responds quickly'}
                            </span>
                          )}
                          {(provider.repeatClientCount ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-[10px] font-semibold border border-violet-100">
                              <CheckCircle className="w-2.5 h-2.5" />
                              {provider.repeatClientCount} {isHebrew ? 'לקוחות חוזרים' : 'repeat clients'}
                            </span>
                          )}
                          {provider.hasBackgroundCheck && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-semibold border border-blue-100">
                              🛡️ {isHebrew ? 'בדיקת רקע' : 'Checked'}
                            </span>
                          )}
                        </div>

                        {/* Review snippet — MadPaws style social proof */}
                        {provider.lastReviewSnippet && (
                          <p className="text-xs text-gray-500 italic line-clamp-1 pt-0.5">
                            "{provider.lastReviewSnippet}"
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
