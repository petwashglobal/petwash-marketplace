import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Star, MapPin, Shield, Heart, Sparkles, ArrowRight, CheckCircle, Camera, Users, Wallet, Briefcase, SlidersHorizontal, X, ArrowUpDown, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocation } from "wouter";
import { useSEO, pageSEO } from "@/lib/seo";
import { useLanguage } from "@/lib/languageStore";
import { ProviderSearch, ProviderCard, SearchEmptyState, type SearchParams } from "@/components/marketplace/ProviderSearch";
import ProviderRegistrationBanner from "@/components/ProviderRegistrationBanner";
import LocationPermissionBanner from "@/components/LocationPermissionBanner";
import { CompactWeatherWidget } from "@/components/weather/CompactWeatherWidget";
import { format } from "date-fns";
import { getApiUrl } from "@/lib/apiConfig";

interface Provider {
  id: string;
  platform: string;
  serviceType: string;
  displayName: string;
  bio: string;
  profilePhotoUrl: string;
  location: string;
  suburb: string | null;
  postalCode: string | null;
  distanceKm: number | null;
  distanceMeters?: number | null;
  proximityLabel?: string | null;
  rating: number | null;
  reviewCount: number;
  pricing: {
    perNight: string | null;
    perHour: string | null;
    additionalPet: string | null;
    currency: string;
  };
  maxPets: number;
  acceptedPetTypes: string[];
  addons: string[];
  instantBooking: boolean;
  cancellationPolicy: string;
}

interface SearchResponse {
  success: boolean;
  providers: Provider[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

const DEMO_SITTERS: Provider[] = [
  {
    id: 'demo-sitter-1',
    platform: 'sitter_suite',
    serviceType: 'pet_sitting',
    displayName: 'מאיה לוי',
    bio: 'שמרטפית מקצועית עם 5+ שנות ניסיון. אוהבת כלבים וחתולים. בית עם חצר גדולה ואווירה משפחתית.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=faces',
    location: 'תל אביב',
    suburb: null,
    postalCode: null,
    distanceKm: 2.3,
    rating: 4.9,
    reviewCount: 156,
    pricing: { perNight: '150.00', perHour: null, additionalPet: '50.00', currency: 'ILS' },
    maxPets: 3,
    acceptedPetTypes: ['dog', 'cat'],
    addons: ['medication_admin', 'daily_photos', 'grooming'],
    instantBooking: true,
    cancellationPolicy: 'flexible',
  },
  {
    id: 'demo-sitter-2',
    platform: 'sitter_suite',
    serviceType: 'pet_sitting',
    displayName: 'דוד כהן',
    bio: 'מטפל מנוסה בחיות מחמד. מתמחה בכלבים גדולים ובינוניים. עדכוני תמונות יומיים ושירות אישי.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces',
    location: 'ירושלים',
    suburb: null,
    postalCode: null,
    distanceKm: 5.1,
    rating: 4.8,
    reviewCount: 89,
    pricing: { perNight: '130.00', perHour: null, additionalPet: '40.00', currency: 'ILS' },
    maxPets: 4,
    acceptedPetTypes: ['dog', 'cat'],
    addons: ['daily_photos', 'grooming'],
    instantBooking: false,
    cancellationPolicy: 'moderate',
  },
  {
    id: 'demo-sitter-3',
    platform: 'sitter_suite',
    serviceType: 'pet_sitting',
    displayName: 'נועה שפירא',
    bio: 'וטרינרית בהכשרה. ניסיון עם חיות עם צרכים מיוחדים. אוהבת כל חיה!',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=faces',
    location: 'חיפה',
    suburb: null,
    postalCode: null,
    distanceKm: 3.7,
    rating: 5.0,
    reviewCount: 45,
    pricing: { perNight: '180.00', perHour: null, additionalPet: '60.00', currency: 'ILS' },
    maxPets: 2,
    acceptedPetTypes: ['dog', 'cat'],
    addons: ['medication_admin', 'daily_photos', 'grooming', 'vet_visits'],
    instantBooking: true,
    cancellationPolicy: 'flexible',
  },
  {
    id: 'demo-sitter-4',
    platform: 'sitter_suite',
    serviceType: 'pet_sitting',
    displayName: 'שירה מזרחי',
    bio: 'מאמנת כלבים מוסמכת. מציעה שמרטפות עם אילוף בסיסי. בית חם ואוהב.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=faces',
    location: 'רמת גן',
    suburb: null,
    postalCode: null,
    distanceKm: 1.8,
    rating: 4.7,
    reviewCount: 112,
    pricing: { perNight: '160.00', perHour: null, additionalPet: '45.00', currency: 'ILS' },
    maxPets: 3,
    acceptedPetTypes: ['dog'],
    addons: ['daily_photos', 'training_tips'],
    instantBooking: true,
    cancellationPolicy: 'flexible',
  },
  {
    id: 'demo-sitter-5',
    platform: 'sitter_suite',
    serviceType: 'pet_sitting',
    displayName: 'עמית גולן',
    bio: 'שמרטף מקצועי עם דירה מרווחת. גמישות מלאה בזמנים. ניסיון עם כלבים מכל הגדלים.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces',
    location: 'הרצליה',
    suburb: null,
    postalCode: null,
    distanceKm: 4.2,
    rating: 4.85,
    reviewCount: 78,
    pricing: { perNight: '140.00', perHour: null, additionalPet: '50.00', currency: 'ILS' },
    maxPets: 2,
    acceptedPetTypes: ['dog', 'cat'],
    addons: ['medication_admin', 'daily_photos'],
    instantBooking: false,
    cancellationPolicy: 'moderate',
  },
  {
    id: 'demo-sitter-6',
    platform: 'sitter_suite',
    serviceType: 'pet_sitting',
    displayName: 'תמר רוזנברג',
    bio: 'אוהבת חיות מילדות. בית עם גינה גדולה. מקבלת כלבים, חתולים וחיות קטנות.',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces',
    location: 'כפר סבא',
    suburb: null,
    postalCode: null,
    distanceKm: 6.5,
    rating: 4.6,
    reviewCount: 98,
    pricing: { perNight: '120.00', perHour: null, additionalPet: '35.00', currency: 'ILS' },
    maxPets: 4,
    acceptedPetTypes: ['dog', 'cat'],
    addons: ['daily_photos', 'grooming'],
    instantBooking: true,
    cancellationPolicy: 'flexible',
  },
];

export default function BrowseSitters() {
  useSEO(pageSEO.sitterSuite);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  
  // Parse URL parameters on initial load
  const getInitialSearchParams = (): SearchParams | null => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    const location = urlParams.get('location');
    const pet = urlParams.get('pet');
    const start = urlParams.get('start');
    const end = urlParams.get('end');
    const latParam = urlParams.get('lat');
    const lngParam = urlParams.get('lng');
    
    if (!location && !pet && !start && !end) return null;
    
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (start) {
      const parsedStart = new Date(start);
      if (!isNaN(parsedStart.getTime())) startDate = parsedStart;
    }
    if (end) {
      const parsedEnd = new Date(end);
      if (!isNaN(parsedEnd.getTime())) endDate = parsedEnd;
    }
    
    if (startDate && endDate && endDate < startDate) {
      [startDate, endDate] = [endDate, startDate];
    }
    
    return {
      location: location || '',
      lat: latParam ? parseFloat(latParam) : null,
      lng: lngParam ? parseFloat(lngParam) : null,
      petType: pet || undefined,
      startDate,
      endDate,
      service: undefined
    } as SearchParams;
  };
  
  const [searchParams, setSearchParams] = useState<SearchParams | null>(getInitialSearchParams);
  const [sortBy, setSortBy] = useState<string>('bestMatch');
  const [maxPrice, setMaxPrice] = useState<number>(500);
  const [minRating, setMinRating] = useState<number>(0);
  const [activeFilters, setActiveFilters] = useState(0);
  const [isAutoLocating, setIsAutoLocating] = useState(false);
  const autoLocateDoneRef = useRef(false);

  useEffect(() => {
    if (autoLocateDoneRef.current || searchParams !== null || !navigator.geolocation) return;
    autoLocateDoneRef.current = true;
    setIsAutoLocating(true);

    const langCode = document.documentElement.lang;
    const mapsLang = langCode === 'he' ? 'iw' : langCode === 'ar' ? 'ar' : langCode === 'ru' ? 'ru' : 'en';

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          try {
            const params = new URLSearchParams({ lat: latitude.toString(), lng: longitude.toString(), language: mapsLang });
            const res = await fetch(`/api/google/reverse-geocode?${params}`, { credentials: 'include' });
            if (res.ok) {
              const data = await res.json();
              if (data.name) {
                setSearchParams({ location: data.name, lat: latitude, lng: longitude, petType: undefined, startDate: undefined, endDate: undefined, service: undefined } as SearchParams);
              }
            }
          } catch {}
        } finally {
          setIsAutoLocating(false);
        }
      },
      () => { setIsAutoLocating(false); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  const updateFilterCount = (price: number, rating: number, sort: string) => {
    let count = 0;
    if (price < 500) count++;
    if (rating > 0) count++;
    if (sort !== 'bestMatch') count++;
    setActiveFilters(count);
  };

  // Build query string for API
  const buildQueryString = () => {
    const params = new URLSearchParams();
    params.set('platform', 'sitter_suite');
    if (searchParams?.location) params.set('city', searchParams.location);
    if (searchParams?.lat !== null && searchParams?.lat !== undefined) params.set('lat', String(searchParams.lat));
    if (searchParams?.lng !== null && searchParams?.lng !== undefined) params.set('lng', String(searchParams.lng));
    if (searchParams?.street) params.set('street', searchParams.street);
    if (searchParams?.streetNumber) params.set('streetNumber', searchParams.streetNumber);
    params.set('sortBy', sortBy);
    if (maxPrice < 500) params.set('maxPrice', String(maxPrice));
    if (minRating > 0) params.set('minRating', String(minRating));
    if (searchParams?.startDate) params.set('startDate', format(searchParams.startDate, 'yyyy-MM-dd'));
    if (searchParams?.endDate) params.set('endDate', format(searchParams.endDate, 'yyyy-MM-dd'));
    if (searchParams?.petType) params.set('petTypes', searchParams.petType);
    return params.toString();
  };

  const { data, isLoading, refetch } = useQuery<SearchResponse>({
    queryKey: ["/api/marketplace-bookings/search/providers", searchParams?.location, searchParams?.lat, searchParams?.lng, searchParams?.service, sortBy, maxPrice, minRating],
    queryFn: async () => {
      try {
        const queryString = buildQueryString();
        const response = await fetch(getApiUrl(`/api/marketplace-bookings/search/providers?${queryString}`));
        if (!response.ok) return { success: false, providers: [], pagination: { page: 1, limit: 20, total: 0, hasMore: false } };
        return response.json();
      } catch {
        return { success: false, providers: [], pagination: { page: 1, limit: 20, total: 0, hasMore: false } };
      }
    },
    enabled: true,
  });

  const apiProviders = data?.providers || [];
  const hasSearched = !!searchParams?.location || (searchParams?.lat != null && searchParams?.lng != null);
  const providers = hasSearched ? apiProviders : (apiProviders.length > 0 ? apiProviders : DEMO_SITTERS);

  const handleSearch = (params: SearchParams) => {
    setSearchParams(params);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        <div className="relative bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500 overflow-hidden">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute top-10 left-10 w-72 h-72 bg-fuchsia-300 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-300 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-rose-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 sm:pt-16 sm:pb-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full shadow-sm mb-4" data-testid="badge-premium">
                <Sparkles className="h-4 w-4 text-amber-200" />
                <span className="text-sm font-medium text-white">
                  {isHebrew ? 'שוק שמרטפים מוביל' : 'Premium Pet Sitting Marketplace'}
                </span>
              </div>
              
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-white mb-4 drop-shadow-lg" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif", direction: 'ltr', unicodeBidi: 'isolate' }} data-testid="heading-main">
                ⁦The Sitter Suite™⁩
              </h1>
              
              <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto font-light drop-shadow" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                {isHebrew 
                  ? 'מצאו את השמרטף המושלם לחיית המחמד שלכם'
                  : 'Find the perfect sitter for your beloved pet'
                }
              </p>
            </div>

            {isAutoLocating && (
              <div className="max-w-5xl mx-auto mb-3 px-4 relative z-20">
                <div className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 w-fit mx-auto">
                  <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span className="text-white/90 text-sm font-medium">
                    {isHebrew ? 'מאתר שמרטפים קרובים אליך...' : 'Finding sitters near you...'}
                  </span>
                </div>
              </div>
            )}
            <div className="max-w-5xl mx-auto -mb-16 relative z-10">
              <ProviderSearch 
                onSearch={handleSearch} 
                platform="sitter-suite"
                theme="pink"
                initialLocation={searchParams?.location}
                initialLat={searchParams?.lat}
                initialLng={searchParams?.lng}
                initialPetType={searchParams?.petType}
                initialStartDate={searchParams?.startDate}
                initialEndDate={searchParams?.endDate}
              />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="mb-4">
            <LocationPermissionBanner role="customer" />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900">
                {isHebrew ? 'שמרטפים זמינים' : 'Available Sitters'}
              </h2>
              <p className="text-gray-500 mt-1">
                {providers.length > 0 
                  ? (isHebrew ? `${providers.length} שמרטפים נמצאו` : `${providers.length} sitters found`)
                  : (isHebrew ? 'חפשו לפי מיקום ותאריכים' : 'Search by location and dates')
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <CompactWeatherWidget variant="compact" className="bg-white" />
              </div>
              <Button variant="outline" className="gap-2 rounded-full" data-testid="button-map-view">
                <MapPin className="h-4 w-4" />
                {isHebrew ? 'תצוגת מפה' : 'Map View'}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full gap-1.5 h-9 text-sm">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {sortBy === 'bestMatch' ? (isHebrew ? 'התאמה מיטבית' : 'Best Match') :
                   sortBy === 'distance' ? (isHebrew ? 'מרחק' : 'Distance') :
                   sortBy === 'price' ? (isHebrew ? 'מחיר' : 'Price') :
                   sortBy === 'rating' ? (isHebrew ? 'דירוג' : 'Rating') :
                   (isHebrew ? 'ביקורות' : 'Reviews')}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {[
                  { id: 'bestMatch', label: isHebrew ? 'התאמה מיטבית' : 'Best Match', labelDesc: isHebrew ? 'מרחק + דירוג' : 'Distance + Rating' },
                  { id: 'distance', label: isHebrew ? 'הקרוב ביותר' : 'Nearest First', labelDesc: '' },
                  { id: 'price', label: isHebrew ? 'מחיר נמוך' : 'Lowest Price', labelDesc: '' },
                  { id: 'rating', label: isHebrew ? 'דירוג גבוה' : 'Highest Rated', labelDesc: '' },
                  { id: 'reviews', label: isHebrew ? 'הכי נבדק' : 'Most Reviewed', labelDesc: '' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      setSortBy(option.id);
                      updateFilterCount(maxPrice, minRating, option.id);
                    }}
                    className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors ${
                      sortBy === option.id
                        ? 'bg-fuchsia-50 text-fuchsia-700 font-medium'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {option.label}
                    {option.labelDesc && (
                      <span className="block text-xs text-gray-400">{option.labelDesc}</span>
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={`rounded-full gap-1.5 h-9 text-sm ${maxPrice < 500 ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700' : ''}`}>
                  ₪ {isHebrew ? 'מחיר' : 'Price'}
                  {maxPrice < 500 && <span className="font-semibold">{isHebrew ? `עד ₪${maxPrice}` : `≤₪${maxPrice}`}</span>}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {isHebrew ? 'מחיר מקסימלי ללילה' : 'Max price per night'}
                    </span>
                    <span className="text-lg font-bold text-fuchsia-600">₪{maxPrice}</span>
                  </div>
                  <Slider
                    value={[maxPrice]}
                    onValueChange={(val) => {
                      setMaxPrice(val[0]);
                      updateFilterCount(val[0], minRating, sortBy);
                    }}
                    min={30}
                    max={500}
                    step={10}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>₪30</span>
                    <span>₪500+</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={`rounded-full gap-1.5 h-9 text-sm ${minRating > 0 ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700' : ''}`}>
                  <Star className="h-3.5 w-3.5" />
                  {minRating > 0 
                    ? `${minRating}+ ${isHebrew ? 'כוכבים' : 'stars'}`
                    : (isHebrew ? 'דירוג' : 'Rating')
                  }
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                {[
                  { value: 0, label: isHebrew ? 'הכל' : 'Any Rating' },
                  { value: 4.5, label: '4.5+ ⭐' },
                  { value: 4.0, label: '4.0+ ⭐' },
                  { value: 3.5, label: '3.5+ ⭐' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setMinRating(option.value);
                      updateFilterCount(maxPrice, option.value, sortBy);
                    }}
                    className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors ${
                      minRating === option.value
                        ? 'bg-fuchsia-50 text-fuchsia-700 font-medium'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {activeFilters > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-full gap-1 h-9 text-xs text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setSortBy('bestMatch');
                  setMaxPrice(500);
                  setMinRating(0);
                  setActiveFilters(0);
                }}
              >
                <X className="h-3 w-3" />
                {isHebrew ? 'נקה פילטרים' : 'Clear filters'}
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-fuchsia-200 border-t-fuchsia-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">
                {isHebrew ? 'מחפשים שמרטפים מדהימים...' : 'Finding amazing sitters...'}
              </p>
            </div>
          ) : providers.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-fuchsia-100 to-pink-100 flex items-center justify-center">
                  <Heart className="w-12 h-12 text-fuchsia-400" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  {hasSearched
                    ? (isHebrew ? 'לא נמצאו שמרטפים זמינים באזור זה' : 'No available sitters found in this area')
                    : (isHebrew ? 'בקרוב - שמרטפים מקצועיים' : 'Professional sitters coming soon')
                  }
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {hasSearched
                    ? (isHebrew
                        ? 'נסו לשנות את האזור, התאריכים או הפילטרים. ניתן גם להרחיב את רדיוס החיפוש.'
                        : 'Try adjusting the area, dates, or filters. You can also expand the search radius.')
                    : (isHebrew 
                        ? 'אנחנו מגייסים שמרטפים מאומתים לפלטפורמה. הזינו את המיקום שלכם כדי לקבל עדכון כשנשיק באזורכם.'
                        : 'We\'re recruiting verified sitters to our platform. Enter your location to get notified when we launch in your area.')
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    className="bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 text-white rounded-full px-8 shadow-lg shadow-fuchsia-500/25"
                    onClick={() => setLocation('/become-provider')}
                    data-testid="button-become-sitter"
                  >
                    <Users className="h-5 w-5 me-2" />
                    {isHebrew ? 'הפוך לשמרטף' : 'Become a Sitter'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="rounded-full px-8"
                    data-testid="button-notify-me"
                  >
                    <Sparkles className="w-5 h-5 me-2" />
                    {isHebrew ? 'עדכנו אותי' : 'Notify Me'}
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-gray-100">
                <div className="text-center p-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {isHebrew ? 'בדיקות רקע מלאות' : 'Full Background Checks'}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {isHebrew 
                      ? 'כל השמרטפים עוברים בדיקות רקע מקיפות'
                      : 'All sitters undergo comprehensive background checks'
                    }
                  </p>
                </div>
                <div className="text-center p-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center">
                    <Camera className="h-7 w-7 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {isHebrew ? 'עדכוני תמונות יומיים' : 'Daily Photo Updates'}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {isHebrew 
                      ? 'קבלו תמונות של חיית המחמד שלכם כל יום'
                      : 'Receive photos of your pet every day'
                    }
                  </p>
                </div>
                <div className="text-center p-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
                    <Shield className="h-7 w-7 text-fuchsia-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {isHebrew ? 'ביטוח מלא כלול' : 'Full Insurance Included'}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {isHebrew 
                      ? 'כיסוי ביטוחי מלא לכל הזמנה'
                      : 'Complete insurance coverage for every booking'
                    }
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {providers.map((provider, index) => {
                const pricePerNight = provider.pricing.perNight ? parseFloat(provider.pricing.perNight) : 0;
                
                const proximityBadge = (() => {
                  if (provider.proximityLabel === 'same_building') return isHebrew ? 'אותו מבנה' : 'Same building';
                  if (provider.proximityLabel === 'same_street') return isHebrew ? 'אותה רחוב' : 'Same street';
                  if (provider.proximityLabel === 'nearby') return isHebrew ? 'קרוב' : 'Nearby';
                  if (provider.proximityLabel?.endsWith('m')) {
                    const meters = parseInt(provider.proximityLabel);
                    return `${meters} ${isHebrew ? 'מ\'' : 'm'}`;
                  }
                  if (provider.distanceMeters !== null && provider.distanceMeters !== undefined && provider.distanceMeters < 1000) {
                    return `${provider.distanceMeters} ${isHebrew ? 'מ\'' : 'm'}`;
                  }
                  if (provider.distanceKm !== null) return `${provider.distanceKm} ${isHebrew ? 'ק״מ' : 'km'}`;
                  return undefined;
                })();
                
                return (
                  <ProviderCard
                    key={`${provider.id}-${provider.serviceType}-${index}`}
                    id={provider.id}
                    name={provider.displayName || 'Provider'}
                    photo={provider.profilePhotoUrl}
                    location={proximityBadge
                      ? `${provider.suburb || provider.location || ''} · ${proximityBadge}`
                      : provider.location || ''
                    }
                    rating={provider.rating || 0}
                    reviewCount={provider.reviewCount}
                    price={pricePerNight}
                    priceUnit="night"
                    priceUnitHe="לילה"
                    distance={proximityBadge}
                    verified={true}
                    theme="pink"
                    bio={provider.bio || undefined}
                    instantBook={provider.instantBooking ?? true}
                    available={true}
                    specialties={provider.acceptedPetTypes?.slice(0, 2).map(pt => pt === 'dog' ? (isHebrew ? 'כלבים' : 'Dogs') : pt === 'cat' ? (isHebrew ? 'חתולים' : 'Cats') : pt) || []}
                    onClick={() => setLocation(`/sitter-suite/sitters/${provider.id}`)}
                  />
                );
              })}
            </div>
          )}

          {providers.length > 0 && (
            <div className="text-center mt-12">
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-full px-8 border-gray-300 hover:bg-gray-50"
                data-testid="button-load-more"
              >
                {isHebrew ? 'טען עוד שמרטפים' : 'Load More Sitters'}
              </Button>
            </div>
          )}
        </div>

        {/* Provider Recruitment Section */}
        <div className="bg-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-50 border border-fuchsia-200 rounded-full mb-4">
                <Wallet className="h-4 w-4 text-fuchsia-600" />
                <span className="text-sm font-medium text-fuchsia-700">
                  {isHebrew ? 'הזדמנות הכנסה נוספת' : 'Extra Income Opportunity'}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                {isHebrew ? 'הפכו לשמרטפים ב-⁦Pet Wash™⁩' : 'Become a ⁦Pet Wash™⁩ Sitter'}
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {isHebrew 
                  ? 'הרוויחו עד ₪200+ לשעה בזמנים שנוחים לכם. הצטרפו לקהילת השמרטפים המובילה בישראל.'
                  : 'Earn up to ₪200+/hour on your own schedule. Join Israel\'s leading pet sitter community.'
                }
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
                  <Wallet className="h-7 w-7 text-fuchsia-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'עד ₪200+/שעה' : 'Up to ₪200+/hour'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew ? 'קבעו את התעריפים שלכם' : 'Set your own rates'}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
                  <Briefcase className="h-7 w-7 text-fuchsia-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'גמישות מלאה' : 'Full Flexibility'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew ? 'עבדו מתי שנוח לכם' : 'Work when it suits you'}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
                  <Heart className="h-7 w-7 text-fuchsia-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'ביטוח מלא' : 'Full Insurance'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew ? 'כיסוי מלא בכל הזמנה' : 'Coverage for every booking'}
                </p>
              </div>
            </div>

            <ProviderRegistrationBanner variant="compact" platform="sitter" className="max-w-2xl mx-auto" />
          </div>
        </div>

        <div className="bg-white py-16 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-semibold text-gray-900 mb-3">
                {isHebrew ? 'למה לבחור ב-⁦The Sitter Suite™⁩?' : 'Why Choose ⁦The Sitter Suite™⁩?'}
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {isHebrew 
                  ? 'הפלטפורמה המובילה בישראל לשמרטפות חיות מחמד יוקרתית'
                  : 'Israel\'s leading platform for premium pet sitting services'
                }
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-fuchsia-600 mb-2">4.9</div>
                <div className="text-sm text-gray-600">{isHebrew ? 'דירוג ממוצע' : 'Average Rating'}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-fuchsia-600 mb-2">10K+</div>
                <div className="text-sm text-gray-600">{isHebrew ? 'הזמנות הושלמו' : 'Bookings Completed'}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-fuchsia-600 mb-2">100%</div>
                <div className="text-sm text-gray-600">{isHebrew ? 'שמרטפים מאומתים' : 'Verified Sitters'}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-fuchsia-600 mb-2">24/7</div>
                <div className="text-sm text-gray-600">{isHebrew ? 'תמיכה זמינה' : 'Support Available'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
