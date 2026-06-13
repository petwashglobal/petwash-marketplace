import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { onClickBecomeProvider } from "@/lib/becomeProvider";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  MapPin, Star, Dog, Heart, Sparkles, CheckCircle, Smartphone, Route, Shield, Users, Wallet, Briefcase, SlidersHorizontal, X, ArrowUpDown, ChevronDown
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSEO, pageSEO } from "@/lib/seo";
import { useLanguage } from "@/lib/languageStore";
import { ProviderSearch, ProviderCard, type SearchParams } from "@/components/marketplace/ProviderSearch";
import ProviderRegistrationBanner from "@/components/ProviderRegistrationBanner";
import LocationPermissionBanner from "@/components/LocationPermissionBanner";
import { PetWalkWeatherAdvisor, CompactWeatherWidget } from "@/components/weather/CompactWeatherWidget";
import { fetchProviderBrowseResults } from "@/api/providerSearchApi";

interface Walker {
  id: number;
  businessName: string;
  displayName: string;
  serviceArea: string;
  distanceKm?: number | null;
  distanceMeters?: number | null;
  proximityLabel?: string | null;
  bio: string;
  hourlyRate: number;
  rating: number;
  totalReviews: number;
  yearsExperience: number;
  verified: boolean;
  photoUrl: string | null;
}

const DEMO_WALKERS: Walker[] = [
  {
    id: 1,
    businessName: "הליכות אבי",
    displayName: "אבי כהן",
    serviceArea: "תל אביב - מרכז",
    bio: "מטייל מקצועי עם אהבה אמיתית לכלבים. טיולים בפארקים הכי יפים של תל אביב עם עדכוני GPS בזמן אמת.",
    hourlyRate: 45,
    rating: 4.9,
    totalReviews: 127,
    yearsExperience: 5,
    verified: true,
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces",
  },
  {
    id: 2,
    businessName: "Dog Walks Pro",
    displayName: "דנה לוי",
    serviceArea: "רמת גן - גבעתיים",
    bio: "מאמנת כלבים מוסמכת. טיולים פרטיים או קבוצתיים קטנים. התמחות בכלבים אנרגטיים.",
    hourlyRate: 55,
    rating: 5.0,
    totalReviews: 89,
    yearsExperience: 7,
    verified: true,
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=faces",
  },
  {
    id: 3,
    businessName: "הטייל שלי",
    displayName: "יוסי מזרחי",
    serviceArea: "הרצליה - רעננה",
    bio: "טיולים יומיים עם קבוצות קטנות. תמונות ועדכונים לאורך כל הטיול. זמין גם בסופי שבוע.",
    hourlyRate: 40,
    rating: 4.7,
    totalReviews: 156,
    yearsExperience: 4,
    verified: true,
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces",
  },
  {
    id: 4,
    businessName: "Happy Paws Walks",
    displayName: "מיכל אברהם",
    serviceArea: "ירושלים",
    bio: "טיולים בטבע הירושלמי. ניסיון עם כל גזעי הכלבים. שירות אישי ומסור.",
    hourlyRate: 50,
    rating: 4.8,
    totalReviews: 72,
    yearsExperience: 3,
    verified: false,
    photoUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=faces",
  },
  {
    id: 5,
    businessName: "טיולי פרימיום",
    displayName: "נועה גולן",
    serviceArea: "חיפה והקריות",
    bio: "טיולים פרטיים בלבד. התמחות בכלבים גדולים. מצלמת GoPro בכל טיול!",
    hourlyRate: 65,
    rating: 5.0,
    totalReviews: 45,
    yearsExperience: 6,
    verified: true,
    photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=faces",
  },
  {
    id: 6,
    businessName: "הליכות השרון",
    displayName: "אלון שפירא",
    serviceArea: "כפר סבא - הוד השרון",
    bio: "מטייל מנוסה עם רכב לאיסוף הכלב. טיולים בפארקים ובחופים. גמישות מלאה בזמנים.",
    hourlyRate: 48,
    rating: 4.6,
    totalReviews: 98,
    yearsExperience: 4,
    verified: true,
    photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=faces",
  },
];

export default function BrowseWalkers() {
  useSEO(pageSEO.walkMyPet);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  
  const getInitialSearchParams = (): SearchParams | null => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    const location = urlParams.get('location');
    const pet = urlParams.get('pet');
    const start = urlParams.get('start');
    const end = urlParams.get('end');
    if (!location && !pet && !start && !end) return null;
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (start) { const d = new Date(start); if (!isNaN(d.getTime())) startDate = d; }
    if (end) { const d = new Date(end); if (!isNaN(d.getTime())) endDate = d; }
    const latParam = urlParams.get('lat');
    const lngParam = urlParams.get('lng');
    return { 
      location: location || '', 
      lat: latParam ? parseFloat(latParam) : null,
      lng: lngParam ? parseFloat(lngParam) : null,
      petType: pet || undefined, startDate, endDate, service: undefined 
    } as SearchParams;
  };
  
  const [searchParams, setSearchParams] = useState<SearchParams | null>(getInitialSearchParams);
  const [sortBy, setSortBy] = useState<string>('bestMatch');
  const [maxPrice, setMaxPrice] = useState<number>(300);
  const [minRating, setMinRating] = useState<number>(0);
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

  const [activeFilters, setActiveFilters] = useState(0);

  const updateFilterCount = (price: number, rating: number, sort: string) => {
    let count = 0;
    if (price < 300) count++;
    if (rating > 0) count++;
    if (sort !== 'bestMatch') count++;
    setActiveFilters(count);
  };

  const { data, isLoading } = useQuery<{ providers: any[]; pagination: any }>({
    queryKey: ['/api/providers/search', 'walk_my_pet', searchParams?.location, searchParams?.lat, searchParams?.lng, sortBy, maxPrice, minRating],
    queryFn: async () => {
      try {
        return await fetchProviderBrowseResults({
          serviceType: 'dog_walking',
          location: searchParams?.location,
          lat: searchParams?.lat,
          lng: searchParams?.lng,
          sortBy,
          maxPrice: maxPrice < 300 ? maxPrice : undefined,
          minRating: minRating > 0 ? minRating : undefined,
          petType: searchParams?.petType,
        });
      } catch {
        return { providers: [], pagination: { page: 1, limit: 20, total: 0, hasMore: false } };
      }
    },
    enabled: true,
  });

  const apiWalkers = data?.providers || [];
  const displayWalkers = apiWalkers.length > 0
    ? apiWalkers.map((p: any) => ({
        id: p.id || Math.random(),
        businessName: p.displayName || '',
        displayName: p.displayName || 'Walker',
        serviceArea: p.location || '',
        distanceKm: p.distanceKm ?? null,
        distanceMeters: p.distanceMeters ?? null,
        proximityLabel: p.proximityLabel ?? null,
        bio: p.bio || '',
        hourlyRate: p.pricing?.perHour ? parseFloat(p.pricing.perHour) : 50,
        rating: p.rating ?? null,
        totalReviews: p.reviewCount || 0,
        yearsExperience: 0,
        verified: p.verified ?? false,
        photoUrl: p.profilePhotoUrl || null,
      }))
    // PR-FAKE (2026-06-13): was DEMO_WALKERS — fabricated walkers with stock
    // faces + fake 4.6-5.0 ratings shown whenever the real list is empty.
    // Honest empty state instead; rating no longer floored to a fake 4.5.
    : [];

  const handleSearch = (params: SearchParams) => {
    setSearchParams(params);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        <div className="relative bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 overflow-hidden">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-300 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-300 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8 sm:pt-16 sm:pb-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full shadow-sm mb-4" data-testid="badge-premium">
                <Sparkles className="h-4 w-4 text-amber-200" />
                <span className="text-sm font-medium text-white">
                  {isHebrew ? 'טיולי כלבים מקצועיים' : 'Professional Dog Walking'}
                </span>
              </div>
              
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-white mb-4 drop-shadow-lg" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }} data-testid="heading-main">
                ⁦Walk My Pet™⁩
              </h1>
              
              <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto font-light drop-shadow" style={{ fontFamily: "'Cormorant Garamond', 'Noto Serif Hebrew', serif" }}>
                {isHebrew 
                  ? 'מצאו מטייל מקצועי עם מעקב GPS בזמן אמת'
                  : 'Find a professional walker with real-time GPS tracking'
                }
              </p>
            </div>

            {isAutoLocating && (
              <div className="max-w-5xl mx-auto mb-3 px-4 relative z-20">
                <div className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 w-fit mx-auto">
                  <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span className="text-white/90 text-sm font-medium">
                    {isHebrew ? 'מאתר מטיילים קרובים אליך...' : 'Finding walkers near you...'}
                  </span>
                </div>
              </div>
            )}
            <div className="max-w-5xl mx-auto -mb-16 relative z-10">
              <ProviderSearch 
                onSearch={handleSearch} 
                platform="walk-my-pet"
                theme="emerald"
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

          <PetWalkWeatherAdvisor className="mb-6" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900">
                {isHebrew ? 'מטיילים זמינים' : 'Available Walkers'}
              </h2>
              <p className="text-gray-500 mt-1">
                {displayWalkers.length > 0 
                  ? (isHebrew ? `${displayWalkers.length} מטיילים נמצאו` : `${displayWalkers.length} walkers found`)
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
                        ? 'bg-emerald-50 text-emerald-700 font-medium'
                        : 'hover:bg-white text-gray-700'
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
                <Button variant="outline" size="sm" className={`rounded-full gap-1.5 h-9 text-sm ${maxPrice < 300 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : ''}`}>
                  ₪ {isHebrew ? 'מחיר' : 'Price'}
                  {maxPrice < 300 && <span className="font-semibold">{isHebrew ? `עד ₪${maxPrice}` : `≤₪${maxPrice}`}</span>}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {isHebrew ? 'מחיר מקסימלי לשעה' : 'Max price per hour'}
                    </span>
                    <span className="text-lg font-bold text-emerald-600">₪{maxPrice}</span>
                  </div>
                  <Slider
                    value={[maxPrice]}
                    onValueChange={(val) => {
                      setMaxPrice(val[0]);
                      updateFilterCount(val[0], minRating, sortBy);
                    }}
                    min={30}
                    max={300}
                    step={10}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>₪30</span>
                    <span>₪300+</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={`rounded-full gap-1.5 h-9 text-sm ${minRating > 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : ''}`}>
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
                        ? 'bg-emerald-50 text-emerald-700 font-medium'
                        : 'hover:bg-white text-gray-700'
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
                  setMaxPrice(300);
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
              <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">
                {isHebrew ? 'מחפשים מטיילים מדהימים...' : 'Finding amazing walkers...'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayWalkers.map((walker) => {
                const proximityBadge = (() => {
                  if (walker.proximityLabel === 'same_building') return isHebrew ? '🏠 אותו מבנה' : '🏠 Same building';
                  if (walker.proximityLabel === 'same_street') return isHebrew ? '📍 אותה רחוב' : '📍 Same street';
                  if (walker.proximityLabel === 'nearby') return isHebrew ? '✅ קרוב מאוד' : '✅ Very close';
                  if (walker.proximityLabel?.endsWith('m')) {
                    const meters = parseInt(walker.proximityLabel);
                    return `${meters} ${isHebrew ? 'מ׳' : 'm'}`;
                  }
                  if (walker.proximityLabel === 'neighbourhood') return isHebrew ? '🌿 שכונה' : '🌿 Neighbourhood';
                  if (walker.proximityLabel === 'same_city') return isHebrew ? '🏙️ אותה עיר' : '🏙️ Same city';
                  if (walker.proximityLabel === 'metro_area') return isHebrew ? '🗺️ אזור מטרו' : '🗺️ Metro area';
                  if (walker.distanceMeters !== null && walker.distanceMeters !== undefined && walker.distanceMeters < 1000) {
                    return `${walker.distanceMeters} ${isHebrew ? 'מ׳' : 'm'}`;
                  }
                  if (walker.distanceKm !== null && walker.distanceKm !== undefined) {
                    return `${walker.distanceKm} ${isHebrew ? 'ק״מ' : 'km'}`;
                  }
                  return undefined;
                })();
                return (
                <ProviderCard
                  key={walker.id}
                  id={walker.id}
                  name={walker.displayName}
                  photo={walker.photoUrl}
                  location={proximityBadge
                    ? `${walker.serviceArea} · ${proximityBadge}`
                    : walker.serviceArea
                  }
                  rating={walker.rating}
                  reviewCount={walker.totalReviews}
                  price={walker.hourlyRate}
                  priceUnit="hour"
                  priceUnitHe="שעה"
                  distance={proximityBadge}
                  verified={walker.verified}
                  theme="emerald"
                  bio={walker.bio || undefined}
                  instantBook={true}
                  available={true}
                  specialties={[
                    isHebrew ? `${walker.yearsExperience} שנות ניסיון` : `${walker.yearsExperience} years exp.`,
                    isHebrew ? 'GPS בזמן אמת' : 'Live GPS'
                  ]}
                  onClick={() => setLocation(`/walk-my-pet/walkers/${walker.id}`)}
                />
                );
              })}
            </div>
          )}

          {displayWalkers.length > 0 && (
            <div className="text-center mt-12">
              <Button 
                variant="outline" 
                size="lg" 
                className="rounded-full px-8 border-gray-300 hover:bg-white"
                data-testid="button-load-more"
              >
                {isHebrew ? 'טען עוד מטיילים' : 'Load More Walkers'}
              </Button>
            </div>
          )}
        </div>

        <div className="bg-white py-16 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-semibold text-gray-900 mb-3">
                {isHebrew ? 'למה לבחור ב-⁦Walk My Pet™⁩?' : 'Why Choose ⁦Walk My Pet™⁩?'}
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {isHebrew 
                  ? 'הפלטפורמה המובילה בישראל לטיולי כלבים מקצועיים'
                  : 'Israel\'s leading platform for professional dog walking'
                }
              </p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-8">
              <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <Smartphone className="h-7 w-7 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'מעקב GPS חי' : 'Live GPS Tracking'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew 
                    ? 'עקבו אחרי הטיול בזמן אמת'
                    : 'Follow the walk in real-time'
                  }
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-7 w-7 text-green-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'מטיילים מאומתים' : 'Verified Walkers'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew 
                    ? 'כל המטיילים עוברים בדיקות רקע'
                    : 'All walkers undergo background checks'
                  }
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-teal-100 flex items-center justify-center">
                  <Shield className="h-7 w-7 text-teal-600" />
                </div>
                {/* PR-LEGAL-B: previously 'Full Insurance' / 'Complete coverage
                    for every walk'. Replaced with the CEO-approved canonical
                    disclaimer per §8 of the Provider & Host Services Agreement. */}
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'מידע בטיחות' : 'Safety information'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew
                    ? 'ספקים עשויים להידרש להחזיק בביטוח מתאים בהתאם לסוג השירות והדין החל. פט וואש בע״מ אינה חברת ביטוח, סוכנות ביטוח או יועצת ביטוח.'
                    : 'Providers may be required to maintain their own insurance depending on the service type and applicable law. Pet Wash is not an insurance company, broker or adviser.'
                  }
                </p>
              </div>
              <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <Route className="h-7 w-7 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'עדכוני תמונות' : 'Photo Updates'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew 
                    ? 'תמונות מהטיול ישירות לנייד'
                    : 'Photos from the walk to your phone'
                  }
                </p>
              </div>
            </div>

            <div className="text-center mt-10">
              <Button 
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full px-8"
                onClick={() => onClickBecomeProvider(setLocation, 'walker')}
                data-testid="button-become-walker"
              >
                <Users className="h-5 w-5 me-2" />
                {isHebrew ? 'הפוך למטייל' : 'Become a Walker'}
              </Button>
            </div>
          </div>
        </div>

        {/* Provider Recruitment Section */}
        <div className="bg-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full mb-4">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">
                  {isHebrew ? 'הזדמנות הכנסה נוספת' : 'Extra Income Opportunity'}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                {isHebrew ? 'הפכו למטיילי כלבים ב-⁦Pet Wash™⁩' : 'Become a ⁦Pet Wash™⁩ Dog Walker'}
              </h2>
              {/* PR-LEGAL-B: previously claimed "full insurance" — replaced
                  with neutral recruitment copy per §8 of the Provider &
                  Host Services Agreement. */}
              <p className="text-gray-600 max-w-2xl mx-auto">
                {isHebrew
                  ? 'הרוויחו עד ₪65 לשעה תוך כדי הליכה עם כלבים. גמישות מלאה ותמיכה מהפלטפורמה.'
                  : 'Earn up to ₪65/hour while walking dogs. Full flexibility and platform support.'
                }
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <Wallet className="h-7 w-7 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? '₪40-65/שעה' : '₪40-65/hour'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew ? 'תעריפים תחרותיים' : 'Competitive rates'}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <Route className="h-7 w-7 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'טיולים בפארקים' : 'Park Walks'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew ? 'עבדו בחוץ עם כלבים' : 'Work outdoors with dogs'}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <Smartphone className="h-7 w-7 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  {isHebrew ? 'אפליקציה חכמה' : 'Smart App'}
                </h4>
                <p className="text-sm text-gray-500">
                  {isHebrew ? 'GPS מובנה, תשלום אוטומטי' : 'Built-in GPS, auto payments'}
                </p>
              </div>
            </div>

            <ProviderRegistrationBanner variant="compact" platform="walker" className="max-w-2xl mx-auto" />
          </div>
        </div>
      </div>
    </Layout>
  );
}
