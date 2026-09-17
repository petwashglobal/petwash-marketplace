/**
 * MARKETPLACE PAGE
 * 
 * Unified marketplace for all 6 platforms:
 * - Walk My Pet (dog walking)
 * - Sitter Suite (pet sitting)
 * - PetTrek (pet transport)
 * - Groomers (grooming services)
 * - K9000 (wash stations - no providers)
 * 
 * Features:
 * - Platform switcher
 * - Advanced filters (location, rating, price, availability)
 * - Provider search results with pagination
 * - Real-time search with debouncing
 */

import { useState, useEffect } from 'react';
import { useMarketplaceSearch } from '@/services/marketplace';
import { ProviderCard } from '@/components/ProviderCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  SlidersHorizontal,
  Dog,
  Home,
  Car,
  Scissors,
  MapPin,
  Star,
  TrendingUp,
  Shield,
  Crown,
  Award,
  Zap,
  Filter,
  X,
} from 'lucide-react';
import type { MarketplaceSearchFilters, MarketplacePlatformId } from '@shared/schema';
import { useSEO, pageSEO } from '@/lib/seo';
import { useLanguage } from '@/lib/languageStore';

type TierFilter = 'prestige' | 'gold' | 'silver' | 'bronze' | undefined;

const TIER_CONFIG = {
  prestige: { label: 'Prestige', icon: Crown, color: 'bg-[#D4AF37] text-black border-[#D4AF37]' },
  gold: { label: 'Gold', icon: Award, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  silver: { label: 'Silver', icon: Shield, color: 'bg-white text-gray-600 border-gray-300' },
  bronze: { label: 'Bronze', icon: Zap, color: 'bg-[#D4AF37] text-black border-[#D4AF37]' },
  at_risk: { label: 'At Risk', icon: Zap, color: 'bg-red-100 text-red-700 border-red-300' },
  new: { label: 'New', icon: TrendingUp, color: 'bg-[#D4AF37] text-black border-[#D4AF37]' },
} as const;

export default function Marketplace() {
  useSEO(pageSEO.marketplace);
  // Was English-only on the Hebrew site (2026-09-17). Platform and tier names
  // stay English (brand rule); everything else follows the site language.
  const { language } = useLanguage();
  const isHe = language === 'he';
  const L = (en: string, he: string) => (isHe ? he : en);
  const [selectedPlatform, setSelectedPlatform] = useState<MarketplacePlatformId>('walk_my_pet');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTierFilter, setActiveTierFilter] = useState<TierFilter>(undefined);
  const [filters, setFilters] = useState<MarketplaceSearchFilters>({
    platform: 'walk_my_pet',
    sortBy: 'recommended',
    limit: 20,
    offset: 0,
  });

  // Update filters when platform changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      platform: selectedPlatform,
      offset: 0,
    }));
  }, [selectedPlatform]);

  // Apply tier filter
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      tierFilter: activeTierFilter as any,
      offset: 0,
    }));
  }, [activeTierFilter]);

  const handleTierClick = (tier: TierFilter) => {
    setActiveTierFilter(prev => (prev === tier ? undefined : tier));
  };

  const { data, isLoading, error } = useMarketplaceSearch(filters);

  const platforms = [
    {
      id: 'walk_my_pet' as MarketplacePlatformId,
      name: 'Walk My Pet',
      icon: <Dog className="w-5 h-5" />,
      color: 'text-[#B8932F]',
    },
    {
      id: 'sitter_suite' as MarketplacePlatformId,
      name: 'Sitter Suite',
      icon: <Home className="w-5 h-5" />,
      color: 'text-[#B8932F]',
    },
    {
      id: 'pet_trek' as MarketplacePlatformId,
      name: 'PetTrek',
      icon: <Car className="w-5 h-5" />,
      color: 'text-[#B8932F]',
      disabled: true,
      badge: L('Coming Soon', 'בקרוב'),
    },
    {
      id: 'groomers' as MarketplacePlatformId,
      name: 'Groomers',
      icon: <Scissors className="w-5 h-5" />,
      color: 'text-teal-600',
    },
  ];

  const updateFilter = <K extends keyof MarketplaceSearchFilters>(
    key: K,
    value: MarketplaceSearchFilters[K]
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      offset: 0, // Reset pagination when filters change
    }));
  };

  return (
    <div className="min-h-screen luxury-bg-mesh">
      {/* Header */}
      <div className="border-b border-[#D4AF37]/20">
        <div className="max-w-7xl mx-auto px-4 py-12 text-center luxury-fade-in">
          <h1 className="luxury-heading-xl mb-4">
            {L('Pet Services Marketplace', 'שירותים לחיות מחמד')}
          </h1>
          <p className="luxury-subtitle-lg">
            {L('Find trusted professionals for all your pet care needs', 'אנשי מקצוע מאומתים לכל מה שחיית המחמד שלכם צריכה')}
          </p>
        </div>
      </div>

      {/* Platform Switcher */}
      <div className="bg-white dark:bg-white border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Tabs
            value={selectedPlatform}
            onValueChange={(value) => setSelectedPlatform(value as MarketplacePlatformId)}
          >
            <TabsList className="grid w-full grid-cols-4 max-w-2xl">
              {platforms.map((platform) => (
                <TabsTrigger
                  key={platform.id}
                  value={platform.id}
                  disabled={platform.disabled}
                  className="flex items-center gap-2"
                  data-testid={`tab-${platform.id}`}
                >
                  <span className={platform.color}>{platform.icon}</span>
                  <span className="hidden sm:inline">{platform.name}</span>
                  {platform.badge ? (
                    <span className="hidden md:inline text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {platform.badge}
                    </span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Mobile filter toggle */}
        <div className="lg:hidden mb-4">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white shadow-sm text-sm font-medium"
            style={{ touchAction: 'manipulation', cursor: 'pointer' }}
            onClick={() => setShowFilters(v => !v)}
            aria-expanded={showFilters}
            aria-controls="marketplace-filters"
            data-testid="button-toggle-filters-mobile"
          >
            {showFilters ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
            {showFilters ? L('Hide Filters', 'הסתרת סינון') : L('Filters', 'סינון')}
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div id="marketplace-filters" className={`lg:col-span-1 ${showFilters ? '' : 'hidden lg:block'}`}>
            <div className="luxury-glass-card luxury-shadow-lg sticky top-4">
              <div className="p-6 border-b border-[#D4AF37]/20">
                <h3 className="text-lg font-bold flex items-center gap-2 luxury-gradient-text">
                  <SlidersHorizontal className="w-5 h-5" />
                  {L('Filters', 'סינון')}
                </h3>
              </div>
              <div className="p-6 space-y-6">
                {/* Sort By */}
                <div>
                  <Label className="mb-2 block">
                    <TrendingUp className="w-4 h-4 inline me-1" />
                    {L('Sort By', 'מיון')}
                  </Label>
                  <Select
                    value={filters.sortBy ?? 'recommended'}
                    onValueChange={(v) => updateFilter('sortBy', v as any)}
                  >
                    <SelectTrigger data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recommended">{L('Recommended', 'מומלצים')}</SelectItem>
                      <SelectItem value="rating">{L('Highest Rated', 'הדירוג הגבוה ביותר')}</SelectItem>
                      <SelectItem value="availability">{L('Soonest Available', 'הזמינים ביותר')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* City Filter */}
                <div>
                  <Label htmlFor="city" className="mb-2 block">
                    <MapPin className="w-4 h-4 inline me-1" />
                    {L('City', 'עיר')}
                  </Label>
                  <Input
                    id="city"
                    placeholder={L('Enter city...', 'הקלידו עיר…')}
                    value={filters.city || ''}
                    onChange={(e) => updateFilter('city', e.target.value || undefined)}
                    data-testid="input-city"
                  />
                </div>

                {/* Minimum Rating */}
                <div>
                  <Label className="mb-2 block">
                    <Star className="w-4 h-4 inline me-1" />
                    {L('Minimum Rating', 'דירוג מינימלי')}
                  </Label>
                  <div className="space-y-2">
                    <Slider
                      value={[filters.minRating || 0]}
                      onValueChange={(value) => updateFilter('minRating', value[0] || undefined)}
                      max={5}
                      step={0.5}
                      className="w-full"
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isHe ? `${filters.minRating?.toFixed(1) || '0'} כוכבים ומעלה` : `${filters.minRating?.toFixed(1) || '0'} stars and up`}
                    </p>
                  </div>
                </div>

                {/* Verified Only */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="verified">{L('Verified Only', 'מאומתים בלבד')}</Label>
                  <Switch
                    id="verified"
                    checked={filters.verifiedOnly || false}
                    onCheckedChange={(checked) => updateFilter('verifiedOnly', checked)}
                    data-testid="switch-verified"
                  />
                </div>

                {/* Platform-Specific Filters */}
                {selectedPlatform === 'walk_my_pet' && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bodycam">{L('Body Camera', 'מצלמת גוף')}</Label>
                      <Switch
                        id="bodycam"
                        checked={filters.bodyCamera || false}
                        onCheckedChange={(checked) => updateFilter('bodyCamera', checked)}
                        data-testid="switch-bodycam"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="drone">{L('Drone Access', 'צילום רחפן')}</Label>
                      <Switch
                        id="drone"
                        checked={filters.droneAccess || false}
                        onCheckedChange={(checked) => updateFilter('droneAccess', checked)}
                        data-testid="switch-drone"
                      />
                    </div>
                  </>
                )}

                {selectedPlatform === 'groomers' && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mobile">{L('Mobile Service', 'שירות עד הבית')}</Label>
                    <Switch
                      id="mobile"
                      checked={filters.mobileService || false}
                      onCheckedChange={(checked) => updateFilter('mobileService', checked)}
                      data-testid="switch-mobile"
                    />
                  </div>
                )}

                {/* Reset Filters */}
                <button
                  className="luxury-btn-outline w-full"
                  onClick={() =>
                    setFilters({
                      platform: selectedPlatform,
                      limit: 20,
                      offset: 0,
                    })
                  }
                  data-testid="button-reset-filters"
                >
                  {L('Reset Filters', 'איפוס סינון')}
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {/* Results Header */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-black flex-1">
                {isLoading ? (
                  L('Searching...', 'מחפשים…')
                ) : data?.total ? (
                  isHe
                    ? (data.total === 1 ? 'נמצא נותן שירות אחד' : `נמצאו ${data.total} נותני שירות`)
                    : `${data.total} ${data.total === 1 ? 'provider' : 'providers'} found`
                ) : (
                  L('No providers found', 'לא נמצאו נותני שירות')
                )}
              </h2>
              {/* Active sort indicator */}
              {filters.sortBy === 'recommended' && (
                <span className="text-xs text-[#B8932F] dark:text-[#D4AF37] font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {L('Ranked by quality', 'מדורגים לפי איכות')}
                </span>
              )}
            </div>

            {/* Tier Filter Chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              {(['prestige', 'gold', 'silver', 'bronze'] as const).map((tier) => {
                const cfg = TIER_CONFIG[tier];
                const Icon = cfg.icon;
                const active = activeTierFilter === tier;
                return (
                  <button
                    key={tier}
                    onClick={() => handleTierClick(tier as TierFilter)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? cfg.color + ' ring-2 ring-offset-1 ring-current'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
              {activeTierFilter && (
                <button
                  onClick={() => handleTierClick(undefined)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500"
                >
                  {L('Clear filter', 'ניקוי סינון')}
                </button>
              )}
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="luxury-glass-card luxury-shadow-lg p-6">
                    <div className="flex gap-4">
                      <Skeleton className="w-20 h-20 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-1/3" />
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-full" />
                        <div className="flex gap-2">
                          <Skeleton className="h-6 w-20" />
                          <Skeleton className="h-6 w-24" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="luxury-glass-card luxury-shadow-lg border-red-200 p-6">
                <p className="text-red-600 dark:text-red-400">
                  {L('Failed to load providers. Please try again.', 'לא הצלחנו לטעון נותני שירות. נסו שוב.')}
                </p>
              </div>
            )}

            {/* Results List */}
            {!isLoading && !error && data?.providers && (
              <div className="space-y-4 luxury-stagger-fade-in">
                {data.providers.length === 0 ? (
                  <div className="luxury-glass-card luxury-shadow-lg p-12 text-center">
                    <Search className="w-12 h-12 mx-auto mb-4 luxury-gradient-icon" />
                    <h3 className="text-lg font-bold mb-2 luxury-gradient-text">
                      {L('No providers found', 'לא נמצאו נותני שירות')}
                    </h3>
                    <p className="luxury-text-body">
                      {L('Try adjusting your filters or search in a different city', 'נסו לשנות את הסינון או לחפש בעיר אחרת')}
                    </p>
                  </div>
                ) : (
                  data.providers.map((provider: any) => {
                    const tierKey = provider.tier as keyof typeof TIER_CONFIG | undefined;
                    const tierCfg = tierKey && TIER_CONFIG[tierKey];
                    const TierIcon = tierCfg ? tierCfg.icon : null;
                    return (
                      <div key={provider.id} className="relative">
                        {tierCfg && TierIcon && tierKey !== 'new' && (
                          <div className="absolute -top-2 end-3 z-10">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${tierCfg.color}`}>
                              <TierIcon className="w-3 h-3" />
                              {tierCfg.label}
                            </span>
                          </div>
                        )}
                        <ProviderCard provider={provider} />
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Pagination */}
            {!isLoading && data && data.providers.length > 0 && data.total > filters.limit! && (
              <div className="mt-8 flex justify-center gap-4">
                <button
                  className="luxury-btn-outline"
                  disabled={filters.offset === 0}
                  onClick={() => updateFilter('offset', Math.max(0, (filters.offset || 0) - filters.limit!))}
                  data-testid="button-prev-page"
                >
                  {L('Previous', 'הקודם')}
                </button>
                <button
                  className="luxury-btn-outline"
                  disabled={(filters.offset || 0) + filters.limit! >= data.total}
                  onClick={() => updateFilter('offset', (filters.offset || 0) + filters.limit!)}
                  data-testid="button-next-page"
                >
                  {L('Next', 'הבא')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
