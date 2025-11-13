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
} from 'lucide-react';
import type { MarketplaceSearchFilters, MarketplacePlatformId } from '@shared/schema';

export default function Marketplace() {
  const [selectedPlatform, setSelectedPlatform] = useState<MarketplacePlatformId>('walk_my_pet');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<MarketplaceSearchFilters>({
    platform: 'walk_my_pet',
    limit: 20,
    offset: 0,
  });

  // Update filters when platform changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      platform: selectedPlatform,
      offset: 0, // Reset pagination
    }));
  }, [selectedPlatform]);

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
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Pet Services Marketplace
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Find trusted professionals for all your pet care needs
          </p>
        </div>
      </div>

      {/* Platform Switcher */}
      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
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
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
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
                <Button
                  variant="outline"
                  className="w-full"
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
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {/* Results Header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {isLoading ? (
                  'Searching...'
                ) : data?.total ? (
                  `${data.total} ${data.total === 1 ? 'provider' : 'providers'} found`
                ) : (
                  'No providers found'
                )}
              </h2>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="p-6">
                  <p className="text-red-600 dark:text-red-400">
                    Failed to load providers. Please try again.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Results List */}
            {!isLoading && !error && data?.providers && (
              <div className="space-y-4">
                {data.providers.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No providers found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Try adjusting your filters or search in a different city
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  data.providers.map((provider) => (
                    <ProviderCard key={provider.id} provider={provider} />
                  ))
                )}
              </div>
            )}

            {/* Pagination */}
            {!isLoading && data && data.providers.length > 0 && data.total > filters.limit! && (
              <div className="mt-8 flex justify-center gap-2">
                <Button
                  variant="outline"
                  disabled={filters.offset === 0}
                  onClick={() => updateFilter('offset', Math.max(0, (filters.offset || 0) - filters.limit!))}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={(filters.offset || 0) + filters.limit! >= data.total}
                  onClick={() => updateFilter('offset', (filters.offset || 0) + filters.limit!)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
