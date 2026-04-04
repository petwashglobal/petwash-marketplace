import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useLocation, useSearch } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Search,
  MapPin,
  Calendar,
  Star,
  Filter,
  Dog,
  Cat,
  Bird,
  Rabbit,
  Check,
  Shield,
  ChevronRight,
  X,
  Navigation,
  SlidersHorizontal,
  ArrowUpDown,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SearchFilters {
  serviceType: string;
  petCount: number;
  petTypes: string[];
  city: string;
  area: string;
  startDate: string;
  endDate: string;
  minRating: number;
  verifiedOnly: boolean;
  maxPrice: number | null;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  sortBy: 'distance' | 'rating' | 'price';
}

interface Provider {
  id: number;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  rating: number;
  totalReviews: number;
  totalBookings: number;
  pricePerNight: number | null;
  pricePerHour: number | null;
  city: string;
  distance?: number;
  distanceKm: number | null;
  proximityTier: string | null;
  matchScore: number | null;
  isVerified: boolean;
  hasPoliceCheck: boolean;
  yearsExperience: number;
  acceptedPetTypes: string[];
  maxPets: number;
  bio: string | null;
}

const petTypeIcons: Record<string, any> = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
};

const serviceTypes = [
  { value: 'pet_sitting',   labelEn: 'Pet Sitting',   labelHe: 'שמירה על חיות מחמד' },
  { value: 'dog_walking',   labelEn: 'Dog Walking',   labelHe: 'הליכה עם כלבים' },
  { value: 'grooming',      labelEn: 'Grooming',      labelHe: 'טיפוח' },
  { value: 'training',      labelEn: 'Training',      labelHe: 'אילוף' },
  { value: 'daycare',       labelEn: 'Daycare',       labelHe: 'פנסיון יומי' },
  { value: 'pet_transport', labelEn: 'Transport',     labelHe: 'הסעות', disabled: true },
];

const petTypes = [
  { value: 'dog',    icon: Dog,    labelEn: 'Dog',    labelHe: 'כלב' },
  { value: 'cat',    icon: Cat,    labelEn: 'Cat',    labelHe: 'חתול' },
  { value: 'bird',   icon: Bird,   labelEn: 'Bird',   labelHe: 'ציפור' },
  { value: 'rabbit', icon: Rabbit, labelEn: 'Rabbit', labelHe: 'ארנב' },
];

const RADIUS_OPTIONS = [5, 10, 20, 30, 50];

const DEFAULT_FILTERS: SearchFilters = {
  serviceType: 'pet_sitting',
  petCount: 1,
  petTypes: ['dog'],
  city: '',
  area: '',
  startDate: '',
  endDate: '',
  minRating: 0,
  verifiedOnly: false,
  maxPrice: null,
  latitude: null,
  longitude: null,
  radiusKm: 20,
  sortBy: 'rating',
};

export default function BookingSearch() {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';
  const [, setLocation] = useLocation();
  const search = useSearch();

  const [showFilters, setShowFilters] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<Provider[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  // Read lat/lng/location/service from URL params
  useEffect(() => {
    const params = new URLSearchParams(search);
    const lat = params.get('lat');
    const lng = params.get('lng');
    const loc = params.get('location');
    const service = params.get('service');
    setFilters(prev => ({
      ...prev,
      ...(lat && lng ? { latitude: parseFloat(lat), longitude: parseFloat(lng), sortBy: 'distance' } : {}),
      ...(loc ? { city: decodeURIComponent(loc) } : {}),
      ...(service ? { serviceType: service } : {}),
    }));
  }, [search]);

  const searchMutation = useMutation({
    mutationFn: async (f: SearchFilters) => {
      const res = await apiRequest('POST', '/api/booking-search', {
        serviceType: f.serviceType,
        petCount: f.petCount,
        petTypes: f.petTypes,
        city: f.city || undefined,
        area: f.area || undefined,
        startDate: f.startDate || undefined,
        endDate: f.endDate || undefined,
        minRating: f.minRating || undefined,
        verifiedOnly: f.verifiedOnly,
        maxPrice: f.maxPrice || undefined,
        latitude: f.latitude ?? undefined,
        longitude: f.longitude ?? undefined,
        radiusKm: f.latitude ? f.radiusKm : undefined,
        sortBy: f.latitude ? f.sortBy : (f.sortBy === 'distance' ? 'rating' : f.sortBy),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setSearchResults(data.providers || []);
      setHasSearched(true);
    },
  });

  const handleSearch = useCallback(() => {
    searchMutation.mutate(filters);
  }, [filters, searchMutation]);

  const togglePetType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      petTypes: prev.petTypes.includes(type)
        ? prev.petTypes.filter(t => t !== type)
        : [...prev.petTypes, type],
    }));
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...DEFAULT_FILTERS,
      latitude: prev.latitude,
      longitude: prev.longitude,
      city: prev.city,
    }));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFilters(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          sortBy: 'distance',
        }));
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  // Count active non-default filters for the badge
  const activeFilterCount = [
    filters.minRating > 0,
    filters.verifiedOnly,
    filters.maxPrice !== null,
    filters.radiusKm !== DEFAULT_FILTERS.radiusKm && filters.latitude !== null,
  ].filter(Boolean).length;

  const sortLabel = (v: string) => {
    if (isHebrew) {
      return v === 'distance' ? 'מרחק' : v === 'rating' ? 'דירוג' : 'מחיר';
    }
    return v === 'distance' ? 'Nearest first' : v === 'rating' ? 'Top rated' : 'Price: low to high';
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      <Card className="bg-white dark:bg-white border-0 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-black dark:text-black">
            {isHebrew ? 'חפש שירות לחיית המחמד שלך' : 'Find Care for Your Pet'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Row 1: Service + Location + Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Service type */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {isHebrew ? 'סוג שירות' : 'Service Type'}
              </Label>
              <Select
                value={filters.serviceType}
                onValueChange={(v) => setFilters(prev => ({ ...prev, serviceType: v }))}
              >
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map(s => (
                    <SelectItem
                      key={s.value}
                      value={s.value}
                      disabled={(s as any).disabled}
                      className={(s as any).disabled ? 'opacity-50' : ''}
                    >
                      {isHebrew ? s.labelHe : s.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location + GPS button */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {isHebrew ? 'מיקום / עיר' : 'Location / City'}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    data-testid="input-location"
                    placeholder={isHebrew ? 'הזן עיר או אזור' : 'City or area'}
                    value={filters.city}
                    onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={useMyLocation}
                  disabled={locating}
                  title={isHebrew ? 'השתמש במיקומי' : 'Use my location'}
                  data-testid="button-use-location"
                  className={filters.latitude ? 'border-black dark:border-white' : ''}
                >
                  <Navigation className={`h-4 w-4 ${locating ? 'animate-pulse' : ''} ${filters.latitude ? 'text-black dark:text-black' : ''}`} />
                </Button>
              </div>
              {filters.latitude && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {isHebrew ? `מיקום נמצא · רדיוס ${filters.radiusKm} ק"מ` : `Location set · ${filters.radiusKm} km radius`}
                </p>
              )}
            </div>

            {/* Start date (optional) */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {isHebrew ? 'תאריך התחלה (אופציונלי)' : 'Start Date (optional)'}
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  data-testid="input-start-date"
                  type="date"
                  value={filters.startDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFilters(prev => ({
                      ...prev,
                      startDate: v,
                      endDate: prev.endDate && prev.endDate < v ? v : prev.endDate,
                    }));
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* End date (optional) */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {isHebrew ? 'תאריך סיום (אופציונלי)' : 'End Date (optional)'}
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  data-testid="input-end-date"
                  type="date"
                  value={filters.endDate}
                  min={filters.startDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Pet type toggles */}
          <div className="mb-6">
            <Label className="text-sm font-medium mb-3 block">
              {isHebrew ? 'סוג חיית מחמד' : 'Pet Type'}
            </Label>
            <div className="flex flex-wrap gap-2">
              {petTypes.map(pet => {
                const Icon = pet.icon;
                const selected = filters.petTypes.includes(pet.value);
                return (
                  <button
                    key={pet.value}
                    data-testid={`pet-type-${pet.value}`}
                    onClick={() => togglePetType(pet.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                      selected
                        ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                        : 'border-gray-200 hover:border-gray-400 dark:border-zinc-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {isHebrew ? pet.labelHe : pet.labelEn}
                    </span>
                    {selected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Pet count */}
          <div className="mb-6">
            <Label className="text-sm font-medium mb-3 block">
              {isHebrew ? `מספר חיות מחמד: ${filters.petCount}` : `Number of Pets: ${filters.petCount}`}
            </Label>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                data-testid="button-decrease-pets"
                onClick={() => setFilters(prev => ({ ...prev, petCount: Math.max(1, prev.petCount - 1) }))}
                disabled={filters.petCount <= 1}
              >-</Button>
              <span className="text-2xl font-bold w-12 text-center">{filters.petCount}</span>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-increase-pets"
                onClick={() => setFilters(prev => ({ ...prev, petCount: Math.min(10, prev.petCount + 1) }))}
                disabled={filters.petCount >= 10}
              >+</Button>
            </div>
          </div>

          {/* Row 4: More Filters + Sort + Search button */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* More Filters sheet */}
            <Sheet open={showFilters} onOpenChange={setShowFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" data-testid="button-more-filters" className="relative">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  {isHebrew ? 'פילטרים' : 'Filters'}
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-black dark:bg-white text-white dark:text-black text-xs flex items-center justify-center font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side={isHebrew ? 'left' : 'right'} className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    {isHebrew ? 'פילטרים' : 'Filters'}
                  </SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-8">

                  {/* Radius — only shown when location is set */}
                  {filters.latitude && (
                    <div>
                      <Label className="text-sm font-medium mb-3 block">
                        {isHebrew
                          ? `רדיוס חיפוש: ${filters.radiusKm} ק"מ`
                          : `Search Radius: ${filters.radiusKm} km`}
                      </Label>
                      <div className="flex gap-2 flex-wrap">
                        {RADIUS_OPTIONS.map(r => (
                          <button
                            key={r}
                            onClick={() => setFilters(prev => ({ ...prev, radiusKm: r }))}
                            className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                              filters.radiusKm === r
                                ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                                : 'border-gray-200 hover:border-gray-400 dark:border-zinc-700'
                            }`}
                          >
                            {r} {isHebrew ? 'ק"מ' : 'km'}
                          </button>
                        ))}
                      </div>
                      <Slider
                        value={[filters.radiusKm]}
                        onValueChange={([v]) => setFilters(prev => ({ ...prev, radiusKm: v }))}
                        min={1}
                        max={50}
                        step={1}
                        className="w-full mt-4"
                        data-testid="slider-radius"
                      />
                    </div>
                  )}

                  {/* Min rating */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      {isHebrew
                        ? `דירוג מינימלי: ${filters.minRating === 0 ? 'הכל' : `${filters.minRating}★ ומעלה`}`
                        : `Minimum Rating: ${filters.minRating === 0 ? 'Any' : `${filters.minRating}★ and up`}`}
                    </Label>
                    <div className="flex gap-2">
                      {[0, 3, 3.5, 4, 4.5, 5].map(r => (
                        <button
                          key={r}
                          onClick={() => setFilters(prev => ({ ...prev, minRating: r }))}
                          className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                            filters.minRating === r
                              ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                              : 'border-gray-200 hover:border-gray-400 dark:border-zinc-700'
                          }`}
                        >
                          {r === 0 ? (isHebrew ? 'הכל' : 'Any') : `${r}★`}
                        </button>
                      ))}
                    </div>
                    <Slider
                      value={[filters.minRating]}
                      onValueChange={([v]) => setFilters(prev => ({ ...prev, minRating: v }))}
                      max={5}
                      step={0.5}
                      className="w-full mt-4"
                      data-testid="slider-rating"
                    />
                  </div>

                  {/* Max price */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      {isHebrew ? 'מחיר מקסימלי (₪)' : 'Maximum Price (₪)'}
                    </Label>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {[null, 100, 200, 300, 500].map(p => (
                        <button
                          key={String(p)}
                          onClick={() => setFilters(prev => ({ ...prev, maxPrice: p }))}
                          className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                            filters.maxPrice === p
                              ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                              : 'border-gray-200 hover:border-gray-400 dark:border-zinc-700'
                          }`}
                        >
                          {p === null ? (isHebrew ? 'הכל' : 'Any') : `₪${p}`}
                        </button>
                      ))}
                    </div>
                    <Input
                      data-testid="input-max-price"
                      type="number"
                      placeholder={isHebrew ? 'סכום מקסימלי' : 'Custom max price'}
                      value={filters.maxPrice || ''}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        maxPrice: e.target.value ? parseInt(e.target.value) : null,
                      }))}
                    />
                  </div>

                  {/* Verified only */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">
                        {isHebrew ? 'רק ספקים מאומתים' : 'Verified Providers Only'}
                      </Label>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isHebrew ? 'כולל בדיקת רקע' : 'Background check included'}
                      </p>
                    </div>
                    <button
                      data-testid="toggle-verified-only"
                      onClick={() => setFilters(prev => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        filters.verifiedOnly ? 'bg-black dark:bg-white' : 'bg-white'
                      }`}
                    >
                      <span className={`block w-5 h-5 rounded-full bg-white dark:bg-black shadow transform transition-transform ${
                        filters.verifiedOnly ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Clear + Apply */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={clearFilters}
                      data-testid="button-clear-filters"
                    >
                      <X className="h-4 w-4 mr-2" />
                      {isHebrew ? 'נקה הכל' : 'Clear All'}
                    </Button>
                    <Button
                      className="flex-1 bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-white"
                      onClick={() => { setShowFilters(false); handleSearch(); }}
                    >
                      <Search className="h-4 w-4 mr-2" />
                      {isHebrew ? 'חפש' : 'Search'}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Sort selector */}
            <Select
              value={filters.sortBy}
              onValueChange={(v) => setFilters(prev => ({ ...prev, sortBy: v as SearchFilters['sortBy'] }))}
            >
              <SelectTrigger className="w-auto gap-2" data-testid="select-sort">
                <ArrowUpDown className="h-4 w-4 text-gray-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filters.latitude && (
                  <SelectItem value="distance">
                    {isHebrew ? 'קרוב אליי' : 'Nearest first'}
                  </SelectItem>
                )}
                <SelectItem value="rating">
                  {isHebrew ? 'דירוג גבוה ביותר' : 'Top rated'}
                </SelectItem>
                <SelectItem value="price">
                  {isHebrew ? 'מחיר: נמוך לגבוה' : 'Price: low to high'}
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Search button */}
            <Button
              onClick={handleSearch}
              disabled={searchMutation.isPending}
              className="bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-white px-8"
              data-testid="button-search"
            >
              <Search className="h-4 w-4 mr-2" />
              {searchMutation.isPending
                ? (isHebrew ? 'מחפש...' : 'Searching...')
                : (isHebrew ? 'חפש' : 'Search')}
            </Button>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              {filters.minRating > 0 && (
                <Badge variant="outline" className="flex items-center gap-1 pr-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {filters.minRating}★+
                  <button onClick={() => setFilters(p => ({ ...p, minRating: 0 }))} className="ml-1 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.verifiedOnly && (
                <Badge variant="outline" className="flex items-center gap-1 pr-1">
                  <Shield className="h-3 w-3" />
                  {isHebrew ? 'מאומת' : 'Verified'}
                  <button onClick={() => setFilters(p => ({ ...p, verifiedOnly: false }))} className="ml-1 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.maxPrice && (
                <Badge variant="outline" className="flex items-center gap-1 pr-1">
                  {isHebrew ? `עד ₪${filters.maxPrice}` : `Up to ₪${filters.maxPrice}`}
                  <button onClick={() => setFilters(p => ({ ...p, maxPrice: null }))} className="ml-1 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filters.latitude && filters.radiusKm !== DEFAULT_FILTERS.radiusKm && (
                <Badge variant="outline" className="flex items-center gap-1 pr-1">
                  <Navigation className="h-3 w-3" />
                  {isHebrew ? `${filters.radiusKm} ק"מ` : `${filters.radiusKm} km`}
                  <button onClick={() => setFilters(p => ({ ...p, radiusKm: DEFAULT_FILTERS.radiusKm }))} className="ml-1 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading skeletons */}
      {searchMutation.isPending && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {hasSearched && !searchMutation.isPending && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {isHebrew
                ? `${searchResults.length} ספקים נמצאו`
                : `${searchResults.length} provider${searchResults.length !== 1 ? 's' : ''} found`}
              {filters.latitude && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  {isHebrew ? `ברדיוס ${filters.radiusKm} ק"מ` : `within ${filters.radiusKm} km`}
                </span>
              )}
            </h2>
            <span className="text-sm text-gray-500">
              {isHebrew ? `ממוין לפי: ${sortLabel(filters.sortBy)}` : `Sorted by: ${sortLabel(filters.sortBy)}`}
            </span>
          </div>

          {searchResults.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {isHebrew
                  ? 'לא נמצאו ספקים התואמים לחיפוש שלך.'
                  : 'No providers found matching your search.'}
              </p>
              {filters.latitude && filters.radiusKm < 50 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters(p => ({ ...p, radiusKm: Math.min(50, p.radiusKm + 10) }));
                    handleSearch();
                  }}
                >
                  {isHebrew ? 'הרחב רדיוס חיפוש' : 'Expand search radius'}
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map(provider => (
                <ProviderCard key={provider.id} provider={provider} isHebrew={isHebrew} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ provider, isHebrew }: { provider: Provider; isHebrew: boolean }) {
  const [, setLocation] = useLocation();

  return (
    <Card
      className="overflow-hidden hover:shadow-xl transition-shadow cursor-pointer group"
      onClick={() => setLocation(`/provider/${provider.id}`)}
      data-testid={`provider-card-${provider.id}`}
    >
      <div className="relative">
        <div className="h-48 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
          {provider.profilePictureUrl ? (
            <img
              src={provider.profilePictureUrl}
              alt={`${provider.firstName} ${provider.lastName}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-black dark:bg-white flex items-center justify-center">
              <span className="text-3xl font-bold text-white dark:text-black">
                {provider.firstName?.[0]}{provider.lastName?.[0]}
              </span>
            </div>
          )}
        </div>

        {provider.isVerified && (
          <Badge className="absolute top-3 left-3 bg-black text-white dark:bg-white dark:text-black">
            <Shield className="h-3 w-3 mr-1" />
            {isHebrew ? 'מאומת' : 'Verified'}
          </Badge>
        )}
        {provider.hasPoliceCheck && (
          <Badge variant="outline" className="absolute top-3 right-3 bg-white/90 dark:bg-black/90">
            {isHebrew ? 'בדיקת משטרה' : 'Police Check'}
          </Badge>
        )}
        {provider.distanceKm !== null && provider.distanceKm !== undefined && (
          <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-black/90 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <Navigation className="h-3 w-3 text-emerald-600" />
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              {provider.distanceKm < 1
                ? `${Math.round(provider.distanceKm * 1000)} m`
                : `${provider.distanceKm.toFixed(1)} km`}
            </span>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-bold text-lg">
              {provider.firstName} {provider.lastName?.[0]}.
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {provider.city}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-bold">{provider.rating?.toFixed(1) || '5.0'}</span>
            </div>
            <p className="text-xs text-gray-500">
              ({provider.totalReviews || 0} {isHebrew ? 'ביקורות' : 'reviews'})
            </p>
          </div>
        </div>

        {provider.bio && (
          <p className="text-sm text-gray-600 dark:text-black line-clamp-2 mb-3">
            {provider.bio}
          </p>
        )}

        <div className="flex flex-wrap gap-1 mb-3">
          {provider.acceptedPetTypes?.slice(0, 3).map(type => {
            const Icon = petTypeIcons[type];
            return (
              <Badge key={type} variant="outline" className="text-xs">
                {Icon && <Icon className="h-3 w-3 mr-1" />}
                {type}
              </Badge>
            );
          })}
          {provider.maxPets > 1 && (
            <Badge variant="outline" className="text-xs">
              {isHebrew ? `עד ${provider.maxPets} חיות` : `Up to ${provider.maxPets} pets`}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            {provider.pricePerNight ? (
              <p className="font-bold text-lg">
                ₪{provider.pricePerNight}
                <span className="text-sm font-normal text-gray-500">/{isHebrew ? 'לילה' : 'night'}</span>
              </p>
            ) : provider.pricePerHour ? (
              <p className="font-bold text-lg">
                ₪{provider.pricePerHour}
                <span className="text-sm font-normal text-gray-500">/{isHebrew ? 'שעה' : 'hour'}</span>
              </p>
            ) : (
              <p className="text-sm text-gray-500">{isHebrew ? 'צור קשר למחיר' : 'Contact for price'}</p>
            )}
          </div>
          <Button size="sm" className="group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors">
            {isHebrew ? 'הזמן' : 'Book'}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
