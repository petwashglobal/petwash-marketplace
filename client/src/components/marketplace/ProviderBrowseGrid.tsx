import { useState } from 'react';
import { useLocation } from 'wouter';
import { Star, MapPin, Shield, Clock, Filter, Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
}

type Platform = 'sitter' | 'walker' | 'driver' | 'groomer' | 'trainer';

interface ProviderBrowseGridProps {
  platform: Platform;
  providers: ProviderCardData[];
  isLoading?: boolean;
  language?: 'en' | 'he';
  onFilterChange?: (filters: FilterState) => void;
}

interface FilterState {
  location: string;
  minRating: number;
  maxPrice: number;
  sortBy: 'rating' | 'price' | 'reviews' | 'distance';
}

const platformConfig: Record<Platform, {
  title: string;
  titleHe: string;
  subtitle: string;
  subtitleHe: string;
  icon: string;
  detailPath: string;
}> = {
  sitter: {
    title: 'The Sitter Suite™',
    titleHe: 'The Sitter Suite™',
    subtitle: 'Premium pet sitting by verified hosts',
    subtitleHe: 'שמרטוף חיות מחמד פרימיום על ידי מארחים מאומתים',
    icon: '🏠',
    detailPath: '/sitter-suite/sitters',
  },
  walker: {
    title: 'Walk My Pet™',
    titleHe: 'Walk My Pet™',
    subtitle: 'Professional dog walking services',
    subtitleHe: 'שירותי הליכת כלבים מקצועיים',
    icon: '🐕',
    detailPath: '/walk-my-pet/walkers',
  },
  driver: {
    title: 'PetTrek™',
    titleHe: 'PetTrek™',
    subtitle: 'Safe & comfortable pet transport',
    subtitleHe: 'הסעות חיות מחמד בטוחות ונוחות',
    icon: '🚗',
    detailPath: '/pettrek/drivers',
  },
  groomer: {
    title: 'Grooming Marketplace',
    titleHe: 'מרקטפלייס טיפוח',
    subtitle: 'Expert pet grooming & styling',
    subtitleHe: 'טיפוח ועיצוב חיות מחמד מקצועי',
    icon: '✂️',
    detailPath: '/groomers',
  },
  trainer: {
    title: 'Pet Academy™',
    titleHe: 'Pet Academy™',
    subtitle: 'Certified trainers, proven methods',
    subtitleHe: 'מאלפים מוסמכים, שיטות מוכחות',
    icon: '🎓',
    detailPath: '/academy/trainers',
  },
};

export function ProviderBrowseGrid({
  platform,
  providers,
  isLoading = false,
  language = 'en',
  onFilterChange,
}: ProviderBrowseGridProps) {
  const [, navigate] = useLocation();
  const isHebrew = language === 'he';
  const config = platformConfig[platform];

  const [filters, setFilters] = useState<FilterState>({
    location: '',
    minRating: 0,
    maxPrice: 1000,
    sortBy: 'rating',
  });

  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleProviderClick = (providerId: string) => {
    navigate(`${config.detailPath}/${providerId}`);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Pure White Luxury */}
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
        </div>
      </section>

      {/* Filters Section */}
      <section className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-100 py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search Location */}
            <div className="relative flex-1 min-w-[200px]">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder={isHebrew ? 'חפש לפי מיקום...' : 'Search by location...'}
                className="pl-12 h-12 rounded-full border-gray-200 bg-gray-50 focus:bg-white"
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
                data-testid="input-search-location"
              />
            </div>

            {/* Quick Filters */}
            <Select
              value={filters.sortBy}
              onValueChange={(value) => updateFilter('sortBy', value as FilterState['sortBy'])}
            >
              <SelectTrigger className="w-[160px] h-12 rounded-full border-gray-200" data-testid="select-sort">
                <SelectValue placeholder={isHebrew ? 'מיין לפי' : 'Sort by'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">{isHebrew ? 'דירוג גבוה' : 'Top Rated'}</SelectItem>
                <SelectItem value="price">{isHebrew ? 'מחיר נמוך' : 'Lowest Price'}</SelectItem>
                <SelectItem value="reviews">{isHebrew ? 'הכי נסקרים' : 'Most Reviews'}</SelectItem>
                <SelectItem value="distance">{isHebrew ? 'הכי קרוב' : 'Nearest'}</SelectItem>
              </SelectContent>
            </Select>

            {/* More Filters Button */}
            <Button
              variant="outline"
              className="h-12 px-6 rounded-full border-gray-200"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-filters"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              {isHebrew ? 'פילטרים' : 'Filters'}
            </Button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 p-6 bg-gray-50 rounded-2xl animate-in slide-in-from-top-2">
              <div className="grid sm:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    {isHebrew ? 'דירוג מינימלי' : 'Minimum Rating'}
                  </label>
                  <Select
                    value={String(filters.minRating)}
                    onValueChange={(v) => updateFilter('minRating', Number(v))}
                  >
                    <SelectTrigger className="rounded-xl" data-testid="select-rating">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{isHebrew ? 'הכל' : 'Any'}</SelectItem>
                      <SelectItem value="3">3+ ⭐</SelectItem>
                      <SelectItem value="4">4+ ⭐</SelectItem>
                      <SelectItem value="4.5">4.5+ ⭐</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    {isHebrew ? 'מחיר מקסימלי (₪)' : 'Max Price (₪)'}
                  </label>
                  <Input
                    type="number"
                    value={filters.maxPrice}
                    onChange={(e) => updateFilter('maxPrice', Number(e.target.value))}
                    className="rounded-xl"
                    data-testid="input-max-price"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    className="text-gray-500"
                    onClick={() => {
                      setFilters({ location: '', minRating: 0, maxPrice: 1000, sortBy: 'rating' });
                      onFilterChange?.({ location: '', minRating: 0, maxPrice: 1000, sortBy: 'rating' });
                    }}
                  >
                    {isHebrew ? 'נקה פילטרים' : 'Clear Filters'}
                  </Button>
                </div>
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
              <p className="text-gray-500">
                {isHebrew ? 'נסה לשנות את הפילטרים' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-500 mb-6">
                {providers.length} {isHebrew ? 'נותני שירות נמצאו' : 'providers found'}
              </div>
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {providers.map((provider) => (
                  <article
                    key={provider.id}
                    onClick={() => handleProviderClick(provider.id)}
                    className="group cursor-pointer"
                    data-testid={`card-provider-${provider.id}`}
                  >
                    {/* Image Container - Fashion Editorial Style */}
                    <div className="relative aspect-[4/3] rounded-3xl overflow-hidden mb-4">
                      <img
                        src={provider.profileImageUrl}
                        alt={provider.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Badges */}
                      <div className="absolute top-4 left-4 flex gap-2">
                        {provider.isVerified && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full text-xs font-medium text-gray-900 shadow-sm">
                            <Shield className="w-3.5 h-3.5 text-emerald-500" />
                            {isHebrew ? 'מאומת' : 'Verified'}
                          </div>
                        )}
                        {provider.isTopRated && (
                          <div className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full text-xs font-semibold text-black shadow-sm">
                            ⭐ {isHebrew ? 'מומלץ' : 'Top'}
                          </div>
                        )}
                      </div>

                      {/* Rating Badge */}
                      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-sm">
                        <Star className="w-4 h-4 text-amber-500 fill-current" />
                        <span className="text-sm font-semibold text-gray-900">{provider.rating.toFixed(1)}</span>
                        <span className="text-xs text-gray-500">({provider.reviewCount})</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 group-hover:text-emerald-600 transition-colors" data-testid={`text-name-${provider.id}`}>
                        {provider.name}
                      </h3>
                      
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <MapPin className="w-4 h-4" />
                        <span>{provider.location}</span>
                        {provider.responseTime && (
                          <>
                            <span className="text-gray-300">·</span>
                            <Clock className="w-4 h-4" />
                            <span>{provider.responseTime}</span>
                          </>
                        )}
                      </div>

                      {provider.tagline && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                          {provider.tagline}
                        </p>
                      )}

                      {/* Price */}
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-xl font-light text-gray-900">₪{provider.priceFrom}</span>
                        <span className="text-sm text-gray-500">
                          {isHebrew && provider.priceUnitHe ? provider.priceUnitHe : provider.priceUnit}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default ProviderBrowseGrid;
