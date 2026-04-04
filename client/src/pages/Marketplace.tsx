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
} from 'lucide-react';
import type { MarketplaceSearchFilters, MarketplacePlatformId } from '@shared/schema';

type TierFilter = 'prestige' | 'gold' | 'silver' | 'bronze' | undefined;

const TIER_CONFIG = {
  prestige: { label: 'Prestige', icon: Crown, color: 'bg-purple-100 text-purple-700 border-purple-300' },
  gold: { label: 'Gold', icon: Award, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  silver: { label: 'Silver', icon: Shield, color: 'bg-white text-gray-600 border-gray-300' },
  bronze: { label: 'Bronze', icon: Zap, color: 'bg-orange-100 text-orange-700 border-orange-300' },
  at_risk: { label: 'At Risk', icon: Zap, color: 'bg-red-100 text-red-700 border-red-300' },
  new: { label: 'New', icon: TrendingUp, color: 'bg-blue-100 text-blue-700 border-blue-300' },
} as const;

export default function Marketplace() {
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
      color: 'text-blue-600',
    },
    {
      id: 'sitter_suite' as MarketplacePlatformId,
      name: 'Sitter Suite',
      icon: <Home className="w-5 h-5" />,
      color: 'text-pink-600',
    },
    {
      id: 'pet_trek' as MarketplacePlatformId,
      name: 'PetTrek',
      icon: <Car className="w-5 h-5" />,
      color: 'text-purple-600',
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
      <div className="border-b border-purple-100/20">
        <div className="max-w-7xl mx-auto px-4 py-12 text-center luxury-fade-in">
          <h1 className="luxury-heading-xl mb-4">
            Pet Services Marketplace
          </h1>
          <p className="luxury-subtitle-lg">
            Find trusted professionals for all your pet care needs
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
                  className="flex items-center gap-2"
                  data-testid={`tab-${platform.id}`}
                >
                  <span className={platform.color}>{platform.icon}</span>
                  <span className="hidden sm:inline">{platform.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="luxury-glass-card luxury-shadow-lg sticky top-4">
              <div className="p-6 border-b border-purple-100/20">
                <h3 className="text-lg font-bold flex items-center gap-2 luxury-gradient-text">
                  <SlidersHorizontal className="w-5 h-5" />
                  Filters
                </h3>
              </div>
              <div className="p-6 space-y-6">
                {/* Sort By */}
                <div>
                  <Label className="mb-2 block">
                    <TrendingUp className="w-4 h-4 inline mr-1" />
                    Sort By
                  </Label>
                  <Select
                    value={filters.sortBy ?? 'recommended'}
                    onValueChange={(v) => updateFilter('sortBy', v as any)}
                  >
                    <SelectTrigger data-testid="select-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recommended">Recommended</SelectItem>
                      <SelectItem value="rating">Highest Rated</SelectItem>
                      <SelectItem value="availability">Soonest Available</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* City Filter */}
                <div>
                  <Label htmlFor="city" className="mb-2 block">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    City
                  </Label>
                  <Input
                    id="city"
                    placeholder="Enter city..."
                    value={filters.city || ''}
                    onChange={(e) => updateFilter('city', e.target.value || undefined)}
                    data-testid="input-city"
                  />
                </div>

                {/* Minimum Rating */}
                <div>
                  <Label className="mb-2 block">
                    <Star className="w-4 h-4 inline mr-1" />
                    Minimum Rating
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
                      {filters.minRating?.toFixed(1) || '0'} stars and up
                    </p>
                  </div>
                </div>

                {/* Verified Only */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="verified">Verified Only</Label>
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
                      <Label htmlFor="bodycam">Body Camera</Label>
                      <Switch
                        id="bodycam"
                        checked={filters.bodyCamera || false}
                        onCheckedChange={(checked) => updateFilter('bodyCamera', checked)}
                        data-testid="switch-bodycam"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="drone">Drone Access</Label>
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
                    <Label htmlFor="mobile">Mobile Service</Label>
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
                  Reset Filters
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
                  'Searching...'
                ) : data?.total ? (
                  `${data.total} ${data.total === 1 ? 'provider' : 'providers'} found`
                ) : (
                  'No providers found'
                )}
              </h2>
              {/* Active sort indicator */}
              {filters.sortBy === 'recommended' && (
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Ranked by quality
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
                  Clear filter
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
                  Failed to load providers. Please try again.
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
                      No providers found
                    </h3>
                    <p className="luxury-text-body">
                      Try adjusting your filters or search in a different city
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
                          <div className="absolute -top-2 right-3 z-10">
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
                  Previous
                </button>
                <button
                  className="luxury-btn-outline"
                  disabled={(filters.offset || 0) + filters.limit! >= data.total}
                  onClick={() => updateFilter('offset', (filters.offset || 0) + filters.limit!)}
                  data-testid="button-next-page"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
